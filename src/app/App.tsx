import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { LandingPage } from '../features/landing/LandingPage';
import { AuthPage } from '../features/auth/AuthPage';
import { StudentDashboard } from '../features/dashboard/StudentDashboard';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Lock, LogIn } from 'lucide-react';
import { Button } from '../components/common/Button';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'signup' | 'dashboard'>('landing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setCurrentView('landing');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
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
            onSuccess={() => setCurrentView('dashboard')}
            onNavigateHome={() => setCurrentView('landing')}
          />
        )}

        {currentView === 'dashboard' && (
          currentUser ? (
            <StudentDashboard user={currentUser} />
          ) : (
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
                  Please sign in to access your personal student workspace, course subjects, and study progress.
                </p>

                <Button variant="primary" size="md" onClick={() => setCurrentView('login')}>
                  <LogIn size={16} /> Sign In to Continue
                </Button>
              </div>
            </div>
          )
        )}
      </main>

      {(currentView === 'landing' || currentView === 'dashboard') && <Footer />}
    </div>
  );
};

export default App;
