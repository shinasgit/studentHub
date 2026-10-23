import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
import { getFileFromVault } from './fileStorageService';

// Configure the PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export interface PageExtractionResult {
  pageNumber: number;
  text: string;
  charCount: number;
  extractionMethod: 'text' | 'ocr' | 'empty';
  confidence?: number;
}

export interface PdfExtractionProgress {
  stage: 'loading' | 'extracting_text' | 'detecting_ocr' | 'running_ocr' | 'completed' | 'cancelled' | 'error';
  currentPage: number;
  totalPages: number;
  ocrProgressPercent?: number;
  statusMessage: string;
}

export interface PdfExtractionResult {
  fileName: string;
  status: 'idle' | 'extracting' | 'ocr_processing' | 'success' | 'cancelled' | 'error';
  pageCount: number;
  totalCharacters: number;
  text: string;
  pages: PageExtractionResult[];
  isScanned: boolean;
  hasMixedContent: boolean;
  ocrPerformed: boolean;
  error?: string | null;
  durationMs?: number;
}

export interface ExtractionOptions {
  enableOcr?: boolean;
  ocrThresholdCharCountPerPage?: number; // Minimum chars per page to consider it text-based (default: 35)
  onProgress?: (progress: PdfExtractionProgress) => void;
  abortSignal?: AbortSignal;
}

/**
 * Fetch raw ArrayBuffer for a PDF either from IndexedDB Vault or remote URL.
 */
export const resolvePdfArrayBuffer = async (
  source: { storageKey?: string | null; url?: string | null; fileBlob?: Blob | null }
): Promise<{ buffer: ArrayBuffer; fileName: string }> => {
  // 1. If direct Blob is provided
  if (source.fileBlob) {
    const buffer = await source.fileBlob.arrayBuffer();
    return { buffer, fileName: (source.fileBlob as File).name || 'document.pdf' };
  }

  // 2. If storageKey is provided, check IndexedDB vault
  if (source.storageKey) {
    const blob = await getFileFromVault(source.storageKey);
    if (blob) {
      const buffer = await blob.arrayBuffer();
      return { buffer, fileName: source.storageKey.split('_').slice(3).join('_') || 'document.pdf' };
    }
  }

  // 3. If URL is provided (remote or blob URL)
  if (source.url) {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF from URL (Status ${response.status} ${response.statusText}).`);
    }
    const buffer = await response.arrayBuffer();
    const guessedName = source.url.split('/').pop()?.split('?')[0] || 'document.pdf';
    return { buffer, fileName: decodeURIComponent(guessedName) };
  }

  throw new Error('No valid PDF source (storageKey, fileBlob, or URL) was provided.');
};

/**
 * Render a single page of a PDF document to an HTML Canvas for OCR processing.
 */
export const renderPageToCanvas = async (
  page: pdfjsLib.PDFPageProxy,
  scale = 2.0
): Promise<HTMLCanvasElement> => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Failed to acquire 2D canvas context for PDF rendering.');
  }

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  return canvas;
};

/**
 * Extract text from a page using native PDF.js font glyph extraction.
 */
const extractPageNativeText = async (page: pdfjsLib.PDFPageProxy): Promise<string> => {
  const content = await page.getTextContent();
  const items = content.items as Array<{ str: string; hasEOL?: boolean }>;
  
  if (!items || items.length === 0) {
    return '';
  }

  // Assemble text items with appropriate spacing and newlines
  const textChunks: string[] = [];
  for (const item of items) {
    if (item.str !== undefined) {
      textChunks.push(item.str);
      if (item.hasEOL) {
        textChunks.push('\n');
      } else {
        textChunks.push(' ');
      }
    }
  }

  // Normalize duplicate whitespace while preserving intentional line breaks
  return textChunks
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
};

/**
 * Perform text extraction on a PDF document.
 * 1. Performs normal text extraction.
 * 2. Evaluates page content.
 * 3. Applies OCR on scanned/unreadable pages if enabled.
 * 4. Merges results preserving page order.
 */
export const extractTextFromPdf = async (
  arrayBuffer: ArrayBuffer,
  fileName: string,
  options: ExtractionOptions = {}
): Promise<PdfExtractionResult> => {
  const startTime = Date.now();
  const {
    enableOcr = true,
    ocrThresholdCharCountPerPage = 35,
    onProgress,
    abortSignal,
  } = options;

  onProgress?.({
    stage: 'loading',
    currentPage: 0,
    totalPages: 0,
    statusMessage: 'Loading PDF document...',
  });

  let pdfDoc: pdfjsLib.PDFDocumentProxy;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: true,
    });

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        try {
          loadingTask.destroy();
        } catch {
          // ignore
        }
      });
    }

    pdfDoc = await loadingTask.promise;
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string };
    if (error.name === 'PasswordException') {
      throw new Error('This PDF is password-protected. Please remove the password to extract text.');
    }
    if (error.name === 'InvalidPDFException' || error.message?.includes('Invalid PDF')) {
      throw new Error('Corrupted or unsupported PDF file format.');
    }
    throw new Error(error.message || 'Failed to read PDF document.');
  }

  const totalPages = pdfDoc.numPages;
  if (totalPages === 0) {
    return {
      fileName,
      status: 'success',
      pageCount: 0,
      totalCharacters: 0,
      text: '',
      pages: [],
      isScanned: false,
      hasMixedContent: false,
      ocrPerformed: false,
      durationMs: Date.now() - startTime,
    };
  }

  const extractedPages: PageExtractionResult[] = [];
  const pagesNeedingOcr: number[] = [];

  // Stage 1: Native Text Extraction
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (abortSignal?.aborted) {
      throw new Error('PDF extraction was cancelled.');
    }

    onProgress?.({
      stage: 'extracting_text',
      currentPage: pageNum,
      totalPages,
      statusMessage: `Extracting text from page ${pageNum} of ${totalPages}...`,
    });

    const page = await pdfDoc.getPage(pageNum);
    const nativeText = await extractPageNativeText(page);
    const charCount = nativeText.length;

    if (charCount < ocrThresholdCharCountPerPage) {
      pagesNeedingOcr.push(pageNum);
      extractedPages.push({
        pageNumber: pageNum,
        text: nativeText,
        charCount,
        extractionMethod: charCount > 0 ? 'text' : 'empty',
      });
    } else {
      extractedPages.push({
        pageNumber: pageNum,
        text: nativeText,
        charCount,
        extractionMethod: 'text',
      });
    }
  }

  const isCompletelyScanned = pagesNeedingOcr.length === totalPages;
  const isPartiallyScanned = pagesNeedingOcr.length > 0 && pagesNeedingOcr.length < totalPages;
  let ocrPerformed = false;

  // Stage 2: OCR for Scanned or Low-Text Pages
  if (enableOcr && pagesNeedingOcr.length > 0) {
    onProgress?.({
      stage: 'detecting_ocr',
      currentPage: pagesNeedingOcr[0],
      totalPages,
      statusMessage: `Initial text extraction detected ${pagesNeedingOcr.length} scanned/low-text page(s). Preparing OCR engine...`,
    });

    let ocrWorker: Tesseract.Worker | null = null;
    try {
      // Initialize Tesseract worker for English OCR
      ocrWorker = await createWorker('eng', 1, {
        logger: (m: { progress: number; status: string }) => {
          if (m.status === 'recognizing text') {
            onProgress?.({
              stage: 'running_ocr',
              currentPage: pagesNeedingOcr[0],
              totalPages,
              ocrProgressPercent: Math.round(m.progress * 100),
              statusMessage: `Recognizing text via OCR: ${Math.round(m.progress * 100)}%`,
            });
          }
        },
      });

      for (let idx = 0; idx < pagesNeedingOcr.length; idx++) {
        if (abortSignal?.aborted) {
          throw new Error('OCR text recognition was cancelled by the user.');
        }

        const pageNum = pagesNeedingOcr[idx];
        onProgress?.({
          stage: 'running_ocr',
          currentPage: pageNum,
          totalPages,
          statusMessage: `Running OCR on page ${pageNum} (${idx + 1} of ${pagesNeedingOcr.length})...`,
        });

        const page = await pdfDoc.getPage(pageNum);
        const canvas = await renderPageToCanvas(page, 2.0);

        const ocrResult = await ocrWorker.recognize(canvas);
        const ocrText = (ocrResult.data.text || '').trim();

        // If OCR found meaningful text, update page result
        const pageIndex = extractedPages.findIndex((p) => p.pageNumber === pageNum);
        if (pageIndex !== -1 && ocrText.length > 0) {
          extractedPages[pageIndex] = {
            pageNumber: pageNum,
            text: ocrText,
            charCount: ocrText.length,
            extractionMethod: 'ocr',
            confidence: Math.round(ocrResult.data.confidence),
          };
          ocrPerformed = true;
        }
      }
    } catch (ocrErr: unknown) {
      console.warn('OCR processing encountered an issue, preserving available text:', ocrErr);
    } finally {
      if (ocrWorker) {
        try {
          await ocrWorker.terminate();
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }

  // Combine pages into full document text
  const combinedTextParts: string[] = [];
  let totalChars = 0;

  for (const p of extractedPages) {
    totalChars += p.charCount;
    if (p.text.trim()) {
      const header = totalPages > 1 ? `--- Page ${p.pageNumber}${p.extractionMethod === 'ocr' ? ' (OCR)' : ''} ---\n` : '';
      combinedTextParts.push(`${header}${p.text}`);
    }
  }

  const fullText = combinedTextParts.join('\n\n');

  onProgress?.({
    stage: 'completed',
    currentPage: totalPages,
    totalPages,
    statusMessage: `Extraction completed. Extracted ${totalChars.toLocaleString()} characters from ${totalPages} page(s).`,
  });

  return {
    fileName,
    status: 'success',
    pageCount: totalPages,
    totalCharacters: totalChars,
    text: fullText,
    pages: extractedPages,
    isScanned: isCompletelyScanned,
    hasMixedContent: isPartiallyScanned,
    ocrPerformed,
    durationMs: Date.now() - startTime,
  };
};
