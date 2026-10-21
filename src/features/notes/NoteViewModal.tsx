import React, { useState } from 'react';
import { X, Copy, Check, Edit2, Calendar, BookOpen, Layers } from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { Note } from '../../types/note';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

interface NoteViewModalProps {
  isOpen: boolean;
  note: Note | null;
  subject?: Subject;
  module?: Module;
  onClose: () => void;
  onEdit: (note: Note) => void;
}

export const NoteViewModal: React.FC<NoteViewModalProps> = ({
  isOpen,
  note,
  subject,
  module,
  onClose,
  onEdit,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !note) return null;

  const subjectColor = subject?.color || '#10b981';

  const handleCopy = () => {
    navigator.clipboard.writeText(`${note.title}\n\n${note.content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = new Date(note.updatedAt || note.createdAt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="modal-backdrop animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog"
        style={{
          maxWidth: '700px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 'var(--radius-sm)',
                background: `${subjectColor}18`,
                color: subjectColor,
                border: `1px solid ${subjectColor}33`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <BookOpen size={12} />
              {subject?.name || 'General Subject'}
            </span>

            {module && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--social-btn-bg)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Layers size={11} />
                {module.title}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleCopy}
              title="Copy note content"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--social-btn-bg)',
                border: '1px solid var(--border-subtle)',
                color: copied ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontWeight: 600,
                transition: 'all var(--transition-fast)',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(note);
              }}
              title="Edit note"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--social-btn-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontWeight: 600,
                transition: 'all var(--transition-fast)',
              }}
            >
              <Edit2 size={14} />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close note viewer"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Note Body */}
        <div
          style={{
            padding: '24px 28px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: '8px',
                lineHeight: 1.35,
              }}
            >
              {note.title}
            </h1>

            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Calendar size={13} />
              <span>Last updated on {formattedDate}</span>
            </div>
          </div>

          <div
            style={{
              fontSize: '0.94rem',
              color: 'var(--text-primary)',
              lineHeight: 1.75,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: 'var(--social-btn-bg)',
              padding: '20px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'inherit',
            }}
          >
            {note.content || 'This note has no written text yet.'}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}
        >
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
