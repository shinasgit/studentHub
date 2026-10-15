import React, { useState } from 'react';
import { X, BookOpen, AlertCircle, Loader2, Check } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { PRESET_COLORS, DEFAULT_SEMESTERS, type Subject, type SubjectInput } from '../../types/subject';

interface SubjectModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: Subject | null;
  onClose: () => void;
  onSubmit: (input: SubjectInput) => Promise<void>;
}

interface SubjectModalFormProps {
  mode: 'create' | 'edit';
  initialData?: Subject | null;
  onClose: () => void;
  onSubmit: (input: SubjectInput) => Promise<void>;
}

const SubjectModalForm: React.FC<SubjectModalFormProps> = ({
  mode,
  initialData,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [semester, setSemester] = useState(initialData?.semester || 'Semester 1');
  const [description, setDescription] = useState(initialData?.description || '');
  const [color, setColor] = useState(initialData?.color || PRESET_COLORS[0].value);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Subject name must be at least 2 characters long.');
      return;
    }

    if (!cleanCode || cleanCode.length < 2) {
      setErrorMsg('Subject code must be at least 2 characters (e.g. CS101, MATH201).');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        name: cleanName,
        code: cleanCode,
        semester,
        description: description.trim(),
        color,
      });
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save subject. Please try again.');
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
      <div className="modal-dialog">
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
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 16px ${color}55`,
                transition: 'background 0.3s ease',
              }}
            >
              <BookOpen size={18} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {mode === 'create' ? 'Add New Subject' : 'Edit Subject'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {mode === 'create' ? 'Define a new course or unit in your study hub' : 'Update subject information and settings'}
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
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {errorMsg && (
            <div className="auth-alert auth-alert-error" style={{ marginBottom: '4px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Name & Code grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="subjectName">
                Subject Name *
              </label>
              <input
                id="subjectName"
                type="text"
                placeholder="e.g. Data Structures & Algorithms"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '14px' }}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="subjectCode">
                Code *
              </label>
              <input
                id="subjectCode"
                type="text"
                placeholder="e.g. CS201"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="input-field"
                style={{ paddingLeft: '14px', textTransform: 'uppercase' }}
                required
              />
            </div>
          </div>

          {/* Semester */}
          <div className="form-group">
            <label className="form-label" htmlFor="subjectSemester">
              Semester / Term
            </label>
            <select
              id="subjectSemester"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="select-field"
            >
              {DEFAULT_SEMESTERS.map((sem) => (
                <option key={sem} value={sem} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  {sem}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="subjectDescription">
              Description / Notes (Optional)
            </label>
            <textarea
              id="subjectDescription"
              placeholder="e.g. Core topics: Trees, Graphs, Sorting, Dynamic Programming"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="textarea-field"
              rows={3}
            />
          </div>

          {/* Color theme selection */}
          <div className="form-group">
            <label className="form-label">Accent Theme</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '4px' }}>
              {PRESET_COLORS.map((preset) => {
                const isSelected = color === preset.value;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setColor(preset.value)}
                    title={preset.name}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: preset.value,
                      border: isSelected ? '3px solid #ffffff' : '2px solid transparent',
                      boxShadow: isSelected ? `0 0 12px ${preset.value}` : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform var(--transition-fast)',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                    }}
                  >
                    {isSelected && <Check size={16} color="#ffffff" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
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
              marginTop: '4px',
            }}
          >
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{mode === 'create' ? 'Create Subject' : 'Save Changes'}</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <SubjectModalForm
      key={initialData?.id || 'new-subject'}
      mode={mode}
      initialData={initialData}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
};
