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
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { Module } from '../../types/module';

interface ModuleListProps {
  modules: Module[];
  onToggleComplete: (module: Module) => void;
  onEdit: (module: Module) => void;
  onDelete: (module: Module) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onAddModule: () => void;
  onOpenFile?: (module: Module) => void;
}

export const ModuleList: React.FC<ModuleListProps> = ({
  modules,
  onToggleComplete,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddModule,
  onOpenFile,
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
        <p style={{ maxWidth: '400px', color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
          Break down this subject into chapters, units, or modules to track your syllabus completion.
        </p>
        <Button variant="primary" size="md" onClick={onAddModule}>
          <Plus size={16} /> Add First Module
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {modules.map((mod, index) => {
        const isFirst = index === 0;
        const isLast = index === modules.length - 1;

        return (
          <div
            key={mod.id}
            className="glass-panel animate-fade-in"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              borderLeft: mod.completed ? '4px solid var(--accent-emerald)' : '4px solid var(--border-subtle)',
              transition: 'all var(--transition-fast)',
              background: mod.completed ? 'rgba(16, 185, 129, 0.04)' : undefined,
            }}
          >
            {/* Left: Completion Checkbox + Title + Order Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '240px' }}>
              <button
                type="button"
                onClick={() => onToggleComplete(mod)}
                aria-label={mod.completed ? 'Mark incomplete' : 'Mark complete'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: mod.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                      textDecoration: mod.completed ? 'line-through' : 'none',
                      transition: 'color var(--transition-fast)',
                    }}
                  >
                    {mod.title}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: mod.completed ? 'var(--accent-emerald)' : 'var(--text-muted)',
                      fontWeight: 500,
                    }}
                  >
                    {mod.completed ? '✓ Completed' : 'Pending revision'}
                  </span>

                  {mod.fileName && (
                    <button
                      type="button"
                      onClick={() => onOpenFile?.(mod)}
                      title={`Open attached file: ${mod.fileName}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(99, 102, 241, 0.12)',
                        color: 'var(--accent-primary)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        maxWidth: '240px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
                      }}
                    >
                      <Paperclip size={12} style={{ flexShrink: 0 }} />
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {mod.fileName}
                      </span>
                      {mod.fileSize && (
                        <span style={{ fontSize: '0.68rem', opacity: 0.8, flexShrink: 0 }}>
                          ({mod.fileSize})
                        </span>
                      )}
                      <ExternalLink size={10} style={{ flexShrink: 0, marginLeft: '2px' }} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Reorder buttons & Edit/Delete actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                title="Edit Module"
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
        );
      })}
    </div>
  );
};
