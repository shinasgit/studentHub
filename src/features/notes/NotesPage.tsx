import React, { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  StickyNote,
  Search,
  Plus,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { NoteCard } from './NoteCard';
import { NoteModal } from './NoteModal';
import { NoteViewModal } from './NoteViewModal';
import { DeleteConfirmModal } from '../subjects/DeleteConfirmModal';
import { getNotes, createNote, updateNote, deleteNote } from '../../services/noteService';
import type { Note, NoteInput } from '../../types/note';
import type { Subject } from '../../types/subject';

interface NotesPageProps {
  user: User;
  subjects: Subject[];
}

export const NotesPage: React.FC<NotesPageProps> = ({ user, subjects }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Fetch all user notes on mount
  useEffect(() => {
    let isCancelled = false;
    const fetchAllNotes = async () => {
      setLoading(true);
      try {
        const data = await getNotes(user.uid);
        if (!isCancelled) {
          setNotes(data);
          setErrorMsg(null);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const error = err as { message?: string };
          setErrorMsg(error.message || 'Failed to load personal notes.');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchAllNotes();
    return () => {
      isCancelled = true;
    };
  }, [user.uid]);

  // Filter notes by search query and subject
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const matchesSubject = selectedSubjectId === 'all' || n.subjectId === selectedSubjectId;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q);

      return matchesSubject && matchesSearch;
    });
  }, [notes, selectedSubjectId, searchQuery]);

  // Handlers
  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingNote(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (note: Note) => {
    setModalMode('edit');
    setEditingNote(note);
    setIsModalOpen(true);
  };

  const handleSubmitNote = async (input: NoteInput) => {
    if (modalMode === 'create') {
      const newNote = await createNote(user.uid, input);
      setNotes((prev) => [newNote, ...prev]);
      setToastMsg(`Note "${newNote.title}" created!`);
    } else if (editingNote) {
      await updateNote(user.uid, editingNote.id, input);
      setNotes((prev) =>
        prev.map((n) => (n.id === editingNote.id ? { ...n, ...input, updatedAt: new Date().toISOString() } : n))
      );
      setToastMsg('Note updated successfully!');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingNote) return;
    try {
      await deleteNote(user.uid, deletingNote.id);
      setNotes((prev) => prev.filter((n) => n.id !== deletingNote.id));
      if (viewingNote?.id === deletingNote.id) {
        setViewingNote(null);
      }
      setToastMsg('Note deleted.');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to delete note.');
    } finally {
      setDeletingNote(null);
    }
  };

  const subjectsWithNotesCount = useMemo(() => {
    const sIds = new Set(notes.map((n) => n.subjectId));
    return sIds.size;
  }, [notes]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '36px 24px 80px' }}>
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
            border: '1px solid var(--accent-emerald)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <StickyNote size={18} color="var(--accent-emerald)" />
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div
        className="glass-panel animate-fade-in"
        style={{
          padding: '32px 36px',
          marginBottom: '32px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <StickyNote size={12} /> Stage 5.1
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Personal Study Workspace
              </span>
            </div>

            <h1 style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
              Personal Study <span className="gradient-text">Notes</span>
            </h1>

            <p style={{ maxWidth: '620px', color: 'var(--text-secondary)', fontSize: '0.94rem', lineHeight: 1.6 }}>
              Capture lecture summaries, key formulas, revision memos, and chapter takeaways across all your subjects.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={handleOpenCreate}
            disabled={subjects.length === 0}
            title={subjects.length === 0 ? 'Create a subject first in your Dashboard' : 'Create a new personal note'}
          >
            <Plus size={18} />
            <span>Create New Note</span>
          </Button>
        </div>

        {/* Quick Stats Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
              {notes.length}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Total Notes</span>
          </div>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
              {subjectsWithNotesCount}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Covered Subjects</span>
          </div>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {filteredNotes.length}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Visible</span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="auth-alert auth-alert-error" style={{ marginBottom: '24px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '28px',
          flexWrap: 'wrap',
        }}
      >
        {/* Search Field */}
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '440px' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search notes by title or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '40px' }}
          />
        </div>

        {/* Subject Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
            <Filter size={15} />
            <span>Subject:</span>
          </div>

          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="input-field"
            style={{ minWidth: '180px', padding: '8px 12px' }}
          >
            <option value="all">All Subjects ({notes.length})</option>
            {subjects.map((s) => {
              const count = notes.filter((n) => n.subjectId === s.id).length;
              return (
                <option key={s.id} value={s.id}>
                  {s.name} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Subject Filter Chips for quick toggling */}
      {subjects.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '24px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedSubjectId('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: selectedSubjectId === 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              background: selectedSubjectId === 'all' ? 'rgba(99, 102, 241, 0.15)' : 'var(--social-btn-bg)',
              color: selectedSubjectId === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all var(--transition-fast)',
              whiteSpace: 'nowrap',
            }}
          >
            All Subjects
          </button>

          {subjects.map((s) => {
            const isSelected = selectedSubjectId === s.id;
            const color = s.color || '#6366f1';
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSubjectId(s.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isSelected ? `1.5px solid ${color}` : '1px solid var(--border-subtle)',
                  background: isSelected ? `${color}20` : 'var(--social-btn-bg)',
                  color: isSelected ? color : 'var(--text-secondary)',
                  transition: 'all var(--transition-fast)',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Notes Grid & State Display */}
      {loading ? (
        <div className="subject-grid">
          <div className="skeleton-card" style={{ height: '200px' }} />
          <div className="skeleton-card" style={{ height: '200px' }} />
          <div className="skeleton-card" style={{ height: '200px' }} />
        </div>
      ) : notes.length === 0 ? (
        /* Empty State: No notes at all */
        <div className="empty-state animate-fade-in" style={{ padding: '60px 24px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              color: 'var(--accent-emerald)',
            }}
          >
            <StickyNote size={32} />
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '6px' }}>
            No personal notes written yet
          </h3>
          <p style={{ maxWidth: '440px', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.6 }}>
            Keep all your lecture summaries, formulas, and exam prep points organized by course in one private place.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreate}
            disabled={subjects.length === 0}
          >
            <Plus size={16} /> Create Your First Note
          </Button>
          {subjects.length === 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '10px' }}>
              (Add at least one subject in your Dashboard first)
            </p>
          )}
        </div>
      ) : filteredNotes.length === 0 ? (
        /* Empty State: Search or filter has no results */
        <div className="empty-state animate-fade-in" style={{ padding: '48px 24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'var(--social-btn-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              color: 'var(--text-muted)',
            }}
          >
            <Search size={26} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
            No notes match your filter
          </h3>
          <p style={{ maxWidth: '380px', color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
            No notes found matching "{searchQuery}". Try different keywords or reset your subject filter.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedSubjectId('all');
            }}
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        /* Notes Grid */
        <div className="subject-grid">
          {filteredNotes.map((n) => {
            const subject = subjects.find((s) => s.id === n.subjectId);
            return (
              <NoteCard
                key={n.id}
                note={n}
                subject={subject}
                onView={(note) => setViewingNote(note)}
                onEdit={(note) => handleOpenEdit(note)}
                onDelete={(note) => setDeletingNote(note)}
              />
            );
          })}
        </div>
      )}

      {/* Note Create/Edit Modal */}
      <NoteModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={editingNote}
        userId={user.uid}
        subjects={subjects}
        defaultSubjectId={selectedSubjectId !== 'all' ? selectedSubjectId : undefined}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitNote}
      />

      {/* Note Full Reader Modal */}
      <NoteViewModal
        isOpen={Boolean(viewingNote)}
        note={viewingNote}
        subject={subjects.find((s) => s.id === viewingNote?.subjectId)}
        onClose={() => setViewingNote(null)}
        onEdit={(note) => handleOpenEdit(note)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingNote)}
        subject={
          deletingNote
            ? {
                id: deletingNote.id,
                name: deletingNote.title,
                code: 'NOTE',
                semester: '',
                createdAt: '',
                updatedAt: '',
                userId: user.uid,
              }
            : null
        }
        onClose={() => setDeletingNote(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
