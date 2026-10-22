import React from 'react';
import {
  CheckCircle2,
  Circle,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Layers,
  Plus,
  Paperclip,
  BookOpen,
  FileText,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { Module, ModuleAttachment } from '../../types/module';
import type { StudyResource } from '../../types/resource';
import { decodeHtmlEntities } from '../../services/researchService';

interface ModuleListProps {
  modules: Module[];
  resources?: StudyResource[];
  onToggleComplete: (module: Module) => void;
  onEdit: (module: Module) => void;
  onDelete: (module: Module) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onAddModule: () => void;
  onOpenMaterials?: (module: Module) => void;
  onOpenFile?: (module: Module) => void;
  onOpenPdf?: (attachment: ModuleAttachment, module: Module) => void;
}

export const ModuleList: React.FC<ModuleListProps> = ({
  modules,
  resources = [],
  onToggleComplete,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddModule,
  onOpenMaterials,
  onOpenFile,
  onOpenPdf,
}) => {
  if (modules.length === 0) {
    return (
      <div className="empty-state animate-fade-in" style={{ padding: '48px 24px' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            color: 'var(--accent-primary)',
          }}
        >
          <Layers size={28} />
        </div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
          No modules added yet
        </h3>
        <p style={{ maxWidth: '440px', color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
          Break down this subject into chapters, units, or modules. You can upload multiple PDFs and save external links directly inside each module.
        </p>
        <Button variant="primary" size="md" onClick={onAddModule}>
          <Plus size={16} /> Add First Module
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {modules.map((mod, index) => {
        const isFirst = index === 0;
        const isLast = index === modules.length - 1;

        // Combine native module attachments and any PDF resources assigned to this module
        const modResources = (resources || []).filter((r) => r.moduleId === mod.id);

        const allAttachments: ModuleAttachment[] = [...(mod.attachments || [])];
        modResources
          .filter((r) => r.type === 'pdf')
          .forEach((r) => {
            const alreadyExists = allAttachments.some(
              (att) => att.url === r.url || att.name === r.title || (att.storageKey && att.storageKey === r.fileStorageKey)
            );
            if (!alreadyExists) {
              allAttachments.push({
                id: r.id,
                name: r.title,
                size: r.fileSize || 'PDF Document',
                type: 'application/pdf',
                url: r.url,
                storageKey: r.fileStorageKey || undefined,
                uploadedAt: r.createdAt || new Date().toISOString(),
              });
            }
          });

        // Combine native module links and any external-link resources assigned to this module
        const allLinks: { id: string; title: string; url: string; description?: string }[] = [];
        (mod.links || []).forEach((l) => {
          allLinks.push({
            id: l.id,
            title: decodeHtmlEntities(l.title),
            url: l.url,
            description: l.description,
          });
        });
        modResources
          .filter((r) => r.type !== 'pdf')
          .forEach((r) => {
            const alreadyExists = allLinks.some(
              (l) => l.url.toLowerCase() === r.url.toLowerCase() || l.title.toLowerCase() === r.title.toLowerCase()
            );
            if (!alreadyExists) {
              allLinks.push({
                id: r.id,
                title: decodeHtmlEntities(r.title),
                url: r.url,
                description: r.description,
              });
            }
          });

        const pdfCount = allAttachments.length || (mod.fileName ? 1 : 0);
        const linksCount = allLinks.length;

        // Keep module list clean and compact without lengthy inline drawers
        const isExpanded = false;

        return (
          <div
            key={mod.id}
            className="card animate-fade-in"
            style={{
              padding: 0,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-card)',
              overflow: 'hidden',
              transition: 'all var(--transition-fast)',
            }}
          >
            {/* Main Module Row */}
            <div
              style={{
                padding: '14px clamp(12px, 3vw, 20px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                background: mod.completed ? 'rgba(34, 197, 94, 0.03)' : undefined,
              }}
            >
              {/* Left: Completion Checkbox + Order + Title + Badges */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 'min(100%, 200px)' }}>
                <button
                  type="button"
                  onClick={() => onToggleComplete(mod)}
                  aria-label={mod.completed ? 'Mark incomplete' : 'Mark complete'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 0 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: mod.completed ? 'var(--accent-emerald)' : 'var(--text-muted)',
                    transition: 'transform var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {mod.completed ? (
                    <CheckCircle2 size={22} color="var(--accent-emerald)" strokeWidth={2.4} />
                  ) : (
                    <Circle size={22} strokeWidth={2} />
                  )}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--social-btn-bg)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      #{mod.order || index + 1}
                    </span>

                    <span
                      onClick={() => onOpenMaterials?.(mod)}
                      style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: mod.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                        textDecoration: mod.completed ? 'line-through' : 'none',
                        cursor: 'pointer',
                        transition: 'color var(--transition-fast)',
                      }}
                      title="Click to view module materials"
                    >
                      {mod.title}
                    </span>
                  </div>

                  {mod.description && (
                    <p
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        margin: '2px 0',
                      }}
                    >
                      {mod.description}
                    </p>
                  )}

                  {/* Attachment & Link Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        color: mod.completed ? 'var(--accent-emerald)' : 'var(--text-muted)',
                        fontWeight: 500,
                      }}
                    >
                      {mod.completed ? '✓ Completed' : 'Pending revision'}
                    </span>

                    {/* PDF badge */}
                    <button
                      type="button"
                      onClick={() => onOpenMaterials?.(mod)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: pdfCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--social-btn-bg)',
                        color: pdfCount > 0 ? 'var(--accent-rose)' : 'var(--text-muted)',
                        border: pdfCount > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                      }}
                      title="Manage PDFs"
                    >
                      <Paperclip size={12} />
                      <span>{pdfCount} {pdfCount === 1 ? 'PDF' : 'PDFs'}</span>
                    </button>

                    {/* Links badge */}
                    <button
                      type="button"
                      onClick={() => onOpenMaterials?.(mod)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: linksCount > 0 ? 'rgba(56, 189, 248, 0.1)' : 'var(--social-btn-bg)',
                        color: linksCount > 0 ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        border: linksCount > 0 ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                      }}
                      title="Manage Web Links"
                    >
                      <Globe size={12} />
                      <span>{linksCount} {linksCount === 1 ? 'Link' : 'Links'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Materials Button */}
                {onOpenMaterials && (
                  <button
                    type="button"
                    onClick={() => onOpenMaterials(mod)}
                    style={{
                      background: 'rgba(79, 100, 241, 0.1)',
                      border: '1px solid rgba(79, 100, 241, 0.25)',
                      color: 'var(--accent-primary)',
                      cursor: 'pointer',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all var(--transition-fast)',
                    }}
                    title="Upload PDFs & Materials"
                  >
                    <Plus size={13} />
                    <span>Materials</span>
                  </button>
                )}

                {/* Move Up */}
                <button
                  type="button"
                  onClick={() => onMoveUp(index)}
                  disabled={isFirst}
                  aria-label="Move module up"
                  title="Move Up"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isFirst ? 'var(--border-subtle)' : 'var(--text-muted)',
                    cursor: isFirst ? 'not-allowed' : 'pointer',
                    padding: '6px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ArrowUp size={16} />
                </button>

                {/* Move Down */}
                <button
                  type="button"
                  onClick={() => onMoveDown(index)}
                  disabled={isLast}
                  aria-label="Move module down"
                  title="Move Down"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isLast ? 'var(--border-subtle)' : 'var(--text-muted)',
                    cursor: isLast ? 'not-allowed' : 'pointer',
                    padding: '6px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ArrowDown size={16} />
                </button>

                <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 4px' }} />

                {/* Edit */}
                <button
                  type="button"
                  onClick={() => onEdit(mod)}
                  aria-label="Edit module"
                  title="Edit Module Title & Description"
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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  <Edit2 size={15} />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => onDelete(mod)}
                  aria-label="Delete module"
                  title="Delete Module"
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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--accent-rose)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  <Trash2 size={15} />
                </button>


              </div>
            </div>

            {/* Expandable Module Content Drawer (PDFs & Links saved directly in this module) */}
            {isExpanded && (
              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  background: 'var(--bg-tertiary)',
                  padding: '18px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* 1. PDFs Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={14} color="#ef4444" />
                      Attached PDFs ({pdfCount})
                    </span>

                    {onOpenMaterials && (
                      <button
                        type="button"
                        onClick={() => onOpenMaterials(mod)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-primary)',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Plus size={12} /> Upload More PDFs
                      </button>
                    )}
                  </div>

                  {allAttachments.length === 0 && !mod.fileName ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                      No PDFs attached yet. Click "Upload & Links" to upload lecture notes or slide chapters.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {allAttachments.map((att) => (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            gap: '10px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                            <FileText size={15} color="#ef4444" style={{ flexShrink: 0 }} />
                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={att.name}
                            >
                              {att.name}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                              ({att.size})
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {onOpenPdf && (
                              <button
                                type="button"
                                onClick={() => onOpenPdf(att, mod)}
                                style={{
                                  background: 'rgba(79, 100, 241, 0.12)',
                                  border: '1px solid rgba(79, 100, 241, 0.3)',
                                  color: 'var(--accent-primary)',
                                  padding: '4px 10px',
                                  borderRadius: 'var(--radius-xs)',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <BookOpen size={12} /> Read PDF
                              </button>
                            )}

                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background: 'var(--social-btn-bg)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-secondary)',
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.74rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                              title="Open in new window"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      ))}

                      {/* Legacy file support if exists */}
                      {allAttachments.length === 0 && mod.fileName && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={15} color="#ef4444" />
                            <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{mod.fileName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenFile?.(mod)}
                            style={{
                              background: 'rgba(79, 100, 241, 0.12)',
                              border: '1px solid rgba(79, 100, 241, 0.3)',
                              color: 'var(--accent-primary)',
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Open
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Web Links & Resources Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Globe size={14} color="var(--accent-cyan)" />
                      External Links & Resources ({linksCount})
                    </span>

                    {onOpenMaterials && (
                      <button
                        type="button"
                        onClick={() => onOpenMaterials(mod)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-primary)',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Plus size={12} /> Add Web Link
                      </button>
                    )}
                  </div>

                  {allLinks.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                      No external links saved in this module yet. Click "+ Add Web Link" to paste tutorials, lecture links, or practice references.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {allLinks.map((link) => (
                        <div
                          key={link.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            gap: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: 'rgba(56, 189, 248, 0.12)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Globe size={14} color="var(--accent-cyan)" />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <span
                                style={{
                                  fontSize: '0.84rem',
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: 'block',
                                }}
                                title={decodeHtmlEntities(link.title)}
                              >
                                {decodeHtmlEntities(link.title)}
                              </span>
                              <div
                                style={{
                                  fontSize: '0.72rem',
                                  color: 'var(--text-muted)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  marginTop: '2px',
                                }}
                              >
                                {link.description ? `${link.description} • ` : ''}
                                {link.url}
                              </div>
                            </div>
                          </div>

                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: 'var(--social-btn-bg)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--accent-primary)',
                              padding: '5px 12px',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              textDecoration: 'none',
                              flexShrink: 0,
                              transition: 'all var(--transition-fast)',
                            }}
                          >
                            <ExternalLink size={12} /> Open Link
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
