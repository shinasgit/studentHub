import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  SlidersHorizontal,
  Bot,
  Sparkles,
  BookOpen,
  Square,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Lightbulb,
  CheckSquare,
  GraduationCap,
  ArrowLeftRight,
  Cpu,
  ArrowUp,
  Plus,
  History,
  Trash2,
  X,
  Search,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { Subject } from '../../types/subject';
import type { ChatStudyScope, ChatMessage, ChatSession } from '../../types/chat';
import type { OllamaErrorInfo } from '../../types/ollama';
import {
  generateChatResponse,
  createConversation,
  saveConversationMessages,
  getConversations,
  deleteConversation,
} from '../../services/chatService';
import { getSelectedModel, parseOllamaError } from '../../services/ollamaService';
import { ChatMessageContent } from './ChatMessageContent';
import { ChatScopeModal } from './ChatScopeModal';

interface ChatInterfaceProps {
  user: User;
  subjects: Subject[];
  scope: ChatStudyScope;
  userDisplayName?: string;
  currentSessionId?: string | null;
  initialMessages?: ChatMessage[];
  onUpdateScope: (newScope: ChatStudyScope) => void;
  onNewSession?: () => void;
  onSelectSession?: (session: ChatSession) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  user,
  subjects,
  scope,
  userDisplayName = 'Student',
  currentSessionId: initialSessionId = null,
  initialMessages,
  onUpdateScope,
  onNewSession,
  onSelectSession,
}) => {
  // Session & conversation messages
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }
    return [];
  });

  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Saved conversations for history drawer
  const [conversations, setConversations] = useState<ChatSession[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const [activeModel, setActiveModel] = useState<string>('llama3.2:3b');

  // Scope Modal state
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);

  // AbortController for cancel / stop generation
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationContainerRef = useRef<HTMLDivElement>(null);

  // Update active model from local storage
  useEffect(() => {
    const model = getSelectedModel() || 'llama3.2:3b';
    setActiveModel(model);
  }, []);

  // Load saved conversations from Firestore
  const loadConversations = useCallback(async () => {
    if (!user.uid) return;
    try {
      const list = await getConversations(user.uid);
      setConversations(list);
    } catch (err) {
      console.error('Failed to load conversations for history:', err);
    }
  }, [user.uid]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Synchronize external session or message changes
  useEffect(() => {
    setSessionId(initialSessionId);
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    } else {
      setMessages([]);
    }
  }, [initialSessionId, initialMessages]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (messages.length > 0 || isSending) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending]);

  // Auto-grow textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (inputError) setInputError(null);

    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
  };

  // Copy message text
  const handleCopy = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {
      // Fallback
    }
  };

  // Helper to persist conversation to Firestore
  const persistConversation = async (
    allMessages: ChatMessage[],
    activeSessionId: string | null,
    firstQuestionText?: string
  ): Promise<string | null> => {
    if (!user.uid) return activeSessionId;

    try {
      if (activeSessionId) {
        await saveConversationMessages(user.uid, activeSessionId, allMessages);
        loadConversations();
        return activeSessionId;
      } else {
        const title = firstQuestionText
          ? `${scope.subjectName}: ${firstQuestionText.slice(0, 36)}${firstQuestionText.length > 36 ? '...' : ''}`
          : `${scope.subjectName} Study Session`;

        const newSession = await createConversation(user.uid, scope, allMessages, title);
        setSessionId(newSession.id);
        loadConversations();
        return newSession.id;
      }
    } catch (err) {
      console.error('Error persisting conversation:', err);
      return activeSessionId;
    }
  };

  // Stop / Abort generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSending(false);
  };

  // Send message to local Ollama LLM
  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : inputValue;
    const cleanText = rawText.trim();

    if (!cleanText) {
      setInputError('Please enter a question or topic.');
      return;
    }

    if (isSending) return;

    setInputError(null);
    setInputValue('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // 1. Add user question
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: cleanText,
      timestamp: new Date().toISOString(),
    };

    const updatedWithUser = [...messages, userMsg];
    setMessages(updatedWithUser);
    setIsSending(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 2. Request real response from Ollama
      const result = await generateChatResponse({
        messages: updatedWithUser,
        scope,
        abortSignal: controller.signal,
      });

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        content: result.text,
        timestamp: new Date().toISOString(),
        modelUsed: result.model,
        durationMs: result.durationMs,
      };

      const finalMessages = [...updatedWithUser, assistantMsg];
      setMessages(finalMessages);

      // 3. Persist to Firestore
      await persistConversation(finalMessages, sessionId, cleanText);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return;
      }

      const errorInfo: OllamaErrorInfo =
        (err as { info?: OllamaErrorInfo }).info ||
        parseOllamaError(err, activeModel);

      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'system',
        content: errorInfo.message,
        timestamp: new Date().toISOString(),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  // Regenerate last response
  const handleRegenerate = async () => {
    if (isSending) return;

    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) return;

    const historyUpToUser = messages.slice(0, lastUserIndex + 1);
    const lastUserPrompt = messages[lastUserIndex].content;

    setMessages(historyUpToUser);
    setIsSending(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await generateChatResponse({
        messages: historyUpToUser,
        scope,
        abortSignal: controller.signal,
      });

      const newAssistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        content: result.text,
        timestamp: new Date().toISOString(),
        modelUsed: result.model,
        durationMs: result.durationMs,
      };

      const finalMessages = [...historyUpToUser, newAssistantMsg];
      setMessages(finalMessages);

      await persistConversation(finalMessages, sessionId, lastUserPrompt);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;

      const errorInfo =
        (err as { info?: OllamaErrorInfo }).info ||
        parseOllamaError(err, activeModel);

      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'system',
        content: errorInfo.message,
        timestamp: new Date().toISOString(),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  // Start fresh chat
  const handleNewChat = () => {
    if (isSending) handleStopGeneration();
    setSessionId(null);
    setMessages([]);
    setInputValue('');
    setInputError(null);
    if (onNewSession) onNewSession();
  };

  // Switch to selected session from history
  const handleSelectSession = (conv: ChatSession) => {
    if (isSending) handleStopGeneration();
    setSessionId(conv.id);
    setMessages(conv.messages && conv.messages.length > 0 ? conv.messages : []);
    if (conv.scope) {
      onUpdateScope(conv.scope);
    }
    setIsHistoryOpen(false);
    if (onSelectSession) {
      onSelectSession(conv);
    }
  };

  // Delete conversation
  const handleDeleteSession = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this study session? This cannot be undone.')) {
      return;
    }

    setDeletingSessionId(convId);
    try {
      await deleteConversation(user.uid, convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (sessionId === convId) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    } finally {
      setDeletingSessionId(null);
    }
  };

  // Keyboard Enter handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Global Ctrl+K shortcut for New Chat
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  const isEntire = scope.scopeMode === 'entire_subject';
  const lastAssistantIndex = messages.findLastIndex((m) => m.sender === 'assistant');

  // Filtered history conversations
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return conversations;
    const q = historySearch.toLowerCase().trim();
    return conversations.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.scope?.subjectName?.toLowerCase().includes(q) ||
        c.scope?.subjectCode?.toLowerCase().includes(q)
    );
  }, [conversations, historySearch]);

  // Four Suggestions for the Welcome Screen
  const suggestionCards = [
    {
      title: 'Explain a Concept',
      description: 'Break down difficult topics into simple explanations.',
      icon: <Lightbulb size={20} color="var(--color-warning)" />,
      prompt: `Explain the fundamental concepts and mechanisms of ${scope.subjectName} in clear, simple terms with an intuitive real-world example.`,
    },
    {
      title: 'Practice Questions',
      description: 'Test your knowledge with questions and answers.',
      icon: <CheckSquare size={20} color="var(--color-success)" />,
      prompt: `Generate 3 high-yield practice questions with step-by-step solutions to test my understanding of ${scope.subjectName}.`,
    },
    {
      title: 'Learn Step by Step',
      description: 'Understand a topic through structured explanations.',
      icon: <GraduationCap size={20} color="var(--accent-primary)" />,
      prompt: `Break down ${scope.subjectName} into a structured step-by-step tutorial from foundational ideas to advanced applications.`,
    },
    {
      title: 'Compare Technologies',
      description: 'Understand differences with practical examples.',
      icon: <ArrowLeftRight size={20} color="var(--color-info)" />,
      prompt: `Compare the main approaches, design patterns, and practical trade-offs in ${scope.subjectName} with concrete code or architectural examples.`,
    },
  ];

  return (
    <div
      className="chatbot-card-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        position: 'relative',
      }}
    >
      {/* ========================================================= */}
      {/* 1. Chat Header at Top of Card Box                         */}
      {/* ========================================================= */}
      <header
        style={{
          minHeight: '52px',
          padding: '8px clamp(10px, 2vw, 20px)',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Header Left: Bot Icon + Title + Model Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-primary-subtle)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bot size={17} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span
              style={{
                fontSize: '0.94rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              Study Assistant
            </span>

            {/* Llama 3.2 3B Model Badge */}
            <span
              style={{
                fontSize: '0.70rem',
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(34, 197, 94, 0.1)',
                color: 'var(--color-success)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
              title="Connected to Local Ollama instance (llama3.2:3b)"
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--color-success)',
                  display: 'inline-block',
                }}
              />
              <Cpu size={10} />
              <span><span className="chatbot-header-full-text">Llama </span>3.2 3B</span>
            </span>
          </div>
        </div>

        {/* Header Right: Actions + Scope Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* New Chat Button */}
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={handleNewChat}
            title="Start a fresh chat (Ctrl+K)"
            style={{
              height: '30px',
              padding: '0 8px',
              fontSize: '0.76rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Plus size={13} />
            <span>New<span className="chatbot-header-full-text"> Chat</span></span>
          </Button>

          {/* History Drawer Toggle Button */}
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            title="View saved conversations"
            style={{
              height: '30px',
              padding: '0 8px',
              fontSize: '0.76rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <History size={13} />
            <span>
              <span className="chatbot-header-full-text">History</span>
              {conversations.length > 0 ? ` (${conversations.length})` : ''}
            </span>
          </Button>

          {/* Subject Badge */}
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-xs)',
              background: `${scope.subjectColor || '#4f64f1'}15`,
              color: scope.subjectColor || 'var(--accent-primary)',
              border: `1px solid ${scope.subjectColor || '#4f64f1'}33`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              maxWidth: 'clamp(70px, 15vw, 150px)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={scope.subjectName}
          >
            <BookOpen size={11} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {scope.subjectCode || scope.subjectName}
            </span>
          </span>

          {/* Scope Mode Badge (Hidden on mobile for space) */}
          <span
            className="hide-mobile"
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              display: 'inline-flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {isEntire ? 'Entire Subject' : `${scope.moduleNames.length} module(s)`}
          </span>

          {/* Change Scope Button */}
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={() => setIsScopeModalOpen(true)}
            title="Change active study scope"
            style={{
              height: '30px',
              padding: '0 10px',
              fontSize: '0.76rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <SlidersHorizontal size={12} />
            <span><span className="chatbot-header-full-text">Change </span>Scope</span>
          </Button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. Primary Conversation Scroll Container (Centered Width)  */}
      {/* ========================================================= */}
      <div
        ref={conversationContainerRef}
        className="chatbot-scroll-area"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          width: '100%',
        }}
      >
        {/* Centered Content Column */}
        <div
          style={{
            width: '100%',
            maxWidth: '920px',
            margin: '0 auto',
            padding: '12px clamp(12px, 2.5vw, 24px) 16px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
          }}
        >
          {/* ===================================================== */}
          {/* EMPTY STATE: Attractive Welcome Screen                */}
          {/* ===================================================== */}
          {messages.length === 0 ? (
            <div
              style={{
                margin: 'auto 0',
                padding: '8px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              {/* Glowing Icon Badge */}
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--accent-primary-subtle)',
                  border: '1px solid var(--accent-primary-border)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '10px',
                  boxShadow: '0 8px 20px rgba(79, 100, 241, 0.15)',
                }}
              >
                <Sparkles size={22} />
              </div>

              {/* Main Heading & Description */}
              <h1
                style={{
                  fontSize: 'clamp(1.2rem, 2.4vw, 1.55rem)',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  margin: '0 0 6px 0',
                  lineHeight: 1.25,
                }}
              >
                Your personal AI Study Assistant
              </h1>

              <p
                style={{
                  fontSize: '0.86rem',
                  color: 'var(--text-secondary)',
                  maxWidth: '480px',
                  margin: '0 0 14px 0',
                  lineHeight: 1.45,
                }}
              >
                Understand concepts, explore new ideas, and prepare for exams with your AI learning companion.
              </p>

              {/* Active Scope Preview Chip */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.74rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '16px',
                }}
              >
                <BookOpen size={12} color="var(--accent-primary)" />
                <span>
                  Focusing on: <strong style={{ color: 'var(--text-primary)' }}>{scope.subjectName}</strong> ({isEntire ? 'Entire Subject' : `${scope.moduleNames.length} module(s)`})
                </span>
                <button
                  type="button"
                  onClick={() => setIsScopeModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    padding: '0 0 0 4px',
                  }}
                >
                  Change
                </button>
              </div>

              {/* 4 Suggestion Cards */}
              <div
                className="chatbot-suggestions-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '10px',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                {suggestionCards.map((card, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(card.prompt)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      transition: 'all var(--transition-fast)',
                      boxShadow: 'var(--shadow-xs)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary-border)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      {card.icon}
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {card.title}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
                      {card.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ===================================================== */
            /* CONVERSATION MESSAGE STREAM                           */
            /* ===================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {messages.map((msg, index) => {
                const isUser = msg.sender === 'user';
                const isSystem = msg.sender === 'system';
                const isLastAssistant =
                  !isUser && !isSystem && index === lastAssistantIndex;

                // Error / system banner
                if (isSystem || msg.isError) {
                  return (
                    <div
                      key={msg.id}
                      style={{
                        margin: '8px 0',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid var(--color-danger-border)',
                        color: 'var(--color-danger)',
                        fontSize: '0.84rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                    >
                      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1, lineHeight: 1.5 }}>
                        <div style={{ fontWeight: 700, marginBottom: '2px' }}>Generation Error</div>
                        <div>{msg.content}</div>
                      </div>

                      <button
                        type="button"
                        onClick={handleRegenerate}
                        style={{
                          background: 'var(--color-danger-subtle)',
                          border: '1px solid var(--color-danger-border)',
                          borderRadius: 'var(--radius-xs)',
                          padding: '4px 10px',
                          color: 'var(--color-danger)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0,
                        }}
                      >
                        <RefreshCw size={12} />
                        <span>Retry</span>
                      </button>
                    </div>
                  );
                }

                // User Message
                if (isUser) {
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        width: '100%',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: 'min(82%, 680px)',
                          padding: '12px 18px',
                          borderRadius: '18px 18px 4px 18px',
                          background: 'var(--accent-primary)',
                          color: '#ffffff',
                          fontSize: '0.94rem',
                          lineHeight: 1.55,
                          boxShadow: '0 2px 8px rgba(79, 100, 241, 0.25)',
                          wordBreak: 'break-word',
                        }}
                        title={userDisplayName}
                      >
                        <ChatMessageContent content={msg.content} isUser={true} />
                      </div>
                    </div>
                  );
                }

                // AI Assistant Message (Spacious, Natural, No Heavy Box)
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      width: '100%',
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-primary-subtle)',
                        border: '1px solid var(--accent-primary-border)',
                        color: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      <Bot size={18} />
                    </div>

                    {/* Content & Action Bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: 'var(--text-primary)',
                          fontSize: '0.94rem',
                          lineHeight: 1.65,
                        }}
                      >
                        <ChatMessageContent content={msg.content} isUser={false} />
                      </div>

                      {/* Subtle Action Row below message */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginTop: '8px',
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {msg.durationMs && (
                          <span>{(msg.durationMs / 1000).toFixed(1)}s</span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedMessageId === msg.id ? 'var(--color-success)' : 'var(--text-muted)',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 4px',
                            borderRadius: 'var(--radius-xs)',
                          }}
                          title="Copy message to clipboard"
                        >
                          {copiedMessageId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedMessageId === msg.id ? 'Copied' : 'Copy'}</span>
                        </button>

                        {isLastAssistant && !isSending && (
                          <button
                            type="button"
                            onClick={handleRegenerate}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 4px',
                              borderRadius: 'var(--radius-xs)',
                            }}
                            title="Regenerate last response"
                          >
                            <RefreshCw size={12} />
                            <span>Regenerate</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Animated Typing / Thinking Indicator */}
              {isSending && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-primary-subtle)',
                      border: '1px solid var(--accent-primary-border)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={18} />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 16px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.86rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span className="typing-dots">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </span>

                    <span>Thinking with Llama 3.2 3B...</span>

                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      style={{
                        marginLeft: '6px',
                        background: 'var(--color-danger-subtle)',
                        border: '1px solid var(--color-danger-border)',
                        borderRadius: 'var(--radius-xs)',
                        color: 'var(--color-danger)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Stop generation"
                    >
                      <Square size={10} fill="currentColor" />
                      <span>Stop</span>
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. Fixed Docked Message Composer at Box Bottom            */}
      {/* ========================================================= */}
      <div
        className="chatbot-docked-composer"
        style={{
          flexShrink: 0,
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '12px clamp(12px, 2.5vw, 24px) 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '920px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {inputError && (
            <div
              style={{
                fontSize: '0.74rem',
                color: 'var(--color-danger)',
                marginBottom: '6px',
                paddingLeft: '14px',
              }}
            >
              {inputError}
            </div>
          )}

          {/* Composer Input Bar */}
          <div
            style={{
              borderRadius: '16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-sm)',
              padding: '6px 10px 6px 16px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              placeholder="Ask your AI study assistant anything..."
              style={{
                flex: 1,
                resize: 'none',
                padding: '8px 0',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.92rem',
                lineHeight: 1.45,
                maxHeight: '140px',
                fontFamily: 'inherit',
              }}
            />

            {/* Send or Stop Button */}
            {isSending ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'var(--color-danger-subtle)',
                  border: '1px solid var(--color-danger-border)',
                  color: 'var(--color-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  marginBottom: '2px',
                }}
                title="Stop generation"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!inputValue.trim()}
                onClick={() => handleSendMessage()}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: inputValue.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  border: 'none',
                  color: inputValue.trim() ? '#ffffff' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: inputValue.trim() ? 'pointer' : 'default',
                  flexShrink: 0,
                  marginBottom: '2px',
                  transition: 'all var(--transition-fast)',
                }}
                title="Send message (Enter)"
              >
                <ArrowUp size={17} />
              </button>
            )}
          </div>

          {/* Small Disclaimer */}
          <div
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginTop: '6px',
              letterSpacing: '0.01em',
            }}
          >
            AI can make mistakes. Verify important academic concepts.
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. Slide-over Chat History Drawer (On Demand)             */}
      {/* ========================================================= */}
      {isHistoryOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setIsHistoryOpen(false)}
        >
          <div
            style={{
              width: 'min(90vw, 360px)',
              height: '100%',
              background: 'var(--bg-secondary)',
              borderLeft: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Chat History
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search History */}
            <div style={{ padding: '12px 16px 8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search saved chats..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem',
                  }}
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Conversation List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {filteredHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                  <MessageSquare size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.86rem', margin: 0 }}>
                    {historySearch ? 'No chats found matching search.' : 'No saved conversations yet.'}
                  </p>
                  <p style={{ fontSize: '0.74rem', marginTop: '4px' }}>
                    Questions asked in study sessions are saved automatically.
                  </p>
                </div>
              ) : (
                filteredHistory.map((conv) => {
                  const isCurrent = conv.id === sessionId;
                  const messageCount = conv.messages?.length || 0;
                  const updatedDate = new Date(conv.updatedAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectSession(conv)}
                      style={{
                        padding: '11px 13px',
                        borderRadius: 'var(--radius-md)',
                        background: isCurrent ? 'var(--accent-primary-subtle)' : 'var(--bg-tertiary)',
                        border: isCurrent
                          ? '1px solid var(--accent-primary-border)'
                          : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.86rem',
                            fontWeight: 600,
                            color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={conv.title}
                        >
                          {conv.title || 'Study Session'}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(conv.id, e)}
                          disabled={deletingSessionId === conv.id}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            flexShrink: 0,
                          }}
                          title="Delete conversation"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <BookOpen size={11} />
                          {conv.scope?.subjectCode || conv.scope?.subjectName || 'Course'}
                        </span>

                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} />
                          {updatedDate} • {messageCount} msg{messageCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer: Start New Chat */}
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-subtle)' }}>
              <Button
                variant="primary"
                size="sm"
                type="button"
                onClick={() => {
                  setIsHistoryOpen(false);
                  handleNewChat();
                }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Plus size={14} />
                <span>Start New Chat</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. Scope Selection Modal                                  */}
      {/* ========================================================= */}
      <ChatScopeModal
        isOpen={isScopeModalOpen}
        userId={user.uid}
        subjects={subjects}
        currentScope={scope}
        onClose={() => setIsScopeModalOpen(false)}
        onApply={(newScope) => {
          onUpdateScope(newScope);
          if (messages.length === 0) {
            handleNewChat();
          }
        }}
      />
    </div>
  );
};
