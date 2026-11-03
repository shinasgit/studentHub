// src/services/apiConfig.ts
// Central API Configuration & Cloud Routing for AI Student Hub
// Keeps local AI companion operations local while routing cloud-compatible services to Render.

import { auth } from '../lib/firebase';

/**
 * Deployed Render backend production URL.
 */
export const DEFAULT_RENDER_BACKEND_URL = 'https://ai-studenthub-backend.onrender.com';

/**
 * Returns the base URL for the cloud backend API.
 * - Checks VITE_API_BASE_URL, VITE_BACKEND_API_URL, and VITE_RENDER_API_URL.
 * - In local development: defaults to '' (empty string), using Vite dev server middleware or proxy.
 * - In production: uses configured env URL, or falls back to DEFAULT_RENDER_BACKEND_URL.
 */
export function getBackendApiUrl(): string {
  const envUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    (import.meta.env.VITE_BACKEND_API_URL as string | undefined) ||
    (import.meta.env.VITE_RENDER_API_URL as string | undefined);

  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // In production builds, default to deployed Render backend
  if (import.meta.env.PROD) {
    return DEFAULT_RENDER_BACKEND_URL;
  }

  // In local development, empty string routes to Vite dev server middleware
  return '';
}

/**
 * Determines whether a remote Render/cloud backend is configured.
 */
export function isRemoteBackendConfigured(): boolean {
  return Boolean(getBackendApiUrl());
}

/**
 * Constructs a fully qualified cloud endpoint URL.
 * Example: getCloudApiEndpoint('/api/extract-web')
 * -> 'https://ai-studenthub-backend.onrender.com/api/extract-web' (when pointing to Render)
 * -> '/api/extract-web' (in local dev with Vite)
 */
export function getCloudApiEndpoint(endpointPath: string): string {
  const base = getBackendApiUrl();
  const normalizedPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  return `${base}${normalizedPath}`;
}

/**
 * Asynchronously retrieves a valid Firebase Authentication Bearer header

 * for authenticated backend requests.
 */
export async function getAuthBearerHeader(): Promise<Record<string, string>> {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      if (token) {
        return {
          Authorization: `Bearer ${token}`,
        };
      }
    }
  } catch (err) {
    console.warn('[API_CONFIG] Could not retrieve Firebase ID token:', err);
  }
  return {};
}

/**
 * Checks backend health asynchronously.
 */
export async function checkBackendHealth(): Promise<{
  online: boolean;
  service?: string;
  timestamp?: string;
  error?: string;
}> {
  try {
    const url = getCloudApiEndpoint('/health');
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return { online: true, service: data.service, timestamp: data.timestamp };
    }
    return { online: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return {
      online: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Executes a fetch request to the cloud backend with Firebase Auth Bearer token and JSON headers attached.
 */
export async function fetchWithAuth(
  endpointPath: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = getCloudApiEndpoint(endpointPath);
  const authHeaders = await getAuthBearerHeader();

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  for (const [key, value] of Object.entries(authHeaders)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

