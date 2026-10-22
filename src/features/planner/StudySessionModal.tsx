import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { getModules } from '../../services/moduleService';
import type { StudySession, StudySessionInput } from '../../types/planner';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

interface StudySessionModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: StudySession | null;
  userId: string;
  subjects: Subject[];
  defaultSubjectId?: string;
  defaultModuleId?: string;
  defaultDate?: string;
  onClose: () => void;
  onSubmit: (input: StudySessionInput) => Promise<void>;
}

const DURATION_PRESETS = [
  { label: '25m (Pomodoro)', value: 25 },
  { label: '45m (Standard)', value: 45 },
  { label: '60m (1 Hour)', value: 60 },
  { label: '90m (Deep Study)', value: 90 },
  { label: '120m (2 Hours)', value: 120 },
];

const StudySessionModalForm: React.FC<{
  mode: 'create' | 'edit';
  initialData?: StudySession | null;
  userId: string;
  subjects: Subject[];
  defaultSubjectId?: string;
  defaultModuleId?: string;
  defaultDate?: string;
  onClose: () => void;
  onSubmit: (input: StudySessionInput) => Promise<void>;
}> = ({
  mode,
  initialData,
  userId,
  subjects,
  defaultSubjectId,
  defaultModuleId,
  defaultDate,
  onClose,
  onSubmit,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultTime = '10:00';

  const [title, setTitle] = useState(initialData?.title || '');
  const [subjectId, setSubjectId] = useState<string>(
    initialData?.subjectId || defaultSubjectId || (subjects[0]?.id || '')
  );

  // Sync subjectId if subjects arrive or change
  useEffect(() => {
    if ((!subjectId || !subjects.some((s) => s.id === subjectId)) && subjects.length > 0) {
      setSubjectId(
        defaultSubjectId && subjects.some((s) => s.id === defaultSubjectId)
          ? defaultSubjectId
          : subjects[0].id
      );
    }
  }, [subjects, subjectId, defaultSubjectId]);

  const [moduleId, setModuleId] = useState<string>(
    initialData?.moduleId || defaultModuleId || ''
  );
  const [date, setDate] = useState(initialData?.date || defaultDate || todayStr);
  const [startTime, setStartTime] = useState(initialData?.startTime || defaultTime);
  const [durationMinutes, setDurationMinutes] = useState<number>(initialData?.durationMinutes || 45);
  const [description, setDescription] = useState(initialData?.description || '');
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch modules for selected subject
  useEffect(() => {
    let isCancelled = false;
    const fetchSubjectModules = async () => {
      if (!subjectId) {
        await Promise.resolve();
        if (!isCancelled) setModules([]);
        return;
      }

      setLoadingModules(true);
      try {
        const fetched = await getModules(userId, subjectId);
        if (!isCancelled) {
          setModules(fetched);
        }
      } catch (err) {
        console.error('Failed to load modules for session modal:', err);
      } finally {
        if (!isCancelled) setLoadingModules(false);
      }
    };

    fetchSubjectModules();
    return () => {
      isCancelled = true;
    };
  }, [userId, subjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Please enter a session title or study topic.');
      return;
    }
    if (!subjectId) {
      setErrorMsg('Please select a subject.');
      return;
    }
    if (!date) {
      setErrorMsg('Please select a date.');
      return;
    }
    if (!startTime) {
      setErrorMsg('Please specify a start time.');
      return;
    }
    if (durationMinutes < 5) {
      setErrorMsg('Duration must be at least 5 minutes.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        subjectId,
        moduleId: moduleId || null,
        title: cleanTitle,
        date,
        startTime,
        durationMinutes,
        description: description.trim(),
        status: initialData?.status || 'upcoming',
      });
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save study session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="modal-dialog" style={{ maxWidth: '600px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(14, 165, 233, 0.35)',
              }}
            >
              <Calendar size={18} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {mode === 'create' ? 'Schedule Study Session' : 'Edit Study Session'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {mode === 'create'
                  ? 'Plan your revision blocks, topics, and duration'
                  : 'Update session time, goal, or topic'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close dialog"
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div className="auth-alert auth-alert-error" style={{ marginBottom: '4px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="sessionTitle">
              Session Title / Study Goal *
            </label>
            <input
              id="sessionTitle"
              type="text"
              placeholder="e.g. Chapter 4 Practice Problems & Formula Sheet"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '14px' }}
              required
              autoFocus
            />
          </div>

          {/* Subject & Module */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="sessionSubject">
                Subject *
              </label>
              <select
                id="sessionSubject"
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setModuleId('');
                }}
                className="input-field"
                required
              >
                {subjects.length === 0 && <option value="">No subjects available</option>}
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="sessionModule">
                Module / Chapter (Optional)
              </label>
              <select
                id="sessionModule"
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="input-field"
                disabled={loadingModules || modules.length === 0}
              >
                <option value="">General Subject Study</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.order} - {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Start Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="sessionDate">
                Date *
              </label>
              <input
                id="sessionDate"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '14px' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="sessionTime">
                Start Time *
              </label>
              <input
                id="sessionTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '14px' }}
                required
              />
            </div>
          </div>

          {/* Duration Presets */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>
                Duration: {durationMinutes} minutes ({Math.floor(durationMinutes / 60) > 0 ? `${Math.floor(durationMinutes / 60)}h ` : ''}{durationMinutes % 60 > 0 ? `${durationMinutes % 60}m` : ''})
              </label>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Quick Select</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {DURATION_PRESETS.map((p) => {
                const isSelected = durationMinutes === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setDurationMinutes(p.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isSelected
                        ? '1px solid var(--accent-primary)'
                        : '1px solid var(--border-subtle)',
                      background: isSelected
                        ? 'rgba(99, 102, 241, 0.15)'
                        : 'var(--social-btn-bg)',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <input
              type="range"
              min={10}
              max={180}
              step={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
          </div>

          {/* Optional Notes / Goal */}
          <div className="form-group">
            <label className="form-label" htmlFor="sessionDesc">
              Study Notes / Checklist (Optional)
            </label>
            <textarea
              id="sessionDesc"
              rows={3}
              placeholder="e.g. Complete exercises 1-15, review lecture slide deck, do 10 flashcards"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              style={{ padding: '10px 14px', resize: 'vertical' }}
            />
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <Button variant="secondary" size="md" type="button" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" disabled={loading}>
              {loading && <Loader2 size={16} className="spin" />}
              <span>{loading ? 'Saving...' : mode === 'create' ? 'Schedule Session' : 'Save Changes'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const StudySessionModal: React.FC<StudySessionModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <StudySessionModalForm key={props.initialData?.id || `new-session-${props.defaultDate || ''}-${props.subjects.map((s) => s.id).join('-')}`} {...props} />;
};
