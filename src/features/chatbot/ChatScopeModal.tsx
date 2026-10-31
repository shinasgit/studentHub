import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Layers,
  Check,
  CheckSquare,
  Square,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';
import type { ChatStudyScope, ChatScopeMode } from '../../types/chat';
import { getModules } from '../../services/moduleService';

interface ChatScopeModalProps {
  isOpen: boolean;
  userId: string;
  subjects: Subject[];
  currentScope: ChatStudyScope;
  onClose: () => void;
  onApply: (newScope: ChatStudyScope) => void;
}

export const ChatScopeModal: React.FC<ChatScopeModalProps> = ({
  isOpen,
  userId,
  subjects,
  currentScope,
  onClose,
  onApply,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(currentScope.subjectId);
  const [scopeMode, setScopeMode] = useState<ChatScopeMode>(currentScope.scopeMode);
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [selectedModuleIds, setSelectedModuleIds] = useState<{ [id: string]: boolean }>({});

  // Sync state whenever modal opens or currentScope changes
  useEffect(() => {
    if (isOpen) {
      setSelectedSubjectId(currentScope.subjectId);
      setScopeMode(currentScope.scopeMode);

      // Pre-populate active module selections
      const initialMap: { [id: string]: boolean } = {};
      currentScope.moduleIds.forEach((id) => {
        initialMap[id] = true;
      });
      setSelectedModuleIds(initialMap);
    }
  }, [isOpen, currentScope]);

  // Load modules when selected subject changes
  useEffect(() => {
    if (!isOpen || !userId || !selectedSubjectId) return;

    let isMounted = true;
    const fetchModules = async () => {
      setLoadingModules(true);
      try {
        const fetched = await getModules(userId, selectedSubjectId);
        if (isMounted) {
          setModules(fetched);
          // If switching to a different subject than currentScope, reset module selection
          if (selectedSubjectId !== currentScope.subjectId) {
            setSelectedModuleIds({});
          }
        }
      } catch (err) {
        console.error('Failed to load modules for scope modal:', err);
      } finally {
        if (isMounted) {
          setLoadingModules(false);
        }
      }
    };

    fetchModules();
    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, selectedSubjectId, currentScope.subjectId]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];
  const selectedModuleCount = Object.values(selectedModuleIds).filter(Boolean).length;

  const handleToggleModule = (modId: string) => {
    setSelectedModuleIds((prev) => ({
      ...prev,
      [modId]: !prev[modId],
    }));
  };

  const handleSelectAll = () => {
    const all: { [id: string]: boolean } = {};
    modules.forEach((m) => {
      all[m.id] = true;
    });
    setSelectedModuleIds(all);
  };

  const handleClearAll = () => {
    setSelectedModuleIds({});
  };

  const handleSave = () => {
    if (!selectedSubject) return;

    const activeModuleIds =
      scopeMode === 'entire_subject'
        ? modules.map((m) => m.id)
        : modules.filter((m) => selectedModuleIds[m.id]).map((m) => m.id);

    const activeModuleNames =
      scopeMode === 'entire_subject'
        ? modules.map((m) => `Module ${m.order}: ${m.title}`)
        : modules.filter((m) => selectedModuleIds[m.id]).map((m) => `Module ${m.order}: ${m.title}`);

    let resourceCount = 0;
    const targetModules =
      scopeMode === 'entire_subject'
        ? modules
        : modules.filter((m) => selectedModuleIds[m.id]);

    targetModules.forEach((m) => {
      resourceCount += (m.attachments?.length || 0) + (m.links?.length || 0);
    });

    const newScope: ChatStudyScope = {
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

    onApply(newScope);
    onClose();
  };

  const canSave =
    scopeMode === 'entire_subject' || (scopeMode === 'specific_modules' && selectedModuleCount > 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent-primary-subtle)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SlidersHorizontal size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Study Scope Context
              </h3>
              <p style={{ fontSize: '0.74rem', margin: 0, color: 'var(--text-muted)' }}>
                Direct the AI assistant to focus on a subject or specific modules
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* 1. Subject Selection */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              1. Select Subject
            </label>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '8px',
              }}
            >
              {subjects.map((sub) => {
                const isSelected = sub.id === selectedSubjectId;
                const subColor = sub.color || '#4f64f1';

                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedSubjectId(sub.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--accent-primary-subtle)' : 'var(--bg-tertiary)',
                      border: isSelected
                        ? '1px solid var(--accent-primary)'
                        : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: subColor,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.86rem',
                          fontWeight: 600,
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sub.name}
                      </div>
                      {sub.code && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {sub.code}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Scope Mode Selection */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              2. Scope Mode
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {/* Entire Subject Option */}
              <button
                type="button"
                onClick={() => setScopeMode('entire_subject')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background:
                    scopeMode === 'entire_subject'
                      ? 'var(--accent-primary-subtle)'
                      : 'var(--bg-tertiary)',
                  border:
                    scopeMode === 'entire_subject'
                      ? '1px solid var(--accent-primary)'
                      : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <BookOpen
                  size={16}
                  color={scopeMode === 'entire_subject' ? 'var(--accent-primary)' : 'var(--text-muted)'}
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <div>
                  <div
                    style={{
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      color:
                        scopeMode === 'entire_subject'
                          ? 'var(--accent-primary)'
                          : 'var(--text-primary)',
                    }}
                  >
                    Entire Subject
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Covers all {modules.length} modules
                  </div>
                </div>
              </button>

              {/* Specific Modules Option */}
              <button
                type="button"
                onClick={() => setScopeMode('specific_modules')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background:
                    scopeMode === 'specific_modules'
                      ? 'var(--accent-primary-subtle)'
                      : 'var(--bg-tertiary)',
                  border:
                    scopeMode === 'specific_modules'
                      ? '1px solid var(--accent-primary)'
                      : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <Layers
                  size={16}
                  color={
                    scopeMode === 'specific_modules' ? 'var(--accent-primary)' : 'var(--text-muted)'
                  }
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <div>
                  <div
                    style={{
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      color:
                        scopeMode === 'specific_modules'
                          ? 'var(--accent-primary)'
                          : 'var(--text-primary)',
                    }}
                  >
                    Specific Modules
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Select targeted topics
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Specific Modules Checklist (if in specific_modules mode) */}
          {scopeMode === 'specific_modules' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <label
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    margin: 0,
                  }}
                >
                  3. Select Modules ({selectedModuleCount} selected)
                </label>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Select All
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>•</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {loadingModules ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                  }}
                >
                  <Loader2 size={16} className="spin" />
                  <span>Loading course modules...</span>
                </div>
              ) : modules.length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.82rem',
                  }}
                >
                  No modules found in this subject.
                </div>
              ) : (
                <div
                  style={{
                    maxHeight: '190px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-tertiary)',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {modules.map((m) => {
                    const isChecked = !!selectedModuleIds[m.id];
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleToggleModule(m.id)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-xs)',
                          background: isChecked ? 'var(--accent-primary-subtle)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '0.84rem',
                          color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)',
                          transition: 'background var(--transition-fast)',
                        }}
                      >
                        {isChecked ? (
                          <CheckSquare size={16} color="var(--accent-primary)" />
                        ) : (
                          <Square size={16} color="var(--text-muted)" />
                        )}
                        <span style={{ fontWeight: isChecked ? 600 : 400 }}>
                          Module {m.order}: {m.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            type="button"
            disabled={!canSave}
            onClick={handleSave}
          >
            Apply Scope
          </Button>
        </div>
      </div>
    </div>
  );
};
