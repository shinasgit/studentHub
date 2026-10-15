import React, { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  BookOpen,
  Plus,
  Search,
  Layers,
  GraduationCap,
  Sparkles,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { SubjectCard } from '../subjects/SubjectCard';
import { SubjectModal } from '../subjects/SubjectModal';
import { DeleteConfirmModal } from '../subjects/DeleteConfirmModal';
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from '../../services/subjectService';
import type { Subject, SubjectInput } from '../../types/subject';

interface StudentDashboardProps {
  user: User;
  onExploreModules?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
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
  const loadSubjects = React.useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getSubjects(user.uid);
      setSubjects(data);
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
  }, [user.uid]);

  useEffect(() => {
    let isCancelled = false;

    const fetchInitial = async () => {
      try {
        const data = await getSubjects(user.uid);
        if (!isCancelled) {
          setSubjects(data);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
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
          setLoading(false);
        }
      }
    };

    fetchInitial();

    return () => {
      isCancelled = true;
    };
  }, [user.uid]);

  // Semester options derived dynamically from existing subjects
  const availableSemesters = useMemo(() => {
    const sems = new Set<string>();
    subjects.forEach((s) => {
      if (s.semester) sems.add(s.semester);
    });
    return Array.from(sems);
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
      setSubjects((prev) => [newSubject, ...prev]);
      setToastMsg(`Subject "${newSubject.name}" created successfully!`);
    } else if (editingSubject) {
      await updateSubject(user.uid, editingSubject.id, input);
      setSubjects((prev) =>
        prev.map((s) =>
          s.id === editingSubject.id
            ? { ...s, ...input, updatedAt: new Date().toISOString() }
            : s
        )
      );
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
    setSubjects((prev) => prev.filter((s) => s.id !== subjectId));
    setToastMsg('Subject removed successfully.');
  };

  // User details
  const displayName = user.displayName || user.email?.split('@')[0] || 'Student';
  const userEmail = user.email || '';

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px 80px' }}>
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
            border: '1px solid var(--accent-emerald)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            animation: 'fadeInSlideUp 0.3s ease-out forwards',
          }}
        >
          <CheckCircle2 size={18} color="var(--accent-emerald)" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Welcome Banner */}
      <div
        className="glass-panel animate-fade-in"
        style={{
          padding: '32px',
          marginBottom: '32px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  border: '3px solid var(--accent-primary)',
                  boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="badge" style={{ padding: '2px 10px', fontSize: '0.72rem' }}>
                  <Sparkles size={11} /> Student Hub Workspace
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    color: 'var(--accent-emerald)',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--accent-emerald)',
                    }}
                  />
                  Firestore Synced
                </span>
              </div>

              <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800 }}>
                Welcome back, <span className="gradient-text">{displayName}</span>! 👋
              </h1>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                {userEmail} • Organize your study modules, resources, and progress.
              </p>
            </div>
          </div>

          <Button variant="primary" size="md" onClick={handleOpenCreate}>
            <Plus size={18} />
            <span>Add Subject</span>
          </Button>
        </div>

        {/* Quick Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '28px',
            paddingTop: '24px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--social-btn-bg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
              <Layers size={14} color="var(--accent-primary)" />
              <span>TOTAL SUBJECTS</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {loading ? '...' : subjects.length}
            </div>
          </div>

          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--social-btn-bg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
              <GraduationCap size={14} color="var(--accent-secondary)" />
              <span>ACTIVE TERMS</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {availableSemesters.length || (loading ? '...' : 1)}
            </div>
          </div>

          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--social-btn-bg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
              <BookOpen size={14} color="var(--accent-cyan)" />
              <span>STUDY SYSTEM</span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '10px' }}>
              Phase 2: Subjects
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert if Firestore failed */}
      {errorMsg && (
        <div
          className="auth-alert auth-alert-error"
          style={{
            padding: '16px 20px',
            marginBottom: '28px',
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

      {/* Action Controls & Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Enrolled Subjects</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Manage courses, track units, and access revision materials
          </p>
        </div>

        {/* Search & Semester filter group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search box */}
          <div style={{ position: 'relative', width: '240px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search subjects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '36px', height: '38px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Semester Filter */}
          {availableSemesters.length > 0 && (
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="select-field"
              style={{ width: 'auto', minWidth: '150px', height: '38px', fontSize: '0.85rem' }}
            >
              <option value="ALL">All Semesters</option>
              {availableSemesters.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>
          )}

          <Button variant="primary" size="sm" onClick={handleOpenCreate}>
            <Plus size={16} /> Add Subject
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
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
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '18px',
              color: 'var(--accent-primary)',
            }}
          >
            <BookOpen size={32} />
          </div>

          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '6px' }}>
            No subjects added yet
          </h3>

          <p style={{ maxWidth: '440px', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '22px' }}>
            Create your first subject (like Computer Science, Mathematics, or Biology) to start organizing your modules, notes, and study resources.
          </p>

          <Button variant="primary" size="md" onClick={handleOpenCreate}>
            <Plus size={18} />
            <span>Add Your First Subject</span>
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
            />
          ))}
        </div>
      )}

      {/* Subject Create / Edit Modal */}
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
