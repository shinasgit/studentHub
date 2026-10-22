import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  BookOpen,
  Plus,
  Search,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { SubjectCard } from './SubjectCard';
import { SubjectModal } from './SubjectModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from '../../services/subjectService';
import type { Subject, SubjectInput } from '../../types/subject';

interface SubjectsPageProps {
  user: User;
  onSelectSubject?: (subject: Subject) => void;
  onSubjectsChange?: (subjects: Subject[]) => void;
}

export const SubjectsPage: React.FC<SubjectsPageProps> = ({
  user,
  onSelectSubject,
  onSubjectsChange,
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('ALL');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Delete modal state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Load subjects from Firestore
  const loadSubjects = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getSubjects(user.uid);
      setSubjects(data);
      onSubjectsChange?.(data);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error('Failed to load subjects:', error);

      if (error.code === 'permission-denied') {
        setErrorMsg(
          'Firestore Permission Denied. Ensure your Firestore Security Rules allow read/write for your user UID, or publish firestore.rules.'
        );
      } else if (
        error.code === 'failed-precondition' ||
        error.message?.includes('database') ||
        error.message?.includes('not exist')
      ) {
        setErrorMsg(
          'Firestore Database not yet created in your Firebase Console. Open Firebase Console > Build > Firestore Database > click "Create database".'
        );
      } else {
        setErrorMsg(error.message || 'Unable to connect to Firestore. Please check your network connection.');
      }
    } finally {
      setLoading(false);
    }
  }, [user.uid, onSubjectsChange]);

  useEffect(() => {
    let isCancelled = false;

    const fetchInitial = async () => {
      try {
        const data = await getSubjects(user.uid);
        if (!isCancelled) {
          setSubjects(data);
          onSubjectsChange?.(data);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const error = err as { code?: string; message?: string };
          console.error('Failed to load subjects:', error);
          setErrorMsg(error.message || 'Unable to connect to Firestore.');
          setLoading(false);
        }
      }
    };

    fetchInitial();

    return () => {
      isCancelled = true;
    };
  }, [user.uid, onSubjectsChange]);

  // Unique semesters from subjects
  const availableSemesters = useMemo(() => {
    const sems = new Set<string>();
    subjects.forEach((s) => {
      if (s.semester) sems.add(s.semester);
    });
    return Array.from(sems).sort();
  }, [subjects]);

  // Filtered subjects
  const filteredSubjects = useMemo(() => {
    return subjects.filter((subject) => {
      const matchesSearch =
        subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subject.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (subject.description && subject.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSemester = selectedSemester === 'ALL' || subject.semester === selectedSemester;

      return matchesSearch && matchesSemester;
    });
  }, [subjects, searchQuery, selectedSemester]);

  // Handle Create / Edit submit
  const handleModalSubmit = async (input: SubjectInput) => {
    if (modalMode === 'create') {
      const newSubject = await createSubject(user.uid, input);
      setSubjects((prev) => {
        const updated = [newSubject, ...prev];
        onSubjectsChange?.(updated);
        return updated;
      });
      setToastMsg(`Subject "${newSubject.name}" created successfully!`);
    } else if (editingSubject) {
      await updateSubject(user.uid, editingSubject.id, input);
      setSubjects((prev) => {
        const updated = prev.map((s) =>
          s.id === editingSubject.id
            ? { ...s, ...input, updatedAt: new Date().toISOString() }
            : s
        );
        onSubjectsChange?.(updated);
        return updated;
      });
      setToastMsg(`Subject "${input.name}" updated successfully!`);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingSubject(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (subject: Subject) => {
    setModalMode('edit');
    setEditingSubject(subject);
    setIsModalOpen(true);
  };

  // Open Delete Confirmation
  const handleOpenDelete = (subject: Subject) => {
    setSubjectToDelete(subject);
    setIsDeleteOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async (subjectId: string) => {
    await deleteSubject(user.uid, subjectId);
    setSubjects((prev) => {
      const updated = prev.filter((s) => s.id !== subjectId);
      onSubjectsChange?.(updated);
      return updated;
    });
    setToastMsg('Subject removed successfully.');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px clamp(14px, 4vw, 24px) 64px' }}>
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
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.875rem',
            animation: 'fadeInSlideUp 0.2s ease-out forwards',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <CheckCircle2 size={16} color="var(--color-success)" style={{ flexShrink: 0 }} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Page Header (Subject focused, without Dashboard workspace stats) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <FolderOpen size={20} color="var(--accent-primary)" />
            <h1 style={{ fontSize: 'clamp(1.25rem, 3.5vw, 1.5rem)', fontWeight: 700, margin: 0 }}>
              Subjects
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
            {subjects.length} course{subjects.length === 1 ? '' : 's'} enrolled · Select a subject to view modules, lecture PDFs, and syllabus
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleOpenCreate}>
          <Plus size={15} />
          Add Subject
        </Button>
      </div>

      {/* Error Alert if Firestore failed */}
      {errorMsg && (
        <div
          className="auth-alert auth-alert-error"
          style={{
            padding: '16px 20px',
            marginBottom: '24px',
            fontSize: '0.9rem',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={loadSubjects}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      )}

      {/* Search & Semester filter toolbar */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 'min(100%, 180px)', maxWidth: '360px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search subjects by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '32px', height: '36px', fontSize: '0.84rem', width: '100%' }}
              aria-label="Search subjects"
            />
          </div>

          {availableSemesters.length > 0 && (
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="select-field"
              style={{ flex: '1 1 130px', minWidth: '120px', height: '36px', fontSize: '0.84rem' }}
              aria-label="Filter by semester"
            >
              <option value="ALL">All Semesters</option>
              {availableSemesters.map((sem) => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          )}

          {(searchQuery || selectedSemester !== 'ALL') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedSemester('ALL');
              }}
              style={{ height: '36px', fontSize: '0.8rem' }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Main Subjects Content Area */}
      {loading ? (
        /* Loading Skeleton */
        <div className="subject-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : subjects.length === 0 ? (
        /* Empty State */
        <div className="empty-state animate-fade-in">
          <BookOpen size={28} color="var(--text-muted)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
            No subjects yet
          </h3>
          <p style={{ maxWidth: '380px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Add your first subject to start organizing your modules, notes, and study resources.
          </p>
          <Button variant="primary" size="sm" onClick={handleOpenCreate}>
            <Plus size={15} /> Add Subject
          </Button>
        </div>
      ) : filteredSubjects.length === 0 ? (
        /* Filter had no results */
        <div className="empty-state animate-fade-in" style={{ padding: '40px 20px' }}>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            No subjects match your search for "{searchQuery}".
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedSemester('ALL');
            }}
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        /* Subject Cards Grid */
        <div className="subject-grid">
          {filteredSubjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
              onSelect={onSelectSubject}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Subject Modal */}
      <SubjectModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={editingSubject}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        subject={subjectToDelete}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
