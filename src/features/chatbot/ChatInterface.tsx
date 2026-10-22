import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  SlidersHorizontal,
  Bot,
  User as UserIcon,
  Sparkles,
  BookOpen,
  Layers,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { ChatStudyScope, ChatMessage } from '../../types/chat';
import {
  createWelcomeMessage,
  sendChatMessage,
  STARTER_PROMPTS,
} from '../../services/chatService';

interface ChatInterfaceProps {
  scope: ChatStudyScope;
  userDisplayName?: string;
  onChangeScope: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  scope,
  userDisplayName = 'Student',
  onChangeScope,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createWelcomeMessage(scope)]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Handle message send
  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : inputValue;
    const cleanText = rawText.trim();

    if (!cleanText) {
      setInputError('Please enter a message before sending.');
      return;
    }

    setInputError(null);
    setInputValue('');

    // 1. Add student's user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: cleanText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      // 2. Fetch service response (compliant with Stage 1-5 limitation)
      const assistantReply = await sendChatMessage(scope, cleanText);
      setMessages((prev) => [...prev, assistantReply]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'system',
        content: 'Failed to send message. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
      // Refocus textarea
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const isEntire = scope.scopeMode === 'entire_subject';

  return (
    <div
      style={{
        maxWidth: '960px',
        margin: '0 auto',
        height: 'calc(100dvh - 110px)',
        minHeight: '380px',
        maxHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}
    >
      {/* Chat Session Header */}
      <div
        style={{
          padding: '12px clamp(12px, 3vw, 20px)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-primary-subtle)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bot size={20} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Study Assistant
              </span>
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
                }}
              >
                <BookOpen size={11} />
                {scope.subjectCode || scope.subjectName}
              </span>
              <span
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
                  gap: '4px',
                }}
              >
                {isEntire ? <BookOpen size={11} /> : <Layers size={11} />}
                {isEntire ? `Entire Subject (${scope.totalModuleCount} modules)` : `${scope.moduleNames.length} module(s)`}
              </span>
            </div>

            <div
              style={{
                fontSize: '0.76rem',
                color: 'var(--text-muted)',
                marginTop: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {isEntire
                ? `Active subject: ${scope.subjectName}`
                : `Modules: ${scope.moduleNames.join(', ')}`}
            </div>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={onChangeScope}
          style={{ flexShrink: 0 }}
        >
          <SlidersHorizontal size={14} />
          <span>Change Scope</span>
        </Button>
      </div>

      {/* Architectural Limitation Notice Banner (compliant with Part 5) */}
      <div
        style={{
          padding: '8px 16px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '0.76rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <HelpCircle size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        <span>
          <strong>UI & Scope Ready:</strong> LLM answering pipeline will connect in Stage 6. Testing queries demonstrate scope preservation and input flows.
        </span>
      </div>

      {/* Scrollable Conversation Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px clamp(12px, 3vw, 24px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isSystem = msg.sender === 'system';

          if (isSystem) {
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: 'center',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                {msg.content}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: '10px',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: 'min(92%, 680px)',
                flexDirection: isUser ? 'row-reverse' : 'row',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  background: isUser ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  border: isUser ? 'none' : '1px solid var(--border-subtle)',
                  color: isUser ? '#ffffff' : 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                {isUser ? <UserIcon size={16} /> : <Bot size={16} />}
              </div>

              {/* Message Bubble */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                  }}
                >
                  {isUser ? userDisplayName : 'Study Assistant'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: isUser ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: isUser ? '#ffffff' : 'var(--text-primary)',
                    border: isUser ? 'none' : '1px solid var(--border-subtle)',
                    fontSize: '0.88rem',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>

                {msg.isMock && !isUser && (
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      marginTop: '4px',
                      fontStyle: 'italic',
                    }}
                  >
                    Simulated placeholder response (Stage 1–5 Limitation)
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {isSending && (
          <div
            style={{
              display: 'flex',
              gap: '12px',
              alignSelf: 'flex-start',
              maxWidth: '82%',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Bot size={16} />
            </div>

            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.84rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Loader2 size={15} className="spin" />
              <span>Analyzing study scope context...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Starter Study Suggestions (shown if conversation is at initial state) */}
      {messages.length <= 2 && (
        <div
          style={{
            padding: '10px 20px',
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={12} color="var(--accent-primary)" /> Suggested Prompts:
          </span>
          {STARTER_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              disabled={isSending}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                padding: '4px 10px',
                fontSize: '0.76rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--accent-primary-border)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Message Input Area */}
      <div
        style={{
          padding: '12px clamp(12px, 3vw, 20px)',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
        }}
      >
        {inputError && (
          <div style={{ fontSize: '0.74rem', color: 'var(--accent-rose)', marginBottom: '6px' }}>
            {inputError}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (inputError) setInputError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            placeholder={`Ask a question about ${scope.subjectName}... (Press Enter to send, Shift+Enter for new line)`}
            style={{
              flex: 1,
              resize: 'none',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              lineHeight: 1.4,
              outline: 'none',
              maxHeight: '100px',
            }}
          />

          <Button
            variant="primary"
            size="md"
            type="button"
            disabled={isSending || !inputValue.trim()}
            onClick={() => handleSendMessage()}
            style={{ height: '42px', flexShrink: 0 }}
          >
            {isSending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            <span>Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
