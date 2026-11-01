// Query Expansion Service for AI Student Hub RAG Architecture
// Stage 9: Advanced RAG - Query Expansion with Local LLM
// 100% Free, Local Ollama Llama 3.2 3B, Strict Fallback Protection

import { generateCompletion, getSelectedModel } from './ollamaService';
import { searchHybridChunks, fuseResultsRrf, type HybridSearchOptions } from './hybridSearchService';
import type { SemanticSearchResultItem } from '../types/semanticSearch';

export interface QueryExpansionOptions {
  /**
   * Whether query expansion is enabled. Default: true.
   */
  enabled?: boolean;
  /**
   * Maximum alternative queries to generate (excluding original). Default: 2, Max: 3.
   */
  maxAlternatives?: number;
  /**
   * Model to use for expansion. Default: active Ollama model (llama3.2:3b).
   */
  model?: string;
  /**
   * Custom Ollama URL.
   */
  customOllamaUrl?: string;
  /**
   * Timeout in ms for query expansion LLM call. Default: 5000ms.
   */
  timeoutMs?: number;
  /**
   * Optional AbortSignal.
   */
  abortSignal?: AbortSignal;
}

export interface QueryExpansionResult {
  originalQuery: string;
  expandedQueries: string[];
  allQueries: string[];
  durationMs: number;
  status: 'expanded' | 'skipped' | 'fallback';
  reason?: string;
}

/**
 * Heuristic check to determine if a student question benefits from query expansion.
 * Avoids unnecessary LLM calls when:
 * - Query is empty or too short (< 3 characters)
 * - Query is conversational greeting ("hi", "thanks")
 * - Query is already very long and specific (> 25 words)
 */
export const shouldExpandQuery = (query: string): boolean => {
  if (!query || typeof query !== 'string') return false;
  const clean = query.trim();
  if (clean.length < 3) return false;

  const lower = clean.toLowerCase();
  const greetings = ['hello', 'hi', 'hey', 'thanks', 'thank you', 'bye', 'good morning', 'good evening'];
  if (greetings.includes(lower)) return false;

  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  // Short, ambiguous, or moderate technical questions (1 - 20 words) benefit most
  return words.length >= 1 && words.length <= 25;
};

/**
 * Parses raw LLM expansion output into clean, distinct alternative search queries.
 */
export const parseExpandedQueries = (
  rawText: string,
  originalQuery: string,
  maxAlternatives = 2
): string[] => {
  if (!rawText || typeof rawText !== 'string') return [];

  const cleanOriginal = originalQuery.trim().toLowerCase();
  const lines = rawText.split(/\r?\n/);
  const candidates: string[] = [];

  for (const line of lines) {
    // Remove numbered lists (1., 2.), bullets (-, *), quotes
    const cleaned = line
      .replace(/^[\s\d.\-*•]+/, '')
      .replace(/["'`]/g, '')
      .trim();

    if (
      cleaned.length >= 3 &&
      cleaned.length <= 150 &&
      cleaned.toLowerCase() !== cleanOriginal &&
      !candidates.some((c) => c.toLowerCase() === cleaned.toLowerCase())
    ) {
      candidates.push(cleaned);
      if (candidates.length >= maxAlternatives) {
        break;
      }
    }
  }

  return candidates;
};

/**
 * Generates 1-2 search query reformulations using the local LLM.
 *
 * Prompt Rules:
 * - Generate synonyms, academic terminology, and alternative phrasing.
 * - Do NOT answer the question.
 * - Output each query on a new line.
 * - Strict fallback to [originalQuery] on error or timeout.
 */
export const expandQuery = async (
  query: string,
  options?: QueryExpansionOptions
): Promise<QueryExpansionResult> => {
  const startTime = performance.now();
  const clean = (query || '').trim();

  if (!clean || options?.enabled === false || !shouldExpandQuery(clean)) {
    return {
      originalQuery: clean,
      expandedQueries: [],
      allQueries: [clean],
      durationMs: 0,
      status: 'skipped',
      reason: options?.enabled === false ? 'Expansion disabled' : 'Heuristic skipped',
    };
  }

  const maxAlts = Math.min(3, Math.max(1, options?.maxAlternatives ?? 2));
  const model = options?.model || getSelectedModel() || 'llama3.2:3b';

  const systemPrompt = `You are a search query optimizer for an academic computer science and university study search engine.
Your task is to generate alternative search terms and synonym variations for the student's question to retrieve relevant textbook pages.

RULES:
1. Output EXACTLY ${maxAlts} alternative search queries, one per line.
2. Focus on academic terminology, technical keywords, and formal phrasing likely found in course textbooks.
3. Do NOT attempt to answer the question.
4. Do NOT output explanations, introductory text, or numbers.
5. Preserve the student's core inquiry without changing their intent.`;

  const userPrompt = `Student question: "${clean}"

Alternative textbook search queries:`;

  try {
    // Configure timeout controller (allow up to 15 seconds for local LLM inference)
    const timeoutMs = options?.timeoutMs ?? 15000;
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

    let signal = timeoutController.signal;
    if (options?.abortSignal) {
      // Chain user's abort signal
      options.abortSignal.addEventListener('abort', () => timeoutController.abort());
    }

    const completion = await generateCompletion({
      model,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.2, // Low temperature for deterministic keyword formulation
      customBaseUrl: options?.customOllamaUrl,
      abortSignal: signal,
    });

    clearTimeout(timer);

    const alternatives = parseExpandedQueries(completion.text, clean, maxAlts);
    const durationMs = Math.round(performance.now() - startTime);

    if (alternatives.length > 0) {
      return {
        originalQuery: clean,
        expandedQueries: alternatives,
        allQueries: [clean, ...alternatives],
        durationMs,
        status: 'expanded',
      };
    }

    return {
      originalQuery: clean,
      expandedQueries: [],
      allQueries: [clean],
      durationMs,
      status: 'fallback',
      reason: 'No valid alternatives parsed from LLM output',
    };
  } catch (err) {
    // Graceful fallback to original query
    const durationMs = Math.round(performance.now() - startTime);
    return {
      originalQuery: clean,
      expandedQueries: [],
      allQueries: [clean],
      durationMs,
      status: 'fallback',
      reason: err instanceof Error ? err.message : String(err),
    };
  }
};

/**
 * Executes a Multi-Query Hybrid Search:
 * Runs hybrid search across the original query plus all expanded queries,
 * then merges and deduplicates all results with Reciprocal Rank Fusion (RRF).
 */
export const searchWithQueryExpansion = async (
  query: string,
  options?: HybridSearchOptions & { expansionOptions?: QueryExpansionOptions }
): Promise<{
  results: SemanticSearchResultItem[];
  expansionResult: QueryExpansionResult;
  totalDurationMs: number;
}> => {
  const startTime = performance.now();
  const clean = (query || '').trim();

  // 1. Expand query if enabled
  const expansionResult = await expandQuery(clean, options?.expansionOptions);

  // If only 1 query (expansion skipped or fell back), run single hybrid search directly
  if (expansionResult.allQueries.length <= 1) {
    const hybridRes = await searchHybridChunks(clean, options);
    return {
      results: hybridRes.results,
      expansionResult,
      totalDurationMs: Math.round(performance.now() - startTime),
    };
  }

  // 2. Run hybrid searches across all queries concurrently
  const searchPromises = expansionResult.allQueries.map((q) =>
    searchHybridChunks(q, {
      ...options,
      topK: Math.max(5, (options?.topK ?? 5) * 2), // Collect enough candidates
    })
  );

  const outcomes = await Promise.allSettled(searchPromises);
  const candidateLists: SemanticSearchResultItem[][] = [];

  for (const outcome of outcomes) {
    if (outcome.status === 'fulfilled' && outcome.value.results.length > 0) {
      candidateLists.push(outcome.value.results);
    }
  }

  if (candidateLists.length === 0) {
    return {
      results: [],
      expansionResult,
      totalDurationMs: Math.round(performance.now() - startTime),
    };
  }

  // 3. Multi-list RRF fusion
  // Fuse the original query's results with the alternative queries
  let combined = candidateLists[0];
  for (let i = 1; i < candidateLists.length; i++) {
    combined = fuseResultsRrf(combined, candidateLists[i], {
      rrfK: options?.rrfK ?? 60,
      semanticWeight: 1.0,
      keywordWeight: 0.8, // Slightly lower weight for expansion queries
      topK: options?.topK ?? 5,
      minScore: options?.minScore,
    });
  }

  return {
    results: combined.slice(0, options?.topK ?? 5),
    expansionResult,
    totalDurationMs: Math.round(performance.now() - startTime),
  };
};
