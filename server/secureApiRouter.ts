// Unified Secure API Router for AI Student Hub
// Stage 12.1 & Stage 12.5: Central Security Gateway for Trusted Backend Operations
// 100% Free, Local Privacy, Strict Authentication, Authorization & Rate Limiting

import type { IncomingMessage, ServerResponse } from 'http';
import { authenticateRequest, sendAuthError } from './authMiddleware.ts';
import {
  applyCorsHeaders,
  validatePayloadSize,
  checkRateLimit,
  safeLog,
} from './securityMiddleware.ts';
import { handleSecureChromaRequest } from './secureChromaRouter.ts';
import { handleSecureOllamaRequest } from './secureOllamaRouter.ts';
import { handleExtractWebRequest } from './webExtractorMiddleware.ts';

/**
 * Main HTTP request handler mounted into Vite middleware pipeline and standalone server.
 */
export async function handleSecureApiRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const url = req.url || '';
  const method = req.method || 'GET';

  // 1. CORS Preflight & Headers
  const isOptionsHandled = applyCorsHeaders(req, res);
  if (isOptionsHandled) return;

  // 2. Health Check & Root Endpoints (for Render, uptime monitoring, and smoke tests)
  if (url === '/health' || url === '/api/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'ai-student-hub-backend',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        cloudEndpoints: ['/health', '/api/health', '/api/extract-web'],
      })
    );
    return;
  }

  if (url === '/' || url === '/api') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    });
    res.end(
      JSON.stringify({
        service: 'AI Student Hub Backend API',
        status: 'online',
        docs: 'https://studenthub-36f7a.web.app',
        availableEndpoints: ['/health', '/api/health', '/api/extract-web'],
      })
    );
    return;
  }

  // 3. Payload Size Validation (DoS Defense)
  if (!validatePayloadSize(req)) {
    safeLog('Blocked oversized request payload', { url, method });
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Payload Too Large: maximum allowed size is 2MB.' }));
    return;
  }

  // 4. Rate Limiting Check (by Client IP or token)
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const rateLimitResult = checkRateLimit(clientIp);
  if (!rateLimitResult.allowed) {
    safeLog('Rate limit exceeded', { clientIp, url });
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': String(rateLimitResult.retryAfterSec || 60),
    });
    res.end(
      JSON.stringify({
        error: 'Too Many Requests. Please wait before making more queries.',
        status: 'rate_limited',
        retryAfterSec: rateLimitResult.retryAfterSec,
      })
    );
    return;
  }

  // 5. Web Extraction Endpoint (/api/extract-web or /extract-web) - SSRF Protected
  if (url.startsWith('/api/extract-web') || url.startsWith('/extract-web')) {
    handleExtractWebRequest(req, res);
    return;
  }

  // 6. Protected Endpoints: Require Valid Firebase Authentication Token
  // Applies to /api/secure/chroma/* and /api/secure/ollama/*
  if (url.startsWith('/api/secure/')) {
    // Cloud Protection Guard: Do NOT expose local Ollama or ChromaDB on Render/production cloud
    const isLocalAiEnabled =
      process.env.ENABLE_LOCAL_AI_PROXIES === 'true' ||
      (process.env.NODE_ENV !== 'production' && !process.env.RENDER);

    if (!isLocalAiEnabled) {
      safeLog('Blocked cloud access to local AI proxy endpoint', { url });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error:
            'Local AI operations (ChromaDB / Ollama) run exclusively on your local laptop companion and are not exposed via cloud endpoints for student privacy and security.',
          status: 'local_companion_required',
        })
      );
      return;
    }

    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      safeLog('Unauthorized API access attempt blocked', { url, error: authResult.error });
      sendAuthError(res, authResult.statusCode || 401, authResult.error || 'Unauthorized');
      return;
    }

    const user = authResult.user;

    // Route to Secure ChromaDB Proxy (Local dev only)
    if (url.startsWith('/api/secure/chroma')) {
      await handleSecureChromaRequest(req, res, user);
      return;
    }

    // Route to Secure Ollama Proxy (Local dev only)
    if (url.startsWith('/api/secure/ollama')) {
      await handleSecureOllamaRequest(req, res, user);
      return;
    }
  }

  // 7. Unknown API Route
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `Not Found: Cannot ${method} ${url}` }));
}
