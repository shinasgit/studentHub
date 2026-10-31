// Document Embedding Pipeline for AI Student Hub RAG Architecture
// Stage 3: Document Embedding Generation (Chunks -> Vectors)
// 100% Free, Zero External Heavy Dependencies, Local Privacy

import type {
  EmbeddedChunk,
  DocumentEmbeddingOptions,
  DocumentEmbeddingResult,
} from '../types/embedding';
import { NOMIC_EMBED_DIMENSIONS } from '../types/embedding';
import type { TextChunk, ChunkingResult } from '../types/chunking';
import {
  generateBatchEmbeddings,
  validateEmbeddingVector,
  DEFAULT_EMBEDDING_MODEL,
} from './embeddingService';

/**
 * Default number of text chunks dispatched per HTTP POST request to Ollama's /api/embed.
 * 16 chunks * ~500 tokens = ~8,000 tokens payload, keeping within nomic-embed-text's
 * 8,192 context limit while optimizing network throughput and local GPU/CPU memory usage.
 */
export const DEFAULT_DOCUMENT_EMBEDDING_BATCH_SIZE = 16;

/**
 * Extracts an array of TextChunk objects and top-level metadata from either
 * a raw TextChunk array or a ChunkingResult.
 */
export const extractChunksFromInput = (
  input: TextChunk[] | ChunkingResult
): { chunks: TextChunk[]; resourceId?: string; resourceName?: string } => {
  if (!input) {
    return { chunks: [] };
  }

  // Handle ChunkingResult
  if ('chunks' in input && Array.isArray((input as ChunkingResult).chunks)) {
    const chunkingRes = input as ChunkingResult;
    return {
      chunks: chunkingRes.chunks,
      resourceId: chunkingRes.resourceId,
      resourceName: chunkingRes.resourceName,
    };
  }

  // Handle TextChunk[]
  if (Array.isArray(input)) {
    return {
      chunks: input,
      resourceId: input[0]?.resourceId,
      resourceName: input[0]?.resourceName,
    };
  }

  throw new Error(
    'Invalid input to document embedding service: Expected TextChunk[] or ChunkingResult.'
  );
};

/**
 * Validates an array of EmbeddedChunk objects.
 * Verifies:
 * 1. Array integrity and non-null elements.
 * 2. Sequential indexing (chunkIndex: 0, 1, ..., N-1).
 * 3. Non-empty text and preserved metadata.
 * 4. Embedding vector presence, finite floating-point values, and dimension correctness (768).
 */
export const validateEmbeddedChunks = (
  embeddedChunks: EmbeddedChunk[],
  options?: { expectedDimensions?: number }
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const expectedDims = options?.expectedDimensions ?? NOMIC_EMBED_DIMENSIONS;

  if (!Array.isArray(embeddedChunks)) {
    return { isValid: false, errors: ['Input must be an array of EmbeddedChunk objects.'] };
  }

  if (embeddedChunks.length === 0) {
    return { isValid: true, errors: [] };
  }

  for (let i = 0; i < embeddedChunks.length; i++) {
    const chunk = embeddedChunks[i];

    if (!chunk || typeof chunk !== 'object') {
      errors.push(`Element at index ${i} is not a valid object.`);
      continue;
    }

    // Check chunkId
    if (!chunk.chunkId || typeof chunk.chunkId !== 'string') {
      errors.push(`Chunk at index ${i} is missing a valid chunkId.`);
    }

    // Check chunkIndex sequence
    if (chunk.chunkIndex !== i) {
      errors.push(`Chunk index mismatch: expected ${i}, found ${chunk.chunkIndex}.`);
    }

    // Check non-empty text
    if (!chunk.text || typeof chunk.text !== 'string' || !chunk.text.trim()) {
      errors.push(`Chunk at index ${i} has empty or missing text.`);
    }

    // Check metadata presence
    if (!chunk.metadata || typeof chunk.metadata !== 'object') {
      errors.push(`Chunk at index ${i} is missing its metadata dictionary.`);
    } else {
      // Validate that pageNumber & resource info match chunk fields if present
      if (chunk.pageNumber !== undefined && chunk.metadata.pageNumber !== chunk.pageNumber) {
        errors.push(
          `Chunk at index ${i} has pageNumber mismatch: chunk says ${chunk.pageNumber}, metadata says ${chunk.metadata.pageNumber}.`
        );
      }
    }

    // Check embedding vector
    if (!Array.isArray(chunk.embedding)) {
      errors.push(`Chunk at index ${i} has invalid embedding: expected number[], received ${typeof chunk.embedding}.`);
    } else if (chunk.embedding.length === 0) {
      errors.push(`Chunk at index ${i} has an empty embedding vector (0 dimensions).`);
    } else if (expectedDims && chunk.embedding.length !== expectedDims) {
      errors.push(
        `Chunk at index ${i} vector dimension mismatch: expected ${expectedDims}, received ${chunk.embedding.length}.`
      );
    } else {
      // Validate that every floating-point number is finite
      for (let j = 0; j < chunk.embedding.length; j++) {
        const val = chunk.embedding[j];
        if (typeof val !== 'number' || !Number.isFinite(val)) {
          errors.push(
            `Chunk at index ${i} has non-finite value at dimension ${j}: ${val}`
          );
          break; // Stop after first non-finite value in vector to avoid spam
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Converts a single text chunk into an embedded chunk using Ollama's nomic-embed-text.
 */
export const embedSingleChunk = async (
  chunk: TextChunk,
  options?: DocumentEmbeddingOptions
): Promise<EmbeddedChunk> => {
  if (!chunk || !chunk.text || !chunk.text.trim()) {
    throw new Error('Cannot embed an empty or missing text chunk.');
  }

  const result = await embedChunks([chunk], {
    ...options,
    batchSize: 1,
  });

  if (result.embeddedChunks.length === 0) {
    throw new Error(`Failed to generate embedding for chunk "${chunk.chunkId}".`);
  }

  return result.embeddedChunks[0];
};

/**
 * Converts an array of text chunks or a ChunkingResult into numerical embedding vectors.
 * 
 * Pipeline Features:
 * - Automatically divides large sets of chunks into safe, configurable batches.
 * - Dispatches batches to Ollama's /api/embed endpoint via generateBatchEmbeddings.
 * - Binds returned vectors directly to the originating chunks.
 * - Preserves all metadata (subjectId, moduleId, resourceId, resourceName, pageNumber, totalChunks).
 * - Maintains deterministic input ordering (chunk 0 to N-1).
 * - Rigorously validates dimensions (768), finite values, and non-emptiness.
 * - Supports partial failure recovery (stopOnError: false) or strict transactional failure (stopOnError: true).
 *
 * @param input TextChunk array or ChunkingResult from Stage 2 chunking.
 * @param options Optional configuration (batchSize, stopOnError, abortSignal, customBaseUrl).
 */
export const embedChunks = async (
  input: TextChunk[] | ChunkingResult,
  options?: DocumentEmbeddingOptions
): Promise<DocumentEmbeddingResult> => {
  const { chunks, resourceId, resourceName } = extractChunksFromInput(input);
  const startTime = performance.now();

  const model = options?.model?.trim() || DEFAULT_EMBEDDING_MODEL;
  const expectedDimensions = options?.expectedDimensions ?? NOMIC_EMBED_DIMENSIONS;
  const batchSize = Math.max(1, options?.batchSize ?? DEFAULT_DOCUMENT_EMBEDDING_BATCH_SIZE);
  const stopOnError = options?.stopOnError ?? true;

  // Empty input handling
  if (chunks.length === 0) {
    return {
      embeddedChunks: [],
      totalChunks: 0,
      successfulChunks: 0,
      failedChunks: 0,
      dimensions: expectedDimensions,
      model,
      resourceId,
      resourceName,
      durationMs: 0,
      batchCount: 0,
    };
  }

  const totalBatches = Math.ceil(chunks.length / batchSize);
  const allEmbeddedChunks: EmbeddedChunk[] = [];
  const chunkErrors: Array<{ chunkId: string; chunkIndex: number; error: string }> = [];

  let resolvedDimensions = expectedDimensions;
  let resolvedModel = model;

  for (let b = 0; b < totalBatches; b++) {
    const batchStart = b * batchSize;
    const batchChunks = chunks.slice(batchStart, batchStart + batchSize);
    const batchTexts = batchChunks.map((c) => c.text);

    try {
      // Generate embeddings for current sub-batch via Ollama
      const batchResult = await generateBatchEmbeddings(batchTexts, {
        model,
        customBaseUrl: options?.customBaseUrl,
        abortSignal: options?.abortSignal,
        truncate: options?.truncate,
      });

      resolvedDimensions = batchResult.dimensions;
      resolvedModel = batchResult.model;

      if (batchResult.vectors.length !== batchChunks.length) {
        throw new Error(
          `Batch count mismatch: Dispatched ${batchChunks.length} chunks, received ${batchResult.vectors.length} vectors.`
        );
      }

      if (expectedDimensions && batchResult.dimensions !== expectedDimensions) {
        throw new Error(
          `Embedding dimension mismatch: Model returned ${batchResult.dimensions}-dimensional vectors, expected ${expectedDimensions}.`
        );
      }

      // Associate each embedding with its original chunk preserving all metadata
      for (let i = 0; i < batchChunks.length; i++) {
        const chunk = batchChunks[i];
        const vector = batchResult.vectors[i];

        // Double-check finite numbers
        validateEmbeddingVector(vector, resolvedModel);

        const embeddedChunk: EmbeddedChunk = {
          chunkId: chunk.chunkId,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          embedding: vector,
          dimensions: vector.length,
          model: resolvedModel,
          subjectId: chunk.subjectId,
          moduleId: chunk.moduleId,
          resourceId: chunk.resourceId,
          resourceName: chunk.resourceName,
          pageNumber: chunk.pageNumber,
          totalChunks: chunk.totalChunks,
          tokenCount: chunk.tokenCount,
          characterCount: chunk.characterCount,
          metadata: {
            ...chunk.metadata,
          },
        };

        allEmbeddedChunks.push(embeddedChunk);
      }

      // Progress reporting callback
      if (options?.onProgress) {
        options.onProgress({
          completedChunks: allEmbeddedChunks.length,
          totalChunks: chunks.length,
          completedBatches: b + 1,
          totalBatches,
          percent: Math.round((allEmbeddedChunks.length / chunks.length) * 100),
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);

      for (const failedChunk of batchChunks) {
        chunkErrors.push({
          chunkId: failedChunk.chunkId,
          chunkIndex: failedChunk.chunkIndex,
          error: errMsg,
        });
      }

      if (stopOnError) {
        throw new Error(
          `Document embedding failed at batch ${b + 1}/${totalBatches} (chunks ${batchStart} to ${
            batchStart + batchChunks.length - 1
          }): ${errMsg}`
        );
      }
    }
  }

  // Validate the assembled embedded chunks
  if (allEmbeddedChunks.length > 0) {
    const val = validateEmbeddedChunks(allEmbeddedChunks, {
      expectedDimensions: resolvedDimensions,
    });
    if (!val.isValid && stopOnError) {
      throw new Error(`Embedded chunk validation failed: ${val.errors.join('; ')}`);
    }
  }

  const durationMs = Math.round(performance.now() - startTime);

  return {
    embeddedChunks: allEmbeddedChunks,
    totalChunks: chunks.length,
    successfulChunks: allEmbeddedChunks.length,
    failedChunks: chunkErrors.length,
    dimensions: resolvedDimensions,
    model: resolvedModel,
    resourceId,
    resourceName,
    durationMs,
    batchCount: totalBatches,
    ...(chunkErrors.length > 0 ? { errors: chunkErrors } : {}),
  };
};

/**
 * Converts multiple documents (each either TextChunk[] or ChunkingResult) into embedded chunks.
 */
export const embedMultipleDocuments = async (
  inputs: Array<TextChunk[] | ChunkingResult>,
  options?: DocumentEmbeddingOptions
): Promise<DocumentEmbeddingResult[]> => {
  if (!Array.isArray(inputs)) {
    throw new Error('Inputs to embedMultipleDocuments must be an array.');
  }

  const results: DocumentEmbeddingResult[] = [];
  for (const docInput of inputs) {
    const res = await embedChunks(docInput, options);
    results.push(res);
  }
  return results;
};
