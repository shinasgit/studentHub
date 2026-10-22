import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import {
  BookOpen,
  Plus,
  Search,
  Layers,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  StickyNote,
  Calendar,
  Sparkles,
  ArrowRight,
  LayoutDashboard,
  GraduationCap,
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
import { getNotes } from '../../services/noteService';
import { getStudySessions } from '../../services/plannerService';
import type { Subject, SubjectInput } from '../../types/subject';

interface StudentDashboardProps {
  user: User;
  onSelectSubject?: (subject: Subject) => void;
  onExploreModules?: () => void;
  onSubjectsChange?: (subjects: Subject[]) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  user,
  onSelectSubject,
  onSubjectsChange,
}) => {
  const navigate = useNavigate();
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

  // Real summary statistics from Firestore
  const [totalNotes, setTotalNotes] = useState<number>(0);
  const [upcomingSessions, setUpcomingSessions] = useState<number>(0);

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

  // Load real workspace summary stats from actual Firestore collections
  useEffect(() => {
    let isCancelled = false;
    const fetchStats = async () => {
      try {
        const [noteList, sessionList] = await Promise.all([
          getNotes(user.uid).catch(() => []),
          getStudySessions(user.uid).catch(() => []),
        ]);
        if (!isCancelled) {
          setTotalNotes(noteList.length);
          setUpcomingSessions(sessionList.filter((s) => s.status === 'upcoming').length);
        }
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      }
    };
    fetchStats();
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

  // User details
  const displayName = user.displayName || user.email?.split('@')[0] || 'Student';
  const userEmail = user.email || '';

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

      {/* Page Header */}
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
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-primary-subtle)',
              border: '1px solid var(--accent-primary-border)',
              color: 'var(--accent-primary)',
              fontSize: '0.76rem',
              fontWeight: 600,
              marginBottom: '6px',
            }}
          >
            <LayoutDashboard size={13} />
            <span>Workspace Dashboard</span>
          </div>

          <h1 style={{ fontSize: 'clamp(1.25rem, 3.5vw, 1.45rem)', fontWeight: 800, marginBottom: '2px', wordBreak: 'break-word' }}>
            Welcome back, {displayName}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
            {userEmail} · High-level summary of your study workspace
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => navigate('/subjects')}>
            <span>All Subjects</span>
            <ArrowRight size={13} />
          </Button>

          <Button variant="primary" size="sm" onClick={handleOpenCreate}>
            <Plus size={15} />
            <span>Add Subject</span>
          </Button>
        </div>
      </div>

      {/* Interactive Workspace Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
          gap: '12px',
          marginBottom: '28px',
        }}
      >
        {[
          { icon: <Layers size={14} />, label: 'Subjects', value: loading ? '–' : subjects.length, path: '/subjects', hint: 'View Courses' },
          { icon: <GraduationCap size={14} />, label: 'Study Tools', value: '4 Tools', path: '/study-tools', hint: 'Summaries & Quizzes' },
          { icon: <StickyNote size={14} />, label: 'Notes', value: loading ? '–' : totalNotes, path: '/notes', hint: 'Read Notes' },
          { icon: <Calendar size={14} />, label: 'Upcoming', value: loading ? '–' : upcomingSessions, path: '/planner', hint: 'View Planner' },
        ].map((stat) => (
          <div
            key={stat.label}
            onClick={() => navigate(stat.path)}
            style={{
              padding: '16px clamp(12px, 3vw, 18px)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            title={`Click to open ${stat.label}`}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {stat.icon} {stat.label}
                </span>
                <ArrowRight size={12} color="var(--text-muted)" />
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                {stat.value}
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', marginTop: '8px', fontWeight: 500 }}>
              {stat.hint} →
            </span>
          </div>
        ))}
      </div>

      {/* Quick Study Shortcuts Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: '12px',
          marginBottom: '32px',
        }}
      >
        {[
          {
            title: 'AI Study Assistant',
            desc: 'Topic-scoped revision and study assistance',
            icon: <Sparkles size={16} color="var(--accent-primary)" />,
            path: '/chatbot',
            badge: 'Interactive',
          },
          {
            title: 'Study Planner',
            desc: 'Schedule weekly blocks and tracking',
            icon: <Calendar size={16} color="var(--accent-emerald)" />,
            path: '/planner',
            badge: 'Calendar',
          },
          {
            title: 'Study Tools',
            desc: 'Module summaries, notes, questions & MCQ quizzes',
            icon: <GraduationCap size={16} color="var(--accent-primary)" />,
            path: '/study-tools',
            badge: '4 Tools',
          },
          {
            title: 'Personal Notes',
            desc: 'Markdown study notes and thoughts per subject',
            icon: <StickyNote size={16} color="var(--accent-amber)" />,
            path: '/notes',
            badge: 'Study Notes',
          },
        ].map((tool) => (
          <div
            key={tool.title}
            onClick={() => navigate(tool.path)}
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-medium)';
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.background = 'var(--bg-card)';
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {tool.icon}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {tool.title}
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tool.desc}
              </span>
            </div>
          </div>
        ))}
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

      {/* Enrolled Courses & Subjects Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Your Enrolled Subjects
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Select a subject to open chapters, modules, and lecture notes
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => navigate('/subjects')} style={{ fontSize: '0.8rem' }}>
            <span>Manage All ({subjects.length})</span>
            <ArrowRight size={13} />
          </Button>

          <Button variant="primary" size="sm" onClick={handleOpenCreate}>
            <Plus size={15} />
            <span>Add Subject</span>
          </Button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '20px',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 'min(100%, 180px)', maxWidth: '340px' }}>
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
            placeholder="Search subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '32px', height: '34px', fontSize: '0.8125rem', width: '100%' }}
            aria-label="Search subjects"
          />
        </div>

        {availableSemesters.length > 0 && (
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="select-field"
            style={{ flex: '1 1 120px', minWidth: '120px', height: '34px', fontSize: '0.8125rem' }}
            aria-label="Filter by semester"
          >
            <option value="ALL">All semesters</option>
            {availableSemesters.map((sem) => (
              <option key={sem} value={sem}>{sem}</option>
            ))}
          </select>
        )}
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
