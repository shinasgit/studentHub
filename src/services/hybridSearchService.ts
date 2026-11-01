// Hybrid Search Service for AI Student Hub RAG Pipeline
// Stage 9: Advanced RAG - Hybrid Retrieval (Semantic + Lexical BM25)
// Reciprocal Rank Fusion (RRF), Multi-Tenant Isolation, 100% Free & Local

import type {
  SemanticSearchResultItem,
  SemanticSearchOptions,
} from '../types/semanticSearch';
import { searchSimilarChunks } from './semanticSearchService';
import { searchByKeyword } from './keywordSearchService';

export type RetrievalMode = 'hybrid' | 'semantic' | 'keyword';

export interface HybridSearchOptions extends SemanticSearchOptions {
  /**
   * Retrieval mode. Default: 'hybrid'.
   * - 'hybrid': Combines semantic vector similarity and lexical BM25 using RRF.
   * - 'semantic': Vector similarity only via ChromaDB and Nomic Embed Text.
   * - 'keyword': Lexical BM25 only.
   */
  mode?: RetrievalMode;
  /**
   * Reciprocal Rank Fusion constant 'k'. Default: 60.
   */
  rrfK?: number;
  /**
   * Weight multiplier for semantic vector search in RRF [0.0 - 2.0]. Default: 1.0.
   */
  semanticWeight?: number;
  /**
   * Weight multiplier for keyword BM25 search in RRF [0.0 - 2.0]. Default: 1.0.
   */
  keywordWeight?: number;
  /**
   * Minimum normalized hybrid score [0.0, 1.0]. Chunks below this score are excluded. Default: 0.0.
   */
  minScore?: number;
}

export interface HybridSearchTelemetry {
  semanticDurationMs: number;
  keywordDurationMs: number;
  fusionDurationMs: number;
  totalDurationMs: number;
  semanticCount: number;
  keywordCount: number;
  fusedCount: number;
  mode: RetrievalMode;
}

export interface HybridSearchResponse {
  query: string;
  totalResults: number;
  durationMs: number;
  results: SemanticSearchResultItem[];
  telemetry: HybridSearchTelemetry;
  status: 'success' | 'empty' | 'failed';
  error?: string;
  collectionName?: string;
}

/**
 * Pure function: Combines semantic and keyword search result lists using Reciprocal Rank Fusion (RRF).
 *
 * Formula:
 *   RRF_score(d) = (w_sem / (k + rank_sem(d))) + (w_kw / (k + rank_kw(d)))
 *
 * Guaranteed:
 * - Deterministic, duplicate-free chunk ordering.
 * - Preserves all chunk metadata (resourceId, resourceName, pageNumber, pageRange, studentId).
 * - Normalizes combined score into [0.0, 1.0].
 */
export const fuseResultsRrf = (
  semanticResults: SemanticSearchResultItem[],
  keywordResults: SemanticSearchResultItem[],
  options?: {
    rrfK?: number;
    semanticWeight?: number;
    keywordWeight?: number;
    topK?: number;
    minScore?: number;
  }
): SemanticSearchResultItem[] => {
  const k = Math.max(1, options?.rrfK ?? 60);
  const wSem = Math.max(0, options?.semanticWeight ?? 1.0);
  const wKw = Math.max(0, options?.keywordWeight ?? 1.0);
  const topK = Math.max(1, options?.topK ?? 10);
  const minScore = options?.minScore ?? 0.0;

  const fusedMap = new Map<
    string,
    {
      chunk: SemanticSearchResultItem;
      rrfScore: number;
      semanticRank?: number;
      keywordRank?: number;
      bestSemanticSim: number;
    }
  >();

  // Process semantic search results (1-indexed ranks)
  for (let i = 0; i < semanticResults.length; i++) {
    const chunk = semanticResults[i];
    const rank = i + 1;
    const rrfScore = wSem / (k + rank);

    fusedMap.set(chunk.chunkId, {
      chunk,
      rrfScore,
      semanticRank: rank,
      bestSemanticSim: chunk.similarity,
    });
  }

  // Process keyword search results (1-indexed ranks)
  for (let i = 0; i < keywordResults.length; i++) {
    const chunk = keywordResults[i];
    const rank = i + 1;
    const keywordRrf = wKw / (k + rank);

    const existing = fusedMap.get(chunk.chunkId);
    if (existing) {
      existing.rrfScore += keywordRrf;
      existing.keywordRank = rank;
      // If keyword item has better fields, preserve metadata
      if (!existing.chunk.pageRange && chunk.pageRange) {
        existing.chunk.pageRange = chunk.pageRange;
      }
    } else {
      fusedMap.set(chunk.chunkId, {
        chunk,
        rrfScore: keywordRrf,
        keywordRank: rank,
        bestSemanticSim: 0,
      });
    }
  }

  if (fusedMap.size === 0) {
    return [];
  }

  // Theoretical maximum RRF score occurs when a document ranks #1 in both channels
  const maxPossibleRrf = (wSem / (k + 1)) + (wKw / (k + 1));

  const items = Array.from(fusedMap.values()).map((entry) => {
    // Normalize into [0.0, 1.0] relative to max possible score
    const normalizedScore = Math.min(
      1.0,
      Math.max(0.0, parseFloat((entry.rrfScore / maxPossibleRrf).toFixed(4)))
    );

    return {
      ...entry.chunk,
      similarity: normalizedScore,
      distance: parseFloat((1.0 - normalizedScore).toFixed(4)),
      metadata: {
        ...entry.chunk.metadata,
        semanticRank: entry.semanticRank,
        keywordRank: entry.keywordRank,
        rawRrfScore: parseFloat(entry.rrfScore.toFixed(6)),
      },
    };
  });

  // Sort descending by normalized hybrid score
  items.sort((a, b) => b.similarity - a.similarity);

  const filtered = items.filter((item) => item.similarity >= minScore);
  return filtered.slice(0, topK);
};

/**
 * Executes a full Hybrid Retrieval operation across student documents.
 * Concurrently queries ChromaDB semantic vector search and lexical BM25,
 * then fuses results with Reciprocal Rank Fusion (RRF).
 */
export const searchHybridChunks = async (
  query: string,
  options?: HybridSearchOptions
): Promise<HybridSearchResponse> => {
  const overallStartTime = performance.now();
  const cleanQuery = (query || '').trim();
  const mode = options?.mode || 'hybrid';
  const topK = Math.max(1, options?.topK ?? 5);

  if (!cleanQuery) {
    return {
      query: '',
      totalResults: 0,
      durationMs: 0,
      results: [],
      telemetry: {
        semanticDurationMs: 0,
        keywordDurationMs: 0,
        fusionDurationMs: 0,
        totalDurationMs: 0,
        semanticCount: 0,
        keywordCount: 0,
        fusedCount: 0,
        mode,
      },
      status: 'empty',
    };
  }

  let semanticDurationMs = 0;
  let keywordDurationMs = 0;
  let semanticItems: SemanticSearchResultItem[] = [];
  let keywordItems: SemanticSearchResultItem[] = [];

  // Branch by Mode
  if (mode === 'semantic') {
    const semStart = performance.now();
    const semRes = await searchSimilarChunks(cleanQuery, options);
    semanticDurationMs = Math.round(performance.now() - semStart);

    return {
      query: cleanQuery,
      totalResults: semRes.results.length,
      durationMs: Math.round(performance.now() - overallStartTime),
      results: semRes.results.slice(0, topK),
      telemetry: {
        semanticDurationMs,
        keywordDurationMs: 0,
        fusionDurationMs: 0,
        totalDurationMs: Math.round(performance.now() - overallStartTime),
        semanticCount: semRes.results.length,
        keywordCount: 0,
        fusedCount: semRes.results.length,
        mode: 'semantic',
      },
      status: semRes.status,
      error: semRes.error,
      collectionName: semRes.collectionName,
    };
  }

  if (mode === 'keyword') {
    const kwStart = performance.now();
    const kwRes = await searchByKeyword(cleanQuery, {
      topK: topK * 2,
      filters: options?.filters,
      collectionName: options?.collectionName,
      customChromaUrl: options?.customChromaUrl,
      abortSignal: options?.abortSignal,
    });
    keywordDurationMs = Math.round(performance.now() - kwStart);

    return {
      query: cleanQuery,
      totalResults: kwRes.results.length,
      durationMs: Math.round(performance.now() - overallStartTime),
      results: kwRes.results.slice(0, topK),
      telemetry: {
        semanticDurationMs: 0,
        keywordDurationMs,
        fusionDurationMs: 0,
        totalDurationMs: Math.round(performance.now() - overallStartTime),
        semanticCount: 0,
        keywordCount: kwRes.results.length,
        fusedCount: kwRes.results.length,
        mode: 'keyword',
      },
      status: kwRes.status,
      error: kwRes.error,
    };
  }

  // Hybrid Mode: Concurrent Semantic & Keyword Retrieval
  const [semanticOutcome, keywordOutcome] = await Promise.allSettled([
    (async () => {
      const start = performance.now();
      const res = await searchSimilarChunks(cleanQuery, {
        ...options,
        topK: topK * 2, // Fetch slightly more candidates for fusion
      });
      semanticDurationMs = Math.round(performance.now() - start);
      return res;
    })(),
    (async () => {
      const start = performance.now();
      const res = await searchByKeyword(cleanQuery, {
        topK: topK * 2,
        filters: options?.filters,
        collectionName: options?.collectionName,
        customChromaUrl: options?.customChromaUrl,
        abortSignal: options?.abortSignal,
      });
      keywordDurationMs = Math.round(performance.now() - start);
      return res;
    })(),
  ]);

  if (semanticOutcome.status === 'fulfilled' && semanticOutcome.value.status === 'success') {
    semanticItems = semanticOutcome.value.results;
  }
  if (keywordOutcome.status === 'fulfilled' && keywordOutcome.value.status === 'success') {
    keywordItems = keywordOutcome.value.results;
  }

  // Graceful fallback: If both failed
  if (
    semanticOutcome.status === 'rejected' &&
    keywordOutcome.status === 'rejected'
  ) {
    const err = semanticOutcome.reason?.message || 'Both retrieval channels failed.';
    return {
      query: cleanQuery,
      totalResults: 0,
      durationMs: Math.round(performance.now() - overallStartTime),
      results: [],
      telemetry: {
        semanticDurationMs,
        keywordDurationMs,
        fusionDurationMs: 0,
        totalDurationMs: Math.round(performance.now() - overallStartTime),
        semanticCount: 0,
        keywordCount: 0,
        fusedCount: 0,
        mode: 'hybrid',
      },
      status: 'failed',
      error: err,
    };
  }

  // Fusion
  const fusionStart = performance.now();
  const fusedResults = fuseResultsRrf(semanticItems, keywordItems, {
    rrfK: options?.rrfK,
    semanticWeight: options?.semanticWeight,
    keywordWeight: options?.keywordWeight,
    topK,
    minScore: options?.minScore,
  });
  const fusionDurationMs = Math.round(performance.now() - fusionStart);
  const totalDurationMs = Math.round(performance.now() - overallStartTime);

  return {
    query: cleanQuery,
    totalResults: fusedResults.length,
    durationMs: totalDurationMs,
    results: fusedResults,
    telemetry: {
      semanticDurationMs,
      keywordDurationMs,
      fusionDurationMs,
      totalDurationMs,
      semanticCount: semanticItems.length,
      keywordCount: keywordItems.length,
      fusedCount: fusedResults.length,
      mode: 'hybrid',
    },
    status: fusedResults.length > 0 ? 'success' : 'empty',
  };
};
