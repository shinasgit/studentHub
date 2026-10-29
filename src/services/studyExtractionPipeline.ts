// Shared Study Material Extraction Pipeline for AI Student Hub
// Resolves PDFs (IndexedDB/Storage) with OCR fallback, plus Web Articles and YouTube Transcripts
// Reusable across Module Summary, Quick Study Notes, Practice Questions, and MCQ Quiz
// 100% Free, Zero Paid APIs, SSRF Protected

import { resolvePdfArrayBuffer, extractTextFromPdf } from './pdfExtractionService';
import type { StudyMaterial } from '../types/studyTools';

export type SourceCategory = 'PDF' | 'Web' | 'YouTube';

export interface ExtractedSourceInfo {
  id: string;
  fileName: string;
  title?: string;
  type: SourceCategory;
  url?: string;
  pageCount?: number;
  characterCount: number;
  isScanned?: boolean;
  ocrPerformed?: boolean;
  status: 'success' | 'error';
  errorMessage?: string;
}

export interface ExtractionPipelineResult {
  sources: ExtractedSourceInfo[];
  combinedRawText: string;
  totalCharacters: number;
  hasOcr: boolean;
  successfulSourceCount: number;
  failedSourceCount: number;
}

export interface ExtractionProgressCallback {
  stage: 'resolving_files' | 'extracting_pdf' | 'extracting_web' | 'completed' | 'error';
  currentFile?: string;
  message: string;
  percent: number;
}

/**
 * Helper to extract web content or YouTube transcript via server-side endpoint or direct fallback
 */
async function fetchServerSideWebContent(
  url: string,
  name?: string,
  abortSignal?: AbortSignal
): Promise<{ success: boolean; title: string; text: string; type: 'Web' | 'YouTube'; error?: string }> {
  // If in browser, call the Vite server-side middleware
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/extract-web', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, name }),
      signal: abortSignal,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status} from web extraction server.`);
    }

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to extract web content.');
    }

    return {
      success: true,
      title: data.title || name || url,
      text: data.extractedText || '',
      type: data.type || 'Web',
    };
  }

  throw new Error('Web extraction is only supported in browser or server context.');
}

/**
 * Extracts and combines text from all selected PDF and Web study materials.
 * Handles digital PDFs, scanned PDFs (with OCR), web articles, and YouTube transcripts.
 */
export const extractStudyMaterialsText = async (
  materials: StudyMaterial[],
  options?: {
    scopeTitle?: string;
    abortSignal?: AbortSignal;
    onProgress?: (progress: ExtractionProgressCallback) => void;
  }
): Promise<ExtractionPipelineResult> => {
  const { scopeTitle, abortSignal, onProgress } = options || {};

  // Support both PDF and Web resources (articles & YouTube links)
  const targetMaterials = materials.filter((m) => {
    const isPdf = m.type === 'PDF' || m.name.toLowerCase().endsWith('.pdf') || m.url?.toLowerCase().endsWith('.pdf');
    const isWeb = m.type === 'Web' || m.url?.startsWith('http://') || m.url?.startsWith('https://');
    return isPdf || isWeb;
  });

  if (targetMaterials.length === 0) {
    throw new Error(
      `No eligible study materials (PDFs or web links) found for ${scopeTitle || 'the selected scope'}. ` +
      `Please upload a PDF or attach an educational web article/video link first.`
    );
  }

  const sources: ExtractedSourceInfo[] = [];
  const extractedBlocks: string[] = [];
  let anyOcrUsed = false;
  let successfulSourceCount = 0;
  let failedSourceCount = 0;

  const totalFiles = targetMaterials.length;

  for (let i = 0; i < totalFiles; i++) {
    if (abortSignal?.aborted) {
      throw new DOMException('Text extraction was cancelled.', 'AbortError');
    }

    const mat = targetMaterials[i];
    const filePercent = Math.round(((i + 1) / (totalFiles + 1)) * 40);

    const isPdf = mat.type === 'PDF' || mat.name.toLowerCase().endsWith('.pdf') || mat.url?.toLowerCase().endsWith('.pdf');
    const isYouTube = mat.url ? mat.url.includes('youtube.com') || mat.url.includes('youtu.be') : false;

    // --- CASE A: PDF EXTRACTION ---
    if (isPdf) {
      onProgress?.({
        stage: 'extracting_pdf',
        currentFile: mat.name,
        message: `Extracting text from "${mat.name}" (${i + 1} of ${totalFiles})...`,
        percent: filePercent,
      });

      try {
        const { buffer, fileName } = await resolvePdfArrayBuffer({
          storageKey: mat.storageKey,
          url: mat.url,
          fileName: mat.name,
        });

        const extraction = await extractTextFromPdf(buffer, fileName, {
          enableOcr: true,
          abortSignal,
          onProgress: (p) => {
            if (p.stage === 'running_ocr') {
              onProgress?.({
                stage: 'extracting_pdf',
                currentFile: mat.name,
                message: `Running OCR on scanned pages of "${mat.name}" (Page ${p.currentPage}/${p.totalPages})...`,
                percent: filePercent + 4,
              });
            }
          },
        });

        if (extraction.ocrPerformed || extraction.isScanned) {
          anyOcrUsed = true;
        }

        sources.push({
          id: mat.id,
          fileName: mat.name,
          title: mat.name,
          type: 'PDF',
          url: mat.url,
          pageCount: extraction.pageCount,
          characterCount: extraction.totalCharacters,
          isScanned: extraction.isScanned,
          ocrPerformed: extraction.ocrPerformed,
          status: 'success',
        });

        if (extraction.text.trim().length > 0) {
          extractedBlocks.push(
            `=== SOURCE: ${mat.name} (PDF, ${extraction.pageCount} pages) ===\n\n${extraction.text.trim()}`
          );
          successfulSourceCount++;
        } else {
          failedSourceCount++;
        }
      } catch (err: unknown) {
        const msg = (err as Error)?.message || 'PDF extraction failed';
        sources.push({
          id: mat.id,
          fileName: mat.name,
          title: mat.name,
          type: 'PDF',
          url: mat.url,
          characterCount: 0,
          status: 'error',
          errorMessage: msg,
        });
        failedSourceCount++;
      }
    }
    // --- CASE B: WEB ARTICLE OR YOUTUBE EXTRACTION ---
    else {
      const typeLabel = isYouTube ? 'YouTube transcript' : 'web article';
      onProgress?.({
        stage: 'extracting_web',
        currentFile: mat.name,
        message: `Fetching ${typeLabel} from "${mat.name}" (${i + 1} of ${totalFiles})...`,
        percent: filePercent,
      });

      try {
        const webResult = await fetchServerSideWebContent(mat.url, mat.name, abortSignal);

        sources.push({
          id: mat.id,
          fileName: mat.name,
          title: webResult.title,
          type: webResult.type,
          url: mat.url,
          characterCount: webResult.text.length,
          status: 'success',
        });

        if (webResult.text.trim().length > 0) {
          const header = webResult.type === 'YouTube'
            ? `=== SOURCE: ${webResult.title} (YouTube Video Transcript, ${mat.url}) ===`
            : `=== SOURCE: ${webResult.title} (Web Article, ${mat.url}) ===`;

          extractedBlocks.push(`${header}\n\n${webResult.text.trim()}`);
          successfulSourceCount++;
        } else {
          failedSourceCount++;
        }
      } catch (err: unknown) {
        const msg = (err as Error)?.message || 'Web content extraction failed';
        sources.push({
          id: mat.id,
          fileName: mat.name,
          title: mat.name,
          type: isYouTube ? 'YouTube' : 'Web',
          url: mat.url,
          characterCount: 0,
          status: 'error',
          errorMessage: msg,
        });
        failedSourceCount++;
      }
    }
  }

  const combinedRawText = extractedBlocks.join('\n\n\n');
  const totalCharacters = combinedRawText.length;

  // If ALL selected sources failed, throw descriptive error
  if (successfulSourceCount === 0 || totalCharacters < 50) {
    const errorDetails = sources
      .filter((s) => s.status === 'error' && s.errorMessage)
      .map((s) => `• ${s.fileName}: ${s.errorMessage}`)
      .join('\n');

    throw new Error(
      `Insufficient readable text extracted (${totalCharacters} characters) from the selected materials.\n\n` +
      (errorDetails ? `Errors encountered:\n${errorDetails}` : 'Check that files and web links contain accessible text.')
    );
  }

  return {
    sources,
    combinedRawText,
    totalCharacters,
    hasOcr: anyOcrUsed,
    successfulSourceCount,
    failedSourceCount,
  };
};
