import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import {
  FileText,
  BookOpen,
  HelpCircle,
  CheckSquare,
  GraduationCap,
  AlertCircle,
  Plus,
  FolderArchive,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { getSubjects } from '../../services/subjectService';
import { getModules } from '../../services/moduleService';
import { getResources } from '../../services/resourceService';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';
import type { StudyResource } from '../../types/resource';
import type { StudyToolId, StudyMaterial, StudyToolSelectionPayload } from '../../types/studyTools';
import { ModuleSummaryView } from './ModuleSummaryView';
import { QuickNotesView } from './QuickNotesView';
import { PracticeQuestionsView } from './PracticeQuestionsView';
import { McqQuizView } from './McqQuizView';

interface StudyToolsPageProps {
  user: User;
  subjects: Subject[];
}

interface ToolTabOption {
  id: StudyToolId;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TOOL_TABS: ToolTabOption[] = [
  {
    id: 'summary',
    label: 'Module Summary',
    description: 'Review the main points',
    icon: <FileText size={17} />,
  },
  {
    id: 'notes',
    label: 'Quick Study Notes',
    description: 'Prepare concise revision notes',
    icon: <BookOpen size={17} />,
  },
  {
    id: 'practice',
    label: 'Practice Questions',
    description: 'Practise answering questions',
    icon: <HelpCircle size={17} />,
  },
  {
    id: 'quiz',
    label: 'MCQ Quiz',
    description: 'Test knowledge and review scores',
    icon: <CheckSquare size={17} />,
  },
];

export const StudyToolsPage: React.FC<StudyToolsPageProps> = ({ user, subjects }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active Tool from URL param or default to 'summary'
  const paramTool = searchParams.get('tool') as StudyToolId | null;
  const initialTool: StudyToolId =
    paramTool && ['summary', 'notes', 'practice', 'quiz'].includes(paramTool)
      ? paramTool
      : 'summary';

  const [activeTool, setActiveTool] = useState<StudyToolId>(initialTool);

  // Subjects state
  const [activeSubjects, setActiveSubjects] = useState<Subject[]>(subjects);
  const [loadingSubjects, setLoadingSubjects] = useState(subjects.length === 0);

  // Scope selection: Subject & Module
  const paramSubjectId = searchParams.get('subject') || 'all';
  const paramModuleId = searchParams.get('module') || 'all';

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(paramSubjectId);
  const [selectedModuleId, setSelectedModuleId] = useState<string>(paramModuleId);
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);

  // Resources state from Firestore
  const [resources, setResources] = useState<StudyResource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // Synchronize subjects from props or fetch if empty
  useEffect(() => {
    setActiveSubjects(subjects);
    if (subjects.length > 0) {
      setLoadingSubjects(false);
      // Auto-select first subject if none or 'all' selected
      if (selectedSubjectId === 'all' || !subjects.some((s) => s.id === selectedSubjectId)) {
        const firstId = subjects[0].id;
        setSelectedSubjectId(firstId);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('subject', firstId);
          return next;
        });
      }
    }
  }, [subjects, selectedSubjectId, setSearchParams]);

  useEffect(() => {
    if (activeSubjects.length === 0) {
      getSubjects(user.uid)
        .then((data) => {
          if (data && data.length > 0) {
            setActiveSubjects(data);
            if (selectedSubjectId === 'all' || !data.some((s) => s.id === selectedSubjectId)) {
              const firstId = data[0].id;
              setSelectedSubjectId(firstId);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('subject', firstId);
                return next;
              });
            }
          }
        })
        .catch(console.error)
        .finally(() => setLoadingSubjects(false));
    }
  }, [user.uid, activeSubjects.length, selectedSubjectId, setSearchParams]);

  // Keep state synced with URL changes
  useEffect(() => {
    if (paramTool && ['summary', 'notes', 'practice', 'quiz'].includes(paramTool)) {
      setActiveTool(paramTool as StudyToolId);
    }
  }, [paramTool]);

  // Switch tab and sync URL
  const handleSelectTool = (toolId: StudyToolId) => {
    setActiveTool(toolId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tool', toolId);
      return next;
    });
  };

  // Fetch modules when subject selection changes
  useEffect(() => {
    let isCancelled = false;
    const fetchSubjectModules = async () => {
      if (selectedSubjectId === 'all') {
        if (!isCancelled) {
          setModules([]);
          setSelectedModuleId('all');
        }
        return;
      }

      setLoadingModules(true);
      try {
        const fetched = await getModules(user.uid, selectedSubjectId);
        if (!isCancelled) {
          setModules(fetched);
          // If previous moduleId does not belong to new subject, reset to 'all'
          if (!fetched.some((m) => m.id === selectedModuleId)) {
            setSelectedModuleId('all');
          }
        }
      } catch (err) {
        console.error('Failed to load modules for study tools:', err);
      } finally {
        if (!isCancelled) setLoadingModules(false);
      }
    };

    fetchSubjectModules();
    return () => {
      isCancelled = true;
    };
  }, [user.uid, selectedSubjectId, selectedModuleId]);

  // Fetch resources from Firestore when subject selection changes
  useEffect(() => {
    let isCancelled = false;
    if (!selectedSubjectId || selectedSubjectId === 'all') {
      setResources([]);
      return;
    }

    setLoadingResources(true);
    getResources(user.uid, selectedSubjectId)
      .then((data) => {
        if (!isCancelled) setResources(data);
      })
      .catch((err) => {
        console.error('Failed to load resources for study tools:', err);
      })
      .finally(() => {
        if (!isCancelled) setLoadingResources(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [user.uid, selectedSubjectId]);

  // Handle subject change from dropdown
  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedModuleId('all');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (subjectId !== 'all') {
        next.set('subject', subjectId);
      } else {
        next.delete('subject');
      }
      next.delete('module');
      return next;
    });
  };

  // Handle module change from dropdown
  const handleModuleChange = (moduleId: string) => {
    setSelectedModuleId(moduleId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (moduleId !== 'all') {
        next.set('module', moduleId);
      } else {
        next.delete('module');
      }
      return next;
    });
  };

  const currentSubject = activeSubjects.find((s) => s.id === selectedSubjectId);
  const currentModule = modules.find((m) => m.id === selectedModuleId);

  // Derive all available study materials for current scope (modules + resources)
  const availableMaterials: StudyMaterial[] = useMemo(() => {
    if (!selectedSubjectId || selectedSubjectId === 'all') return [];

    const list: StudyMaterial[] = [];
    const seenIds = new Set<string>();

    const targetModules =
      selectedModuleId === 'all'
        ? modules
        : modules.filter((m) => m.id === selectedModuleId);

    // 1. Module-level attachments & links
    targetModules.forEach((mod) => {
      if (Array.isArray(mod.attachments)) {
        mod.attachments.forEach((att) => {
          if (!seenIds.has(att.id)) {
            seenIds.add(att.id);
            const isPdf = att.type?.includes('pdf') || att.name.toLowerCase().endsWith('.pdf');
            list.push({
              id: att.id,
              name: att.name,
              type: isPdf ? 'PDF' : 'Document',
              subjectId: selectedSubjectId,
              moduleId: mod.id,
              moduleName: mod.title,
              url: att.url,
              size: att.size,
            });
          }
        });
      }

      if (mod.fileName && mod.fileUrl && !seenIds.has(`legacy-${mod.id}`)) {
        seenIds.add(`legacy-${mod.id}`);
        list.push({
          id: `legacy-${mod.id}`,
          name: mod.fileName,
          type: 'PDF',
          subjectId: selectedSubjectId,
          moduleId: mod.id,
          moduleName: mod.title,
          url: mod.fileUrl,
          size: mod.fileSize || undefined,
        });
      }

      if (Array.isArray(mod.links)) {
        mod.links.forEach((link) => {
          if (!seenIds.has(link.id)) {
            seenIds.add(link.id);
            list.push({
              id: link.id,
              name: link.title,
              type: 'Web',
              subjectId: selectedSubjectId,
              moduleId: mod.id,
              moduleName: mod.title,
              url: link.url,
            });
          }
        });
      }
    });

    // 2. Resource documents stored in user's resources collection
    const targetResources =
      selectedModuleId === 'all'
        ? resources
        : resources.filter((r) => r.moduleId === selectedModuleId);

    targetResources.forEach((res) => {
      if (!seenIds.has(res.id)) {
        seenIds.add(res.id);
        const isPdf = res.type === 'pdf' || res.type === 'question-paper' || res.title.toLowerCase().endsWith('.pdf');
        const isWeb = res.type === 'video-link' || res.type === 'external-link';
        list.push({
          id: res.id,
          name: res.title,
          type: isPdf ? 'PDF' : isWeb ? 'Web' : 'Document',
          subjectId: res.subjectId,
          moduleId: res.moduleId,
          moduleName: modules.find((m) => m.id === res.moduleId)?.title,
          url: res.url,
          size: res.fileSize || undefined,
        });
      }
    });

    return list;
  }, [selectedSubjectId, selectedModuleId, modules, resources]);

  // Stage 2: Diagnostic payload logger matching verification requirements
  useEffect(() => {
    if (!selectedSubjectId || selectedSubjectId === 'all') return;

    const payload: StudyToolSelectionPayload = {
      subjectId: selectedSubjectId,
      subjectName: currentSubject?.name,
      moduleId: selectedModuleId,
      moduleName:
        selectedModuleId === 'all'
          ? 'Entire subject'
          : modules.find((m) => m.id === selectedModuleId)?.title || 'Module',
      tool: activeTool,
      resourceIds: availableMaterials.map((m) => m.id),
      resources: availableMaterials,
    };

    console.log('Study Tool Selection Payload:', payload);
  }, [selectedSubjectId, selectedModuleId, activeTool, availableMaterials, currentSubject?.name, modules]);

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px clamp(14px, 4vw, 24px) 64px',
        minHeight: 'calc(100vh - 120px)',
      }}
    >
      {/* Page Title & Description */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <GraduationCap size={16} />
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              Study Tools
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
            Study, revise, and practise using your subject and module materials.
          </p>
        </div>
      </div>

      {/* Scope Selector Bar (Subject + Module) */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px',
          border: '1px solid var(--border-medium)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', flex: '1 1 300px' }}>
          {/* Subject Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px', flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="input-field"
              style={{ padding: '8px 12px', height: '38px', fontSize: '0.85rem' }}
              title="Select subject"
            >
              {activeSubjects.length === 0 && <option value="all">No Subjects Available</option>}
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Module Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px', flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Module / Scope
            </label>
            <select
              value={selectedModuleId}
              onChange={(e) => handleModuleChange(e.target.value)}
              disabled={loadingModules || modules.length === 0}
              className="input-field"
              style={{
                padding: '8px 12px',
                height: '38px',
                fontSize: '0.85rem',
              }}
              title="Select module"
            >
              <option value="all">
                {modules.length === 0
                  ? 'Entire Subject (No modules created yet)'
                  : `Entire Subject (All ${modules.length} modules)`}
              </option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  Module #{m.order}: {m.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Scope Badge */}
        <div
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            background: 'var(--bg-tertiary)',
            padding: '8px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Scope: </span>
          {currentSubject ? (
            <span>
              {currentSubject.name} &bull;{' '}
              {currentModule ? `Module #${currentModule.order} (${currentModule.title})` : `Entire Subject (${modules.length} modules)`}
            </span>
          ) : (
            <span>No subject selected</span>
          )}
        </div>
      </div>

      {/* Connected Study Materials Panel (Stage 2) */}
      {selectedSubjectId !== 'all' && (
        <div
          className="glass-panel"
          style={{
            padding: '14px 18px',
            marginBottom: '20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: availableMaterials.length > 0 ? '10px' : '0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderArchive size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Available Study Materials
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: availableMaterials.length > 0 ? 'var(--accent-primary-subtle)' : 'var(--bg-tertiary)',
                  color: availableMaterials.length > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {availableMaterials.length} {availableMaterials.length === 1 ? 'material' : 'materials'}
              </span>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
              <span>{availableMaterials.filter((m) => m.type === 'PDF').length} PDFs</span>
              <span>&bull;</span>
              <span>{availableMaterials.filter((m) => m.type === 'Web').length} Web Links</span>
            </div>
          </div>

          {/* Loading state */}
          {(loadingModules || loadingResources) && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '4px 0' }}>
              Loading study materials for this selection...
            </div>
          )}

          {/* Empty state */}
          {!loadingModules && !loadingResources && availableMaterials.length === 0 && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '2px 0' }}>
              No study materials attached to this {selectedModuleId === 'all' ? 'subject' : 'module'}. You can upload PDFs or save links inside the course module.
            </div>
          )}

          {/* Materials badges list */}
          {!loadingModules && !loadingResources && availableMaterials.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
              {availableMaterials.map((mat) => (
                <a
                  key={mat.id}
                  href={mat.url || '#'}
                  target={mat.url ? '_blank' : undefined}
                  rel="noreferrer"
                  style={{
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    maxWidth: '320px',
                    transition: 'border-color var(--transition-fast)',
                  }}
                  title={mat.name}
                >
                  {mat.type === 'PDF' ? (
                    <FileText size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                  ) : mat.type === 'Web' ? (
                    <ExternalLink size={13} color="#06b6d4" style={{ flexShrink: 0 }} />
                  ) : (
                    <BookOpen size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mat.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: mat.type === 'PDF' ? '#ef4444' : '#06b6d4',
                      background: mat.type === 'PDF' ? '#ef444415' : '#06b6d415',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      flexShrink: 0,
                    }}
                  >
                    {mat.type}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty Subjects Prompt */}
      {!loadingSubjects && activeSubjects.length === 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '24px',
            marginBottom: '24px',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={20} color="var(--accent-warning)" />
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                No subjects found in your workspace
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Create a subject to begin organizing your summaries, revision notes, and quizzes.
              </div>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('/subjects')}>
            <Plus size={14} /> Go to Subjects
          </Button>
        </div>
      )}

      {/* Five Tool Tabs */}
      <div
        role="tablist"
        aria-label="Study tool options"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
          marginBottom: '24px',
        }}
      >
        {TOOL_TABS.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => handleSelectTool(tool.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'var(--bg-card)' : 'var(--bg-tertiary)',
                border: isActive
                  ? '1.5px solid var(--accent-primary)'
                  : '1px solid var(--border-subtle)',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                {tool.icon}
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {tool.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.4,
                }}
              >
                {tool.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Tool View */}
      <div style={{ minHeight: '360px' }}>
        {activeTool === 'summary' && (
          <ModuleSummaryView
            user={user}
            subjects={activeSubjects}
            modules={modules}
            selectedSubjectId={selectedSubjectId}
            selectedModuleId={selectedModuleId}
            materials={availableMaterials}
            loadingMaterials={loadingModules || loadingResources}
          />
        )}

        {activeTool === 'notes' && (
          <QuickNotesView
            user={user}
            subjects={activeSubjects}
            modules={modules}
            selectedSubjectId={selectedSubjectId}
            selectedModuleId={selectedModuleId}
            materials={availableMaterials}
            loadingMaterials={loadingModules || loadingResources}
          />
        )}

        {activeTool === 'practice' && (
          <PracticeQuestionsView
            user={user}
            subjects={activeSubjects}
            modules={modules}
            selectedSubjectId={selectedSubjectId}
            selectedModuleId={selectedModuleId}
            materials={availableMaterials}
            loadingMaterials={loadingModules || loadingResources}
          />
        )}

        {activeTool === 'quiz' && (
          <McqQuizView
            user={user}
            subjects={activeSubjects}
            modules={modules}
            selectedSubjectId={selectedSubjectId}
            selectedModuleId={selectedModuleId}
            materials={availableMaterials}
            loadingMaterials={loadingModules || loadingResources}
          />
        )}
      </div>
    </div>
  );
};
