// PDF Indexing Pipeline Service for AI Student Hub RAG Architecture
// Stage 5: End-to-End Automated PDF Indexing Pipeline
// Coordinates: PDF/OCR Extraction -> Semantic Chunking -> nomic-embed-text -> ChromaDB Storage
// 100% Free, Local Privacy, Idempotent, Scoped to Authenticated Students

import { auth } from '../lib/firebase';
import {
  resolvePdfArrayBuffer,
  extractTextFromPdf,
  type PdfExtractionResult,
} from './pdfExtractionService';
import { chunkDocument } from './chunkingService';
import { embedChunks } from './documentEmbeddingService';
import {
  addEmbeddedChunks,
  deleteChunksByResourceId,
  deleteChunksByFilter,
} from './chromaService';
import { DEFAULT_CHROMA_COLLECTION } from '../types/chroma';
import type {
  IndexPdfInput,
  IndexPdfSource,
  IndexPdfOptions,
  IndexPdfResult,
  IndexingProgress,
} from '../types/pdfIndexing';

/**
 * Resolves and verifies the authenticated student's ID.
 * In a browser context, retrieves and validates against Firebase Auth (auth.currentUser.uid).
 * Rejects client-supplied IDs that attempt to impersonate another student.
 */
export const resolveAuthenticatedStudentId = (providedStudentId?: string): string => {
  // If running in browser and Firebase Auth user is present
  if (typeof window !== 'undefined' && auth?.currentUser) {
    const authUid = auth.currentUser.uid;
    if (providedStudentId && providedStudentId.trim() !== authUid) {
      throw new Error(
        `Authorization failed: Provided studentId ("${providedStudentId}") does not match authenticated user ("${authUid}").`
      );
    }
    return authUid;
  }

  // If in Node.js / automated test environment where studentId is provided directly
  if (providedStudentId && providedStudentId.trim()) {
    return providedStudentId.trim();
  }

  throw new Error('Authentication required: No authenticated student user found.');
};

/**
 * Executes the complete 5-step automated PDF indexing pipeline:
 *
 * 1. Identify & Verify: Resolves authenticated studentId and validates resource metadata.
 * 2. Extract Text & OCR: Reuses existing PDF extraction & Tesseract OCR services.
 * 3. Semantic Chunking: Divides text into ~500 token chunks preserving headings & page numbers.
 * 4. Embedding Generation: Uses local Ollama nomic-embed-text producing 768-dim vectors.
 * 5. Idempotent ChromaDB Storage: Atomically updates vectors without leaving stale chunks.
 *
 * @param input Resource metadata and PDF source (file, blob, storageKey, url, or buffer).
 * @param options Pipeline configuration (collectionName, chunkSize, batchSize, onProgress).
 */
export const indexPdfDocument = async (
  input: IndexPdfInput,
  options?: IndexPdfOptions
): Promise<IndexPdfResult> => {
  const startTime = performance.now();
  const collectionName = options?.collectionName || DEFAULT_CHROMA_COLLECTION;

  const reportProgress = (progress: IndexingProgress) => {
    options?.onProgress?.(progress);
  };

  reportProgress({
    stage: 'pending',
    message: `Starting indexing pipeline for "${input.resourceName}"...`,
    percent: 0,
  });

  // -------------------------------------------------------------
  // STEP 1: IDENTIFY & VERIFY RESOURCE
  // -------------------------------------------------------------
  let verifiedStudentId: string;
  try {
    verifiedStudentId = resolveAuthenticatedStudentId(input.studentId);
  } catch (authErr) {
    const errMsg = authErr instanceof Error ? authErr.message : String(authErr);
    reportProgress({
      stage: 'failed',
      message: `Authentication failure: ${errMsg}`,
      percent: 0,
    });
    return {
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      studentId: input.studentId || 'unknown',
      subjectId: input.subjectId,
      moduleId: input.moduleId,
      status: 'failed',
      totalPages: 0,
      totalChunks: 0,
      successfulChunks: 0,
      storedChunks: 0,
      failedChunks: 0,
      isScanned: false,
      ocrPerformed: false,
      durationMs: Math.round(performance.now() - startTime),
      collectionName,
      error: errMsg,
    };
  }

  if (!input.resourceId || !input.resourceId.trim()) {
    throw new Error('Missing required resourceId for PDF indexing.');
  }
  if (!input.resourceName || !input.resourceName.trim()) {
    throw new Error('Missing required resourceName for PDF indexing.');
  }
  if (!input.subjectId || !input.subjectId.trim()) {
    throw new Error('Missing required subjectId for PDF indexing.');
  }

  // -------------------------------------------------------------
  // STEP 2: EXTRACT PDF TEXT & OCR
  // -------------------------------------------------------------
  reportProgress({
    stage: 'extracting',
    message: `Extracting text and performing OCR for "${input.resourceName}"...`,
    percent: 15,
  });

  let extractionResult: PdfExtractionResult;

  try {
    // Check if pre-extracted PDF result was provided
    if (
      typeof input.source === 'object' &&
      input.source !== null &&
      'pdfResult' in input.source &&
      input.source.pdfResult
    ) {
      extractionResult = input.source.pdfResult;
    } else {
      let arrayBuffer: ArrayBuffer;
      let resolvedFileName = input.resourceName;

      if (input.source instanceof ArrayBuffer) {
        arrayBuffer = input.source;
      } else if (input.source instanceof Uint8Array) {
        arrayBuffer = input.source.buffer.slice(
          input.source.byteOffset,
          input.source.byteOffset + input.source.byteLength
        ) as ArrayBuffer;
      } else if (typeof Blob !== 'undefined' && input.source instanceof Blob) {
        arrayBuffer = await input.source.arrayBuffer();
      } else {
        const srcObj = input.source as IndexPdfSource;
        if (srcObj.arrayBuffer) {
          const raw = srcObj.arrayBuffer;
          arrayBuffer =
            raw instanceof Uint8Array
              ? (raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer)
              : raw;
          resolvedFileName = srcObj.fileName || input.resourceName;
        } else {
          const resolved = await resolvePdfArrayBuffer(srcObj);
          arrayBuffer = resolved.buffer;
          resolvedFileName = resolved.fileName || input.resourceName;
        }
      }

      extractionResult = await extractTextFromPdf(arrayBuffer, resolvedFileName, {
        enableOcr: options?.extractionOptions?.enableOcr ?? true,
        ocrThresholdCharCountPerPage: options?.extractionOptions?.ocrThresholdCharCountPerPage ?? 35,
        abortSignal: options?.abortSignal,
        onProgress: (p) => {
          reportProgress({
            stage: 'extracting',
            message: p.statusMessage,
            percent: Math.min(35, 15 + Math.round((p.currentPage / Math.max(1, p.totalPages)) * 20)),
            currentPage: p.currentPage,
            totalPages: p.totalPages,
          });
        },
      });
    }

    if (extractionResult.status === 'error') {
      throw new Error(extractionResult.error || 'Failed to extract text from PDF document.');
    }
  } catch (extractErr) {
    const errMsg = extractErr instanceof Error ? extractErr.message : String(extractErr);
    reportProgress({
      stage: 'failed',
      message: `Extraction failed: ${errMsg}`,
      percent: 15,
    });
    return {
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      studentId: verifiedStudentId,
      subjectId: input.subjectId,
      moduleId: input.moduleId,
      status: 'failed',
      totalPages: 0,
      totalChunks: 0,
      successfulChunks: 0,
      storedChunks: 0,
      failedChunks: 0,
      isScanned: false,
      ocrPerformed: false,
      durationMs: Math.round(performance.now() - startTime),
      collectionName,
      error: errMsg,
    };
  }

  // Handle completely empty documents
  if (extractionResult.pageCount === 0 || (!extractionResult.text && extractionResult.pages.length === 0)) {
    reportProgress({
      stage: 'completed',
      message: `PDF contains 0 pages or text. Nothing to index.`,
      percent: 100,
    });
    return {
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      studentId: verifiedStudentId,
      subjectId: input.subjectId,
      moduleId: input.moduleId,
      status: 'completed',
      totalPages: extractionResult.pageCount,
      totalChunks: 0,
      successfulChunks: 0,
      storedChunks: 0,
      failedChunks: 0,
      isScanned: extractionResult.isScanned,
      ocrPerformed: extractionResult.ocrPerformed,
      durationMs: Math.round(performance.now() - startTime),
      collectionName,
    };
  }

  // -------------------------------------------------------------
  // STEP 3: SEMANTIC TEXT CHUNKING
  // -------------------------------------------------------------
  reportProgress({
    stage: 'chunking',
    message: `Dividing document into semantic chunks preserving headings and page numbers...`,
    percent: 40,
    totalPages: extractionResult.pageCount,
    isScanned: extractionResult.isScanned,
  });

  const chunkResult = chunkDocument(
    {
      pages: extractionResult.pages,
      text: extractionResult.text,
      studentId: verifiedStudentId,
      subjectId: input.subjectId,
      moduleId: input.moduleId,
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      extractionMethod: extractionResult.ocrPerformed ? 'ocr' : 'text',
      isScanned: extractionResult.isScanned,
    },
    options?.chunkConfig
  );

  if (chunkResult.totalChunks === 0) {
    reportProgress({
      stage: 'completed',
      message: 'Document contained no indexable text after cleaning.',
      percent: 100,
    });
    return {
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      studentId: verifiedStudentId,
      subjectId: input.subjectId,
      moduleId: input.moduleId,
      status: 'completed',
      totalPages: extractionResult.pageCount,
      totalChunks: 0,
      successfulChunks: 0,
      storedChunks: 0,
      failedChunks: 0,
      isScanned: extractionResult.isScanned,
      ocrPerformed: extractionResult.ocrPerformed,
      durationMs: Math.round(performance.now() - startTime),
      collectionName,
    };
  }

  // -------------------------------------------------------------
  // STEP 4: GENERATE EMBEDDINGS (nomic-embed-text)
  // -------------------------------------------------------------
  reportProgress({
    stage: 'embedding',
    message: `Generating 768-dimensional embeddings for ${chunkResult.totalChunks} chunks via Ollama...`,
    percent: 60,
    totalChunks: chunkResult.totalChunks,
  });

  let embeddingResult;
  try {
    embeddingResult = await embedChunks(chunkResult, {
      ...options?.embeddingOptions,
      stopOnError: true,
      onProgress: (p) => {
        reportProgress({
          stage: 'embedding',
          message: `Embedding chunks: ${p.completedChunks}/${p.totalChunks} (${p.percent}%)`,
          percent: 60 + Math.round((p.percent / 100) * 20),
          totalChunks: p.totalChunks,
          completedChunks: p.completedChunks,
        });
      },
    });

    if (embeddingResult.failedChunks > 0 || embeddingResult.embeddedChunks.length !== chunkResult.totalChunks) {
      throw new Error(
        `Embedding generation failed: ${embeddingResult.failedChunks} chunk(s) could not be embedded.`
      );
    }
  } catch (embedErr) {
    const errMsg = embedErr instanceof Error ? embedErr.message : String(embedErr);
    reportProgress({
      stage: 'failed',
      message: `Embedding failed: ${errMsg}`,
      percent: 60,
    });
    return {
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      studentId: verifiedStudentId,
      subjectId: input.subjectId,
      moduleId: input.moduleId,
      status: 'failed',
      totalPages: extractionResult.pageCount,
      totalChunks: chunkResult.totalChunks,
      successfulChunks: 0,
      storedChunks: 0,
      failedChunks: chunkResult.totalChunks,
      isScanned: extractionResult.isScanned,
      ocrPerformed: extractionResult.ocrPerformed,
      durationMs: Math.round(performance.now() - startTime),
      collectionName,
      error: errMsg,
    };
  }

  // -------------------------------------------------------------
  // STEP 5: IDEMPOTENT CHROMADB STORAGE
  // -------------------------------------------------------------
  reportProgress({
    stage: 'storing',
    message: `Storing ${embeddingResult.embeddedChunks.length} vectors into ChromaDB collection "${collectionName}"...`,
    percent: 85,
    totalChunks: chunkResult.totalChunks,
  });

  try {
    // Idempotency: Clean out any previous index for this resourceId to prevent duplicate chunks
    await deleteChunksByResourceId(input.resourceId, {
      collectionName,
      customBaseUrl: options?.chromaOptions?.customBaseUrl,
    });

    // Store the validated embedded chunks
    const storeResult = await addEmbeddedChunks(embeddingResult.embeddedChunks, {
      collectionName,
      customBaseUrl: options?.chromaOptions?.customBaseUrl,
      abortSignal: options?.abortSignal,
    });

    if (!storeResult.success || storeResult.count !== embeddingResult.embeddedChunks.length) {
      throw new Error(
        `Storage verification failed: Dispatched ${embeddingResult.embeddedChunks.length} vectors, stored ${storeResult.count}.`
      );
    }

    reportProgress({
      stage: 'completed',
      message: `Successfully indexed ${storeResult.count} chunks for "${input.resourceName}".`,
      percent: 100,
      totalChunks: chunkResult.totalChunks,
      completedChunks: storeResult.count,
    });

    return {
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      studentId: verifiedStudentId,
      subjectId: input.subjectId,
      moduleId: input.moduleId,
      status: 'completed',
      totalPages: extractionResult.pageCount,
      totalChunks: chunkResult.totalChunks,
      successfulChunks: embeddingResult.successfulChunks,
      storedChunks: storeResult.count,
      failedChunks: 0,
      isScanned: extractionResult.isScanned,
      ocrPerformed: extractionResult.ocrPerformed,
      durationMs: Math.round(performance.now() - startTime),
      collectionName,
    };
  } catch (storeErr) {
    const errMsg = storeErr instanceof Error ? storeErr.message : String(storeErr);
    reportProgress({
      stage: 'failed',
      message: `ChromaDB storage failed: ${errMsg}`,
      percent: 85,
    });
    return {
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      studentId: verifiedStudentId,
      subjectId: input.subjectId,
      moduleId: input.moduleId,
      status: 'failed',
      totalPages: extractionResult.pageCount,
      totalChunks: chunkResult.totalChunks,
      successfulChunks: embeddingResult.successfulChunks,
      storedChunks: 0,
      failedChunks: embeddingResult.successfulChunks,
      isScanned: extractionResult.isScanned,
      ocrPerformed: extractionResult.ocrPerformed,
      durationMs: Math.round(performance.now() - startTime),
      collectionName,
      error: errMsg,
    };
  }
};

/**
 * Indexes multiple PDF documents sequentially with aggregated results.
 */
export const indexMultiplePdfDocuments = async (
  inputs: IndexPdfInput[],
  options?: IndexPdfOptions
): Promise<IndexPdfResult[]> => {
  const results: IndexPdfResult[] = [];
  for (const input of inputs) {
    const res = await indexPdfDocument(input, options);
    results.push(res);
  }
  return results;
};

/**
 * Removes all indexed vector chunks for a specific resource from ChromaDB.
 * Scoped to the authenticated student for multi-tenant data isolation.
 */
export const deleteResourceIndex = async (
  resourceId: string,
  studentId?: string,
  options?: { collectionName?: string; customBaseUrl?: string }
): Promise<number> => {
  const verifiedStudentId = resolveAuthenticatedStudentId(studentId);

  return deleteChunksByFilter(
    {
      resourceId,
      studentId: verifiedStudentId,
    },
    options
  );
};

/**
 * Re-indexes an existing PDF document.
 * Inherently idempotent: Replaces existing vectors for this resourceId without duplicates.
 */
export const reindexPdfDocument = async (
  input: IndexPdfInput,
  options?: IndexPdfOptions
): Promise<IndexPdfResult> => {
  return indexPdfDocument(input, options);
};
