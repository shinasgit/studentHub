// Chatbot Service Layer for AI Student Hub
// Connects the existing Chatbot UI to Local Ollama LLM (Llama 3.2 3B)
// 100% Free, Local Privacy, Zero Paid APIs
// Maintains study scope context and manages conversation persistence in Firestore

import { auth } from '../lib/firebase';
import type {
  ChatMessage,
  ChatStudyScope,
  ChatSession,
  GenerateChatResponseOptions,
  GenerateChatResponseResult,
} from '../types/chat';
import type { OllamaChatMessage } from '../types/ollama';
import {
  generateChat,
  generateCompletion,
  getSelectedModel,
  parseOllamaError,
} from './ollamaService';
import { generateRagAnswer } from './ragService';
import { budgetShortTermMemory } from './conversationMemoryService';
import {
  getUserConversations,
  getConversation,
  createNewConversation,
  appendConversationMessage,
  renameConversation as renameConversationRecord,
  deleteConversation as deleteConversationRecord,
  clearConversationHistory as clearConversationHistoryRecord,
  updateConversationMemorySummary as updateConversationMemorySummaryRecord,
} from './conversationHistoryService';

export const STARTER_PROMPTS: string[] = [
  'Explain the important concepts',
  'Help me understand a difficult topic',
  'Ask me practice questions with solutions',
  'Explain a topic step by step with an example',
];

/**
 * Builds the educational AI assistant system prompt.
 * Grounded in the student's selected subject and modules.
 */
export const buildEducationalSystemPrompt = (scope: ChatStudyScope): string => {
  const isEntire = scope.scopeMode === 'entire_subject';
  const scopeDetail = isEntire
    ? `Entire Subject: "${scope.subjectName}" (covering all ${scope.totalModuleCount} modules in the curriculum)`
    : `Specific Course Modules: ${scope.moduleNames.length > 0 ? scope.moduleNames.join('; ') : 'Selected modules'}`;

  return `You are an expert, encouraging university tutor and academic AI Study Assistant for the course "${scope.subjectName}"${scope.subjectCode ? ` (${scope.subjectCode})` : ''}.

ACTIVE STUDY SCOPE CONTEXT:
- Subject: ${scope.subjectName}${scope.subjectCode ? ` [${scope.subjectCode}]` : ''}
- Scope Mode: ${isEntire ? 'Entire Subject' : 'Specific Modules'}
- Active Modules: ${scopeDetail}

CRITICAL PEDAGOGICAL INSTRUCTIONS:
1. Student-Centered Explanations:
   - Explain technical, mathematical, and abstract concepts in clear, intuitive language without being condescending.
   - Use concrete real-world examples, practical analogies, and step-by-step reasoning.
2. Code & Computational Concepts:
   - When discussing algorithms, data structures, or programming, provide clean, idiomatic, well-commented code blocks.
   - Explain what each section of the code does.
3. Practice & Self-Testing:
   - When the student asks for practice questions, generate relevant, high-yield practice problems directly suited to ${scope.subjectName}.
   - Provide hints first or full step-by-step solutions with detailed explanations when requested.
4. Conversation Continuity:
   - Maintain multi-turn conversational context. Build smoothly on earlier explanations when the student asks follow-up questions.
5. Grounding & Honesty:
   - Adapt your guidance specifically to the selected subject and modules.
   - Never invent false academic facts, bogus formulas, or nonexistent APIs.
   - If a topic is ambiguous, outside the scope, or if you are uncertain, honestly state what you know and suggest how the student can verify it.
   - Note: At this stage, your answers are based on established curriculum knowledge for this subject and its modules. (Do not pretend you have indexed private uploaded PDF files yet).

Format your responses using clear Markdown with headings, bullet points, numbered steps, bold highlights, and code blocks where appropriate.`;
};

/**
 * Creates the initial welcome greeting based on the student's selected study scope.
 */
export const createWelcomeMessage = (scope: ChatStudyScope): ChatMessage => {
  const isEntire = scope.scopeMode === 'entire_subject';
  const scopeDescription = isEntire
    ? `Entire Subject (${scope.totalModuleCount} modules included)`
    : `Selected Modules: ${scope.moduleNames.length > 0 ? scope.moduleNames.join(', ') : 'None'}`;

  const content = `Hello! I am your **AI Study Assistant** for **${scope.subjectName}**${scope.subjectCode ? ` (${scope.subjectCode})` : ''}.

📌 **Active Study Scope:**
• **Mode**: ${isEntire ? 'Entire Subject' : 'Specific Modules'}
• **Coverage**: ${scopeDescription}

I can help explain difficult topics, break down complex algorithms with code, walk through concepts step by step, or generate practice questions.

What would you like to focus on today?`;

  return {
    id: `welcome-${Date.now()}`,
    sender: 'assistant',
    content,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Clean Service Boundary for generating chat responses from local Ollama.
 * Separates LLM communication from UI components so RAG can be integrated later.
 */
export const generateChatResponse = async (
  options: GenerateChatResponseOptions
): Promise<GenerateChatResponseResult> => {
  const {
    messages,
    scope,
    studentId: providedStudentId,
    model: requestedModel,
    temperature = 0.3,
    abortSignal,
    customBaseUrl,
    customChromaUrl,
    enableRag = true,
    resourceId,
    topK,
    minSimilarity,
    maxContextChars,
    collectionName,
    maxHistoryTurns,
    enableQueryCondensation,
    conversationSummary,
    memoryTopics,
    stream,
    onChunk,
  } = options;

  const activeModel = requestedModel || getSelectedModel() || 'llama3.2:3b';

  // 1. RAG Workflow: Ground the answer in retrieved study materials
  let latestUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === 'user') {
      latestUserIndex = i;
      break;
    }
  }

  const latestUserMessage = latestUserIndex !== -1 ? messages[latestUserIndex] : undefined;

  // Extract prior conversation history (all valid user/assistant turns prior to latestUserMessage)
  const priorHistory =
    latestUserIndex > 0
      ? messages
          .slice(0, latestUserIndex)
          .filter(
            (m) =>
              (m.sender === 'user' || m.sender === 'assistant') &&
              !m.isError &&
              typeof m.content === 'string' &&
              m.content.trim().length > 0
          )
          .map((m) => ({
            sender: m.sender as 'user' | 'assistant',
            content: m.content.trim(),
          }))
      : [];

  const resolvedStudentId =
    providedStudentId || (typeof window !== 'undefined' ? auth?.currentUser?.uid : undefined);

  if (
    enableRag &&
    latestUserMessage &&
    latestUserMessage.content.trim() &&
    resolvedStudentId &&
    scope?.subjectId
  ) {
    const ragResult = await generateRagAnswer(
      latestUserMessage.content,
      scope,
      resolvedStudentId,
      {
        model: activeModel,
        temperature,
        topK,
        minSimilarity,
        maxContextChars,
        resourceId,
        collectionName,
        customOllamaUrl: customBaseUrl,
        customChromaUrl,
        abortSignal,
        conversationHistory: priorHistory,
        maxHistoryTurns,
        enableQueryCondensation,
        conversationSummary,
        memoryTopics,
        stream,
        onChunk,
      }
    );

    if (ragResult.status === 'error') {
      throw new Error(ragResult.error || 'Failed to generate grounded RAG answer.');
    }

    return {
      text: ragResult.answer,
      model: ragResult.model || activeModel,
      durationMs: ragResult.durationMs,
      sources: ragResult.sources,
      isRagGrounded: ragResult.isGrounded,
      retrievalDurationMs: ragResult.retrievalDurationMs,
      generationDurationMs: ragResult.generationDurationMs,
      condensedQuestion: ragResult.condensedQuestion,
      condensationDurationMs: ragResult.condensationDurationMs,
      timeToFirstTokenMs: ragResult.timeToFirstTokenMs,
      isStreamed: ragResult.isStreamed,
      isCancelled: ragResult.isCancelled,
    };
  }

  // 2. Non-RAG conversational fallback (e.g. general tutor dialogue or when scope has no subject)
  let systemPrompt = buildEducationalSystemPrompt(scope);
  if (conversationSummary && conversationSummary.trim().length > 0) {
    systemPrompt += `\n\n### LONG-TERM CONVERSATION MEMORY (Prior topics and concepts discussed in this study session):\n${conversationSummary.trim()}`;
  }

  // Stage 11.2: Budget short-term memory
  const { budgetedMessages } = budgetShortTermMemory(messages, {
    maxTurns: maxHistoryTurns ?? 3,
  });

  const ollamaMessages: OllamaChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...budgetedMessages.map((m) => ({
      role: ((m.role || m.sender) === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  try {
    const result = await generateChat({
      model: activeModel,
      messages: ollamaMessages,
      temperature,
      stream: stream ?? Boolean(onChunk),
      onChunk,
      abortSignal,
      customBaseUrl,
    });

    if (result.isCancelled) {
      return {
        text: result.text.trim(),
        model: result.model || activeModel,
        durationMs: result.durationMs,
        timeToFirstTokenMs: result.timeToFirstTokenMs,
        isStreamed: Boolean(result.isStreamed),
        isCancelled: true,
      };
    }

    if (!result.text || !result.text.trim()) {
      if (!abortSignal?.aborted) {
        throw new Error('The model returned an empty response. Please try asking again.');
      }
    }

    return {
      text: result.text.trim(),
      model: result.model || activeModel,
      durationMs: result.durationMs,
      timeToFirstTokenMs: result.timeToFirstTokenMs,
      isStreamed: result.isStreamed,
      isCancelled: result.isCancelled,
    };
  } catch (err: unknown) {
    if (abortSignal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
      return {
        text: '',
        model: activeModel,
        durationMs: 0,
        isCancelled: true,
      };
    }

    const errorInfo = parseOllamaError(err, activeModel);

    // If chat failed because endpoint only supports /api/generate or method mismatch, try fallback
    if (
      !abortSignal?.aborted &&
      errorInfo.code !== 'NOT_INSTALLED_OR_RUNNING' &&
      errorInfo.code !== 'CORS_ERROR'
    ) {
      try {
        const dialogHistory = budgetedMessages
          .map((m) => `${(m.role || m.sender) === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
          .join('\n\n');

        const fallbackPrompt = `${dialogHistory}\n\nTutor:`;

        const fallbackResult = await generateCompletion({
          model: activeModel,
          prompt: fallbackPrompt,
          system: systemPrompt,
          temperature,
          stream: stream ?? Boolean(onChunk),
          onChunk,
          abortSignal,
          customBaseUrl,
        });

        if (fallbackResult.text && fallbackResult.text.trim()) {
          return {
            text: fallbackResult.text.trim(),
            model: fallbackResult.model || activeModel,
            durationMs: fallbackResult.durationMs,
            timeToFirstTokenMs: fallbackResult.timeToFirstTokenMs,
            isStreamed: fallbackResult.isStreamed,
            isCancelled: fallbackResult.isCancelled,
          };
        }
      } catch {
        // Fall through to throw original enriched error
      }
    }

    const enrichedError = new Error(errorInfo.message);
    (enrichedError as unknown as { info: typeof errorInfo }).info = errorInfo;
    throw enrichedError;
  }
};

/**
 * Sends a message in the chat session and returns a new ChatMessage.
 * Backwards compatible with existing chat views.
 */
export const sendChatMessage = async (
  scope: ChatStudyScope,
  conversationHistory: ChatMessage[],
  studentId?: string,
  abortSignal?: AbortSignal,
  customBaseUrl?: string,
  customChromaUrl?: string
): Promise<ChatMessage> => {
  const result = await generateChatResponse({
    messages: conversationHistory,
    scope,
    studentId,
    abortSignal,
    customBaseUrl,
    customChromaUrl,
  });

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sender: 'assistant',
    content: result.text,
    timestamp: new Date().toISOString(),
    modelUsed: result.model,
    durationMs: result.durationMs,
    sources: result.sources,
    isRagGrounded: result.isRagGrounded,
  };
};

// =========================================================================
// Firestore Conversation Persistence Layer (Private to Authenticated User)
// =========================================================================

// =========================================================================
// Firestore Conversation Persistence Layer (Private to Authenticated User)
// Delegated to conversationHistoryService with subcollection & memory support
// =========================================================================

/**
 * Fetch all saved study conversations for an authenticated user, ordered by most recently updated.
 */
export const getConversations = async (userId: string): Promise<ChatSession[]> => {
  return getUserConversations(userId);
};

/**
 * Retrieve a specific conversation by ID.
 */
export const getConversationById = async (
  userId: string,
  conversationId: string
): Promise<ChatSession | null> => {
  return getConversation(userId, conversationId);
};

/**
 * Create a new conversation record in Firestore.
 */
export const createConversation = async (
  userId: string,
  scope: ChatStudyScope,
  initialMessages: ChatMessage[] = [],
  title?: string
): Promise<ChatSession> => {
  return createNewConversation(userId, scope, initialMessages, title);
};

/**
 * Save / Update messages and metadata in an existing conversation document.
 */
export const saveConversation = async (
  userId: string,
  session: ChatSession
): Promise<void> => {
  if (!userId || !session.id) return;
  const lastMsg = session.messages.length > 0
    ? session.messages[session.messages.length - 1]
    : undefined;
  if (lastMsg) {
    await appendConversationMessage(userId, session.id, lastMsg, session.messages);
  }
};

/**
 * Save messages to a conversation and optionally update its title.
 */
export const saveConversationMessages = async (
  userId: string,
  conversationId: string,
  messages: ChatMessage[],
  newTitle?: string
): Promise<void> => {
  if (!userId || !conversationId) return;
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : undefined;
  if (lastMsg) {
    await appendConversationMessage(userId, conversationId, lastMsg, messages);
  }
  if (newTitle) {
    await renameConversationRecord(userId, conversationId, newTitle);
  }
};

/**
 * Delete a conversation from Firestore.
 */
export const deleteConversation = async (
  userId: string,
  conversationId: string
): Promise<void> => {
  return deleteConversationRecord(userId, conversationId);
};

/**
 * Rename a conversation in Firestore.
 */
export const renameConversation = async (
  userId: string,
  conversationId: string,
  newTitle: string
): Promise<void> => {
  return renameConversationRecord(userId, conversationId, newTitle);
};

/**
 * Clears conversation history and memory while preserving session.
 */
export const clearConversationHistory = async (
  userId: string,
  conversationId: string
): Promise<void> => {
  return clearConversationHistoryRecord(userId, conversationId);
};

/**
 * Updates long-term conversation memory summary and topics.
 */
export const updateConversationMemorySummary = async (
  userId: string,
  conversationId: string,
  summaryText: string,
  topics?: string[],
  unresolvedQuestions?: string[],
  lastSummarizedIndex?: number
): Promise<void> => {
  return updateConversationMemorySummaryRecord(
    userId,
    conversationId,
    summaryText,
    topics,
    unresolvedQuestions,
    lastSummarizedIndex
  );
};
