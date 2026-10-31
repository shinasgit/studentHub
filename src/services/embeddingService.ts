// Embedding Service for AI Student Hub RAG Pipeline
// Stage 1: Embedding Model Setup (nomic-embed-text)
// 100% Free, Zero Billing, Local Privacy

import type {
  OllamaEmbedRequest,
  OllamaEmbedResponse,
  EmbeddingOptions,
  EmbeddingResult,
  BatchEmbeddingResult,
} from '../types/embedding';
import type { OllamaErrorInfo } from '../types/ollama';
import {
  getOllamaBaseUrl,
  parseOllamaError,
  checkOllamaConnection,
} from './ollamaService';

/**
 * Standard embedding model for StudentHub RAG.
 * nomic-embed-text produces 768-dimensional embeddings with an 8192 context window.
 */
export const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';

/**
 * Validates that an embedding vector is a non-empty array of finite floating-point numbers.
 */
export const validateEmbeddingVector = (
  vector: unknown,
  modelName = DEFAULT_EMBEDDING_MODEL
): number[] => {
  if (!Array.isArray(vector)) {
    throw new Error(
      `Embedding validation failed: Expected an array from ${modelName}, received ${typeof vector}.`
    );
  }

  if (vector.length === 0) {
    throw new Error(
      `Embedding validation failed: Model ${modelName} returned an empty embedding vector (0 dimensions).`
    );
  }

  for (let i = 0; i < Math.min(vector.length, 10); i++) {
    const val = vector[i];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw new Error(
        `Embedding validation failed: Element at index ${i} is not a valid finite number: ${val}`
      );
    }
  }

  return vector as number[];
};

/**
 * Checks whether the specified embedding model is installed in the local Ollama instance.
 */
export const isEmbeddingModelAvailable = async (
  modelName: string = DEFAULT_EMBEDDING_MODEL,
  customBaseUrl?: string
): Promise<boolean> => {
  try {
    const status = await checkOllamaConnection(customBaseUrl);
    if (!status.connected || !status.models) return false;

    const normalizedTarget = modelName.trim().toLowerCase();
    return status.models.some((m) => {
      const name = m.name.toLowerCase();
      return name === normalizedTarget || name.startsWith(`${normalizedTarget}:`);
    });
  } catch {
    return false;
  }
};

/**
 * Generate a single numerical embedding vector for a given text.
 * Uses Ollama's POST /api/embed endpoint.
 *
 * @param text The input sentence or paragraph to convert into an embedding.
 * @param options Optional configuration (model, endpoint, abort signal, truncate).
 */
export const generateEmbedding = async (
  text: string,
  options?: EmbeddingOptions
): Promise<EmbeddingResult> => {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Please provide non-empty text to generate an embedding.');
  }

  const model = options?.model?.trim() || DEFAULT_EMBEDDING_MODEL;
  const baseUrl = (options?.customBaseUrl || getOllamaBaseUrl()).replace(/\/+$/, '');
  const startTime = performance.now();

  const payload: OllamaEmbedRequest = {
    model,
    input: text.trim(),
    ...(options?.truncate !== undefined ? { truncate: options.truncate } : {}),
  };

  try {
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(
        `Ollama embedding API error (${response.status}): ${errBody || response.statusText}`
      );
    }

    const data = (await response.json()) as OllamaEmbedResponse;
    const durationMs = Math.round(performance.now() - startTime);

    if (!data.embeddings || !Array.isArray(data.embeddings) || data.embeddings.length === 0) {
      throw new Error(
        `The embedding model "${model}" completed but returned no embeddings array.`
      );
    }

    const rawVector = data.embeddings[0];
    const validatedVector = validateEmbeddingVector(rawVector, model);

    return {
      vector: validatedVector,
      dimensions: validatedVector.length,
      model: data.model || model,
      durationMs,
    };
  } catch (err: unknown) {
    const errorInfo = parseOllamaError(err, model, baseUrl);
    const enrichedError = new Error(errorInfo.message);
    (enrichedError as unknown as { info: OllamaErrorInfo }).info = errorInfo;
    throw enrichedError;
  }
};

/**
 * Generate numerical embedding vectors for multiple texts in a single batch request.
 * Uses Ollama's POST /api/embed with an array of inputs.
 *
 * @param texts Array of sentences or paragraphs to embed.
 * @param options Optional configuration.
 */
export const generateBatchEmbeddings = async (
  texts: string[],
  options?: EmbeddingOptions
): Promise<BatchEmbeddingResult> => {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('Please provide a non-empty array of texts to generate batch embeddings.');
  }

  const cleanedTexts = texts.map((t) => (typeof t === 'string' ? t.trim() : ''));
  if (cleanedTexts.some((t) => !t)) {
    throw new Error('All items in the batch texts array must be non-empty strings.');
  }

  const model = options?.model?.trim() || DEFAULT_EMBEDDING_MODEL;
  const baseUrl = (options?.customBaseUrl || getOllamaBaseUrl()).replace(/\/+$/, '');
  const startTime = performance.now();

  const payload: OllamaEmbedRequest = {
    model,
    input: cleanedTexts,
    ...(options?.truncate !== undefined ? { truncate: options.truncate } : {}),
  };

  try {
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(
        `Ollama batch embedding API error (${response.status}): ${errBody || response.statusText}`
      );
    }

    const data = (await response.json()) as OllamaEmbedResponse;
    const durationMs = Math.round(performance.now() - startTime);

    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new Error(
        `The embedding model "${model}" returned an invalid response without embeddings array.`
      );
    }

    if (data.embeddings.length !== cleanedTexts.length) {
      throw new Error(
        `Embedding count mismatch: Sent ${cleanedTexts.length} texts, received ${data.embeddings.length} vectors.`
      );
    }

    const validatedVectors = data.embeddings.map((rawVec) => {
      const vec = validateEmbeddingVector(rawVec, model);
      return vec;
    });

    // Verify all vectors in the batch have identical dimensions
    const expectedDimensions = validatedVectors[0].length;
    for (let i = 1; i < validatedVectors.length; i++) {
      if (validatedVectors[i].length !== expectedDimensions) {
        throw new Error(
          `Dimension mismatch in batch: Vector 0 has ${expectedDimensions} dims, but Vector ${i} has ${validatedVectors[i].length} dims.`
        );
      }
    }

    return {
      vectors: validatedVectors,
      dimensions: expectedDimensions,
      model: data.model || model,
      count: validatedVectors.length,
      durationMs,
    };
  } catch (err: unknown) {
    const errorInfo = parseOllamaError(err, model, baseUrl);
    const enrichedError = new Error(errorInfo.message);
    (enrichedError as unknown as { info: OllamaErrorInfo }).info = errorInfo;
    throw enrichedError;
  }
};

/**
 * Compute the cosine similarity between two numerical embedding vectors.
 * Returns a value between -1 and 1 (1 = identical semantic direction).
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
    throw new Error('Both inputs to cosineSimilarity must be numerical arrays.');
  }

  if (vecA.length !== vecB.length) {
    throw new Error(
      `Vector dimension mismatch in cosineSimilarity: Vector A has ${vecA.length} dimensions, while Vector B has ${vecB.length} dimensions.`
    );
  }

  if (vecA.length === 0) {
    throw new Error('Vectors cannot be empty (0 dimensions).');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
};
