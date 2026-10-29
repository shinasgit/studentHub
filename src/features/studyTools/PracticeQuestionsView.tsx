import React, { useState, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import {
  HelpCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  Eye,
  EyeOff,
  Plus,
  Award,
  Sparkles,
  Copy,
  Download,
  AlertCircle,
  FileText,
  FileCheck2,
  ScanText,
  XCircle,
  RefreshCw,
  Check,
  ListFilter,
  Sliders,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import {
  generatePracticeQuestions,
  type PracticeQuestionsProgress,
  type PracticeQuestionsResult,
} from '../../services/practiceQuestionsService';
import { getSelectedModel, checkOllamaConnection } from '../../services/ollamaService';
import type { PracticeQuestionItem, StudyMaterial } from '../../types/studyTools';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

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
  materials = [],
  loadingMaterials: _loadingMaterials = false,
}) => {
  // Practice questions stored in React state
  const [questions, setQuestions] = useState<PracticeQuestionItem[]>([]);
  const [lastResult, setLastResult] = useState<PracticeQuestionsResult | null>(null);

  // Available study materials in current scope (PDFs, Web Articles, YouTube)
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
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // AI Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressState, setProgressState] = useState<PracticeQuestionsProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Mode: 'browse' (list of all questions) vs 'practice' (card-by-card runner)
  const [viewMode, setViewMode] = useState<'browse' | 'practice'>('browse');

  // Interactive Practice Session State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCurrentAnswer, setShowCurrentAnswer] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Browse view: reveal toggle per question id
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  // Custom question modal/form
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newAnswerText, setNewAnswerText] = useState('');
  const [newExplanationText, setNewExplanationText] = useState('');
  const [newTopicText, setNewTopicText] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Filter questions for the selected scope
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

  // Generate Questions via Ollama
  const handleGenerateQuestions = async () => {
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
      message: 'Preparing study materials...',
      percent: 5,
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const activeModel = getSelectedModel() || 'llama3.2:3b';
      const result = await generatePracticeQuestions({
        materials: targetMaterials,
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        moduleId: selectedModule ? selectedModule.id : null,
        moduleName: selectedModule ? selectedModule.title : undefined,
        count: questionCount,
        difficulty,
        model: activeModel,
        abortSignal: abortController.signal,
        onProgress: (p) => setProgressState(p),
      });

      // Update question list (replace scoped questions with newly generated grounded questions)
      setQuestions((prev) => {
        const others = prev.filter((q) => {
          const matchSubject = selectedSubjectId === 'all' || q.subjectId === selectedSubjectId;
          const matchModule = selectedModuleId === 'all' || q.moduleId === selectedModuleId;
          return !(matchSubject && matchModule);
        });
        return [...result.questions, ...others];
      });

      setLastResult(result);
      setViewMode('browse');
      setRevealedIds({});
      triggerToast(`Generated ${result.questions.length} practice questions!`);
    } catch (err: unknown) {
      const errorObj = err as Error & { info?: { message: string; suggestion: string } };
      if (abortController.signal.aborted) {
        setErrorMsg('Question generation was cancelled.');
      } else {
        const fullMsg = errorObj.info?.suggestion
          ? `${errorObj.message} (${errorObj.info.suggestion})`
          : errorObj.message || 'Failed to generate practice questions.';
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
      setErrorMsg('Question generation was cancelled by student.');
    }
  };

  // Start Interactive Practice Session
  const handleStartPractice = () => {
    if (scopedQuestions.length === 0) return;
    setViewMode('practice');
    setCurrentIndex(0);
    setShowCurrentAnswer(false);
    setMasteredCount(0);
    setIsComplete(false);
  };

  const handleMarkConfidence = (mastered: boolean) => {
    if (mastered) {
      setMasteredCount((prev) => prev + 1);
    }
    if (currentIndex + 1 < scopedQuestions.length) {
      setCurrentIndex((prev) => prev + 1);
      setShowCurrentAnswer(false);
    } else {
      setIsComplete(true);
    }
  };

  // Toggle reveal state in browse mode
  const handleToggleReveal = (id: string) => {
    setRevealedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggleRevealAll = (reveal: boolean) => {
    const next: Record<string, boolean> = {};
    if (reveal) {
      scopedQuestions.forEach((q) => {
        next[q.id] = true;
      });
    }
    setRevealedIds(next);
  };

  // Copy questions and answers as formatted markdown
  const handleCopyQuestions = async () => {
    if (scopedQuestions.length === 0) return;

    const formatted = scopedQuestions
      .map((q, idx) => {
        const sourceMeta = q.sourceFile
          ? `\n> *Source: ${q.sourceFile}${q.pageRef ? ` (${q.pageRef})` : ''}*`
          : '';
        const topicMeta = q.topic ? ` [${q.topic}]` : '';
        const diffMeta = q.difficulty ? ` (${q.difficulty.toUpperCase()})` : '';

        return `### Question ${idx + 1}${diffMeta}${topicMeta}
**Q:** ${q.question}

**A:** ${q.answer}
${q.explanation ? `\n**Explanation:** ${q.explanation}` : ''}${sourceMeta}
`;
      })
      .join('\n---\n\n');

    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      triggerToast('Questions copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      triggerToast('Failed to copy to clipboard.');
    }
  };

  // Export questions to .md file
  const handleExportQuestions = () => {
    if (scopedQuestions.length === 0) return;

    const scopeTitle = selectedModule
      ? `${selectedSubject?.name || 'Subject'} - ${selectedModule.title}`
      : selectedSubject?.name || 'Subject';

    const header = `# Practice Questions: ${scopeTitle}\n*Generated via Ollama Llama 3.2 (3B)*\n*Total Questions: ${scopedQuestions.length}*\n\n`;

    const body = scopedQuestions
      .map((q, idx) => {
        const sourceMeta = q.sourceFile
          ? `\n> *Source: ${q.sourceFile}${q.pageRef ? ` (${q.pageRef})` : ''}*`
          : '';
        const diffMeta = q.difficulty ? ` [${q.difficulty.toUpperCase()}]` : '';

        return `## Question ${idx + 1}${diffMeta}\n${q.question}\n\n**Answer:**\n${q.answer}\n\n${
          q.explanation ? `**Explanation:**\n${q.explanation}\n` : ''
        }${sourceMeta}`;
      })
      .join('\n\n---\n\n');

    const blob = new Blob([header + body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeScope = (selectedModule?.title || selectedSubject?.name || 'practice')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `${safeScope}_PracticeQuestions.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast('Questions exported to file!');
  };

  // Add custom question manually
  const handleAddQuestion = () => {
    if (!newQuestionText.trim() || !newAnswerText.trim() || !selectedSubject) return;

    const item: PracticeQuestionItem = {
      id: `q-custom-${Date.now()}`,
      subjectId: selectedSubject.id,
      moduleId: selectedModule ? selectedModule.id : null,
      question: newQuestionText.trim(),
      answer: newAnswerText.trim(),
      explanation: newExplanationText.trim() || undefined,
      topic: newTopicText.trim() || undefined,
      difficulty: 'medium',
      sourceFile: 'Student Note',
    };

    setQuestions((prev) => [item, ...prev]);
    setNewQuestionText('');
    setNewAnswerText('');
    setNewExplanationText('');
    setNewTopicText('');
    setIsAddingQuestion(false);
    triggerToast('Custom question added!');
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
              Practice Questions
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
              Ollama AI Grounded
            </span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Conceptual and analytical practice for{' '}
            <strong style={{ color: 'var(--text-secondary)' }}>
              {selectedSubject ? selectedSubject.name : 'all subjects'}
            </strong>
            {selectedModule ? ` · Module: ${selectedModule.title}` : ''}
          </div>
        </div>

        {/* Global Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {scopedQuestions.length > 0 && viewMode === 'browse' && (
            <>
              <Button variant="primary" size="sm" onClick={handleStartPractice}>
                <Play size={14} /> Start Practice ({scopedQuestions.length})
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyQuestions}
                title="Copy all questions and answers"
              >
                {copied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportQuestions}
                title="Export as markdown text file"
              >
                <Download size={14} /> Export
              </Button>
            </>
          )}

          {viewMode === 'practice' && (
            <Button variant="secondary" size="sm" onClick={() => setViewMode('browse')}>
              <ListFilter size={14} /> View All Questions ({scopedQuestions.length})
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
              Question Generation Controls
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
                onClick={handleGenerateQuestions}
                disabled={!selectedSubject || availableMaterials.length === 0}
                title={
                  !selectedSubject
                    ? 'Select a subject'
                    : availableMaterials.length === 0
                    ? 'No study materials found for this module/subject'
                    : 'Generate practice questions with Ollama'
                }
              >
                <Sparkles size={14} /> Generate Questions ({questionCount})
              </Button>
            )}
          </div>
        </div>

        {/* Controls row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          {/* Material Scope */}
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
                  ? `All Materials in Scope (${availableMaterials.length} items: PDFs & Web)`
                  : 'No materials available'}
              </option>
              {availableMaterials.map((mat) => (
                <option key={mat.id} value={mat.id}>
                  {mat.type === 'PDF' || mat.name.toLowerCase().endsWith('.pdf')
                    ? '📄 '
                    : mat.url?.includes('youtu')
                    ? '📺 '
                    : '🌐 '}
                  {mat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Question Count */}
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
              Number of Questions
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[3, 5, 10].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setQuestionCount(cnt)}
                  disabled={isGenerating}
                  style={{
                    flex: 1,
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    border:
                      questionCount === cnt
                        ? '1.5px solid var(--accent-primary)'
                        : '1px solid var(--border-medium)',
                    background:
                      questionCount === cnt
                        ? 'rgba(59, 130, 246, 0.15)'
                        : 'var(--bg-tertiary)',
                    color:
                      questionCount === cnt
                        ? 'var(--accent-primary)'
                        : 'var(--text-secondary)',
                    fontWeight: questionCount === cnt ? 700 : 500,
                    fontSize: '0.8125rem',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cnt} Qs
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
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
              Difficulty
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
                <FileText size={11} color="var(--accent-primary)" />
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
                {progressState.stage === 'resolving_files' && 'Resolving PDF files'}
                {progressState.stage === 'extracting_pdf' && 'Extracting selectable text & OCR'}
                {progressState.stage === 'generating_questions' && 'Llama 3.2 Question Synthesis'}
                {progressState.stage === 'completed' && 'Ready'}
              </strong>
            </span>
            <span>Local Ollama Inference · No Cloud API</span>
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
            {errorMsg}
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

      {/* Last Result Metadata Banner */}
      {lastResult && scopedQuestions.length > 0 && !isGenerating && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <FileCheck2 size={15} color="var(--color-success)" />
            <span>
              Grounded on <strong style={{ color: 'var(--text-secondary)' }}>{lastResult.sources.length} document{lastResult.sources.length !== 1 ? 's' : ''}</strong>
              {lastResult.totalSourceCharacters > 0 && ` (${Math.round(lastResult.totalSourceCharacters / 1000)}k chars)`}
            </span>
            {lastResult.hasOcr && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'var(--accent-warning)',
                  fontSize: '0.75rem',
                }}
              >
                <ScanText size={13} /> Includes OCR scanned pages
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Model: <code style={{ color: 'var(--text-secondary)' }}>{lastResult.modelUsed}</code></span>
            <span>·</span>
            <span>Gen time: <strong style={{ color: 'var(--text-secondary)' }}>{((lastResult.durationMs || 0) / 1000).toFixed(1)}s</strong></span>
          </div>
        </div>
      )}

      {/* Add Custom Question Form */}
      {isAddingQuestion && (
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
            Add Custom Practice Question
          </h4>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Question Prompt *
            </label>
            <input
              type="text"
              placeholder="e.g., Explain the difference between Supervised and Unsupervised Learning."
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              className="input-field"
              style={{ fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Topic / Category (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Neural Networks, Architecture..."
                value={newTopicText}
                onChange={(e) => setNewTopicText(e.target.value)}
                className="input-field"
                style={{ fontSize: '0.875rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Core Solution / Answer *
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
              placeholder="Additional background or memory cue..."
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

      {/* Main View Area: Practice Mode vs Browse Mode */}
      {viewMode === 'practice' ? (
        /* ================= PRACTICE RUNNER MODE ================= */
        isComplete ? (
          /* Session Completed Screen */
          <div
            className="glass-panel animate-fade-in"
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
              You reviewed {scopedQuestions.length} question{scopedQuestions.length !== 1 ? 's' : ''} and marked{' '}
              <strong style={{ color: 'var(--color-success)' }}>{masteredCount}</strong> as mastered on this run.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <Button variant="secondary" size="sm" onClick={() => setViewMode('browse')}>
                <ListFilter size={14} /> Back to Question List
              </Button>
              <Button variant="primary" size="sm" onClick={handleStartPractice}>
                <RotateCcw size={14} /> Practice Again
              </Button>
            </div>
          </div>
        ) : (
          /* Question Card in Progress */
          <div
            className="glass-panel animate-fade-in"
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Runner top bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
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
                {scopedQuestions[currentIndex].topic && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {scopedQuestions[currentIndex].topic}
                  </span>
                )}
              </div>

              <Button variant="secondary" size="sm" onClick={() => setViewMode('browse')}>
                Exit Practice
              </Button>
            </div>

            {/* Question Text */}
            <div
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.55,
                padding: '8px 0',
              }}
            >
              {scopedQuestions[currentIndex].question}
            </div>

            {/* Answer / Explanation Reveal Box */}
            {!showCurrentAnswer ? (
              <div style={{ paddingTop: '10px' }}>
                <Button variant="secondary" size="md" onClick={() => setShowCurrentAnswer(true)}>
                  <Eye size={15} /> Reveal Answer &amp; Explanation
                </Button>
              </div>
            ) : (
              <div
                className="animate-fade-in"
                style={{
                  padding: '18px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Expected Answer:
                  </div>
                  <div
                    style={{
                      fontSize: '0.95rem',
                      color: 'var(--text-primary)',
                      marginTop: '4px',
                      lineHeight: 1.6,
                    }}
                  >
                    {scopedQuestions[currentIndex].answer}
                  </div>
                </div>

                {scopedQuestions[currentIndex].explanation && (
                  <div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Explanation &amp; Grounding:
                    </div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        marginTop: '4px',
                        lineHeight: 1.55,
                      }}
                    >
                      {scopedQuestions[currentIndex].explanation}
                    </div>
                  </div>
                )}

                {/* Source attribution if available */}
                {scopedQuestions[currentIndex].sourceFile && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <FileText size={12} color="var(--accent-primary)" />
                    Source: {scopedQuestions[currentIndex].sourceFile}
                    {scopedQuestions[currentIndex].pageRef && ` · ${scopedQuestions[currentIndex].pageRef}`}
                  </div>
                )}

                {/* Action assessment */}
                <div style={{ display: 'flex', gap: '10px', paddingTop: '10px' }}>
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
        /* ================= BROWSE / LIST MODE ================= */
        scopedQuestions.length === 0 ? (
          /* Empty State */
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
              No practice questions in this scope
            </h3>
            <p
              style={{
                maxWidth: '460px',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                margin: '0 auto 20px',
                lineHeight: 1.55,
              }}
            >
              Select study materials above and click &quot;Generate Questions&quot; to synthesize conceptual self-test questions grounded in your course materials using local Ollama.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerateQuestions}
                disabled={!selectedSubject || availableMaterials.length === 0}
              >
                <Sparkles size={14} /> Generate Questions Now
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAddingQuestion(true)}
                disabled={!selectedSubject}
              >
                <Plus size={14} /> Add Custom Question
              </Button>
            </div>
          </div>
        ) : (
          /* Questions List */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* List Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '4px 2px',
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {scopedQuestions.length} Practice Question{scopedQuestions.length !== 1 ? 's' : ''} Ready
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="secondary" size="sm" onClick={() => handleToggleRevealAll(true)}>
                  <Eye size={13} /> Reveal All
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleToggleRevealAll(false)}>
                  <EyeOff size={13} /> Hide All
                </Button>
              </div>
            </div>

            {/* Questions cards */}
            {scopedQuestions.map((q, idx) => {
              const isRevealed = !!revealedIds[q.id];

              return (
                <div
                  key={q.id}
                  className="glass-panel"
                  style={{
                    padding: '18px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Card top */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-muted)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        #{idx + 1}
                      </span>

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

                      {q.topic && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 600,
                          }}
                        >
                          {q.topic}
                        </span>
                      )}
                    </div>

                    {q.sourceFile && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <FileText size={12} color="var(--accent-primary)" />
                        {q.sourceFile}
                        {q.pageRef && ` (${q.pageRef})`}
                      </span>
                    )}
                  </div>

                  {/* Question */}
                  <div
                    style={{
                      fontSize: '0.975rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      lineHeight: 1.5,
                    }}
                  >
                    {q.question}
                  </div>

                  {/* Toggle Button */}
                  <div>
                    <button
                      type="button"
                      onClick={() => handleToggleReveal(q.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '4px 0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                      {isRevealed ? 'Hide Answer & Explanation' : 'Show Answer & Explanation'}
                    </button>
                  </div>

                  {/* Answer and Explanation Box */}
                  {isRevealed && (
                    <div
                      className="animate-fade-in"
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
                      <div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          Answer:
                        </div>
                        <div
                          style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-primary)',
                            marginTop: '2px',
                            lineHeight: 1.55,
                          }}
                        >
                          {q.answer}
                        </div>
                      </div>

                      {q.explanation && (
                        <div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: 'var(--text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            Explanation:
                          </div>
                          <div
                            style={{
                              fontSize: '0.85rem',
                              color: 'var(--text-secondary)',
                              marginTop: '2px',
                              lineHeight: 1.5,
                            }}
                          >
                            {q.explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};
