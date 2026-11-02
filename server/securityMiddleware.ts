// Server-Side Security Middleware for AI Student Hub
// Stage 12.5: Rate Limiting, Payload Sizing, CORS, and Sanitized Logging
// 100% Free, Zero External Paid Services, In-Memory Rate Limiting & DoS Defense

import type { IncomingMessage, ServerResponse } from 'http';

export const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Periodic cleanup of stale rate limit entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - DEFAULT_RATE_LIMIT_WINDOW_MS;
  for (const [key, record] of rateLimitMap.entries()) {
    record.timestamps = record.timestamps.filter((t) => t > cutoff);
    if (record.timestamps.length === 0) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Checks if a client exceeds the allowed request rate.
 */
export function checkRateLimit(
  clientId: string,
  maxRequests: number = DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  windowMs: number = DEFAULT_RATE_LIMIT_WINDOW_MS
): { allowed: boolean; remaining: number; retryAfterSec?: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = rateLimitMap.get(clientId);
  if (!record) {
    record = { timestamps: [] };
    rateLimitMap.set(clientId, record);
  }

  // Filter timestamps within current sliding window
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - record.timestamps.length,
  };
}

/**
 * Resets rate limit for a client (useful in testing).
 */
export function resetRateLimit(clientId: string): void {
  rateLimitMap.delete(clientId);
}

/**
 * Validates request payload size against max allowed bytes.
 */
export function validatePayloadSize(req: IncomingMessage, maxBytes: number = MAX_PAYLOAD_BYTES): boolean {
  const contentLength = req.headers['content-length'];
  if (contentLength) {
    const len = parseInt(contentLength, 10);
    if (!isNaN(len) && len > maxBytes) {
      return false;
    }
  }
  return true;
}

/**
 * Returns list of allowed CORS origins, combining production Firebase domains, local dev hosts, and custom env entries.
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = (process.env.ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return [
    'https://studenthub-36f7a.web.app',
    'https://studenthub-36f7a.firebaseapp.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...envOrigins,
  ];
}

/**
 * Applies CORS headers and handles preflight OPTIONS requests.
 */
export function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers['origin'];
  const allowedOrigins = getAllowedOrigins();

  const isAllowed =
    origin &&
    (allowedOrigins.includes(origin) ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.endsWith('.web.app') ||
      origin.endsWith('.firebaseapp.com'));

  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true; // handled
  }

  return false;
}

/**
 * Safely reads and buffers the JSON body of an incoming HTTP request with size enforcement.
 */
export async function readJsonBody<T = any>(
  req: IncomingMessage,
  maxBytes: number = MAX_PAYLOAD_BYTES
): Promise<{ success: boolean; data?: T; error?: string; statusCode?: number }> {
  return new Promise((resolve) => {
    let rawBody = '';
    let bytesReceived = 0;
    let isAborted = false;

    req.on('data', (chunk) => {
      if (isAborted) return;
      bytesReceived += chunk.length;

      if (bytesReceived > maxBytes) {
        isAborted = true;
        req.destroy();
        resolve({
          success: false,
          error: `Payload Too Large. Maximum allowed size is ${Math.round(maxBytes / 1024 / 1024)}MB.`,
          statusCode: 413,
        });
        return;
      }

      rawBody += chunk.toString('utf8');
    });

    req.on('end', () => {
      if (isAborted) return;
      if (!rawBody || !rawBody.trim()) {
        resolve({ success: true, data: {} as T });
        return;
      }

      try {
        const parsed = JSON.parse(rawBody);
        resolve({ success: true, data: parsed });
      } catch (err) {
        resolve({
          success: false,
          error: 'Malformed JSON payload.',
          statusCode: 400,
        });
      }
    });

    req.on('error', (err) => {
      if (isAborted) return;
      resolve({
        success: false,
        error: `Request stream read error: ${err.message}`,
        statusCode: 400,
      });
    });
  });
}

/**
 * Safe logger that sanitizes bearer tokens and sensitive values.
 */
export function safeLog(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    const sanitized = { ...meta };
    for (const key of Object.keys(sanitized)) {
      const lower = key.toLowerCase();
      if (lower.includes('token') || lower.includes('auth') || lower.includes('secret') || lower.includes('password')) {
        sanitized[key] = '[REDACTED]';
      }
    }
    console.log(`[SECURE_API] ${message}`, JSON.stringify(sanitized));
  } else {
    console.log(`[SECURE_API] ${message}`);
  }
}
