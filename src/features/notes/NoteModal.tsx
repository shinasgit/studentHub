import React, { useState, useEffect } from 'react';
import { X, StickyNote, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { getModules } from '../../services/moduleService';
import type { Note, NoteInput } from '../../types/note';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

interface NoteModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: Note | null;
  userId: string;
  subjects: Subject[];
  defaultSubjectId?: string;
  defaultModuleId?: string;
  onClose: () => void;
  onSubmit: (input: NoteInput) => Promise<void>;
}

// Inner form with key-based initialization
const NoteModalForm: React.FC<{
  mode: 'create' | 'edit';
  initialData?: Note | null;
  userId: string;
  subjects: Subject[];
  defaultSubjectId?: string;
  defaultModuleId?: string;
  onClose: () => void;
  onSubmit: (input: NoteInput) => Promise<void>;
}> = ({
  mode,
  initialData,
  userId,
  subjects,
  defaultSubjectId,
  defaultModuleId,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState(initialData?.content || '');
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
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch modules when selected subject changes
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
        console.error('Failed to load modules for subject:', err);
      } finally {
        if (!isCancelled) setLoadingModules(false);
      }
    };

    fetchSubjectModules();
    return () => {
      isCancelled = true;
    };
  }, [userId, subjectId]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (!cleanTitle) {
      setErrorMsg('Note title is required.');
      return;
    }
    if (!subjectId) {
      setErrorMsg('Please select a subject for this note.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        subjectId,
        moduleId: moduleId || null,
        title: cleanTitle,
        content: cleanContent,
      });
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save note. Please try again.');
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
      <div className="modal-dialog" style={{ maxWidth: '640px' }}>
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
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)',
              }}
            >
              <StickyNote size={18} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {mode === 'create' ? 'Create Personal Note' : 'Edit Note'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {mode === 'create'
                  ? 'Record key formulas, revision summaries, and insights'
                  : 'Update your study notes and references'}
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

          {/* Subject & Module Selectors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="noteSubject">
                Subject *
              </label>
              <select
                id="noteSubject"
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
              <label className="form-label" htmlFor="noteModule">
                Module / Unit (Optional)
              </label>
              <select
                id="noteModule"
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="input-field"
                disabled={loadingModules || modules.length === 0}
              >
                <option value="">None (General Subject Note)</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.order} - {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Note Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="noteTitle">
              Note Title *
            </label>
            <input
              id="noteTitle"
              type="text"
              placeholder="e.g. Quick Formula Sheet: Calculus Limits & Continuity"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '14px' }}
              required
              autoFocus
            />
          </div>

          {/* Note Content */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" htmlFor="noteContent" style={{ margin: 0 }}>
                Note Content
              </label>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {wordCount} words • {charCount} chars
              </span>
            </div>
            <textarea
              id="noteContent"
              rows={8}
              placeholder="Write your study notes, important formulas, lecture summaries, key definitions, or code snippets here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input-field"
              style={{
                padding: '12px 14px',
                resize: 'vertical',
                minHeight: '160px',
                lineHeight: 1.6,
                fontFamily: 'inherit',
              }}
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
              <span>{loading ? 'Saving...' : mode === 'create' ? 'Create Note' : 'Update Note'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const NoteModal: React.FC<NoteModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <NoteModalForm key={props.initialData?.id || `new-note-${props.subjects.map((s) => s.id).join('-')}`} {...props} />;
};
