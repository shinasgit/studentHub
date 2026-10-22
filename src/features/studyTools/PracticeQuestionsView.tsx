import React, { useState, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  HelpCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  Eye,
  Plus,
  Info,
  Award,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { PracticeQuestionItem } from '../../types/studyTools';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';
import type { StudyMaterial } from '../../types/studyTools';

interface PracticeQuestionsViewProps {
  user: User;
  subjects: Subject[];
  modules: Module[];
  selectedSubjectId: string;
  selectedModuleId: string;
  materials?: StudyMaterial[];
  loadingMaterials?: boolean;
}

export const PracticeQuestionsView: React.FC<PracticeQuestionsViewProps> = ({
  user: _user,
  subjects,
  modules,
  selectedSubjectId,
  selectedModuleId,
  materials: _materials = [],
  loadingMaterials: _loadingMaterials = false,
}) => {
  // Practice questions stored locally/in-session
  const [questions, setQuestions] = useState<PracticeQuestionItem[]>([]);
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // New question form
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newAnswerText, setNewAnswerText] = useState('');
  const [newExplanationText, setNewExplanationText] = useState('');
  const [showAiNotice, setShowAiNotice] = useState(false);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  // Filter questions for the selected scope
  const scopedQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchSubject = selectedSubjectId === 'all' || q.subjectId === selectedSubjectId;
      const matchModule = selectedModuleId === 'all' || q.moduleId === selectedModuleId;
      return matchSubject && matchModule;
    });
  }, [questions, selectedSubjectId, selectedModuleId]);

  const handleStartPractice = () => {
    if (scopedQuestions.length === 0) return;
    setIsPracticing(true);
    setCurrentIndex(0);
    setShowAnswer(false);
    setMasteredCount(0);
    setIsComplete(false);
  };

  const handleMarkConfidence = (mastered: boolean) => {
    if (mastered) {
      setMasteredCount((prev) => prev + 1);
    }
    if (currentIndex + 1 < scopedQuestions.length) {
      setCurrentIndex((prev) => prev + 1);
      setShowAnswer(false);
    } else {
      setIsComplete(true);
    }
  };

  const handleAddQuestion = () => {
    if (!newQuestionText.trim() || !newAnswerText.trim() || !selectedSubject) return;

    const item: PracticeQuestionItem = {
      id: `q-${Date.now()}`,
      subjectId: selectedSubject.id,
      moduleId: selectedModule ? selectedModule.id : null,
      question: newQuestionText.trim(),
      answer: newAnswerText.trim(),
      explanation: newExplanationText.trim() || undefined,
    };

    setQuestions((prev) => [...prev, item]);
    setNewQuestionText('');
    setNewAnswerText('');
    setNewExplanationText('');
    setIsAddingQuestion(false);
  };

  return (
    <div className="study-tool-content animate-fade-in">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Practice Questions
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Test conceptual application for{' '}
            {selectedSubject ? selectedSubject.name : 'all subjects'}
            {selectedModule ? ` · Module: ${selectedModule.title}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAiNotice(true)}
            title="Generate questions from lecture notes"
          >
            Auto-Generate Questions
          </Button>
          {scopedQuestions.length > 0 && !isPracticing && (
            <Button variant="primary" size="sm" onClick={handleStartPractice}>
              <Play size={14} /> Start Practice ({scopedQuestions.length})
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddingQuestion(true)}
            disabled={!selectedSubject}
            title={!selectedSubject ? 'Select a subject first' : 'Add custom question'}
          >
            <Plus size={14} /> Add Question
          </Button>
        </div>
      </div>

      {/* AI Connection Notice (Stage 6) */}
      {showAiNotice && (
        <div
          style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            marginBottom: '20px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <Info size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>AI Question Generator Notice:</strong>
            <p style={{ marginTop: '4px', marginBottom: '8px' }}>
              Automatic question bank generation from syllabus PDFs and lecture notes is scheduled for connection in Stage 6 (LLM &amp; RAG engine). Per project requirements, fake questions are not generated.
            </p>
            <p style={{ margin: 0 }}>
              You can test the interactive practice runner by adding self-test questions using the &quot;Add Question&quot; button.
            </p>
          </div>
        </div>
      )}

      {/* Add Custom Question Form */}
      {isAddingQuestion && (
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            border: '1px solid var(--border-medium)',
          }}
        >
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
            Add Concept Practice Question
          </h4>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Question Prompt
            </label>
            <input
              type="text"
              placeholder="e.g., Explain the difference between TCP and UDP flow control."
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              className="input-field"
              style={{ fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Core Answer / Solution
            </label>
            <textarea
              placeholder="Provide the direct answer or key points..."
              value={newAnswerText}
              onChange={(e) => setNewAnswerText(e.target.value)}
              className="input-field"
              style={{ minHeight: '80px', fontSize: '0.875rem', resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Explanation / Context (Optional)
            </label>
            <input
              type="text"
              placeholder="Additional background, diagrams, or memory cues..."
              value={newExplanationText}
              onChange={(e) => setNewExplanationText(e.target.value)}
              className="input-field"
              style={{ fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
            <Button variant="secondary" size="sm" onClick={() => setIsAddingQuestion(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddQuestion}
              disabled={!newQuestionText.trim() || !newAnswerText.trim()}
            >
              Save Question
            </Button>
          </div>
        </div>
      )}

      {/* Active Practice Session */}
      {isPracticing ? (
        isComplete ? (
          /* Completion State */
          <div
            className="glass-panel"
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Award size={32} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>
              Practice Session Completed!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
              You reviewed {scopedQuestions.length} question{scopedQuestions.length !== 1 ? 's' : ''} and mastered{' '}
              {masteredCount} on this run.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <Button variant="secondary" size="sm" onClick={() => setIsPracticing(false)}>
                Back to Questions
              </Button>
              <Button variant="primary" size="sm" onClick={handleStartPractice}>
                <RotateCcw size={14} /> Practice Again
              </Button>
            </div>
          </div>
        ) : (
          /* Question Card in Progress */
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Question {currentIndex + 1} of {scopedQuestions.length}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setIsPracticing(false)}>
                Exit Practice
              </Button>
            </div>

            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {scopedQuestions[currentIndex].question}
            </div>

            {!showAnswer ? (
              <div style={{ paddingTop: '10px' }}>
                <Button variant="secondary" size="md" onClick={() => setShowAnswer(true)}>
                  <Eye size={15} /> Reveal Answer &amp; Explanation
                </Button>
              </div>
            ) : (
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Correct Answer:
                  </div>
                  <div style={{ fontSize: '0.925rem', color: 'var(--text-primary)', marginTop: '2px', lineHeight: 1.5 }}>
                    {scopedQuestions[currentIndex].answer}
                  </div>
                </div>

                {scopedQuestions[currentIndex].explanation && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Explanation:
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.5 }}>
                      {scopedQuestions[currentIndex].explanation}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', paddingTop: '12px' }}>
                  <Button variant="secondary" size="sm" onClick={() => handleMarkConfidence(false)}>
                    Need Review
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => handleMarkConfidence(true)}>
                    <CheckCircle2 size={14} /> Got It Right
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        /* Empty / Available Questions State */
        scopedQuestions.length === 0 ? (
          <div
            className="empty-state animate-fade-in"
            style={{
              padding: '44px 20px',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <HelpCircle size={28} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>
              No practice questions in this scope
            </h3>
            <p style={{ maxWidth: '420px', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px', lineHeight: 1.5 }}>
              Automatic AI extraction from module materials is scheduled for Stage 6. You can create custom practice questions right now using &quot;Add Question&quot;.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddingQuestion(true)}
              disabled={!selectedSubject}
            >
              <Plus size={15} /> Add First Practice Question
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {scopedQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="glass-panel"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Question #{idx + 1}
                  </div>
                  <div style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {q.question}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={handleStartPractice}>
                  Practice
                </Button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};
