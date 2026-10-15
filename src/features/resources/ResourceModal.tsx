import React, { useState } from 'react';
import { X, FileText, AlertCircle, Loader2, Upload } from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { StudyResource, ResourceInput, ResourceType } from '../../types/resource';
import { RESOURCE_TYPE_LABELS } from '../../types/resource';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

interface ResourceModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: StudyResource | null;
  subjects: Subject[];
  modules?: Module[];
  defaultSubjectId?: string;
  defaultModuleId?: string | null;
  onClose: () => void;
  onSubmit: (input: ResourceInput) => Promise<void>;
}

const ResourceModalForm: React.FC<{
  mode: 'create' | 'edit';
  initialData?: StudyResource | null;
  subjects: Subject[];
  modules?: Module[];
  defaultSubjectId?: string;
  defaultModuleId?: string | null;
  onClose: () => void;
  onSubmit: (input: ResourceInput) => Promise<void>;
}> = ({
  mode,
  initialData,
  subjects,
  modules = [],
  defaultSubjectId,
  defaultModuleId,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [type, setType] = useState<ResourceType>(initialData?.type || 'pdf');
  const [subjectId, setSubjectId] = useState(
    initialData?.subjectId || defaultSubjectId || (subjects[0]?.id ?? '')
  );
  const [moduleId, setModuleId] = useState<string>(
    initialData?.moduleId || defaultModuleId || ''
  );
  const [url, setUrl] = useState(initialData?.url || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter modules for selected subject
  const availableModules = modules.filter((m) => m.subjectId === subjectId);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        setErrorMsg('Please select a valid PDF file.');
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
      setLocalFileName(file.name);
      if (!title) {
        setTitle(file.name.replace(/\.pdf$/i, ''));
      }
      setType('pdf');
      setErrorMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    const cleanUrl = url.trim();

    if (!cleanTitle || cleanTitle.length < 2) {
      setErrorMsg('Resource title must be at least 2 characters long.');
      return;
    }

    if (!cleanUrl) {
      setErrorMsg('Please provide a resource URL or select a local PDF file.');
      return;
    }

    if (!subjectId) {
      setErrorMsg('Please select a subject for this resource.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        title: cleanTitle,
        type,
        subjectId,
        moduleId: moduleId || null,
        url: cleanUrl,
        description: description.trim(),
      });
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save resource. Please try again.');
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
      <div className="modal-dialog" style={{ maxWidth: '520px' }}>
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
                background: 'linear-gradient(135deg, #ef4444, #f43f5e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(239, 68, 68, 0.4)',
              }}
            >
              <FileText size={18} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {mode === 'create' ? 'Add Study Resource' : 'Edit Resource'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Attach PDFs, lecture notes, syllabus, or question papers
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
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {errorMsg && (
            <div className="auth-alert auth-alert-error" style={{ marginBottom: '4px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="resTitle">
              Resource Title *
            </label>
            <input
              id="resTitle"
              type="text"
              placeholder="e.g. Unit 1 Lecture Slides & Formulas"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '14px' }}
              required
              autoFocus
            />
          </div>

          {/* Type & Subject selection grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="resType">
                Resource Type
              </label>
              <select
                id="resType"
                value={type}
                onChange={(e) => setType(e.target.value as ResourceType)}
                className="select-field"
              >
                {Object.entries(RESOURCE_TYPE_LABELS).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="resSubject">
                Subject *
              </label>
              <select
                id="resSubject"
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setModuleId('');
                }}
                className="select-field"
                required
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Module Selection if available */}
          {availableModules.length > 0 && (
            <div className="form-group">
              <label className="form-label" htmlFor="resModule">
                Associate with Module (Optional)
              </label>
              <select
                id="resModule"
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="select-field"
              >
                <option value="">General Subject Resource (All modules)</option>
                {availableModules.map((m) => (
                  <option key={m.id} value={m.id}>
                    Unit {m.order}: {m.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* URL or Local File Upload */}
          <div className="form-group">
            <label className="form-label" htmlFor="resUrl">
              PDF Link / External URL *
            </label>
            <input
              id="resUrl"
              type="url"
              placeholder="https://example.com/notes.pdf or Google Drive link"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setLocalFileName(null);
              }}
              className="input-field"
              style={{ paddingLeft: '14px' }}
              required={!localFileName}
            />

            {/* Local PDF File Picker Option (Zero cost HTML5 browser reader) */}
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--social-btn-bg)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <Upload size={14} />
                <span>Select Local PDF File</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>

              {localFileName && (
                <span style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 500 }}>
                  ✓ {localFileName} loaded for in-browser reading
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="resDesc">
              Notes / Summary (Optional)
            </label>
            <textarea
              id="resDesc"
              placeholder="e.g. Midterm revision questions, covers chapters 1-4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="textarea-field"
              rows={2}
            />
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '12px',
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
                <span>{mode === 'create' ? 'Add Resource' : 'Save Changes'}</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ResourceModal: React.FC<ResourceModalProps> = ({
  isOpen,
  mode,
  initialData,
  subjects,
  modules,
  defaultSubjectId,
  defaultModuleId,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <ResourceModalForm
      key={initialData?.id || `new-res-${defaultSubjectId || 'general'}`}
      mode={mode}
      initialData={initialData}
      subjects={subjects}
      modules={modules}
      defaultSubjectId={defaultSubjectId}
      defaultModuleId={defaultModuleId}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
};
