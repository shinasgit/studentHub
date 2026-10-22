import React from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  BookOpen,
  Layers,
  RotateCcw,
  Eye,
} from 'lucide-react';
import type { StudySession, StudySessionStatus } from '../../types/planner';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

interface StudySessionCardProps {
  session: StudySession;
  subject?: Subject;
  module?: Module;
  onStatusChange: (session: StudySession, status: StudySessionStatus) => void;
  onView?: (session: StudySession) => void;
  onEdit: (session: StudySession) => void;
  onDelete: (session: StudySession) => void;
}

const formatSessionDate = (dateStr: string): string => {
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3) return dateStr;
  const [year, month, day] = parts;

  const sessionDate = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = sessionDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';

  return sessionDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export const StudySessionCard: React.FC<StudySessionCardProps> = ({
  session,
  subject,
  module,
  onStatusChange,
  onView,
  onEdit,
  onDelete,
}) => {
  const subjectColor = subject?.color || '#0ea5e9';

  const isCompleted = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';

  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: isCompleted ? 'rgba(16, 185, 129, 0.04)' : undefined,
        opacity: isCancelled ? 0.75 : 1,
        transition: 'all var(--transition-fast)',
      }}
    >
      {/* Top Header: Subject, Module, and Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
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

        {/* Status Tag */}
        {isCompleted ? (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--accent-emerald)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <CheckCircle2 size={11} /> Completed
          </span>
        ) : isCancelled ? (
          <span
            style={{
              fontSize: '0.72rem',
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
            <XCircle size={11} /> Cancelled
          </span>
        ) : (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(14, 165, 233, 0.12)',
              color: 'var(--accent-primary)',
              border: '1px solid rgba(14, 165, 233, 0.3)',
            }}
          >
            Upcoming
          </span>
        )}
      </div>

      {/* Title & Notes */}
      <div>
        <h3
          onClick={() => onView && onView(session)}
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '4px',
            textDecoration: isCancelled ? 'line-through' : 'none',
            cursor: onView ? 'pointer' : 'default',
          }}
          title={onView ? 'Click to view session details' : undefined}
        >
          {session.title}
        </h3>

        {session.description && (
          <p
            style={{
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              margin: '0 0 6px 0',
            }}
          >
            {session.description}
          </p>
        )}
      </div>

      {/* Date, Time & Action Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '12px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        {/* Schedule Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-primary)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Calendar size={13} color="var(--accent-primary)" />
            {formatSessionDate(session.date)}
          </span>

          <span
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Clock size={13} color="var(--text-muted)" />
            {session.startTime} ({session.durationMinutes}m)
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Complete button */}
          {!isCompleted && !isCancelled && (
            <button
              type="button"
              onClick={() => onStatusChange(session, 'completed')}
              title="Mark session as completed"
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: 'var(--accent-emerald)',
                cursor: 'pointer',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all var(--transition-fast)',
              }}
            >
              <CheckCircle2 size={13} />
              <span>Done</span>
            </button>
          )}

          {/* Reopen if completed or cancelled */}
          {(isCompleted || isCancelled) && (
            <button
              type="button"
              onClick={() => onStatusChange(session, 'upcoming')}
              title="Re-open session as upcoming"
              style={{
                background: 'var(--social-btn-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <RotateCcw size={13} />
              <span>Reopen</span>
            </button>
          )}

          {/* Cancel button */}
          {!isCompleted && !isCancelled && (
            <button
              type="button"
              onClick={() => onStatusChange(session, 'cancelled')}
              title="Cancel session"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '5px 9px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.76rem',
              }}
            >
              Cancel
            </button>
          )}

          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />

          {/* View Details */}
          {onView && (
            <button
              type="button"
              onClick={() => onView(session)}
              title="View Session Details"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <Eye size={14} />
            </button>
          )}

          {/* Edit */}
          <button
            type="button"
            onClick={() => onEdit(session)}
            title="Edit / Reschedule Session"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
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

          {/* Delete */}
          <button
            type="button"
            onClick={() => onDelete(session)}
            title="Delete Session"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
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
