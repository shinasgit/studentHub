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
  count?: number; // default: 10 (supports 10, 20, 30)
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
  defaultSourceFile?: string,
  existingPrompts: Set<string> = new Set()
): PracticeQuestionItem[] => {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  const validItems: PracticeQuestionItem[] = [];
  const seenQuestions = new Set<string>(existingPrompts);

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
      id: `pq-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
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

  return validItems;
};

/**
 * Generate Practice Questions from study materials using local Ollama.
 * Supports reliable generation of 10, 20, or 30 questions via batched inference.
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
    count = 10,
    difficulty = 'medium',
    model: requestedModel,
    customBaseUrl,
    abortSignal,
    onProgress,
  } = options;

  const targetCount = count; // 10, 20, or 30
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
        percent: Math.min(25, p.percent),
      });
    },
  });

  const { sources, combinedRawText, totalCharacters, hasOcr } = extraction;

  // Safe excerpt limit to prevent context exhaustion
  const maxChars = 14000;
  const sourceContext =
    combinedRawText.length > maxChars
      ? combinedRawText.substring(0, maxChars) + '\n\n...[content truncated for question generation context budget]...'
      : combinedRawText;

  // 2. Batched generation loop to reliably generate 10, 20, or 30 questions
  const accumulatedQuestions: PracticeQuestionItem[] = [];
  const seenPrompts = new Set<string>();
  const batchTarget = 10;
  const maxAttempts = Math.ceil(targetCount / 8) + 2;
  let attempt = 0;

  while (accumulatedQuestions.length < targetCount && attempt < maxAttempts) {
    if (abortSignal?.aborted) {
      throw new Error('Question generation was cancelled.');
    }
    attempt++;

    const needed = targetCount - accumulatedQuestions.length;
    const currentBatchSize = Math.min(batchTarget, needed);
    const progressPercent = Math.min(95, 25 + Math.round((accumulatedQuestions.length / targetCount) * 70));

    onProgress?.({
      stage: 'generating_questions',
      message: `Generating practice questions (${accumulatedQuestions.length}/${targetCount}) with local Ollama (${activeModel})...`,
      percent: progressPercent,
    });

    const avoidanceInstruction =
      accumulatedQuestions.length > 0
        ? `\nAlready generated questions to avoid duplicating:\n${accumulatedQuestions.map((q, idx) => `${idx + 1}. ${q.question}`).slice(-8).join('\n')}\nGenerate NEW, distinct questions covering other aspects of the study material.`
        : '';

    const systemInstruction = `You are an expert university professor and exam designer. Your task is to generate challenging, high-quality practice questions based strictly on the provided study material.

CRITICAL INSTRUCTIONS:
1. Grounding: All questions, answers, and explanations MUST be directly derived from the provided text. Never invent course concepts, formulas, or facts.
2. Difficulty Level: Generate strictly ${difficulty.toUpperCase()} difficulty questions.
   - Easy: Direct recall of key definitions, core concepts, and main components.
   - Medium: Conceptual understanding, functional comparisons, and mechanism explanations.
   - Hard: Problem solving, analytical breakdown, scenario analysis, and trade-off evaluation.
3. Quantity: Exactly ${currentBatchSize} questions.
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
${avoidanceInstruction}

Generate exactly ${currentBatchSize} ${difficulty} practice questions in valid JSON array format.`;

    try {
      const completion = await generateCompletion({
        model: activeModel,
        prompt: userPrompt,
        system: systemInstruction,
        temperature: 0.35,
        abortSignal,
        customBaseUrl,
      });

      let rawItems: unknown[] = [];
      try {
        rawItems = cleanAndParseJson<unknown[]>(completion.text);
      } catch {
        // Attempt quick repair if json fence had syntax glitch
        const repairPrompt = `Format the following practice questions into a pure, valid JSON array. Do not write anything else:\n\n${completion.text.substring(0, 3000)}`;
        const retryRes = await generateCompletion({
          model: activeModel,
          prompt: repairPrompt,
          system: 'Output ONLY a valid JSON array of question objects.',
          temperature: 0.1,
          abortSignal,
          customBaseUrl,
        });
        rawItems = cleanAndParseJson<unknown[]>(retryRes.text);
      }

      if (Array.isArray(rawItems)) {
        const batchValid = validatePracticeQuestions(
          rawItems,
          subjectId,
          moduleId,
          difficulty,
          sources[0]?.fileName,
          seenPrompts
        );

        for (const q of batchValid) {
          accumulatedQuestions.push(q);
          const norm = q.question.toLowerCase().replace(/[^a-z0-9]/g, '');
          seenPrompts.add(norm);
          if (accumulatedQuestions.length >= targetCount) break;
        }
      }
    } catch {
      // Continue next attempt if one batch encountered an error
    }
  }

  if (accumulatedQuestions.length === 0) {
    throw new Error('Model failed to generate any valid practice questions. Please ensure Ollama is running and try again.');
  }

  const finalQuestions = accumulatedQuestions.slice(0, targetCount);
  const durationMs = Math.round(performance.now() - startTime);

  onProgress?.({
    stage: 'completed',
    message: `Generated ${finalQuestions.length} practice questions!`,
    percent: 100,
  });

  return {
    subjectId,
    subjectName,
    moduleId,
    moduleName,
    questions: finalQuestions,
    difficulty,
    sources,
    totalSourceCharacters: totalCharacters,
    modelUsed: activeModel,
    durationMs,
    hasOcr,
    generatedAt: new Date().toISOString(),
  };
};
