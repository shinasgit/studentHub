import React from 'react';
import {
  X,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  BookOpen,
  Layers,
  RotateCcw,
  Target,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { StudySession, StudySessionStatus } from '../../types/planner';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

interface StudySessionDetailModalProps {
  isOpen: boolean;
  session: StudySession | null;
  subject?: Subject;
  module?: Module;
  onClose: () => void;
  onStatusChange: (session: StudySession, status: StudySessionStatus) => void;
  onEdit: (session: StudySession) => void;
  onDelete: (session: StudySession) => void;
}

const formatDetailedDate = (dateStr: string): string => {
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3) return dateStr;
  const [year, month, day] = parts;
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const calculateEndTime = (startTime: string, durationMinutes: number): string => {
  const [hours, mins] = startTime.split(':').map(Number);
  if (isNaN(hours) || isNaN(mins)) return startTime;
  const totalMins = hours * 60 + mins + durationMinutes;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

export const StudySessionDetailModal: React.FC<StudySessionDetailModalProps> = ({
  isOpen,
  session,
  subject,
  module,
  onClose,
  onStatusChange,
  onEdit,
  onDelete,
}) => {
  if (!isOpen || !session) return null;

  const subjectColor = subject?.color || '#0ea5e9';
  const isCompleted = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';
  const endTime = calculateEndTime(session.startTime, session.durationMinutes);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '28px',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {/* Subject Tag */}
              <span
                style={{
                  fontSize: '0.74rem',
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
                <BookOpen size={12} />
                {subject?.name || 'General Subject'}
              </span>

              {/* Module Tag */}
              {module && (
                <span
                  style={{
                    fontSize: '0.74rem',
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

              {/* Status Badge */}
              {isCompleted ? (
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--accent-emerald)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <CheckCircle2 size={12} /> Completed
                </span>
              ) : isCancelled ? (
                <span
                  style={{
                    fontSize: '0.74rem',
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
                  <XCircle size={12} /> Cancelled
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(14, 165, 233, 0.15)',
                    color: 'var(--accent-primary)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Upcoming
                </span>
              )}
            </div>

            <h2
              style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
                textDecoration: isCancelled ? 'line-through' : 'none',
              }}
            >
              {session.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
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
            <X size={20} />
          </button>
        </div>

        {/* Schedule Timing Box */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            border: '1px solid var(--border-subtle)',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
              Scheduled Date
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
              <Calendar size={15} color="var(--accent-primary)" />
              {formatDetailedDate(session.date)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
              Time & Duration
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
              <Clock size={15} color="var(--text-muted)" />
              {session.startTime} – {endTime} ({session.durationMinutes} min)
            </div>
          </div>
        </div>

        {/* Description / Study Goal */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
            }}
          >
            <Target size={14} color="var(--accent-primary)" />
            <span>Study Goal / Notes</span>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.88rem',
              color: session.description ? 'var(--text-primary)' : 'var(--text-muted)',
              lineHeight: 1.6,
              minHeight: '60px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {session.description || 'No description or study goal recorded for this session.'}
          </div>
        </div>

        {/* Timestamps */}
        <div
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '12px',
            marginBottom: '20px',
          }}
        >
          <span>Created: {new Date(session.createdAt).toLocaleDateString()}</span>
          {session.updatedAt && (
            <span>Updated: {new Date(session.updatedAt).toLocaleDateString()}</span>
          )}
        </div>

        {/* Modal Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Status buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isCompleted && !isCancelled && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onStatusChange(session, 'completed');
                  onClose();
                }}
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  color: 'var(--accent-emerald)',
                }}
              >
                <CheckCircle2 size={14} /> Mark Completed
              </Button>
            )}

            {(isCompleted || isCancelled) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onStatusChange(session, 'upcoming');
                  onClose();
                }}
              >
                <RotateCcw size={14} /> Reopen Session
              </Button>
            )}

            {!isCompleted && !isCancelled && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onStatusChange(session, 'cancelled');
                  onClose();
                }}
              >
                Cancel Session
              </Button>
            )}
          </div>

          {/* Edit / Delete / Close */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(session);
              }}
            >
              <Edit2 size={13} /> Edit
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                onDelete(session);
              }}
              style={{
                color: 'var(--accent-rose)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            >
              <Trash2 size={13} /> Delete
            </Button>

            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
