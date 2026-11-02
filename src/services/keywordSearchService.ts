// Keyword Search & BM25 Scoring Service for AI Student Hub RAG Pipeline
// Stage 9: Advanced RAG - Hybrid Retrieval
// 100% Free, Local, High-Performance Lexical Search

import type { ChromaRecord, ChromaVectorMetadata } from '../types/chroma';
import type {
  SemanticSearchResultItem,
  SemanticSearchFilters,
} from '../types/semanticSearch';
import { getChunksByFilter } from './chromaService';
import { resolveAuthenticatedStudentId } from './pdfIndexingService';

// Common English stopwords to ignore in lexical search (preserves technical nouns)
const ENGLISH_STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing',
  'don\'t', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t',
  'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers',
  'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in',
  'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t',
  'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s',
  'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re',
  'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t',
  'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s',
  'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t',
  'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself',
  'yourselves',
]);

export interface KeywordSearchOptions {
  topK?: number;
  minScore?: number;
  filters?: SemanticSearchFilters;
  collectionName?: string;
  customChromaUrl?: string;
  abortSignal?: AbortSignal;
  /** BM25 term frequency saturation parameter. Default: 1.2 */
  k1?: number;
  /** BM25 document length normalization parameter. Default: 0.75 */
  b?: number;
}

export interface KeywordSearchResponse {
  query: string;
  totalResults: number;
  durationMs: number;
  results: SemanticSearchResultItem[];
  status: 'success' | 'empty' | 'failed';
  error?: string;
}

/**
 * Tokenizes text into normalized words, splitting punctuation while preserving acronyms and hyphenated phrases.
 */
export const tokenizeText = (text: string, removeStopwords = true): string[] => {
  if (!text || typeof text !== 'string') return [];

  // Match sequences of letters, digits, or underscore
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/[\s,.;:!?()[\]{}"'/\\]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  if (!removeStopwords) {
    return tokens;
  }

  const filtered = tokens.filter((t) => !ENGLISH_STOPWORDS.has(t));
  // If all tokens were stopwords (e.g. "what is it"), preserve all tokens rather than returning empty
  return filtered.length > 0 ? filtered : tokens;
};

/**
 * Computes BM25 relevance scores for a query across a collection of chunk items.
 */
export const rankChunksByBm25 = (
  query: string,
  chunks: SemanticSearchResultItem[],
  options?: { k1?: number; b?: number; topK?: number; minScore?: number }
): SemanticSearchResultItem[] => {
  if (!chunks || chunks.length === 0 || !query || !query.trim()) {
    return [];
  }

  const k1 = options?.k1 ?? 1.2;
  const b = options?.b ?? 0.75;
  const topK = options?.topK ?? chunks.length;
  const minScore = options?.minScore ?? 0.0;

  const queryTokens = tokenizeText(query, true);
  if (queryTokens.length === 0) {
    return [];
  }

  const N = chunks.length;
  const docTokensList = chunks.map((c) => tokenizeText(c.text, false));
  const docLengths = docTokensList.map((tokens) => tokens.length);
  const avgDocLength =
    docLengths.reduce((acc, len) => acc + len, 0) / Math.max(1, N);

  // Calculate Document Frequencies (DF) for each query token
  const dfMap = new Map<string, number>();
  for (const token of queryTokens) {
    let count = 0;
    for (const docTokens of docTokensList) {
      if (docTokens.includes(token)) {
        count++;
      }
    }
    dfMap.set(token, count);
  }

  // Calculate Inverse Document Frequency (IDF) for each query token
  const idfMap = new Map<string, number>();
  for (const token of queryTokens) {
    const df = dfMap.get(token) || 0;
    // Standard Lucene / Robertson BM25 IDF formulation with smoothing: ln(1 + (N - df + 0.5) / (df + 0.5))
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    idfMap.set(token, Math.max(0, idf));
  }

  const scored: Array<{ chunk: SemanticSearchResultItem; rawBm25: number; phraseBoost: number }> = [];
  const lowerQuery = query.toLowerCase().trim();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const docTokens = docTokensList[i];
    const docLen = docLengths[i];

    if (docLen === 0) continue;

    // Count term frequencies in this document
    const tfMap = new Map<string, number>();
    for (const t of docTokens) {
      tfMap.set(t, (tfMap.get(t) || 0) + 1);
    }

    let score = 0;
    for (const token of queryTokens) {
      const tf = tfMap.get(token) || 0;
      if (tf === 0) continue;

      const idf = idfMap.get(token) || 0;
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLength));
      score += idf * (numerator / denominator);
    }

    // Exact phrase match boost: If chunk contains the exact query string, award high confidence boost
    let phraseBoost = 0;
    const lowerDoc = chunk.text.toLowerCase();
    if (lowerQuery.length > 3 && lowerDoc.includes(lowerQuery)) {
      phraseBoost = 1.5;
    }

    if (score > 0 || phraseBoost > 0) {
      scored.push({ chunk, rawBm25: score, phraseBoost });
    }
  }

  if (scored.length === 0) return [];

  // Find max raw score for normalization into [0.0, 1.0]
  const maxScore = Math.max(...scored.map((s) => s.rawBm25 + s.phraseBoost), 1.0);

  const results: SemanticSearchResultItem[] = scored.map((item) => {
    const totalRaw = item.rawBm25 + item.phraseBoost;
    // Normalized BM25 score mapped safely into [0.0, 1.0]
    const similarity = Math.min(1.0, Math.max(0.0, parseFloat((totalRaw / maxScore).toFixed(4))));
    const distance = parseFloat((1.0 - similarity).toFixed(4));

    return {
      ...item.chunk,
      similarity,
      distance,
    };
  });

  // Filter by minScore and sort descending by score
  const filtered = results.filter((r) => r.similarity >= minScore);
  filtered.sort((a, b) => b.similarity - a.similarity);

  return filtered.slice(0, topK);
};

/**
 * Converts a ChromaRecord into a standard SemanticSearchResultItem.
 */
export const chromaRecordToSearchResultItem = (
  record: ChromaRecord,
  similarity = 1.0
): SemanticSearchResultItem => {
  const rawMeta = (record.metadata || {}) as Partial<ChromaVectorMetadata>;
  const pageNumber = typeof rawMeta.pageNumber === 'number' ? rawMeta.pageNumber : 1;
  const pageEndNumber = typeof rawMeta.pageEndNumber === 'number' ? rawMeta.pageEndNumber : undefined;
  const pageRange =
    typeof rawMeta.pageRange === 'string'
      ? rawMeta.pageRange
      : pageEndNumber && pageEndNumber > pageNumber
      ? `${pageNumber}–${pageEndNumber}`
      : undefined;

  const metadata: ChromaVectorMetadata = {
    chunkId: record.id,
    subjectId: (rawMeta.subjectId as string) || '',
    moduleId: (rawMeta.moduleId as string) || '',
    resourceId: (rawMeta.resourceId as string) || '',
    resourceName: (rawMeta.resourceName as string) || 'Document.pdf',
    pageNumber,
    pageEndNumber,
    pageRange,
    chunkIndex: typeof rawMeta.chunkIndex === 'number' ? rawMeta.chunkIndex : 0,
    totalChunks: typeof rawMeta.totalChunks === 'number' ? rawMeta.totalChunks : 1,
    tokenCount: typeof rawMeta.tokenCount === 'number' ? rawMeta.tokenCount : 0,
    characterCount:
      typeof rawMeta.characterCount === 'number'
        ? rawMeta.characterCount
        : (record.text || '').length,
    ...rawMeta,
  };

  return {
    chunkId: record.id,
    text: record.text,
    resourceId: metadata.resourceId || '',
    resourceName: metadata.resourceName || 'Document.pdf',
    subjectId: metadata.subjectId || '',
    moduleId: metadata.moduleId || undefined,
    pageNumber,
    pageEndNumber,
    pageRange,
    chunkIndex: metadata.chunkIndex,
    distance: parseFloat((1.0 - similarity).toFixed(4)),
    similarity,
    metadata,
  };
};

/**
 * Executes a standalone keyword/BM25 search by retrieving candidate chunks from ChromaDB
 * and ranking them using BM25.
 */
export const searchByKeyword = async (
  query: string,
  options?: KeywordSearchOptions
): Promise<KeywordSearchResponse> => {
  const startTime = performance.now();
  const cleanQuery = (query || '').trim();

  if (!cleanQuery) {
    return {
      query: '',
      totalResults: 0,
      durationMs: 0,
      results: [],
      status: 'empty',
    };
  }

  // Multi-tenant student isolation guard
  let verifiedStudentId: string;
  try {
    verifiedStudentId = resolveAuthenticatedStudentId(options?.filters?.studentId);
  } catch (authErr) {
    return {
      query: cleanQuery,
      totalResults: 0,
      durationMs: Math.round(performance.now() - startTime),
      results: [],
      status: 'failed',
      error: authErr instanceof Error ? authErr.message : String(authErr),
    };
  }

  // Construct scoped filter criteria
  const chromaFilter = {
    studentId: verifiedStudentId,
    ...(options?.filters?.subjectId ? { subjectId: options.filters.subjectId.trim() } : {}),
    ...(options?.filters?.moduleId ? { moduleId: options.filters.moduleId.trim() } : {}),
    ...(options?.filters?.moduleIds && options.filters.moduleIds.length > 0
      ? { moduleIds: options.filters.moduleIds }
      : {}),
    ...(options?.filters?.resourceId ? { resourceId: options.filters.resourceId.trim() } : {}),
  };

  try {
    // Retrieve up to 200 scoped chunks for BM25 ranking
    const records = await getChunksByFilter(chromaFilter, {
      collectionName: options?.collectionName,
      customBaseUrl: options?.customChromaUrl,
      limit: 200,
      abortSignal: options?.abortSignal,
    });

    if (records.length === 0) {
      return {
        query: cleanQuery,
        totalResults: 0,
        durationMs: Math.round(performance.now() - startTime),
        results: [],
        status: 'empty',
      };
    }

    const candidateItems = records.map((r) => chromaRecordToSearchResultItem(r));
    const ranked = rankChunksByBm25(cleanQuery, candidateItems, {
      topK: options?.topK ?? 10,
      minScore: options?.minScore ?? 0.05,
      k1: options?.k1,
      b: options?.b,
    });

    return {
      query: cleanQuery,
      totalResults: ranked.length,
      durationMs: Math.round(performance.now() - startTime),
      results: ranked,
      status: ranked.length > 0 ? 'success' : 'empty',
    };
  } catch (err) {
    return {
      query: cleanQuery,
      totalResults: 0,
      durationMs: Math.round(performance.now() - startTime),
      results: [],
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
};
