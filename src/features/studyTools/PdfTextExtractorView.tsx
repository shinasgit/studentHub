import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  FileText,
  Sparkles,
  Copy,
  CheckCircle2,
  AlertCircle,
  Download,
  Search,
  Upload,
  RefreshCw,
  X,
  Check,
  ScanText,
  FileCheck2,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import type { Subject } from '../../types/subject';
import type { Module } from '../../types/module';
import type { StudyMaterial } from '../../types/studyTools';
import {
  extractTextFromPdf,
  resolvePdfArrayBuffer,
  type PdfExtractionResult,
  type PdfExtractionProgress,
} from '../../services/pdfExtractionService';

interface PdfTextExtractorViewProps {
  user: User;
  subjects: Subject[];
  modules: Module[];
  selectedSubjectId: string;
  selectedModuleId: string;
  materials?: StudyMaterial[];
  loadingMaterials?: boolean;
  preselectedMaterialId?: string | null;
}

export const PdfTextExtractorView: React.FC<PdfTextExtractorViewProps> = ({
  user: _user,
  subjects,
  modules,
  selectedSubjectId,
  selectedModuleId,
  materials = [],
  loadingMaterials = false,
  preselectedMaterialId,
}) => {
  // Available PDFs in currently selected scope
  const availablePdfs = useMemo(() => {
    return materials.filter(
      (m) => m.type === 'PDF' || m.name.toLowerCase().endsWith('.pdf')
    );
  }, [materials]);

  // Selected PDF state
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Settings
  const [enableOcr, setEnableOcr] = useState<boolean>(true);

  // Extraction process state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressState, setProgressState] = useState<PdfExtractionProgress | null>(null);
  const [result, setResult] = useState<PdfExtractionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Result display options
  const [viewMode, setViewMode] = useState<'combined' | 'pages'>('combined');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [copiedPage, setCopiedPage] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedModule = modules.find((m) => m.id === selectedModuleId);

  // Auto-select first PDF or preselected PDF when available
  useEffect(() => {
    if (preselectedMaterialId && availablePdfs.some((p) => p.id === preselectedMaterialId)) {
      setSelectedMaterialId(preselectedMaterialId);
      setUploadedFile(null);
    } else if (availablePdfs.length > 0 && !selectedMaterialId && !uploadedFile) {
      setSelectedMaterialId(availablePdfs[0].id);
    }
  }, [availablePdfs, preselectedMaterialId, selectedMaterialId, uploadedFile]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
  };

  const handleSelectMaterial = (id: string) => {
    setSelectedMaterialId(id);
    setUploadedFile(null);
    setResult(null);
    setErrorMsg(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setErrorMsg('Please select a valid PDF file.');
        return;
      }
      setUploadedFile(file);
      setSelectedMaterialId('');
      setResult(null);
      setErrorMsg(null);
    }
  };

  const handleStartExtraction = async () => {
    setErrorMsg(null);

    // 1. Determine PDF source
    let sourceBuffer: ArrayBuffer;
    let fileName = 'document.pdf';

    setIsProcessing(true);
    setProgressState({
      stage: 'loading',
      currentPage: 0,
      totalPages: 0,
      statusMessage: 'Preparing PDF for extraction...',
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      if (uploadedFile) {
        fileName = uploadedFile.name;
        sourceBuffer = await uploadedFile.arrayBuffer();
      } else {
        const targetMat = availablePdfs.find((m) => m.id === selectedMaterialId);
        if (!targetMat) {
          throw new Error('Please select a PDF document to extract.');
        }
        fileName = targetMat.name;
        const resolved = await resolvePdfArrayBuffer({
          storageKey: targetMat.storageKey,
          url: targetMat.url,
        });
        sourceBuffer = resolved.buffer;
      }

      // 2. Perform Extraction
      const extractionResult = await extractTextFromPdf(sourceBuffer, fileName, {
        enableOcr,
        onProgress: (p) => setProgressState(p),
        abortSignal: abortController.signal,
      });

      setResult(extractionResult);
      triggerToast(`Text extracted successfully (${extractionResult.totalCharacters.toLocaleString()} characters)!`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      if (abortController.signal.aborted) {
        setErrorMsg('Text extraction was cancelled.');
      } else {
        setErrorMsg(error.message || 'Failed to extract text from PDF.');
      }
    } finally {
      setIsProcessing(false);
      setProgressState(null);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCopyAll = async () => {
    if (!result || !result.text) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopiedAll(true);
      triggerToast('Full extracted text copied to clipboard!');
      setTimeout(() => setCopiedAll(false), 2500);
    } catch {
      triggerToast('Failed to copy to clipboard.');
    }
  };

  const handleCopyPage = async (pageNumber: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPage(pageNumber);
      triggerToast(`Page ${pageNumber} text copied!`);
      setTimeout(() => setCopiedPage(null), 2500);
    } catch {
      triggerToast('Failed to copy to clipboard.');
    }
  };

  const handleDownloadTxt = () => {
    if (!result || !result.text) return;
    const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.fileName.replace(/\.[^/.]+$/, '')}_extracted.txt`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('Extracted text downloaded as .txt');
  };

  // Filtered pages for search
  const filteredPages = useMemo(() => {
    if (!result || !searchTerm.trim()) return result?.pages || [];
    const term = searchTerm.toLowerCase();
    return result.pages.filter((p) => p.text.toLowerCase().includes(term));
  }, [result, searchTerm]);

  return (
    <div className="pdf-extractor-view animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast */}
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
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeInSlideUp 0.2s ease-out',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <CheckCircle2 size={16} color="var(--color-success)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem' }}>{toastMsg}</span>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="auth-alert auth-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Scope Banner & PDF Selection Card */}
      <div
        className="glass-panel"
        style={{
          padding: '18px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <ScanText size={18} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                PDF Text Extractor & OCR
              </h2>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
              Extract selectable text from lecture PDFs or use Tesseract OCR on scanned documents.
            </p>
          </div>

          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              background: 'var(--bg-tertiary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontWeight: 600 }}>Active Scope: </span>
            {selectedSubject ? selectedSubject.name : 'All Subjects'}
            {selectedModule ? ` • Module #${selectedModule.order}` : ' • Entire Subject'}
          </div>
        </div>

        {/* PDF Document Selector */}
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
            Select PDF from Course Scope ({availablePdfs.length} available)
          </label>

          {loadingMaterials ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '8px 0' }}>
              Loading PDF materials from selected scope...
            </div>
          ) : availablePdfs.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '8px' }}>
              {availablePdfs.map((pdf) => {
                const isSelected = selectedMaterialId === pdf.id && !uploadedFile;
                return (
                  <div
                    key={pdf.id}
                    onClick={() => handleSelectMaterial(pdf.id)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--accent-primary-subtle)' : 'var(--bg-card)',
                      border: isSelected ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <FileText size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {pdf.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {pdf.size || 'PDF'} {pdf.moduleName ? `• ${pdf.moduleName}` : ''}
                      </div>
                    </div>
                    {isSelected && <Check size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '4px 0' }}>
              No PDFs attached to this {selectedModuleId === 'all' ? 'subject' : 'module'} yet.
            </div>
          )}

          {/* Or upload from computer */}
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Or choose a local PDF:</span>
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '5px 12px' }}
            >
              <Upload size={13} />
              <span>{uploadedFile ? `Loaded: ${uploadedFile.name}` : 'Browse Local PDF'}</span>
            </Button>
            {uploadedFile && (
              <button
                type="button"
                onClick={() => {
                  setUploadedFile(null);
                  if (availablePdfs.length > 0) setSelectedMaterialId(availablePdfs[0].id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Clear local file
              </button>
            )}
          </div>
        </div>

        {/* Action Controls & Options */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {/* OCR Checkbox */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={enableOcr}
              onChange={(e) => setEnableOcr(e.target.checked)}
              disabled={isProcessing}
              style={{ accentColor: 'var(--accent-primary)', width: '15px', height: '15px' }}
            />
            <span>Enable OCR fallback for scanned pages (Tesseract.js)</span>
          </label>

          {/* Extraction button or Cancel button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isProcessing ? (
              <Button variant="secondary" size="sm" type="button" onClick={handleCancel}>
                <X size={14} /> Cancel Extraction
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                type="button"
                onClick={handleStartExtraction}
                disabled={(!selectedMaterialId && !uploadedFile) || isProcessing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={14} />
                <span>Extract PDF Text</span>
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar & Status Message */}
        {isProcessing && progressState && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>{progressState.statusMessage}</span>
              {progressState.ocrProgressPercent !== undefined && (
                <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {progressState.ocrProgressPercent}%
                </span>
              )}
            </div>
            <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'var(--border-subtle)', overflow: 'hidden' }}>
              <div
                style={{
                  width:
                    progressState.stage === 'running_ocr'
                      ? `${progressState.ocrProgressPercent || 50}%`
                      : progressState.totalPages > 0
                      ? `${(progressState.currentPage / progressState.totalPages) * 100}%`
                      : '30%',
                  height: '100%',
                  background: 'var(--accent-primary)',
                  transition: 'width 0.25s ease',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Extracted Text Result Card */}
      {result && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Header of results */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <FileCheck2 size={18} color="var(--color-success)" />
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {result.fileName}
                </span>

                {/* Status Badges */}
                {result.isScanned ? (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: 'var(--accent-warning)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    ⚡ Scanned PDF (OCR Processed)
                  </span>
                ) : result.hasMixedContent ? (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--accent-primary)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    ★ Mixed Content (Text & OCR)
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--color-success)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    ✓ Selectable Text Extracted
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span>
                  <strong style={{ color: 'var(--text-primary)' }}>{result.pageCount}</strong> {result.pageCount === 1 ? 'page' : 'pages'}
                </span>
                <span>&bull;</span>
                <span>
                  <strong style={{ color: 'var(--text-primary)' }}>{result.totalCharacters.toLocaleString()}</strong> characters
                </span>
                <span>&bull;</span>
                <span>~{Math.round(result.totalCharacters / 5).toLocaleString()} words</span>
                {result.durationMs && (
                  <>
                    <span>&bull;</span>
                    <span>Processed in {(result.durationMs / 1000).toFixed(1)}s</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="sm"
                type="button"
                onClick={handleCopyAll}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {copiedAll ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedAll ? 'Copied!' : 'Copy All Text'}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={handleDownloadTxt}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Download extracted text as .txt"
              >
                <Download size={14} />
                <span>Export .txt</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={handleStartExtraction}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Re-run text extraction"
              >
                <RefreshCw size={13} />
                <span>Re-extract</span>
              </Button>
            </div>
          </div>

          {/* OCR accuracy disclaimer notice if OCR was used */}
          {result.ocrPerformed && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <strong>Notice:</strong> Optical Character Recognition (OCR) was applied on scanned pages. Recognition accuracy depends on scan resolution and font clarity, and may contain minor recognition artifacts.
            </div>
          )}

          {/* Empty text notice */}
          {result.totalCharacters === 0 && (
            <div
              style={{
                padding: '18px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
              }}
            >
              No readable text or characters found in this PDF. If this is an image-only scan, ensure &quot;Enable OCR&quot; is checked and try re-extracting.
            </div>
          )}

          {/* Viewer Controls: Mode toggle + Search */}
          {result.totalCharacters > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  marginBottom: '12px',
                }}
              >
                {/* View Mode Buttons */}
                <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    onClick={() => setViewMode('combined')}
                    style={{
                      background: viewMode === 'combined' ? 'var(--bg-card)' : 'transparent',
                      border: 'none',
                      color: viewMode === 'combined' ? 'var(--text-primary)' : 'var(--text-muted)',
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    Combined Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('pages')}
                    style={{
                      background: viewMode === 'pages' ? 'var(--bg-card)' : 'transparent',
                      border: 'none',
                      color: viewMode === 'pages' ? 'var(--text-primary)' : 'var(--text-muted)',
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    Page-by-Page View ({result.pages.length})
                  </button>
                </div>

                {/* Filter within text */}
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search in extracted text..."
                    className="input-field"
                    style={{
                      paddingLeft: '32px',
                      paddingRight: searchTerm ? '28px' : '10px',
                      height: '32px',
                      fontSize: '0.78rem',
                    }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* View Mode 1: Combined Document */}
              {viewMode === 'combined' && (
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 20px',
                    maxHeight: '520px',
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {result.text}
                </div>
              )}

              {/* View Mode 2: Page by Page */}
              {viewMode === 'pages' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '560px', overflowY: 'auto' }}>
                  {filteredPages.map((page) => (
                    <div
                      key={page.pageNumber}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px 18px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                          borderBottom: '1px solid var(--border-subtle)',
                          paddingBottom: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Page {page.pageNumber}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              background: page.extractionMethod === 'ocr' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: page.extractionMethod === 'ocr' ? 'var(--accent-warning)' : 'var(--color-success)',
                            }}
                          >
                            {page.extractionMethod === 'ocr' ? 'OCR' : 'Text'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {page.charCount.toLocaleString()} chars
                          </span>
                        </div>

                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          onClick={() => handleCopyPage(page.pageNumber, page.text)}
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        >
                          {copiedPage === page.pageNumber ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedPage === page.pageNumber ? 'Copied' : 'Copy Page'}</span>
                        </Button>
                      </div>

                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.8125rem',
                          lineHeight: 1.55,
                          color: 'var(--text-primary)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '220px',
                          overflowY: 'auto',
                        }}
                      >
                        {page.text || <em style={{ color: 'var(--text-muted)' }}>No text on this page.</em>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
