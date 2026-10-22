import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import type { Subject } from '../../types/subject';
import type { ChatStudyScope } from '../../types/chat';
import { ChatScopeSelector } from './ChatScopeSelector';
import { ChatInterface } from './ChatInterface';

interface ChatbotPageProps {
  user: User;
  subjects: Subject[];
}

export const ChatbotPage: React.FC<ChatbotPageProps> = ({ user, subjects }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialSubjectId = searchParams.get('subjectId') || undefined;

  // Active study session scope
  const [activeScope, setActiveScope] = useState<ChatStudyScope | null>(null);

  // If user changes route with new query params, reset session
  useEffect(() => {
    setActiveScope(null);
  }, [initialSubjectId]);

  const userDisplayName =
    user.displayName || user.email?.split('@')[0] || 'Student';

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px 20px 48px',
        minHeight: 'calc(100vh - 120px)',
      }}
    >
      {!activeScope ? (
        <ChatScopeSelector
          userId={user.uid}
          subjects={subjects}
          initialSubjectId={initialSubjectId}
          onStartSession={(scope) => setActiveScope(scope)}
          onNavigateToSubjects={() => navigate('/subjects')}
        />
      ) : (
        <ChatInterface
          scope={activeScope}
          userDisplayName={userDisplayName}
          onChangeScope={() => setActiveScope(null)}
        />
      )}
    </div>
  );
};
