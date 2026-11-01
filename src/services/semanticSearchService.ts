// Semantic Search & Retrieval Service for AI Student Hub RAG Architecture
// Stage 6: Semantic Search & Document Retrieval
// 100% Free, Local Privacy, Authenticated Multi-Tenant Isolation

import { generateEmbedding } from './embeddingService';
import { querySimilarChunks } from './chromaService';
import { resolveAuthenticatedStudentId } from './pdfIndexingService';
import { NOMIC_EMBED_DIMENSIONS } from '../types/embedding';
import { DEFAULT_CHROMA_COLLECTION, type ChromaFilterCriteria } from '../types/chroma';
import type {
  SemanticSearchFilters,
  SemanticSearchResultItem,
  SemanticSearchOptions,
  SemanticSearchResponse,
} from '../types/semanticSearch';

/**
 * Asymmetric task prefix for search queries embedded with Nomic Embed Text.
 */
export const NOMIC_QUERY_PREFIX = 'search_query: ';

/**
 * Default minimum similarity threshold for filtering out irrelevant vector matches [0.0, 1.0].
 * Initial baseline configuration: 0.50.
 */
export const DEFAULT_MIN_SIMILARITY = 0.50;

/**
 * Prepares query text for query embedding with Nomic Embed Text.
 * Prepends 'search_query: ' prefix if not already present.
 */
export const formatNomicQueryText = (query: string): string => {
  const clean = (query || '').trim();
  if (clean.startsWith(NOMIC_QUERY_PREFIX)) {
    return clean;
  }
  return `${NOMIC_QUERY_PREFIX}${clean}`;
};

/**
 * Validates that an embedding vector conforms strictly to nomic-embed-text standard (768 finite floats).
 */
export const validateQueryEmbeddingVector = (vector: unknown): number[] => {
  if (!Array.isArray(vector)) {
    throw new Error(
      `Query embedding validation failed: Expected an array, received ${typeof vector}.`
    );
  }

  if (vector.length !== NOMIC_EMBED_DIMENSIONS) {
    throw new Error(
      `Query embedding validation failed: Expected exactly ${NOMIC_EMBED_DIMENSIONS} dimensions for nomic-embed-text, received ${vector.length}.`
    );
  }

  for (let i = 0; i < vector.length; i++) {
    const val = vector[i];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw new Error(
        `Query embedding validation failed: Vector element at index ${i} is not a valid finite number: ${val}`
      );
    }
  }

  return vector as number[];
};

/**
 * Validates metadata filters passed to the search service.
 * Throws a descriptive error if unexpected types or malformed criteria are detected.
 */
export const validateSearchFilters = (filters?: unknown): SemanticSearchFilters | undefined => {
  if (!filters) return undefined;

  if (typeof filters !== 'object' || Array.isArray(filters)) {
    throw new Error('Invalid metadata filter: Expected an object of filter criteria.');
  }

  const f = filters as Record<string, unknown>;

  if (f.subjectId !== undefined) {
    if (typeof f.subjectId !== 'string' || !f.subjectId.trim()) {
      throw new Error('Invalid metadata filter: "subjectId" must be a non-empty string.');
    }
  }

  if (f.moduleId !== undefined) {
    if (typeof f.moduleId !== 'string' || !f.moduleId.trim()) {
      throw new Error('Invalid metadata filter: "moduleId" must be a non-empty string.');
    }
  }

  if (f.moduleIds !== undefined) {
    if (!Array.isArray(f.moduleIds)) {
      throw new Error('Invalid metadata filter: "moduleIds" must be an array of strings.');
    }
    for (const id of f.moduleIds) {
      if (typeof id !== 'string') {
        throw new Error('Invalid metadata filter: Each element in "moduleIds" must be a string.');
      }
    }
  }

  if (f.resourceId !== undefined) {
    if (typeof f.resourceId !== 'string' || !f.resourceId.trim()) {
      throw new Error('Invalid metadata filter: "resourceId" must be a non-empty string.');
    }
  }

  if (f.studentId !== undefined && typeof f.studentId !== 'string') {
    throw new Error('Invalid metadata filter: "studentId" must be a string.');
  }

  return f as SemanticSearchFilters;
};

/**
 * Executes a semantic similarity search across the authenticated student's indexed documents.
 *
 * Workflow:
 * 1. Validates non-empty natural language query.
 * 2. Authenticates and verifies student identity (Firebase Auth).
 * 3. Validates metadata filters.
 * 4. Generates 768-dimensional query embedding via Ollama nomic-embed-text.
 * 5. Queries ChromaDB with cosine distance metric and student-scoped filters.
 * 6. Calculates normalized similarity scores (1 - distance).
 * 7. Filters by minimum similarity / maximum distance (if configured).
 * 8. Returns sorted, structured results with complete source citations.
 */
export const searchSimilarChunks = async (
  query: string,
  options?: SemanticSearchOptions
): Promise<SemanticSearchResponse> => {
  const startTime = performance.now();
  const collectionName = options?.collectionName || DEFAULT_CHROMA_COLLECTION;

  // 1. Validate query string
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      query: query || '',
      totalResults: 0,
      durationMs: Math.round(performance.now() - startTime),
      results: [],
      status: 'empty',
      error: 'Please provide a non-empty search query.',
      collectionName,
    };
  }

  const cleanQuery = query.trim();

  // 2. Resolve authenticated student ID (multi-tenant security boundary)
  let verifiedStudentId: string;
  try {
    verifiedStudentId = resolveAuthenticatedStudentId(options?.filters?.studentId);
  } catch (authErr) {
    const errMsg = authErr instanceof Error ? authErr.message : String(authErr);
    return {
      query: cleanQuery,
      totalResults: 0,
      durationMs: Math.round(performance.now() - startTime),
      results: [],
      status: 'failed',
      error: errMsg,
      collectionName,
    };
  }

  // 3. Validate metadata filters
  try {
    validateSearchFilters(options?.filters);
  } catch (filterErr) {
    const errMsg = filterErr instanceof Error ? filterErr.message : String(filterErr);
    return {
      query: cleanQuery,
      totalResults: 0,
      durationMs: Math.round(performance.now() - startTime),
      results: [],
      status: 'failed',
      error: errMsg,
      collectionName,
    };
  }

  // 4. Generate query embedding using nomic-embed-text via Ollama (with task prefix)
  let queryVector: number[];
  try {
    const prefixedQuery = formatNomicQueryText(cleanQuery);
    const embedResult = await generateEmbedding(prefixedQuery, {
      customBaseUrl: options?.customOllamaUrl,
      abortSignal: options?.abortSignal,
    });

    queryVector = validateQueryEmbeddingVector(embedResult.vector);
  } catch (embedErr) {
    const errMsg = embedErr instanceof Error ? embedErr.message : String(embedErr);
    return {
      query: cleanQuery,
      totalResults: 0,
      durationMs: Math.round(performance.now() - startTime),
      results: [],
      status: 'failed',
      error: errMsg,
      collectionName,
    };
  }

  // 5. Construct scoped ChromaDB query filter
  const chromaFilter: ChromaFilterCriteria = {
    studentId: verifiedStudentId,
    ...(options?.filters?.subjectId ? { subjectId: options.filters.subjectId.trim() } : {}),
    ...(options?.filters?.moduleId ? { moduleId: options.filters.moduleId.trim() } : {}),
    ...(options?.filters?.moduleIds && options.filters.moduleIds.length > 0
      ? { moduleIds: options.filters.moduleIds }
      : {}),
    ...(options?.filters?.resourceId ? { resourceId: options.filters.resourceId.trim() } : {}),
  };

  const topK = Math.max(1, options?.topK ?? 5);

  // 6. Execute vector search in ChromaDB
  try {
    const rawChunks = await querySimilarChunks(queryVector, {
      topK,
      filter: chromaFilter,
      collectionName,
      customBaseUrl: options?.customChromaUrl,
      abortSignal: options?.abortSignal,
    });

    if (rawChunks.length === 0) {
      return {
        query: cleanQuery,
        totalResults: 0,
        durationMs: Math.round(performance.now() - startTime),
        results: [],
        status: 'empty',
        collectionName,
      };
    }

    // 7. Process similarity scores and source metadata
    const items: SemanticSearchResultItem[] = [];

    for (const chunk of rawChunks) {
      const rawDistance = chunk.distance;
      // Cosine similarity in [0, 1] for positive semantic embeddings
      const similarity = Math.max(0, Math.min(1, parseFloat((1 - rawDistance).toFixed(6))));

      // Apply optional thresholds if configured
      if (options?.minSimilarity !== undefined && similarity < options.minSimilarity) {
        continue;
      }
      if (options?.maxDistance !== undefined && rawDistance > options.maxDistance) {
        continue;
      }

      const pageEndNumber =
        typeof chunk.metadata.pageEndNumber === 'number'
          ? chunk.metadata.pageEndNumber
          : undefined;
      const pageRange =
        typeof chunk.metadata.pageRange === 'string'
          ? chunk.metadata.pageRange
          : (pageEndNumber && pageEndNumber > (chunk.metadata.pageNumber ?? 1)
              ? `${chunk.metadata.pageNumber ?? 1}–${pageEndNumber}`
              : undefined);

      items.push({
        chunkId: chunk.id,
        text: chunk.text,
        resourceId: chunk.metadata.resourceId || '',
        resourceName: chunk.metadata.resourceName || '',
        subjectId: chunk.metadata.subjectId || '',
        moduleId: chunk.metadata.moduleId,
        pageNumber: chunk.metadata.pageNumber ?? 1,
        pageEndNumber,
        pageRange,
        chunkIndex: chunk.metadata.chunkIndex ?? 0,
        distance: rawDistance,
        similarity,
        metadata: chunk.metadata,
      });
    }

    // 8. Sort by highest similarity first (lowest distance)
    items.sort((a, b) => b.similarity - a.similarity);

    const durationMs = Math.round(performance.now() - startTime);

    return {
      query: cleanQuery,
      totalResults: items.length,
      durationMs,
      results: items,
      status: items.length > 0 ? 'success' : 'empty',
      collectionName,
    };
  } catch (chromaErr) {
    const errMsg = chromaErr instanceof Error ? chromaErr.message : String(chromaErr);
    return {
      query: cleanQuery,
      totalResults: 0,
      durationMs: Math.round(performance.now() - startTime),
      results: [],
      status: 'failed',
      error: errMsg,
      collectionName,
    };
  }
};

/**
 * Searches for relevant document chunks scoped strictly to a specific subject.
 */
export const searchBySubject = async (
  query: string,
  subjectId: string,
  options?: SemanticSearchOptions
): Promise<SemanticSearchResponse> => {
  if (!subjectId || typeof subjectId !== 'string' || !subjectId.trim()) {
    return {
      query: query || '',
      totalResults: 0,
      durationMs: 0,
      results: [],
      status: 'failed',
      error: 'Invalid parameter: subjectId must be a non-empty string.',
    };
  }

  return searchSimilarChunks(query, {
    ...options,
    filters: {
      ...options?.filters,
      subjectId: subjectId.trim(),
    },
  });
};

/**
 * Searches for relevant document chunks scoped strictly to a specific module within a subject.
 */
export const searchByModule = async (
  query: string,
  subjectId: string,
  moduleId: string,
  options?: SemanticSearchOptions
): Promise<SemanticSearchResponse> => {
  if (!subjectId || typeof subjectId !== 'string' || !subjectId.trim()) {
    return {
      query: query || '',
      totalResults: 0,
      durationMs: 0,
      results: [],
      status: 'failed',
      error: 'Invalid parameter: subjectId must be a non-empty string.',
    };
  }

  if (!moduleId || typeof moduleId !== 'string' || !moduleId.trim()) {
    return {
      query: query || '',
      totalResults: 0,
      durationMs: 0,
      results: [],
      status: 'failed',
      error: 'Invalid parameter: moduleId must be a non-empty string.',
    };
  }

  return searchSimilarChunks(query, {
    ...options,
    filters: {
      ...options?.filters,
      subjectId: subjectId.trim(),
      moduleId: moduleId.trim(),
    },
  });
};

/**
 * Searches for relevant document chunks scoped strictly to a specific resource (PDF).
 */
export const searchByResource = async (
  query: string,
  resourceId: string,
  options?: SemanticSearchOptions
): Promise<SemanticSearchResponse> => {
  if (!resourceId || typeof resourceId !== 'string' || !resourceId.trim()) {
    return {
      query: query || '',
      totalResults: 0,
      durationMs: 0,
      results: [],
      status: 'failed',
      error: 'Invalid parameter: resourceId must be a non-empty string.',
    };
  }

  return searchSimilarChunks(query, {
    ...options,
    filters: {
      ...options?.filters,
      resourceId: resourceId.trim(),
    },
  });
};

/**
 * Searches across all indexed PDF documents belonging to the authenticated student.
 */
export const searchAcrossStudentDocuments = async (
  query: string,
  options?: SemanticSearchOptions
): Promise<SemanticSearchResponse> => {
  return searchSimilarChunks(query, options);
};

/**
 * Searches for relevant document chunks scoped strictly to multiple modules within a subject.
 */
export const searchByModules = async (
  query: string,
  subjectId: string,
  moduleIds: string[],
  options?: SemanticSearchOptions
): Promise<SemanticSearchResponse> => {
  if (!subjectId || typeof subjectId !== 'string' || !subjectId.trim()) {
    return {
      query: query || '',
      totalResults: 0,
      durationMs: 0,
      results: [],
      status: 'failed',
      error: 'Invalid parameter: subjectId must be a non-empty string.',
    };
  }

  const cleanModuleIds = Array.isArray(moduleIds)
    ? moduleIds.filter((m): m is string => typeof m === 'string' && m.trim().length > 0).map((m) => m.trim())
    : [];

  return searchSimilarChunks(query, {
    ...options,
    filters: {
      ...options?.filters,
      subjectId: subjectId.trim(),
      moduleIds: cleanModuleIds,
    },
  });
};
