// Chunking Types for AI Student Hub RAG Architecture
// Stage 2: Text Chunking System

import type { PageExtractionResult, PdfExtractionResult } from '../services/pdfExtractionService';

/**
 * Metadata associated with an individual document chunk.
 */
export interface ChunkMetadata {
  chunkId: string;
  chunkIndex: number;
  totalChunks: number;
  studentId?: string;
  subjectId?: string;
  moduleId?: string;
  resourceId?: string;
  resourceName?: string;
  pageNumber?: number;
  tokenCount: number;
  characterCount: number;
  extractionMethod?: 'text' | 'ocr' | 'web' | 'unknown';
  isScanned?: boolean;
  extra?: Record<string, unknown>;
}

/**
 * Represents a single text chunk with content and attached metadata.
 */
export interface TextChunk {
  chunkId: string;
  chunkIndex: number;
  text: string;
  studentId?: string;
  subjectId?: string;
  moduleId?: string;
  resourceId?: string;
  resourceName?: string;
  pageNumber?: number;
  totalChunks: number;
  tokenCount: number;
  characterCount: number;
  metadata: ChunkMetadata;
}

/**
 * Configuration options for text chunking.
 */
export interface ChunkingConfig {
  /**
   * Target maximum tokens per chunk (default: 500).
   */
  chunkSizeTokens?: number;

  /**
   * Number of overlapping tokens between consecutive chunks (default: 75).
   */
  chunkOverlapTokens?: number;

  /**
   * Minimum token threshold to avoid tiny orphan chunks (default: 20).
   */
  minChunkSizeTokens?: number;

  /**
   * Whether to preserve paragraph boundaries where possible (default: true).
   */
  preserveParagraphs?: boolean;

  /**
   * Whether to preserve markdown/text heading boundaries (default: true).
   */
  preserveHeadings?: boolean;

  /**
   * Whether to clean up irregular whitespace, line-breaks, and OCR hyphenation (default: true).
   */
  normalizeWhitespace?: boolean;

  /**
   * Optional custom token counting function.
   */
  tokenEstimator?: (text: string) => number;
}

/**
 * Input format for documents to be chunked.
 */
export interface DocumentChunkInput {
  text?: string;
  pages?: PageExtractionResult[];
  pdfResult?: PdfExtractionResult;
  studentId?: string;
  subjectId?: string;
  moduleId?: string;
  resourceId?: string;
  resourceName?: string;
  pageNumber?: number;
  extractionMethod?: 'text' | 'ocr' | 'web' | 'unknown';
  isScanned?: boolean;
}

/**
 * Comprehensive result of a chunking operation.
 */
export interface ChunkingResult {
  chunks: TextChunk[];
  totalChunks: number;
  totalCharacters: number;
  totalEstimatedTokens: number;
  averageChunkTokens: number;
  resourceId?: string;
  resourceName?: string;
  durationMs: number;
}
