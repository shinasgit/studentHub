// RAG Context Construction, Deduplication & Budget Optimization Service
// Stage 8.4: Smart Context Selection, Deduplication & Multi-Page Tracking
// 100% Free, Local Privacy, Offline Ollama (Llama 3.2 3B) + ChromaDB

import type { SemanticSearchResultItem } from '../types/semanticSearch';
import type { RagSourceReference } from '../types/rag';
import { sanitizeDocumentContext } from './ragService';

export const DEFAULT_NEAR_DUPLICATE_THRESHOLD = 0.80;
export const DEFAULT_CONTAINMENT_THRESHOLD = 0.85;

export interface DeduplicationOptions {
  nearDuplicateThreshold?: number;
  containmentThreshold?: number;
}

export interface ContextSelectionOptions extends DeduplicationOptions {
  enableDeduplication?: boolean;
  allowTailTruncation?: boolean;
}

export interface SelectedChunkItem {
  chunk: SemanticSearchResultItem;
  formattedBlock: string;
  isTruncated: boolean;
}

export interface SelectedContextResult {
  selectedChunks: SelectedChunkItem[];
  contextParts: string[];
  validSources: RagSourceReference[];
  totalChars: number;
  dedupRemovedCount: number;
}

/**
 * Normalizes text for exact and normalized duplicate comparison.
 * Collapses whitespace, strips punctuation, and standardizes casing.
 */
export const normalizeTextForComparison = (text: string): string => {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Extracts a set of normalized unique words from text for set-theoretic similarity comparisons.
 */
export const extractWordSet = (text: string): Set<string> => {
  const normalized = normalizeTextForComparison(text);
  if (!normalized) return new Set();

  const words = normalized.split(' ').filter((w) => w.length > 0);
  return new Set(words);
};

/**
 * Computes the Jaccard similarity index over word sets of two text chunks:
 * Jaccard = |A ∩ B| / |A ∪ B|
 * Range [0.0, 1.0].
 */
export const computeJaccardWordSimilarity = (textA: string, textB: string): number => {
  const wordsA = extractWordSet(textA);
  const wordsB = extractWordSet(textB);

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersectionCount++;
    }
  }

  const unionCount = wordsA.size + wordsB.size - intersectionCount;
  return unionCount === 0 ? 0.0 : intersectionCount / unionCount;
};

/**
 * Computes the asymmetric containment ratio of two text chunks:
 * Containment = |A ∩ B| / min(|A|, |B|)
 * Measures whether one chunk's content is almost entirely subsumed within another.
 */
export const computeContainmentRatio = (textA: string, textB: string): number => {
  const wordsA = extractWordSet(textA);
  const wordsB = extractWordSet(textB);

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersectionCount++;
    }
  }

  const minSize = Math.min(wordsA.size, wordsB.size);
  return minSize === 0 ? 0.0 : intersectionCount / minSize;
};

/**
 * Evaluates whether a candidate chunk is an exact, normalized, or near-duplicate
 * of an already accepted chunk.
 *
 * Rules:
 * 1. Exact match on chunkId or verbatim text -> duplicate.
 * 2. Exact match on normalized text -> duplicate.
 * 3. High Jaccard similarity (>= nearDuplicateThreshold) -> near-duplicate.
 * 4. High containment (>= containmentThreshold) with similar word count -> near-duplicate.
 * 5. Genuinely useful adjacent chunks with typical sliding window overlap (10% - 30%)
 *    are strictly PRESERVED and not flagged as duplicates.
 */
export const isDuplicateOrRedundantChunk = (
  candidate: SemanticSearchResultItem,
  selected: SemanticSearchResultItem[],
  options?: DeduplicationOptions
): boolean => {
  if (!selected || selected.length === 0) return false;

  const candidateText = candidate.text?.trim() || '';
  if (!candidateText) return true; // Discard empty chunks

  const normCandidate = normalizeTextForComparison(candidateText);
  const candidateWordSet = extractWordSet(candidateText);
  const nearThreshold = options?.nearDuplicateThreshold ?? DEFAULT_NEAR_DUPLICATE_THRESHOLD;
  const containmentThreshold = options?.containmentThreshold ?? DEFAULT_CONTAINMENT_THRESHOLD;

  for (const existing of selected) {
    const existingText = existing.text?.trim() || '';
    if (!existingText) continue;

    // Rule 1: Exact chunkId or verbatim text match
    if (existing.chunkId === candidate.chunkId || existingText === candidateText) {
      return true;
    }

    // Rule 2: Normalized text duplicate
    const normExisting = normalizeTextForComparison(existingText);
    if (normExisting === normCandidate) {
      return true;
    }

    // Rule 3: Near-duplicate via Jaccard similarity
    const jaccard = computeJaccardWordSimilarity(existingText, candidateText);
    if (jaccard >= nearThreshold) {
      return true;
    }

    // Rule 4: Substantial containment when sizes are comparable
    const containment = computeContainmentRatio(existingText, candidateText);
    const existingWordSet = extractWordSet(existingText);
    const minWords = Math.min(existingWordSet.size, candidateWordSet.size);
    const maxWords = Math.max(1, Math.max(existingWordSet.size, candidateWordSet.size));
    const sizeRatio = minWords / maxWords;

    if (containment >= containmentThreshold && sizeRatio >= 0.70) {
      return true;
    }
  }

  return false;
};

/**
 * Deduplicates an array of retrieved chunks preserving original ranking and metadata.
 */
export const deduplicateChunks = (
  chunks: SemanticSearchResultItem[],
  options?: DeduplicationOptions
): { deduplicated: SemanticSearchResultItem[]; removedCount: number } => {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { deduplicated: [], removedCount: 0 };
  }

  const deduplicated: SemanticSearchResultItem[] = [];
  let removedCount = 0;

  for (const chunk of chunks) {
    if (isDuplicateOrRedundantChunk(chunk, deduplicated, options)) {
      removedCount++;
    } else {
      deduplicated.push(chunk);
    }
  }

  return { deduplicated, removedCount };
};

/**
 * Truncates text at sentence boundaries preserving grammatical integrity.
 * Avoids cutting mid-sentence or mid-word wherever possible.
 */
export const truncateAtSentenceBoundary = (
  text: string,
  maxChars: number
): { text: string; truncated: boolean } => {
  if (!text || typeof text !== 'string') {
    return { text: '', truncated: false };
  }

  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return { text: trimmed, truncated: false };
  }

  if (maxChars <= 3) {
    return { text: trimmed.slice(0, maxChars), truncated: true };
  }

  const targetChars = maxChars - 3; // reserve 3 characters for '...'
  const slice = trimmed.slice(0, targetChars);

  // Search for the last valid sentence terminator within the slice
  const terminators = [
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('.\n'),
    slice.lastIndexOf('!\n'),
    slice.lastIndexOf('?\n'),
    slice.lastIndexOf('\n\n'),
  ];

  const lastSentenceEnd = Math.max(...terminators);

  // If a sentence terminator was found and preserves at least 35% of the target, use it
  if (lastSentenceEnd >= Math.floor(targetChars * 0.35)) {
    return {
      text: slice.slice(0, lastSentenceEnd + 1).trim() + '...',
      truncated: true,
    };
  }

  // Fallback: look for a word boundary
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace >= Math.floor(targetChars * 0.25)) {
    return {
      text: slice.slice(0, lastSpace).trim() + '...',
      truncated: true,
    };
  }

  // Extreme fallback: hard slice with ellipsis
  return {
    text: slice.trim() + '...',
    truncated: true,
  };
};

/**
 * Formats accurate page citation text for single-page and multi-page chunks.
 */
export const formatPageCitation = (
  pageNumber: number,
  pageEndNumber?: number
): { label: string; headerTag: string } => {
  const isMultiPage =
    typeof pageEndNumber === 'number' && pageEndNumber > pageNumber;

  if (isMultiPage) {
    return {
      label: `pp. ${pageNumber}–${pageEndNumber}`,
      headerTag: `Pages: ${pageNumber}–${pageEndNumber}`,
    };
  }

  return {
    label: `p. ${pageNumber}`,
    headerTag: `Page: ${pageNumber}`,
  };
};

/**
 * Builds the source citation header block for prompt context.
 */
export const buildChunkCitationHeader = (
  chunk: SemanticSearchResultItem,
  index: number
): string => {
  const pageEnd = chunk.pageEndNumber ?? chunk.metadata?.pageEndNumber;
  const pageCitation = formatPageCitation(chunk.pageNumber, pageEnd);
  return `[Source ${index + 1}: ${chunk.resourceName} | ${pageCitation.headerTag} | Chunk: ${chunk.chunkId}]`;
};

/**
 * Smart Context Selection and Budget Optimization:
 *
 * 1. Deduplicates candidate chunks (exact, normalized, near-duplicates).
 * 2. Iterates in relevance order.
 * 3. Packs whole chunks into context budget without premature `break`.
 *    If an oversized chunk does not fit, skips it and continues checking
 *    subsequent smaller chunks.
 * 4. If all candidate chunks exceed the budget, performs sentence-boundary
 *    truncation on the highest-ranked chunk so context is not empty.
 * 5. Preserves multi-page tracking (`pageNumber`, `pageEndNumber`, `pageRange`).
 * 6. Preserves complete citation metadata.
 */
export const selectOptimalContextChunks = (
  chunks: SemanticSearchResultItem[],
  maxChars: number,
  options?: ContextSelectionOptions
): SelectedContextResult => {
  // Step 1: Deduplicate chunks
  const enableDedup = options?.enableDeduplication !== false;
  const { deduplicated, removedCount } = enableDedup
    ? deduplicateChunks(chunks, options)
    : { deduplicated: chunks, removedCount: 0 };

  const selectedChunks: SelectedChunkItem[] = [];
  const validSources: RagSourceReference[] = [];
  const contextParts: string[] = [];
  let currentChars = 0;

  const oversizedSkipped: Array<{
    chunk: SemanticSearchResultItem;
    cleanedText: string;
    sourceHeader: string;
  }> = [];

  // Step 2: Pack whole chunks that fit into available budget
  for (let i = 0; i < deduplicated.length; i++) {
    const chunk = deduplicated[i];
    const cleanedText = sanitizeDocumentContext(chunk.text);
    if (!cleanedText) continue;

    const sourceHeader = buildChunkCitationHeader(chunk, selectedChunks.length);
    const candidateBlock = `${sourceHeader}\n${cleanedText}\n`;
    const separatorChars = contextParts.length > 0 ? 6 : 0; // "\n---\n\n" is 6 chars

    if (currentChars + separatorChars + candidateBlock.length <= maxChars) {
      // Chunk fits completely!
      contextParts.push(candidateBlock);
      currentChars += separatorChars + candidateBlock.length;

      const pageEndNumber = chunk.pageEndNumber ?? chunk.metadata?.pageEndNumber;
      const pageRange =
        chunk.pageRange ??
        chunk.metadata?.pageRange ??
        (pageEndNumber && pageEndNumber > chunk.pageNumber
          ? `${chunk.pageNumber}–${pageEndNumber}`
          : undefined);

      validSources.push({
        chunkId: chunk.chunkId,
        resourceId: chunk.resourceId,
        resourceName: chunk.resourceName,
        pageNumber: chunk.pageNumber,
        pageEndNumber,
        pageRange,
        similarity: chunk.similarity,
        distance: chunk.distance,
        subjectId: chunk.subjectId,
        moduleId: chunk.moduleId,
        textSnippet: cleanedText.slice(0, 160) + (cleanedText.length > 160 ? '...' : ''),
      });

      selectedChunks.push({
        chunk,
        formattedBlock: candidateBlock,
        isTruncated: false,
      });
    } else {
      // Does not fit in full! Do NOT break. Keep candidate for possible truncation or smaller subsequent chunks.
      oversizedSkipped.push({
        chunk,
        cleanedText,
        sourceHeader,
      });
    }
  }

  // Step 3: Handle edge case where NO chunk fit completely (all chunks exceed budget)
  if (selectedChunks.length === 0 && oversizedSkipped.length > 0) {
    const topOversized = oversizedSkipped[0];
    const sourceHeader = buildChunkCitationHeader(topOversized.chunk, 0);
    const overheadChars = sourceHeader.length + 2; // header + "\n" + "\n"

    if (maxChars > overheadChars + 20) {
      const allowedTextChars = maxChars - overheadChars;
      const truncated = truncateAtSentenceBoundary(topOversized.cleanedText, allowedTextChars);
      const chunkBlock = `${sourceHeader}\n${truncated.text}\n`;

      contextParts.push(chunkBlock);
      currentChars = chunkBlock.length;

      const pageEndNumber = topOversized.chunk.pageEndNumber ?? topOversized.chunk.metadata?.pageEndNumber;
      const pageRange =
        topOversized.chunk.pageRange ??
        topOversized.chunk.metadata?.pageRange ??
        (pageEndNumber && pageEndNumber > topOversized.chunk.pageNumber
          ? `${topOversized.chunk.pageNumber}–${pageEndNumber}`
          : undefined);

      validSources.push({
        chunkId: topOversized.chunk.chunkId,
        resourceId: topOversized.chunk.resourceId,
        resourceName: topOversized.chunk.resourceName,
        pageNumber: topOversized.chunk.pageNumber,
        pageEndNumber,
        pageRange,
        similarity: topOversized.chunk.similarity,
        distance: topOversized.chunk.distance,
        subjectId: topOversized.chunk.subjectId,
        moduleId: topOversized.chunk.moduleId,
        textSnippet: truncated.text.slice(0, 160) + (truncated.text.length > 160 ? '...' : ''),
      });

      selectedChunks.push({
        chunk: topOversized.chunk,
        formattedBlock: chunkBlock,
        isTruncated: true,
      });
    }
  }
  // Step 4: Optional tail truncation if allowed and meaningful budget remains
  else if (options?.allowTailTruncation && oversizedSkipped.length > 0) {
    const remainingBudget = maxChars - currentChars - 6;
    const topSkipped = oversizedSkipped[0];
    const sourceHeader = buildChunkCitationHeader(topSkipped.chunk, selectedChunks.length);
    const overheadChars = sourceHeader.length + 2;

    if (remainingBudget >= overheadChars + 60) {
      const allowedTextChars = remainingBudget - overheadChars;
      const truncated = truncateAtSentenceBoundary(topSkipped.cleanedText, allowedTextChars);
      const chunkBlock = `${sourceHeader}\n${truncated.text}\n`;

      contextParts.push(chunkBlock);
      currentChars += 6 + chunkBlock.length;

      const pageEndNumber = topSkipped.chunk.pageEndNumber ?? topSkipped.chunk.metadata?.pageEndNumber;
      const pageRange =
        topSkipped.chunk.pageRange ??
        topSkipped.chunk.metadata?.pageRange ??
        (pageEndNumber && pageEndNumber > topSkipped.chunk.pageNumber
          ? `${topSkipped.chunk.pageNumber}–${pageEndNumber}`
          : undefined);

      validSources.push({
        chunkId: topSkipped.chunk.chunkId,
        resourceId: topSkipped.chunk.resourceId,
        resourceName: topSkipped.chunk.resourceName,
        pageNumber: topSkipped.chunk.pageNumber,
        pageEndNumber,
        pageRange,
        similarity: topSkipped.chunk.similarity,
        distance: topSkipped.chunk.distance,
        subjectId: topSkipped.chunk.subjectId,
        moduleId: topSkipped.chunk.moduleId,
        textSnippet: truncated.text.slice(0, 160) + (truncated.text.length > 160 ? '...' : ''),
      });

      selectedChunks.push({
        chunk: topSkipped.chunk,
        formattedBlock: chunkBlock,
        isTruncated: true,
      });
    }
  }

  return {
    selectedChunks,
    contextParts,
    validSources,
    totalChars: currentChars,
    dedupRemovedCount: removedCount,
  };
};
