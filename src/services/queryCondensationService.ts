// Query Condensation Service for AI Student Hub RAG Pipeline
// Stage 8.3: Context-Aware Query Rewriting for Multi-Turn Academic Conversations
// 100% Free, Local Privacy, Offline Ollama (Llama 3.2 3B)

import { generateCompletion, getSelectedModel } from './ollamaService';
import type { RagConversationMessage } from '../types/rag';

export const DEFAULT_CONDENSATION_MODEL = 'llama3.2:3b';
export const DEFAULT_MAX_HISTORY_TURNS = 3; // 3 user + assistant pairs (up to 6 messages)
export const MAX_ASSISTANT_HISTORY_CHARS = 320;

export interface QueryCondensationOptions {
  model?: string;
  maxHistoryTurns?: number;
  customBaseUrl?: string;
  abortSignal?: AbortSignal;
}

export interface QueryCondensationResult {
  condensedQuestion: string;
  originalQuestion: string;
  wasCondensed: boolean;
  durationMs: number;
  error?: string;
}

/**
 * System prompt instructing Llama 3.2 3B to condense conversational follow-up questions
 * into standalone, unambiguous queries optimized for semantic vector retrieval.
 */
export const CONDENSATION_SYSTEM_PROMPT = `You are an expert query rewriting assistant for a university academic study assistant RAG system.
Your task is to reformulate a student's follow-up question into a single, self-contained standalone question suitable for semantic vector retrieval against course textbook PDFs.

STRICT REWRITING RULES:
1. Anaphora & Pronoun Resolution:
   - If the student's question refers to previous concepts using pronouns ("it", "its", "they", "their", "this", "these", "that") or elliptical phrases ("Why?", "Explain its advantages", "Give an example", "How does it work?"), replace the pronouns with the specific academic subject and topic from the conversation history.
2. Topic Shifts & Self-Contained Queries:
   - If the student's question is already completely self-contained, or if the student has shifted to an entirely new topic (e.g. from Networking to Databases), return the student's question verbatim without adding unrelated past concepts.
3. No Answers or Explanations:
   - Do NOT answer the question.
   - Do NOT provide conversational filler, preambles, or commentary (e.g., do NOT say "Here is the rewritten query:").
4. Output Format:
   - Output ONLY the single standalone rewritten question on one line.`;

/**
 * Formats recent conversation history turns into a compact dialogue block for the condensation prompt.
 * Truncates lengthy assistant explanations to keep the prompt focused and fast.
 */
export const formatConversationHistoryForCondensation = (
  history: RagConversationMessage[],
  maxTurns: number = DEFAULT_MAX_HISTORY_TURNS
): string => {
  if (!Array.isArray(history) || history.length === 0) {
    return '';
  }

  // Filter to valid user and assistant dialogue turns with non-empty content
  const validMessages = history.filter((m) => {
    const r = m.role || m.sender;
    return (
      (r === 'user' || r === 'assistant') &&
      typeof m.content === 'string' &&
      m.content.trim().length > 0
    );
  });

  if (validMessages.length === 0) {
    return '';
  }

  // Take the most recent turns (up to maxTurns * 2 messages)
  const maxMessages = Math.max(2, maxTurns * 2);
  const recentSlice = validMessages.slice(-maxMessages);

  return recentSlice
    .map((m) => {
      const isUser = (m.role || m.sender) === 'user';
      const role = isUser ? 'User' : 'Assistant';
      let content = m.content.trim().replace(/\r\n/g, '\n').replace(/\n+/g, ' ');

      // Truncate assistant messages to avoid token bloat
      if (!isUser && content.length > MAX_ASSISTANT_HISTORY_CHARS) {
        content = content.slice(0, MAX_ASSISTANT_HISTORY_CHARS).trim() + '...';
      }

      return `${role}: ${content}`;
    })
    .join('\n');
};

/**
 * Cleans the raw output returned by Llama 3.2 3B into a clean standalone question string.
 */
export const cleanCondensedQuestion = (
  rawOutput: string,
  fallbackQuestion: string
): string => {
  if (!rawOutput || typeof rawOutput !== 'string') {
    return fallbackQuestion;
  }

  let cleaned = rawOutput.trim();

  // Strip leading labels that LLMs occasionally output
  cleaned = cleaned
    .replace(/^(?:standalone\s*question|condensed\s*question|rewritten\s*question|search\s*query|query|question)\s*:\s*/i, '')
    .trim();

  // Strip markdown code fences if present
  cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  // Strip enclosing quotation marks
  cleaned = cleaned.replace(/^["'`]|["'`]$/g, '').trim();

  // If the model produced multiple lines, extract the first non-empty question line
  if (cleaned.includes('\n')) {
    const lines = cleaned
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Prefer a line ending with ? or the first non-empty line
    const questionLine = lines.find((l) => l.endsWith('?')) || lines[0] || '';
    cleaned = questionLine
      .replace(/^(?:standalone\s*question|condensed\s*question|rewritten\s*question|search\s*query|query|question)\s*:\s*/i, '')
      .replace(/^["'`]|["'`]$/g, '')
      .trim();
  }

  // Fallback to original question if output collapsed to empty or nonsense
  if (!cleaned || cleaned.length < 3) {
    return fallbackQuestion;
  }

  return cleaned;
};

/**
 * Condenses a user's follow-up question using recent conversation history.
 *
 * Rules:
 * 1. If history is empty, immediately returns original question without LLM call.
 * 2. If condensation fails (Ollama offline, timeout, malformed output), safely falls back to original question.
 * 3. Returns durationMs and wasCondensed flag for observability.
 */
export const condenseQuestion = async (
  question: string,
  history?: RagConversationMessage[],
  options?: QueryCondensationOptions
): Promise<QueryCondensationResult> => {
  const startTime = performance.now();
  const cleanQuestion = (question || '').trim();

  if (!cleanQuestion) {
    return {
      condensedQuestion: '',
      originalQuestion: '',
      wasCondensed: false,
      durationMs: 0,
    };
  }

  // 1. If history is absent or empty, no condensation needed
  const formattedHistory = formatConversationHistoryForCondensation(
    history || [],
    options?.maxHistoryTurns ?? DEFAULT_MAX_HISTORY_TURNS
  );

  if (!formattedHistory) {
    return {
      condensedQuestion: cleanQuestion,
      originalQuestion: cleanQuestion,
      wasCondensed: false,
      durationMs: 0,
    };
  }

  const model = options?.model || getSelectedModel() || DEFAULT_CONDENSATION_MODEL;

  // 2. Build condensation prompt
  const condensationPrompt = `${CONDENSATION_SYSTEM_PROMPT}

Chat History:
${formattedHistory}

Follow-up Question: ${cleanQuestion}
Standalone Question:`;

  try {
    const result = await generateCompletion({
      model,
      prompt: condensationPrompt,
      temperature: 0.1, // Low temperature for deterministic factual query rewriting
      abortSignal: options?.abortSignal,
      customBaseUrl: options?.customBaseUrl,
    });

    const durationMs = Math.round(performance.now() - startTime);
    const cleaned = cleanCondensedQuestion(result.text, cleanQuestion);
    const wasCondensed = cleaned.toLowerCase() !== cleanQuestion.toLowerCase();

    return {
      condensedQuestion: cleaned,
      originalQuestion: cleanQuestion,
      wasCondensed,
      durationMs,
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`Query condensation failed (${errMsg}), falling back to original question.`);

    return {
      condensedQuestion: cleanQuestion,
      originalQuestion: cleanQuestion,
      wasCondensed: false,
      durationMs,
      error: errMsg,
    };
  }
};
