// Conversation Memory Service for AI Student Hub
// Stage 11.2 & Stage 11.3: Short-Term Memory Budgeting & Long-Term Ollama Summarization
// Connects to local Llama 3.2 3B via Ollama for zero-cost, private conversation intelligence
// 100% Free, Local Privacy, Strict Student Isolation

import { generateCompletion, getSelectedModel } from './ollamaService';
import type { ChatMessage, ConversationSummary, ConversationMemoryContext } from '../types/chat';

export const DEFAULT_MEMORY_MODEL = 'llama3.2:3b';
export const DEFAULT_SHORT_TERM_TURNS = 3; // 3 exchanges = 6 messages (3 user + 3 assistant)
export const DEFAULT_SHORT_TERM_MAX_CHARS = 2200;
export const MAX_ASSISTANT_MEMORY_CHARS = 350;
export const SUMMARY_TRIGGER_MESSAGE_INTERVAL = 4; // Trigger every 4 messages

export interface MemoryBudgetOptions {
  maxTurns?: number;
  maxChars?: number;
  maxAssistantChars?: number;
}

export interface SummarizationOptions {
  model?: string;
  customBaseUrl?: string;
  abortSignal?: AbortSignal;
}

export interface BudgetedShortTermResult {
  budgetedMessages: ChatMessage[];
  totalChars: number;
  droppedCount: number;
}

/**
 * 11.2 Short-Term Memory:
 * Extracts and budgets the most recent conversation turns within tight token/character boundaries.
 * Truncates lengthy assistant responses to preserve context window space for verified textbook PDF excerpts.
 */
export const budgetShortTermMemory = (
  messages: ChatMessage[],
  options?: MemoryBudgetOptions
): BudgetedShortTermResult => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { budgetedMessages: [], totalChars: 0, droppedCount: 0 };
  }

  const maxTurns = options?.maxTurns ?? DEFAULT_SHORT_TERM_TURNS;
  const maxChars = options?.maxChars ?? DEFAULT_SHORT_TERM_MAX_CHARS;
  const maxAssistantChars = options?.maxAssistantChars ?? MAX_ASSISTANT_MEMORY_CHARS;

  // Filter to valid user and assistant dialogue turns with non-empty content
  const validMessages = messages.filter((m) => {
    const role = m.role || m.sender;
    return (
      (role === 'user' || role === 'assistant') &&
      !m.isError &&
      typeof m.content === 'string' &&
      m.content.trim().length > 0
    );
  });

  if (validMessages.length === 0) {
    return { budgetedMessages: [], totalChars: 0, droppedCount: 0 };
  }

  // Take the most recent turns (up to maxTurns * 2 messages)
  const maxMessages = Math.max(2, maxTurns * 2);
  const candidateSlice = validMessages.slice(-maxMessages);
  const droppedCount = validMessages.length - candidateSlice.length;

  // Work backwards from most recent to oldest, ensuring total length <= maxChars
  const budgeted: ChatMessage[] = [];
  let currentChars = 0;

  for (let i = candidateSlice.length - 1; i >= 0; i--) {
    const orig = candidateSlice[i];
    const isUser = (orig.role || orig.sender) === 'user';
    let text = orig.content.trim();

    // Truncate assistant turns that exceed limit
    if (!isUser && text.length > maxAssistantChars) {
      text = text.slice(0, maxAssistantChars).trim() + '...';
    }

    const itemChars = text.length + 30; // buffer for role + wrapper
    if (budgeted.length > 0 && currentChars + itemChars > maxChars) {
      // Reached budget limit
      break;
    }

    currentChars += itemChars;
    budgeted.unshift({
      ...orig,
      content: text,
    });
  }

  return {
    budgetedMessages: budgeted,
    totalChars: currentChars,
    droppedCount: droppedCount + (candidateSlice.length - budgeted.length),
  };
};

/**
 * Builds a structured, prompt-ready memory context block combining short-term turns and long-term summary.
 */
export const buildMemoryContextPrompt = (
  shortTermMessages: ChatMessage[],
  longTermSummary?: string,
  topics?: string[],
  unresolvedQuestions?: string[]
): ConversationMemoryContext => {
  const parts: string[] = [];

  // 1. Long-Term Memory Summary Section
  if (longTermSummary && longTermSummary.trim().length > 0) {
    parts.push(`### LONG-TERM CONVERSATION MEMORY (Prior topics and concepts discussed in this study session):`);
    if (Array.isArray(topics) && topics.length > 0) {
      parts.push(`- Key Topics: ${topics.join(', ')}`);
    }
    parts.push(`- Session Summary: ${longTermSummary.trim()}`);
    if (Array.isArray(unresolvedQuestions) && unresolvedQuestions.length > 0) {
      parts.push(`- Unresolved Questions / Follow-ups: ${unresolvedQuestions.join('; ')}`);
    }
    parts.push('');
  }

  // 2. Recent Short-Term Turns Section
  if (shortTermMessages.length > 0) {
    parts.push(`### RECENT DIALOGUE TURNS (Immediate conversation context):`);
    for (const msg of shortTermMessages) {
      const isUser = (msg.role || msg.sender) === 'user';
      parts.push(`${isUser ? 'Student' : 'Tutor'}: ${msg.content.trim()}`);
    }
    parts.push('');
  }

  return {
    shortTermTurns: shortTermMessages,
    longTermSummary: longTermSummary?.trim() || undefined,
    topics: topics || [],
    unresolvedQuestions: unresolvedQuestions || [],
    formattedContextPrompt: parts.join('\n').trim(),
  };
};

/**
 * Evaluates whether an active conversation should trigger an incremental long-term memory summarization.
 */
export const shouldTriggerSummarization = (
  messages: ChatMessage[],
  lastSummarizedIndex: number = 0,
  interval: number = SUMMARY_TRIGGER_MESSAGE_INTERVAL
): boolean => {
  if (!Array.isArray(messages)) return false;

  const validDialogueCount = messages.filter((m) => {
    const role = m.role || m.sender;
    return (role === 'user' || role === 'assistant') && !m.isError;
  }).length;

  return validDialogueCount - lastSummarizedIndex >= interval;
};

/**
 * Prompt template for Ollama to generate structured conversation summary.
 */
const MEMORY_SUMMARIZATION_SYSTEM_PROMPT = `You are an expert academic memory assistant for a university student study session.
Analyze the conversation dialogue between a Student and a Tutor.
Synthesize a concise, fact-based memory summary without inventing student knowledge or preferences.

OUTPUT STRICTLY VALID JSON MATCHING THIS EXACT SCHEMA:
{
  "summaryText": "Concise 2-3 sentence overview of academic topics explored and questions answered.",
  "topics": ["Array", "of", "3-5", "Specific", "Course", "Topics"],
  "conceptsExplained": ["Key concepts or formulas tutor explained"],
  "unresolvedQuestions": ["Any pending follow-up questions or student confusions"]
}

Do not include any conversational filler, markdown formatting, or text outside the JSON object.`;

/**
 * 11.3 Long-Term Conversation Memory:
 * Summarizes the conversation using local Llama 3.2 3B via Ollama.
 * Updates existing summary incrementally to avoid duplicate memories.
 */
export const summarizeConversationMemory = async (
  messages: ChatMessage[],
  existingSummary?: string,
  options?: SummarizationOptions
): Promise<ConversationSummary> => {
  const model = options?.model || getSelectedModel() || DEFAULT_MEMORY_MODEL;
  const now = new Date().toISOString();

  const validMessages = messages.filter((m) => {
    const role = m.role || m.sender;
    return (role === 'user' || role === 'assistant') && !m.isError && m.content.trim().length > 0;
  });

  if (validMessages.length === 0) {
    return {
      summaryText: existingSummary || '',
      topics: [],
      conceptsExplained: [],
      unresolvedQuestions: [],
      lastMessageCount: 0,
      updatedAt: now,
    };
  }

  // Format the dialogue for summarization (recent 12 messages maximum)
  const dialogueSlice = validMessages.slice(-12);
  const dialogueText = dialogueSlice
    .map((m) => `${(m.role || m.sender) === 'user' ? 'Student' : 'Tutor'}: ${m.content.trim()}`)
    .join('\n\n');

  const priorSummaryContext = existingSummary && existingSummary.trim().length > 0
    ? `PREVIOUS SUMMARY TO UPDATE INCREMENTALLY:\n${existingSummary.trim()}\n\n`
    : '';

  const userPrompt = `${priorSummaryContext}NEW CONVERSATION TURNS TO SUMMARIZE:\n${dialogueText}\n\nGenerate the JSON memory summary:`;

  try {
    const result = await generateCompletion({
      model,
      system: MEMORY_SUMMARIZATION_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.1, // Low temperature for deterministic factual extraction
      abortSignal: options?.abortSignal,
      customBaseUrl: options?.customBaseUrl,
    });

    const rawOutput = result.text.trim();

    // Parse JSON output from model with resilient extractors
    let parsed: any = null;
    try {
      // 1. Direct JSON parse
      parsed = JSON.parse(rawOutput);
    } catch {
      // 2. Extract JSON from markdown block ```json ... ```
      const match = rawOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (match && match[1]) {
        try {
          parsed = JSON.parse(match[1]);
        } catch {
          // fall through
        }
      }
    }

    if (!parsed) {
      // 3. Fallback: extract object using outer braces
      const firstBrace = rawOutput.indexOf('{');
      const lastBrace = rawOutput.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsed = JSON.parse(rawOutput.slice(firstBrace, lastBrace + 1));
        } catch {
          // fall through
        }
      }
    }

    if (parsed && typeof parsed === 'object') {
      const summaryText = typeof parsed.summaryText === 'string' && parsed.summaryText.trim().length > 0
        ? parsed.summaryText.trim()
        : (existingSummary || 'Academic study session on course material.');

      const topics = Array.isArray(parsed.topics)
        ? parsed.topics.filter((t: unknown) => typeof t === 'string' && (t as string).trim().length > 0)
        : [];

      const conceptsExplained = Array.isArray(parsed.conceptsExplained)
        ? parsed.conceptsExplained.filter((c: unknown) => typeof c === 'string' && (c as string).trim().length > 0)
        : [];

      const unresolvedQuestions = Array.isArray(parsed.unresolvedQuestions)
        ? parsed.unresolvedQuestions.filter((q: unknown) => typeof q === 'string' && (q as string).trim().length > 0)
        : [];

      return {
        summaryText,
        topics,
        conceptsExplained,
        unresolvedQuestions,
        lastMessageCount: validMessages.length,
        updatedAt: now,
      };
    }

    // Heuristic fallback if LLM returned freeform text
    const cleanFallback = rawOutput.replace(/```/g, '').slice(0, 300).trim();
    return {
      summaryText: cleanFallback || (existingSummary || 'Discussion on course concepts.'),
      topics: [],
      conceptsExplained: [],
      unresolvedQuestions: [],
      lastMessageCount: validMessages.length,
      updatedAt: now,
    };
  } catch (err) {
    console.warn('Long-term memory summarization warning (non-fatal):', err);
    return {
      summaryText: existingSummary || '',
      topics: [],
      conceptsExplained: [],
      unresolvedQuestions: [],
      lastMessageCount: validMessages.length,
      updatedAt: now,
    };
  }
};

/**
 * 11.5 Title Generation:
 * Automatically generates a concise 3-5 word academic conversation title based on initial question.
 */
export const generateConversationTitle = async (
  firstUserMessage: string,
  subjectName?: string,
  options?: SummarizationOptions
): Promise<string> => {
  const cleanQuery = (firstUserMessage || '').trim();
  if (!cleanQuery) {
    return subjectName ? `${subjectName} Study Session` : 'New Study Session';
  }

  // Fast heuristic: if short question (<= 4 words), title is capitalized question
  const words = cleanQuery.split(/\s+/).filter(Boolean);
  if (words.length <= 4) {
    return cleanQuery.slice(0, 40).replace(/[?.]+$/, '');
  }

  const model = options?.model || getSelectedModel() || DEFAULT_MEMORY_MODEL;
  const prompt = `Generate a concise 3 to 5 word title for a study conversation that begins with:
"${cleanQuery}"

STRICT RULES:
- Output ONLY the 3 to 5 words title.
- Do NOT use quotation marks, punctuation, or conversational words like "Title:" or "Here is".`;

  try {
    const res = await generateCompletion({
      model,
      prompt,
      temperature: 0.2,
      abortSignal: options?.abortSignal,
      customBaseUrl: options?.customBaseUrl,
    });

    const raw = res.text
      .replace(/["'`]/g, '')
      .replace(/^title:\s*/i, '')
      .replace(/[.?]+$/, '')
      .trim();

    if (raw && raw.length > 3 && raw.length < 50) {
      return raw;
    }
  } catch {
    // Fall back to clean substring
  }

  // Intelligent fallback: first 5 words or 35 characters
  const fallback = words.slice(0, 5).join(' ');
  return subjectName ? `${subjectName}: ${fallback}` : fallback;
};
