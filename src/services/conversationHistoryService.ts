// Conversation History Service for AI Student Hub
// Stage 11.1: Persistent Multi-Session Conversation Storage in Firestore
// Stores conversations separately per authenticated student with messages subcollection
// 100% Free, Local Privacy, Strict Multi-Tenant Isolation

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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  ChatMessage,
  ChatSession,
  ChatStudyScope,
} from '../types/chat';

/**
 * Normalizes Firestore timestamps or date strings to an ISO-8601 string.
 */
export const normalizeTimestamp = (val: unknown): string => {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    return val;
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  return new Date().toISOString();
};

/**
 * Reference to a student's conversations collection:
 * Path: users/{userId}/conversations
 */
export const getUserConversationsCol = (userId: string) => {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('User ID is required to access conversations.');
  }
  return collection(db, 'users', userId.trim(), 'conversations');
};

/**
 * Reference to a conversation's messages subcollection:
 * Path: users/{userId}/conversations/{conversationId}/messages
 */
export const getConversationMessagesCol = (userId: string, conversationId: string) => {
  if (!userId || !conversationId) {
    throw new Error('User ID and Conversation ID are required to access messages subcollection.');
  }
  return collection(db, 'users', userId.trim(), 'conversations', conversationId.trim(), 'messages');
};

/**
 * Converts a ChatMessage into clean Firestore message payload.
 */
export const sanitizeMessageForFirestore = (msg: ChatMessage): Record<string, unknown> => {
  const role = msg.role || (msg.sender === 'user' ? 'user' : 'assistant');
  const payload: Record<string, unknown> = {
    id: msg.id,
    role,
    sender: msg.sender || role,
    content: msg.content || '',
    timestamp: normalizeTimestamp(msg.timestamp),
  };

  if (msg.modelUsed) payload.modelUsed = msg.modelUsed;
  if (typeof msg.durationMs === 'number') payload.durationMs = msg.durationMs;
  if (Array.isArray(msg.sources) && msg.sources.length > 0) payload.sources = msg.sources;
  if (typeof msg.isRagGrounded === 'boolean') payload.isRagGrounded = msg.isRagGrounded;
  if (typeof msg.retrievalDurationMs === 'number') payload.retrievalDurationMs = msg.retrievalDurationMs;
  if (typeof msg.generationDurationMs === 'number') payload.generationDurationMs = msg.generationDurationMs;
  if (msg.condensedQuestion) payload.condensedQuestion = msg.condensedQuestion;
  if (typeof msg.condensationDurationMs === 'number') payload.condensationDurationMs = msg.condensationDurationMs;
  if (msg.isCancelled) payload.isCancelled = true;

  return payload;
};

/**
 * Retrieves all conversations for an authenticated student, ordered by most recently updated.
 */
export const getUserConversations = async (userId: string): Promise<ChatSession[]> => {
  if (!userId) return [];

  try {
    const colRef = getUserConversationsCol(userId);
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
        createdAt: normalizeTimestamp(data.createdAt),
        updatedAt: normalizeTimestamp(data.updatedAt),
        summary: typeof data.summary === 'string' ? data.summary : undefined,
        lastMessage: typeof data.lastMessage === 'string' ? data.lastMessage : undefined,
        messageCount: typeof data.messageCount === 'number' ? data.messageCount : (data.messages?.length || 0),
        memoryTopics: Array.isArray(data.memoryTopics) ? data.memoryTopics : undefined,
        unresolvedQuestions: Array.isArray(data.unresolvedQuestions) ? data.unresolvedQuestions : undefined,
        lastSummarizedMessageIndex: typeof data.lastSummarizedMessageIndex === 'number' ? data.lastSummarizedMessageIndex : undefined,
      };
    });
  } catch (error) {
    console.warn('getUserConversations query with orderBy failed, falling back to unordered fetch:', error);
    try {
      const colRef = getUserConversationsCol(userId);
      const snapshot = await getDocs(colRef);
      const list: ChatSession[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId,
          title: data.title || `${data.scope?.subjectName || 'Study'} Session`,
          scope: data.scope as ChatStudyScope,
          messages: Array.isArray(data.messages) ? data.messages : [],
          createdAt: normalizeTimestamp(data.createdAt),
          updatedAt: normalizeTimestamp(data.updatedAt),
          summary: typeof data.summary === 'string' ? data.summary : undefined,
          lastMessage: typeof data.lastMessage === 'string' ? data.lastMessage : undefined,
          messageCount: typeof data.messageCount === 'number' ? data.messageCount : (data.messages?.length || 0),
          memoryTopics: Array.isArray(data.memoryTopics) ? data.memoryTopics : undefined,
          unresolvedQuestions: Array.isArray(data.unresolvedQuestions) ? data.unresolvedQuestions : undefined,
          lastSummarizedMessageIndex: typeof data.lastSummarizedMessageIndex === 'number' ? data.lastSummarizedMessageIndex : undefined,
        };
      });
      return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch {
      return [];
    }
  }
};

/**
 * Retrieves a single conversation by ID.
 * If parent doc messages array is empty, loads from messages subcollection.
 */
export const getConversation = async (
  userId: string,
  conversationId: string
): Promise<ChatSession | null> => {
  if (!userId || !conversationId) return null;

  try {
    const docRef = doc(db, 'users', userId, 'conversations', conversationId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    let messages: ChatMessage[] = Array.isArray(data.messages) ? data.messages : [];

    // Fallback: If messages on document are empty, inspect messages subcollection
    if (messages.length === 0) {
      try {
        const subCol = getConversationMessagesCol(userId, conversationId);
        const subSnap = await getDocs(query(subCol, orderBy('timestamp', 'asc')));
        if (!subSnap.empty) {
          messages = subSnap.docs.map((d) => {
            const m = d.data();
            return {
              id: m.id || d.id,
              sender: (m.role || m.sender || 'assistant') as 'user' | 'assistant' | 'system',
              role: (m.role || m.sender || 'assistant') as 'user' | 'assistant' | 'system',
              content: m.content || '',
              timestamp: normalizeTimestamp(m.timestamp),
              sources: m.sources,
              isRagGrounded: m.isRagGrounded,
              modelUsed: m.modelUsed,
              durationMs: m.durationMs,
              condensedQuestion: m.condensedQuestion,
            };
          });
        }
      } catch (subErr) {
        console.warn('Subcollection message fetch error:', subErr);
      }
    }

    return {
      id: snap.id,
      userId,
      title: data.title || `${data.scope?.subjectName || 'Study'} Session`,
      scope: data.scope as ChatStudyScope,
      messages,
      createdAt: normalizeTimestamp(data.createdAt),
      updatedAt: normalizeTimestamp(data.updatedAt),
      summary: typeof data.summary === 'string' ? data.summary : undefined,
      lastMessage: typeof data.lastMessage === 'string' ? data.lastMessage : undefined,
      messageCount: typeof data.messageCount === 'number' ? data.messageCount : messages.length,
      memoryTopics: Array.isArray(data.memoryTopics) ? data.memoryTopics : undefined,
      unresolvedQuestions: Array.isArray(data.unresolvedQuestions) ? data.unresolvedQuestions : undefined,
      lastSummarizedMessageIndex: typeof data.lastSummarizedMessageIndex === 'number' ? data.lastSummarizedMessageIndex : undefined,
    };
  } catch (err) {
    console.error(`Error loading conversation ${conversationId}:`, err);
    return null;
  }
};

/**
 * Creates a new conversation in Firestore for the authenticated student.
 */
export const createNewConversation = async (
  userId: string,
  scope: ChatStudyScope,
  initialMessages: ChatMessage[] = [],
  title?: string
): Promise<ChatSession> => {
  if (!userId) {
    throw new Error('User ID is required to create a conversation.');
  }

  const colRef = getUserConversationsCol(userId);
  const now = new Date().toISOString();
  const sessionTitle = title?.trim() || `${scope.subjectName} Study Session`;
  const lastMsgSnippet = initialMessages.length > 0
    ? initialMessages[initialMessages.length - 1].content.slice(0, 120)
    : undefined;

  const docRef = await addDoc(colRef, {
    userId,
    title: sessionTitle,
    scope,
    messages: initialMessages.map(sanitizeMessageForFirestore),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: lastMsgSnippet,
    messageCount: initialMessages.length,
  });

  // Also sync initial messages to the subcollection for robust sub-document querying
  if (initialMessages.length > 0) {
    try {
      const subCol = getConversationMessagesCol(userId, docRef.id);
      for (const msg of initialMessages) {
        const msgDocRef = doc(subCol, msg.id);
        await setDoc(msgDocRef, sanitizeMessageForFirestore(msg), { merge: true });
      }
    } catch (subColErr) {
      console.warn('Initial subcollection sync warning:', subColErr);
    }
  }

  return {
    id: docRef.id,
    userId,
    title: sessionTitle,
    scope,
    messages: initialMessages,
    createdAt: now,
    updatedAt: now,
    lastMessage: lastMsgSnippet,
    messageCount: initialMessages.length,
  };
};

/**
 * Appends a message to a conversation and updates metadata (lastMessage, messageCount, updatedAt).
 */
export const appendConversationMessage = async (
  userId: string,
  conversationId: string,
  message: ChatMessage,
  allUpdatedMessages?: ChatMessage[]
): Promise<void> => {
  if (!userId || !conversationId || !message) return;

  try {
    const parentDocRef = doc(db, 'users', userId, 'conversations', conversationId);
    const sanitizedMsg = sanitizeMessageForFirestore(message);

    // 1. Write to subcollection: users/{userId}/conversations/{conversationId}/messages/{messageId}
    const subCol = getConversationMessagesCol(userId, conversationId);
    const msgDocRef = doc(subCol, message.id);
    await setDoc(msgDocRef, sanitizedMsg, { merge: true });

    // 2. Update parent conversation document
    const snippet = message.content ? message.content.slice(0, 140) : '';
    const updatePayload: Record<string, unknown> = {
      lastMessage: snippet,
      updatedAt: serverTimestamp(),
    };

    if (allUpdatedMessages && Array.isArray(allUpdatedMessages)) {
      updatePayload.messages = allUpdatedMessages.map(sanitizeMessageForFirestore);
      updatePayload.messageCount = allUpdatedMessages.length;
    }

    await setDoc(parentDocRef, updatePayload, { merge: true });
  } catch (err) {
    console.error('Error appending conversation message:', err);
  }
};

/**
 * Renames an existing conversation.
 */
export const renameConversation = async (
  userId: string,
  conversationId: string,
  newTitle: string
): Promise<void> => {
  if (!userId || !conversationId || !newTitle.trim()) return;

  const docRef = doc(db, 'users', userId, 'conversations', conversationId);
  await setDoc(
    docRef,
    {
      title: newTitle.trim(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
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
  if (!userId || !conversationId) return;

  const docRef = doc(db, 'users', userId, 'conversations', conversationId);
  const payload: Record<string, unknown> = {
    summary: summaryText,
    updatedAt: serverTimestamp(),
  };

  if (Array.isArray(topics)) payload.memoryTopics = topics;
  if (Array.isArray(unresolvedQuestions)) payload.unresolvedQuestions = unresolvedQuestions;
  if (typeof lastSummarizedIndex === 'number') payload.lastSummarizedMessageIndex = lastSummarizedIndex;

  await setDoc(docRef, payload, { merge: true });
};

/**
 * Clears conversation messages and resets long-term memory summary while preserving the session.
 */
export const clearConversationHistory = async (
  userId: string,
  conversationId: string
): Promise<void> => {
  if (!userId || !conversationId) return;

  try {
    // 1. Delete all subcollection messages
    const subCol = getConversationMessagesCol(userId, conversationId);
    const subSnap = await getDocs(subCol);
    if (!subSnap.empty) {
      const batch = writeBatch(db);
      subSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // 2. Clear parent document
    const docRef = doc(db, 'users', userId, 'conversations', conversationId);
    await setDoc(
      docRef,
      {
        messages: [],
        lastMessage: '',
        messageCount: 0,
        summary: '',
        memoryTopics: [],
        unresolvedQuestions: [],
        lastSummarizedMessageIndex: 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`Error clearing conversation ${conversationId}:`, err);
    throw err;
  }
};

/**
 * Deletes a conversation and its messages subcollection completely.
 */
export const deleteConversation = async (
  userId: string,
  conversationId: string
): Promise<void> => {
  if (!userId || !conversationId) return;

  try {
    // 1. Delete subcollection messages
    const subCol = getConversationMessagesCol(userId, conversationId);
    const subSnap = await getDocs(subCol);
    if (!subSnap.empty) {
      const batch = writeBatch(db);
      subSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // 2. Delete parent conversation document
    const docRef = doc(db, 'users', userId, 'conversations', conversationId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Error deleting conversation ${conversationId}:`, err);
    throw err;
  }
};
