import React, { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  List,
  CalendarDays,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { StudySessionCard } from './StudySessionCard';
import { StudySessionModal } from './StudySessionModal';
import { DeleteConfirmModal } from '../subjects/DeleteConfirmModal';
import {
  getStudySessions,
  createStudySession,
  updateStudySession,
  updateSessionStatus,
  deleteStudySession,
} from '../../services/plannerService';
import type { StudySession, StudySessionInput, StudySessionStatus } from '../../types/planner';
import type { Subject } from '../../types/subject';

interface PlannerPageProps {
  user: User;
  subjects: Subject[];
}

export const PlannerPage: React.FC<PlannerPageProps> = ({ user, subjects }) => {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // View state: 'upcoming' | 'week' | 'all'
  const [activeView, setActiveView] = useState<'upcoming' | 'week' | 'all'>('upcoming');

  // Week view anchor date (defaults to beginning of current week)
  const [weekOffset, setWeekOffset] = useState(0);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [deletingSession, setDeletingSession] = useState<StudySession | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Fetch all sessions on mount
  useEffect(() => {
    let isCancelled = false;
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const data = await getStudySessions(user.uid);
        if (!isCancelled) {
          setSessions(data);
          setErrorMsg(null);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const error = err as { message?: string };
          setErrorMsg(error.message || 'Failed to load study planner sessions.');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchSessions();
    return () => {
      isCancelled = true;
    };
  }, [user.uid]);

  // Today string
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Calculate 7 days for the selected week
  const weekDays = useMemo(() => {
    const curr = new Date();
    // Monday of current week
    const firstDay = new Date(curr.setDate(curr.getDate() - curr.getDay() + 1 + weekOffset * 7));

    const days: { dateStr: string; label: string; dayName: string; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(firstDay);
      d.setDate(firstDay.getDate() + i);
      const str = d.toISOString().split('T')[0];
      days.push({
        dateStr: str,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: str === todayStr,
      });
    }
    return days;
  }, [weekOffset, todayStr]);

  // Statistics calculation: strictly from completed sessions
  const stats = useMemo(() => {
    const completedSessions = sessions.filter((s) => s.status === 'completed');

    // Total completed minutes
    const totalMinutes = completedSessions.reduce((acc, s) => acc + s.durationMinutes, 0);

    // Today's completed minutes
    const todayMinutes = completedSessions
      .filter((s) => s.date === todayStr)
      .reduce((acc, s) => acc + s.durationMinutes, 0);

    // This week's completed minutes (within weekDays)
    const weekDateSet = new Set(weekDays.map((d) => d.dateStr));
    const thisWeekMinutes = completedSessions
      .filter((s) => weekDateSet.has(s.date))
      .reduce((acc, s) => acc + s.durationMinutes, 0);

    const upcomingCount = sessions.filter((s) => s.status === 'upcoming').length;

    return {
      totalHours: (totalMinutes / 60).toFixed(1),
      todayMins: todayMinutes,
      thisWeekHours: (thisWeekMinutes / 60).toFixed(1),
      upcomingCount,
      completedCount: completedSessions.length,
    };
  }, [sessions, todayStr, weekDays]);

  // Handlers
  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingSession(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (session: StudySession) => {
    setModalMode('edit');
    setEditingSession(session);
    setIsModalOpen(true);
  };

  const handleSubmitSession = async (input: StudySessionInput) => {
    if (modalMode === 'create') {
      const newSession = await createStudySession(user.uid, input);
      setSessions((prev) => [...prev, newSession].sort((a, b) => a.date.localeCompare(b.date)));
      setToastMsg(`Scheduled "${newSession.title}"!`);
    } else if (editingSession) {
      await updateStudySession(user.uid, editingSession.id, input);
      setSessions((prev) =>
        prev
          .map((s) =>
            s.id === editingSession.id ? { ...s, ...input, updatedAt: new Date().toISOString() } : s
          )
          .sort((a, b) => a.date.localeCompare(b.date))
      );
      setToastMsg('Study session updated!');
    }
  };

  const handleStatusChange = async (session: StudySession, newStatus: StudySessionStatus) => {
    try {
      await updateSessionStatus(user.uid, session.id, newStatus);
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, status: newStatus } : s))
      );
      setToastMsg(
        newStatus === 'completed'
          ? 'Great job! Session completed.'
          : newStatus === 'cancelled'
          ? 'Session cancelled.'
          : 'Session reopened.'
      );
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to update session status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSession) return;
    try {
      await deleteStudySession(user.uid, deletingSession.id);
      setSessions((prev) => prev.filter((s) => s.id !== deletingSession.id));
      setToastMsg('Session deleted.');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to delete session.');
    } finally {
      setDeletingSession(null);
    }
  };

  // Filtered views
  const upcomingSessions = useMemo(() => {
    return sessions.filter((s) => s.status === 'upcoming' || s.date >= todayStr);
  }, [sessions, todayStr]);

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
          <CheckCircle2 size={18} color="var(--accent-emerald)" />
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
              <span className="badge" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', borderColor: 'rgba(14, 165, 233, 0.3)' }}>
                <Calendar size={12} /> Stage 5.3
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Time Management & Routine Tracking
              </span>
            </div>

            <h1 style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
              Study <span className="gradient-text">Planner</span>
            </h1>

            <p style={{ maxWidth: '620px', color: 'var(--text-secondary)', fontSize: '0.94rem', lineHeight: 1.6 }}>
              Schedule focus blocks, organize your exam preparation timetable, and record completed study hours.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={handleOpenCreate}
            disabled={subjects.length === 0}
            title={subjects.length === 0 ? 'Create a subject first in Dashboard' : 'Schedule a new study block'}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              boxShadow: '0 4px 16px rgba(14, 165, 233, 0.35)',
            }}
          >
            <Plus size={18} />
            <span>Schedule Session</span>
          </Button>
        </div>

        {/* Study Statistics Bar (Strictly from completed sessions) */}
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
              {stats.todayMins}m
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Studied Today</span>
          </div>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
              {stats.thisWeekHours} hrs
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>This Week</span>
          </div>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {stats.upcomingCount}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Upcoming</span>
          </div>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
              {stats.completedCount}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Completed Total</span>
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

      {/* View Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveView('upcoming')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeView === 'upcoming' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              background: activeView === 'upcoming' ? 'rgba(99, 102, 241, 0.15)' : 'var(--social-btn-bg)',
              color: activeView === 'upcoming' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <List size={15} />
            <span>Upcoming ({upcomingSessions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('week')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeView === 'week' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              background: activeView === 'week' ? 'rgba(99, 102, 241, 0.15)' : 'var(--social-btn-bg)',
              color: activeView === 'week' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <CalendarDays size={15} />
            <span>Weekly Schedule</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: activeView === 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              background: activeView === 'all' ? 'rgba(99, 102, 241, 0.15)' : 'var(--social-btn-bg)',
              color: activeView === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <span>All Sessions ({sessions.length})</span>
          </button>
        </div>

        {/* Week View Controls (Prev/Next week) */}
        {activeView === 'week' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              style={{
                background: 'var(--social-btn-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {weekDays[0]?.label} – {weekDays[6]?.label}
            </span>

            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              style={{
                background: 'var(--social-btn-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronRight size={16} />
            </button>

            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  marginLeft: '4px',
                }}
              >
                Current Week
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main View Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="skeleton-card" style={{ height: '90px' }} />
          <div className="skeleton-card" style={{ height: '90px' }} />
          <div className="skeleton-card" style={{ height: '90px' }} />
        </div>
      ) : sessions.length === 0 ? (
        /* Empty State */
        <div className="empty-state animate-fade-in" style={{ padding: '60px 24px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(99, 102, 241, 0.15))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              color: '#0ea5e9',
            }}
          >
            <Calendar size={32} />
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '6px' }}>
            No study sessions scheduled yet
          </h3>
          <p style={{ maxWidth: '440px', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.6 }}>
            Set aside dedicated time for revision, problem sets, and syllabus modules to stay consistent and exam-ready.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreate}
            disabled={subjects.length === 0}
          >
            <Plus size={16} /> Schedule First Session
          </Button>
          {subjects.length === 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '10px' }}>
              (Create at least one subject in your Dashboard first)
            </p>
          )}
        </div>
      ) : activeView === 'week' ? (
        /* Weekly Columns View */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
          }}
        >
          {weekDays.map((day) => {
            const daySessions = sessions.filter((s) => s.date === day.dateStr);

            return (
              <div
                key={day.dateStr}
                className="glass-panel"
                style={{
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  borderTop: day.isToday ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  background: day.isToday ? 'rgba(99, 102, 241, 0.05)' : undefined,
                  minHeight: '260px',
                }}
              >
                {/* Day Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: day.isToday ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {day.dayName}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {day.label}
                    </div>
                  </div>

                  {day.isToday && (
                    <span
                      style={{
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-primary)',
                        color: '#ffffff',
                      }}
                    >
                      Today
                    </span>
                  )}
                </div>

                {/* Day Sessions List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  {daySessions.length === 0 ? (
                    <div
                      style={{
                        fontSize: '0.74rem',
                        color: 'var(--text-muted)',
                        padding: '16px 0',
                        textAlign: 'center',
                      }}
                    >
                      No sessions
                    </div>
                  ) : (
                    daySessions.map((s) => {
                      const subject = subjects.find((subj) => subj.id === s.subjectId);
                      return (
                        <div
                          key={s.id}
                          onClick={() => handleOpenEdit(s)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background:
                              s.status === 'completed'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : s.status === 'cancelled'
                                ? 'var(--social-btn-bg)'
                                : 'rgba(14, 165, 233, 0.12)',
                            border:
                              s.status === 'completed'
                                ? '1px solid rgba(16, 185, 129, 0.3)'
                                : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                          }}
                          title="Click to view/edit"
                        >
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.title}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {s.startTime} ({s.durationMinutes}m) • {subject?.code || 'Course'}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Chronological List View (Upcoming or All) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(activeView === 'upcoming' ? upcomingSessions : sessions).length === 0 ? (
            <div className="empty-state" style={{ padding: '36px 20px' }}>
              <Clock size={28} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
              <h4>No upcoming study sessions</h4>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                You have no upcoming sessions scheduled. Click "Schedule Session" above.
              </p>
            </div>
          ) : (
            (activeView === 'upcoming' ? upcomingSessions : sessions).map((s) => {
              const subject = subjects.find((subj) => subj.id === s.subjectId);
              return (
                <StudySessionCard
                  key={s.id}
                  session={s}
                  subject={subject}
                  onStatusChange={handleStatusChange}
                  onEdit={handleOpenEdit}
                  onDelete={(session) => setDeletingSession(session)}
                />
              );
            })
          )}
        </div>
      )}

      {/* Schedule / Edit Modal */}
      <StudySessionModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={editingSession}
        userId={user.uid}
        subjects={subjects}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitSession}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingSession)}
        subject={
          deletingSession
            ? {
                id: deletingSession.id,
                name: deletingSession.title,
                code: 'SESSION',
                semester: '',
                createdAt: '',
                updatedAt: '',
                userId: user.uid,
              }
            : null
        }
        onClose={() => setDeletingSession(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
