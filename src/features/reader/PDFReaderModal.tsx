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
} from 'lucide-react';
import type { StudyResource } from '../../types/resource';
import { getFileObjectUrl } from '../../services/fileStorageService';

interface PDFReaderModalProps {
  isOpen: boolean;
  resource: StudyResource | null;
  onClose: () => void;
}

export const PDFReaderModal: React.FC<PDFReaderModalProps> = ({
  isOpen,
  resource,
  onClose,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [activeUrl, setActiveUrl] = useState<string>(resource?.url || '');

  useEffect(() => {
    let isCancelled = false;
    const resolveUrl = async () => {
      if (resource?.fileStorageKey) {
        const freshUrl = await getFileObjectUrl(resource.fileStorageKey);
        if (freshUrl && !isCancelled) {
          setActiveUrl(freshUrl);
          return;
        }
      }
      if (resource?.url && !isCancelled) {
        setActiveUrl(resource.url);
      }
    };
    if (resource) {
      resolveUrl();
    }
    return () => {
      isCancelled = true;
    };
  }, [resource]);

  if (!isOpen || !resource) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 15, 200));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 15, 60));
  const handleResetZoom = () => setZoomLevel(100);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Construct viewer URL
  const currentUrl = activeUrl || resource.url;
  const viewerUrl = currentUrl.includes('#')
    ? currentUrl
    : `${currentUrl}#view=FitH&toolbar=1&navpanes=1`;

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
          {/* Title & Badge */}
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
              <FileText size={18} color="#ef4444" />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <h3
                style={{
                  fontSize: '0.98rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {resource.title}
              </h3>
              <span className="pdf-reader-subtitle" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                AI Student Hub Built-in Reader
              </span>
            </div>
          </div>

          {/* Zoom and Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
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

            {/* Open External / Download */}
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
              download={resource.title}
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

            {/* Close Button */}
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
          }}
        >
          {/* Iframe Viewport */}
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
              title={resource.title}
              onLoad={() => setIframeLoaded(true)}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#ffffff',
              }}
            />
          </div>

          {/* Fallback Overlay if embed has restrictions */}
          {!iframeLoaded && (
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
                href={resource.url}
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
