// ChromaDB Service for AI Student Hub RAG Architecture
// Stage 4: ChromaDB Setup & Vector Storage Layer
// 100% Free, Local Privacy, Persistent on Disk

import type { EmbeddedChunk } from '../types/embedding';
import type {
  ChromaConnectionStatus,
  ChromaCollection,
  ChromaStorageOptions,
  ChromaVectorMetadata,
  ChromaRecord,
  ChromaOperationResult,
  ChromaCollectionStats,
  ChromaFilterCriteria,
} from '../types/chroma';
import {
  DEFAULT_CHROMA_COLLECTION,
  DEFAULT_CHROMA_DIRECT_ENDPOINT,
  DEFAULT_CHROMA_PROXY_ENDPOINT,
} from '../types/chroma';

export const DEFAULT_TENANT = 'default_tenant';
export const DEFAULT_DATABASE = 'default_database';
export const STORAGE_KEY_CHROMA_ENDPOINT = 'ai_student_hub_chroma_endpoint';

/**
 * Retrieve the active ChromaDB API base URL.
 * In Node.js / testing environments, defaults to http://127.0.0.1:8000.
 * In browser environments, defaults to /api/chroma (Vite dev proxy) to eliminate CORS.
 */
export const getChromaBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return DEFAULT_CHROMA_DIRECT_ENDPOINT;
  }
  return localStorage.getItem(STORAGE_KEY_CHROMA_ENDPOINT) || DEFAULT_CHROMA_PROXY_ENDPOINT;
};

/**
 * Set a custom ChromaDB API base URL in browser localStorage.
 */
export const setChromaBaseUrl = (url: string): void => {
  if (typeof window === 'undefined') return;
  const clean = url.trim().replace(/\/+$/, '');
  localStorage.setItem(STORAGE_KEY_CHROMA_ENDPOINT, clean || DEFAULT_CHROMA_PROXY_ENDPOINT);
};

/**
 * Builds the base URL for Chroma v2 API endpoints.
 */
const getChromaV2Url = (customBaseUrl?: string): string => {
  const base = (customBaseUrl || getChromaBaseUrl()).replace(/\/+$/, '');
  return `${base}/api/v2`;
};

/**
 * Builds the URL for tenant and database scoped collection endpoints in Chroma v2.
 */
const getCollectionsEndpoint = (customBaseUrl?: string): string => {
  const v2 = getChromaV2Url(customBaseUrl);
  return `${v2}/tenants/${DEFAULT_TENANT}/databases/${DEFAULT_DATABASE}/collections`;
};

/**
 * Formats Chroma connection errors with actionable guidance for students / developers.
 */
export const parseChromaError = (err: unknown, baseUrl: string): string => {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes('fetch failed') ||
      msg.includes('econnrefused') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror')
    ) {
      return `ChromaDB is not running or unreachable at ${baseUrl}. Please run "powershell scripts/start_chroma.ps1" to start your local vector database.`;
    }
    return err.message;
  }
  return String(err);
};

/**
 * Checks whether the local ChromaDB server is accessible and healthy.
 */
export const checkChromaConnection = async (
  customBaseUrl?: string
): Promise<ChromaConnectionStatus> => {
  const baseUrl = customBaseUrl || getChromaBaseUrl();
  const v2 = getChromaV2Url(baseUrl);

  try {
    const heartbeatRes = await fetch(`${v2}/heartbeat`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!heartbeatRes.ok) {
      return {
        connected: false,
        baseUrl,
        error: `Chroma server responded with HTTP status ${heartbeatRes.status}`,
      };
    }

    const heartbeatData = (await heartbeatRes.json()) as { 'nanosecond heartbeat'?: number };

    // Fetch version if available
    let version: string | undefined;
    try {
      const versionRes = await fetch(`${v2}/version`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (versionRes.ok) {
        const verData = (await versionRes.json()) as string | { version?: string };
        version = typeof verData === 'string' ? verData : verData?.version;
      }
    } catch {
      // Version endpoint is optional
    }

    return {
      connected: true,
      baseUrl,
      version: version || '1.5.x',
      heartbeat: heartbeatData['nanosecond heartbeat'],
    };
  } catch (err) {
    return {
      connected: false,
      baseUrl,
      error: parseChromaError(err, baseUrl),
    };
  }
};

/**
 * Lists all collections in the default tenant and database.
 */
export const listCollections = async (
  options?: ChromaStorageOptions
): Promise<ChromaCollection[]> => {
  const url = getCollectionsEndpoint(options?.customBaseUrl);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to list Chroma collections (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as ChromaCollection[];
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error(parseChromaError(err, options?.customBaseUrl || getChromaBaseUrl()));
  }
};

/**
 * Checks whether a collection exists in ChromaDB.
 */
export const collectionExists = async (
  collectionName: string = DEFAULT_CHROMA_COLLECTION,
  options?: ChromaStorageOptions
): Promise<boolean> => {
  const collections = await listCollections(options);
  return collections.some((c) => c.name === collectionName);
};

/**
 * Retrieves a collection by name or ID.
 */
export const getCollection = async (
  collectionName: string = DEFAULT_CHROMA_COLLECTION,
  options?: ChromaStorageOptions
): Promise<ChromaCollection | null> => {
  const collections = await listCollections(options);
  const found = collections.find((c) => c.name === collectionName || c.id === collectionName);
  return found || null;
};

/**
 * Creates or retrieves a ChromaDB collection with cosine distance metric.
 */
export const getOrCreateCollection = async (
  collectionName: string = DEFAULT_CHROMA_COLLECTION,
  options?: ChromaStorageOptions
): Promise<ChromaCollection> => {
  const endpoint = getCollectionsEndpoint(options?.customBaseUrl);

  const payload = {
    name: collectionName,
    get_or_create: true,
    metadata: {
      'hnsw:space': 'cosine',
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(
        `Failed to get or create collection "${collectionName}" (${response.status}): ${errText}`
      );
    }

    const collection = (await response.json()) as ChromaCollection;
    return collection;
  } catch (err) {
    throw new Error(parseChromaError(err, options?.customBaseUrl || getChromaBaseUrl()));
  }
};

/**
 * Deletes a collection from ChromaDB by name.
 */
export const deleteCollection = async (
  collectionName: string,
  options?: ChromaStorageOptions
): Promise<boolean> => {
  const endpoint = `${getCollectionsEndpoint(options?.customBaseUrl)}/${collectionName}`;

  try {
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
      signal: options?.abortSignal,
    });

    if (response.status === 404) {
      return false; // Did not exist
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to delete collection "${collectionName}" (${response.status}): ${errText}`);
    }

    return true;
  } catch (err) {
    throw new Error(parseChromaError(err, options?.customBaseUrl || getChromaBaseUrl()));
  }
};

/**
 * Sanitizes metadata for ChromaDB storage.
 * ChromaDB restricts metadata values to primitive types: string, number, and boolean.
 * Nested objects, null, or undefined are flattened or excluded.
 */
export const sanitizeChromaMetadata = (chunk: EmbeddedChunk): ChromaVectorMetadata => {
  const baseMeta: ChromaVectorMetadata = {
    chunkId: chunk.chunkId,
    subjectId: chunk.subjectId || '',
    moduleId: chunk.moduleId || '',
    resourceId: chunk.resourceId || '',
    resourceName: chunk.resourceName || '',
    pageNumber: chunk.pageNumber ?? 1,
    chunkIndex: chunk.chunkIndex,
    totalChunks: chunk.totalChunks,
    tokenCount: chunk.tokenCount,
    characterCount: chunk.characterCount,
  };

  // Attach studentId if present in chunk metadata (for multi-student data isolation)
  if (chunk.metadata?.studentId && typeof chunk.metadata.studentId === 'string') {
    baseMeta.studentId = chunk.metadata.studentId;
  }

  // Preserve extraction flags if present
  if (chunk.metadata?.extractionMethod && typeof chunk.metadata.extractionMethod === 'string') {
    baseMeta.extractionMethod = chunk.metadata.extractionMethod;
  }
  if (chunk.metadata?.isScanned !== undefined) {
    baseMeta.isScanned = Boolean(chunk.metadata.isScanned);
  }

  return baseMeta;
};

/**
 * Stores an array of EmbeddedChunk objects into ChromaDB.
 *
 * Requirements Met:
 * - Preserves 768-dimensional numerical vectors generated by nomic-embed-text.
 * - Stores original chunk text as the document.
 * - Stores all required metadata: chunkId, subjectId, moduleId, resourceId, resourceName,
 *   pageNumber, chunkIndex, totalChunks, tokenCount, characterCount.
 * - Supports student-level isolation via studentId.
 */
export const addEmbeddedChunks = async (
  chunks: EmbeddedChunk[],
  options?: ChromaStorageOptions
): Promise<ChromaOperationResult> => {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return {
      success: true,
      collectionName: options?.collectionName || DEFAULT_CHROMA_COLLECTION,
      count: 0,
      ids: [],
      durationMs: 0,
    };
  }

  const startTime = performance.now();
  const collectionName = options?.collectionName || DEFAULT_CHROMA_COLLECTION;
  const collection = await getOrCreateCollection(collectionName, options);

  const endpoint = `${getCollectionsEndpoint(options?.customBaseUrl)}/${collection.id}/add`;

  // Chroma payload structure
  const ids: string[] = [];
  const embeddings: number[][] = [];
  const documents: string[] = [];
  const metadatas: ChromaVectorMetadata[] = [];

  for (const chunk of chunks) {
    if (!chunk.embedding || !Array.isArray(chunk.embedding) || chunk.embedding.length === 0) {
      throw new Error(`Cannot store chunk "${chunk.chunkId}": Missing or invalid embedding vector.`);
    }

    ids.push(chunk.chunkId);
    embeddings.push(chunk.embedding);
    documents.push(chunk.text);
    metadatas.push(sanitizeChromaMetadata(chunk));
  }

  const payload = {
    ids,
    embeddings,
    documents,
    metadatas,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(
        `Failed to add ${chunks.length} chunks to collection "${collectionName}" (${response.status}): ${errText}`
      );
    }

    const durationMs = Math.round(performance.now() - startTime);

    return {
      success: true,
      collectionName,
      count: ids.length,
      ids,
      durationMs,
    };
  } catch (err) {
    throw new Error(parseChromaError(err, options?.customBaseUrl || getChromaBaseUrl()));
  }
};

/**
 * Retrieves a single stored chunk record by its chunkId.
 */
export const getChunkById = async (
  chunkId: string,
  options?: ChromaStorageOptions
): Promise<ChromaRecord | null> => {
  if (!chunkId || typeof chunkId !== 'string') return null;

  const results = await getChunksByIds([chunkId], options);
  return results.length > 0 ? results[0] : null;
};

/**
 * Retrieves multiple stored chunk records by their IDs.
 */
export const getChunksByIds = async (
  chunkIds: string[],
  options?: ChromaStorageOptions
): Promise<ChromaRecord[]> => {
  if (!Array.isArray(chunkIds) || chunkIds.length === 0) return [];

  const collectionName = options?.collectionName || DEFAULT_CHROMA_COLLECTION;
  const collection = await getCollection(collectionName, options);
  if (!collection) return [];

  const endpoint = `${getCollectionsEndpoint(options?.customBaseUrl)}/${collection.id}/get`;

  const payload = {
    ids: chunkIds,
    include: ['documents', 'metadatas', 'embeddings'],
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to get chunks by IDs (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as {
      ids?: string[];
      documents?: Array<string | null>;
      embeddings?: number[][];
      metadatas?: Array<ChromaVectorMetadata | null>;
    };

    if (!data.ids || data.ids.length === 0) return [];

    const records: ChromaRecord[] = [];
    for (let i = 0; i < data.ids.length; i++) {
      const id = data.ids[i];
      const text = data.documents?.[i] || '';
      const embedding = data.embeddings?.[i] || [];
      const metadata = data.metadatas?.[i] || ({} as ChromaVectorMetadata);

      records.push({
        id,
        text,
        embedding,
        metadata,
      });
    }

    return records;
  } catch (err) {
    throw new Error(parseChromaError(err, options?.customBaseUrl || getChromaBaseUrl()));
  }
};

/**
 * Builds a valid Chroma metadata where filter dictionary from ChromaFilterCriteria.
 */
export const buildChromaWhereFilter = (
  filter: ChromaFilterCriteria
): Record<string, unknown> | undefined => {
  const activeEntries = Object.entries(filter).filter(
    ([, val]) => val !== undefined && val !== null && val !== ''
  );

  if (activeEntries.length === 0) return undefined;

  if (activeEntries.length === 1) {
    const [key, val] = activeEntries[0];
    return { [key]: val };
  }

  // Multi-attribute filter using $and
  return {
    $and: activeEntries.map(([key, val]) => ({ [key]: val })),
  };
};

/**
 * Deletes stored chunks by their IDs.
 */
export const deleteChunksByIds = async (
  chunkIds: string[],
  options?: ChromaStorageOptions
): Promise<number> => {
  if (!Array.isArray(chunkIds) || chunkIds.length === 0) return 0;

  const collectionName = options?.collectionName || DEFAULT_CHROMA_COLLECTION;
  const collection = await getCollection(collectionName, options);
  if (!collection) return 0;

  const endpoint = `${getCollectionsEndpoint(options?.customBaseUrl)}/${collection.id}/delete`;

  const payload = {
    ids: chunkIds,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to delete chunks by IDs (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as { deleted?: number };
    return typeof data.deleted === 'number' ? data.deleted : chunkIds.length;
  } catch (err) {
    throw new Error(parseChromaError(err, options?.customBaseUrl || getChromaBaseUrl()));
  }
};

/**
 * Deletes all stored chunks associated with a specific resource ID.
 */
export const deleteChunksByResourceId = async (
  resourceId: string,
  options?: ChromaStorageOptions
): Promise<number> => {
  if (!resourceId || typeof resourceId !== 'string') return 0;

  const collectionName = options?.collectionName || DEFAULT_CHROMA_COLLECTION;
  const collection = await getCollection(collectionName, options);
  if (!collection) return 0;

  const endpoint = `${getCollectionsEndpoint(options?.customBaseUrl)}/${collection.id}/delete`;

  const payload = {
    where: { resourceId },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to delete chunks for resource "${resourceId}" (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as { deleted?: number };
    return typeof data.deleted === 'number' ? data.deleted : 0;
  } catch (err) {
    throw new Error(parseChromaError(err, options?.customBaseUrl || getChromaBaseUrl()));
  }
};

/**
 * Deletes chunks matching specific filter criteria (e.g. subjectId, moduleId, studentId).
 */
export const deleteChunksByFilter = async (
  filter: ChromaFilterCriteria,
  options?: ChromaStorageOptions
): Promise<number> => {
  const where = buildChromaWhereFilter(filter);
  if (!where) return 0;

  const collectionName = options?.collectionName || DEFAULT_CHROMA_COLLECTION;
  const collection = await getCollection(collectionName, options);
  if (!collection) return 0;

  const endpoint = `${getCollectionsEndpoint(options?.customBaseUrl)}/${collection.id}/delete`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ where }),
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to delete chunks by filter (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as { deleted?: number };
    return typeof data.deleted === 'number' ? data.deleted : 0;
  } catch (err) {
    throw new Error(parseChromaError(err, options?.customBaseUrl || getChromaBaseUrl()));
  }
};

/**
 * Returns collection statistics (total record count, collection metadata).
 */
export const getCollectionStats = async (
  collectionName: string = DEFAULT_CHROMA_COLLECTION,
  options?: ChromaStorageOptions
): Promise<ChromaCollectionStats> => {
  const collection = await getOrCreateCollection(collectionName, options);
  const endpoint = `${getCollectionsEndpoint(options?.customBaseUrl)}/${collection.id}/count`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to get collection count (${response.status}): ${errText}`);
    }

    const totalVectors = (await response.json()) as number;

    return {
      collectionName,
      collectionId: collection.id,
      totalVectors: typeof totalVectors === 'number' ? totalVectors : 0,
      metadata: collection.metadata,
    };
  } catch (err) {
    throw new Error(parseChromaError(err, options?.customBaseUrl || getChromaBaseUrl()));
  }
};
