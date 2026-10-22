// Chatbot Service Layer
// Keeps chatbot service logic separate from UI components so a real backend
// or LLM can be integrated later without redesigning the user interface.
// Complies strictly with the limitation: No paid API keys, no embeddings, no RAG pipeline now.

import type { ChatMessage, ChatStudyScope } from '../types/chat';

export const STARTER_PROMPTS: string[] = [
  'Explain the important concepts',
  'Help me understand a difficult topic',
  'Ask me practice questions',
  'Explain a topic step by step',
];

/**
 * Creates the initial welcome greeting based on the student's selected study scope.
 */
export const createWelcomeMessage = (scope: ChatStudyScope): ChatMessage => {
  const isEntire = scope.scopeMode === 'entire_subject';
  const scopeDescription = isEntire
    ? `Entire Subject (${scope.totalModuleCount} modules included)`
    : `Selected Modules: ${scope.moduleNames.length > 0 ? scope.moduleNames.join(', ') : 'None'}`;

  const content = `Hello! I am your **Study Assistant** for **${scope.subjectName}**${scope.subjectCode ? ` (${scope.subjectCode})` : ''}.

📌 **Current Study Scope:**
• **Mode**: ${isEntire ? 'Entire Subject' : 'Specific Modules'}
• **Coverage**: ${scopeDescription}

You can ask me questions about your syllabus, request concept clarifications, or work through practice problems.

*(Note: Live LLM answering will be connected in Stage 6. Your study scope and interface architecture are fully ready.)*`;

  return {
    id: `welcome-${Date.now()}`,
    sender: 'assistant',
    content,
    timestamp: new Date().toISOString(),
    isMock: true,
  };
};

/**
 * Sends a message in the chat session.
 * Returns a clearly labelled placeholder response explaining the study scope state
 * without pretending to be a real AI model.
 */
export const sendChatMessage = async (
  scope: ChatStudyScope,
  userMessage: string
): Promise<ChatMessage> => {
  // Simulate natural async response latency
  await new Promise((resolve) => setTimeout(resolve, 600));

  const isEntire = scope.scopeMode === 'entire_subject';
  const scopeDetail = isEntire
    ? `all ${scope.totalModuleCount} modules of ${scope.subjectName}`
    : `the following module(s): ${scope.moduleNames.join(', ')}`;

  const content = `Chat functionality is not connected yet. Your selected study scope (${scope.subjectName} — ${isEntire ? 'Entire Subject' : 'Selected Modules'}) is ready for future AI integration.

**Received query**: "${userMessage.trim()}"

**Active Context for AI**:
• **Subject**: ${scope.subjectName}
• **Scope**: ${scopeDetail}

When the AI model backend is connected, responses will be grounded in the lecture notes, PDFs, and syllabus resources associated with this study scope.`;

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sender: 'assistant',
    content,
    timestamp: new Date().toISOString(),
    isMock: true,
  };
};
