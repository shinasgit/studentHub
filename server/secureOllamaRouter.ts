// Secure Ollama Proxy Router for AI Student Hub
// Stage 12.4: Protected Model Generation, Size Validation & Timeout Enforcement
// Guards local Ollama service against unauthorized external access and DoS payloads
// 100% Free, Local Privacy, Zero Paid APIs

import http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import type { AuthenticatedUser } from './authMiddleware.ts';
import { readJsonBody, safeLog } from './securityMiddleware.ts';

const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = parseInt(process.env.OLLAMA_PORT || '11434', 10);
export const MAX_PROMPT_LENGTH = 32768; // 32KB max prompt text
export const ALLOWED_MODELS = [
  'llama3.2:3b',
  'llama3.2',
  'nomic-embed-text',
  'nomic-embed-text:latest',
];

/**
 * Handles authenticated Ollama requests under /api/secure/ollama/*
 */
export async function handleSecureOllamaRequest(
  req: IncomingMessage,
  res: ServerResponse,
  user: AuthenticatedUser
): Promise<void> {
  const url = req.url || '';
  // Strip /api/secure/ollama prefix to get relative Ollama path (e.g. /api/generate, /api/chat, /api/embed)
  const ollamaPath = url.replace(/^\/api\/secure\/ollama/, '') || '/';
  const method = req.method || 'POST';

  // 1. GET requests (e.g. /api/version, /api/tags for health checks)
  if (method === 'GET') {
    const forwardReq = http.request(
      {
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: ollamaPath,
        method: 'GET',
        timeout: 5000,
      },
      (ollamaRes) => {
        res.writeHead(ollamaRes.statusCode || 200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        ollamaRes.pipe(res);
      }
    );

    forwardReq.on('error', (err) => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ollama service offline or unreachable.', details: err.message }));
    });

    forwardReq.end();
    return;
  }

  // 2. Parse and validate JSON payload for POST requests (/api/generate, /api/chat, /api/embed)
  const bodyResult = await readJsonBody(req);
  if (!bodyResult.success) {
    res.writeHead(bodyResult.statusCode || 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: bodyResult.error }));
    return;
  }

  const payload = bodyResult.data || {};

  // 3. Model validation
  const requestedModel = payload.model;
  if (requestedModel && typeof requestedModel === 'string') {
    const isAllowed = ALLOWED_MODELS.some(
      (m) => requestedModel.toLowerCase() === m.toLowerCase() || requestedModel.toLowerCase().startsWith('llama')
    );
    if (!isAllowed) {
      safeLog('SECURITY ALERT: Attempt to invoke unauthorized model', {
        user: user.uid,
        model: requestedModel,
      });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: `Model "${requestedModel}" is not permitted. Only curriculum-approved models (Llama 3.2 3B, Nomic Embed Text) are supported.`,
          status: 'invalid_model',
        })
      );
      return;
    }
  }

  // 4. Prompt size validation (DoS prevention)
  let totalPromptChars = 0;
  if (typeof payload.prompt === 'string') {
    totalPromptChars += payload.prompt.length;
  }
  if (Array.isArray(payload.messages)) {
    for (const msg of payload.messages) {
      if (typeof msg?.content === 'string') {
        totalPromptChars += msg.content.length;
      }
    }
  }

  if (totalPromptChars > MAX_PROMPT_LENGTH) {
    safeLog('SECURITY ALERT: Oversized prompt rejected', {
      user: user.uid,
      length: totalPromptChars,
      max: MAX_PROMPT_LENGTH,
    });
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: `Request prompt exceeds safety limit of ${MAX_PROMPT_LENGTH} characters (received ${totalPromptChars} characters).`,
        status: 'payload_too_large',
      })
    );
    return;
  }

  // 5. Forward request to Ollama with 90-second timeout
  const payloadStr = JSON.stringify(payload);
  const forwardReq = http.request(
    {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: ollamaPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadStr),
      },
      timeout: 90000, // 90 seconds for long inferences
    },
    (ollamaRes) => {
      res.writeHead(ollamaRes.statusCode || 200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      ollamaRes.pipe(res);
    }
  );

  forwardReq.on('error', (err) => {
    safeLog('Ollama forward error', { error: err.message });
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Local Ollama LLM service is offline or unreachable.',
        details: err.message,
      })
    );
  });

  forwardReq.on('timeout', () => {
    forwardReq.destroy();
    res.writeHead(504, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'LLM inference generation timed out.' }));
  });

  forwardReq.write(payloadStr);
  forwardReq.end();
}
