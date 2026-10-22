import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { LandingPage } from '../features/landing/LandingPage';
import { AuthPage } from '../features/auth/AuthPage';
import { StudentDashboard } from '../features/dashboard/StudentDashboard';
import { SubjectsPage } from '../features/subjects/SubjectsPage';
import { SubjectDetailPage } from '../features/subjects/SubjectDetailPage';
import { NotesPage } from '../features/notes/NotesPage';
import { StudyToolsPage } from '../features/studyTools/StudyToolsPage';
import { PlannerPage } from '../features/planner/PlannerPage';
import { ChatbotPage } from '../features/chatbot/ChatbotPage';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getSubjects, getSubjectById } from '../services/subjectService';
import type { Subject } from '../types/subject';
import { Lock, LogIn } from 'lucide-react';
import { Button } from '../components/common/Button';

export const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Sync subjects list for global library and subject switcher
  const syncSubjects = useCallback(async (uid: string) => {
    try {
      const data = await getSubjects(uid);
      setSubjects(data);
    } catch {
      // Handled inside components
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        syncSubjects(user.uid);
      } else {
        setSubjects([]);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [syncSubjects]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      navigate('/home');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const hideFooter = location.pathname === '/login' || location.pathname === '/signup';

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading StudentHub...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        user={currentUser}
        onLogout={handleLogout}
      />

      <main style={{ flex: 1 }}>
        <Routes>
          {/* Landing / Home */}
          <Route path="/" element={<LandingPage onGetStarted={() => navigate(currentUser ? '/dashboard' : '/signup')} />} />
          <Route path="/home" element={<LandingPage onGetStarted={() => navigate(currentUser ? '/dashboard' : '/signup')} />} />

          {/* Authentication Routes */}
          <Route
            path="/login"
            element={
              currentUser ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <AuthPage
                  initialMode="login"
                  onSuccess={() => {
                    navigate('/dashboard');
                    if (auth.currentUser) syncSubjects(auth.currentUser.uid);
                  }}
                  onNavigateHome={() => navigate('/home')}
                />
              )
            }
          />
          <Route
            path="/signup"
            element={
              currentUser ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <AuthPage
                  initialMode="signup"
                  onSuccess={() => {
                    navigate('/dashboard');
                    if (auth.currentUser) syncSubjects(auth.currentUser.uid);
                  }}
                  onNavigateHome={() => navigate('/home')}
                />
              )
            }
          />

          {/* Authenticated Dashboard & Subjects */}
          <Route
            path="/dashboard"
            element={
              currentUser ? (
                <StudentDashboard
                  user={currentUser}
                  onSelectSubject={(subj) => navigate(`/subjects/${subj.id}`)}
                  onSubjectsChange={(updated) => setSubjects(updated)}
                />
              ) : (
                <RequireAuthBanner onLogin={() => navigate('/login')} />
              )
            }
          />
          <Route
            path="/subjects"
            element={
              currentUser ? (
                <SubjectsPage
                  user={currentUser}
                  onSelectSubject={(subj) => navigate(`/subjects/${subj.id}`)}
                  onSubjectsChange={(updated) => setSubjects(updated)}
                />
              ) : (
                <RequireAuthBanner onLogin={() => navigate('/login')} />
              )
            }
          />

          {/* Subject Detail View (Modules & Subject Resources) */}
          <Route
            path="/subjects/:subjectId"
            element={
              <SubjectDetailRoute
                user={currentUser}
                subjects={subjects}
                syncSubjects={syncSubjects}
              />
            }
          />

          {/* Legacy resource library redirects to subjects */}
          <Route path="/resources" element={<Navigate to="/subjects" replace />} />

          {/* Chatbot & Study Scope Session */}
          <Route
            path="/chatbot"
            element={
              currentUser ? (
                <ChatbotPage
                  user={currentUser}
                  subjects={subjects}
                />
              ) : (
                <RequireAuthBanner onLogin={() => navigate('/login')} />
              )
            }
          />
          <Route path="/chat" element={<Navigate to="/chatbot" replace />} />

          {/* Personal Study Notes View (Preserved) */}
          <Route
            path="/notes"
            element={
              currentUser ? (
                <NotesPage
                  user={currentUser}
                  subjects={subjects}
                />
              ) : (
                <RequireAuthBanner onLogin={() => navigate('/login')} />
              )
            }
          />

          {/* Unified Study Tools View */}
          <Route
            path="/study-tools"
            element={
              currentUser ? (
                <StudyToolsPage
                  user={currentUser}
                  subjects={subjects}
                />
              ) : (
                <RequireAuthBanner onLogin={() => navigate('/login')} />
              )
            }
          />

          {/* Flashcards backward compatibility redirect */}
          <Route path="/flashcards" element={<Navigate to="/study-tools" replace />} />

          {/* Study Planner View */}
          <Route
            path="/planner"
            element={
              currentUser ? (
                <PlannerPage
                  user={currentUser}
                  subjects={subjects}
                />
              ) : (
                <RequireAuthBanner onLogin={() => navigate('/login')} />
              )
            }
          />

          {/* Fallback to dashboard or home */}
          <Route path="*" element={<Navigate to={currentUser ? '/dashboard' : '/home'} replace />} />
        </Routes>
      </main>

      {!hideFooter && <Footer />}
    </div>
  );
};

const SubjectDetailRoute: React.FC<{
  user: User | null;
  subjects: Subject[];
  syncSubjects: (uid: string) => void;
}> = ({ user, subjects, syncSubjects }) => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject | null>(() => {
    return subjects.find((s) => s.id === subjectId) || null;
  });
  const [loading, setLoading] = useState<boolean>(!subject);

  useEffect(() => {
    if (subjects.length > 0 && subjectId) {
      const found = subjects.find((s) => s.id === subjectId);
      if (found) {
        setSubject(found);
        setLoading(false);
        return;
      }
    }

    if (user && subjectId) {
      setLoading(true);
      getSubjectById(user.uid, subjectId)
        .then((res) => {
          setSubject(res);
        })
        .catch((err) => {
          console.error('Failed to load subject by id:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [user, subjectId, subjects]);

  if (!user) {
    return <RequireAuthBanner onLogin={() => navigate('/login')} />;
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
        <p>Loading course modules and resources...</p>
      </div>
    );
  }

  if (!subject) {
    return (
      <div style={{ maxWidth: '520px', margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '40px 24px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px' }}>Subject Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            We could not find this subject. It may have been removed or the link is invalid.
          </p>
          <Button variant="primary" size="md" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SubjectDetailPage
      user={user}
      subject={subject}
      subjects={subjects}
      onBack={() => {
        syncSubjects(user.uid);
        navigate('/dashboard');
      }}
    />
  );
};

const RequireAuthBanner: React.FC<{ onLogin: () => void }> = ({ onLogin }) => (
  <div
    style={{
      maxWidth: '520px',
      margin: '80px auto',
      padding: '0 24px',
      textAlign: 'center',
    }}
  >
    <div className="glass-panel animate-fade-in" style={{ padding: '48px 32px' }}>
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: 'var(--accent-rose)',
        }}
      >
        <Lock size={30} />
      </div>

      <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px' }}>
        Sign In Required
      </h2>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
        Please sign in to access your personal student workspace, course modules, and study resources.
      </p>

      <Button variant="primary" size="md" onClick={onLogin}>
        <LogIn size={16} /> Sign In to Continue
      </Button>
    </div>
  </div>
);

export default App;
