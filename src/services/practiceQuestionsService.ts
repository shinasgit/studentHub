// Practice Questions Service for AI Student Hub
// Generates grounded practice questions with answers and explanations using Ollama Llama 3.2 (3B)
// 100% Local Inference, Zero Paid APIs, Strict JSON Validation

import { extractStudyMaterialsText, type ExtractedSourceInfo } from './studyExtractionPipeline';
import { generateCompletion, getSelectedModel } from './ollamaService';
import type { PracticeQuestionItem, StudyMaterial } from '../types/studyTools';

export interface PracticeQuestionsProgress {
  stage:
    | 'idle'
    | 'resolving_files'
    | 'extracting_pdf'
    | 'generating_questions'
    | 'completed'
    | 'cancelled'
    | 'error';
  currentFile?: string;
  message: string;
  percent: number;
}

export interface PracticeQuestionsResult {
  subjectId: string;
  subjectName: string;
  moduleId?: string | null;
  moduleName?: string;
  questions: PracticeQuestionItem[];
  difficulty: 'easy' | 'medium' | 'hard';
  sources: ExtractedSourceInfo[];
  totalSourceCharacters: number;
  modelUsed: string;
  durationMs: number;
  hasOcr: boolean;
  generatedAt: string;
}

export interface GeneratePracticeQuestionsOptions {
  materials: StudyMaterial[];
  subjectId: string;
  subjectName: string;
  moduleId?: string | null;
  moduleName?: string;
  count?: number; // default: 5
  difficulty?: 'easy' | 'medium' | 'hard'; // default: 'medium'
  model?: string;
  customBaseUrl?: string;
  abortSignal?: AbortSignal;
  onProgress?: (progress: PracticeQuestionsProgress) => void;
}

/**
 * Clean and robustly parse JSON from LLM output, extracting from markdown code fences or brackets.
 */
export const cleanAndParseJson = <T>(raw: string): T => {
  let cleaned = raw.trim();

  // If enclosed in markdown code fences ```json ... ```
  const matchFence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (matchFence && matchFence[1]) {
    cleaned = matchFence[1].trim();
  } else {
    // If text has leading explanations before the first '[' or '{'
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1).trim();
    }
  }

  return JSON.parse(cleaned) as T;
};

/**
 * Validate and sanitize generated practice questions.
 */
export const validatePracticeQuestions = (
  rawItems: unknown[],
  subjectId: string,
  moduleId?: string | null,
  defaultDifficulty: 'easy' | 'medium' | 'hard' = 'medium',
  defaultSourceFile?: string
): PracticeQuestionItem[] => {
  if (!Array.isArray(rawItems)) {
    throw new Error('Model output did not produce a valid array of questions.');
  }

  const validItems: PracticeQuestionItem[] = [];
  const seenQuestions = new Set<string>();

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i] as Record<string, unknown>;
    if (!item || typeof item !== 'object') continue;

    const questionText = typeof item.question === 'string' ? item.question.trim() : '';
    const answerText = typeof item.answer === 'string' ? item.answer.trim() : '';
    const explanationText = typeof item.explanation === 'string' ? item.explanation.trim() : '';
    const topicText = typeof item.topic === 'string' ? item.topic.trim() : undefined;
    const sourceFile = typeof item.sourceFile === 'string' ? item.sourceFile.trim() : defaultSourceFile;
    const pageRef = typeof item.pageRef === 'string' ? item.pageRef.trim() : undefined;

    // Minimum viability check
    if (questionText.length < 5 || answerText.length < 2) {
      continue;
    }

    // Deduplication check
    const normalized = questionText.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenQuestions.has(normalized)) {
      continue;
    }
    seenQuestions.add(normalized);

    validItems.push({
      id: `pq-${Date.now()}-${i}`,
      subjectId,
      moduleId,
      question: questionText,
      answer: answerText,
      explanation: explanationText || 'Based on source lecture material.',
      topic: topicText,
      difficulty: (item.difficulty as 'easy' | 'medium' | 'hard') || defaultDifficulty,
      sourceFile,
      pageRef,
    });
  }

  if (validItems.length === 0) {
    throw new Error('Model failed to generate any valid questions. Please try regenerating.');
  }

  return validItems;
};

/**
 * Generate Practice Questions from study materials using local Ollama.
 */
export const generatePracticeQuestions = async (
  options: GeneratePracticeQuestionsOptions
): Promise<PracticeQuestionsResult> => {
  const {
    materials,
    subjectId,
    subjectName,
    moduleId,
    moduleName,
    count = 5,
    difficulty = 'medium',
    model: requestedModel,
    customBaseUrl,
    abortSignal,
    onProgress,
  } = options;

  const startTime = performance.now();
  const scopeTitle = moduleName ? `${subjectName} - ${moduleName}` : subjectName;
  const activeModel = requestedModel || getSelectedModel() || 'llama3.2:3b';

  // 1. Extract text from selected materials
  const extraction = await extractStudyMaterialsText(materials, {
    scopeTitle,
    abortSignal,
    onProgress: (p) => {
      onProgress?.({
        stage: p.stage as PracticeQuestionsProgress['stage'],
        currentFile: p.currentFile,
        message: p.message,
        percent: p.percent,
      });
    },
  });

  const { sources, combinedRawText, totalCharacters, hasOcr } = extraction;

  onProgress?.({
    stage: 'generating_questions',
    message: `Generating ${count} ${difficulty} practice questions with local Ollama (${activeModel})...`,
    percent: 65,
  });

  // Safe excerpt limit to prevent context exhaustion
  const maxChars = 14000;
  const sourceContext =
    combinedRawText.length > maxChars
      ? combinedRawText.substring(0, maxChars) + '\n\n...[content truncated for question generation context budget]...'
      : combinedRawText;

  const systemInstruction = `You are an expert university professor and exam designer. Your task is to generate challenging, high-quality practice questions based strictly on the provided study material.

CRITICAL INSTRUCTIONS:
1. Grounding: All questions, answers, and explanations MUST be directly derived from the provided text. Never invent course concepts, formulas, or facts.
2. Difficulty Level: Generate strictly ${difficulty.toUpperCase()} difficulty questions.
   - Easy: Direct recall of key definitions, core concepts, and main components.
   - Medium: Conceptual understanding, functional comparisons, and mechanism explanations.
   - Hard: Problem solving, analytical breakdown, scenario analysis, and trade-off evaluation.
3. Quantity: Exactly ${count} questions.
4. Output Format: Return a STRICT JSON ARRAY of objects. Do not write any preamble, intro, or concluding remarks. Output only the JSON array:
[
  {
    "question": "Question text here",
    "answer": "Concise, complete, accurate answer here",
    "explanation": "Detailed pedagogical explanation referencing why this answer is correct",
    "topic": "Specific topic name",
    "difficulty": "${difficulty}",
    "sourceFile": "${sources[0]?.fileName || 'Study Document'}",
    "pageRef": "Page reference if identifiable in text"
  }
]`;

  const userPrompt = `STUDY TOPIC: ${scopeTitle}
SOURCES: ${sources.map((s) => s.fileName).join(', ')}

STUDY MATERIAL:
${sourceContext}

Generate exactly ${count} ${difficulty} practice questions in valid JSON array format.`;

  const completion = await generateCompletion({
    model: activeModel,
    prompt: userPrompt,
    system: systemInstruction,
    temperature: 0.3,
    abortSignal,
    customBaseUrl,
  });

  // 3. Parse and Validate Output
  let rawItems: unknown[];
  try {
    rawItems = cleanAndParseJson<unknown[]>(completion.text);
  } catch {
    // Retry once with a stricter formatting directive if initial output was malformed
    const repairPrompt = `The previous response was not valid JSON. Fix and format the questions into a pure, valid JSON array:\n\n${completion.text.substring(0, 3000)}`;
    const retryRes = await generateCompletion({
      model: activeModel,
      prompt: repairPrompt,
      system: 'Output ONLY a valid JSON array. No markdown, no conversational text.',
      temperature: 0.1,
      abortSignal,
      customBaseUrl,
    });
    rawItems = cleanAndParseJson<unknown[]>(retryRes.text);
  }

  const validatedQuestions = validatePracticeQuestions(
    rawItems,
    subjectId,
    moduleId,
    difficulty,
    sources[0]?.fileName
  );

  const durationMs = Math.round(performance.now() - startTime);

  onProgress?.({
    stage: 'completed',
    message: `Generated ${validatedQuestions.length} practice questions!`,
    percent: 100,
  });

  return {
    subjectId,
    subjectName,
    moduleId,
    moduleName,
    questions: validatedQuestions,
    difficulty,
    sources,
    totalSourceCharacters: totalCharacters,
    modelUsed: activeModel,
    durationMs,
    hasOcr,
    generatedAt: new Date().toISOString(),
  };
};
