import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { getModules } from '../../services/moduleService';
import type { Flashcard, FlashcardInput } from '../../types/flashcard';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

interface FlashcardModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: Flashcard | null;
  userId: string;
  subjects: Subject[];
  defaultSubjectId?: string;
  defaultModuleId?: string;
  onClose: () => void;
  onSubmit: (input: FlashcardInput) => Promise<void>;
}

const FlashcardModalForm: React.FC<{
  mode: 'create' | 'edit';
  initialData?: Flashcard | null;
  userId: string;
  subjects: Subject[];
  defaultSubjectId?: string;
  defaultModuleId?: string;
  onClose: () => void;
  onSubmit: (input: FlashcardInput) => Promise<void>;
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
  const [question, setQuestion] = useState(initialData?.question || '');
  const [answer, setAnswer] = useState(initialData?.answer || '');
  const [subjectId, setSubjectId] = useState<string>(
    initialData?.subjectId || defaultSubjectId || (subjects[0]?.id || '')
  );
  const [moduleId, setModuleId] = useState<string>(
    initialData?.moduleId || defaultModuleId || ''
  );
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
        console.error('Failed to load modules for flashcard modal:', err);
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

    const cleanQ = question.trim();
    const cleanA = answer.trim();

    if (!cleanQ) {
      setErrorMsg('Please enter a question or prompt for the front of the card.');
      return;
    }
    if (!cleanA) {
      setErrorMsg('Please enter the answer or explanation for the back of the card.');
      return;
    }
    if (!subjectId) {
      setErrorMsg('Please select an associated subject.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        subjectId,
        moduleId: moduleId || null,
        question: cleanQ,
        answer: cleanA,
      });
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save flashcard.');
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
                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(236, 72, 153, 0.35)',
              }}
            >
              <Sparkles size={18} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {mode === 'create' ? 'Create Flashcard' : 'Edit Flashcard'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {mode === 'create'
                  ? 'Add a question-and-answer card for rapid active recall'
                  : 'Update your question prompt and answer explanation'}
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
              <label className="form-label" htmlFor="cardSubject">
                Subject *
              </label>
              <select
                id="cardSubject"
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
              <label className="form-label" htmlFor="cardModule">
                Module / Chapter (Optional)
              </label>
              <select
                id="cardModule"
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="input-field"
                disabled={loadingModules || modules.length === 0}
              >
                <option value="">General Subject</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.order} - {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Front: Question */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" htmlFor="cardQuestion" style={{ margin: 0 }}>
                Front Side (Question / Concept Prompt) *
              </label>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Shown first</span>
            </div>
            <textarea
              id="cardQuestion"
              rows={3}
              placeholder="e.g. What is the time complexity of searching in a Balanced Binary Search Tree?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="input-field"
              style={{ padding: '10px 14px', resize: 'vertical', lineHeight: 1.5 }}
              required
              autoFocus
            />
          </div>

          {/* Back: Answer */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" htmlFor="cardAnswer" style={{ margin: 0 }}>
                Back Side (Answer / Explanation) *
              </label>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Revealed on flip</span>
            </div>
            <textarea
              id="cardAnswer"
              rows={4}
              placeholder="e.g. O(log n) because the tree height is kept proportional to the logarithm of the number of nodes."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="input-field"
              style={{ padding: '10px 14px', resize: 'vertical', lineHeight: 1.5 }}
              required
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
              <span>{loading ? 'Saving...' : mode === 'create' ? 'Create Card' : 'Update Card'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const FlashcardModal: React.FC<FlashcardModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <FlashcardModalForm key={props.initialData?.id || 'new-card'} {...props} />;
};
