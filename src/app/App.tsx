import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { LandingPage } from '../features/landing/LandingPage';
import { AuthPage } from '../features/auth/AuthPage';
import { StudentDashboard } from '../features/dashboard/StudentDashboard';
import { SubjectDetailPage } from '../features/subjects/SubjectDetailPage';
import { ResourceLibraryPage } from '../features/resources/ResourceLibraryPage';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getSubjects } from '../services/subjectService';
import type { Subject } from '../types/subject';
import { Lock, LogIn } from 'lucide-react';
import { Button } from '../components/common/Button';

type ViewMode = 'landing' | 'login' | 'signup' | 'dashboard' | 'subject-detail' | 'resources';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('landing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  // Sync subjects list for global library and subject switcher
  const syncSubjects = useCallback(async (uid: string) => {
    try {
      const data = await getSubjects(uid);
      setSubjects(data);
    } catch {
      // Ignored or handled inside dashboard
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        syncSubjects(user.uid);
      } else {
        setSubjects([]);
        setSelectedSubject(null);
      }
    });
    return () => unsubscribe();
  }, [syncSubjects]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setSelectedSubject(null);
      setCurrentView('landing');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleSelectSubject = (subj: Subject) => {
    setSelectedSubject(subj);
    setCurrentView('subject-detail');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'dashboard' && currentUser) {
            syncSubjects(currentUser.uid);
          }
          setCurrentView(view);
        }}
        user={currentUser}
        onLogout={handleLogout}
      />

      <main style={{ flex: 1 }}>
        {currentView === 'landing' && (
          <LandingPage onGetStarted={() => setCurrentView(currentUser ? 'dashboard' : 'signup')} />
        )}

        {(currentView === 'login' || currentView === 'signup') && (
          <AuthPage
            initialMode={currentView}
            onSuccess={() => {
              setCurrentView('dashboard');
              if (auth.currentUser) syncSubjects(auth.currentUser.uid);
            }}
            onNavigateHome={() => setCurrentView('landing')}
          />
        )}

        {/* Authenticated Dashboard */}
        {currentView === 'dashboard' && (
          currentUser ? (
            <StudentDashboard
              user={currentUser}
              onSelectSubject={handleSelectSubject}
            />
          ) : (
            <RequireAuthBanner onLogin={() => setCurrentView('login')} />
          )
        )}

        {/* Subject Detail View (Modules & Subject Resources) */}
        {currentView === 'subject-detail' && (
          currentUser && selectedSubject ? (
            <SubjectDetailPage
              user={currentUser}
              subject={selectedSubject}
              subjects={subjects}
              onBack={() => {
                syncSubjects(currentUser.uid);
                setCurrentView('dashboard');
              }}
            />
          ) : (
            <RequireAuthBanner onLogin={() => setCurrentView('login')} />
          )
        )}

        {/* Global Study Resource Library */}
        {currentView === 'resources' && (
          currentUser ? (
            <ResourceLibraryPage
              user={currentUser}
              subjects={subjects}
            />
          ) : (
            <RequireAuthBanner onLogin={() => setCurrentView('login')} />
          )
        )}
      </main>

      {(currentView === 'landing' || currentView === 'dashboard' || currentView === 'resources') && <Footer />}
    </div>
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
