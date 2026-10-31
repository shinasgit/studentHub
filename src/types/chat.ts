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

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isMock?: boolean;
  isError?: boolean;
  modelUsed?: string;
  durationMs?: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  title?: string;
  scope: ChatStudyScope;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface GenerateChatResponseOptions {
  messages: ChatMessage[];
  scope: ChatStudyScope;
  model?: string;
  temperature?: number;
  abortSignal?: AbortSignal;
  customBaseUrl?: string;
}

export interface GenerateChatResponseResult {
  text: string;
  model: string;
  durationMs: number;
}
