import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Download,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  FileQuestion,
} from 'lucide-react';
import type { StudyResource } from '../../types/resource';
import { getFileObjectUrl } from '../../services/fileStorageService';

export interface PDFReaderErrorState {
  title: string;
  message: string;
  type?: 'deleted' | 'missing_url' | 'inaccessible' | 'load_error' | 'invalid_page' | 'invalid_citation' | 'error';
  details?: string;
}

export interface PDFReaderModalProps {
  isOpen: boolean;
  resource: StudyResource | null;
  initialPage?: number;
  pageEndNumber?: number;
  pageRange?: string;
  initialError?: PDFReaderErrorState | null;
  onClose: () => void;
}

export const PDFReaderModal: React.FC<PDFReaderModalProps> = ({
  isOpen,
  resource,
  initialPage = 1,
  pageEndNumber,
  pageRange,
  initialError = null,
  onClose,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [activeUrl, setActiveUrl] = useState<string>(resource?.url || '');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<PDFReaderErrorState | null>(initialError);

  // Synchronize initialError prop when modal opens or changes
  useEffect(() => {
    if (initialError) {
      setErrorState(initialError);
    } else {
      setErrorState(null);
    }
  }, [initialError, resource]);

  // Keyboard shortcut: ESC to safely close reader and return to chatbot
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Resolve active storage URL on resource change
  useEffect(() => {
    let isCancelled = false;
    const resolveUrl = async () => {
      if (!resource) {
        if (!initialError) {
          setErrorState({
            type: 'deleted',
            title: 'Study Document Not Found',
            message: 'The requested document is not available in your study library. It may have been deleted or moved.',
          });
        }
        return;
      }

      setIsResolving(true);

      try {
        if (resource.fileStorageKey) {
          const freshUrl = await getFileObjectUrl(resource.fileStorageKey);
          if (freshUrl && !isCancelled) {
            setActiveUrl(freshUrl);
            setErrorState(null);
            setIsResolving(false);
            return;
          }
        }

        if (resource.url && resource.url.trim().length > 0 && !isCancelled) {
          setActiveUrl(resource.url.trim());
          setErrorState(null);
          setIsResolving(false);
          return;
        }

        // Neither storageKey nor URL yielded a valid link
        if (!isCancelled && !initialError) {
          setErrorState({
            type: 'missing_url',
            title: 'PDF File Unavailable',
            message: `No accessible file link or local storage copy was found for "${resource.title || 'this resource'}". The file may need to be uploaded again.`,
          });
        }
      } catch (err) {
        if (!isCancelled) {
          setErrorState({
            type: 'inaccessible',
            title: 'Unable to Load Document',
            message: `Failed to open document file: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      } finally {
        if (!isCancelled) {
          setIsResolving(false);
        }
      }
    };

    if (isOpen) {
      resolveUrl();
    }

    return () => {
      isCancelled = true;
    };
  }, [resource, isOpen, initialError]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 15, 200));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 15, 60));
  const handleResetZoom = () => setZoomLevel(100);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Safe page number validation (must be positive integer >= 1)
  const safePage =
    typeof initialPage === 'number' && Number.isFinite(initialPage) && initialPage >= 1
      ? Math.floor(initialPage)
      : 1;

  // Construct viewer URL with page anchor
  const currentUrl = activeUrl || resource?.url || '';
  const pageFragment = `page=${safePage}&`;
  const viewerUrl = currentUrl
    ? currentUrl.includes('#')
      ? currentUrl
      : `${currentUrl}#${pageFragment}view=FitH&toolbar=1&navpanes=1`
    : '';

  const displayTitle = resource?.title || 'Study Document Citation';
  const displayPageRange =
    pageRange || (pageEndNumber && pageEndNumber > safePage ? `${safePage}–${pageEndNumber}` : `${safePage}`);

  return (
    <div
      className="pdf-reader-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(5, 8, 15, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isFullscreen ? 0 : '20px',
        animation: 'fadeInSlideUp 0.25s ease-out forwards',
      }}
    >
      <div
        className="pdf-reader-modal"
        style={{
          width: isFullscreen ? '100vw' : '94vw',
          maxWidth: isFullscreen ? '100vw' : '1400px',
          height: isFullscreen ? '100vh' : '92vh',
          background: 'var(--bg-secondary)',
          border: isFullscreen ? 'none' : '1px solid var(--border-subtle)',
          borderRadius: isFullscreen ? 0 : 'var(--radius-xl)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Top Control Bar */}
        <div
          className="pdf-reader-header"
          style={{
            height: '60px',
            padding: '0 20px',
            background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          {/* Title & Page Citation Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: errorState ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {errorState ? <AlertTriangle size={18} color="#ef4444" /> : <FileText size={18} color="#3b82f6" />}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <h3
                  style={{
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    margin: 0,
                  }}
                  title={displayTitle}
                >
                  {displayTitle}
                </h3>

                {/* Page Badge */}
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--accent-primary)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {pageEndNumber && pageEndNumber > safePage ? `Pages ${displayPageRange}` : `Page ${safePage}`}
                </span>
              </div>

              <span className="pdf-reader-subtitle" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                AI Student Hub Built-in Reader
              </span>
            </div>
          </div>

          {/* Zoom and Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {!errorState && currentUrl && (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--social-btn-bg)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    padding: '2px',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    aria-label="Zoom out"
                    title="Zoom Out"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '5px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      minWidth: '28px',
                      minHeight: '28px',
                      justifyContent: 'center',
                    }}
                  >
                    <ZoomOut size={15} />
                  </button>

                  <span
                    className="pdf-zoom-level"
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '0 6px',
                      color: 'var(--text-primary)',
                      minWidth: '42px',
                      textAlign: 'center',
                    }}
                  >
                    {zoomLevel}%
                  </span>

                  <button
                    type="button"
                    onClick={handleZoomIn}
                    aria-label="Zoom in"
                    title="Zoom In"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '5px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      minWidth: '28px',
                      minHeight: '28px',
                      justifyContent: 'center',
                    }}
                  >
                    <ZoomIn size={15} />
                  </button>

                  <button
                    type="button"
                    className="pdf-reset-zoom-btn"
                    onClick={handleResetZoom}
                    aria-label="Reset zoom"
                    title="Reset to 100%"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '5px 6px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>

                {/* Open External in New Tab */}
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open in new window"
                  title="Open Original Document in New Tab"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--social-btn-bg)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={14} />
                  <span className="hide-on-mobile">New Tab</span>
                </a>

                {/* Download Link */}
                <a
                  href={currentUrl}
                  download={resource?.title || 'document.pdf'}
                  aria-label="Download document"
                  title="Download File"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--social-btn-bg)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                  }}
                >
                  <Download size={14} />
                </a>

                {/* Fullscreen Toggle */}
                <button
                  type="button"
                  className="pdf-fullscreen-btn"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </>
            )}

            {/* Close Button / Return to Chatbot */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close reader"
              title="Close Reader (ESC)"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Reader Document Viewport */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            background: '#1e293b',
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: errorState ? '24px' : 0,
          }}
        >
          {/* Error State View */}
          {errorState ? (
            <div
              style={{
                maxWidth: '560px',
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '32px 28px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {errorState.type === 'deleted' ? (
                  <FileQuestion size={28} color="#ef4444" />
                ) : (
                  <AlertTriangle size={28} color="#f59e0b" />
                )}
              </div>

              <div>
                <h4
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    margin: '0 0 8px 0',
                    color: 'var(--text-primary)',
                  }}
                >
                  {errorState.title}
                </h4>
                <p
                  style={{
                    fontSize: '0.88rem',
                    lineHeight: 1.5,
                    color: 'var(--text-secondary)',
                    margin: 0,
                  }}
                >
                  {errorState.message}
                </p>
              </div>

              {/* Citation Context Box */}
              <div
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '0.78rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Document:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{displayTitle}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cited Passage:</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                    {pageEndNumber && pageEndNumber > safePage ? `Pages ${displayPageRange}` : `Page ${safePage}`}
                  </span>
                </div>
                {resource?.id && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Resource ID:</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                      {resource.id}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons: Return to Chatbot */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', width: '100%' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>Return to Chatbot</span>
                </button>

                {currentUrl && (
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '10px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={15} />
                    <span>Open Link</span>
                  </a>
                )}
              </div>
            </div>
          ) : isResolving ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={28} className="animate-spin" color="var(--accent-primary)" />
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Connecting to study library and resolving PDF...
              </span>
            </div>
          ) : currentUrl ? (
            /* Iframe Viewport */
            <div
              style={{
                width: `${zoomLevel}%`,
                height: '100%',
                minWidth: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'width 0.2s ease',
              }}
            >
              <iframe
                src={viewerUrl}
                title={displayTitle}
                onLoad={() => setIframeLoaded(true)}
                onError={() => {
                  setErrorState({
                    type: 'load_error',
                    title: 'Unable to Preview PDF Inline',
                    message: 'Your browser prevented embedding this PDF directly. You can use the link below to open or download the document.',
                  });
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: '#ffffff',
                }}
              />
            </div>
          ) : null}

          {/* Fallback Overlay if embed has restrictions */}
          {!errorState && !iframeLoaded && currentUrl && !isResolving && (
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(15, 23, 42, 0.9)',
                color: 'var(--text-secondary)',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                pointerEvents: 'auto',
              }}
            >
              <span>If your browser or host blocks inline PDF preview:</span>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                Click here to open directly
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
