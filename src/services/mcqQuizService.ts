// MCQ Quiz Generation Service for AI Student Hub
// Generates validated 4-option multiple-choice quizzes using Ollama Llama 3.2 (3B)
// 100% Local Inference, Zero Paid APIs, Strict Answer Key & Option Validation
// Enforces exactly 10 questions and distinct cognitive difficulty levels

import { extractStudyMaterialsText, type ExtractedSourceInfo } from './studyExtractionPipeline';
import { generateCompletion, getSelectedModel } from './ollamaService';
import { cleanAndParseJson } from './practiceQuestionsService';
import type { McqQuestionItem, StudyMaterial } from '../types/studyTools';

export interface McqQuizProgress {
  stage:
    | 'idle'
    | 'resolving_files'
    | 'extracting_pdf'
    | 'extracting_web'
    | 'generating_quiz'
    | 'repairing_quiz'
    | 'completed'
    | 'cancelled'
    | 'error';
  currentFile?: string;
  message: string;
  percent: number;
}

export interface McqQuizResult {
  subjectId: string;
  subjectName: string;
  moduleId?: string | null;
  moduleName?: string;
  questions: McqQuestionItem[];
  difficulty: 'easy' | 'medium' | 'hard';
  sources: ExtractedSourceInfo[];
  totalSourceCharacters: number;
  modelUsed: string;
  durationMs: number;
  hasOcr: boolean;
  generatedAt: string;
}

export interface GenerateMcqQuizOptions {
  materials: StudyMaterial[];
  subjectId: string;
  subjectName: string;
  moduleId?: string | null;
  moduleName?: string;
  count?: number; // strictly 10 per specification
  difficulty?: 'easy' | 'medium' | 'hard'; // default: 'medium'
  model?: string;
  customBaseUrl?: string;
  abortSignal?: AbortSignal;
  onProgress?: (progress: McqQuizProgress) => void;
}

interface RawMcqOption {
  id?: string;
  text?: string;
  label?: string;
}

interface RawMcqItem {
  question?: string;
  options?: RawMcqOption[] | string[] | Record<string, string>;
  correctOptionId?: string;
  correctAnswer?: string;
  answer?: string;
  explanation?: string;
  topic?: string;
  difficulty?: string;
  sourceFile?: string;
  pageRef?: string;
}

/**
 * Detailed cognitive instructions for each difficulty tier to guide the LLM
 */
export const DIFFICULTY_INSTRUCTIONS: Record<'easy' | 'medium' | 'hard', string> = {
  easy: `DIFFICULTY LEVEL: EASY (Factual Recall & Basic Definitions)
- Questions must focus on straightforward definitions, terminology, and explicit facts stated directly in the text.
- Phrasing should be direct and clear (e.g., "What is defined as...", "Which of the following is...").
- Distractor options should be clear concepts from the subject, but obviously distinct from the correct definition.`,

  medium: `DIFFICULTY LEVEL: MEDIUM (Conceptual Understanding & Application)
- Questions must test how concepts work, identifying relationships, and applying rules or mechanisms to examples.
- Phrasing should require reasoning (e.g., "Why does...", "How does concept A interact with B...", "In this scenario, which applies...").
- Distractors must be plausible alternatives mentioned in the text that represent common student misconceptions.`,

  hard: `DIFFICULTY LEVEL: HARD (Deep Analysis & Multi-Step Reasoning)
- Questions must test subtle distinctions, edge cases, trade-offs, and multi-step analytical conclusions based strictly on the text.
- Phrasing should require evaluation (e.g., "Which statement best contrasts...", "What is the critical trade-off when...", "Under what conditions would...").
- Distractors must be sophisticated and closely related concepts that only a student with thorough mastery can distinguish from the correct answer.`,
};

/**
 * Validate and sanitize generated multiple-choice quiz questions.
 * Rejects questions with missing options, duplicate options, or invalid answer keys.
 */
export const validateMcqQuestions = (
  rawItems: unknown[],
  subjectId: string,
  moduleId?: string | null,
  defaultDifficulty: 'easy' | 'medium' | 'hard' = 'medium',
  defaultSourceFile?: string,
  existingPrompts: Set<string> = new Set(),
  maxCount: number = 10
): McqQuestionItem[] => {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  const validQuestions: McqQuestionItem[] = [];
  const seenQuestions = new Set<string>(existingPrompts);

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i] as RawMcqItem;
    if (!raw || typeof raw !== 'object') continue;

    const questionText = typeof raw.question === 'string' ? raw.question.trim() : '';
    if (questionText.length < 8) continue;

    // Deduplication check
    const normalizedQ = questionText.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenQuestions.has(normalizedQ)) continue;

    // Normalize options into exactly 4 valid choices
    const standardOptionIds = ['opt-a', 'opt-b', 'opt-c', 'opt-d'];
    const parsedOptions: Array<{ id: string; text: string }> = [];

    if (Array.isArray(raw.options)) {
      for (let o = 0; o < raw.options.length; o++) {
        const opt = raw.options[o];
        let optText = '';
        if (typeof opt === 'string') {
          optText = opt.trim();
        } else if (opt && typeof opt === 'object') {
          optText = String(opt.text || opt.label || '').trim();
        }

        // Clean out leading letters like "A) " or "1. " if present
        optText = optText.replace(/^[A-Da-d1-4][).:\s-]+/, '').trim();

        if (optText.length > 0 && o < 4) {
          parsedOptions.push({
            id: standardOptionIds[o],
            text: optText,
          });
        }
      }
    } else if (raw.options && typeof raw.options === 'object') {
      const keys = ['a', 'b', 'c', 'd'];
      const optMap = raw.options as Record<string, string>;
      for (let o = 0; o < keys.length; o++) {
        const k = keys[o];
        const val = optMap[k] || optMap[k.toUpperCase()] || '';
        const cleaned = String(val).replace(/^[A-Da-d1-4][).:\s-]+/, '').trim();
        if (cleaned.length > 0) {
          parsedOptions.push({
            id: standardOptionIds[o],
            text: cleaned,
          });
        }
      }
    }

    // Must have exactly 4 distinct options
    if (parsedOptions.length !== 4) continue;

    // Check for duplicate options
    const optionTexts = new Set(parsedOptions.map((o) => o.text.toLowerCase()));
    if (optionTexts.size !== 4) continue;

    // Normalize correct option ID
    let correctId = '';
    const rawKey = String(raw.correctOptionId || raw.correctAnswer || raw.answer || '').trim().toLowerCase();

    if (rawKey === 'opt-a' || rawKey === 'a' || rawKey === '0' || rawKey.startsWith('option a')) {
      correctId = 'opt-a';
    } else if (rawKey === 'opt-b' || rawKey === 'b' || rawKey === '1' || rawKey.startsWith('option b')) {
      correctId = 'opt-b';
    } else if (rawKey === 'opt-c' || rawKey === 'c' || rawKey === '2' || rawKey.startsWith('option c')) {
      correctId = 'opt-c';
    } else if (rawKey === 'opt-d' || rawKey === 'd' || rawKey === '3' || rawKey.startsWith('option d')) {
      correctId = 'opt-d';
    } else {
      // If model returned the option text as the correct answer
      const matchIndex = parsedOptions.findIndex(
        (o) => o.text.toLowerCase() === rawKey.toLowerCase()
      );
      if (matchIndex !== -1) {
        correctId = standardOptionIds[matchIndex];
      }
    }

    // Must have verified match in options
    if (!correctId || !parsedOptions.some((o) => o.id === correctId)) {
      continue;
    }

    seenQuestions.add(normalizedQ);

    validQuestions.push({
      id: `mcq-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      subjectId,
      moduleId,
      question: questionText,
      options: parsedOptions,
      correctOptionId: correctId,
      explanation: typeof raw.explanation === 'string' && raw.explanation.trim().length > 0
        ? raw.explanation.trim()
        : `Option ${correctId.replace('opt-', '').toUpperCase()} is correct based on the study materials.`,
      topic: typeof raw.topic === 'string' ? raw.topic.trim() : undefined,
      difficulty: defaultDifficulty,
      sourceFile: typeof raw.sourceFile === 'string' ? raw.sourceFile.trim() : defaultSourceFile,
      pageRef: typeof raw.pageRef === 'string' ? raw.pageRef.trim() : undefined,
    });

    if (validQuestions.length >= maxCount) {
      break;
    }
  }

  return validQuestions.slice(0, maxCount);
};

/**
 * Generate an MCQ Quiz from study materials using local Ollama.
 * Strictly generates and returns exactly 10 validated questions.
 */
export const generateMcqQuiz = async (
  options: GenerateMcqQuizOptions
): Promise<McqQuizResult> => {
  const {
    materials,
    subjectId,
    subjectName,
    moduleId,
    moduleName,
    count: _count = 10, // Strictly 10 questions
    difficulty = 'medium',
    model: requestedModel,
    customBaseUrl,
    abortSignal,
    onProgress,
  } = options;

  const targetCount = 10; // Enforce exactly 10 questions per project requirement
  const startTime = performance.now();
  const scopeTitle = moduleName ? `${subjectName} - ${moduleName}` : subjectName;
  const activeModel = requestedModel || getSelectedModel() || 'llama3.2:3b';

  // 1. Extract text from selected materials (PDFs, Web Articles, YouTube Transcripts)
  onProgress?.({
    stage: 'resolving_files',
    message: 'Extracting study materials (PDFs, Web, and Transcripts)...',
    percent: 10,
  });

  const extraction = await extractStudyMaterialsText(materials, {
    scopeTitle,
    abortSignal,
    onProgress: (p) => {
      onProgress?.({
        stage: p.stage as McqQuizProgress['stage'],
        currentFile: p.currentFile,
        message: p.message,
        percent: Math.min(50, Math.round(p.percent * 0.5)),
      });
    },
  });

  const { sources, combinedRawText, totalCharacters, hasOcr } = extraction;

  onProgress?.({
    stage: 'generating_quiz',
    message: `Synthesizing exactly ${targetCount} ${difficulty.toUpperCase()} questions with ${activeModel}...`,
    percent: 55,
  });

  const maxChars = 14000;
  const sourceContext =
    combinedRawText.length > maxChars
      ? combinedRawText.substring(0, maxChars) + '\n\n...[content truncated for question context budget]...'
      : combinedRawText;

  const difficultyInstruction = DIFFICULTY_INSTRUCTIONS[difficulty] || DIFFICULTY_INSTRUCTIONS.medium;

  const systemInstruction = `You are an expert academic examiner. Your task is to generate high-quality 4-option multiple-choice quiz questions based strictly on the provided study material.

CRITICAL RULES:
1. QUANTITY: You MUST generate EXACTLY ${targetCount} distinct questions.
2. GROUNDING: All questions, answer options, and explanations MUST be directly supported by the text. Never invent facts.
3. STRUCTURE: Every question MUST have exactly FOUR options (opt-a, opt-b, opt-c, opt-d). Exactly ONE option must be correct.
4. ${difficultyInstruction}
5. OUTPUT FORMAT: Return a valid JSON array of objects. No intro text, no conversational text, no markdown outside the JSON:
[
  {
    "question": "Question text here?",
    "options": [
      { "id": "opt-a", "text": "First option" },
      { "id": "opt-b", "text": "Second option" },
      { "id": "opt-c", "text": "Third option" },
      { "id": "opt-d", "text": "Fourth option" }
    ],
    "correctOptionId": "opt-a",
    "explanation": "Why this option is correct based on the text.",
    "topic": "Topic Name",
    "sourceFile": "${sources[0]?.title || sources[0]?.fileName || 'Study Material'}"
  }
]`;

  const userPrompt = `STUDY SCOPE: ${scopeTitle}
SOURCES: ${sources.map((s) => s.title || s.fileName).join(', ')}

STUDY MATERIAL:
${sourceContext}

Generate EXACTLY ${targetCount} ${difficulty.toUpperCase()} multiple-choice questions in a valid JSON array.`;

  const completion = await generateCompletion({
    model: activeModel,
    prompt: userPrompt,
    system: systemInstruction,
    temperature: 0.3,
    abortSignal,
    customBaseUrl,
  });

  let rawItems: unknown[] = [];
  try {
    rawItems = cleanAndParseJson<unknown[]>(completion.text);
  } catch {
    // Retry once with a repair directive if parsing failed
    onProgress?.({
      stage: 'generating_quiz',
      message: 'Repairing JSON formatting...',
      percent: 75,
    });

    const repairPrompt = `The previous output was not valid JSON. Convert the output into a pure JSON array containing ${targetCount} questions:\n\n${completion.text.substring(0, 3500)}`;
    const retryRes = await generateCompletion({
      model: activeModel,
      prompt: repairPrompt,
      system: 'Output ONLY a valid JSON array. No conversational text, no markdown.',
      temperature: 0.1,
      abortSignal,
      customBaseUrl,
    });
    try {
      rawItems = cleanAndParseJson<unknown[]>(retryRes.text);
    } catch {
      rawItems = [];
    }
  }

  let accumulatedQuestions = validateMcqQuestions(
    rawItems,
    subjectId,
    moduleId,
    difficulty,
    sources[0]?.title || sources[0]?.fileName
  );

  // --- BOUNDED REPAIR TO GUARANTEE EXACTLY 10 QUESTIONS ---
  // If Ollama returned fewer than 10 valid questions, attempt one bounded follow-up generation for the deficit
  if (accumulatedQuestions.length < targetCount && !abortSignal?.aborted) {
    const missingCount = targetCount - accumulatedQuestions.length;
    onProgress?.({
      stage: 'repairing_quiz',
      message: `Refining quiz: generating ${missingCount} remaining question${missingCount > 1 ? 's' : ''} to reach ${targetCount}...`,
      percent: 85,
    });

    const existingPrompts = new Set(
      accumulatedQuestions.map((q) => q.question.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );

    const deficitPrompt = `You generated ${accumulatedQuestions.length} valid questions, but exactly ${targetCount} are required.
Generate exactly ${missingCount} additional ${difficulty.toUpperCase()} multiple-choice questions based on the text.
Do NOT duplicate any of these existing questions:
${accumulatedQuestions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}

Output ONLY a JSON array with ${missingCount} new questions.`;

    try {
      const deficitCompletion = await generateCompletion({
        model: activeModel,
        prompt: deficitPrompt,
        system: systemInstruction,
        temperature: 0.35,
        abortSignal,
        customBaseUrl,
      });

      const deficitRaw = cleanAndParseJson<unknown[]>(deficitCompletion.text);
      const additionalValid = validateMcqQuestions(
        deficitRaw,
        subjectId,
        moduleId,
        difficulty,
        sources[0]?.title || sources[0]?.fileName,
        existingPrompts
      );

      accumulatedQuestions = [...accumulatedQuestions, ...additionalValid];
    } catch {
      // Continue to final validation check
    }
  }

  // Strict check: Must have at least 10 valid questions
  if (accumulatedQuestions.length < targetCount) {
    throw new Error(
      `Ollama generated ${accumulatedQuestions.length} of the required ${targetCount} questions. ` +
      `Please retry generation with more source materials or adjust difficulty.`
    );
  }

  // Keep EXACTLY the first 10 valid questions to prevent 11, 12, or 13 questions
  const exactlyTenQuestions = accumulatedQuestions.slice(0, targetCount);

  // Guarantee difficulty tag on all 10 questions
  exactlyTenQuestions.forEach((q) => {
    q.difficulty = difficulty;
  });

  const durationMs = Math.round(performance.now() - startTime);

  onProgress?.({
    stage: 'completed',
    message: `Generated and validated exactly ${exactlyTenQuestions.length} ${difficulty.toUpperCase()} questions!`,
    percent: 100,
  });

  return {
    subjectId,
    subjectName,
    moduleId,
    moduleName,
    questions: exactlyTenQuestions,
    difficulty,
    sources,
    totalSourceCharacters: totalCharacters,
    modelUsed: activeModel,
    durationMs,
    hasOcr,
    generatedAt: new Date().toISOString(),
  };
};
