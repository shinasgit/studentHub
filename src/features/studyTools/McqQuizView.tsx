import React, { useState, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  HelpCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Plus,
  Info,
  Award,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { McqQuestionItem, StudyMaterial } from '../../types/studyTools';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

interface McqQuizViewProps {
  user: User;
  subjects: Subject[];
  modules: Module[];
  selectedSubjectId: string;
  selectedModuleId: string;
  materials?: StudyMaterial[];
  loadingMaterials?: boolean;
}

export const McqQuizView: React.FC<McqQuizViewProps> = ({
  user: _user,
  subjects,
  modules,
  selectedSubjectId,
  selectedModuleId,
  materials: _materials = [],
  loadingMaterials: _loadingMaterials = false,
}) => {
  // Questions list in scope
  const [questions, setQuestions] = useState<McqQuestionItem[]>([]);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({}); // questionId -> optionId
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Notice & add state
  const [showAiNotice, setShowAiNotice] = useState(false);
  const [isAddingQuiz, setIsAddingQuiz] = useState(false);

  // Form for adding a custom quiz question
  const [questionText, setQuestionText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctKey, setCorrectKey] = useState<'a' | 'b' | 'c' | 'd'>('a');
  const [explanation, setExplanation] = useState('');

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  // Filter questions for current scope
  const scopedQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchSubject = selectedSubjectId === 'all' || q.subjectId === selectedSubjectId;
      const matchModule = selectedModuleId === 'all' || q.moduleId === selectedModuleId;
      return matchSubject && matchModule;
    });
  }, [questions, selectedSubjectId, selectedModuleId]);

  const handleStartQuiz = () => {
    if (scopedQuestions.length === 0) return;
    setIsQuizActive(true);
    setCurrentIndex(0);
    setUserAnswers({});
    setIsSubmitted(false);
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const handleSubmitQuiz = () => {
    setIsSubmitted(true);
  };

  // Calculate score
  const score = useMemo(() => {
    if (!isSubmitted) return 0;
    return scopedQuestions.reduce((acc, q) => {
      return userAnswers[q.id] === q.correctOptionId ? acc + 1 : acc;
    }, 0);
  }, [isSubmitted, scopedQuestions, userAnswers]);

  const percentage = scopedQuestions.length > 0 ? Math.round((score / scopedQuestions.length) * 100) : 0;

  const handleAddQuestion = () => {
    if (!questionText.trim() || !optA.trim() || !optB.trim() || !selectedSubject) return;

    const options = [
      { id: 'opt-a', text: optA.trim() },
      { id: 'opt-b', text: optB.trim() },
    ];
    if (optC.trim()) options.push({ id: 'opt-c', text: optC.trim() });
    if (optD.trim()) options.push({ id: 'opt-d', text: optD.trim() });

    const correctId = `opt-${correctKey}`;

    const newQ: McqQuestionItem = {
      id: `mcq-${Date.now()}`,
      subjectId: selectedSubject.id,
      moduleId: selectedModule ? selectedModule.id : null,
      question: questionText.trim(),
      options,
      correctOptionId: correctId,
      explanation: explanation.trim() || 'No additional explanation provided.',
    };

    setQuestions((prev) => [...prev, newQ]);
    setQuestionText('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setExplanation('');
    setIsAddingQuiz(false);
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
            Multiple Choice Quiz (MCQ)
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Evaluate your knowledge retention for{' '}
            {selectedSubject ? selectedSubject.name : 'all subjects'}
            {selectedModule ? ` · Module: ${selectedModule.title}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAiNotice(true)}
            title="Generate quiz from materials"
          >
            Auto-Generate Quiz
          </Button>
          {scopedQuestions.length > 0 && !isQuizActive && (
            <Button variant="primary" size="sm" onClick={handleStartQuiz}>
              <Play size={14} /> Start Quiz ({scopedQuestions.length} Questions)
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddingQuiz(true)}
            disabled={!selectedSubject}
            title={!selectedSubject ? 'Select a subject first' : 'Add custom quiz question'}
          >
            <Plus size={14} /> Add Question
          </Button>
        </div>
      </div>

      {/* AI Notice (Stage 6) */}
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
            <strong style={{ color: 'var(--text-primary)' }}>AI MCQ Generation Notice:</strong>
            <p style={{ marginTop: '4px', marginBottom: '8px' }}>
              Automatic AI generation of multiple-choice questions with plausible distractors from course slides and textbook chapters connects in Stage 6 (LLM &amp; RAG engine). Per guidelines, fake placeholder questions are strictly omitted.
            </p>
            <p style={{ margin: 0 }}>
              You can test the full scoring, option selection, and explanation review engine using &quot;Add Question&quot; above.
            </p>
          </div>
        </div>
      )}

      {/* Add Question Modal Form */}
      {isAddingQuiz && (
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
            Create MCQ Quiz Question
          </h4>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Question Text
            </label>
            <input
              type="text"
              placeholder="e.g., Which protocol operates at the Transport Layer of the OSI Model?"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="input-field"
              style={{ fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Option A {correctKey === 'a' && '(Correct Answer)'}
              </label>
              <input
                type="text"
                placeholder="Option A"
                value={optA}
                onChange={(e) => setOptA(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Option B {correctKey === 'b' && '(Correct Answer)'}
              </label>
              <input
                type="text"
                placeholder="Option B"
                value={optB}
                onChange={(e) => setOptB(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Option C (Optional) {correctKey === 'c' && '(Correct Answer)'}
              </label>
              <input
                type="text"
                placeholder="Option C"
                value={optC}
                onChange={(e) => setOptC(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Option D (Optional) {correctKey === 'd' && '(Correct Answer)'}
              </label>
              <input
                type="text"
                placeholder="Option D"
                value={optD}
                onChange={(e) => setOptD(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Correct Answer:</span>
            {(['a', 'b', 'c', 'd'] as const).map((key) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="correctKey"
                  checked={correctKey === key}
                  onChange={() => setCorrectKey(key)}
                />
                Option {key.toUpperCase()}
              </label>
            ))}
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Explanation / Why it is correct
            </label>
            <input
              type="text"
              placeholder="e.g., TCP operates at layer 4 (Transport layer)..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="input-field"
              style={{ fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" size="sm" onClick={() => setIsAddingQuiz(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddQuestion}
              disabled={!questionText.trim() || !optA.trim() || !optB.trim()}
            >
              Save Question
            </Button>
          </div>
        </div>
      )}

      {/* Active Quiz Runner */}
      {isQuizActive ? (
        isSubmitted ? (
          /* Results Summary Screen */
          <div
            className="glass-panel"
            style={{
              padding: '32px 24px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: percentage >= 70 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                  color: percentage >= 70 ? 'var(--color-success)' : 'var(--accent-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Award size={30} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 6px' }}>
                Quiz Results: {percentage}%
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                You scored {score} out of {scopedQuestions.length} correct.
              </p>
            </div>

            {/* Answer Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                Answer Review &amp; Explanations
              </h4>
              {scopedQuestions.map((q, idx) => {
                const userChoice = userAnswers[q.id];
                const isCorrect = userChoice === q.correctOptionId;
                const correctOpt = q.options.find((o) => o.id === q.correctOptionId);
                const chosenOpt = q.options.find((o) => o.id === userChoice);

                return (
                  <div
                    key={q.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isCorrect ? (
                        <CheckCircle2 size={16} color="var(--color-success)" />
                      ) : (
                        <XCircle size={16} color="var(--color-danger)" />
                      )}
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Q{idx + 1}: {q.question}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', paddingLeft: '24px' }}>
                      <div>Your answer: {chosenOpt ? chosenOpt.text : '(Unanswered)'}</div>
                      {!isCorrect && correctOpt && (
                        <div style={{ color: 'var(--color-success)', marginTop: '2px' }}>
                          Correct answer: {correctOpt.text}
                        </div>
                      )}
                      {q.explanation && (
                        <div style={{ color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                          Explanation: {q.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <Button variant="secondary" size="sm" onClick={() => setIsQuizActive(false)}>
                Close Quiz
              </Button>
              <Button variant="primary" size="sm" onClick={handleStartQuiz}>
                <RotateCcw size={14} /> Retake Quiz
              </Button>
            </div>
          </div>
        ) : (
          /* Question View During Quiz */
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Question {currentIndex + 1} of {scopedQuestions.length}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setIsQuizActive(false)}>
                Exit Quiz
              </Button>
            </div>

            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {scopedQuestions[currentIndex].question}
            </div>

            {/* Multiple Choice Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {scopedQuestions[currentIndex].options.map((opt, i) => {
                const isSelected = userAnswers[scopedQuestions[currentIndex].id] === opt.id;
                const letter = String.fromCharCode(65 + i);

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(scopedQuestions[currentIndex].id, opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--bg-card)' : 'var(--bg-tertiary)',
                      border: isSelected
                        ? '1.5px solid var(--accent-primary)'
                        : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: isSelected ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {letter}
                    </div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Navigation buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft size={14} /> Previous
              </Button>

              {currentIndex + 1 < scopedQuestions.length ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                >
                  Next <ChevronRight size={14} />
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleSubmitQuiz}>
                  <CheckCircle2 size={14} /> Submit Quiz
                </Button>
              )}
            </div>
          </div>
        )
      ) : (
        /* Empty or Ready State */
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
              No quiz questions available
            </h3>
            <p style={{ maxWidth: '420px', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px', lineHeight: 1.5 }}>
              Automatic AI generation of multiple-choice quizzes will connect in Stage 6. You can create custom quiz questions using &quot;Add Question&quot; above.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddingQuiz(true)}
              disabled={!selectedSubject}
            >
              <Plus size={15} /> Add First Quiz Question
            </Button>
          </div>
        ) : (
          <div
            className="glass-panel"
            style={{
              padding: '28px',
              textAlign: 'center',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
              Quiz Ready: {scopedQuestions.length} Question{scopedQuestions.length !== 1 ? 's' : ''}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Test your knowledge on key topics in{' '}
              {selectedSubject ? selectedSubject.name : 'this subject'}.
            </p>
            <Button variant="primary" size="md" onClick={handleStartQuiz}>
              <Play size={16} /> Start MCQ Quiz
            </Button>
          </div>
        )
      )}
    </div>
  );
};
