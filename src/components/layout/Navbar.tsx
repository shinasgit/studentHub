import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, BookOpen, LogIn, UserPlus, LogOut, Home, LayoutDashboard, FileText, StickyNote, Calendar } from 'lucide-react';
import { Button } from '../common/Button';
import { ThemeToggle } from '../common/ThemeToggle';

interface NavbarProps {
  currentView?: string;
  onNavigate?: (view: string) => void;
  user?: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNavigate,
  user,
  onLogout,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path: string, viewName?: string) => {
    if (onNavigate && viewName) {
      onNavigate(viewName);
    }
    navigate(path);
  };

  const isHome = location.pathname === '/home' || location.pathname === '/';
  const isDashboard = location.pathname === '/dashboard' || location.pathname.startsWith('/subjects');
  const isResources = location.pathname === '/resources';
  const isNotes = location.pathname === '/notes';
  const isFlashcards = location.pathname === '/flashcards';
  const isPlanner = location.pathname === '/planner';
  const isLogin = location.pathname === '/login';
  const isSignup = location.pathname === '/signup';

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
          onClick={() => handleNav(user ? '/dashboard' : '/home', user ? 'dashboard' : 'landing')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
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
            onClick={() => handleNav('/home', 'landing')}
            style={{
              background: 'none',
              border: 'none',
              color: isHome ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.95rem',
              fontWeight: isHome ? 700 : 500,
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
                onClick={() => handleNav('/dashboard', 'dashboard')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDashboard ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.95rem',
                  fontWeight: isDashboard ? 700 : 500,
                  fontFamily: 'inherit',
                  transition: 'color var(--transition-fast)',
                }}
              >
                <LayoutDashboard size={16} /> Dashboard
              </button>

              <button
                type="button"
                onClick={() => handleNav('/resources', 'resources')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isResources ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.95rem',
                  fontWeight: isResources ? 700 : 500,
                  fontFamily: 'inherit',
                  transition: 'color var(--transition-fast)',
                }}
              >
                <FileText size={16} /> Resources
              </button>

              <button
                type="button"
                onClick={() => handleNav('/notes', 'notes')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isNotes ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.95rem',
                  fontWeight: isNotes ? 700 : 500,
                  fontFamily: 'inherit',
                  transition: 'color var(--transition-fast)',
                }}
              >
                <StickyNote size={16} /> Notes
              </button>

              <button
                type="button"
                onClick={() => handleNav('/flashcards', 'flashcards')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isFlashcards ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.95rem',
                  fontWeight: isFlashcards ? 700 : 500,
                  fontFamily: 'inherit',
                  transition: 'color var(--transition-fast)',
                }}
              >
                <Sparkles size={16} /> Flashcards
              </button>

              <button
                type="button"
                onClick={() => handleNav('/planner', 'planner')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isPlanner ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.95rem',
                  fontWeight: isPlanner ? 700 : 500,
                  fontFamily: 'inherit',
                  transition: 'color var(--transition-fast)',
                }}
              >
                <Calendar size={16} /> Planner
              </button>
            </>
          )}

          {!user && isHome && (
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
                variant={isLogin ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleNav('/login', 'login')}
              >
                <LogIn size={14} /> Sign In
              </Button>
              <Button
                variant={isSignup ? 'primary' : 'primary'}
                size="sm"
                onClick={() => handleNav('/signup', 'signup')}
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
