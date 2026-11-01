// Semantic Search & Retrieval Types for AI Student Hub RAG Pipeline
// Stage 6: Semantic Search & Document Retrieval

import type { ChromaVectorMetadata } from './chroma';

/**
 * Default minimum similarity threshold for filtering out irrelevant vector matches [0.0, 1.0].
 * Initial baseline configuration: 0.50.
 */
export const DEFAULT_SEMANTIC_SEARCH_MIN_SIMILARITY = 0.50;

/**
 * Filter criteria to restrict semantic search scope.
 * Student ID is always required and enforced to ensure cross-tenant data isolation.
 */
export interface SemanticSearchFilters {
  /**
   * Authenticated student ID (enforced via Firebase Auth in browser context).
   */
  studentId?: string;
  /**
   * Optional subject filter (e.g. 'cs-networks-301').
   */
  subjectId?: string;
  /**
   * Optional single module filter (e.g. 'mod-transport-layer').
   */
  moduleId?: string;
  /**
   * Optional multiple module filter (e.g. ['mod-transport-layer', 'mod-network-layer']).
   * Enables multi-module scoping in ChromaDB queries via $in operator.
   */
  moduleIds?: string[];
  /**
   * Optional specific resource/document filter (e.g. 'res-tcp-notes-001').
   */
  resourceId?: string;
}

/**
 * An individual document chunk retrieved by semantic similarity.
 */
export interface SemanticSearchResultItem {
  /**
   * Unique identifier of the chunk (e.g. 'res-tcp-notes-001_chunk_0').
   */
  chunkId: string;
  /**
   * Original verbatim text content of the chunk.
   */
  text: string;
  /**
   * Associated resource ID.
   */
  resourceId: string;
  /**
   * Original filename of the resource PDF.
   */
  resourceName: string;
  /**
   * Subject ID the resource belongs to.
   */
  subjectId: string;
  /**
   * Module ID the resource belongs to (if any).
   */
  moduleId?: string;
  /**
   * 1-indexed page number in the original PDF document.
   */
  pageNumber: number;
  /**
   * 1-indexed ending page number if chunk spans multiple PDF pages.
   */
  pageEndNumber?: number;
  /**
   * Formatted page range string (e.g. "4–5") for multi-page chunks.
   */
  pageRange?: string;
  /**
   * 0-indexed chunk position within the document.
   */
  chunkIndex: number;
  /**
   * Raw distance returned by the vector database (cosine distance).
   * Range [0, 2] for cosine metric (0 = identical, 1 = orthogonal).
   */
  distance: number;
  /**
   * Normalized cosine similarity score in the range [0.0, 1.0].
   * Calculated as max(0, min(1, 1 - distance)).
   * Higher values indicate closer semantic relevance.
   */
  similarity: number;
  /**
   * Complete underlying metadata record.
   */
  metadata: ChromaVectorMetadata;
}

/**
 * Configuration options for semantic search queries.
 */
export interface SemanticSearchOptions {
  /**
   * Maximum number of relevant chunks to retrieve. Default: 5.
   */
  topK?: number;
  /**
   * Optional minimum similarity threshold [0.0, 1.0].
   * Chunks with similarity below this value are excluded.
   */
  minSimilarity?: number;
  /**
   * Optional maximum distance threshold.
   * Chunks with distance above this value are excluded.
   */
  maxDistance?: number;
  /**
   * Metadata filter criteria (studentId, subjectId, moduleId, resourceId).
   */
  filters?: SemanticSearchFilters;
  /**
   * Target ChromaDB collection name. Default: 'student_hub_documents'.
   */
  collectionName?: string;
  /**
   * Optional custom Ollama base URL (e.g. for testing offline conditions).
   */
  customOllamaUrl?: string;
  /**
   * Optional custom ChromaDB base URL (e.g. for testing offline conditions).
   */
  customChromaUrl?: string;
  /**
   * Optional abort signal to cancel search in-flight.
   */
  abortSignal?: AbortSignal;
}

/**
 * Standard structured response for a semantic search operation.
 */
export interface SemanticSearchResponse {
  /**
   * The original search query submitted by the student.
   */
  query: string;
  /**
   * Total number of matching chunks retrieved and returned.
   */
  totalResults: number;
  /**
   * Search duration in milliseconds (query embedding + vector search).
   */
  durationMs: number;
  /**
   * Array of retrieved chunks sorted by relevance (highest similarity first).
   */
  results: SemanticSearchResultItem[];
  /**
   * Execution status of the search operation.
   */
  status: 'success' | 'empty' | 'failed';
  /**
   * Descriptive error message if the search failed.
   */
  error?: string;
  /**
   * Name of the ChromaDB collection queried.
   */
  collectionName?: string;
}
