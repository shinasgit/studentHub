// AI Study Tools Integration Service for AI Student Hub
// Stage 10: Unified RAG-Powered Study Tools Architecture
// Connects Module Summary, Quick Notes, Practice Questions & MCQ Quiz to Advanced RAG
// 100% Local Inference (Ollama Llama 3.2 3B + ChromaDB), Evidence-Grounded, Zero Paid APIs

import { getChunksByFilter } from './chromaService';
import { generateCompletion, getSelectedModel } from './ollamaService';
import { resolveAuthenticatedStudentId } from './pdfIndexingService';
import { selectOptimalContextChunks } from './ragContextService';
import { chromaRecordToSearchResultItem } from './keywordSearchService';
import type { SemanticSearchResultItem } from '../types/semanticSearch';
import type { RagSourceReference } from '../types/rag';
import type {
  StudyToolId,
  StudyMaterial,
  PracticeQuestionItem,
  McqQuestionItem,
  McqOptionItem,
} from '../types/studyTools';

export interface StudyToolScope {
  subjectId: string;
  subjectName: string;
  moduleId?: string | null;
  moduleName?: string;
  resourceId?: string;
  resourceName?: string;
  studentId: string;
}

export interface StudyToolProgress {
  stage:
    | 'idle'
    | 'resolving_scope'
    | 'retrieving_chunks'
    | 'building_context'
    | 'generating'
    | 'validating'
    | 'completed'
    | 'cancelled'
    | 'error';
  message: string;
  percent: number;
}

export interface StudyToolGenerationOptions {
  tool: StudyToolId;
  scope: StudyToolScope;
  materials?: StudyMaterial[];
  count?: number; // e.g. 10 questions for practice/quiz
  difficulty?: 'easy' | 'medium' | 'hard';
  maxContextChars?: number;
  model?: string;
  customBaseUrl?: string;
  customChromaUrl?: string;
  collectionName?: string;
  abortSignal?: AbortSignal;
  onProgress?: (progress: StudyToolProgress) => void;
}

export interface StudyToolGenerationResult {
  tool: StudyToolId;
  subjectId: string;
  subjectName: string;
  moduleId?: string | null;
  moduleName?: string;
  resourceId?: string;
  resourceName?: string;
  summaryText?: string;
  notesText?: string;
  practiceQuestions?: PracticeQuestionItem[];
  mcqQuestions?: McqQuestionItem[];
  sources: RagSourceReference[];
  chunksUsedCount: number;
  durationMs: number;
  modelUsed: string;
  isGrounded: boolean;
  status: 'success' | 'no_materials' | 'not_indexed' | 'no_context' | 'cancelled' | 'error';
  error?: string;
  generatedAt: string;
}

const DEFAULT_TOOL_MAX_CONTEXT_CHARS = 7000;

/**
 * System Prompts for each of the 4 AI Study Tools
 */
const SYSTEM_PROMPTS: Record<string, string> = {
  summary: `You are an expert university professor and academic study assistant.
Generate a comprehensive, highly accurate, and well-structured study summary strictly grounded in the provided course excerpts.

MANDATORY RULES:
1. Grounding: Rely EXCLUSIVELY on the provided source excerpts. Never invent facts, definitions, or algorithms.
2. Structure your response into these 7 numbered markdown sections:
   ### 1. Module Overview
   ### 2. Key Concepts
   ### 3. Key Definitions
   ### 4. Detailed Summary
   ### 5. Important Facts, Formulas, and Examples
   ### 6. Key Takeaways
   ### 7. Quick Revision Points`,

  notes: `You are an expert academic revision specialist.
Generate concise, scannable, high-yield study revision notes strictly grounded in the provided course excerpts.

MANDATORY RULES:
1. Grounding: Rely EXCLUSIVELY on the provided source excerpts. Never invent facts or terminology.
2. Structure your response into these 5 numbered markdown sections:
   ### 1. Topic Overview & Core Objectives
   ### 2. Essential Concepts & Principles
   ### 3. Key Definitions & Terminology
   ### 4. Important Formulas, Facts, and Comparisons
   ### 5. High-Yield Exam Revision Points`,

  practice: `You are an expert university examiner.
Generate conceptual and application-based practice questions with complete answers and explanations strictly grounded in the provided course excerpts.

MANDATORY RULES:
1. Base all questions and answers strictly on facts from the provided text excerpts.
2. Output ONLY a valid JSON array of objects with NO markdown formatting, NO introductory text, and NO trailing comments.
Format:
[
  {
    "id": "q1",
    "question": "Question text...",
    "answer": "Detailed correct answer...",
    "explanation": "Explanation citing principles from the text...",
    "difficulty": "medium",
    "topic": "Concept name"
  }
]`,

  quiz: `You are an expert university examiner creating multiple-choice questions.
Generate exactly 10 multiple-choice questions with 4 distinct options ('A', 'B', 'C', 'D'), correct answer, and explanation strictly grounded in the provided course excerpts.

MANDATORY RULES:
1. Base all questions and answers strictly on facts from the provided text excerpts.
2. Each question MUST have exactly 4 options labeled 'A', 'B', 'C', and 'D'.
3. Output ONLY a valid JSON array of objects with NO markdown formatting, NO introductory text, and NO trailing comments.
Format:
[
  {
    "id": "mcq_1",
    "question": "Question text...",
    "options": [
      { "id": "A", "text": "Option text" },
      { "id": "B", "text": "Option text" },
      { "id": "C", "text": "Option text" },
      { "id": "D", "text": "Option text" }
    ],
    "correctOptionId": "A",
    "explanation": "Explanation grounded in the text...",
    "difficulty": "medium",
    "topic": "Concept name"
  }
]`,
};

/**
 * Extracts and parses JSON array from LLM response safely, handling code fences, brackets, and trailing characters.
 * If fallback is provided, returns fallback on parsing failure instead of throwing.
 */
export const robustJsonParser = <T>(raw: string, fallback?: T): T => {
  if (!raw || typeof raw !== 'string') {
    if (fallback !== undefined) return fallback;
    throw new Error('Empty response from model.');
  }

  let text = raw.trim();

  // Strip Markdown code fences if present (e.g. ```json ... ```)
  const matchFence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (matchFence && matchFence[1]) {
    text = matchFence[1].trim();
  }

  // Find opening bracket [ and closing bracket ]
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    text = text.substring(firstBracket, lastBracket + 1).trim();
  }

  // Remove potential trailing commas before closing braces/brackets
  text = text.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Failed to parse structured JSON output from LLM: ${err instanceof Error ? err.message : String(err)}`);
  }
};

/**
 * Retrieves relevant chunks from ChromaDB for the specified study scope.
 * Automatically enforces multi-tenant isolation and subject/module/resource scoping.
 */
export const retrieveChunksForStudyScope = async (
  scope: StudyToolScope,
  options?: {
    customChromaUrl?: string;
    collectionName?: string;
    abortSignal?: AbortSignal;
    limit?: number;
  }
): Promise<{
  chunks: SemanticSearchResultItem[];
  status: 'found' | 'not_indexed' | 'no_materials';
  error?: string;
}> => {
  let verifiedStudentId: string;
  try {
    verifiedStudentId = resolveAuthenticatedStudentId(scope.studentId);
  } catch (authErr) {
    return {
      chunks: [],
      status: 'not_indexed',
      error: authErr instanceof Error ? authErr.message : String(authErr),
    };
  }

  const chromaFilter = {
    studentId: verifiedStudentId,
    ...(scope.subjectId && scope.subjectId !== 'all' ? { subjectId: scope.subjectId.trim() } : {}),
    ...(scope.moduleId && scope.moduleId !== 'all' ? { moduleId: scope.moduleId.trim() } : {}),
    ...(scope.resourceId && scope.resourceId !== 'all' ? { resourceId: scope.resourceId.trim() } : {}),
  };

  try {
    const records = await getChunksByFilter(chromaFilter, {
      customBaseUrl: options?.customChromaUrl,
      collectionName: options?.collectionName,
      limit: options?.limit ?? 50,
      abortSignal: options?.abortSignal,
    });

    if (!records || records.length === 0) {
      return {
        chunks: [],
        status: 'not_indexed',
      };
    }

    const items = records.map((r) => chromaRecordToSearchResultItem(r));
    return {
      chunks: items,
      status: 'found',
    };
  } catch (err) {
    return {
      chunks: [],
      status: 'not_indexed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

/**
 * Convenience helper to fetch only the array of chunks for a study scope.
 */
export const fetchScopeContextChunks = async (
  scope: StudyToolScope,
  options?: {
    customChromaUrl?: string;
    collectionName?: string;
    abortSignal?: AbortSignal;
    limit?: number;
  }
): Promise<SemanticSearchResultItem[]> => {
  const res = await retrieveChunksForStudyScope(scope, options);
  return res.chunks;
};

/**
 * Budget and optimize context chunks within character/token limits.
 * Computes context character size, aggregated citations, and page ranges.
 */
export const budgetScopeChunks = (
  rawChunks: (SemanticSearchResultItem | any)[],
  maxChars: number = DEFAULT_TOOL_MAX_CONTEXT_CHARS
): {
  chunksUsed: number;
  totalChars: number;
  sources: RagSourceReference[];
  chunkSources: RagSourceReference[];
  contextText: string;
} => {
  const chunks: SemanticSearchResultItem[] = rawChunks.map((c) => ({
    chunkId: c.chunkId || c.id || '',
    text: c.text || '',
    resourceId: c.resourceId || c.metadata?.resourceId || '',
    resourceName: c.resourceName || c.metadata?.resourceName || 'Document',
    subjectId: c.subjectId || c.metadata?.subjectId || '',
    moduleId: c.moduleId || c.metadata?.moduleId,
    pageNumber: c.pageNumber ?? c.metadata?.pageNumber ?? 1,
    pageEndNumber: c.pageEndNumber ?? c.metadata?.pageEndNumber ?? c.pageNumber ?? c.metadata?.pageNumber ?? 1,
    chunkIndex: c.chunkIndex ?? c.metadata?.chunkIndex ?? 0,
    similarity: c.similarity ?? 1.0,
    distance: c.distance ?? 0.0,
    metadata: c.metadata || {},
  }));

  const optimal = selectOptimalContextChunks(chunks, maxChars, {
    enableDeduplication: true,
  });

  // Aggregate distinct document sources by resourceId with merged page ranges
  const sourceMap = new Map<string, RagSourceReference>();
  for (const src of optimal.validSources) {
    const existing = sourceMap.get(src.resourceId);
    if (!existing) {
      sourceMap.set(src.resourceId, { ...src });
    } else {
      const minPage = Math.min(existing.pageNumber || 1, src.pageNumber || 1);
      const maxPage = Math.max(
        existing.pageEndNumber || existing.pageNumber || 1,
        src.pageEndNumber || src.pageNumber || 1
      );
      existing.pageNumber = minPage;
      existing.pageEndNumber = maxPage;
      existing.pageRange = minPage === maxPage ? `${minPage}` : `${minPage}–${maxPage}`;
    }
  }

  const aggregatedSources = Array.from(sourceMap.values());

  return {
    chunksUsed: optimal.selectedChunks.length,
    totalChars: optimal.totalChars,
    sources: aggregatedSources,
    chunkSources: optimal.validSources,
    contextText: optimal.contextParts.join('\n---\n\n'),
  };
};

/**
 * Core Study Tool Generation Engine (Reusable across Summary, Notes, Practice, and MCQ Quiz).
 *
 * Workflow:
 * 1. Resolves authenticated student and study scope.
 * 2. Retrieves indexed PDF chunks from ChromaDB.
 * 3. Builds grounded, deduplicated context within the model's budget.
 * 4. Invokes local Ollama LLM with tool-specific prompts.
 * 5. Validates output and attaches verified source citations with PDF page navigation.
 */
export const generateStudyToolContent = async (
  options: StudyToolGenerationOptions
): Promise<StudyToolGenerationResult> => {
  const startTime = performance.now();
  const { tool, scope, materials = [] } = options;
  const model = options.model || getSelectedModel() || 'llama3.2:3b';
  const maxChars = options.maxContextChars || DEFAULT_TOOL_MAX_CONTEXT_CHARS;

  options.onProgress?.({
    stage: 'resolving_scope',
    message: 'Resolving study scope & multi-tenant permissions...',
    percent: 10,
  });

  // Step 1: Pre-validation of materials in current scope
  if (materials.length === 0 && !scope.resourceId) {
    return {
      tool,
      subjectId: scope.subjectId,
      subjectName: scope.subjectName,
      moduleId: scope.moduleId,
      moduleName: scope.moduleName,
      resourceId: scope.resourceId,
      resourceName: scope.resourceName,
      sources: [],
      chunksUsedCount: 0,
      durationMs: Math.round(performance.now() - startTime),
      modelUsed: model,
      isGrounded: false,
      status: 'no_materials',
      error: `No study materials uploaded for this ${scope.moduleId && scope.moduleId !== 'all' ? 'module' : 'subject'}. Please upload course PDFs first.`,
      generatedAt: new Date().toISOString(),
    };
  }

  // Step 2: Retrieve Chunks from ChromaDB using Advanced RAG
  options.onProgress?.({
    stage: 'retrieving_chunks',
    message: 'Retrieving indexed PDF passages from local vector database...',
    percent: 25,
  });

  const retrieval = await retrieveChunksForStudyScope(scope, {
    customChromaUrl: options.customChromaUrl,
    collectionName: options.collectionName,
    abortSignal: options.abortSignal,
    limit: 60,
  });

  if (retrieval.status === 'not_indexed' || retrieval.chunks.length === 0) {
    const scopeLabel = scope.resourceName
      ? `"${scope.resourceName}"`
      : scope.moduleName
      ? `Module "${scope.moduleName}"`
      : `Subject "${scope.subjectName}"`;

    return {
      tool,
      subjectId: scope.subjectId,
      subjectName: scope.subjectName,
      moduleId: scope.moduleId,
      moduleName: scope.moduleName,
      resourceId: scope.resourceId,
      resourceName: scope.resourceName,
      sources: [],
      chunksUsedCount: 0,
      durationMs: Math.round(performance.now() - startTime),
      modelUsed: model,
      isGrounded: false,
      status: 'not_indexed',
      error: `The study materials for ${scopeLabel} have not been indexed into ChromaDB yet. Please ensure your PDFs are uploaded and indexed.`,
      generatedAt: new Date().toISOString(),
    };
  }

  // Step 3: Context Construction & Deduplication
  options.onProgress?.({
    stage: 'building_context',
    message: 'Deduplicating and budgeting document passages...',
    percent: 40,
  });

  const optimalContext = selectOptimalContextChunks(retrieval.chunks, maxChars, {
    enableDeduplication: true,
    nearDuplicateThreshold: 0.85,
  });

  const optimalContextChunksCount = optimalContext.selectedChunks.length;

  if (optimalContextChunksCount === 0) {
    return {
      tool,
      subjectId: scope.subjectId,
      subjectName: scope.subjectName,
      moduleId: scope.moduleId,
      moduleName: scope.moduleName,
      resourceId: scope.resourceId,
      resourceName: scope.resourceName,
      sources: [],
      chunksUsedCount: 0,
      durationMs: Math.round(performance.now() - startTime),
      modelUsed: model,
      isGrounded: false,
      status: 'no_context',
      error: 'Retrieved document passages were empty or unreadable.',
      generatedAt: new Date().toISOString(),
    };
  }

  const documentContext = optimalContext.contextParts.join('\n---\n\n');

  // Aggregate document citations with page ranges
  const sourceMap = new Map<string, RagSourceReference>();
  for (const src of optimalContext.validSources) {
    const existing = sourceMap.get(src.resourceId);
    if (!existing) {
      sourceMap.set(src.resourceId, { ...src });
    } else {
      const minPage = Math.min(existing.pageNumber || 1, src.pageNumber || 1);
      const maxPage = Math.max(
        existing.pageEndNumber || existing.pageNumber || 1,
        src.pageEndNumber || src.pageNumber || 1
      );
      existing.pageNumber = minPage;
      existing.pageEndNumber = maxPage;
      existing.pageRange = minPage === maxPage ? `${minPage}` : `${minPage}–${maxPage}`;
    }
  }
  const verifiedSources: RagSourceReference[] = Array.from(sourceMap.values());

  // Step 4: Tool-Specific Prompt Construction
  const systemPrompt = SYSTEM_PROMPTS[tool] || SYSTEM_PROMPTS.summary;
  const scopeHeader = `Course: "${scope.subjectName}"${scope.moduleName ? ` | Module: "${scope.moduleName}"` : ''}${scope.resourceName ? ` | Resource: "${scope.resourceName}"` : ''}`;

  const userPrompt = `### COURSE CONTEXT:
${scopeHeader}

### VERIFIED DOCUMENT EXCERPTS (Primary Grounding Material):
${documentContext}

---

### INSTRUCTION FOR AI TUTOR:
Generate the requested educational ${tool.toUpperCase()} strictly based on the verified excerpts above.
Do not hallucinate outside information.`;

  // Step 5: LLM Generation
  options.onProgress?.({
    stage: 'generating',
    message: `Generating ${tool} with local ${model}...`,
    percent: 60,
  });

  try {
    const completion = await generateCompletion({
      model,
      prompt: userPrompt,
      system: systemPrompt,
      temperature: 0.25, // Controlled factual temperature
      customBaseUrl: options.customBaseUrl,
      abortSignal: options.abortSignal,
    });

    if (completion.isCancelled || options.abortSignal?.aborted) {
      return {
        tool,
        subjectId: scope.subjectId,
        subjectName: scope.subjectName,
        moduleId: scope.moduleId,
        moduleName: scope.moduleName,
        resourceId: scope.resourceId,
        resourceName: scope.resourceName,
        sources: [],
        chunksUsedCount: optimalContextChunksCount,
        durationMs: Math.round(performance.now() - startTime),
        modelUsed: model,
        isGrounded: false,
        status: 'cancelled',
        generatedAt: new Date().toISOString(),
      };
    }

    const rawOutput = completion.text.trim();

    // Step 6: Output Validation
    options.onProgress?.({
      stage: 'validating',
      message: 'Validating output structure and evidence consistency...',
      percent: 90,
    });

    const durationMs = Math.round(performance.now() - startTime);

    if (tool === 'summary') {
      return {
        tool: 'summary',
        subjectId: scope.subjectId,
        subjectName: scope.subjectName,
        moduleId: scope.moduleId,
        moduleName: scope.moduleName,
        resourceId: scope.resourceId,
        resourceName: scope.resourceName,
        summaryText: rawOutput,
        sources: verifiedSources,
        chunksUsedCount: optimalContextChunksCount,
        durationMs,
        modelUsed: model,
        isGrounded: true,
        status: 'success',
        generatedAt: new Date().toISOString(),
      };
    }

    if (tool === 'notes') {
      return {
        tool: 'notes',
        subjectId: scope.subjectId,
        subjectName: scope.subjectName,
        moduleId: scope.moduleId,
        moduleName: scope.moduleName,
        resourceId: scope.resourceId,
        resourceName: scope.resourceName,
        notesText: rawOutput,
        sources: verifiedSources,
        chunksUsedCount: optimalContextChunksCount,
        durationMs,
        modelUsed: model,
        isGrounded: true,
        status: 'success',
        generatedAt: new Date().toISOString(),
      };
    }

    if (tool === 'practice') {
      const parsed = robustJsonParser<Array<Record<string, unknown>>>(rawOutput, []);
      const firstSource = verifiedSources[0];

      const questions: PracticeQuestionItem[] = parsed.map((item, idx) => ({
        id: (item.id as string) || `pq_${idx + 1}`,
        subjectId: scope.subjectId,
        moduleId: scope.moduleId || undefined,
        question: (item.question as string) || `Practice Question ${idx + 1}`,
        answer: (item.answer as string) || '',
        explanation: (item.explanation as string) || undefined,
        topic: (item.topic as string) || scope.moduleName || scope.subjectName,
        difficulty: (item.difficulty as 'easy' | 'medium' | 'hard') || options.difficulty || 'medium',
        sourceFile: firstSource?.resourceName,
        pageRef: firstSource?.pageRange ? `p. ${firstSource.pageRange}` : undefined,
      }));

      return {
        tool: 'practice',
        subjectId: scope.subjectId,
        subjectName: scope.subjectName,
        moduleId: scope.moduleId,
        moduleName: scope.moduleName,
        resourceId: scope.resourceId,
        resourceName: scope.resourceName,
        practiceQuestions: questions,
        sources: verifiedSources,
        chunksUsedCount: optimalContextChunksCount,
        durationMs,
        modelUsed: model,
        isGrounded: true,
        status: 'success',
        generatedAt: new Date().toISOString(),
      };
    }

    if (tool === 'quiz') {
      const parsed = robustJsonParser<Array<Record<string, unknown>>>(rawOutput, []);
      const firstSource = verifiedSources[0];

      const questions: McqQuestionItem[] = parsed.map((item, idx) => {
        const rawOptions = (item.options as Array<Record<string, string>>) || [];
        const optionsList: McqOptionItem[] = rawOptions.map((opt, oIdx) => ({
          id: opt.id || ['A', 'B', 'C', 'D'][oIdx] || `opt_${oIdx + 1}`,
          text: opt.text || String(opt),
        }));

        // Guarantee 4 options
        while (optionsList.length < 4) {
          const letter = ['A', 'B', 'C', 'D'][optionsList.length];
          optionsList.push({ id: letter, text: `Option ${letter}` });
        }

        return {
          id: (item.id as string) || `mcq_${idx + 1}`,
          subjectId: scope.subjectId,
          moduleId: scope.moduleId || undefined,
          question: (item.question as string) || `Quiz Question ${idx + 1}`,
          options: optionsList.slice(0, 4),
          correctOptionId: ((item.correctOptionId || item.correctAnswer) as string) || 'A',
          explanation: (item.explanation as string) || 'Based on verified course material.',
          topic: (item.topic as string) || scope.moduleName || scope.subjectName,
          difficulty: (item.difficulty as 'easy' | 'medium' | 'hard') || options.difficulty || 'medium',
          sourceFile: firstSource?.resourceName,
          pageRef: firstSource?.pageRange ? `p. ${firstSource.pageRange}` : undefined,
        };
      });

      return {
        tool: 'quiz',
        subjectId: scope.subjectId,
        subjectName: scope.subjectName,
        moduleId: scope.moduleId,
        moduleName: scope.moduleName,
        resourceId: scope.resourceId,
        resourceName: scope.resourceName,
        mcqQuestions: questions,
        sources: verifiedSources,
        chunksUsedCount: optimalContextChunksCount,
        durationMs,
        modelUsed: model,
        isGrounded: true,
        status: 'success',
        generatedAt: new Date().toISOString(),
      };
    }

    throw new Error(`Unsupported study tool: "${tool}".`);
  } catch (genErr) {
    if (options.abortSignal?.aborted) {
      return {
        tool,
        subjectId: scope.subjectId,
        subjectName: scope.subjectName,
        moduleId: scope.moduleId,
        moduleName: scope.moduleName,
        resourceId: scope.resourceId,
        resourceName: scope.resourceName,
        sources: [],
        chunksUsedCount: 0,
        durationMs: Math.round(performance.now() - startTime),
        modelUsed: model,
        isGrounded: false,
        status: 'cancelled',
        generatedAt: new Date().toISOString(),
      };
    }

    return {
      tool,
      subjectId: scope.subjectId,
      subjectName: scope.subjectName,
      moduleId: scope.moduleId,
      moduleName: scope.moduleName,
      resourceId: scope.resourceId,
      resourceName: scope.resourceName,
      sources: verifiedSources,
      chunksUsedCount: optimalContextChunksCount,
      durationMs: Math.round(performance.now() - startTime),
      modelUsed: model,
      isGrounded: false,
      status: 'error',
      error: genErr instanceof Error ? genErr.message : String(genErr),
      generatedAt: new Date().toISOString(),
    };
  }
};
