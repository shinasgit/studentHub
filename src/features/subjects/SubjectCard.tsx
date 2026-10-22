import React from 'react';
import { BookOpen, Edit2, Trash2, Calendar, Hash } from 'lucide-react';
import type { Subject } from '../../types/subject';

interface SubjectCardProps {
  subject: Subject;
  onEdit: (subject: Subject) => void;
  onDelete: (subject: Subject) => void;
  onSelect?: (subject: Subject) => void;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({
  subject,
  onEdit,
  onDelete,
  onSelect,
}) => {
  const accentColor = subject.color || '#6366f1';

  return (
    <div
      className="subject-card animate-fade-in"
      style={{ borderColor: 'var(--border-subtle)', cursor: onSelect ? 'pointer' : 'default' }}
      onClick={(e) => {
        // If clicking on an action button, don't trigger onSelect
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a')) return;
        if (onSelect) onSelect(subject);
      }}
    >
      <div>
        {/* Top Badges & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 9px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                background: `${accentColor}20`,
                color: accentColor,
                border: `1px solid ${accentColor}40`,
              }}
            >
              <Hash size={12} />
              {subject.code}
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 9px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'var(--social-btn-bg)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Calendar size={12} />
              {subject.semester}
            </span>
          </div>

          {/* Quick action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => onEdit(subject)}
              aria-label={`Edit ${subject.name}`}
              title="Edit Subject"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.background = 'var(--social-btn-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Edit2 size={15} />
            </button>

            <button
              type="button"
              onClick={() => onDelete(subject)}
              aria-label={`Delete ${subject.name}`}
              title="Delete Subject"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-rose)';
                e.currentTarget.style.background = 'rgba(244, 63, 94, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            marginBottom: '8px',
            color: 'var(--text-primary)',
            wordBreak: 'break-word',
          }}
        >
          {subject.name}
        </h3>

        {/* Description if present */}
        {subject.description ? (
          <p
            style={{
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              marginBottom: '16px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {subject.description}
          </p>
        ) : (
          <p
            style={{
              fontSize: '0.84rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              marginBottom: '16px',
            }}
          >
            No description provided.
          </p>
        )}
      </div>

      {/* Card Footer */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '14px',
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <BookOpen size={14} color={accentColor} />
          <span>Modules & Notes</span>
        </span>

        {onSelect && (
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: accentColor,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            View Details →
          </span>
        )}
      </div>
    </div>
  );
};
