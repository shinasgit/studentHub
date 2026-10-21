import React from 'react';
import { Eye, Edit2, Trash2, Calendar, BookOpen, Layers } from 'lucide-react';
import type { Note } from '../../types/note';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

interface NoteCardProps {
  note: Note;
  subject?: Subject;
  module?: Module;
  onView: (note: Note) => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  subject,
  module,
  onView,
  onEdit,
  onDelete,
}) => {
  const subjectColor = subject?.color || '#10b981';

  // Format date readable
  const formattedDate = new Date(note.updatedAt || note.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="subject-card animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'default',
        padding: '20px 22px',
        gap: '14px',
        borderTop: `4px solid ${subjectColor}`,
        minHeight: '200px',
      }}
    >
      {/* Top badges & Title */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '10px',
            flexWrap: 'wrap',
          }}
        >
          {/* Subject tag */}
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 'var(--radius-sm)',
              background: `${subjectColor}18`,
              color: subjectColor,
              border: `1px solid ${subjectColor}33`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <BookOpen size={11} />
            {subject?.name || 'General Subject'}
          </span>

          {/* Module tag if available */}
          {module && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--social-btn-bg)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Layers size={10} />
              {module.title}
            </span>
          )}
        </div>

        <h3
          onClick={() => onView(note)}
          style={{
            fontSize: '1.08rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '8px',
            cursor: 'pointer',
            lineHeight: 1.35,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
        >
          {note.title}
        </h3>

        {/* Content Excerpt */}
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {note.content || 'No content added yet.'}
        </p>
      </div>

      {/* Card Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '12px',
          marginTop: 'auto',
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <Calendar size={12} />
          {formattedDate}
        </span>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => onView(note)}
            aria-label="View note"
            title="Read Note"
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
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <Eye size={15} />
          </button>

          <button
            type="button"
            onClick={() => onEdit(note)}
            aria-label="Edit note"
            title="Edit Note"
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
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <Edit2 size={15} />
          </button>

          <button
            type="button"
            onClick={() => onDelete(note)}
            aria-label="Delete note"
            title="Delete Note"
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
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent-rose)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
