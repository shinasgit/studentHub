import React, { useState } from 'react';
import { X, Layers, AlertCircle, Loader2, Upload, Paperclip, FileText } from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { Module, ModuleInput } from '../../types/module';
import { validateFile, saveFileToVault, formatBytes } from '../../services/fileStorageService';

interface ModuleModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: Module | null;
  defaultOrder?: number;
  onClose: () => void;
  onSubmit: (input: ModuleInput) => Promise<void>;
}

const ModuleModalForm: React.FC<{
  mode: 'create' | 'edit';
  initialData?: Module | null;
  defaultOrder?: number;
  onClose: () => void;
  onSubmit: (input: ModuleInput) => Promise<void>;
}> = ({ mode, initialData, defaultOrder = 1, onClose, onSubmit }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [order, setOrder] = useState<number>(initialData?.order ?? defaultOrder);
  const [completed, setCompleted] = useState<boolean>(initialData?.completed || false);
  const [fileName, setFileName] = useState<string | null>(initialData?.fileName || null);
  const [fileUrl, setFileUrl] = useState<string | null>(initialData?.fileUrl || null);
  const [fileSize, setFileSize] = useState<string | null>(initialData?.fileSize || null);
  const [fileStorageKey, setFileStorageKey] = useState<string | null>(initialData?.fileStorageKey || null);
  const [fileType, setFileType] = useState<string | null>(initialData?.fileType || null);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size and format
    const check = validateFile(file);
    if (!check.valid) {
      setErrorMsg(check.error || 'Invalid file format.');
      return;
    }

    setUploadingFile(true);
    setErrorMsg(null);

    try {
      const storageKey = `vault_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      await saveFileToVault(storageKey, file);

      const url = URL.createObjectURL(file);
      const sizeStr = formatBytes(file.size);

      setFileName(file.name);
      setFileUrl(url);
      setFileSize(sizeStr);
      setFileStorageKey(storageKey);
      setFileType(file.type || 'application/octet-stream');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save file to local document vault.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = () => {
    setFileName(null);
    setFileUrl(null);
    setFileSize(null);
    setFileStorageKey(null);
    setFileType(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length < 2) {
      setErrorMsg('Module title must be at least 2 characters long.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        title: cleanTitle,
        order: Number(order) || 1,
        completed,
        fileName,
        fileUrl,
        fileSize,
        fileStorageKey,
        fileType,
      });
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save module. Please try again.');
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
      <div className="modal-dialog" style={{ maxWidth: '480px' }}>
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
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)',
              }}
            >
              <Layers size={18} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {mode === 'create' ? 'Add Subject Module' : 'Edit Module'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {mode === 'create'
                  ? 'Break down your subject and attach revision files'
                  : 'Update module title, order, and attachments'}
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

          <div className="form-group">
            <label className="form-label" htmlFor="moduleTitle">
              Module Title / Chapter *
            </label>
            <input
              id="moduleTitle"
              type="text"
              placeholder="e.g. Unit 1: Arrays, Stacks & Queues"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '14px' }}
              required
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="moduleOrder">
                Order / Sequence #
              </label>
              <input
                id="moduleOrder"
                type="number"
                min={1}
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
                className="input-field"
                style={{ paddingLeft: '14px' }}
                required
              />
            </div>

            <div className="form-group" style={{ justifyContent: 'center' }}>
              <label className="form-label" style={{ marginBottom: '8px' }}>
                Status
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)',
                  paddingTop: '6px',
                }}
              >
                <input
                  type="checkbox"
                  checked={completed}
                  onChange={(e) => setCompleted(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: 'var(--accent-primary)',
                    cursor: 'pointer',
                  }}
                />
                <span>Mark as Completed</span>
              </label>
            </div>
          </div>

          {/* Attach Study Material from File Manager */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Paperclip size={14} color="var(--accent-primary)" />
              <span>Attach File / Notes (Optional)</span>
            </label>

            {fileName ? (
              /* Attached file preview chip */
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <FileText size={18} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '280px',
                      }}
                    >
                      {fileName}
                    </div>
                    {fileSize && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {fileSize} • Ready to view in app
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveFile}
                  aria-label="Remove attached file"
                  title="Remove File"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
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
                  <X size={16} />
                </button>
              </div>
            ) : (
              /* Upload trigger */
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px dashed var(--border-subtle)',
                  background: 'var(--social-btn-bg)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  gap: '6px',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.background = 'var(--social-btn-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'var(--social-btn-bg)';
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                  }}
                >
                  {uploadingFile ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                </div>
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {uploadingFile ? 'Saving to local vault...' : 'Upload from File Manager'}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Supports PDF, DOCX, PPTX, TXT, Images (Max 25 MB)
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,image/*"
                  onChange={handleFileChange}
                  disabled={uploadingFile}
                  style={{ display: 'none' }}
                />
              </label>
            )}
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
                <span>{mode === 'create' ? 'Add Module' : 'Save Changes'}</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ModuleModal: React.FC<ModuleModalProps> = ({
  isOpen,
  mode,
  initialData,
  defaultOrder,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <ModuleModalForm
      key={initialData?.id || `new-module-${defaultOrder}`}
      mode={mode}
      initialData={initialData}
      defaultOrder={defaultOrder}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
};
