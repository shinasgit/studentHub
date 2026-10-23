import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen,
  LogIn,
  UserPlus,
  LogOut,
  LayoutDashboard,
  MessageSquare,
  Calendar,
  GraduationCap,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '../common/Button';
import { ThemeToggle } from '../common/ThemeToggle';

interface NavbarProps {
  currentView?: string;
  onNavigate?: (view: string) => void;
  user?: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (path: string, viewName?: string) => {
    if (onNavigate && viewName) onNavigate(viewName);
    navigate(path);
    setMobileOpen(false);
  };

  const isHome = location.pathname === '/home' || location.pathname === '/';
  const isDashboard = location.pathname === '/dashboard';
  const isSubjects = location.pathname.startsWith('/subjects');
  const isStudyTools = location.pathname.startsWith('/study-tools') || location.pathname === '/flashcards';
  const isPlanner = location.pathname === '/planner';
  const isChatbot = location.pathname.startsWith('/chatbot') || location.pathname.startsWith('/chat');
  const isLogin = location.pathname === '/login';

  const navItems = user
    ? [
        { label: 'Dashboard', icon: <LayoutDashboard size={15} />, path: '/dashboard', active: isDashboard, view: 'dashboard' },
        { label: 'Subjects', icon: <BookOpen size={15} />, path: '/subjects', active: isSubjects, view: 'subjects' },
        { label: 'Study Tools', icon: <GraduationCap size={15} />, path: '/study-tools', active: isStudyTools, view: 'studyTools' },
        { label: 'Planner', icon: <Calendar size={15} />, path: '/planner', active: isPlanner, view: 'planner' },
        { label: 'Chatbot', icon: <MessageSquare size={15} />, path: '/chatbot', active: isChatbot, view: 'chatbot' },
      ]
    : [];

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Student';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="app-navbar">
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        {/* Logo */}
        <div
          onClick={() => handleNav(user ? '/dashboard' : '/home', user ? 'dashboard' : 'landing')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}
          aria-label="StudentHub Home"
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BookOpen size={15} color="#ffffff" />
          </div>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            StudentHub
          </span>
        </div>

        {/* Desktop Nav */}
        <nav
          style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, justifyContent: 'center' }}
          aria-label="Main navigation"
          className="desktop-nav"
        >
          {!user && isHome && (
            <a
              href="#features"
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                transition: 'color var(--transition-fast)',
              }}
            >
              Features
            </a>
          )}
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNav(item.path, item.view)}
              className={`nav-link${item.active ? ' active' : ''}`}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <ThemeToggle />

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* User avatar */}
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: '1.5px solid var(--border-medium)',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                  title={displayName}
                >
                  {initial}
                </div>
              )}

              <span
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'none',
                }}
                className="user-name-text"
              >
                {displayName}
              </span>

              {/* Header Sign Out button (Icon only) */}
              <div className="header-sign-out">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onLogout}
                  aria-label="Sign out"
                  title="Sign out"
                  style={{
                    padding: '6px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px',
                  }}
                >
                  <LogOut size={15} />
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleNav('/login', 'login')}
                style={{ fontWeight: isLogin ? 600 : 500 }}
              >
                <LogIn size={14} />
                <span className="auth-btn-label">Sign In</span>
              </Button>
              <Button variant="primary" size="sm" onClick={() => handleNav('/signup', 'signup')}>
                <UserPlus size={14} />
                <span className="auth-btn-label">Get Started</span>
              </Button>
            </div>
          )}

          {/* Mobile menu toggle */}
          {user && (
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
              className="mobile-menu-btn"
              style={{
                display: 'none',
                background: mobileOpen ? 'var(--bg-tertiary)' : 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                minWidth: '40px',
                minHeight: '40px',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Backdrop & Drawer */}
      {mobileOpen && user && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed',
              top: '60px',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              zIndex: 48,
              backdropFilter: 'blur(2px)',
            }}
          />

          <nav
            style={{
              position: 'absolute',
              top: '60px',
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              borderBottom: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-lg)',
              padding: '12px 16px 20px',
              zIndex: 49,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxHeight: 'calc(100dvh - 60px)',
              overflowY: 'auto',
            }}
            aria-label="Mobile navigation"
          >
            {/* User profile indicator in mobile menu */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: '6px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                }}
              >
                {initial}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </div>
              </div>
            </div>

            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path, item.view)}
                className={`nav-link${item.active ? ' active' : ''}`}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '12px 14px',
                  minHeight: '44px',
                  fontSize: '0.92rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}

            {/* Mobile Sign Out */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '8px', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onLogout?.();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  minHeight: '44px',
                  background: 'var(--color-danger-subtle)',
                  border: '1px solid var(--color-danger-border)',
                  color: 'var(--color-danger)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </nav>
        </>
      )}

      <style>{`
        @media (max-width: 900px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @media (max-width: 380px) {
          .auth-btn-label { display: none !important; }
        }
        @media (min-width: 1024px) {
          .user-name-text { display: block !important; }
        }
      `}</style>
    </header>
  );
};
