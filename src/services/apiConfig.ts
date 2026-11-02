// src/services/apiConfig.ts
// Central API Configuration & Cloud Routing for AI Student Hub
// Keeps local AI companion operations local while routing cloud-compatible services to Render.

import { auth } from '../lib/firebase';

/**
 * Returns the base URL for the backend API.
 * - In local development: defaults to '' (empty string), using Vite dev server middleware or proxy.
 * - In production: uses VITE_BACKEND_API_URL or VITE_RENDER_API_URL if configured.
 */
export function getBackendApiUrl(): string {
  const envUrl =
    (import.meta.env.VITE_BACKEND_API_URL as string | undefined) ||
    (import.meta.env.VITE_RENDER_API_URL as string | undefined);

  if (envUrl && typeof envUrl === 'string') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // In local development or fallback, relative path routes through Vite dev server
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
 * -> 'https://your-service.onrender.com/api/extract-web' (in production)
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
