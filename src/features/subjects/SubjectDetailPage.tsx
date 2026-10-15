import React, { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Layers,
  FileText,
  Plus,
  BookOpen,
  Calendar,
  Hash,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ModuleList } from '../modules/ModuleList';
import { ModuleModal } from '../modules/ModuleModal';
import { ResourceCard } from '../resources/ResourceCard';
import { ResourceModal } from '../resources/ResourceModal';
import { PDFReaderModal } from '../reader/PDFReaderModal';
import { TopicResearchModal } from '../research/TopicResearchModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { getFileObjectUrl } from '../../services/fileStorageService';
import {
  getModules,
  createModule,
  updateModule,
  deleteModule,
  toggleModuleCompletion,
} from '../../services/moduleService';
import {
  getResources,
  createResource,
  updateResource,
  deleteResource,
} from '../../services/resourceService';
import type { Subject } from '../../types/subject';
import type { Module, ModuleInput } from '../../types/module';
import type { StudyResource, ResourceInput } from '../../types/resource';

interface SubjectDetailPageProps {
  user: User;
  subject: Subject;
  subjects: Subject[];
  onBack: () => void;
}

export const SubjectDetailPage: React.FC<SubjectDetailPageProps> = ({
  user,
  subject,
  subjects,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'modules' | 'resources'>('modules');
  const [modules, setModules] = useState<Module[]>([]);
  const [resources, setResources] = useState<StudyResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Module modal states
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [moduleModalMode, setModuleModalMode] = useState<'create' | 'edit'>('create');
  const [editingModule, setEditingModule] = useState<Module | null>(null);

  // Resource modal states
  const [isResModalOpen, setIsResModalOpen] = useState(false);
  const [resModalMode, setResModalMode] = useState<'create' | 'edit'>('create');
  const [editingResource, setEditingResource] = useState<StudyResource | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'module' | 'resource'; id: string; name: string } | null>(null);

  // PDF Reader state
  const [activePdfResource, setActivePdfResource] = useState<StudyResource | null>(null);

  // Topic Research modal state
  const [isResearchModalOpen, setIsResearchModalOpen] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);


  useEffect(() => {
    let isCancelled = false;
    const fetchInitial = async () => {
      try {
        const [fetchedModules, fetchedResources] = await Promise.all([
          getModules(user.uid, subject.id),
          getResources(user.uid, subject.id),
        ]);
        if (!isCancelled) {
          setModules(fetchedModules);
          setResources(fetchedResources);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const error = err as { message?: string };
          setErrorMsg(error.message || 'Failed to load subject data.');
          setLoading(false);
        }
      }
    };
    fetchInitial();
    return () => {
      isCancelled = true;
    };
  }, [user.uid, subject.id]);

  // Calculate completion progress
  const progressPercent = useMemo(() => {
    if (modules.length === 0) return 0;
    const completedCount = modules.filter((m) => m.completed).length;
    return Math.round((completedCount / modules.length) * 100);
  }, [modules]);

  // --- Module Actions ---
  const handleOpenAddModule = () => {
    setModuleModalMode('create');
    setEditingModule(null);
    setIsModuleModalOpen(true);
  };

  const handleOpenEditModule = (mod: Module) => {
    setModuleModalMode('edit');
    setEditingModule(mod);
    setIsModuleModalOpen(true);
  };

  const handleModuleSubmit = async (input: ModuleInput) => {
    if (moduleModalMode === 'create') {
      const newMod = await createModule(user.uid, subject.id, input);
      setModules((prev) => [...prev, newMod]);
      setToastMsg(`Module "${newMod.title}" added!`);
    } else if (editingModule) {
      await updateModule(user.uid, subject.id, editingModule.id, input);
      setModules((prev) =>
        prev.map((m) => (m.id === editingModule.id ? { ...m, ...input } : m))
      );
      setToastMsg(`Module updated!`);
    }
  };

  const handleToggleComplete = async (mod: Module) => {
    const nextStatus = await toggleModuleCompletion(user.uid, subject.id, mod.id, mod.completed);
    setModules((prev) =>
      prev.map((m) => (m.id === mod.id ? { ...m, completed: nextStatus } : m))
    );
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const newModules = [...modules];
    const current = newModules[index];
    const prev = newModules[index - 1];

    const currentOrder = current.order;
    current.order = prev.order;
    prev.order = currentOrder;

    newModules[index] = prev;
    newModules[index - 1] = current;

    setModules(newModules);

    // Save orders in Firestore
    await Promise.all([
      updateModule(user.uid, subject.id, current.id, { order: current.order }),
      updateModule(user.uid, subject.id, prev.id, { order: prev.order }),
    ]);
  };

  const handleMoveDown = async (index: number) => {
    if (index >= modules.length - 1) return;
    const newModules = [...modules];
    const current = newModules[index];
    const next = newModules[index + 1];

    const currentOrder = current.order;
    current.order = next.order;
    next.order = currentOrder;

    newModules[index] = next;
    newModules[index + 1] = current;

    setModules(newModules);

    // Save orders in Firestore
    await Promise.all([
      updateModule(user.uid, subject.id, current.id, { order: current.order }),
      updateModule(user.uid, subject.id, next.id, { order: next.order }),
    ]);
  };

  const handleOpenModuleFile = async (mod: Module) => {
    let urlToOpen = mod.fileUrl;

    // If storage key exists in vault, retrieve fresh object URL
    if (mod.fileStorageKey) {
      const vaultUrl = await getFileObjectUrl(mod.fileStorageKey);
      if (vaultUrl) {
        urlToOpen = vaultUrl;
      }
    }

    if (!urlToOpen) {
      setToastMsg(`Could not open file for "${mod.title}". Please try re-attaching.`);
      return;
    }

    const isPdf =
      mod.fileName?.toLowerCase().endsWith('.pdf') ||
      mod.fileType?.includes('pdf') ||
      urlToOpen.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      setActivePdfResource({
        id: `mod-${mod.id}`,
        userId: user.uid,
        subjectId: subject.id,
        moduleId: mod.id,
        title: mod.fileName || `${mod.title} Notes`,
        type: 'pdf',
        url: urlToOpen,
        createdAt: mod.createdAt,
        updatedAt: mod.updatedAt,
      });
    } else {
      window.open(urlToOpen, '_blank', 'noopener,noreferrer');
    }
  };

  // --- Resource Actions ---
  const handleOpenAddResource = () => {
    setResModalMode('create');
    setEditingResource(null);
    setIsResModalOpen(true);
  };

  const handleOpenEditResource = (res: StudyResource) => {
    setResModalMode('edit');
    setEditingResource(res);
    setIsResModalOpen(true);
  };

  const handleResourceSubmit = async (input: ResourceInput) => {
    if (resModalMode === 'create') {
      const newRes = await createResource(user.uid, input);
      setResources((prev) => [newRes, ...prev]);
      setToastMsg(`Resource "${newRes.title}" added!`);
    } else if (editingResource) {
      await updateResource(user.uid, editingResource.id, input);
      setResources((prev) =>
        prev.map((r) => (r.id === editingResource.id ? { ...r, ...input } : r))
      );
      setToastMsg('Resource updated!');
    }
  };

  const handleOpenResource = (res: StudyResource) => {
    if (res.type === 'pdf' || res.url.endsWith('.pdf')) {
      setActivePdfResource(res);
    } else {
      window.open(res.url, '_blank', 'noopener,noreferrer');
    }
  };

  // --- Delete Handling ---
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'module') {
      await deleteModule(user.uid, subject.id, deleteTarget.id);
      setModules((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setToastMsg('Module deleted.');
    } else {
      await deleteResource(user.uid, deleteTarget.id);
      setResources((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setToastMsg('Resource deleted.');
    }
    setDeleteTarget(null);
  };

  const accentColor = subject.color || '#6366f1';

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px 80px' }}>
      {/* Toast Feedback */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 90,
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--accent-emerald)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            animation: 'fadeInSlideUp 0.3s ease-out forwards',
          }}
        >
          <CheckCircle2 size={18} color="var(--accent-emerald)" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Back Button */}
      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.9rem',
          fontWeight: 600,
          marginBottom: '20px',
          padding: '6px 0',
          transition: 'color var(--transition-fast)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        <ArrowLeft size={16} />
        <span>Back to Dashboard</span>
      </button>

      {/* Subject Header Card */}
      <div
        className="glass-panel animate-fade-in"
        style={{
          padding: '32px',
          marginBottom: '32px',
          position: 'relative',
          overflow: 'hidden',
          borderTop: `4px solid ${accentColor}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background: `${accentColor}20`,
                  color: accentColor,
                  border: `1px solid ${accentColor}40`,
                }}
              >
                <Hash size={13} />
                {subject.code}
              </span>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: 'var(--social-btn-bg)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Calendar size={13} />
                {subject.semester}
              </span>
            </div>

            <h1 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 800, marginBottom: '8px' }}>
              {subject.name}
            </h1>

            {subject.description && (
              <p style={{ maxWidth: '640px', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5 }}>
                {subject.description}
              </p>
            )}
          </div>

          {/* Progress Tracker Card */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--social-btn-bg)',
              border: '1px solid var(--border-subtle)',
              minWidth: '220px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Syllabus Progress
              </span>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: accentColor }}>
                {progressPercent}%
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                background: 'var(--border-subtle)',
                overflow: 'hidden',
                margin: '8px 0',
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${accentColor}, #10b981)`,
                  transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {modules.filter((m) => m.completed).length} of {modules.length} modules completed
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('modules')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              background: activeTab === 'modules' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'modules' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: activeTab === 'modules' ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Layers size={16} />
            <span>Modules & Chapters ({modules.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('resources')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              background: activeTab === 'resources' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'resources' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: activeTab === 'resources' ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <FileText size={16} />
            <span>Study Resources ({resources.length})</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="auth-alert auth-alert-error" style={{ marginBottom: '24px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === 'modules' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Course Breakdown</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Track chapter completion and order units to align with your syllabus
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsResearchModalOpen(true)}
                title="Research topics using free open educational sources"
              >
                <Sparkles size={15} color="var(--accent-emerald)" />
                <span>Research Topic</span>
              </Button>

              <Button variant="primary" size="sm" onClick={handleOpenAddModule}>
                <Plus size={16} />
                <span>Add Module</span>
              </Button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="skeleton-card" style={{ height: '70px' }} />
              <div className="skeleton-card" style={{ height: '70px' }} />
              <div className="skeleton-card" style={{ height: '70px' }} />
            </div>
          ) : (
            <ModuleList
              modules={modules}
              onToggleComplete={handleToggleComplete}
              onEdit={handleOpenEditModule}
              onDelete={(mod) => setDeleteTarget({ type: 'module', id: mod.id, name: mod.title })}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onAddModule={handleOpenAddModule}
              onOpenFile={handleOpenModuleFile}
            />
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Subject Materials</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                PDF slides, question papers, and lecture resources for this course
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsResearchModalOpen(true)}
                title="Research topics using free open educational sources"
              >
                <Sparkles size={15} color="var(--accent-emerald)" />
                <span>Research Topic</span>
              </Button>

              <Button variant="primary" size="sm" onClick={handleOpenAddResource}>
                <Plus size={16} />
                <span>Add Resource</span>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="subject-grid">
              <div className="skeleton-card" />
              <div className="skeleton-card" />
            </div>
          ) : resources.length === 0 ? (
            <div className="empty-state animate-fade-in" style={{ padding: '48px 24px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(244, 63, 94, 0.15))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  color: 'var(--accent-rose)',
                }}
              >
                <BookOpen size={28} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
                No resources added yet
              </h3>
              <p style={{ maxWidth: '400px', color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
                Add lecture slides, previous year question papers, or PDF notes to this subject.
              </p>
              <Button variant="primary" size="md" onClick={handleOpenAddResource}>
                <Plus size={16} /> Add First Resource
              </Button>
            </div>
          ) : (
            <div className="subject-grid">
              {resources.map((res) => {
                const assignedModule = modules.find((m) => m.id === res.moduleId);
                return (
                  <ResourceCard
                    key={res.id}
                    resource={res}
                    subject={subject}
                    module={assignedModule}
                    onOpen={handleOpenResource}
                    onEdit={handleOpenEditResource}
                    onDelete={(r) => setDeleteTarget({ type: 'resource', id: r.id, name: r.title })}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Module Modal */}
      <ModuleModal
        isOpen={isModuleModalOpen}
        mode={moduleModalMode}
        initialData={editingModule}
        defaultOrder={modules.length + 1}
        onClose={() => setIsModuleModalOpen(false)}
        onSubmit={handleModuleSubmit}
      />

      {/* Resource Modal */}
      <ResourceModal
        isOpen={isResModalOpen}
        mode={resModalMode}
        initialData={editingResource}
        subjects={subjects}
        modules={modules}
        defaultSubjectId={subject.id}
        onClose={() => setIsResModalOpen(false)}
        onSubmit={handleResourceSubmit}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        subject={deleteTarget ? { id: deleteTarget.id, name: deleteTarget.name, code: deleteTarget.type.toUpperCase(), semester: '', createdAt: '', updatedAt: '', userId: user.uid } : null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Topic Research Modal */}
      <TopicResearchModal
        isOpen={isResearchModalOpen}
        subject={subject}
        modules={modules}
        onClose={() => setIsResearchModalOpen(false)}
        onSaveResource={async (resInput) => {
          await handleResourceSubmit(resInput);
          setToastMsg(`Saved "${resInput.title}" to resources!`);
        }}
      />

      {/* Built-in PDF Reader */}
      <PDFReaderModal
        isOpen={Boolean(activePdfResource)}
        resource={activePdfResource}
        onClose={() => setActivePdfResource(null)}
      />
    </div>
  );
};
