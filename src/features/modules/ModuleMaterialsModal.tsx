import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  FileText,
  Upload,
  Trash2,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  Circle,
  Paperclip,
  AlertCircle,
  Loader2,
  Plus,
  Link as LinkIcon,
  Globe,
  Search,
  CheckSquare,
  Square,
  Check,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { Module, ModuleAttachment } from '../../types/module';
import type { Subject } from '../../types/subject';
import type { StudyResource } from '../../types/resource';
import { searchEducationalTopic, type ResearchResult, decodeHtmlEntities } from '../../services/researchService';
import {
  validateFile,
  saveFileToVault,
  deleteFileFromVault,
  getFileObjectUrl,
  formatBytes,
} from '../../services/fileStorageService';
import {
  addModuleAttachment,
  deleteModuleAttachment,
  addModuleLink,
  deleteModuleLink,
  toggleModuleCompletion,
} from '../../services/moduleService';
import { createResource, deleteResource } from '../../services/resourceService';

interface ModuleMaterialsModalProps {
  isOpen: boolean;
  module: Module | null;
  subject: Subject;
  userId: string;
  moduleResources?: StudyResource[];
  availableModules?: Module[];
  onClose: () => void;
  onModuleUpdated: (updatedModule: Module) => void;
  onOpenPdf: (resource: StudyResource) => void;
}

export const ModuleMaterialsModal: React.FC<ModuleMaterialsModalProps> = ({
  isOpen,
  module,
  subject,
  userId,
  moduleResources = [],
  availableModules = [],
  onClose,
  onModuleUpdated,
  onOpenPdf,
}) => {
  const [uploadProgress, setUploadProgress] = useState<{ [filename: string]: number }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link state for adding links directly to the module
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  // Link selection and batch operations
  const [selectedLinkIds, setSelectedLinkIds] = useState<{ [id: string]: boolean }>({});
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [targetModuleId, setTargetModuleId] = useState<string>('');
  const [deletedResourceIds, setDeletedResourceIds] = useState<{ [id: string]: boolean }>({});

  // External resource search state
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ResearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSearchResultIds, setSelectedSearchResultIds] = useState<{ [id: string]: boolean }>({});
  const [isBatchAddingSearch, setIsBatchAddingSearch] = useState(false);
  const [addingResultId, setAddingResultId] = useState<string | null>(null);
  const [addedResultUrls, setAddedResultUrls] = useState<{ [url: string]: boolean }>({});

  // Unified links list combining module-native links and legacy module resources
  const allLinks = useMemo(() => {
    if (!module) return [];
    const list: {
      id: string;
      title: string;
      url: string;
      description?: string;
      isLegacyResource: boolean;
      sourceLabel?: string;
    }[] = [];

    // 1. Module-native links
    (module.links || []).forEach((l) => {
      list.push({
        id: l.id,
        title: decodeHtmlEntities(l.title),
        url: l.url,
        description: l.description,
        isLegacyResource: false,
        sourceLabel: 'Direct Link',
      });
    });

    // 2. Legacy module resources (excluding deleted ones and duplicates)
    moduleResources
      .filter((r) => r.type !== 'pdf' && !deletedResourceIds[r.id])
      .forEach((r) => {
        const isDuplicate = list.some(
          (item) => item.url.toLowerCase() === r.url.toLowerCase() || item.title.toLowerCase() === r.title.toLowerCase()
        );
        if (!isDuplicate) {
          list.push({
            id: r.id,
            title: decodeHtmlEntities(r.title),
            url: r.url,
            description: r.type === 'external-link' ? undefined : r.type,
            isLegacyResource: true,
            sourceLabel: 'Syllabus Resource',
          });
        }
      });

    return list;
  }, [module, moduleResources, deletedResourceIds]);

  const selectedCount = allLinks.filter((item) => selectedLinkIds[item.id]).length;
  const isAllSelected = allLinks.length > 0 && selectedCount === allLinks.length;

  if (!isOpen || !module) return null;

  const subjectColor = subject.color || '#6366f1';
  const attachments = module.attachments || [];

  // Toggle module completion
  const handleToggleCompletion = async () => {
    try {
      const nextStatus = await toggleModuleCompletion(
        userId,
        subject.id,
        module.id,
        module.completed
      );
      onModuleUpdated({ ...module, completed: nextStatus });
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to update module completion.');
    }
  };

  // Handle multiple PDF uploads via normal computer file picker
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUploading(true);

    const fileList = Array.from(files);
    let currentModule = { ...module };

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];

        // 1. Validate file format and size (< 25 MB)
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
          setErrorMsg(`"${file.name}" skipped: Only PDF documents are supported.`);
          continue;
        }

        const check = validateFile(file);
        if (!check.valid) {
          setErrorMsg(`"${file.name}" skipped: ${check.error}`);
          continue;
        }

        // 2. Track upload progress
        setUploadProgress((prev) => ({ ...prev, [file.name]: 20 }));

        // 3. Save to local IndexedDB document vault (100% Free, Zero Billing, Private)
        const storageKey = `vault_mod_${module.id}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        await saveFileToVault(storageKey, file);

        setUploadProgress((prev) => ({ ...prev, [file.name]: 65 }));

        const objectUrl = URL.createObjectURL(file);
        const sizeString = formatBytes(file.size);

        // 4. Create attachment record
        const newAttachment: ModuleAttachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: sizeString,
          sizeBytes: file.size,
          type: 'application/pdf',
          url: objectUrl,
          storageKey,
          uploadedAt: new Date().toISOString(),
        };

        // 5. Persist attachment in Module Firestore document
        const updatedAttachments = await addModuleAttachment(
          userId,
          subject.id,
          module.id,
          newAttachment
        );

        setUploadProgress((prev) => ({ ...prev, [file.name]: 85 }));

        // 6. Also register in Resources collection for unified search & filtering
        await createResource(userId, {
          subjectId: subject.id,
          moduleId: module.id,
          title: file.name,
          type: 'pdf',
          url: objectUrl,
          description: `PDF attached to Module #${module.order}: ${module.title}`,
          fileSize: sizeString,
          fileStorageKey: storageKey,
        });

        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));

        currentModule = {
          ...currentModule,
          attachments: updatedAttachments,
        };
        onModuleUpdated(currentModule);
      }

      setSuccessMsg(`Successfully uploaded ${fileList.length} file(s)!`);
      setTimeout(() => setUploadProgress({}), 2000);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Error occurred while saving PDF files.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Open PDF in built-in reader
  const handleOpenPdfReader = async (att: ModuleAttachment) => {
    let urlToUse = att.url;

    // Refresh object URL from vault if needed
    if (att.storageKey) {
      const freshUrl = await getFileObjectUrl(att.storageKey);
      if (freshUrl) urlToUse = freshUrl;
    }

    onOpenPdf({
      id: att.id,
      userId,
      subjectId: subject.id,
      moduleId: module.id,
      title: att.name,
      type: 'pdf',
      url: urlToUse,
      createdAt: att.uploadedAt,
      updatedAt: att.uploadedAt,
      fileStorageKey: att.storageKey,
      fileSize: att.size,
    });
  };

  // Delete an attached PDF
  const handleDeleteAttachment = async (att: ModuleAttachment) => {
    if (!window.confirm(`Are you sure you want to delete "${att.name}"?`)) return;

    setDeletingId(att.id);
    setErrorMsg(null);

    try {
      // 1. Delete from module attachments in Firestore
      const updated = await deleteModuleAttachment(userId, subject.id, module.id, att.id);

      // 2. Delete from IndexedDB vault if stored locally
      if (att.storageKey) {
        await deleteFileFromVault(att.storageKey).catch(console.warn);
      }

      // 3. Remove corresponding resource if found
      const matchingResource = moduleResources.find(
        (r) => r.fileStorageKey === att.storageKey || r.title === att.name
      );
      if (matchingResource) {
        await deleteResource(userId, matchingResource.id).catch(console.warn);
      }

      onModuleUpdated({
        ...module,
        attachments: updated,
      });

      setSuccessMsg(`Deleted "${att.name}".`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to delete file attachment.');
    } finally {
      setDeletingId(null);
    }
  };

  // Save new external web link directly to this module
  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim()) {
      setErrorMsg('Please enter both a link title and valid URL.');
      return;
    }

    let finalUrl = linkUrl.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    setIsSavingLink(true);
    setErrorMsg(null);
    try {
      const updatedLinks = await addModuleLink(userId, subject.id, module.id, {
        title: linkTitle.trim(),
        url: finalUrl,
        description: linkDesc.trim() || undefined,
      });

      onModuleUpdated({
        ...module,
        links: updatedLinks,
      });

      setSuccessMsg(`Link "${linkTitle.trim()}" saved directly to module!`);
      setLinkTitle('');
      setLinkUrl('');
      setLinkDesc('');
      setShowAddLinkForm(false);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save link to module.');
    } finally {
      setIsSavingLink(false);
    }
  };

  // Selection toggle handlers
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedLinkIds({});
    } else {
      const next: { [id: string]: boolean } = {};
      allLinks.forEach((item) => {
        next[item.id] = true;
      });
      setSelectedLinkIds(next);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedLinkIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Batch delete selected links
  const handleBatchDeleteSelected = async () => {
    const selectedItems = allLinks.filter((item) => selectedLinkIds[item.id]);
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedItems.length} selected link(s)?`)) return;

    setIsBatchDeleting(true);
    setErrorMsg(null);
    try {
      let currentModuleLinks = module.links || [];

      for (const item of selectedItems) {
        if (item.isLegacyResource) {
          await deleteResource(userId, item.id).catch(console.warn);
          setDeletedResourceIds((prev) => ({ ...prev, [item.id]: true }));
        } else {
          currentModuleLinks = await deleteModuleLink(userId, subject.id, module.id, item.id);
        }
      }

      onModuleUpdated({
        ...module,
        links: currentModuleLinks,
      });

      setSelectedLinkIds({});
      setSuccessMsg(`Deleted ${selectedItems.length} selected link(s).`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to delete selected links.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Delete single link item (supports both module links and legacy resources)
  const handleDeleteItem = async (item: { id: string; title: string; isLegacyResource: boolean }) => {
    if (!window.confirm(`Delete link "${item.title}"?`)) return;
    setDeletingLinkId(item.id);
    setErrorMsg(null);
    try {
      if (item.isLegacyResource) {
        await deleteResource(userId, item.id);
        setDeletedResourceIds((prev) => ({ ...prev, [item.id]: true }));
      } else {
        const updatedLinks = await deleteModuleLink(userId, subject.id, module.id, item.id);
        onModuleUpdated({
          ...module,
          links: updatedLinks,
        });
      }
      setSelectedLinkIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setSuccessMsg(`Deleted link "${item.title}".`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to delete link.');
    } finally {
      setDeletingLinkId(null);
    }
  };

  // Toggle external academic search panel
  const handleOpenSearchPanel = () => {
    setShowSearchPanel((prev) => {
      const next = !prev;
      if (next && !searchQuery) {
        setSearchQuery(module.title);
      }
      return next;
    });
    setShowAddLinkForm(false);
  };

  // Search external resources across Wikipedia and Crossref
  const handleSearchExternal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim() || module.title;
    if (!query) return;

    setIsSearching(true);
    setErrorMsg(null);
    try {
      const results = await searchEducationalTopic(query);
      setSearchResults(results);
      if (results.length === 0) {
        setErrorMsg(`No external academic resources found for "${query}". Try different keywords.`);
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Search failed. Please check your internet connection.');
    } finally {
      setIsSearching(false);
    }
  };

  // Add an external search result directly to module links
  const handleAddSearchResult = async (result: ResearchResult) => {
    setAddingResultId(result.id);
    setErrorMsg(null);
    try {
      const cleanTitle = decodeHtmlEntities(result.title);
      const updatedLinks = await addModuleLink(userId, subject.id, module.id, {
        title: cleanTitle,
        url: result.url,
        description: `[${result.source}] ${result.summary.slice(0, 120)}...`,
      });

      onModuleUpdated({
        ...module,
        links: updatedLinks,
      });

      setAddedResultUrls((prev) => ({ ...prev, [result.url]: true }));
      setSuccessMsg(`Added "${cleanTitle}" to module links!`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to add search result to module.');
    } finally {
      setAddingResultId(null);
    }
  };

  // Batch save / add selected links to target module (defaults to current module)
  const handleBatchSaveSelectedToModule = async (customTargetModId?: string) => {
    const targetModId = customTargetModId || targetModuleId || module.id;
    const selectedItems = allLinks.filter((item) => selectedLinkIds[item.id]);
    if (selectedItems.length === 0) return;

    setIsSavingBatch(true);
    setErrorMsg(null);
    try {
      let updatedModuleLinks = [...(module.links || [])];
      let addedCount = 0;

      for (const item of selectedItems) {
        if (targetModId === module.id) {
          const alreadyInNative = (module.links || []).some(
            (l) => l.url.toLowerCase() === item.url.toLowerCase() || l.title.toLowerCase() === item.title.toLowerCase()
          );
          if (!alreadyInNative) {
            updatedModuleLinks = await addModuleLink(userId, subject.id, module.id, {
              title: item.title,
              url: item.url,
              description: item.description,
            });
            addedCount++;
          }
        } else {
          await addModuleLink(userId, subject.id, targetModId, {
            title: item.title,
            url: item.url,
            description: item.description,
          });
          addedCount++;
        }
      }

      if (targetModId === module.id) {
        onModuleUpdated({
          ...module,
          links: updatedModuleLinks,
        });
      }

      const targetModName = availableModules.find((m) => m.id === targetModId)?.title || module.title;
      setSuccessMsg(
        `Saved & confirmed ${selectedItems.length} link(s) directly in Module #${module.order}: "${targetModName}"!`
      );
      setSelectedLinkIds({});
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to save links to module.');
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Batch add selected search results directly to module
  const handleBatchAddSelectedSearchResults = async () => {
    const selectedResults = searchResults.filter((r) => selectedSearchResultIds[r.id]);
    if (selectedResults.length === 0) return;

    setIsBatchAddingSearch(true);
    setErrorMsg(null);
    try {
      let currentLinks = module.links || [];
      const newUrls: { [url: string]: boolean } = {};

      for (const res of selectedResults) {
        const cleanTitle = decodeHtmlEntities(res.title);
        const alreadyExists = currentLinks.some(
          (l) => l.url.toLowerCase() === res.url.toLowerCase() || l.title.toLowerCase() === cleanTitle.toLowerCase()
        );
        if (!alreadyExists) {
          currentLinks = await addModuleLink(userId, subject.id, module.id, {
            title: cleanTitle,
            url: res.url,
            description: `[${res.source}] ${res.summary.slice(0, 120)}...`,
          });
        }
        newUrls[res.url] = true;
      }

      onModuleUpdated({
        ...module,
        links: currentLinks,
      });

      setAddedResultUrls((prev) => ({ ...prev, ...newUrls }));
      setSelectedSearchResultIds({});
      setSuccessMsg(`Successfully added ${selectedResults.length} educational resource link(s) to Module #${module.order}!`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to add selected resources to module.');
    } finally {
      setIsBatchAddingSearch(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading) onClose();
      }}
    >
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: 'clamp(16px, 3.5vw, 24px) clamp(16px, 4vw, 28px)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: `${subjectColor}15`,
                  color: subjectColor,
                  border: `1px solid ${subjectColor}33`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <BookOpen size={12} />
                {subject.code || subject.name}
              </span>

              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--social-btn-bg)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                Module #{module.order}
              </span>

              <button
                type="button"
                onClick={handleToggleCompletion}
                style={{
                  background: module.completed ? 'rgba(16, 185, 129, 0.15)' : 'var(--social-btn-bg)',
                  color: module.completed ? 'var(--accent-emerald)' : 'var(--text-muted)',
                  border: module.completed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {module.completed ? (
                  <>
                    <CheckCircle2 size={12} /> Completed
                  </>
                ) : (
                  <>
                    <Circle size={12} /> Pending Revision
                  </>
                )}
              </button>
            </div>

            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {module.title}
            </h2>

            {module.description && (
              <p
                style={{
                  fontSize: '0.86rem',
                  color: 'var(--text-secondary)',
                  marginTop: '6px',
                  lineHeight: 1.5,
                }}
              >
                {module.description}
              </p>
            )}
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
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: 'clamp(16px, 3.5vw, 24px) clamp(16px, 4vw, 28px)', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="auth-alert auth-alert-error">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="auth-alert auth-alert-success">
              <CheckCircle2 size={16} color="var(--accent-emerald)" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section: Upload Multiple PDFs */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Module PDF Attachments ({attachments.length})
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Upload lecture notes, revision slides, or textbook chapters (PDF, max 25MB).
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,application/pdf"
                onChange={handleFilesSelected}
                style={{ display: 'none' }}
                id="moduleMultiPdfUpload"
              />

              <Button
                variant="primary"
                size="sm"
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                <span>{isUploading ? 'Uploading...' : 'Upload PDFs'}</span>
              </Button>
            </div>

            {/* Upload Progress Display */}
            {Object.keys(uploadProgress).length > 0 && (
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  marginBottom: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {Object.entries(uploadProgress).map(([fileName, progress]) => (
                  <div key={fileName} style={{ fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fileName}</span>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{progress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${progress}%`,
                          height: '100%',
                          background: 'var(--accent-primary)',
                          transition: 'width 0.2s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Attached PDFs List */}
            {attachments.length === 0 ? (
              <div
                style={{
                  padding: '24px 20px',
                  textAlign: 'center',
                  background: 'var(--bg-tertiary)',
                  border: '1px dashed var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={24} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  No PDFs attached yet
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Click to browse and upload multiple PDFs from your computer
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={16} color="#ef4444" />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.86rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={att.name}
                        >
                          {att.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {att.size} • Uploaded {new Date(att.uploadedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenPdfReader(att)}
                        title="Read PDF in app"
                        style={{
                          background: 'rgba(99, 102, 241, 0.12)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          color: 'var(--accent-primary)',
                          cursor: 'pointer',
                          padding: '5px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <FileText size={13} />
                        <span>Read</span>
                      </button>

                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open file in new window"
                        style={{
                          background: 'var(--social-btn-bg)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <ExternalLink size={13} />
                      </a>

                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att)}
                        disabled={deletingId === att.id}
                        title="Delete attachment"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: deletingId === att.id ? 'not-allowed' : 'pointer',
                          padding: '6px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--accent-rose)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        {deletingId === att.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Linked Web Resources */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '12px',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 'min(100%, 200px)' }}>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Module Web Links & Syllabus Resources ({allLinks.length})
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  External references, research papers, and web resources saved directly in this module.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                <Button
                  variant={showSearchPanel ? 'primary' : 'secondary'}
                  size="sm"
                  type="button"
                  onClick={handleOpenSearchPanel}
                >
                  <Search size={14} /> Find External Resources
                </Button>

                {!showAddLinkForm && (
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setShowAddLinkForm(true);
                      setShowSearchPanel(false);
                    }}
                  >
                    <Plus size={14} /> Add Link
                  </Button>
                )}
              </div>
            </div>

            {/* External Resource Search Panel */}
            {showSearchPanel && (
              <div
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  marginBottom: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Search size={14} color="var(--accent-primary)" />
                    Find External Educational Resources
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSearchPanel(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  Search open-access academic repositories (Wikipedia & Crossref peer-reviewed papers) directly for this topic.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearchExternal();
                  }}
                  style={{ display: 'flex', gap: '8px' }}
                >
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search
                      size={14}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. Machine Learning, Neural Networks, Linear Regression..."
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 34px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '0.84rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSearching || !searchQuery.trim()}
                  >
                    {isSearching ? <Loader2 size={13} className="spin" /> : <Search size={13} />}
                    <span>{isSearching ? 'Searching...' : 'Search'}</span>
                  </Button>
                </form>

                {/* Search Results list */}
                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    {/* Batch Add Toolbar for Search Results */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.78rem',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = searchResults.every((r) => selectedSearchResultIds[r.id]);
                          if (allSelected) {
                            setSelectedSearchResultIds({});
                          } else {
                            const next: { [id: string]: boolean } = {};
                            searchResults.forEach((r) => {
                              next[r.id] = true;
                            });
                            setSelectedSearchResultIds(next);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 600,
                          fontSize: '0.76rem',
                        }}
                      >
                        {searchResults.every((r) => selectedSearchResultIds[r.id]) ? (
                          <CheckSquare size={14} color="var(--accent-primary)" />
                        ) : (
                          <Square size={14} color="var(--text-muted)" />
                        )}
                        <span>Select All ({searchResults.length})</span>
                      </button>

                      {Object.values(selectedSearchResultIds).filter(Boolean).length > 0 && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={handleBatchAddSelectedSearchResults}
                          disabled={isBatchAddingSearch}
                          style={{ padding: '3px 10px', fontSize: '0.74rem' }}
                        >
                          {isBatchAddingSearch ? <Loader2 size={12} className="spin" /> : <Plus size={12} />}
                          <span>
                            Add Selected ({Object.values(selectedSearchResultIds).filter(Boolean).length}) to Module
                          </span>
                        </Button>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        paddingRight: '4px',
                      }}
                    >
                      {searchResults.map((res) => {
                        const isAdded =
                          !!addedResultUrls[res.url] ||
                          allLinks.some((l) => l.url.toLowerCase() === res.url.toLowerCase());
                        const isThisAdding = addingResultId === res.id;
                        const isChecked = !!selectedSearchResultIds[res.id];

                        return (
                          <div
                            key={res.id}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-sm)',
                              background: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card)',
                              border: isChecked ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-subtle)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              transition: 'all var(--transition-fast)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedSearchResultIds((prev) => ({
                                      ...prev,
                                      [res.id]: !prev[res.id],
                                    }))
                                  }
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: isChecked ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    flexShrink: 0,
                                  }}
                                  aria-label={`Select ${res.title}`}
                                >
                                  {isChecked ? <CheckSquare size={15} /> : <Square size={15} />}
                                </button>

                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background:
                                      res.source === 'Wikipedia'
                                        ? 'rgba(56, 189, 248, 0.15)'
                                        : 'rgba(168, 85, 247, 0.15)',
                                    color:
                                      res.source === 'Wikipedia'
                                        ? 'var(--accent-cyan)'
                                        : 'var(--accent-secondary)',
                                    flexShrink: 0,
                                  }}
                                >
                                  {res.source}
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.84rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                  title={decodeHtmlEntities(res.title)}
                                >
                                  {decodeHtmlEntities(res.title)}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <a
                                  href={res.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: 'var(--text-muted)',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                  title="Open in new window"
                                >
                                  <ExternalLink size={13} />
                                </a>

                                {isAdded ? (
                                  <span
                                    style={{
                                      fontSize: '0.74rem',
                                      fontWeight: 600,
                                      color: 'var(--accent-emerald)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '4px 8px',
                                    }}
                                  >
                                    <Check size={13} /> Added
                                  </span>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    type="button"
                                    onClick={() => handleAddSearchResult(res)}
                                    disabled={isThisAdding}
                                    style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                                  >
                                    {isThisAdding ? (
                                      <Loader2 size={12} className="spin" />
                                    ) : (
                                      <Plus size={12} />
                                    )}
                                    <span>Add</span>
                                  </Button>
                                )}
                              </div>
                            </div>

                            <p
                              style={{
                                fontSize: '0.74rem',
                                color: 'var(--text-secondary)',
                                margin: 0,
                                lineHeight: 1.4,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {res.summary}
                          </p>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Inline Add Link Form */}
            {showAddLinkForm && (
              <form
                onSubmit={handleSaveLink}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  marginBottom: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <LinkIcon size={14} color="var(--accent-primary)" />
                    Add External Link to Module
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddLinkForm(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Link Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GeeksforGeeks Machine Learning Tutorial"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Web URL *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="https://example.com/notes"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Note / Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Required reading for Quiz 1"
                    value={linkDesc}
                    onChange={(e) => setLinkDesc(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAddLinkForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSavingLink}
                  >
                    {isSavingLink ? <Loader2 size={13} className="spin" /> : <Plus size={13} />}
                    <span>{isSavingLink ? 'Saving...' : 'Save Link to Module'}</span>
                  </Button>
                </div>
              </form>
            )}

            {/* Select All and Batch Actions Toolbar */}
            {allLinks.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  marginBottom: '10px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '2px 4px',
                  }}
                >
                  {isAllSelected ? (
                    <CheckSquare size={16} color="var(--accent-primary)" />
                  ) : (
                    <Square size={16} color="var(--text-muted)" />
                  )}
                  <span>
                    {isAllSelected ? 'Deselect All' : `Select All (${allLinks.length})`}
                  </span>
                </button>

                {selectedCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <Button
                      variant="primary"
                      size="sm"
                      type="button"
                      onClick={() => handleBatchSaveSelectedToModule()}
                      disabled={isSavingBatch}
                    >
                      {isSavingBatch ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                      <span>Add Selected ({selectedCount}) to Module #{module.order}</span>
                    </Button>

                    {availableModules && availableModules.length > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <select
                          value={targetModuleId || module.id}
                          onChange={(e) => setTargetModuleId(e.target.value)}
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '0.74rem',
                          }}
                        >
                          <option value={module.id}>This Module (#{module.order})</option>
                          {availableModules
                            .filter((m) => m.id !== module.id)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                Module #{m.order}: {m.title}
                              </option>
                            ))}
                        </select>
                        {targetModuleId && targetModuleId !== module.id && (
                          <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={() => handleBatchSaveSelectedToModule(targetModuleId)}
                            disabled={isSavingBatch}
                          >
                            Assign to Selected
                          </Button>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleBatchDeleteSelected}
                      disabled={isBatchDeleting}
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: 'var(--accent-rose)',
                        padding: '5px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: isBatchDeleting ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      {isBatchDeleting ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                      <span>Delete Selected ({selectedCount})</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {allLinks.length === 0 ? (
              <div
                style={{
                  padding: '24px 20px',
                  textAlign: 'center',
                  background: 'var(--bg-tertiary)',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                }}
              >
                <div>No external links saved in this module yet.</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={handleOpenSearchPanel}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Search size={13} /> Find External Resources
                  </button>
                  <span style={{ color: 'var(--border-medium)' }}>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddLinkForm(true);
                      setShowSearchPanel(false);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={13} /> Add Web Link
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allLinks.map((item) => {
                  const isSelected = !!selectedLinkIds[item.id];
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-tertiary)',
                        border: isSelected
                          ? '1px solid rgba(99, 102, 241, 0.45)'
                          : '1px solid var(--border-subtle)',
                        gap: '12px',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      {/* Selection Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleSelectOne(item.id)}
                        aria-label={`Select ${item.title}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                      </button>

                      {/* Icon */}
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Globe size={16} color="var(--accent-cyan)" />
                      </div>

                      {/* Title & Description */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.88rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={item.title}
                          >
                            {item.title}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: 'var(--accent-emerald)',
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Check size={11} /> Saved in Module #{module.order}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--text-muted)',
                            marginTop: '3px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.description ? `${item.description} • ` : ''}
                          {item.url}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: 'var(--social-btn-bg)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            textDecoration: 'none',
                          }}
                        >
                          <ExternalLink size={13} /> Open
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          disabled={deletingLinkId === item.id}
                          title="Delete link"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: deletingLinkId === item.id ? 'not-allowed' : 'pointer',
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--accent-rose)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-muted)';
                          }}
                        >
                          {deletingLinkId === item.id ? (
                            <Loader2 size={14} className="spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              Module #{module.order}: {module.title}
            </span>
            <span>•</span>
            <span>{attachments.length} PDFs</span>
            <span>•</span>
            <span>{allLinks.length} Links</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {selectedCount > 0 && (
              <Button
                variant="primary"
                size="md"
                type="button"
                onClick={() => handleBatchSaveSelectedToModule()}
                disabled={isSavingBatch}
              >
                {isSavingBatch ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
                <span>Add Selected ({selectedCount}) to Module</span>
              </Button>
            )}
            <Button variant="secondary" size="md" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
