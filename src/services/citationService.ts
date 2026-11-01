// Citation Verification and Reader Navigation Service for AI Student Hub
// Stage 8.5: Citation Verification & Reader Resilience
// Validates citations against actual retrieved chunks, prevents hallucinated sources,
// and ensures resilient, fail-safe navigation to PDF reader without crashing.

import type { RagSourceReference } from '../types/rag';
import type { SemanticSearchResultItem } from '../types/semanticSearch';
import type { StudyResource } from '../types/resource';
import { getResourceById } from './resourceService';
import { getFileObjectUrl } from './fileStorageService';

export interface CitationValidationOptions {
  /**
   * Expected student ID for multi-tenant isolation validation.
   */
  expectedStudentId?: string;
  /**
   * Expected subject ID for scope consistency.
   */
  expectedSubjectId?: string;
  /**
   * Allowed module IDs for multi-module scope consistency.
   */
  expectedModuleIds?: string[];
  /**
   * Whether to require strict page range formatting.
   */
  strictPageRange?: boolean;
}

export interface CitationValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedCitation?: RagSourceReference;
}

export type CitationNavigationStatus =
  | 'ready'
  | 'deleted'
  | 'missing_url'
  | 'invalid_citation'
  | 'inaccessible'
  | 'error';

export interface CitationNavigationResolution {
  status: CitationNavigationStatus;
  resource: StudyResource | null;
  resolvedUrl?: string;
  pageNumber: number;
  pageEndNumber?: number;
  pageRange?: string;
  errorTitle?: string;
  errorMessage?: string;
}

export interface ExtractedInlineCitation {
  rawText: string;
  filename: string;
  pageNumber: number;
  pageEndNumber?: number;
}

/**
 * Validates individual citation fields against schema and scope requirements.
 * Ensures:
 * - Resource ID is a non-empty string.
 * - Chunk ID is a non-empty string.
 * - Resource filename is a non-empty string.
 * - Starting page number is an integer >= 1 (not NaN, not negative, not 0).
 * - Ending page number (if present) is an integer >= starting page.
 * - Formatted page range matches starting and ending page numbers.
 * - Similarity score is within [0.0, 1.0].
 * - Tenant and study scope isolation is preserved.
 */
export const validateCitation = (
  citation: Partial<RagSourceReference>,
  options?: CitationValidationOptions
): CitationValidationResult => {
  const errors: string[] = [];

  // 1. Validate chunkId
  if (!citation.chunkId || typeof citation.chunkId !== 'string' || citation.chunkId.trim().length === 0) {
    errors.push('Chunk ID is required and must be a non-empty string.');
  }

  // 2. Validate resourceId
  if (!citation.resourceId || typeof citation.resourceId !== 'string' || citation.resourceId.trim().length === 0) {
    errors.push('Resource ID is required and must be a non-empty string.');
  }

  // 3. Validate resourceName / filename
  if (!citation.resourceName || typeof citation.resourceName !== 'string' || citation.resourceName.trim().length === 0) {
    errors.push('Resource filename is required and cannot be empty.');
  }

  // 4. Validate starting pageNumber
  const rawPage = citation.pageNumber;
  if (
    rawPage === undefined ||
    rawPage === null ||
    typeof rawPage !== 'number' ||
    !Number.isFinite(rawPage) ||
    !Number.isInteger(rawPage) ||
    rawPage < 1
  ) {
    errors.push(`Invalid starting page number: ${String(rawPage)}. Must be an integer >= 1.`);
  }

  // 5. Validate ending pageNumber (if present)
  let cleanPageEnd: number | undefined = undefined;
  if (citation.pageEndNumber !== undefined && citation.pageEndNumber !== null) {
    const rawEnd = citation.pageEndNumber;
    if (
      typeof rawEnd !== 'number' ||
      !Number.isFinite(rawEnd) ||
      !Number.isInteger(rawEnd)
    ) {
      errors.push(`Invalid ending page number: ${String(rawEnd)}. Must be an integer.`);
    } else if (typeof rawPage === 'number' && Number.isInteger(rawPage) && rawEnd < rawPage) {
      errors.push(
        `Invalid page range: ending page (${rawEnd}) cannot be less than starting page (${rawPage}).`
      );
    } else {
      cleanPageEnd = rawEnd;
    }
  }

  // 6. Validate pageRange string
  let cleanPageRange = citation.pageRange;
  if (typeof rawPage === 'number' && Number.isInteger(rawPage) && rawPage >= 1) {
    if (cleanPageEnd !== undefined && cleanPageEnd > rawPage) {
      cleanPageRange = `${rawPage}–${cleanPageEnd}`;
    } else if (!cleanPageRange) {
      cleanPageRange = String(rawPage);
    }
  }

  // 7. Validate similarity
  let cleanSimilarity = citation.similarity ?? 1.0;
  if (
    typeof cleanSimilarity !== 'number' ||
    !Number.isFinite(cleanSimilarity) ||
    cleanSimilarity < 0.0 ||
    cleanSimilarity > 1.0
  ) {
    errors.push(`Invalid similarity score: ${String(cleanSimilarity)}. Must be a float between 0.0 and 1.0.`);
    cleanSimilarity = 0.0;
  }

  // 8. Validate Student ID isolation (multi-tenant guard)
  if (options?.expectedStudentId && citation.studentId) {
    if (citation.studentId.trim() !== options.expectedStudentId.trim()) {
      errors.push(
        `Tenant isolation violation: citation studentId "${citation.studentId}" does not match authenticated user "${options.expectedStudentId}".`
      );
    }
  }

  // 9. Validate Subject ID scope
  if (options?.expectedSubjectId && citation.subjectId) {
    if (citation.subjectId.trim() !== options.expectedSubjectId.trim()) {
      errors.push(
        `Scope violation: citation subjectId "${citation.subjectId}" does not match active study subject "${options.expectedSubjectId}".`
      );
    }
  }

  // 10. Validate Module ID scope
  if (options?.expectedModuleIds && options.expectedModuleIds.length > 0 && citation.moduleId) {
    const allowed = options.expectedModuleIds.map((m) => m.trim());
    if (!allowed.includes(citation.moduleId.trim())) {
      errors.push(
        `Module scope violation: citation moduleId "${citation.moduleId}" is not within active modules [${allowed.join(', ')}].`
      );
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  const sanitizedCitation: RagSourceReference = {
    chunkId: citation.chunkId!.trim(),
    resourceId: citation.resourceId!.trim(),
    resourceName: citation.resourceName!.trim(),
    pageNumber: rawPage as number,
    pageEndNumber: cleanPageEnd,
    pageRange: cleanPageRange,
    similarity: cleanSimilarity,
    distance: typeof citation.distance === 'number' && Number.isFinite(citation.distance) ? citation.distance : 0,
    subjectId: citation.subjectId?.trim(),
    moduleId: citation.moduleId?.trim(),
    studentId: citation.studentId?.trim() || options?.expectedStudentId,
    textSnippet: citation.textSnippet?.trim(),
    isVerified: true,
  };

  return {
    isValid: true,
    errors: [],
    sanitizedCitation,
  };
};

/**
 * Checks candidate citations against actual retrieved evidence chunks provided to the LLM.
 * Strictly guarantees:
 * - Citations are only marked `isVerified: true` if they correspond to an actual retrieved chunk.
 * - Does NOT invent citations.
 * - Does NOT alter page numbers or invent new ones.
 * - Preserves multi-page citations (pageEndNumber and pageRange).
 * - Distinguishes between verified source references and unverified claims.
 */
export const verifyCitationsAgainstEvidence = (
  candidateCitations: RagSourceReference[],
  retrievedChunks: SemanticSearchResultItem[],
  options?: CitationValidationOptions
): RagSourceReference[] => {
  if (!Array.isArray(candidateCitations) || candidateCitations.length === 0) {
    return [];
  }

  // Index retrieved chunks by chunkId for quick lookup
  const chunksById = new Map<string, SemanticSearchResultItem>();
  for (const chunk of retrievedChunks) {
    const cid = chunk?.chunkId || (chunk as any)?.id;
    if (cid) {
      chunksById.set(cid, chunk);
    }
  }

  return candidateCitations.map((citation) => {
    // Step 1: Structural validation of citation fields
    const validation = validateCitation(citation, options);
    if (!validation.isValid) {
      return {
        ...citation,
        isVerified: false,
        validationError: validation.errors.join('; '),
      };
    }

    const clean = validation.sanitizedCitation!;

    // Step 2: Evidence correspondence check
    const matchingChunk = chunksById.get(clean.chunkId);
    if (!matchingChunk) {
      return {
        ...clean,
        isVerified: false,
        validationError: `Citation chunk ID "${clean.chunkId}" does not correspond to any retrieved evidence chunk supplied to the LLM.`,
      };
    }

    // Verify resourceId correspondence
    if (matchingChunk.resourceId !== clean.resourceId) {
      return {
        ...clean,
        isVerified: false,
        validationError: `Citation resourceId "${clean.resourceId}" does not match retrieved chunk resourceId "${matchingChunk.resourceId}".`,
      };
    }

    // Verify page correspondence
    if (matchingChunk.pageNumber !== clean.pageNumber) {
      return {
        ...clean,
        isVerified: false,
        validationError: `Citation pageNumber (${clean.pageNumber}) does not match retrieved evidence chunk pageNumber (${matchingChunk.pageNumber}).`,
      };
    }

    // Preserve multi-page range if verified from chunk
    const pageEndNumber = clean.pageEndNumber ?? matchingChunk.pageEndNumber;
    const pageRange = clean.pageRange ?? matchingChunk.pageRange;

    return {
      ...clean,
      pageEndNumber,
      pageRange,
      studentId: matchingChunk.metadata?.studentId || clean.studentId,
      subjectId: clean.subjectId || matchingChunk.subjectId,
      moduleId: clean.moduleId || matchingChunk.moduleId,
      isVerified: true,
      validationError: undefined,
    };
  });
};

/**
 * Returns only the strictly verified source citations from a citation list.
 */
export const filterVerifiedCitations = (
  citations: RagSourceReference[]
): RagSourceReference[] => {
  if (!Array.isArray(citations)) return [];
  return citations.filter((c) => c && c.isVerified === true);
};

/**
 * Safely extracts inline citation mentions from generated LLM text.
 * Detects patterns like:
 * - [Document.pdf - Page 14]
 * - [Document.pdf, pp. 4–5]
 * - [Document.pdf, Page 12]
 * Does not invent citations.
 */
export const extractInlineCitations = (text: string): ExtractedInlineCitation[] => {
  if (!text || typeof text !== 'string') return [];

  const results: ExtractedInlineCitation[] = [];
  // Regex matching patterns like [filename.pdf - Page 14] or [filename.pdf, pp. 4-5]
  const pattern = /\[([a-zA-Z0-9_\-\s.]+\.pdf)\s*(?:-|–|,)?\s*(?:Pages?|pp?\.?)\s*(\d+)(?:\s*[–\-]\s*(\d+))?\]/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const rawText = match[0];
    const filename = match[1].trim();
    const pageNumber = parseInt(match[2], 10);
    const pageEndNumber = match[3] ? parseInt(match[3], 10) : undefined;

    if (Number.isInteger(pageNumber) && pageNumber >= 1) {
      results.push({
        rawText,
        filename,
        pageNumber,
        pageEndNumber: pageEndNumber && pageEndNumber >= pageNumber ? pageEndNumber : undefined,
      });
    }
  }

  return results;
};

/**
 * Resolves a citation for PDF Reader navigation.
 * Validates the citation and page number, looks up the resource in Firestore,
 * verifies file availability, and returns a safe resolution state without crashing.
 */
export const resolveCitationNavigation = async (
  userId: string,
  citation: RagSourceReference,
  resolvers?: {
    getResourceFn?: (userId: string, resourceId: string) => Promise<StudyResource | null>;
    getFileUrlFn?: (key: string) => Promise<string | null>;
  }
): Promise<CitationNavigationResolution> => {
  const getResource = resolvers?.getResourceFn || getResourceById;
  const getFileUrl = resolvers?.getFileUrlFn || getFileObjectUrl;

  // 1. Validate citation parameters
  if (!citation || !citation.resourceId || typeof citation.resourceId !== 'string') {
    return {
      status: 'invalid_citation',
      resource: null,
      pageNumber: 1,
      errorTitle: 'Invalid Citation Reference',
      errorMessage: 'This citation reference is missing a valid resource ID and cannot be opened.',
    };
  }

  // Sanitize page number (must be >= 1)
  const rawPage = citation.pageNumber;
  const pageNumber =
    typeof rawPage === 'number' && Number.isFinite(rawPage) && rawPage >= 1
      ? Math.floor(rawPage)
      : 1;

  // 2. Fetch the resource from Firestore
  let existingResource: StudyResource | null = null;
  try {
    existingResource = await getResource(userId, citation.resourceId.trim());
  } catch (fetchErr) {
    console.warn('Failed to fetch study resource for citation navigation:', fetchErr);
    return {
      status: 'error',
      resource: null,
      pageNumber,
      pageEndNumber: citation.pageEndNumber,
      pageRange: citation.pageRange,
      errorTitle: 'Error Accessing Study Resource',
      errorMessage: 'Unable to connect to study library to open this document. Please check your connection.',
    };
  }

  // 3. Handle Deleted or Missing Resource
  if (!existingResource) {
    const docName = citation.resourceName || 'Requested Document';
    return {
      status: 'deleted',
      resource: null,
      pageNumber,
      pageEndNumber: citation.pageEndNumber,
      pageRange: citation.pageRange,
      errorTitle: 'Study Document Not Found',
      errorMessage: `The referenced document "${docName}" is no longer available in your study library. It may have been deleted or moved after this answer was generated.`,
    };
  }

  // 4. Resolve PDF URL
  let resolvedUrl = '';

  // Try fresh IndexedDB / vault storage URL first
  if (existingResource.fileStorageKey) {
    try {
      const freshUrl = await getFileUrl(existingResource.fileStorageKey);
      if (freshUrl && typeof freshUrl === 'string' && freshUrl.trim().length > 0) {
        resolvedUrl = freshUrl.trim();
      }
    } catch (storageErr) {
      console.warn('Failed to resolve file storage key:', storageErr);
    }
  }

  // Fallback to stored URL if available
  if (!resolvedUrl && existingResource.url && typeof existingResource.url === 'string') {
    resolvedUrl = existingResource.url.trim();
  }

  // 5. Handle Missing URL
  if (!resolvedUrl) {
    return {
      status: 'missing_url',
      resource: existingResource,
      pageNumber,
      pageEndNumber: citation.pageEndNumber,
      pageRange: citation.pageRange,
      errorTitle: 'Document File Unavailable',
      errorMessage: `No file link or storage record was found for "${existingResource.title}". The file may need to be uploaded again.`,
    };
  }

  // 6. Return ready state
  return {
    status: 'ready',
    resource: existingResource,
    resolvedUrl,
    pageNumber,
    pageEndNumber: citation.pageEndNumber,
    pageRange: citation.pageRange,
  };
};
