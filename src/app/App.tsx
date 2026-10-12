import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { LandingPage } from '../features/landing/LandingPage';
import { AuthPage } from '../features/auth/AuthPage';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { BookOpen, CheckCircle2 } from 'lucide-react';
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
          <LandingPage onGetStarted={() => setCurrentView('signup')} />
        )}

        {(currentView === 'login' || currentView === 'signup') && (
          <AuthPage
            initialMode={currentView}
            onSuccess={() => setCurrentView('dashboard')}
            onNavigateHome={() => setCurrentView('landing')}
          />
        )}

        {currentView === 'dashboard' && (
          <div
            style={{
              maxWidth: '960px',
              margin: '60px auto',
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
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                  boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)',
                }}
              >
                <CheckCircle2 size={32} color="#ffffff" />
              </div>

              <h2 style={{ fontSize: '2.2rem', marginBottom: '12px' }}>
                Welcome to your <span className="gradient-text">Student Dashboard</span>
              </h2>

              <p style={{ maxWidth: '520px', margin: '0 auto 28px', color: 'var(--text-secondary)' }}>
                {currentUser?.email
                  ? `Signed in as ${currentUser.email}. Your personalized subjects, flashcards, and notes are ready!`
                  : 'Authentication successful! You are signed in and ready to learn.'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <Button variant="primary" size="lg" onClick={() => setCurrentView('landing')}>
                  <BookOpen size={18} /> View Course Materials
                </Button>
                <Button variant="secondary" size="lg" onClick={handleLogout}>
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {currentView === 'landing' && <Footer />}
    </div>
  );
};

export default App;
