import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Layers,
  FileText,
  Plus,
  Calendar,
  Hash,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  GraduationCap,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ModuleList } from '../modules/ModuleList';
import { ModuleModal } from '../modules/ModuleModal';
import { ModuleMaterialsModal } from '../modules/ModuleMaterialsModal';
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
  addModuleLink,
} from '../../services/moduleService';
import {
  getResources,
  createResource,
  deleteResource,
} from '../../services/resourceService';
import type { Subject } from '../../types/subject';
import type { Module, ModuleInput, ModuleAttachment } from '../../types/module';
import type { StudyResource, ResourceInput } from '../../types/resource';

interface SubjectDetailPageProps {
  user: User;
  subject: Subject;
  subjects?: Subject[];
  onBack: () => void;
}

export const SubjectDetailPage: React.FC<SubjectDetailPageProps> = ({
  user,
  subject,
  onBack,
}) => {
  const navigate = useNavigate();
  const [modules, setModules] = useState<Module[]>([]);
  const [resources, setResources] = useState<StudyResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Module modal states
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [moduleModalMode, setModuleModalMode] = useState<'create' | 'edit'>('create');
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [activeMaterialsModule, setActiveMaterialsModule] = useState<Module | null>(null);

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

  const handleOpenAttachmentPdf = async (att: ModuleAttachment, mod: Module) => {
    let urlToUse = att.url;
    if (att.storageKey) {
      const freshUrl = await getFileObjectUrl(att.storageKey);
      if (freshUrl) urlToUse = freshUrl;
    }

    setActivePdfResource({
      id: att.id,
      userId: user.uid,
      subjectId: subject.id,
      moduleId: mod.id,
      title: att.name,
      type: 'pdf',
      url: urlToUse,
      createdAt: att.uploadedAt,
      updatedAt: att.uploadedAt,
      fileStorageKey: att.storageKey,
      fileSize: att.size,
    });
  };

  // --- Resource Actions ---
  const handleResourceSubmit = async (input: ResourceInput) => {
    const newRes = await createResource(user.uid, input);
    setResources((prev) => [newRes, ...prev]);
    setToastMsg(`Resource "${newRes.title}" added!`);
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
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px clamp(14px, 4vw, 24px) 64px' }}>
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
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <CheckCircle2 size={18} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />
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

      {/* Subject Header Card (Minimized & Compact) */}
      <div
        className="glass-panel animate-fade-in"
        style={{
          padding: '12px 16px',
          marginBottom: '20px',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* Top row: tags, title, and quick action buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          {/* Left: Tags + Subject Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0, flex: '1 1 auto' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 7px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: `${accentColor}18`,
                color: accentColor,
                border: `1px solid ${accentColor}35`,
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}
            >
              <Hash size={11} />
              {subject.code}
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 7px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.72rem',
                fontWeight: 600,
                background: 'var(--social-btn-bg)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                flexShrink: 0,
              }}
            >
              <Calendar size={11} />
              {subject.semester}
            </span>

            <h1
              style={{
                fontSize: 'clamp(1.05rem, 2.5vw, 1.25rem)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                lineHeight: 1.3,
                wordBreak: 'break-word',
              }}
            >
              {subject.name}
            </h1>
          </div>

          {/* Right: Quick Study Tools and Chatbot Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => navigate(`/study-tools?subject=${subject.id}`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                fontSize: '0.78rem',
              }}
            >
              <GraduationCap size={13} color="var(--accent-primary)" />
              <span>Study Tools</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => navigate(`/chatbot?subjectId=${subject.id}`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                fontSize: '0.78rem',
              }}
            >
              <MessageSquare size={13} color="var(--accent-primary)" />
              <span>Study with Chatbot</span>
            </Button>
          </div>
        </div>

        {/* Bottom row: Compact stats badges & slim progress bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '0.76rem',
            color: 'var(--text-secondary)',
            paddingTop: '6px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {/* Metadata counts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={12} color="var(--accent-primary)" />
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{modules.length}</strong> {modules.length === 1 ? 'module' : 'modules'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={12} color="#ef4444" />
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {modules.reduce((sum, m) => sum + (m.attachments?.length || (m.fileName ? 1 : 0)), 0)}
              </strong> attached PDFs
            </span>
            {subject.description && (
              <span
                style={{
                  color: 'var(--text-muted)',
                  maxWidth: '340px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={subject.description}
              >
                • {subject.description}
              </span>
            )}
          </div>

          {/* Inline compact progress */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Progress:</span>
            <div
              style={{
                width: '72px',
                height: '5px',
                borderRadius: '3px',
                background: 'var(--border-subtle)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: accentColor,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={{ fontWeight: 700, color: accentColor, minWidth: '26px' }}>{progressPercent}%</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              ({modules.filter((m) => m.completed).length}/{modules.length})
            </span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="auth-alert auth-alert-error" style={{ marginBottom: '24px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Course Modules & Breakdown */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Course Modules & Syllabus</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Manage chapters, upload multiple lecture PDFs, and save external web resources directly inside each module.
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
            resources={resources}
            onToggleComplete={handleToggleComplete}
            onEdit={handleOpenEditModule}
            onDelete={(mod) => setDeleteTarget({ type: 'module', id: mod.id, name: mod.title })}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onAddModule={handleOpenAddModule}
            onOpenMaterials={(mod) => setActiveMaterialsModule(mod)}
            onOpenFile={handleOpenModuleFile}
            onOpenPdf={handleOpenAttachmentPdf}
          />
        )}
      </div>

      {/* Module Modal */}
      <ModuleModal
        isOpen={isModuleModalOpen}
        mode={moduleModalMode}
        initialData={editingModule}
        defaultOrder={modules.length + 1}
        onClose={() => setIsModuleModalOpen(false)}
        onSubmit={handleModuleSubmit}
      />

      {/* Module Learning Materials & Multiple PDF Uploads Modal */}
      <ModuleMaterialsModal
        isOpen={Boolean(activeMaterialsModule)}
        module={activeMaterialsModule}
        subject={subject}
        userId={user.uid}
        moduleResources={resources.filter((r) => r.moduleId === activeMaterialsModule?.id)}
        availableModules={modules}
        onClose={() => setActiveMaterialsModule(null)}
        onModuleUpdated={(updated) => {
          setActiveMaterialsModule(updated);
          setModules((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }}
        onOpenPdf={(res) => setActivePdfResource(res)}
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
          if (resInput.moduleId) {
            try {
              const updatedLinks = await addModuleLink(user.uid, subject.id, resInput.moduleId, {
                title: resInput.title,
                url: resInput.url,
                description: resInput.description,
              });
              setModules((prev) =>
                prev.map((m) => (m.id === resInput.moduleId ? { ...m, links: updatedLinks } : m))
              );
            } catch (err) {
              console.warn(err);
            }
          }
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
