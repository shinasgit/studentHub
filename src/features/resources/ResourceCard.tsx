import React from 'react';
import {
  FileText,
  ExternalLink,
  BookOpen,
  Video,
  FileQuestion,
  FileCode,
  Edit2,
  Trash2,
} from 'lucide-react';
import type { StudyResource, ResourceType } from '../../types/resource';
import { RESOURCE_TYPE_LABELS } from '../../types/resource';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';

interface ResourceCardProps {
  resource: StudyResource;
  subject?: Subject;
  module?: Module;
  onOpen: (resource: StudyResource) => void;
  onEdit: (resource: StudyResource) => void;
  onDelete: (resource: StudyResource) => void;
}

const getResourceIcon = (type: ResourceType) => {
  switch (type) {
    case 'pdf':
      return <FileText size={20} color="#ef4444" />;
    case 'question-paper':
      return <FileQuestion size={20} color="#f59e0b" />;
    case 'note':
      return <FileCode size={20} color="#10b981" />;
    case 'syllabus':
      return <BookOpen size={20} color="#6366f1" />;
    case 'video-link':
      return <Video size={20} color="#ec4899" />;
    default:
      return <ExternalLink size={20} color="#06b6d4" />;
  }
};

export const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  subject,
  module,
  onOpen,
  onEdit,
  onDelete,
}) => {
  const typeConfig = RESOURCE_TYPE_LABELS[resource.type] || {
    label: 'Resource',
    badgeColor: '#6366f1',
  };

  const isPdf = resource.type === 'pdf' || resource.url.endsWith('.pdf');

  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '14px',
        borderLeft: `4px solid ${typeConfig.badgeColor}`,
        transition: 'all var(--transition-normal)',
      }}
    >
      <div>
        {/* Top Badges & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Type badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: `${typeConfig.badgeColor}18`,
                color: typeConfig.badgeColor,
                border: `1px solid ${typeConfig.badgeColor}35`,
              }}
            >
              {getResourceIcon(resource.type)}
              {typeConfig.label}
            </span>

            {/* Subject Code badge if known */}
            {subject && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--social-btn-bg)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {subject.code}
              </span>
            )}

            {/* Module title if assigned */}
            {module && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--social-btn-bg)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                Unit {module.order}
              </span>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => onEdit(resource)}
              aria-label="Edit resource"
              title="Edit Resource"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(resource)}
              aria-label="Delete resource"
              title="Delete Resource"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Title */}
        <h4
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '6px',
            lineHeight: 1.35,
          }}
        >
          {resource.title}
        </h4>

        {/* Description */}
        {resource.description && (
          <p
            style={{
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {resource.description}
          </p>
        )}
      </div>

      {/* Footer Open Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          {new Date(resource.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>

        <button
          type="button"
          onClick={() => onOpen(resource)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            background: isPdf ? 'linear-gradient(135deg, #ef4444, #f43f5e)' : 'var(--social-btn-bg)',
            color: isPdf ? '#ffffff' : 'var(--text-primary)',
            border: isPdf ? 'none' : '1px solid var(--border-subtle)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          {isPdf ? (
            <>
              <FileText size={14} />
              <span>Read in App</span>
            </>
          ) : (
            <>
              <ExternalLink size={14} />
              <span>Open Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
