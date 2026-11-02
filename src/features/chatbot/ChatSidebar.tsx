import React, { useState, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  X,
  PanelLeftClose,
  Sparkles,
  BookOpen,
  Cpu,
  Pencil,
  Check,
} from 'lucide-react';
import type { ChatSession } from '../../types/chat';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  user: User;
  userDisplayName?: string;
  conversations: ChatSession[];
  activeSessionId: string | null;
  activeModel: string;
  onSelectSession: (session: ChatSession) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void;
  onRenameSession?: (sessionId: string, newTitle: string) => void;
  isMobile: boolean;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen,
  onToggle,
  user,
  userDisplayName: passedName,
  conversations,
  activeSessionId,
  activeModel,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  isMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.scope?.subjectName?.toLowerCase().includes(q) ||
        c.scope?.subjectCode?.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  // Group conversations chronologically
  const groupedConversations = useMemo(() => {
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const lastWeek: ChatSession[] = [];
    const older: ChatSession[] = [];

    filteredConversations.forEach((conv) => {
      const convTime = new Date(conv.updatedAt).getTime();
      const diff = now - convTime;

      if (diff < oneDay) {
        today.push(conv);
      } else if (diff < 2 * oneDay) {
        yesterday.push(conv);
      } else if (diff < 7 * oneDay) {
        lastWeek.push(conv);
      } else {
        older.push(conv);
      }
    });

    return [
      { label: 'Today', items: today },
      { label: 'Yesterday', items: yesterday },
      { label: 'Previous 7 Days', items: lastWeek },
      { label: 'Older', items: older },
    ].filter((group) => group.items.length > 0);
  }, [filteredConversations]);

  const userDisplayName = passedName || user.displayName || user.email?.split('@')[0] || 'Student';
  const userInitial = userDisplayName.charAt(0).toUpperCase();

  // On mobile, if not open, return null
  if (isMobile && !isOpen) {
    return null;
  }

  const sidebarContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '280px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        userSelect: 'none',
      }}
    >
      {/* 1. Sidebar Top Header */}
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={16} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.90rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              StudentHub AI
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Study Workspace
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          title={isMobile ? 'Close sidebar' : 'Collapse sidebar'}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: 'var(--radius-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          {isMobile ? <X size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* 2. New Chat Action Button */}
      <div style={{ padding: '12px 14px 8px' }}>
        <button
          type="button"
          onClick={() => {
            onNewChat();
            if (isMobile) onToggle();
          }}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)',
            fontSize: '0.86rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all var(--transition-fast)',
            boxShadow: 'var(--shadow-xs)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary-border)';
            e.currentTarget.style.background = 'var(--accent-primary-subtle)';
            e.currentTarget.style.color = 'var(--accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-medium)';
            e.currentTarget.style.background = 'var(--bg-tertiary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} />
            <span>New Chat</span>
          </div>
          <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
            Ctrl+K
          </span>
        </button>
      </div>

      {/* 3. Search Conversations Input */}
      <div style={{ padding: '4px 14px 10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.80rem',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 4. Conversations List (Scrollable) */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {filteredConversations.length === 0 ? (
          <div
            style={{
              padding: '32px 14px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.80rem',
              lineHeight: 1.5,
            }}
          >
            {searchQuery
              ? 'No conversations found matching your search.'
              : 'No conversations yet. Ask your first study question!'}
          </div>
        ) : (
          groupedConversations.map((group) => (
            <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '4px 8px 2px',
                }}
              >
                {group.label}
              </div>

              {group.items.map((conv) => {
                const isActive = conv.id === activeSessionId;
                const isHovered = hoveredSessionId === conv.id;
                const isEditing = editingSessionId === conv.id;

                if (isEditing) {
                  return (
                    <div
                      key={conv.id}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (editTitle.trim() && onRenameSession) {
                              onRenameSession(conv.id, editTitle.trim());
                            }
                            setEditingSessionId(null);
                          } else if (e.key === 'Escape') {
                            setEditingSessionId(null);
                          }
                        }}
                        style={{
                          flex: 1,
                          fontSize: '0.80rem',
                          padding: '3px 6px',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editTitle.trim() && onRenameSession) {
                            onRenameSession(conv.id, editTitle.trim());
                          }
                          setEditingSessionId(null);
                        }}
                        title="Save title"
                        style={{
                          background: 'var(--accent-primary)',
                          border: 'none',
                          color: '#ffffff',
                          cursor: 'pointer',
                          padding: '3px 5px',
                          borderRadius: 'var(--radius-xs)',
                          display: 'flex',
                        }}
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSessionId(null);
                        }}
                        title="Cancel"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '3px',
                          display: 'flex',
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      onSelectSession(conv);
                      if (isMobile) onToggle();
                    }}
                    onMouseEnter={() => setHoveredSessionId(conv.id)}
                    onMouseLeave={() => setHoveredSessionId(null)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: isActive
                        ? 'var(--accent-primary-subtle)'
                        : isHovered
                        ? 'var(--bg-tertiary)'
                        : 'transparent',
                      borderLeft: isActive
                        ? '3px solid var(--accent-primary)'
                        : '3px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <MessageSquare
                        size={14}
                        color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'}
                        style={{ flexShrink: 0 }}
                      />

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.3,
                          }}
                          title={conv.title}
                        >
                          {conv.title || 'Study Session'}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '2px',
                          }}
                        >
                          {conv.scope?.subjectCode && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                color: 'var(--text-muted)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <BookOpen size={10} />
                              <span>{conv.scope.subjectCode}</span>
                            </span>
                          )}

                          {conv.summary && (
                            <span
                              title="Long-term study memory retained"
                              style={{
                                fontSize: '0.62rem',
                                fontWeight: 600,
                                background: 'rgba(99, 102, 241, 0.12)',
                                color: 'var(--accent-primary)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              <Sparkles size={8} />
                              <span>Memory</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons on hover */}
                    {(isHovered || isMobile) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                        {onRenameSession && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(conv.id);
                              setEditTitle(conv.title || 'Study Session');
                            }}
                            title="Rename conversation"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: 'var(--radius-xs)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--accent-primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                          >
                            <Pencil size={12} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => onDeleteSession(conv.id, e)}
                          title="Delete conversation"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: 'var(--radius-xs)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-danger)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-muted)';
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* 5. User Profile & Local LLM Status at bottom */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              fontSize: '0.80rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {userInitial}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userDisplayName}
            </div>
            <div
              style={{
                fontSize: '0.68rem',
                color: 'var(--color-success)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
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
              <span>{activeModel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // If mobile, render as slide-out drawer with backdrop
  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(2px)',
        }}
        onClick={onToggle}
      >
        <div
          style={{
            height: '100%',
            maxWidth: '280px',
            boxShadow: 'var(--shadow-lg)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {sidebarContent}
        </div>
      </div>
    );
  }

  // Desktop fixed / collapsible sidebar
  return (
    <aside
      style={{
        width: isOpen ? '280px' : '0px',
        height: '100%',
        overflow: 'hidden',
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0,
      }}
    >
      {sidebarContent}
    </aside>
  );
};
