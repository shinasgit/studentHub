import React, { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  Plus,
  Sparkles,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info,
  FileText,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { getNotes, createNote, deleteNote } from '../../services/noteService';
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
  materials: _materials = [],
  loadingMaterials: _loadingMaterials = false,
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Editor states
  const [isCreating, setIsCreating] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showAiNotice, setShowAiNotice] = useState(false);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Fetch notes for the user and filter by subject if selected
  useEffect(() => {
    let isCancelled = false;
    const fetchScopeNotes = async () => {
      setLoading(true);
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
        if (!isCancelled) setLoading(false);
      }
    };

    fetchScopeNotes();
    return () => {
      isCancelled = true;
    };
  }, [user.uid, selectedSubjectId]);

  // Filter by module if a specific module is selected
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (selectedModuleId === 'all') return true;
      return n.moduleId === selectedModuleId;
    });
  }, [notes, selectedModuleId]);

  const handleGenerateRevisionNotes = () => {
    setShowAiNotice(true);
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) {
      setErrorMsg('Note title is required.');
      return;
    }
    if (!selectedSubject) {
      setErrorMsg('Please select a subject above to associate with this revision note.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const input: NoteInput = {
        subjectId: selectedSubject.id,
        moduleId: selectedModule ? selectedModule.id : null,
        title: noteTitle.trim(),
        content: noteContent.trim(),
      };
      const created = await createNote(user.uid, input);
      setNotes((prev) => [created, ...prev]);
      setIsCreating(false);
      setNoteTitle('');
      setNoteContent('');
      triggerToast('Revision note saved successfully!');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save note.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await deleteNote(user.uid, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      triggerToast('Note deleted.');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to delete note.');
    }
  };

  const handleCopyNote = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      triggerToast('Note copied to clipboard!');
    } catch {
      triggerToast('Could not copy to clipboard.');
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

      {/* Action Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Quick Study &amp; Revision Notes
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''} in{' '}
            {selectedSubject ? selectedSubject.name : 'all subjects'}
            {selectedModule ? ` · Module: ${selectedModule.title}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerateRevisionNotes}
            title="Generate structured revision notes from materials"
          >
            <Sparkles size={14} /> Generate Revision Notes
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreating(true)}
            disabled={!selectedSubject}
            title={!selectedSubject ? 'Select a subject first' : 'Add new revision note'}
          >
            <Plus size={15} /> New Revision Note
          </Button>
        </div>
      </div>

      {/* AI Notice (Stage 6) */}
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
            <strong style={{ color: 'var(--text-primary)' }}>Revision Notes Generation Notice:</strong>
            <p style={{ marginTop: '4px', marginBottom: '8px' }}>
              Automatic AI generation of concise study sheets, bulleted cheat sheets, and definitions will be connected in Stage 6 with dedicated LLM document processing.
            </p>
            <p style={{ margin: 0 }}>
              You can currently record, organize, and revise your high-yield study notes below. All notes are saved to your Firestore account and accessible anytime.
            </p>
          </div>
        </div>
      )}

      {/* New Note Composer */}
      {isCreating && (
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            border: '1px solid var(--border-medium)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
              Draft Revision Note
            </h4>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Target: {selectedSubject?.name} {selectedModule ? `· ${selectedModule.title}` : ''}
            </div>
          </div>

          <input
            type="text"
            placeholder="e.g., Key Definitions &amp; Formulas — Midterm Exam"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            className="input-field"
            style={{ fontSize: '0.9rem', height: '40px' }}
          />

          <textarea
            placeholder="Use headings, bullet points, and definitions:&#10;&#10;• Key Concept 1: Description&#10;• Formula / Theorem: details&#10;• Exam Watchouts: Common pitfalls"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="input-field"
            style={{
              minHeight: '180px',
              padding: '12px',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsCreating(false);
                setNoteTitle('');
                setNoteContent('');
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveNote} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </div>
      )}

      {/* Existing Notes List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="skeleton-card" style={{ height: '100px' }} />
          <div className="skeleton-card" style={{ height: '100px' }} />
        </div>
      ) : filteredNotes.length === 0 ? (
        <div
          className="empty-state animate-fade-in"
          style={{
            padding: '44px 20px',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <FileText size={28} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>
            No revision notes found
          </h3>
          <p style={{ maxWidth: '420px', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px', lineHeight: 1.5 }}>
            Prepare concise study notes, formulas, and bulleted takeaways for this subject or module.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreating(true)}
            disabled={!selectedSubject}
          >
            <Plus size={15} /> Create Revision Note
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredNotes.map((note) => {
            const moduleInfo = modules.find((m) => m.id === note.moduleId);
            return (
              <div
                key={note.id}
                className="glass-panel"
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.975rem', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                      {note.title}
                    </h4>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {moduleInfo && <span>Module {moduleInfo.order}: {moduleInfo.title}</span>}
                      <span>Updated: {new Date(note.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopyNote(`${note.title}\n\n${note.content}`)}
                      title="Copy note"
                      style={{ padding: '6px' }}
                    >
                      <Copy size={14} />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDelete(note.id)}
                      title="Delete note"
                      style={{ padding: '6px', color: 'var(--color-danger)' }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    background: 'var(--bg-tertiary)',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {note.content || '(No note content)'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
