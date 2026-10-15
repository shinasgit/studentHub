import React from 'react';
import { BookOpen } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--footer-bg)',
        padding: '60px 24px 30px',
        marginTop: '80px',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '40px',
          marginBottom: '40px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={18} color="#ffffff" />
            </div>
            <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>
              Student<span className="gradient-text">Hub</span>
            </span>
          </div>
          <p style={{ fontSize: '0.9rem', maxWidth: '300px' }}>
            A unified learning platform designed to organize notes, practice quizzes, review flashcards,
            and supercharge student productivity.
          </p>
        </div>

        <div>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '16px', color: 'var(--text-primary)' }}>
            Modules & Tools
          </h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
            <li><a href="#" style={{ color: 'var(--text-secondary)' }}>Resource Library</a></li>
            <li><a href="#" style={{ color: 'var(--text-secondary)' }}>PDF Study Reader</a></li>
            <li><a href="#" style={{ color: 'var(--text-secondary)' }}>Smart Quizzes & Decks</a></li>
            <li><a href="#" style={{ color: 'var(--text-secondary)' }}>Study Planner & Progress</a></li>
          </ul>
        </div>

        <div>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '16px', color: 'var(--text-primary)' }}>
            Architecture
          </h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
            <li><span style={{ color: 'var(--text-secondary)' }}>React 19 + TypeScript</span></li>
            <li><span style={{ color: 'var(--text-secondary)' }}>Vite Build Tool</span></li>
            <li><span style={{ color: 'var(--text-secondary)' }}>Cloud Firestore & Auth</span></li>
            <li><span style={{ color: 'var(--text-secondary)' }}>PDF.js Document Engine</span></li>
          </ul>
        </div>
      </div>

      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          paddingTop: '24px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
        }}
      >
        <span>© {new Date().getFullYear()} AI Student Hub. All rights reserved.</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>Built for students with zero-budget engineering constraints</span>
        </div>
      </div>
    </footer>
  );
};
