import React, { useState, useRef, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  FileText,
  Sparkles,
  Copy,
  Save,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  XCircle,
  Check,
  Cpu,
  Layers,
  FileCheck2,
  ScanText,
  Eye,
  Edit3,
  Globe,
  Video,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { createNote } from '../../services/noteService';
import {
  generateModuleSummary,
  type SummaryProgress,
  type ModuleSummaryResult,
} from '../../services/summaryService';
import { getSelectedModel, checkOllamaConnection } from '../../services/ollamaService';
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
  loadingMaterials = false,
}) => {
  // All eligible study materials in current scope (PDFs, Web Articles, YouTube Videos)
  const availableMaterials = useMemo(() => {
    return materials.filter(
      (m) =>
        m.type === 'PDF' ||
        m.type === 'Web' ||
        m.name.toLowerCase().endsWith('.pdf') ||
        m.url?.startsWith('http://') ||
        m.url?.startsWith('https://')
    );
  }, [materials]);

  // Material selection mode: 'all' or a specific material ID
  const [selectedMaterialScope, setSelectedMaterialScope] = useState<string>('all');

  // Generation & Results State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressState, setProgressState] = useState<SummaryProgress | null>(null);
  const [summaryResult, setSummaryResult] = useState<ModuleSummaryResult | null>(null);
  const [editableText, setEditableText] = useState<string>('');
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

  // Notification and Error States
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Determine active materials based on student's selection
  const targetMaterials = useMemo(() => {
    if (selectedMaterialScope === 'all') {
      return availableMaterials;
    }
    return availableMaterials.filter((p) => p.id === selectedMaterialScope);
  }, [availableMaterials, selectedMaterialScope]);

  // Main Summary Generation Handler
  const handleGenerateSummary = async () => {
    if (!selectedSubject) {
      setErrorMsg('Please select a subject from the selector above first.');
      return;
    }

    if (targetMaterials.length === 0) {
      setErrorMsg(
        `No study materials (PDFs or web links) found for this ${selectedModule ? 'module' : 'subject'}. Please attach or upload materials first.`
      );
      return;
    }

    // Quick pre-check: verify Ollama status before kicking off extraction
    try {
      const conn = await checkOllamaConnection();
      if (!conn.connected) {
        setErrorMsg(
          conn.error?.message ||
          'Ollama is not running. Please launch Ollama on your computer or test the connection in the panel above.'
        );
        return;
      }
    } catch {
      // Proceed; deeper error handler will catch if unreachable
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setProgressState({
      stage: 'resolving_files',
      message: 'Preparing study materials...',
      percent: 5,
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const activeModel = getSelectedModel() || 'llama3.2:3b';
      const result = await generateModuleSummary({
        materials: targetMaterials,
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        moduleId: selectedModule ? selectedModule.id : null,
        moduleName: selectedModule ? selectedModule.title : undefined,
        model: activeModel,
        abortSignal: abortController.signal,
        onProgress: (p) => setProgressState(p),
      });

      setSummaryResult(result);
      setEditableText(result.summaryText);
      triggerToast('Module summary generated successfully!');
    } catch (err: unknown) {
      const errorObj = err as Error & { info?: { message: string; suggestion: string } };
      if (abortController.signal.aborted) {
        setErrorMsg('Summary generation was cancelled.');
      } else {
        const fullMsg = errorObj.info?.suggestion
          ? `${errorObj.message} (${errorObj.info.suggestion})`
          : errorObj.message || 'Failed to generate module summary.';
        setErrorMsg(fullMsg);
      }
    } finally {
      setIsGenerating(false);
      setProgressState(null);
      abortControllerRef.current = null;
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      setErrorMsg('Summary generation was cancelled by student.');
    }
  };

  const handleCopySummary = async () => {
    const textToCopy = editableText || summaryResult?.summaryText;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      triggerToast('Summary copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      triggerToast('Failed to copy to clipboard.');
    }
  };

  const handleExportTextFile = () => {
    const textToExport = editableText || summaryResult?.summaryText;
    if (!textToExport) return;

    const scopeName = selectedModule
      ? `${selectedSubject?.name || 'Subject'}_Module${selectedModule.order}`
      : `${selectedSubject?.name || 'Subject'}_AllModules`;

    const blob = new Blob([textToExport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${scopeName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Summary.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast('Summary exported as Markdown file!');
  };

  const handleSaveToNotes = async () => {
    const textToSave = editableText || summaryResult?.summaryText;
    if (!textToSave || !textToSave.trim()) {
      setErrorMsg('Cannot save an empty summary.');
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
      const noteTitle = `AI Summary: ${scopeLabel}`;

      await createNote(user.uid, {
        subjectId: selectedSubject.id,
        moduleId: selectedModule ? selectedModule.id : null,
        title: noteTitle,
        content: textToSave,
      });

      triggerToast('Summary saved to Personal Study Notes!');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save summary to notes.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to parse markdown into readable visual sections
  const parsedSections = useMemo(() => {
    const text = editableText || summaryResult?.summaryText;
    if (!text) return [];

    // Split on ### or ## headings
    const regex = /(?:^|\n)###?\s+([^\n]+)\n/g;
    const matches = Array.from(text.matchAll(regex));

    if (matches.length === 0) {
      return [{ title: 'Module Summary', content: text }];
    }

    const sections: Array<{ title: string; content: string }> = [];
    for (let i = 0; i < matches.length; i++) {
      const title = matches[i][1].trim();
      const startIndex = matches[i].index! + matches[i][0].length;
      const endIndex = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const content = text.substring(startIndex, endIndex).trim();
      sections.push({ title, content });
    }

    return sections;
  }, [editableText, summaryResult]);

  return (
    <div className="study-tool-content animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toast Notification */}
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
        <div
          className="auth-alert auth-alert-error"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem' }}>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}
          >
            <XCircle size={15} />
          </button>
        </div>
      )}

      {/* Scope Details & Material Selection Card */}
      <div
        className="glass-panel"
        style={{
          padding: '18px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent-primary-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <FileText size={20} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {selectedSubject ? selectedSubject.name : 'All Subjects'}
                </h3>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {selectedModule ? `Module #${selectedModule.order}: ${selectedModule.title}` : 'Entire Subject'}
                </span>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {loadingMaterials ? (
                  <span>Loading materials...</span>
                ) : (
                  <span>
                    <strong style={{ color: 'var(--text-primary)' }}>{availableMaterials.length}</strong> study materials (PDFs & Web links) available in this scope
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerateSummary}
              disabled={isGenerating || !selectedSubject || availableMaterials.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Generating...
                </>
              ) : summaryResult ? (
                <>
                  <RefreshCw size={13} /> Regenerate Summary
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Generate Summary
                </>
              )}
            </Button>

            {isGenerating && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelGeneration}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
              >
                <XCircle size={13} color="var(--color-danger)" /> Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Study Material Selector (PDFs & Web Resources) */}
        {availableMaterials.length > 0 && (
          <div
            style={{
              paddingTop: '10px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Source Material:
            </span>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
              <button
                type="button"
                onClick={() => setSelectedMaterialScope('all')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: selectedMaterialScope === 'all' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: selectedMaterialScope === 'all' ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Layers size={12} />
                <span>All Materials in Scope ({availableMaterials.length})</span>
              </button>

              {availableMaterials.map((mat) => {
                const isSelected = selectedMaterialScope === mat.id;
                const isPdf = mat.type === 'PDF' || mat.name.toLowerCase().endsWith('.pdf');
                const isYouTube =
                  mat.url?.includes('youtube.com') ||
                  mat.url?.includes('youtu.be') ||
                  mat.name.toLowerCase().includes('youtube');

                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => setSelectedMaterialScope(mat.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      background: isSelected ? 'var(--accent-primary-subtle)' : 'var(--bg-card)',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      maxWidth: '220px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                    title={mat.name}
                  >
                    {isPdf ? (
                      <FileText size={12} color="#ef4444" style={{ flexShrink: 0 }} />
                    ) : isYouTube ? (
                      <Video size={12} color="#f59e0b" style={{ flexShrink: 0 }} />
                    ) : (
                      <Globe size={12} color="#3b82f6" style={{ flexShrink: 0 }} />
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state when no materials in scope */}
        {!loadingMaterials && availableMaterials.length === 0 && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={15} color="var(--color-warning)" />
            <span>
              No materials (PDFs or web links) attached to this {selectedModule ? 'module' : 'subject'} yet. Upload PDFs or add web links inside course modules to enable AI summarization.
            </span>
          </div>
        )}

        {/* Generation Progress Bar */}
        {isGenerating && progressState && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{progressState.message}</span>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{progressState.percent}%</span>
            </div>

            <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'var(--border-subtle)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressState.percent}%`,
                  height: '100%',
                  background: 'var(--accent-primary)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Generated Summary Card */}
      {summaryResult && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Header of Results */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <FileCheck2 size={18} color="var(--color-success)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Structured Module Summary
                </h3>

                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--accent-primary-subtle)',
                    color: 'var(--accent-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Cpu size={11} /> {summaryResult.modelUsed}
                </span>

                {summaryResult.hasOcr && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--color-warning-subtle)',
                      color: 'var(--color-warning)',
                      border: '1px solid var(--color-warning-border)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Some pages were scanned and processed with OCR"
                  >
                    <ScanText size={11} /> OCR Enhanced
                  </span>
                )}
              </div>

              {/* Source Provenance Info */}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Sources: {summaryResult.sources.map((s) => `${s.fileName} (${s.pageCount} pgs)`).join(', ')} &bull;{' '}
                Total characters: {summaryResult.totalSourceCharacters.toLocaleString()} &bull; Duration:{' '}
                {(summaryResult.durationMs / 1000).toFixed(1)}s
              </div>
            </div>

            {/* Actions: View Mode Switcher, Copy, Save, Export */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'flex',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('formatted')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: viewMode === 'formatted' ? 'var(--bg-card)' : 'transparent',
                    color: viewMode === 'formatted' ? 'var(--text-primary)' : 'var(--text-muted)',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Eye size={12} /> Formatted
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('raw')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: viewMode === 'raw' ? 'var(--bg-card)' : 'transparent',
                    color: viewMode === 'raw' ? 'var(--text-primary)' : 'var(--text-muted)',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Edit3 size={12} /> Edit Text
                </button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopySummary}
                style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Copy entire summary to clipboard"
              >
                {copied ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportTextFile}
                style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Download as Markdown/Text file"
              >
                <Download size={12} />
                <span>Export .md</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveToNotes}
                disabled={isSaving}
                style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Save summary to Personal Notes"
              >
                <Save size={12} />
                <span>{isSaving ? 'Saving...' : 'Save to Notes'}</span>
              </Button>
            </div>
          </div>

          {/* OCR Accuracy Advisory if OCR was applied */}
          {summaryResult.hasOcr && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-warning-subtle)',
                border: '1px solid var(--color-warning-border)',
                fontSize: '0.75rem',
                color: 'var(--color-warning)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>
                Note: This summary includes text from scanned PDF pages recognized via OCR. Minor recognition errors in the scan may occasionally affect definitions or formulas.
              </span>
            </div>
          )}

          {/* Formatted View (Clean Sections) */}
          {viewMode === 'formatted' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {parsedSections.map((sec, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <h4
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: 'var(--accent-primary)',
                      margin: '0 0 8px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>{sec.title}</span>
                  </h4>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      lineHeight: 1.6,
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {sec.content}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Editable Raw View */
            <textarea
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              rows={16}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono, monospace)',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          )}
        </div>
      )}

      {/* Initial Empty State / Instructions */}
      {!summaryResult && !isGenerating && (
        <div
          className="glass-panel"
          style={{
            padding: '36px 24px',
            textAlign: 'center',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--accent-primary-subtle)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={24} />
          </div>

          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              Ready to Generate Module Summary
            </h4>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, maxWidth: '520px', lineHeight: 1.5 }}>
              Select your subject and module, choose your source PDFs, and click{' '}
              <strong style={{ color: 'var(--text-primary)' }}>"Generate Summary"</strong>. Your local{' '}
              <strong style={{ color: 'var(--accent-primary)' }}>Llama 3.2 (3B)</strong> engine will extract and synthesize the key concepts, definitions, formulas, and revision points.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleGenerateSummary}
            disabled={!selectedSubject || availableMaterials.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}
          >
            <Sparkles size={16} /> Generate Summary Now
          </Button>
        </div>
      )}
    </div>
  );
};
