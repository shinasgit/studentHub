import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { BookOpen } from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { Subject } from '../../types/subject';
import type { ChatStudyScope, ChatMessage } from '../../types/chat';
import { ChatInterface } from './ChatInterface';

interface ChatbotPageProps {
  user: User;
  subjects: Subject[];
}

export const ChatbotPage: React.FC<ChatbotPageProps> = ({ user, subjects }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialSubjectId = searchParams.get('subjectId') || undefined;

  // Active study session scope and conversation state
  const [activeScope, setActiveScope] = useState<ChatStudyScope | null>(() => {
    if (subjects.length > 0) {
      const targetSub =
        (initialSubjectId && subjects.find((s) => s.id === initialSubjectId)) || subjects[0];
      return {
        subjectId: targetSub.id,
        subjectName: targetSub.name,
        subjectCode: targetSub.code,
        subjectColor: targetSub.color || '#4f64f1',
        scopeMode: 'entire_subject',
        moduleIds: [],
        moduleNames: [],
        totalModuleCount: 0,
        resourceCount: 0,
      };
    }
    return null;
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[] | undefined>(undefined);

  // Sync if initialSubjectId or subjects list changes
  useEffect(() => {
    if (subjects.length > 0) {
      const targetSub =
        (initialSubjectId && subjects.find((s) => s.id === initialSubjectId)) || subjects[0];
      setActiveScope({
        subjectId: targetSub.id,
        subjectName: targetSub.name,
        subjectCode: targetSub.code,
        subjectColor: targetSub.color || '#4f64f1',
        scopeMode: 'entire_subject',
        moduleIds: [],
        moduleNames: [],
        totalModuleCount: 0,
        resourceCount: 0,
      });
      setActiveSessionId(null);
      setActiveMessages(undefined);
    }
  }, [initialSubjectId, subjects]);

  const userDisplayName =
    user.displayName || user.email?.split('@')[0] || 'Student';

  // If student has no subjects created yet
  if (subjects.length === 0) {
    return (
      <div
        style={{
          maxWidth: '560px',
          margin: '60px auto',
          padding: '40px 24px',
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent-primary-subtle)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <BookOpen size={28} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          No Subjects Found
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.90rem', marginBottom: '24px', lineHeight: 1.55 }}>
          Create at least one course subject in your hub to enable tailored AI study assistance with Llama 3.2 3B.
        </p>
        <Button variant="primary" onClick={() => navigate('/subjects')}>
          Create a Subject
        </Button>
      </div>
    );
  }

  if (!activeScope) {
    return null;
  }

  return (
    <div
      className="chatbot-page-wrapper"
      style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '10px clamp(10px, 2vw, 20px) 12px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <ChatInterface
        user={user}
        subjects={subjects}
        scope={activeScope}
        userDisplayName={userDisplayName}
        currentSessionId={activeSessionId}
        initialMessages={activeMessages}
        onUpdateScope={(newScope) => setActiveScope(newScope)}
        onNewSession={() => {
          setActiveSessionId(null);
          setActiveMessages([]);
        }}
        onSelectSession={(session) => {
          setActiveScope(session.scope);
          setActiveSessionId(session.id);
          setActiveMessages(session.messages);
        }}
      />
    </div>
  );
};
