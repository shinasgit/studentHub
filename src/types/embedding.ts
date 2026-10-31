// Embedding Types for AI Student Hub RAG Pipeline
// Stage 1 & 3: Embedding Model & Document Embedding Pipeline

import type { TextChunk } from './chunking';

/**
 * Request payload for Ollama's POST /api/embed endpoint.
 */
export interface OllamaEmbedRequest {
  model: string;
  input: string | string[];
  truncate?: boolean;
  options?: Record<string, unknown>;
  keep_alive?: string | number;
}

/**
 * Raw response from Ollama's POST /api/embed endpoint.
 */
export interface OllamaEmbedResponse {
  model: string;
  embeddings: number[][];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
}

/**
 * Options for generating embeddings.
 */
export interface EmbeddingOptions {
  model?: string;
  customBaseUrl?: string;
  abortSignal?: AbortSignal;
  truncate?: boolean;
}

/**
 * Validated result for a single text embedding.
 */
export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
  model: string;
  durationMs?: number;
}

/**
 * Validated result for batch text embeddings.
 */
export interface BatchEmbeddingResult {
  vectors: number[][];
  dimensions: number;
  model: string;
  count: number;
  durationMs?: number;
}

/**
 * Standard embedding dimension for nomic-embed-text model.
 */
export const NOMIC_EMBED_DIMENSIONS = 768;

/**
 * An individual text chunk enriched with its numerical embedding vector and model metadata.
 */
export interface EmbeddedChunk extends TextChunk {
  embedding: number[];
  dimensions: number;
  model: string;
}

/**
 * Options for the document embedding pipeline.
 */
export interface DocumentEmbeddingOptions extends EmbeddingOptions {
  /**
   * Number of chunks sent per Ollama embed request (default: 16).
   */
  batchSize?: number;

  /**
   * If true, throws immediately on the first batch failure.
   * If false, continues processing remaining batches and records errors (default: true).
   */
  stopOnError?: boolean;

  /**
   * Expected embedding dimension (default: 768 for nomic-embed-text).
   */
  expectedDimensions?: number;

  /**
   * Optional progress callback for monitoring long embedding operations.
   */
  onProgress?: (progress: {
    completedChunks: number;
    totalChunks: number;
    completedBatches: number;
    totalBatches: number;
    percent: number;
  }) => void;
}

/**
 * Comprehensive result of a document embedding operation.
 */
export interface DocumentEmbeddingResult {
  embeddedChunks: EmbeddedChunk[];
  totalChunks: number;
  successfulChunks: number;
  failedChunks: number;
  dimensions: number;
  model: string;
  resourceId?: string;
  resourceName?: string;
  durationMs: number;
  batchCount: number;
  errors?: Array<{
    chunkId: string;
    chunkIndex: number;
    error: string;
  }>;
}
