import React from 'react';
import {
  Sparkles,
  FileText,
  BrainCircuit,
  Layers,
  CheckCircle2,
  Calendar,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';

interface LandingPageProps {
  onGetStarted?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const modules = [
    {
      icon: <Layers size={24} color="#818cf8" />,
      title: 'Subjects & Modules',
      description: 'Organize study units, track semester progress, and categorize topics seamlessly.',
      badge: 'Core',
    },
    {
      icon: <FileText size={24} color="#38bdf8" />,
      title: 'PDF Study Reader',
      description: 'Built-in document reader powered by PDF.js with text extraction and annotations.',
      badge: 'Reader',
    },
    {
      icon: <BrainCircuit size={24} color="#c084fc" />,
      title: 'Quizzes & Flashcards',
      description: 'Interactive spaced-repetition flashcards and self-assessment quizzes with score history.',
      badge: 'Practice',
    },
    {
      icon: <Calendar size={24} color="#34d399" />,
      title: 'Planner & Milestones',
      description: 'Schedule study sessions, assign deadlines, and conquer exam preparations.',
      badge: 'Planning',
    },
    {
      icon: <BarChart3 size={24} color="#fbbf24" />,
      title: 'Progress Analytics',
      description: 'Visualize completion rates, retention trends, and mastery across every subject.',
      badge: 'Analytics',
    },
    {
      icon: <Sparkles size={24} color="#f472b6" />,
      title: 'AI Grounded Learning',
      description: 'Local and free-tier zero-cost AI summarization and grounded course Q&A.',
      badge: 'Phase 2',
    },
  ];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px 0' }}>
      {/* Hero Section */}
      <section
        style={{
          textAlign: 'center',
          padding: '60px 0 80px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'inline-block', marginBottom: '20px' }}>
          <span className="badge">
            <Sparkles size={14} /> The All-In-One Study OS for Students
          </span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.2rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: '24px',
            maxWidth: '900px',
            margin: '0 auto 24px',
          }}
        >
          Organize, Master & Ace Your Exams with{' '}
          <span className="gradient-text">AI Student Hub</span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
            maxWidth: '680px',
            margin: '0 auto 36px',
            color: 'var(--text-secondary)',
          }}
        >
          A full-stack, zero-budget study platform for managing subjects, reading PDFs, revising with
          flashcards, attempting quizzes, and tracking your learning journey.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <Button variant="primary" size="lg" onClick={onGetStarted}>
            Start Studying Now <ArrowRight size={18} />
          </Button>
          <a href="#features">
            <Button variant="secondary" size="lg">
              Explore Architecture
            </Button>
          </a>
        </div>

        {/* Feature Pills */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '24px',
            marginTop: '48px',
            flexWrap: 'wrap',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="#10b981" /> Firebase Secure Auth
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="#6366f1" /> Fast Vite & React 19
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#a855f7" /> 100% Free-Tier Architecture
          </div>
        </div>
      </section>

      {/* Modules Grid */}
      <section id="features" style={{ padding: '40px 0 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '12px' }}>
            Engineered for Academic Excellence
          </h2>
          <p style={{ maxWidth: '580px', margin: '0 auto' }}>
            Everything you need to transform messy lecture notes and folders into a clean, actionable study
            workflow.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
          }}
        >
          {modules.map((item, idx) => (
            <Card key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {item.icon}
                </div>
                <span className="badge">{item.badge}</span>
              </div>

              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{item.title}</h3>
                <p style={{ fontSize: '0.95rem' }}>{item.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section
        id="modules"
        style={{
          marginTop: '40px',
          padding: '60px 32px',
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
          border: '1px solid var(--border-hover)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: '2.2rem', marginBottom: '16px' }}>
          Ready to Elevate Your Study Workflow?
        </h2>
        <p style={{ maxWidth: '620px', margin: '0 auto 32px', fontSize: '1.05rem' }}>
          Join students using AI Student Hub to structure their coursework, retain concepts faster, and
          achieve their academic goals.
        </p>
        <Button variant="primary" size="lg" onClick={onGetStarted}>
          Create Free Account <ArrowRight size={18} />
        </Button>
      </section>
    </div>
  );
};
