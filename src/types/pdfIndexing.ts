// PDF Indexing Pipeline Types for AI Student Hub RAG Architecture
// Stage 5: Automated PDF Indexing Pipeline

import type { ExtractionOptions, PdfExtractionResult } from '../services/pdfExtractionService';
import type { ChunkingConfig } from './chunking';
import type { DocumentEmbeddingOptions } from './embedding';
import type { ChromaStorageOptions } from './chroma';

/**
 * Progression stages during the end-to-end PDF indexing pipeline.
 */
export type IndexingStage =
  | 'pending'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'storing'
  | 'completed'
  | 'failed';

/**
 * Real-time progress updates reported during PDF indexing.
 */
export interface IndexingProgress {
  stage: IndexingStage;
  message: string;
  percent: number;
  currentPage?: number;
  totalPages?: number;
  totalChunks?: number;
  completedChunks?: number;
  isScanned?: boolean;
}

/**
 * Multi-format source specification for PDF input.
 */
export interface IndexPdfSource {
  arrayBuffer?: ArrayBuffer | Uint8Array | null;
  fileBlob?: Blob | null;
  storageKey?: string | null;
  url?: string | null;
  fileName?: string | null;
  /**
   * Pre-extracted PDF result if text extraction has already occurred.
   */
  pdfResult?: PdfExtractionResult;
}

/**
 * Input parameters required to index a PDF document.
 */
export interface IndexPdfInput {
  source: IndexPdfSource | ArrayBuffer | Uint8Array | Blob;
  /**
   * Authenticated student UID. Verified against Firebase Auth in browser context.
   */
  studentId?: string;
  subjectId: string;
  moduleId?: string;
  resourceId: string;
  resourceName: string;
}

/**
 * Optional configuration for tuning the PDF indexing pipeline.
 */
export interface IndexPdfOptions {
  collectionName?: string;
  chunkConfig?: ChunkingConfig;
  embeddingOptions?: DocumentEmbeddingOptions;
  extractionOptions?: ExtractionOptions;
  chromaOptions?: ChromaStorageOptions;
  onProgress?: (progress: IndexingProgress) => void;
  abortSignal?: AbortSignal;
}

/**
 * Comprehensive summary result produced by the PDF indexing pipeline.
 */
export interface IndexPdfResult {
  resourceId: string;
  resourceName: string;
  studentId: string;
  subjectId: string;
  moduleId?: string;
  status: 'completed' | 'failed';
  totalPages: number;
  totalChunks: number;
  successfulChunks: number;
  storedChunks: number;
  failedChunks: number;
  isScanned: boolean;
  ocrPerformed: boolean;
  durationMs: number;
  collectionName: string;
  error?: string;
  errors?: string[];
}
