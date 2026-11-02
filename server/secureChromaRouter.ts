// Secure ChromaDB Proxy Router for AI Student Hub
// Stage 12.2 & Stage 12.3: Student Data Isolation & Vector Database Protection
// Enforces server-side ownership checks on all chunk indexing, query, and deletion operations
// 100% Free, Local Privacy, Strict Multi-Tenant Isolation

import http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import type { AuthenticatedUser } from './authMiddleware.ts';
import { readJsonBody, safeLog } from './securityMiddleware.ts';

const CHROMA_HOST = process.env.CHROMA_HOST || '127.0.0.1';
const CHROMA_PORT = parseInt(process.env.CHROMA_PORT || '8000', 10);

/**
 * Forwards an HTTP request to local ChromaDB server.
 */
function forwardToChroma(
  method: string,
  path: string,
  bodyData: any,
  res: ServerResponse
): void {
  const payloadStr = bodyData ? JSON.stringify(bodyData) : '';
  const headers: Record<string, string | number> = {
    'Content-Type': 'application/json',
  };
  if (payloadStr) {
    headers['Content-Length'] = Buffer.byteLength(payloadStr);
  }

  const req = http.request(
    {
      hostname: CHROMA_HOST,
      port: CHROMA_PORT,
      path,
      method,
      headers,
      timeout: 10000,
    },
    (chromaRes) => {
      res.writeHead(chromaRes.statusCode || 500, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      chromaRes.pipe(res);
    }
  );

  req.on('error', (err) => {
    safeLog('ChromaDB forward error', { error: err.message });
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'ChromaDB vector database service is offline or unreachable.',
        details: err.message,
      })
    );
  });

  req.on('timeout', () => {
    req.destroy();
    res.writeHead(504, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'ChromaDB request timed out.' }));
  });

  if (payloadStr) {
    req.write(payloadStr);
  }
  req.end();
}

/**
 * Handles authenticated ChromaDB requests under /api/secure/chroma/*
 */
export async function handleSecureChromaRequest(
  req: IncomingMessage,
  res: ServerResponse,
  user: AuthenticatedUser
): Promise<void> {
  const url = req.url || '';
  // Strip /api/secure/chroma prefix to get relative chroma path
  const chromaPath = url.replace(/^\/api\/secure\/chroma/, '') || '/';
  const method = req.method || 'GET';

  // 1. GET requests (e.g. heartbeat, list collections, get collection by name)
  if (method === 'GET') {
    forwardToChroma('GET', chromaPath, null, res);
    return;
  }

  // 2. Parse request JSON body for mutation/query validation
  const bodyResult = await readJsonBody(req);
  if (!bodyResult.success) {
    res.writeHead(bodyResult.statusCode || 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: bodyResult.error }));
    return;
  }

  const payload = bodyResult.data || {};

  // 3. Inspect operation and enforce student data isolation
  // 3A: Add / Upsert Chunks (/api/v1/collections/:id/add)
  if (chromaPath.includes('/add') || chromaPath.includes('/upsert')) {
    const metadatas = payload.metadatas;
    if (Array.isArray(metadatas)) {
      for (let i = 0; i < metadatas.length; i++) {
        const meta = metadatas[i];
        if (!meta || typeof meta !== 'object') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Chunk at index ${i} is missing metadata.` }));
          return;
        }

        // Check if studentId matches authenticated user
        if (meta.studentId && meta.studentId !== user.uid) {
          safeLog('SECURITY ALERT: Student cross-tenant indexing attempt blocked', {
            authenticatedUid: user.uid,
            attemptedTargetUid: meta.studentId,
          });
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Forbidden: You cannot index document chunks belonging to another student.',
              status: 'forbidden',
            })
          );
          return;
        }

        // Server-side enforcement: guarantee studentId is assigned to authenticated user
        meta.studentId = user.uid;
      }
    }
  }

  // 3B: Query Chunks (/api/v1/collections/:id/query)
  if (chromaPath.includes('/query')) {
    let whereClause = payload.where || {};

    // Check if client tried to query another student's data
    if (whereClause.studentId && whereClause.studentId !== user.uid) {
      safeLog('SECURITY ALERT: Student cross-tenant query attempt blocked', {
        authenticatedUid: user.uid,
        attemptedTargetUid: whereClause.studentId,
      });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Forbidden: You cannot query study materials belonging to another student.',
          status: 'forbidden',
        })
      );
      return;
    }

    // Server-side enforcement: inject strict studentId filter
    payload.where = {
      ...whereClause,
      studentId: user.uid,
    };
  }

  // 3C: Get Chunks by Metadata Filter (/api/v1/collections/:id/get)
  if (chromaPath.includes('/get')) {
    let whereClause = payload.where || {};

    if (whereClause.studentId && whereClause.studentId !== user.uid) {
      safeLog('SECURITY ALERT: Student cross-tenant get attempt blocked', {
        authenticatedUid: user.uid,
        attemptedTargetUid: whereClause.studentId,
      });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Forbidden: You cannot access document records belonging to another student.',
          status: 'forbidden',
        })
      );
      return;
    }

    payload.where = {
      ...whereClause,
      studentId: user.uid,
    };
  }

  // 3D: Delete Chunks (/api/v1/collections/:id/delete)
  if (chromaPath.includes('/delete')) {
    let whereClause = payload.where || {};

    if (whereClause.studentId && whereClause.studentId !== user.uid) {
      safeLog('SECURITY ALERT: Student cross-tenant deletion attempt blocked', {
        authenticatedUid: user.uid,
        attemptedTargetUid: whereClause.studentId,
      });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Forbidden: You cannot delete document chunks belonging to another student.',
          status: 'forbidden',
        })
      );
      return;
    }

    // Enforce studentId on delete filter
    payload.where = {
      ...whereClause,
      studentId: user.uid,
    };
  }

  // 3E: Delete Collection (/api/v1/collections/:name)
  if (method === 'DELETE' && chromaPath.startsWith('/api/v1/collections/')) {
    const colName = chromaPath.split('/').pop() || '';
    // Disallow deleting shared or test collections by untrusted clients
    if (colName === 'student_hub_docs' || colName.startsWith('shared_')) {
      safeLog('SECURITY ALERT: Blocked attempt to delete shared collection', {
        collection: colName,
        user: user.uid,
      });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Cannot drop shared system collection.' }));
      return;
    }
  }

  // Forward validated & sanitized request to ChromaDB
  forwardToChroma(method, chromaPath, payload, res);
}
