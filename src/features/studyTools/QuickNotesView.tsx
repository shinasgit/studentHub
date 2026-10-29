import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import {
  Sparkles,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Download,
  Save,
  RefreshCw,
  XCircle,
  Check,
  Cpu,
  Layers,
  FileCheck2,
  ScanText,
  Eye,
  Edit3,
  BookOpen,
  Globe,
  Video,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { getNotes, createNote, deleteNote } from '../../services/noteService';
import {
  generateQuickNotes,
  type QuickNotesProgress,
  type QuickNotesResult,
} from '../../services/quickNotesService';
import { getSelectedModel, checkOllamaConnection } from '../../services/ollamaService';
import type { Note, NoteInput } from '../../types/note';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';
import type { StudyMaterial } from '../../types/studyTools';

interface QuickNotesViewProps {
  user: User;
  subjects: Subject[];
  modules: Module[];
  selectedSubjectId: string;
  selectedModuleId: string;
  materials?: StudyMaterial[];
  loadingMaterials?: boolean;
}

export const QuickNotesView: React.FC<QuickNotesViewProps> = ({
  user,
  subjects,
  modules,
  selectedSubjectId,
  selectedModuleId,
  materials = [],
  loadingMaterials = false,
}) => {
  // Existing saved personal notes in this scope
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingSavedNotes, setLoadingSavedNotes] = useState(true);

  // Available study materials in current scope (PDFs, Web Articles, YouTube)
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

  // Material selection mode: 'all' or specific material ID
  const [selectedMaterialScope, setSelectedMaterialScope] = useState<string>('all');

  // AI Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressState, setProgressState] = useState<QuickNotesProgress | null>(null);
  const [generatedResult, setGeneratedResult] = useState<QuickNotesResult | null>(null);
  const [editableText, setEditableText] = useState('');
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

  // Notifications and Error States
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Manual note creator state
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Fetch saved personal notes for this scope
  useEffect(() => {
    let isCancelled = false;
    const fetchScopeNotes = async () => {
      setLoadingSavedNotes(true);
      try {
        const data = await getNotes(
          user.uid,
          selectedSubjectId !== 'all' ? selectedSubjectId : undefined
        );
        if (!isCancelled) {
          setNotes(data);
          setErrorMsg(null);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const error = err as { message?: string };
          setErrorMsg(error.message || 'Failed to load study notes.');
        }
      } finally {
        if (!isCancelled) setLoadingSavedNotes(false);
      }
    };

    fetchScopeNotes();
    return () => {
      isCancelled = true;
    };
  }, [user.uid, selectedSubjectId]);

  // Filter notes by module if module is chosen
  const filteredSavedNotes = useMemo(() => {
    return notes.filter((n) => {
      if (selectedModuleId === 'all') return true;
      return n.moduleId === selectedModuleId;
    });
  }, [notes, selectedModuleId]);

  // Target materials based on selection
  const targetMaterials = useMemo(() => {
    if (selectedMaterialScope === 'all') {
      return availableMaterials;
    }
    return availableMaterials.filter((p) => p.id === selectedMaterialScope);
  }, [availableMaterials, selectedMaterialScope]);

  // Generate Quick Revision Notes via Ollama
  const handleGenerateRevisionNotes = async () => {
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

    try {
      const conn = await checkOllamaConnection();
      if (!conn.connected) {
        setErrorMsg(
          conn.error?.message ||
          'Ollama is not running. Please start Ollama or test connection in the panel above.'
        );
        return;
      }
    } catch {
      // Proceed
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setProgressState({
      stage: 'resolving_files',
      message: 'Preparing revision materials...',
      percent: 5,
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const activeModel = getSelectedModel() || 'llama3.2:3b';
      const result = await generateQuickNotes({
        materials: targetMaterials,
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        moduleId: selectedModule ? selectedModule.id : null,
        moduleName: selectedModule ? selectedModule.title : undefined,
        model: activeModel,
        abortSignal: abortController.signal,
        onProgress: (p) => setProgressState(p),
      });

      setGeneratedResult(result);
      setEditableText(result.notesText);
      triggerToast('Quick revision notes generated successfully!');
    } catch (err: unknown) {
      const errorObj = err as Error & { info?: { message: string; suggestion: string } };
      if (abortController.signal.aborted) {
        setErrorMsg('Revision notes generation was cancelled.');
      } else {
        const fullMsg = errorObj.info?.suggestion
          ? `${errorObj.message} (${errorObj.info.suggestion})`
          : errorObj.message || 'Failed to generate revision notes.';
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
      setErrorMsg('Revision notes generation was cancelled by student.');
    }
  };

  const handleCopyNotes = async () => {
    const textToCopy = editableText || generatedResult?.notesText;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      triggerToast('Notes copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      triggerToast('Failed to copy to clipboard.');
    }
  };

  const handleExportTextFile = () => {
    const textToExport = editableText || generatedResult?.notesText;
    if (!textToExport) return;

    const scopeName = selectedModule
      ? `${selectedSubject?.name || 'Subject'}_Module${selectedModule.order}`
      : `${selectedSubject?.name || 'Subject'}_AllModules`;

    const blob = new Blob([textToExport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${scopeName.replace(/[^a-zA-Z0-9_-]/g, '_')}_QuickNotes.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast('Notes exported as Markdown file!');
  };

  const handleSaveToNotes = async () => {
    const textToSave = editableText || generatedResult?.notesText;
    if (!textToSave || !textToSave.trim()) {
      setErrorMsg('Cannot save empty revision notes.');
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
      const noteTitle = `Quick Notes: ${scopeLabel}`;

      const created = await createNote(user.uid, {
        subjectId: selectedSubject.id,
        moduleId: selectedModule ? selectedModule.id : null,
        title: noteTitle,
        content: textToSave,
      });

      setNotes((prev) => [created, ...prev]);
      triggerToast('Revision notes saved to Personal Notes archive!');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save note.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to parse markdown into readable visual cards
  const parsedSections = useMemo(() => {
    const text = editableText || generatedResult?.notesText;
    if (!text) return [];

    const regex = /(?:^|\n)###?\s+([^\n]+)\n/g;
    const matches = Array.from(text.matchAll(regex));

    if (matches.length === 0) {
      return [{ title: 'Quick Study Notes', content: text }];
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
  }, [editableText, generatedResult]);

  // Manual note creator helper
  const handleSaveManualNote = async () => {
    if (!manualTitle.trim() || !selectedSubject) return;
    setIsSaving(true);
    try {
      const input: NoteInput = {
        subjectId: selectedSubject.id,
        moduleId: selectedModule ? selectedModule.id : null,
        title: manualTitle.trim(),
        content: manualContent.trim(),
      };
      const created = await createNote(user.uid, input);
      setNotes((prev) => [created, ...prev]);
      setIsCreatingManual(false);
      setManualTitle('');
      setManualContent('');
      triggerToast('Note created successfully!');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save note.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSavedNote = async (id: string) => {
    try {
      await deleteNote(user.uid, id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      triggerToast('Note deleted.');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to delete note.');
    }
  };

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

      {/* Header & Generator Card */}
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
              <BookOpen size={20} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Quick Study Notes
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
                  {selectedSubject ? selectedSubject.name : 'All Subjects'}
                  {selectedModule ? ` • Mod ${selectedModule.order}` : ' • All Modules'}
                </span>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {loadingMaterials ? (
                  <span>Loading materials...</span>
                ) : (
                  <span>
                    <strong style={{ color: 'var(--text-primary)' }}>{availableMaterials.length}</strong> study materials (PDFs & Web links) available
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerateRevisionNotes}
              disabled={isGenerating || !selectedSubject || availableMaterials.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Generating Notes...
                </>
              ) : generatedResult ? (
                <>
                  <RefreshCw size={13} /> Regenerate Notes
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Generate Quick Notes
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

        {/* Source Material Selector */}
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
                }}
              >
                <Layers size={12} />
                <span>All Materials ({availableMaterials.length})</span>
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

        {/* Progress bar */}
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

      {/* Generated Revision Notes Panel */}
      {generatedResult && (
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
                  Generated Revision Notes
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
                  <Cpu size={11} /> {generatedResult.modelUsed}
                </span>

                {generatedResult.hasOcr && (
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
                  >
                    <ScanText size={11} /> OCR Enhanced
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Sources: {generatedResult.sources.map((s) => `${s.fileName} (${s.pageCount} pgs)`).join(', ')} &bull;{' '}
                Characters: {generatedResult.totalSourceCharacters.toLocaleString()} &bull; Duration:{' '}
                {(generatedResult.durationMs / 1000).toFixed(1)}s
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
                onClick={handleCopyNotes}
                style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Copy entire notes to clipboard"
              >
                {copied ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportTextFile}
                style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Download as Markdown file"
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
                title="Save notes to Personal Notes"
              >
                <Save size={12} />
                <span>{isSaving ? 'Saving...' : 'Save to Notes'}</span>
              </Button>
            </div>
          </div>

          {/* Formatted View */}
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
                    }}
                  >
                    {sec.title}
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

      {/* Initial Empty Callout if not generated yet */}
      {!generatedResult && !isGenerating && (
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
              Generate Quick Study Revision Notes
            </h4>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, maxWidth: '520px', lineHeight: 1.5 }}>
              Extract definitions, key principles, formulas, and high-yield exam points from your lecture PDFs in seconds using local{' '}
              <strong style={{ color: 'var(--accent-primary)' }}>Llama 3.2 (3B)</strong>.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleGenerateRevisionNotes}
            disabled={!selectedSubject || availableMaterials.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}
          >
            <Sparkles size={16} /> Generate Revision Notes
          </Button>
        </div>
      )}

      {/* Saved Personal Notes in this Scope */}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Saved Revision Notes in this Scope ({filteredSavedNotes.length})
            </h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Personal notes linked to {selectedSubject ? selectedSubject.name : 'this subject'}
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsCreatingManual(!isCreatingManual)}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            {isCreatingManual ? 'Cancel' : '+ New Note'}
          </Button>
        </div>

        {/* Manual note form */}
        {isCreatingManual && (
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <input
              type="text"
              placeholder="Note Title..."
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              className="input-field"
              style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
            />
            <textarea
              placeholder="Note content..."
              value={manualContent}
              onChange={(e) => setManualContent(e.target.value)}
              rows={4}
              className="input-field"
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={() => setIsCreatingManual(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveManualNote} disabled={isSaving || !manualTitle.trim()}>
                Save Note
              </Button>
            </div>
          </div>
        )}

        {/* Notes list */}
        {loadingSavedNotes ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading saved notes...</div>
        ) : filteredSavedNotes.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            No saved notes found for this {selectedModule ? 'module' : 'subject'}. Generate notes above or click "+ New Note".
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {filteredSavedNotes.map((note) => (
              <div
                key={note.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {note.title}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSavedNote(note.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                    title="Delete note"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    maxHeight: '90px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {note.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
