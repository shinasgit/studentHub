import React, { useState } from 'react';
import {
  RotateCw,
  Edit2,
  Trash2,
  BookOpen,
  Layers,
  CheckCircle2,
  HelpCircle,
  Clock,
} from 'lucide-react';
import type { Flashcard } from '../../types/flashcard';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

interface FlashcardCardProps {
  card: Flashcard;
  subject?: Subject;
  module?: Module;
  onEdit: (card: Flashcard) => void;
  onDelete: (card: Flashcard) => void;
}

export const FlashcardCard: React.FC<FlashcardCardProps> = ({
  card,
  subject,
  module,
  onEdit,
  onDelete,
}) => {
  const [flipped, setFlipped] = useState(false);
  const subjectColor = subject?.color || '#ec4899';

  const statusBadge = () => {
    switch (card.reviewStatus) {
      case 'known':
        return (
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--accent-emerald)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <CheckCircle2 size={11} /> Known
          </span>
        );
      case 'needs-review':
        return (
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(245, 158, 11, 0.12)',
              color: 'var(--accent-amber)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <HelpCircle size={11} /> Needs Review
          </span>
        );
      default:
        return (
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--social-btn-bg)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            Unreviewed
          </span>
        );
    }
  };

  return (
    <div
      className="subject-card animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'default',
        padding: '18px 20px',
        gap: '12px',
        borderTop: `4px solid ${subjectColor}`,
        minHeight: '220px',
      }}
    >
      {/* Top Header */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: `${subjectColor}15`,
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

          {statusBadge()}
        </div>

        {/* Card Body with Flip Trigger */}
        <div
          onClick={() => setFlipped(!flipped)}
          style={{
            cursor: 'pointer',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background: flipped ? 'rgba(99, 102, 241, 0.08)' : 'var(--social-btn-bg)',
            border: flipped ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border-subtle)',
            transition: 'all var(--transition-fast)',
            minHeight: '90px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          title="Click to flip preview"
        >
          <div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: flipped ? 'var(--accent-primary)' : 'var(--text-muted)',
                marginBottom: '4px',
                display: 'block',
              }}
            >
              {flipped ? 'Answer' : 'Question'}
            </span>
            <p
              style={{
                fontSize: '0.9rem',
                fontWeight: flipped ? 500 : 600,
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {flipped ? card.answer : card.question}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              marginTop: '8px',
            }}
          >
            <RotateCw size={11} />
            <span>Click to flip</span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '10px',
        }}
      >
        <span
          style={{
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Clock size={11} />
          {card.reviewCount > 0 ? `Reviewed ${card.reviewCount}x` : 'Never reviewed'}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => onEdit(card)}
            aria-label="Edit flashcard"
            title="Edit Card"
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
            <Edit2 size={14} />
          </button>

          <button
            type="button"
            onClick={() => onDelete(card)}
            aria-label="Delete flashcard"
            title="Delete Card"
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
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
