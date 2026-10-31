// Chatbot Service Layer for AI Student Hub
// Connects the existing Chatbot UI to Local Ollama LLM (Llama 3.2 3B)
// 100% Free, Local Privacy, Zero Paid APIs
// Maintains study scope context and manages conversation persistence in Firestore

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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

export const STARTER_PROMPTS: string[] = [
  'Explain the important concepts',
  'Help me understand a difficult topic',
  'Ask me practice questions with solutions',
  'Explain a topic step by step with an example',
];

/**
 * Normalizes Firestore timestamps or strings to an ISO string
 */
const formatTimestamp = (val: unknown): string => {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
};

/**
 * Returns the Firestore conversations collection for a specific user
 * Path: users/{userId}/conversations
 */
const getUserConversationsCollection = (userId: string) => {
  if (!userId) {
    throw new Error('User ID is required to access conversations.');
  }
  return collection(db, 'users', userId, 'conversations');
};

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
    model: requestedModel,
    temperature = 0.5,
    abortSignal,
    customBaseUrl,
  } = options;

  const activeModel = requestedModel || getSelectedModel() || 'llama3.2:3b';
  const systemPrompt = buildEducationalSystemPrompt(scope);

  // 1. Prepare conversation messages for Ollama API
  // Filter out system error alerts and limit history to the last 14 turns to preserve context budget
  const relevantMessages = messages
    .filter((m) => m.sender === 'user' || m.sender === 'assistant')
    .slice(-14);

  const ollamaMessages: OllamaChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...relevantMessages.map((m) => ({
      role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  try {
    // 2. Attempt standard /api/chat endpoint
    const result = await generateChat({
      model: activeModel,
      messages: ollamaMessages,
      temperature,
      abortSignal,
      customBaseUrl,
    });

    if (!result.text || !result.text.trim()) {
      throw new Error('The model returned an empty response. Please try asking again.');
    }

    return {
      text: result.text.trim(),
      model: result.model || activeModel,
      durationMs: result.durationMs,
    };
  } catch (err: unknown) {
    const errorInfo = parseOllamaError(err, activeModel);

    // If chat failed because endpoint only supports /api/generate or method mismatch, try fallback
    if (
      !abortSignal?.aborted &&
      errorInfo.code !== 'NOT_INSTALLED_OR_RUNNING' &&
      errorInfo.code !== 'CORS_ERROR'
    ) {
      try {
        const dialogHistory = relevantMessages
          .map((m) => `${m.sender === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
          .join('\n\n');

        const fallbackPrompt = `${dialogHistory}\n\nTutor:`;

        const fallbackResult = await generateCompletion({
          model: activeModel,
          prompt: fallbackPrompt,
          system: systemPrompt,
          temperature,
          abortSignal,
          customBaseUrl,
        });

        if (fallbackResult.text && fallbackResult.text.trim()) {
          return {
            text: fallbackResult.text.trim(),
            model: fallbackResult.model || activeModel,
            durationMs: fallbackResult.durationMs,
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
  abortSignal?: AbortSignal,
  customBaseUrl?: string
): Promise<ChatMessage> => {
  const result = await generateChatResponse({
    messages: conversationHistory,
    scope,
    abortSignal,
    customBaseUrl,
  });

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sender: 'assistant',
    content: result.text,
    timestamp: new Date().toISOString(),
    modelUsed: result.model,
    durationMs: result.durationMs,
  };
};

// =========================================================================
// Firestore Conversation Persistence Layer (Private to Authenticated User)
// =========================================================================

/**
 * Fetch all saved study conversations for an authenticated user, ordered by most recently updated.
 */
export const getConversations = async (userId: string): Promise<ChatSession[]> => {
  if (!userId) return [];

  try {
    const colRef = getUserConversationsCollection(userId);
    const q = query(colRef, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId,
        title: data.title || `${data.scope?.subjectName || 'Study'} Session`,
        scope: data.scope as ChatStudyScope,
        messages: Array.isArray(data.messages) ? data.messages : [],
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('Error fetching conversations:', err);

    // Fallback without orderBy in case composite index is not yet built
    try {
      const colRef = getUserConversationsCollection(userId);
      const snapshot = await getDocs(colRef);
      const list: ChatSession[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId,
          title: data.title || `${data.scope?.subjectName || 'Study'} Session`,
          scope: data.scope as ChatStudyScope,
          messages: Array.isArray(data.messages) ? data.messages : [],
          createdAt: formatTimestamp(data.createdAt),
          updatedAt: formatTimestamp(data.updatedAt),
        };
      });
      return list.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch {
      return [];
    }
  }
};

/**
 * Retrieve a specific conversation by ID.
 */
export const getConversationById = async (
  userId: string,
  conversationId: string
): Promise<ChatSession | null> => {
  if (!userId || !conversationId) return null;

  try {
    const docRef = doc(db, 'users', userId, 'conversations', conversationId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    return {
      id: snap.id,
      userId,
      title: data.title || `${data.scope?.subjectName || 'Study'} Session`,
      scope: data.scope as ChatStudyScope,
      messages: Array.isArray(data.messages) ? data.messages : [],
      createdAt: formatTimestamp(data.createdAt),
      updatedAt: formatTimestamp(data.updatedAt),
    };
  } catch (err) {
    console.error('Error fetching conversation by id:', err);
    return null;
  }
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
  if (!userId) {
    throw new Error('User ID is required to create a conversation.');
  }

  const colRef = getUserConversationsCollection(userId);
  const now = new Date().toISOString();
  const sessionTitle =
    title?.trim() || `${scope.subjectName} Study Session`;

  const docRef = await addDoc(colRef, {
    userId,
    title: sessionTitle,
    scope,
    messages: initialMessages,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    userId,
    title: sessionTitle,
    scope,
    messages: initialMessages,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Save / Update messages and metadata in an existing conversation document.
 */
export const saveConversation = async (
  userId: string,
  session: ChatSession
): Promise<void> => {
  if (!userId || !session.id) return;

  try {
    const docRef = doc(db, 'users', userId, 'conversations', session.id);
    await setDoc(
      docRef,
      {
        userId,
        title: session.title || `${session.scope.subjectName} Session`,
        scope: session.scope,
        messages: session.messages,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving conversation to Firestore:', err);
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

  try {
    const docRef = doc(db, 'users', userId, 'conversations', conversationId);
    const payload: Record<string, unknown> = {
      messages,
      updatedAt: serverTimestamp(),
    };
    if (newTitle) {
      payload.title = newTitle.trim();
    }
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.error('Error updating conversation messages:', err);
  }
};

/**
 * Delete a conversation from Firestore.
 */
export const deleteConversation = async (
  userId: string,
  conversationId: string
): Promise<void> => {
  if (!userId || !conversationId) return;

  const docRef = doc(db, 'users', userId, 'conversations', conversationId);
  await deleteDoc(docRef);
};
