import React from 'react';
import { Sparkles, BookOpen, LogIn, UserPlus, LogOut, Home, LayoutDashboard, FileText } from 'lucide-react';
import { Button } from '../common/Button';
import { ThemeToggle } from '../common/ThemeToggle';

interface NavbarProps {
  currentView?: 'landing' | 'login' | 'signup' | 'dashboard' | 'subject-detail' | 'resources';
  onNavigate?: (view: 'landing' | 'login' | 'signup' | 'dashboard' | 'resources') => void;
  user?: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView = 'landing',
  onNavigate,
  user,
  onLogout,
}) => {
  return (
    <header className="app-navbar">
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          onClick={() => onNavigate && onNavigate(user ? 'dashboard' : 'landing')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: onNavigate ? 'pointer' : 'default',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)',
            }}
          >
            <BookOpen size={20} color="#ffffff" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Student<span className="gradient-text">Hub</span>
          </span>
          <span className="badge" style={{ marginLeft: '6px' }}>
            <Sparkles size={12} /> AI MVP
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('landing')}
            style={{
              background: 'none',
              border: 'none',
              color: currentView === 'landing' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.95rem',
              fontWeight: currentView === 'landing' ? 700 : 500,
              fontFamily: 'inherit',
              transition: 'color var(--transition-fast)',
            }}
          >
            <Home size={16} /> Home
          </button>

          {user && (
            <>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('dashboard')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: (currentView === 'dashboard' || currentView === 'subject-detail') ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.95rem',
                  fontWeight: (currentView === 'dashboard' || currentView === 'subject-detail') ? 700 : 500,
                  fontFamily: 'inherit',
                  transition: 'color var(--transition-fast)',
                }}
              >
                <LayoutDashboard size={16} /> Dashboard
              </button>

              <button
                type="button"
                onClick={() => onNavigate && onNavigate('resources')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: currentView === 'resources' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.95rem',
                  fontWeight: currentView === 'resources' ? 700 : 500,
                  fontFamily: 'inherit',
                  transition: 'color var(--transition-fast)',
                }}
              >
                <FileText size={16} /> Resources
              </button>
            </>
          )}

          {!user && currentView === 'landing' && (
            <>
              <a
                href="#features"
                style={{
                  fontSize: '0.95rem',
                  color: 'var(--text-secondary)',
                  transition: 'color var(--transition-fast)',
                }}
              >
                Features
              </a>
              <a
                href="#modules"
                style={{
                  fontSize: '0.95rem',
                  color: 'var(--text-secondary)',
                  transition: 'color var(--transition-fast)',
                }}
              >
                Architecture
              </a>
            </>
          )}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ThemeToggle />
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User Avatar'}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: '2px solid rgba(99, 102, 241, 0.5)',
                    objectFit: 'cover',
                  }}
                />
              ) : null}
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.displayName || user.email?.split('@')[0] || 'Student'}
              </span>
              <Button variant="secondary" size="sm" onClick={onLogout}>
                <LogOut size={14} /> Sign Out
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant={currentView === 'login' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => onNavigate && onNavigate('login')}
              >
                <LogIn size={14} /> Sign In
              </Button>
              <Button
                variant={currentView === 'signup' ? 'primary' : 'primary'}
                size="sm"
                onClick={() => onNavigate && onNavigate('signup')}
              >
                <UserPlus size={14} /> Get Started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
