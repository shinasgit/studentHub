import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode (Current: ${isDark ? 'Dark' : 'Light'})`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: showLabel ? '6px 14px' : '8px',
        borderRadius: 'var(--radius-md)',
        background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.1)'}`,
        color: isDark ? '#facc15' : '#6366f1',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = isDark
          ? '0 0 16px rgba(250, 204, 21, 0.35)'
          : '0 0 16px rgba(99, 102, 241, 0.35)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Sun Icon */}
        <span
          style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isDark
              ? 'rotate(0deg) scale(1)'
              : 'rotate(90deg) scale(0)',
            opacity: isDark ? 1 : 0,
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
          }}
        >
          <Sun size={19} strokeWidth={2.2} />
        </span>

        {/* Moon Icon */}
        <span
          style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isDark
              ? 'rotate(-90deg) scale(0)'
              : 'rotate(0deg) scale(1)',
            opacity: isDark ? 0 : 1,
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
          }}
        >
          <Moon size={19} strokeWidth={2.2} />
        </span>
      </div>

      {showLabel && (
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            color: 'var(--text-primary)',
          }}
        >
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
};
