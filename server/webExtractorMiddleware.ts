// Server-side Web Content & YouTube Transcript Extractor for AI Student Hub
// Runs inside Vite dev and preview servers (Node.js environment)
// 100% Free, Zero Paid APIs, SSRF Protected, CORS-Free Server-Side Extraction

import dns from 'dns';
import http from 'http';
import https from 'https';
import type { IncomingMessage, ServerResponse } from 'http';

export interface WebExtractionResult {
  success: boolean;
  url: string;
  type: 'Web' | 'YouTube';
  title: string;
  extractedText: string;
  characterCount: number;
  error?: string;
}

// -------------------------------------------------------------
// 1. SSRF & Security Validation
// -------------------------------------------------------------

/**
 * Check if an IPv4 address is in a private, loopback, or reserved range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Treat invalid as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private network)
  if (a === 10) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local, AWS/GCP/Azure Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private network)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  // 192.168.0.0/16 (Private network)
  if (a === 192 && b === 168) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;

  return false;
}

/**
 * Check if an IPv6 address is in a private, loopback, or reserved range.
 */
function isPrivateIPv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === '::1' || norm === '::' || norm === '0:0:0:0:0:0:0:1') return true;
  if (norm.startsWith('fc') || norm.startsWith('fd')) return true; // Unique local (fc00::/7)
  if (norm.startsWith('fe80') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) return true; // Link-local
  if (norm.startsWith('::ffff:')) {
    const v4 = norm.substring(7);
    return isPrivateIPv4(v4);
  }
  return false;
}

/**
 * Validate that a URL is safe to fetch and does not target internal or cloud metadata endpoints.
 */
export async function validateSafeUrl(rawUrl: string): Promise<{ safeUrl: URL; hostname: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format.');
  }

  // 1. Enforce HTTP/HTTPS only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are allowed.');
  }

  // 2. Enforce standard ports (or default 80/443)
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new Error(`Non-standard port ${parsed.port} is blocked for security.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Block known localhost and metadata hosts immediately
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    hostname.includes('169.254')
  ) {
    throw new Error(`Access to internal/localhost address (${hostname}) is blocked.`);
  }

  // 4. Resolve DNS and verify all returned IP addresses are public
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new Error(`Could not resolve hostname: ${hostname}`);
    }

    for (const addr of addresses) {
      if (addr.family === 4 && isPrivateIPv4(addr.address)) {
        throw new Error(`Hostname ${hostname} resolves to private/internal IP (${addr.address}). Request blocked.`);
      }
      if (addr.family === 6 && isPrivateIPv6(addr.address)) {
        throw new Error(`Hostname ${hostname} resolves to private/internal IPv6 (${addr.address}). Request blocked.`);
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message.includes('resolves to private')) {
      throw error;
    }
    throw new Error(`Failed to resolve host ${hostname}: ${error.message}`);
  }

  return { safeUrl: parsed, hostname };
}

// -------------------------------------------------------------
// 2. Safe HTTP GET with Redirect Re-Validation & Limits
// -------------------------------------------------------------

interface SafeFetchOptions {
  timeoutMs?: number;
  maxSizeBytes?: number;
  maxRedirects?: number;
}

interface SafeFetchResponse {
  statusCode: number;
  contentType: string;
  body: string;
  finalUrl: string;
}

export async function safeFetchGet(
  targetUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResponse> {
  const {
    timeoutMs = 12000,
    maxSizeBytes = 2.5 * 1024 * 1024, // 2.5 MB max
    maxRedirects = 5,
  } = options;

  let currentUrl = targetUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    // SSRF re-validation on every redirect hop
    const { safeUrl } = await validateSafeUrl(currentUrl);

    const client = safeUrl.protocol === 'https:' ? https : http;

    const response = await new Promise<SafeFetchResponse>((resolve, reject) => {
      const req = client.get(
        safeUrl.toString(),
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 AIStudentHub/1.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          timeout: timeoutMs,
        },
        (res: IncomingMessage) => {
          const statusCode = res.statusCode || 200;
          const contentType = res.headers['content-type'] || '';

          // Handle Redirects
          if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, safeUrl).toString();
            res.resume(); // consume response data to free up memory
            resolve({
              statusCode,
              contentType,
              body: redirectUrl,
              finalUrl: redirectUrl,
            });
            return;
          }

          if (statusCode < 200 || statusCode >= 300) {
            res.resume();
            reject(new Error(`Server returned HTTP ${statusCode}: ${res.statusMessage || 'Request failed'}`));
            return;
          }

          // Content type check
          const isText =
            contentType.includes('text/') ||
            contentType.includes('application/xhtml+xml') ||
            contentType.includes('application/xml') ||
            contentType.includes('application/json');

          if (!isText && !contentType.includes('timedtext')) {
            res.resume();
            reject(new Error(`Unsupported content type: "${contentType}". Only text/html and web articles are supported.`));
            return;
          }

          let data = '';
          let totalBytes = 0;

          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            totalBytes += Buffer.byteLength(chunk, 'utf8');
            if (totalBytes > maxSizeBytes) {
              req.destroy(new Error(`Page size exceeded safe limit of ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`));
              return;
            }
            data += chunk;
          });

          res.on('end', () => {
            resolve({
              statusCode,
              contentType,
              body: data,
              finalUrl: safeUrl.toString(),
            });
          });

          res.on('error', (err: Error) => reject(err));
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
      });

      req.on('error', (err: Error) => reject(err));
    });

    // If it was a redirect, loop
    if (response.statusCode >= 300 && response.statusCode < 400) {
      redirectsCount++;
      currentUrl = response.finalUrl;
      continue;
    }

    return response;
  }

  throw new Error(`Too many redirects (exceeded ${maxRedirects} hops).`);
}

// -------------------------------------------------------------
// 3. HTML Article Text Cleaner
// -------------------------------------------------------------

function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
}

export function extractCleanArticleText(html: string, fallbackTitle: string): { title: string; text: string } {
  // 1. Extract Title
  let title = fallbackTitle;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = decodeHtmlEntities(titleMatch[1].trim().replace(/\s+/g, ' '));
  }

  // 2. Remove non-content elements
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '') // HTML comments
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<button[\s\S]*?<\/button>/gi, '');

  // 3. Extract main content block if present (<article> or <main>)
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (articleMatch && articleMatch[1].length > 300) {
    cleaned = articleMatch[1];
  } else if (mainMatch && mainMatch[1].length > 300) {
    cleaned = mainMatch[1];
  }

  // 4. Convert structural elements into paragraph breaks
  cleaned = cleaned
    .replace(/<(?:h[1-6]|p|div|section|blockquote|li|tr)[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '); // Strip all remaining tags

  // 5. Decode entities and normalize whitespace
  cleaned = decodeHtmlEntities(cleaned);

  // Group lines and remove boilerplate noise
  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 20); // Filter out short button text, tags, copyright lines

  const finalContent = paragraphs.join('\n\n').trim();

  return {
    title,
    text: finalContent,
  };
}

// -------------------------------------------------------------
// 4. YouTube Transcript Extractor (No API keys required)
// -------------------------------------------------------------

function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.searchParams.has('v')) {
        return parsed.searchParams.get('v');
      }
      const match = parsed.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (match) return match[1];
    }
    if (parsed.hostname === 'youtu.be') {
      const match = parsed.pathname.match(/^\/([a-zA-Z0-9_-]{11})/);
      if (match) return match[1];
    }
  } catch {
    // Ignore URL parse error
  }
  return null;
}

export async function extractYouTubeTranscript(
  videoUrl: string
): Promise<{ title: string; text: string }> {
  const videoId = extractYouTubeVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube video link or missing video ID.');
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await safeFetchGet(watchUrl, { timeoutMs: 12000 });

  // 1. Extract video title
  let videoTitle = `YouTube Video (${videoId})`;
  const titleMatch = response.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    videoTitle = decodeHtmlEntities(
      titleMatch[1].replace(/ - YouTube\s*$/i, '').trim()
    );
  }

  // 2. Locate player response JSON in script tags
  const playerResponseMatch = response.body.match(
    /ytInitialPlayerResponse\s*=\s*({.+?});(?:var|<\/script)/
  );

  if (!playerResponseMatch || !playerResponseMatch[1]) {
    throw new Error(
      `Could not load video player data for "${videoTitle}". The video may be private, age-restricted, or removed.`
    );
  }

  let playerResponse: any;
  try {
    playerResponse = JSON.parse(playerResponseMatch[1]);
  } catch {
    throw new Error(`Failed to parse player metadata for "${videoTitle}".`);
  }

  if (playerResponse.videoDetails?.title) {
    videoTitle = playerResponse.videoDetails.title;
  }

  // 3. Locate caption tracks
  const captionTracks =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!captionTracks || !Array.isArray(captionTracks) || captionTracks.length === 0) {
    throw new Error(
      `YouTube video "${videoTitle}" does not have accessible captions or transcripts available. Subtitles must be enabled on the video to generate study tools.`
    );
  }

  // Find English track first, or fall back to the first available language track
  const selectedTrack =
    captionTracks.find((t: any) => t.languageCode === 'en' || t.vssId?.includes('.en')) ||
    captionTracks[0];

  if (!selectedTrack || !selectedTrack.baseUrl) {
    throw new Error(
      `No readable caption URL found for YouTube video "${videoTitle}".`
    );
  }

  // 4. Fetch the transcript XML from baseUrl
  const captionResponse = await safeFetchGet(selectedTrack.baseUrl, { timeoutMs: 10000 });

  // 5. Parse <text> lines from the XML
  const textMatches = Array.from(
    captionResponse.body.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)
  );

  if (textMatches.length === 0) {
    throw new Error(
      `Transcript for "${videoTitle}" is empty or in an unsupported caption format.`
    );
  }

  const lines = textMatches
    .map((m) => decodeHtmlEntities(m[1].replace(/\n/g, ' ').trim()))
    .filter((line) => line.length > 0);

  // Group short subtitle lines into coherent paragraphs (roughly every 5-7 lines or 300 characters)
  const paragraphs: string[] = [];
  let currentPara = '';

  for (const line of lines) {
    currentPara += (currentPara ? ' ' : '') + line;
    if (currentPara.length >= 350 || line.endsWith('.') || line.endsWith('?') || line.endsWith('!')) {
      paragraphs.push(currentPara);
      currentPara = '';
    }
  }

  if (currentPara.trim().length > 0) {
    paragraphs.push(currentPara.trim());
  }

  const transcriptText = paragraphs.join('\n\n').trim();

  if (transcriptText.length < 50) {
    throw new Error(
      `Extracted transcript for "${videoTitle}" is too short (${transcriptText.length} characters) to synthesize reliable study material.`
    );
  }

  return {
    title: videoTitle,
    text: transcriptText,
  };
}

// -------------------------------------------------------------
// 5. Unified Extraction Dispatcher
// -------------------------------------------------------------

export async function extractWebContent(
  url: string,
  fallbackName?: string
): Promise<WebExtractionResult> {
  const isYouTube =
    url.includes('youtube.com') || url.includes('youtu.be');

  if (isYouTube) {
    try {
      const { title, text } = await extractYouTubeTranscript(url);
      return {
        success: true,
        url,
        type: 'YouTube',
        title: title || fallbackName || 'YouTube Video',
        extractedText: text,
        characterCount: text.length,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        url,
        type: 'YouTube',
        title: fallbackName || 'YouTube Video',
        extractedText: '',
        characterCount: 0,
        error: error.message || 'Failed to extract YouTube transcript.',
      };
    }
  }

  // Standard Web Article
  try {
    const response = await safeFetchGet(url);
    const { title, text } = extractCleanArticleText(response.body, fallbackName || url);

    if (text.length < 80) {
      return {
        success: false,
        url,
        type: 'Web',
        title: title || fallbackName || url,
        extractedText: '',
        characterCount: 0,
        error: 'No readable article text found on this webpage. The page may require JavaScript or login.',
      };
    }

    return {
      success: true,
      url,
      type: 'Web',
      title: title || fallbackName || url,
      extractedText: text,
      characterCount: text.length,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      url,
      type: 'Web',
      title: fallbackName || url,
      extractedText: '',
      characterCount: 0,
      error: error.message || 'Failed to fetch web resource.',
    };
  }
}

// -------------------------------------------------------------
// 6. Vite Server Middleware Handler
// -------------------------------------------------------------

export function handleExtractWebRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
    return;
  }

  let body = '';
  req.on('data', (chunk: Buffer | string) => {
    body += chunk.toString();
    if (body.length > 50000) {
      req.destroy();
    }
  });

  req.on('end', async () => {
    try {
      const parsed = JSON.parse(body || '{}');
      const { url, name } = parsed;

      if (!url || typeof url !== 'string') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing or invalid "url" parameter.' }));
        return;
      }

      const result = await extractWebContent(url, name);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err: unknown) {
      const error = err as Error;
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message || 'Internal server error during extraction.' }));
    }
  });
}
