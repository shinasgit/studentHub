import React, { useState } from 'react';
import {
  X,
  Search,
  BookOpen,
  ExternalLink,
  Check,
  Loader2,
  BookmarkCheck,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { searchEducationalTopic, type ResearchResult, decodeHtmlEntities } from '../../services/researchService';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';
import type { ResourceInput } from '../../types/resource';

interface TopicResearchModalProps {
  isOpen: boolean;
  subject: Subject;
  modules: Module[];
  onClose: () => void;
  onSaveResource: (input: ResourceInput) => Promise<void>;
}

export const TopicResearchModal: React.FC<TopicResearchModalProps> = ({
  isOpen,
  subject,
  modules,
  onClose,
  onSaveResource,
}) => {
  const [query, setQuery] = useState(subject.name || '');
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setLoading(true);
    setErrorMsg(null);
    setSearched(true);

    try {
      const data = await searchEducationalTopic(cleanQuery);
      setResults(data);
      if (data.length === 0) {
        setErrorMsg('No open educational resources found for this search term. Try broader keywords.');
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Failed to search educational resources.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToSubject = async (item: ResearchResult) => {
    setSavingId(item.id);
    try {
      await onSaveResource({
        subjectId: subject.id,
        moduleId: selectedModuleId || undefined,
        title: decodeHtmlEntities(item.title),
        type: 'external-link',
        url: item.url,
        description: item.summary,
      });
      setSavedIds((prev) => ({ ...prev, [item.id]: true }));
    } catch (err) {
      console.error('Failed to save researched resource:', err);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      className="modal-backdrop animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="modal-dialog"
        style={{
          maxWidth: '740px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)',
              }}
            >
              <Sparkles size={20} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Educational Topic Research</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Search permitted open repositories (Wikimedia, Open Academic Papers) at ₹0 cost
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close research dialog"
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
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            flex: 1,
          }}
        >
          {/* Search Bar & Module Selector */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <Search
                size={16}
                color="var(--text-muted)"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Enter topic or concept (e.g. Binary Search, Calculus, Thermodynamics)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '38px' }}
                autoFocus
              />
            </div>

            {modules.length > 0 && (
              <select
                value={selectedModuleId}
                onChange={(e) => setSelectedModuleId(e.target.value)}
                className="input-field"
                style={{ flex: '0 1 180px', fontSize: '0.82rem' }}
                title="Assign saved sources to a module"
              >
                <option value="">Link to: General Subject</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    Link to: {m.title}
                  </option>
                ))}
              </select>
            )}

            <Button variant="primary" size="md" type="submit" disabled={loading || !query.trim()}>
              {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
              <span>{loading ? 'Searching...' : 'Research'}</span>
            </Button>
          </form>

          {/* Quick Module / Subject Tag Shortcuts */}
          {modules.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Quick Topics:
              </span>
              <button
                type="button"
                onClick={() => {
                  setQuery(subject.name);
                }}
                style={{
                  background: 'var(--social-btn-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '3px 10px',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {subject.name}
              </button>
              {modules.slice(0, 4).map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => {
                    setQuery(mod.title);
                  }}
                  style={{
                    background: 'var(--social-btn-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '3px 10px',
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {mod.title}
                </button>
              ))}
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="auth-alert auth-alert-error" style={{ margin: 0 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 0' }}>
              <div className="skeleton-card" style={{ height: '80px' }} />
              <div className="skeleton-card" style={{ height: '80px' }} />
              <div className="skeleton-card" style={{ height: '80px' }} />
            </div>
          )}

          {/* Results List */}
          {!loading && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Found {results.length} verified open educational resources:
              </div>

              {results.map((res) => {
                const isSaved = Boolean(savedIds[res.id]);
                const isSavingThis = savingId === res.id;

                return (
                  <div
                    key={res.id}
                    className="glass-panel"
                    style={{
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background:
                              res.source === 'Wikipedia'
                                ? 'rgba(99, 102, 241, 0.12)'
                                : 'rgba(16, 185, 129, 0.12)',
                            color:
                              res.source === 'Wikipedia'
                                ? 'var(--accent-primary)'
                                : 'var(--accent-emerald)',
                            border: `1px solid ${
                              res.source === 'Wikipedia'
                                ? 'rgba(99, 102, 241, 0.25)'
                                : 'rgba(16, 185, 129, 0.25)'
                            }`,
                          }}
                        >
                          {res.source}
                        </span>

                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            textDecoration: 'none',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--accent-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }}
                        >
                          <span>{res.title}</span>
                          <ExternalLink size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
                        </a>
                      </div>

                      {/* Save to library button */}
                      <button
                        type="button"
                        onClick={() => handleSaveToSubject(res)}
                        disabled={isSaved || isSavingThis}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: isSaved ? 'default' : 'pointer',
                          background: isSaved
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'var(--social-btn-bg)',
                          color: isSaved ? 'var(--accent-emerald)' : 'var(--text-primary)',
                          border: isSaved
                            ? '1px solid rgba(16, 185, 129, 0.3)'
                            : '1px solid var(--border-subtle)',
                          transition: 'all var(--transition-fast)',
                          flexShrink: 0,
                        }}
                      >
                        {isSavingThis ? (
                          <>
                            <Loader2 size={13} className="spin" />
                            <span>Saving...</span>
                          </>
                        ) : isSaved ? (
                          <>
                            <Check size={13} />
                            <span>Saved</span>
                          </>
                        ) : (
                          <>
                            <BookmarkCheck size={13} />
                            <span>Save to Course</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Excerpt */}
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                      {res.summary}
                    </p>

                    {/* License and Attribution footnote */}
                    <div
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: '6px',
                        marginTop: '4px',
                      }}
                    >
                      <span>{res.licenseNote}</span>
                      {res.publishedDate && <span>Date: {res.publishedDate}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Initial empty placeholder */}
          {!searched && !loading && (
            <div className="empty-state" style={{ padding: '36px 20px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '16px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-emerald)',
                  marginBottom: '12px',
                }}
              >
                <BookOpen size={26} />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px' }}>
                Open-Access Academic Research
              </h4>
              <p style={{ maxWidth: '420px', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                Enter any course concept above to extract verified summaries, reference links, and open access papers to your syllabus.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
