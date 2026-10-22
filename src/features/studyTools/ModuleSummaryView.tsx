import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  FileText,
  Sparkles,
  Copy,
  Save,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { createNote } from '../../services/noteService';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';
import type { StudyMaterial } from '../../types/studyTools';

interface ModuleSummaryViewProps {
  user: User;
  subjects: Subject[];
  modules: Module[];
  selectedSubjectId: string;
  selectedModuleId: string;
  materials?: StudyMaterial[];
  loadingMaterials?: boolean;
}

export const ModuleSummaryView: React.FC<ModuleSummaryViewProps> = ({
  user,
  subjects,
  modules,
  selectedSubjectId,
  selectedModuleId,
  materials = [],
  loadingMaterials: _loadingMaterials = false,
}) => {
  const [summaryText, setSummaryText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiNotice, setShowAiNotice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleGenerateSummary = () => {
    if (selectedSubjectId === 'all') {
      setErrorMsg('Please select a specific subject to generate a summary.');
      return;
    }
    if (materials.length === 0) {
      setErrorMsg('WARNING: No study materials found for this selection. Upload a PDF or add a link to this module first.');
      return;
    }
    setErrorMsg(null);
    setIsGenerating(true);

    // Per project constraints: AI/LLM generation is reserved for Stage 6.
    // Display clear, honest notice without generating fake text.
    setTimeout(() => {
      setIsGenerating(false);
      setShowAiNotice(true);
    }, 400);
  };

  const handleCopy = async () => {
    if (!summaryText.trim()) return;
    try {
      await navigator.clipboard.writeText(summaryText);
      triggerToast('Summary copied to clipboard!');
    } catch {
      triggerToast('Failed to copy to clipboard.');
    }
  };

  const handleSaveToNotes = async () => {
    if (!summaryText.trim()) {
      setErrorMsg('Cannot save an empty summary. Enter summary content first.');
      return;
    }
    if (!selectedSubject) {
      setErrorMsg('Please select an associated subject before saving.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const scopeLabel = selectedModule
        ? `Module ${selectedModule.order}: ${selectedModule.title}`
        : selectedSubject.name;
      const noteTitle = `Summary: ${scopeLabel}`;

      await createNote(user.uid, {
        subjectId: selectedSubject.id,
        moduleId: selectedModule ? selectedModule.id : null,
        title: noteTitle,
        content: summaryText,
      });

      triggerToast('Summary saved to Personal Notes!');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save summary to notes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="study-tool-content animate-fade-in">
      {/* Toast */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 90,
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeInSlideUp 0.2s ease-out',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <CheckCircle2 size={16} color="var(--color-success)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem' }}>{toastMsg}</span>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="auth-alert auth-alert-error" style={{ marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Scope Details Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
            }}
          >
            <FileText size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {selectedSubject ? selectedSubject.name : 'All Subjects'}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Scope:{' '}
              {selectedModule
                ? `Module ${selectedModule.order}: ${selectedModule.title}`
                : selectedSubject
                ? 'Entire Subject'
                : 'Select a subject above'}
              {materials.length > 0 && (
                <span> &bull; <strong style={{ color: 'var(--text-primary)' }}>{materials.length}</strong> connected {materials.length === 1 ? 'material' : 'materials'} ({materials.filter(m => m.type === 'PDF').length} PDFs, {materials.filter(m => m.type === 'Web').length} Links)</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerateSummary}
            disabled={!selectedSubject || isGenerating}
            title={!selectedSubject ? 'Select a subject first' : 'Generate module summary'}
          >
            <Sparkles size={14} /> {isGenerating ? 'Generating...' : 'Generate Summary'}
          </Button>
          {summaryText.trim() && (
            <>
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                <Copy size={14} /> Copy
              </Button>
              <Button variant="secondary" size="sm" onClick={handleSaveToNotes} disabled={isSaving}>
                <Save size={14} /> {isSaving ? 'Saving...' : 'Save to Notes'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* AI Connection Notice (Stage 6) */}
      {showAiNotice && (
        <div
          style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            marginBottom: '20px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <Info size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>AI Summary Generator Notice:</strong>
            <p style={{ marginTop: '4px', marginBottom: '8px' }}>
              Automatic AI document summarization from your uploaded PDFs and lecture notes is scheduled for connection in Stage 6 (LLM &amp; RAG integration). Per development guidelines, fake or placeholder AI text is strictly avoided.
            </p>
            <p style={{ margin: 0 }}>
              In the meantime, you can write or compile your key module summary notes below, and save them directly to your personal notes archive.
            </p>
          </div>
        </div>
      )}

      {/* Summary Area */}
      <div
        className="glass-panel"
        style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Module Summary &amp; Key Takeaways
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {summaryText.length} characters
          </span>
        </div>

        <textarea
          value={summaryText}
          onChange={(e) => setSummaryText(e.target.value)}
          placeholder={
            selectedSubject
              ? `Enter or draft core points, formulas, definitions, and conclusions for ${
                  selectedModule ? selectedModule.title : selectedSubject.name
                }...`
              : 'Select a subject from the selector above to begin drafting your module summary.'
          }
          className="input-field"
          style={{
            width: '100%',
            minHeight: '260px',
            padding: '14px',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '8px' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Tip: Summaries saved to notes will automatically link to{' '}
            {selectedSubject ? selectedSubject.name : 'your subject'}.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {summaryText.trim() && (
              <>
                <Button variant="secondary" size="sm" onClick={handleCopy}>
                  <Copy size={14} /> Copy Text
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveToNotes} disabled={isSaving}>
                  <Save size={14} /> {isSaving ? 'Saving...' : 'Save to Personal Notes'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
