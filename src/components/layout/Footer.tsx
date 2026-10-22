import React from 'react';
import { BookOpen } from 'lucide-react';

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--footer-bg)',
        padding: '40px 24px 28px',
        marginTop: '64px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '32px',
          marginBottom: '32px',
        }}
      >
        {/* Brand */}
        <div style={{ maxWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '5px',
                background: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={13} color="#ffffff" />
            </div>
            <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              StudentHub
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            A personal study workspace for organizing subjects, study tools,
            notes, and your weekly schedule.
          </p>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
          <div>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Features
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['Subjects & Modules', 'Study Tools', 'Study Planner', 'AI Chatbot', 'Personal Notes'].map((item) => (
                <li key={item}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Built with
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['React 19 + TypeScript', 'Vite', 'Firebase Auth', 'Cloud Firestore'].map((item) => (
                <li key={item}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          © {year} StudentHub
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Free to use — no subscription required
        </span>
      </div>
    </footer>
  );
};
