// Retrieval Evaluation Service for AI Student Hub RAG Architecture
// Stage 9: Advanced RAG - Ground Truth Evaluation & Benchmarking
// Measures Precision@K, Recall@K, MRR, NDCG@K, Latency, and Duplicate Counts

import type { SemanticSearchResultItem } from '../types/semanticSearch';
import { rankChunksByBm25 } from './keywordSearchService';
import { fuseResultsRrf } from './hybridSearchService';
import { rerankChunks } from './rerankingService';

export interface EvaluationQueryCase {
  queryId: string;
  query: string;
  /** Chunk IDs known to be relevant ground truth answers for this query */
  expectedChunkIds: string[];
  category?: 'exact_keyword' | 'paraphrased' | 'technical_concept' | 'cross_module';
}

export interface SingleEvaluationMetrics {
  queryId: string;
  query: string;
  precisionAtK: number;
  recallAtK: number;
  reciprocalRank: number;
  ndcgAtK: number;
  retrievedCount: number;
  duplicateCount: number;
  latencyMs: number;
  topRetrievedIds: string[];
}

export interface PipelineEvaluationReport {
  pipelineName: string;
  totalQueries: number;
  meanPrecisionAtK: number;
  meanRecallAtK: number;
  meanReciprocalRank: number; // MRR
  meanNdcgAtK: number;
  meanLatencyMs: number;
  totalDuplicates: number;
  detailedResults: SingleEvaluationMetrics[];
}

export interface BenchmarkComparisonReport {
  evaluatedAt: string;
  datasetSize: number;
  k: number;
  semanticOnly: PipelineEvaluationReport;
  keywordOnly: PipelineEvaluationReport;
  hybridRrf: PipelineEvaluationReport;
  hybridWithReranking: PipelineEvaluationReport;
  winner: string;
  improvementSummary: string;
}

/**
 * Calculates Precision@K: Proportion of top-K retrieved items that are relevant.
 */
export const calculatePrecisionAtK = (
  retrievedIds: string[],
  expectedIds: string[],
  k: number
): number => {
  if (k <= 0 || retrievedIds.length === 0 || expectedIds.length === 0) return 0;
  const topK = retrievedIds.slice(0, k);
  const expectedSet = new Set(expectedIds);
  const hits = topK.filter((id) => expectedSet.has(id)).length;
  return parseFloat((hits / k).toFixed(4));
};

/**
 * Calculates Recall@K: Proportion of relevant items that appear in the top-K retrieved items.
 */
export const calculateRecallAtK = (
  retrievedIds: string[],
  expectedIds: string[],
  k: number
): number => {
  if (k <= 0 || expectedIds.length === 0) return 0;
  const topK = retrievedIds.slice(0, k);
  const expectedSet = new Set(expectedIds);
  const hits = topK.filter((id) => expectedSet.has(id)).length;
  return parseFloat((hits / expectedIds.length).toFixed(4));
};

/**
 * Calculates Reciprocal Rank (RR): 1 / (rank of first relevant document), or 0 if none found.
 */
export const calculateReciprocalRank = (
  retrievedIds: string[],
  expectedIds: string[]
): number => {
  const expectedSet = new Set(expectedIds);
  for (let i = 0; i < retrievedIds.length; i++) {
    if (expectedSet.has(retrievedIds[i])) {
      return parseFloat((1 / (i + 1)).toFixed(4));
    }
  }
  return 0.0;
};

/**
 * Calculates Normalized Discounted Cumulative Gain (NDCG@K) with binary relevance.
 */
export const calculateNDCGAtK = (
  retrievedIds: string[],
  expectedIds: string[],
  k: number
): number => {
  if (k <= 0 || expectedIds.length === 0 || retrievedIds.length === 0) return 0;

  const expectedSet = new Set(expectedIds);
  const topK = retrievedIds.slice(0, k);

  // Compute DCG@K
  let dcg = 0.0;
  for (let i = 0; i < topK.length; i++) {
    const isRel = expectedSet.has(topK[i]) ? 1 : 0;
    if (isRel > 0) {
      dcg += isRel / Math.log2(i + 2); // i is 0-indexed, so rank = i + 1, log2(rank + 1) = log2(i + 2)
    }
  }

  // Compute Ideal DCG@K (IDCG@K)
  const idealHits = Math.min(expectedIds.length, k);
  let idcg = 0.0;
  for (let i = 0; i < idealHits; i++) {
    idcg += 1 / Math.log2(i + 2);
  }

  if (idcg === 0) return 0.0;
  return parseFloat(Math.min(1.0, dcg / idcg).toFixed(4));
};

/**
 * Detects duplicate chunk IDs in retrieved results.
 */
export const countDuplicateChunks = (retrievedIds: string[]): number => {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const id of retrievedIds) {
    if (seen.has(id)) {
      duplicates++;
    } else {
      seen.add(id);
    }
  }
  return duplicates;
};

/**
 * Runs a standardized comparative benchmark across candidate retrieval configurations
 * using a simulated or indexed document corpus.
 */
export const runRetrievalBenchmark = async (
  testCases: EvaluationQueryCase[],
  corpusChunks: SemanticSearchResultItem[],
  simulatedSemanticRetriever: (query: string, k: number) => Promise<SemanticSearchResultItem[]>,
  k = 5
): Promise<BenchmarkComparisonReport> => {
  const evaluatePipeline = async (
    name: string,
    retrieverFn: (query: string) => Promise<{ items: SemanticSearchResultItem[]; latencyMs: number }>
  ): Promise<PipelineEvaluationReport> => {
    const details: SingleEvaluationMetrics[] = [];

    for (const testCase of testCases) {
      const { items, latencyMs } = await retrieverFn(testCase.query);
      const retrievedIds = items.map((it) => it.chunkId);

      const prec = calculatePrecisionAtK(retrievedIds, testCase.expectedChunkIds, k);
      const rec = calculateRecallAtK(retrievedIds, testCase.expectedChunkIds, k);
      const rr = calculateReciprocalRank(retrievedIds, testCase.expectedChunkIds);
      const ndcg = calculateNDCGAtK(retrievedIds, testCase.expectedChunkIds, k);
      const dups = countDuplicateChunks(retrievedIds);

      details.push({
        queryId: testCase.queryId,
        query: testCase.query,
        precisionAtK: prec,
        recallAtK: rec,
        reciprocalRank: rr,
        ndcgAtK: ndcg,
        retrievedCount: items.length,
        duplicateCount: dups,
        latencyMs,
        topRetrievedIds: retrievedIds.slice(0, k),
      });
    }

    const n = Math.max(1, details.length);
    const meanPrec = parseFloat((details.reduce((acc, d) => acc + d.precisionAtK, 0) / n).toFixed(4));
    const meanRec = parseFloat((details.reduce((acc, d) => acc + d.recallAtK, 0) / n).toFixed(4));
    const meanMrr = parseFloat((details.reduce((acc, d) => acc + d.reciprocalRank, 0) / n).toFixed(4));
    const meanNdcg = parseFloat((details.reduce((acc, d) => acc + d.ndcgAtK, 0) / n).toFixed(4));
    const meanLat = Math.round(details.reduce((acc, d) => acc + d.latencyMs, 0) / n);
    const totalDups = details.reduce((acc, d) => acc + d.duplicateCount, 0);

    return {
      pipelineName: name,
      totalQueries: testCases.length,
      meanPrecisionAtK: meanPrec,
      meanRecallAtK: meanRec,
      meanReciprocalRank: meanMrr,
      meanNdcgAtK: meanNdcg,
      meanLatencyMs: meanLat,
      totalDuplicates: totalDups,
      detailedResults: details,
    };
  };

  // 1. Semantic-Only Pipeline
  const semanticReport = await evaluatePipeline('Semantic-Only (Nomic Vector)', async (q) => {
    const start = performance.now();
    const items = await simulatedSemanticRetriever(q, k);
    return { items, latencyMs: Math.round(performance.now() - start) };
  });

  // 2. Keyword-Only Pipeline (BM25)
  const keywordReport = await evaluatePipeline('Keyword-Only (Okapi BM25)', async (q) => {
    const start = performance.now();
    const items = rankChunksByBm25(q, corpusChunks, { topK: k });
    return { items, latencyMs: Math.round(performance.now() - start) };
  });

  // 3. Hybrid RRF Pipeline
  const hybridReport = await evaluatePipeline('Hybrid (Semantic + BM25 RRF)', async (q) => {
    const start = performance.now();
    const sem = await simulatedSemanticRetriever(q, k * 2);
    const kw = rankChunksByBm25(q, corpusChunks, { topK: k * 2 });
    const fused = fuseResultsRrf(sem, kw, { rrfK: 60, topK: k });
    return { items: fused, latencyMs: Math.round(performance.now() - start) };
  });

  // 4. Hybrid + Reranking Pipeline
  const hybridRerankReport = await evaluatePipeline('Hybrid RRF + Lexical-Semantic Reranking', async (q) => {
    const start = performance.now();
    const sem = await simulatedSemanticRetriever(q, k * 2);
    const kw = rankChunksByBm25(q, corpusChunks, { topK: k * 2 });
    const fused = fuseResultsRrf(sem, kw, { rrfK: 60, topK: k * 2 });
    const reranked = await rerankChunks(q, fused, { method: 'cross_scoring', topK: k });
    return { items: reranked.rerankedChunks, latencyMs: Math.round(performance.now() - start) };
  });

  const mrrScores = [
    { name: 'Semantic-Only', mrr: semanticReport.meanReciprocalRank },
    { name: 'Keyword-Only', mrr: keywordReport.meanReciprocalRank },
    { name: 'Hybrid RRF', mrr: hybridReport.meanReciprocalRank },
    { name: 'Hybrid + Reranking', mrr: hybridRerankReport.meanReciprocalRank },
  ];
  mrrScores.sort((a, b) => b.mrr - a.mrr);
  const winner = mrrScores[0].name;

  const improvement = `Hybrid + Reranking achieved MRR of ${hybridRerankReport.meanReciprocalRank} vs ${semanticReport.meanReciprocalRank} for Semantic-Only (+${(
    (hybridRerankReport.meanReciprocalRank - semanticReport.meanReciprocalRank) *
    100
  ).toFixed(1)}% MRR gain).`;

  return {
    evaluatedAt: new Date().toISOString(),
    datasetSize: testCases.length,
    k,
    semanticOnly: semanticReport,
    keywordOnly: keywordReport,
    hybridRrf: hybridReport,
    hybridWithReranking: hybridRerankReport,
    winner,
    improvementSummary: improvement,
  };
};
