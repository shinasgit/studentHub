import React, { useState, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import {
  HelpCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Plus,
  Award,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Sliders,
  FileText,
  Globe,
  Video,
  RefreshCw,
  AlertCircle,
  ScanText,
  FileCheck2,
  Copy,
  Download,
  Check,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import {
  generateMcqQuiz,
  type McqQuizProgress,
  type McqQuizResult,
} from '../../services/mcqQuizService';
import { getSelectedModel, checkOllamaConnection } from '../../services/ollamaService';
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
  materials = [],
  loadingMaterials: _loadingMaterials = false,
}) => {
  // Questions list in React state
  const [questions, setQuestions] = useState<McqQuestionItem[]>([]);
  const [lastResult, setLastResult] = useState<McqQuizResult | null>(null);

  // All eligible study materials in current scope (PDFs, Web Articles, YouTube Videos)
  const availableMaterials = useMemo(() => {
    return materials.filter(
      (m) =>
        m.type === 'PDF' ||
        m.type === 'Web' ||
        m.name.toLowerCase().endsWith('.pdf') ||
        m.url?.startsWith('http://') ||
        m.url?.startsWith('https://')
    );
  }, [materials]);

  // Generation Controls
  const [selectedMaterialScope, setSelectedMaterialScope] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // AI Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressState, setProgressState] = useState<McqQuizProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Active Quiz State (strictly 10 questions)
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({}); // questionId -> optionId
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Add custom quiz question modal
  const [isAddingQuiz, setIsAddingQuiz] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctKey, setCorrectKey] = useState<'a' | 'b' | 'c' | 'd'>('a');
  const [explanation, setExplanation] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Filter questions for current scope
  const scopedQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchSubject = selectedSubjectId === 'all' || q.subjectId === selectedSubjectId;
      const matchModule = selectedModuleId === 'all' || q.moduleId === selectedModuleId;
      return matchSubject && matchModule;
    });
  }, [questions, selectedSubjectId, selectedModuleId]);

  // Target materials based on selection
  const targetMaterials = useMemo(() => {
    if (selectedMaterialScope === 'all') {
      return availableMaterials;
    }
    return availableMaterials.filter((p) => p.id === selectedMaterialScope);
  }, [availableMaterials, selectedMaterialScope]);

  // Generate MCQ Quiz via Ollama (strictly 10 questions)
  const handleGenerateQuiz = async () => {
    if (!selectedSubject) {
      setErrorMsg('Please select a subject from the selector above first.');
      return;
    }

    if (targetMaterials.length === 0) {
      setErrorMsg(
        `No study materials (PDFs or web links) found for this ${selectedModule ? 'module' : 'subject'}. Please attach or upload materials first.`
      );
      return;
    }

    try {
      const conn = await checkOllamaConnection();
      if (!conn.connected) {
        setErrorMsg(
          conn.error?.message ||
          'Ollama is not running. Please start Ollama or test connection in the panel above.'
        );
        return;
      }
    } catch {
      // Proceed to generation
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setProgressState({
      stage: 'resolving_files',
      message: 'Preparing study materials (PDFs & Web)...',
      percent: 5,
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const activeModel = getSelectedModel() || 'llama3.2:3b';
      const result = await generateMcqQuiz({
        materials: targetMaterials,
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        moduleId: selectedModule ? selectedModule.id : null,
        moduleName: selectedModule ? selectedModule.title : undefined,
        count: 10, // Strictly 10 questions per FIX 2
        difficulty,
        model: activeModel,
        abortSignal: abortController.signal,
        onProgress: (p) => setProgressState(p),
      });

      // Update question state: replace any existing questions in this scope with the exact 10 questions
      setQuestions((prev) => {
        const others = prev.filter((q) => {
          const matchSubject = selectedSubjectId === 'all' || q.subjectId === selectedSubjectId;
          const matchModule = selectedModuleId === 'all' || q.moduleId === selectedModuleId;
          return !(matchSubject && matchModule);
        });
        return [...result.questions, ...others];
      });

      setLastResult(result);
      setIsQuizActive(false);
      setIsSubmitted(false);
      setUserAnswers({});
      triggerToast(`Generated exactly 10 ${difficulty.toUpperCase()} MCQ quiz questions!`);
    } catch (err: unknown) {
      const errorObj = err as Error & { info?: { message: string; suggestion: string } };
      if (abortController.signal.aborted) {
        setErrorMsg('Quiz generation was cancelled.');
      } else {
        const fullMsg = errorObj.info?.suggestion
          ? `${errorObj.message} (${errorObj.info.suggestion})`
          : errorObj.message || 'Failed to generate MCQ quiz.';
        setErrorMsg(fullMsg);
      }
    } finally {
      setIsGenerating(false);
      setProgressState(null);
      abortControllerRef.current = null;
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      setErrorMsg('Quiz generation was cancelled by student.');
    }
  };

  // Quiz Execution Handlers
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

  // Calculate score based strictly on the current 10-question set
  const score = useMemo(() => {
    if (!isSubmitted) return 0;
    return scopedQuestions.reduce((acc, q) => {
      return userAnswers[q.id] === q.correctOptionId ? acc + 1 : acc;
    }, 0);
  }, [isSubmitted, scopedQuestions, userAnswers]);

  const percentage = scopedQuestions.length > 0 ? Math.round((score / scopedQuestions.length) * 100) : 0;

  // Copy Quiz to Clipboard
  const handleCopyQuiz = async () => {
    if (scopedQuestions.length === 0) return;

    const formatted = scopedQuestions
      .map((q, idx) => {
        const opts = q.options
          .map((o, i) => `  ${String.fromCharCode(65 + i)}. ${o.text}${o.id === q.correctOptionId ? ' [Correct]' : ''}`)
          .join('\n');
        const sourceMeta = q.sourceFile
          ? `\n> *Source: ${q.sourceFile}${q.pageRef ? ` (${q.pageRef})` : ''}*`
          : '';

        return `### Q${idx + 1}: ${q.question}
${opts}
**Explanation:** ${q.explanation || 'N/A'}${sourceMeta}`;
      })
      .join('\n\n---\n\n');

    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      triggerToast('Quiz copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      triggerToast('Failed to copy to clipboard.');
    }
  };

  // Export Quiz to File
  const handleExportQuiz = () => {
    if (scopedQuestions.length === 0) return;

    const scopeTitle = selectedModule
      ? `${selectedSubject?.name || 'Subject'} - ${selectedModule.title}`
      : selectedSubject?.name || 'Subject';

    const header = `# MCQ Quiz: ${scopeTitle}\n*Generated via Ollama Llama 3.2 (3B)*\n*Total Questions: ${scopedQuestions.length}*\n\n`;

    const body = scopedQuestions
      .map((q, idx) => {
        const opts = q.options
          .map((o, i) => `${String.fromCharCode(65 + i)}) ${o.text}`)
          .join('\n');
        const correctOpt = q.options.find((o) => o.id === q.correctOptionId);
        const correctLetter = q.options.findIndex((o) => o.id === q.correctOptionId);
        const letterStr = correctLetter >= 0 ? String.fromCharCode(65 + correctLetter) : 'A';

        const sourceMeta = q.sourceFile
          ? `\nSource: ${q.sourceFile}${q.pageRef ? ` (${q.pageRef})` : ''}`
          : '';

        return `## Question ${idx + 1}\n${q.question}\n\n${opts}\n\n**Correct Answer:** Option ${letterStr} (${correctOpt?.text || ''})\n**Explanation:** ${q.explanation || 'N/A'}${sourceMeta}`;
      })
      .join('\n\n---\n\n');

    const blob = new Blob([header + body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeScope = (selectedModule?.title || selectedSubject?.name || 'quiz')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `${safeScope}_MCQQuiz.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast('Quiz exported to file!');
  };

  // Manual Add Question
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
      id: `mcq-custom-${Date.now()}`,
      subjectId: selectedSubject.id,
      moduleId: selectedModule ? selectedModule.id : null,
      question: questionText.trim(),
      options,
      correctOptionId: correctId,
      explanation: explanation.trim() || 'No additional explanation provided.',
      difficulty,
      sourceFile: 'Student Custom Note',
    };

    setQuestions((prev) => [newQ, ...prev]);
    setQuestionText('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setExplanation('');
    setIsAddingQuiz(false);
    triggerToast('Custom question added!');
  };

  // Helper for source type icon
  const renderSourceIcon = (mat: StudyMaterial) => {
    if (mat.url?.includes('youtube.com') || mat.url?.includes('youtu.be')) {
      return <Video size={12} color="#ef4444" />;
    }
    if (mat.type === 'Web' || mat.url?.startsWith('http')) {
      return <Globe size={12} color="#10b981" />;
    }
    return <FileText size={12} color="var(--accent-primary)" />;
  };

  return (
    <div className="study-tool-content animate-fade-in">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '12px 20px',
            background: 'var(--accent-primary)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.875rem',
            fontWeight: 600,
            zIndex: 9999,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <Check size={16} /> {toastMsg}
        </div>
      )}

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Multiple Choice Quiz (MCQ)
            </h2>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--accent-primary)',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              Exactly 10 Questions · Multi-Source Grounded
            </span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Evaluate knowledge retention for{' '}
            <strong style={{ color: 'var(--text-secondary)' }}>
              {selectedSubject ? selectedSubject.name : 'all subjects'}
            </strong>
            {selectedModule ? ` · Module: ${selectedModule.title}` : ''}
          </div>
        </div>

        {/* Global Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {scopedQuestions.length > 0 && !isQuizActive && (
            <>
              <Button variant="primary" size="sm" onClick={handleStartQuiz}>
                <Play size={14} /> Start Quiz ({scopedQuestions.length} Qs)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyQuiz}
                title="Copy all quiz questions"
              >
                {copied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportQuiz}
                title="Export quiz as markdown"
              >
                <Download size={14} /> Export
              </Button>
            </>
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

      {/* Generator Configuration Panel */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-medium)',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              MCQ Quiz Generation Controls
            </span>
          </div>

          {/* Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isGenerating ? (
              <button
                type="button"
                onClick={handleCancelGeneration}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--color-danger)',
                  color: 'var(--color-danger)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <XCircle size={14} /> Cancel
              </button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerateQuiz}
                disabled={!selectedSubject || availableMaterials.length === 0}
                title={
                  !selectedSubject
                    ? 'Select a subject'
                    : availableMaterials.length === 0
                    ? 'No materials found for this module/subject'
                    : 'Generate exactly 10 MCQ quiz questions with Ollama'
                }
              >
                <Sparkles size={14} /> Generate 10-Question Quiz
              </Button>
            )}
          </div>
        </div>

        {/* Controls row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          {/* Material Scope (PDFs + Web Articles + YouTube) */}
          <div>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Source Material
            </label>
            <select
              className="input-field"
              value={selectedMaterialScope}
              onChange={(e) => setSelectedMaterialScope(e.target.value)}
              disabled={isGenerating || availableMaterials.length === 0}
              style={{ fontSize: '0.8125rem', padding: '6px 10px', height: '36px' }}
            >
              <option value="all">
                {availableMaterials.length > 0
                  ? `All Available Materials (${availableMaterials.length} sources: PDFs, Web & Videos)`
                  : 'No materials available'}
              </option>
              {availableMaterials.map((mat) => {
                const isYt = mat.url?.includes('youtube.com') || mat.url?.includes('youtu.be');
                const isWeb = mat.type === 'Web' || mat.url?.startsWith('http');
                const tag = isYt ? '[YouTube]' : isWeb ? '[Web Article]' : '[PDF]';
                return (
                  <option key={mat.id} value={mat.id}>
                    {tag} {mat.name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Question Count (FIX 2: Strictly 10 Questions) */}
          <div>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Question Count (Fixed)
            </label>
            <div
              style={{
                height: '36px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--accent-primary)',
                background: 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--accent-primary)',
              }}
            >
              <CheckCircle2 size={14} /> Exactly 10 Questions
            </div>
          </div>

          {/* Difficulty (FIX 3: Functional Cognitive Difficulty) */}
          <div>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Difficulty Level
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['easy', 'medium', 'hard'] as const).map((diff) => {
                const isSelected = difficulty === diff;
                const colors = {
                  easy: 'var(--color-success)',
                  medium: 'var(--accent-primary)',
                  hard: 'var(--accent-warning)',
                };
                return (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    disabled={isGenerating}
                    title={
                      diff === 'easy'
                        ? 'Definitions & direct factual recall'
                        : diff === 'medium'
                        ? 'Conceptual understanding & application'
                        : 'Analytical reasoning & subtle distinctions'
                    }
                    style={{
                      flex: 1,
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected
                        ? `1.5px solid ${colors[diff]}`
                        : '1px solid var(--border-medium)',
                      background: isSelected
                        ? `rgba(59, 130, 246, 0.12)`
                        : 'var(--bg-tertiary)',
                      color: isSelected ? colors[diff] : 'var(--text-secondary)',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.8125rem',
                      textTransform: 'capitalize',
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {diff}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected materials badges */}
        {targetMaterials.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '8px',
            }}
          >
            <span>Target materials:</span>
            {targetMaterials.map((mat) => (
              <span
                key={mat.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                }}
              >
                {renderSourceIcon(mat)}
                {mat.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Progress Bar & Stage Indicator */}
      {isGenerating && progressState && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--accent-primary)',
            background: 'rgba(59, 130, 246, 0.05)',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={16} className="animate-spin" color="var(--accent-primary)" />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {progressState.message}
              </span>
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
              {progressState.percent}%
            </span>
          </div>

          <div
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '4px',
              background: 'var(--bg-tertiary)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressState.percent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent-primary), #60a5fa)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '10px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>
              Stage:{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>
                {progressState.stage === 'resolving_files' && 'Resolving PDF & Web resources'}
                {progressState.stage === 'extracting_pdf' && 'Extracting PDF & OCR text'}
                {progressState.stage === 'extracting_web' && 'Fetching web articles & transcripts'}
                {progressState.stage === 'generating_quiz' && `Synthesizing 10 ${difficulty.toUpperCase()} MCQs`}
                {progressState.stage === 'repairing_quiz' && 'Ensuring exact 10 question count'}
                {progressState.stage === 'completed' && 'Ready'}
              </strong>
            </span>
            <span>Local Ollama · Exactly 10 Questions Enforced</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--color-danger)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <AlertCircle size={18} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--color-danger)' }}>Generation Error: </strong>
            <div style={{ whiteSpace: 'pre-wrap', marginTop: '4px' }}>{errorMsg}</div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Last Result Metadata Banner with Source Extraction Details */}
      {lastResult && scopedQuestions.length > 0 && !isGenerating && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <FileCheck2 size={15} color="var(--color-success)" />
              <span>
                Grounded on <strong style={{ color: 'var(--text-secondary)' }}>{lastResult.sources.filter(s => s.status === 'success').length} verified source{lastResult.sources.filter(s => s.status === 'success').length !== 1 ? 's' : ''}</strong>
                {lastResult.totalSourceCharacters > 0 && ` (${Math.round(lastResult.totalSourceCharacters / 1000)}k characters)`}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '8px',
                  textTransform: 'uppercase',
                  background:
                    lastResult.difficulty === 'easy'
                      ? 'rgba(34, 197, 94, 0.15)'
                      : lastResult.difficulty === 'hard'
                      ? 'rgba(234, 179, 8, 0.15)'
                      : 'rgba(59, 130, 246, 0.15)',
                  color:
                    lastResult.difficulty === 'easy'
                      ? 'var(--color-success)'
                      : lastResult.difficulty === 'hard'
                      ? 'var(--accent-warning)'
                      : 'var(--accent-primary)',
                }}
              >
                {lastResult.difficulty} Difficulty
              </span>
              {lastResult.hasOcr && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-warning)', fontSize: '0.75rem' }}>
                  <ScanText size={13} /> OCR Scanned Pages
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Quiz Size: <strong style={{ color: 'var(--color-success)' }}>{lastResult.questions.length} Questions</strong></span>
              <span>·</span>
              <span>Model: <code style={{ color: 'var(--text-secondary)' }}>{lastResult.modelUsed}</code></span>
              <span>·</span>
              <span>Gen time: <strong style={{ color: 'var(--text-secondary)' }}>{((lastResult.durationMs || 0) / 1000).toFixed(1)}s</strong></span>
            </div>
          </div>

          {/* Sources Breakdown with Status */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
            {lastResult.sources.map((s, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.725rem',
                  background: s.status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)',
                  border: s.status === 'error' ? '1px solid var(--color-danger)' : '1px solid var(--border-subtle)',
                  color: s.status === 'error' ? 'var(--color-danger)' : 'var(--text-secondary)',
                }}
                title={s.errorMessage || `${s.characterCount} chars extracted`}
              >
                {s.type === 'YouTube' ? <Video size={10} color="#ef4444" /> : s.type === 'Web' ? <Globe size={10} color="#10b981" /> : <FileText size={10} color="var(--accent-primary)" />}
                {s.title || s.fileName}
                {s.status === 'error' ? ' (Failed)' : ` (${Math.round(s.characterCount / 1000)}k)`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add Custom Question Form */}
      {isAddingQuiz && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            padding: '20px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            border: '1.5px solid var(--accent-primary)',
          }}
        >
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Create Custom MCQ Quiz Question
          </h4>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Question Text *
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
                Option A {correctKey === 'a' && '✓ (Correct)'}
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
                Option B {correctKey === 'b' && '✓ (Correct)'}
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
                Option C {correctKey === 'c' && '✓ (Correct)'}
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
                Option D {correctKey === 'd' && '✓ (Correct)'}
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
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Mark Correct Option:</span>
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
              Explanation / Grounding Note
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

      {/* Main Quiz Area */}
      {isQuizActive ? (
        isSubmitted ? (
          /* ================= QUIZ RESULTS SCREEN ================= */
          <div
            className="glass-panel animate-fade-in"
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
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                Quiz Results: {percentage}%
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                You scored <strong style={{ color: 'var(--text-primary)' }}>{score}</strong> out of{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{scopedQuestions.length}</strong> correct.
              </p>
            </div>

            {/* Answer Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
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
                      padding: '16px 18px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-tertiary)',
                      border: isCorrect
                        ? '1px solid rgba(34, 197, 94, 0.3)'
                        : '1px solid rgba(239, 68, 68, 0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      {isCorrect ? (
                        <CheckCircle2 size={18} color="var(--color-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      ) : (
                        <XCircle size={18} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                          Q{idx + 1}: {q.question}
                        </span>
                      </div>
                      {q.difficulty && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            textTransform: 'uppercase',
                            background:
                              q.difficulty === 'easy'
                                ? 'rgba(34, 197, 94, 0.15)'
                                : q.difficulty === 'hard'
                                ? 'rgba(234, 179, 8, 0.15)'
                                : 'rgba(59, 130, 246, 0.15)',
                            color:
                              q.difficulty === 'easy'
                                ? 'var(--color-success)'
                                : q.difficulty === 'hard'
                                ? 'var(--accent-warning)'
                                : 'var(--accent-primary)',
                          }}
                        >
                          {q.difficulty}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '28px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>
                        Your answer:{' '}
                        <span style={{ color: isCorrect ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                          {chosenOpt ? chosenOpt.text : '(Unanswered)'}
                        </span>
                      </div>
                      {!isCorrect && correctOpt && (
                        <div style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                          Correct answer: {correctOpt.text}
                        </div>
                      )}
                      {q.explanation && (
                        <div style={{ color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic', lineHeight: 1.5 }}>
                          Explanation: {q.explanation}
                        </div>
                      )}
                      {q.sourceFile && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FileText size={12} color="var(--accent-primary)" />
                          Source: {q.sourceFile}{q.pageRef ? ` (${q.pageRef})` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Button variant="secondary" size="sm" onClick={() => setIsQuizActive(false)}>
                Close Quiz
              </Button>
              <Button variant="secondary" size="sm" onClick={handleStartQuiz}>
                <RotateCcw size={14} /> Retake Same Quiz
              </Button>
              <Button variant="primary" size="sm" onClick={handleGenerateQuiz}>
                <Sparkles size={14} /> Generate New Quiz (10 Qs)
              </Button>
            </div>
          </div>
        ) : (
          /* ================= QUESTION VIEW DURING QUIZ ================= */
          <div
            className="glass-panel animate-fade-in"
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Header: Question Counter strictly Question X of 10 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  Question {currentIndex + 1} of {scopedQuestions.length}
                </span>
                {scopedQuestions[currentIndex].difficulty && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      textTransform: 'uppercase',
                      background:
                        scopedQuestions[currentIndex].difficulty === 'easy'
                          ? 'rgba(34, 197, 94, 0.15)'
                          : scopedQuestions[currentIndex].difficulty === 'hard'
                          ? 'rgba(234, 179, 8, 0.15)'
                          : 'rgba(59, 130, 246, 0.15)',
                      color:
                        scopedQuestions[currentIndex].difficulty === 'easy'
                          ? 'var(--color-success)'
                          : scopedQuestions[currentIndex].difficulty === 'hard'
                          ? 'var(--accent-warning)'
                          : 'var(--accent-primary)',
                    }}
                  >
                    {scopedQuestions[currentIndex].difficulty}
                  </span>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={() => setIsQuizActive(false)}>
                Exit Quiz
              </Button>
            </div>

            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.55 }}>
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
                      background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-tertiary)',
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
                        width: '28px',
                        height: '28px',
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
                    <span style={{ fontSize: '0.925rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
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
        /* ================= EMPTY OR READY STATE ================= */
        scopedQuestions.length === 0 ? (
          <div
            className="empty-state animate-fade-in"
            style={{
              padding: '48px 24px',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
            }}
          >
            <HelpCircle size={36} color="var(--text-muted)" style={{ marginBottom: '14px' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
              No quiz questions available
            </h3>
            <p
              style={{
                maxWidth: '480px',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                margin: '0 auto 20px',
                lineHeight: 1.55,
              }}
            >
              Select study materials above (PDFs, Web Articles, or YouTube links) and click &quot;Generate 10-Question Quiz&quot; to synthesize a verified 10-question quiz with local Ollama.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerateQuiz}
                disabled={!selectedSubject || availableMaterials.length === 0}
              >
                <Sparkles size={14} /> Generate 10-Question Quiz Now
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAddingQuiz(true)}
                disabled={!selectedSubject}
              >
                <Plus size={14} /> Add Custom Question
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="glass-panel animate-fade-in"
            style={{
              padding: '32px 24px',
              textAlign: 'center',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
              MCQ Quiz Ready: Exactly {scopedQuestions.length} Questions
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '22px' }}>
              Test your knowledge on key topics in{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {selectedSubject ? selectedSubject.name : 'this subject'}
              </strong>
              {selectedModule ? ` · ${selectedModule.title}` : ''}.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Button variant="primary" size="md" onClick={handleStartQuiz}>
                <Play size={16} /> Start MCQ Quiz ({scopedQuestions.length} Qs)
              </Button>
              <Button variant="secondary" size="md" onClick={handleGenerateQuiz}>
                <Sparkles size={15} /> Regenerate 10 Questions
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
};
