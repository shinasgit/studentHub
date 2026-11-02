// Chatbot & Study Session Types
// Defines data models for subject/module scope selection and chat history

export type ChatScopeMode = 'entire_subject' | 'specific_modules';

export interface ChatStudyScope {
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  subjectColor?: string;
  scopeMode: ChatScopeMode;
  moduleIds: string[];
  moduleNames: string[];
  totalModuleCount: number;
  resourceCount?: number;
}

import type { RagSourceReference } from './rag';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isMock?: boolean;
  isError?: boolean;
  modelUsed?: string;
  durationMs?: number;
  sources?: RagSourceReference[];
  role?: 'user' | 'assistant' | 'system';
  isRagGrounded?: boolean;
  retrievalDurationMs?: number;
  generationDurationMs?: number;
  condensedQuestion?: string;
  condensationDurationMs?: number;
  isStreaming?: boolean;
  isCancelled?: boolean;
  timeToFirstTokenMs?: number;
}

export interface ConversationSummary {
  summaryText: string;
  topics: string[];
  conceptsExplained: string[];
  unresolvedQuestions: string[];
  lastMessageCount: number;
  updatedAt: string;
}

export interface ConversationMemoryContext {
  shortTermTurns: ChatMessage[];
  longTermSummary?: string;
  topics?: string[];
  unresolvedQuestions?: string[];
  formattedContextPrompt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title?: string;
  scope: ChatStudyScope;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  summary?: string;
  lastMessage?: string;
  messageCount?: number;
  memoryTopics?: string[];
  unresolvedQuestions?: string[];
  lastSummarizedMessageIndex?: number;
}

export interface GenerateChatResponseOptions {
  messages: ChatMessage[];
  scope: ChatStudyScope;
  studentId?: string;
  model?: string;
  temperature?: number;
  abortSignal?: AbortSignal;
  customBaseUrl?: string;
  customChromaUrl?: string;
  enableRag?: boolean;
  resourceId?: string;
  topK?: number;
  minSimilarity?: number;
  maxContextChars?: number;
  collectionName?: string;
  maxHistoryTurns?: number;
  enableQueryCondensation?: boolean;
  conversationSummary?: string;
  memoryTopics?: string[];
  stream?: boolean;
  onChunk?: (chunk: string, accumulated: string) => void;
}

export interface GenerateChatResponseResult {
  text: string;
  model: string;
  durationMs: number;
  sources?: RagSourceReference[];
  isRagGrounded?: boolean;
  retrievalDurationMs?: number;
  generationDurationMs?: number;
  condensedQuestion?: string;
  condensationDurationMs?: number;
  timeToFirstTokenMs?: number;
  isStreamed?: boolean;
  isCancelled?: boolean;
}

