// ChromaDB Types for AI Student Hub RAG Pipeline
// Stage 4: ChromaDB Setup & Vector Storage Layer

/**
 * Standard collection name for student hub document vectors.
 */
export const DEFAULT_CHROMA_COLLECTION = 'student_hub_documents';

/**
 * Standard default ports and endpoints for ChromaDB.
 */
export const DEFAULT_CHROMA_DIRECT_ENDPOINT = 'http://127.0.0.1:8000';
export const DEFAULT_CHROMA_PROXY_ENDPOINT = '/api/chroma';

/**
 * Connection status of the local ChromaDB server.
 */
export interface ChromaConnectionStatus {
  connected: boolean;
  version?: string;
  heartbeat?: number;
  baseUrl: string;
  error?: string;
}

/**
 * Chroma collection representation.
 */
export interface ChromaCollection {
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
  tenant?: string;
  database?: string;
}

/**
 * Options for ChromaDB storage and query operations.
 */
export interface ChromaStorageOptions {
  collectionName?: string;
  customBaseUrl?: string;
  abortSignal?: AbortSignal;
}

/**
 * Metadata stored alongside each vector in ChromaDB.
 * Strictly adheres to Chroma's primitive metadata constraints (string, number, boolean).
 * Supports multi-dimensional filtering by studentId, subjectId, moduleId, and resourceId.
 */
export interface ChromaVectorMetadata {
  chunkId: string;
  subjectId: string;
  moduleId: string;
  resourceId: string;
  resourceName: string;
  pageNumber: number;
  chunkIndex: number;
  totalChunks: number;
  tokenCount: number;
  characterCount: number;
  studentId?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * An individual record retrieved from ChromaDB.
 */
export interface ChromaRecord {
  id: string;
  text: string;
  embedding: number[];
  metadata: ChromaVectorMetadata;
  distance?: number;
}

/**
 * Result of storing embedded chunks into ChromaDB.
 */
export interface ChromaOperationResult {
  success: boolean;
  collectionName: string;
  count: number;
  ids: string[];
  durationMs: number;
}

/**
 * Statistics for a Chroma collection.
 */
export interface ChromaCollectionStats {
  collectionName: string;
  collectionId: string;
  totalVectors: number;
  vectorDimensions?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Filter criteria for vector queries and deletions.
 */
export interface ChromaFilterCriteria {
  studentId?: string;
  subjectId?: string;
  moduleId?: string;
  resourceId?: string;
}
