import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
  AlertCircle,
  Loader2,
  FileText,
  Link as LinkIcon,
  Check,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';
import type { ChatStudyScope, ChatScopeMode } from '../../types/chat';
import { getModules } from '../../services/moduleService';

interface ChatScopeSelectorProps {
  userId: string;
  subjects: Subject[];
  initialSubjectId?: string;
  onStartSession: (scope: ChatStudyScope) => void;
  onNavigateToSubjects?: () => void;
}

export const ChatScopeSelector: React.FC<ChatScopeSelectorProps> = ({
  userId,
  subjects,
  initialSubjectId,
  onStartSession,
  onNavigateToSubjects,
}) => {
  // Selected Subject state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (initialSubjectId && subjects.some((s) => s.id === initialSubjectId)) {
      return initialSubjectId;
    }
    return subjects.length > 0 ? subjects[0].id : '';
  });

  // Mode state: 'entire_subject' vs 'specific_modules'
  const [scopeMode, setScopeMode] = useState<ChatScopeMode>('entire_subject');

  // Loaded modules for the selected subject
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);

  // Selected module IDs in 'specific_modules' mode
  const [selectedModuleIds, setSelectedModuleIds] = useState<{ [id: string]: boolean }>({});

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) || null;

  // Load modules whenever selected subject changes
  useEffect(() => {
    if (!userId || !selectedSubjectId) {
      setModules([]);
      setSelectedModuleIds({});
      return;
    }

    let isMounted = true;
    const fetchSubjectModules = async () => {
      setLoadingModules(true);
      setModulesError(null);
      setSelectedModuleIds({}); // Reset module selection on subject change
      try {
        const fetched = await getModules(userId, selectedSubjectId);
        if (isMounted) {
          setModules(fetched);
          // By default, if user switches to specific modules, don't preselect everything until they choose
        }
      } catch (err: unknown) {
        if (isMounted) {
          const error = err as { message?: string };
          setModulesError(error.message || 'Failed to load modules for the selected subject.');
        }
      } finally {
        if (isMounted) {
          setLoadingModules(false);
        }
      }
    };

    fetchSubjectModules();
    return () => {
      isMounted = false;
    };
  }, [userId, selectedSubjectId]);

  // Module selection helpers
  const selectedModuleCount = Object.values(selectedModuleIds).filter(Boolean).length;
  const isAllModulesSelected = modules.length > 0 && selectedModuleCount === modules.length;

  const handleToggleModule = (modId: string) => {
    setSelectedModuleIds((prev) => ({
      ...prev,
      [modId]: !prev[modId],
    }));
  };

  const handleSelectAllModules = () => {
    const allSelected: { [id: string]: boolean } = {};
    modules.forEach((m) => {
      allSelected[m.id] = true;
    });
    setSelectedModuleIds(allSelected);
  };

  const handleClearModuleSelection = () => {
    setSelectedModuleIds({});
  };

  // Validation
  const canStartSession = (): boolean => {
    if (!selectedSubject) return false;
    if (scopeMode === 'entire_subject') return true;
    if (scopeMode === 'specific_modules') {
      return selectedModuleCount > 0;
    }
    return false;
  };

  const handleStart = () => {
    if (!selectedSubject) return;

    if (scopeMode === 'specific_modules' && selectedModuleCount === 0) {
      return;
    }

    const activeModuleIds =
      scopeMode === 'entire_subject'
        ? modules.map((m) => m.id)
        : modules.filter((m) => selectedModuleIds[m.id]).map((m) => m.id);

    const activeModuleNames =
      scopeMode === 'entire_subject'
        ? modules.map((m) => `Module ${m.order}: ${m.title}`)
        : modules.filter((m) => selectedModuleIds[m.id]).map((m) => `Module ${m.order}: ${m.title}`);

    // Compute total resources across selected scope
    let resourceCount = 0;
    const targetModules =
      scopeMode === 'entire_subject'
        ? modules
        : modules.filter((m) => selectedModuleIds[m.id]);

    targetModules.forEach((m) => {
      resourceCount += (m.attachments?.length || 0) + (m.links?.length || 0);
    });

    const scope: ChatStudyScope = {
      subjectId: selectedSubject.id,
      subjectName: selectedSubject.name,
      subjectCode: selectedSubject.code,
      subjectColor: selectedSubject.color || '#4f64f1',
      scopeMode,
      moduleIds: activeModuleIds,
      moduleNames: activeModuleNames,
      totalModuleCount: modules.length,
      resourceCount,
    };

    onStartSession(scope);
  };

  // If student has no subjects created yet
  if (subjects.length === 0) {
    return (
      <div
        style={{
          maxWidth: '720px',
          margin: '40px auto',
          padding: '48px 24px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(79, 100, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--accent-primary)',
          }}
        >
          <BookOpen size={28} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          No Subjects Found
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.5 }}>
          To start an AI-assisted study session, create at least one subject in your hub first.
        </p>
        {onNavigateToSubjects && (
          <Button variant="primary" onClick={onNavigateToSubjects}>
            Go to Subjects
          </Button>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner / Introduction */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-primary-subtle)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              AI Study Assistant
            </h1>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
              Configure your study scope by choosing a subject and target modules for this session.
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Subject Selection */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
            1. Select Subject
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Choose the course you are currently studying.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          {subjects.map((subj) => {
            const isSelected = subj.id === selectedSubjectId;
            const subjectColor = subj.color || '#4f64f1';
            return (
              <button
                key={subj.id}
                type="button"
                onClick={() => setSelectedSubjectId(subj.id)}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  border: isSelected ? `2px solid ${subjectColor}` : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  transition: 'border-color var(--transition-fast), background var(--transition-fast)',
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: subjectColor,
                    marginTop: '4px',
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: isSelected ? subjectColor : 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {subj.code || 'COURSE'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={subj.name}
                  >
                    {subj.name}
                  </div>
                </div>
                {isSelected && (
                  <div
                    style={{
                      color: subjectColor,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Check size={16} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Choose Study Scope (Mode A vs Mode B) */}
      {selectedSubject && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              2. Choose Study Scope
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Focus on the comprehensive course or zoom in on specific syllabus modules.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '14px',
              marginBottom: '20px',
            }}
          >
            {/* Mode A: Entire Subject */}
            <button
              type="button"
              onClick={() => setScopeMode('entire_subject')}
              style={{
                textAlign: 'left',
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                background: scopeMode === 'entire_subject' ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                border:
                  scopeMode === 'entire_subject'
                    ? '2px solid var(--accent-primary)'
                    : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={18} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Entire Subject
                  </span>
                </div>
                {scopeMode === 'entire_subject' && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'var(--accent-primary-subtle)',
                      color: 'var(--accent-primary)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Review across all {modules.length} modules in {selectedSubject.name}. Ideal for final exam prep and broad conceptual questions.
              </p>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {loadingModules ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Loader2 size={12} className="spin" /> Checking modules...
                  </span>
                ) : (
                  <span>Includes all {modules.length} module(s)</span>
                )}
              </div>
            </button>

            {/* Mode B: Specific Modules */}
            <button
              type="button"
              onClick={() => setScopeMode('specific_modules')}
              style={{
                textAlign: 'left',
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                background: scopeMode === 'specific_modules' ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                border:
                  scopeMode === 'specific_modules'
                    ? '2px solid var(--accent-primary)'
                    : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Specific Modules
                  </span>
                </div>
                {scopeMode === 'specific_modules' && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'var(--accent-primary-subtle)',
                      color: 'var(--accent-primary)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Select one or more focused modules to study. Best for topic-specific quizzes and targeted homework help.
              </p>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {loadingModules ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Loader2 size={12} className="spin" /> Loading module list...
                  </span>
                ) : (
                  <span>
                    {selectedModuleCount} of {modules.length} module(s) selected
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* If Mode A and no modules in subject */}
          {scopeMode === 'entire_subject' && !loadingModules && modules.length === 0 && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)',
                border: '1px dashed var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: 'var(--text-secondary)',
                fontSize: '0.84rem',
              }}
            >
              <Info size={18} color="var(--text-muted)" />
              <div>
                No modules created for <strong>{selectedSubject.name}</strong> yet. You can still initiate this study session for general subject questions.
              </div>
            </div>
          )}

          {/* Module Selection Interface for Mode B */}
          {scopeMode === 'specific_modules' && (
            <div
              style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              {loadingModules ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  <Loader2 size={20} className="spin" style={{ margin: '0 auto 8px' }} />
                  Loading subject modules...
                </div>
              ) : modulesError ? (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-danger-subtle)',
                    border: '1px solid var(--color-danger-border)',
                    color: 'var(--color-danger)',
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{modulesError}</span>
                </div>
              ) : modules.length === 0 ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    background: 'var(--bg-tertiary)',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: '0.84rem',
                  }}
                >
                  No modules found in {selectedSubject.name}. Add modules to this subject in the Subjects page to select them individually.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Toolbar: Select All / Clear Selection / Count */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      border: '1px solid var(--border-subtle)',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={isAllModulesSelected ? handleClearModuleSelection : handleSelectAllModules}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: 0,
                        }}
                      >
                        {isAllModulesSelected ? (
                          <CheckSquare size={16} color="var(--accent-primary)" />
                        ) : (
                          <Square size={16} color="var(--text-muted)" />
                        )}
                        <span>{isAllModulesSelected ? 'Deselect All' : 'Select All Modules'}</span>
                      </button>

                      {selectedModuleCount > 0 && (
                        <button
                          type="button"
                          onClick={handleClearModuleSelection}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                          }}
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>

                    <div style={{ color: selectedModuleCount > 0 ? 'var(--text-primary)' : 'var(--accent-rose)', fontWeight: 600 }}>
                      {selectedModuleCount} of {modules.length} selected
                      {selectedModuleCount === 0 && ' (at least 1 required)'}
                    </div>
                  </div>

                  {/* Modules Checkbox Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {modules.map((mod) => {
                      const isSelected = !!selectedModuleIds[mod.id];
                      const pdfCount = mod.attachments?.length || 0;
                      const linkCount = mod.links?.length || 0;

                      return (
                        <div
                          key={mod.id}
                          onClick={() => handleToggleModule(mod.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            padding: '12px 14px',
                            borderRadius: 'var(--radius-md)',
                            background: isSelected ? 'var(--accent-primary-subtle)' : 'var(--bg-secondary)',
                            border: isSelected
                              ? '1px solid var(--accent-primary-border)'
                              : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)',
                          }}
                        >
                          <div style={{ marginTop: '2px', color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                            {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  color: 'var(--text-muted)',
                                  background: 'var(--bg-tertiary)',
                                  padding: '2px 6px',
                                  borderRadius: 'var(--radius-xs)',
                                }}
                              >
                                Module #{mod.order}
                              </span>
                              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {mod.title}
                              </span>
                              {mod.completed && (
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: 'var(--accent-emerald)',
                                    background: 'var(--color-success-subtle)',
                                    padding: '1px 6px',
                                    borderRadius: 'var(--radius-xs)',
                                  }}
                                >
                                  Completed
                                </span>
                              )}
                            </div>

                            {mod.description && (
                              <p
                                style={{
                                  fontSize: '0.78rem',
                                  color: 'var(--text-secondary)',
                                  margin: '4px 0 0 0',
                                  lineHeight: 1.4,
                                }}
                              >
                                {mod.description}
                              </p>
                            )}

                            {(pdfCount > 0 || linkCount > 0) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                                {pdfCount > 0 && (
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      color: 'var(--text-muted)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                  >
                                    <FileText size={12} color="var(--accent-rose)" /> {pdfCount} PDF{pdfCount > 1 ? 's' : ''}
                                  </span>
                                )}
                                {linkCount > 0 && (
                                  <span
                                    style={{
                                      fontSize: '0.72rem',
                                      color: 'var(--text-muted)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                  >
                                    <LinkIcon size={12} color="var(--accent-cyan)" /> {linkCount} Link{linkCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Selection Summary & Start Session Button */}
      {selectedSubject && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              Study Session Summary
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Verify your active session configuration before entering the chatroom.
            </p>
          </div>

          <div
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Selected Subject:</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedSubject.name} {selectedSubject.code ? `(${selectedSubject.code})` : ''}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Study Scope:</span>
              <span
                style={{
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  background: 'var(--accent-primary-subtle)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                {scopeMode === 'entire_subject' ? 'Entire Subject' : 'Selected Modules'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
                {scopeMode === 'entire_subject' ? 'Included Modules:' : 'Selected Modules:'}
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textAlign: 'right',
                  lineHeight: 1.4,
                }}
              >
                {scopeMode === 'entire_subject'
                  ? `${modules.length} module(s) included`
                  : selectedModuleCount > 0
                  ? modules
                      .filter((m) => selectedModuleIds[m.id])
                      .map((m) => `Module ${m.order}`)
                      .join(', ')
                  : 'None selected'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
            {scopeMode === 'specific_modules' && selectedModuleCount === 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-rose)' }}>
                Select at least one module to begin
              </span>
            )}

            <Button
              variant="primary"
              size="md"
              disabled={!canStartSession()}
              onClick={handleStart}
            >
              <span>Start Study Session</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
