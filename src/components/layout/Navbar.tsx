import React from 'react';
import { Sparkles, BookOpen, LogIn, UserPlus, LogOut, Home } from 'lucide-react';
import { Button } from '../common/Button';

interface NavbarProps {
  currentView?: 'landing' | 'login' | 'signup' | 'dashboard';
  onNavigate?: (view: 'landing' | 'login' | 'signup') => void;
  user?: { displayName?: string | null; email?: string | null } | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView = 'landing',
  onNavigate,
  user,
  onLogout,
}) => {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(10, 13, 20, 0.8)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
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
          onClick={() => onNavigate && onNavigate('landing')}
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

        <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          {currentView !== 'landing' ? (
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('landing')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
              }}
            >
              <Home size={16} /> Home
            </button>
          ) : (
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
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
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
