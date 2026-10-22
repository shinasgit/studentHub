import React from 'react';
import {
  FileText,
  Calendar,
  StickyNote,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

interface LandingPageProps {
  onGetStarted?: () => void;
}

const features = [
  {
    icon: <BookOpen size={20} />,
    title: 'Subjects & Modules',
    description: 'Organize your courses into subjects, then break each subject into study modules with progress tracking.',
  },
  {
    icon: <GraduationCap size={20} />,
    title: 'Study Tools',
    description: 'Master subjects with module summaries, quick revision notes, practice question sets, and interactive MCQ quizzes.',
  },
  {
    icon: <Sparkles size={20} />,
    title: 'AI Study Assistant',
    description: 'Ask questions, review complex topics, and get step-by-step explanations scoped to your specific subject and module.',
  },
  {
    icon: <StickyNote size={20} />,
    title: 'Personal Notes',
    description: 'Capture lecture summaries and key ideas, tag them by subject, and search through them instantly.',
  },
  {
    icon: <Calendar size={20} />,
    title: 'Study Planner',
    description: 'Schedule study sessions, set durations, and track completed versus upcoming sessions.',
  },
  {
    icon: <ShieldCheck size={20} />,
    title: 'Secure & Private',
    description: 'Your data is isolated per account using Firebase security rules. Nothing is shared between users.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 clamp(16px, 4vw, 24px)' }}>

      {/* Hero */}
      <section style={{ padding: 'clamp(36px, 8vw, 72px) 0 clamp(32px, 6vw, 64px)', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '6px',
            background: 'var(--accent-primary-subtle)',
            border: '1px solid var(--accent-primary-border)',
            marginBottom: '28px',
            maxWidth: '100%',
          }}
        >
          <BookOpen size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--accent-primary)', wordBreak: 'break-word' }}>
            Student productivity, simplified
          </span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(1.75rem, 5vw, 2.75rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '20px',
            maxWidth: '720px',
            margin: '0 auto 20px',
            letterSpacing: '-0.02em',
          }}
        >
          Organize your studies.<br />
          Stay on top of every subject.
        </h1>

        <p
          style={{
            fontSize: 'clamp(0.9375rem, 2.5vw, 1.0625rem)',
            maxWidth: '560px',
            margin: '0 auto 36px',
            color: 'var(--text-secondary)',
            lineHeight: 1.65,
          }}
        >
          StudentHub is a personal study workspace for managing subjects, revision notes,
          interactive study tools, and your weekly study schedule — all in one place.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Button variant="primary" size="lg" onClick={onGetStarted}>
            Get started free
            <ArrowRight size={16} />
          </Button>
          <a href="#features" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="lg">
              See what's included
            </Button>
          </a>
        </div>

        {/* Trust signals */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'clamp(12px, 3vw, 28px)',
            marginTop: '48px',
            flexWrap: 'wrap',
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
          }}
        >
          {[
            { icon: <ShieldCheck size={14} />, text: 'Firebase Auth — secure per-account data' },
            { icon: <BookOpen size={14} />, text: 'No subscription required' },
            { icon: <FileText size={14} />, text: 'PDF files stored locally in your browser' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--accent-primary)', display: 'inline-flex', flexShrink: 0 }}>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', marginBottom: 'clamp(36px, 6vw, 64px)' }} />

      {/* Features */}
      <section id="features" style={{ paddingBottom: 'clamp(40px, 6vw, 72px)' }}>
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: 'clamp(1.25rem, 3.5vw, 1.5rem)', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.01em' }}>
            Everything you need, nothing you don't
          </h2>
          <p style={{ fontSize: '0.9375rem', maxWidth: '520px', color: 'var(--text-secondary)' }}>
            Built around the actual workflow of a student. No bloat, no AI gimmicks — just practical tools.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: '1px',
            background: 'var(--border-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {features.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-card)',
                padding: 'clamp(16px, 4vw, 24px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-primary-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          marginBottom: 'clamp(40px, 6vw, 72px)',
          padding: 'clamp(32px, 6vw, 48px) clamp(16px, 5vw, 40px)',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: 'clamp(1.25rem, 3.5vw, 1.5rem)', fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.01em' }}>
          Ready to get organized?
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 28px', fontSize: '0.9375rem', lineHeight: 1.6 }}>
          Create a free account and start managing your subjects, notes, and study schedule today.
        </p>
        <Button variant="primary" size="lg" onClick={onGetStarted}>
          Create free account
          <ArrowRight size={16} />
        </Button>
      </section>
    </div>
  );
};
