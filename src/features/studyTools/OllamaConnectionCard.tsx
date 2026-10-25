import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Play,
  XCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Settings2,
  Sparkles,
  Terminal,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import {
  checkOllamaConnection,
  generateCompletion,
  getOllamaBaseUrl,
  setOllamaBaseUrl,
  getSelectedModel,
  setSelectedModel,
  DEFAULT_PROXY_ENDPOINT,
  DEFAULT_DIRECT_ENDPOINT,
} from '../../services/ollamaService';
import type { OllamaModel, OllamaConnectionStatus, OllamaErrorInfo } from '../../types/ollama';

const SAMPLE_TEST_PROMPTS = [
  'Explain the difference between TCP and UDP in 2 concise sentences.',
  'What is 3NF (Third Normal Form) in Database Systems? Give a 1-sentence definition.',
  'Write a short revision mnemonic for the 7 layers of the OSI Model.',
];

export const OllamaConnectionCard: React.FC = () => {
  // Expansion state: open by default if disconnected so user can configure, or toggleable
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

  // Connection State
  const [endpoint, setEndpoint] = useState<string>(getOllamaBaseUrl());
  const [connectionStatus, setConnectionStatus] = useState<OllamaConnectionStatus>('checking');
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [activeModel, setActiveModel] = useState<string>(getSelectedModel());
  const [serverVersion, setServerVersion] = useState<string | undefined>(undefined);
  const [latencyMs, setLatencyMs] = useState<number | undefined>(undefined);
  const [connectionError, setConnectionError] = useState<OllamaErrorInfo | null>(null);

  // Testing & Generation State
  const [testPrompt, setTestPrompt] = useState<string>(SAMPLE_TEST_PROMPTS[0]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedText, setGeneratedText] = useState<string>('');
  const [generationDuration, setGenerationDuration] = useState<number | null>(null);
  const [generationEvalCount, setGenerationEvalCount] = useState<number | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Run connection test
  const handleTestConnection = async (targetEndpoint?: string) => {
    const ep = targetEndpoint || endpoint;
    setConnectionStatus('checking');
    setConnectionError(null);

    const result = await checkOllamaConnection(ep);

    if (result.connected) {
      setConnectionStatus('connected');
      setAvailableModels(result.models);
      setServerVersion(result.version);
      setLatencyMs(result.latencyMs);

      // Auto-select model if current selection is invalid or empty
      if (result.models.length > 0) {
        const stored = getSelectedModel();
        const exists = result.models.some((m) => m.name === stored);
        const chosen = exists ? stored : result.models[0].name;
        setActiveModel(chosen);
        setSelectedModel(chosen);
      } else {
        setActiveModel('');
      }

      if (result.error) {
        setConnectionError(result.error);
      }
    } else {
      setConnectionStatus('disconnected');
      setAvailableModels([]);
      setConnectionError(result.error || null);
    }
  };

  // Initial connection check on mount
  useEffect(() => {
    handleTestConnection();
  }, []);

  const handleEndpointChange = (newEndpoint: string) => {
    setEndpoint(newEndpoint);
    setOllamaBaseUrl(newEndpoint);
    handleTestConnection(newEndpoint);
  };

  const handleModelSelect = (modelName: string) => {
    setActiveModel(modelName);
    setSelectedModel(modelName);
  };

  // Send test prompt
  const handleSendTestPrompt = async () => {
    if (!activeModel) {
      setGenerationError('Please select or pull an Ollama model first.');
      return;
    }
    if (!testPrompt.trim()) {
      setGenerationError('Please enter a test prompt.');
      return;
    }

    setIsGenerating(true);
    setGeneratedText('');
    setGenerationError(null);
    setGenerationDuration(null);
    setGenerationEvalCount(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await generateCompletion({
        model: activeModel,
        prompt: testPrompt,
        customBaseUrl: endpoint,
        abortSignal: abortController.signal,
        temperature: 0.7,
      });

      setGeneratedText(res.text);
      setGenerationDuration(res.durationMs);
      setGenerationEvalCount(res.evalCount || null);
    } catch (err: unknown) {
      const errorObj = err as Error & { info?: OllamaErrorInfo };
      setGenerationError(errorObj.info?.message || errorObj.message || 'Generation failed.');
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      setGenerationError('Test generation was cancelled.');
    }
  };

  const handleCopyText = async () => {
    if (!generatedText) return;
    await navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        marginBottom: '20px',
        overflow: 'hidden',
        background: 'var(--bg-card)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header bar / Compact status */}
      <div
        style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          background: 'var(--bg-tertiary)',
          borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-primary-subtle)',
              color: 'var(--accent-primary)',
            }}
          >
            <Cpu size={16} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Ollama Local AI Engine
              </span>

              {/* Status Badge */}
              {connectionStatus === 'checking' && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <RefreshCw size={10} className="animate-spin" /> Checking...
                </span>
              )}

              {connectionStatus === 'connected' && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-success-subtle)',
                    color: 'var(--color-success)',
                    border: '1px solid var(--color-success-border)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <CheckCircle2 size={11} /> Connected ({activeModel || `${availableModels.length} models`})
                  {serverVersion && (
                    <span style={{ opacity: 0.8, fontWeight: 500 }}>&bull; v{serverVersion}</span>
                  )}
                  {latencyMs !== undefined && (
                    <span style={{ opacity: 0.8, fontWeight: 500 }}>&bull; {latencyMs}ms</span>
                  )}
                </span>
              )}

              {connectionStatus === 'disconnected' && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-danger-subtle)',
                    color: 'var(--color-danger)',
                    border: '1px solid var(--color-danger-border)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <XCircle size={11} /> Disconnected
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              100% Free & Private &bull; Running locally on your hardware
            </div>
          </div>
        </div>

        {/* Action Buttons in header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleTestConnection()}
            disabled={connectionStatus === 'checking'}
            style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            title="Refresh Ollama connection and models"
          >
            <RefreshCw size={12} className={connectionStatus === 'checking' ? 'animate-spin' : ''} />
            <span>{connectionStatus === 'checking' ? 'Testing...' : 'Test Connection'}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <span>{isExpanded ? 'Hide Test Panel' : 'Open Test Panel'}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </Button>
        </div>
      </div>

      {/* Expanded Interactive Test Interface */}
      {isExpanded && (
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Hardware Specs & Recommended Models Callout */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Zap size={14} color="var(--color-warning)" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Detected Hardware: HP Victus (16 GB RAM • NVIDIA RTX 3050 4GB VRAM)
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Recommended lightweight models that fit completely into your 4GB GPU for maximum speed:
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600, marginLeft: '6px' }}>
                  llama3.2:3b (~2.0 GB)
                </span>{' '}
                or{' '}
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                  qwen2.5:3b (~1.9 GB)
                </span>
                .
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'underline',
              }}
            >
              <Settings2 size={12} />
              <span>{showAdvancedSettings ? 'Hide Endpoint Settings' : 'Endpoint Settings'}</span>
            </button>
          </div>

          {/* Advanced Endpoint Settings (Vite Proxy vs Direct) */}
          {showAdvancedSettings && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Ollama API Base URL Configuration
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleEndpointChange(DEFAULT_PROXY_ENDPOINT)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    background: endpoint === DEFAULT_PROXY_ENDPOINT ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: endpoint === DEFAULT_PROXY_ENDPOINT ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  Vite Dev Proxy: /api/ollama (Recommended, Zero CORS)
                </button>

                <button
                  type="button"
                  onClick={() => handleEndpointChange(DEFAULT_DIRECT_ENDPOINT)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    background: endpoint === DEFAULT_DIRECT_ENDPOINT ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: endpoint === DEFAULT_DIRECT_ENDPOINT ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  Direct: http://localhost:11434
                </button>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Active Base URL: <code style={{ color: 'var(--accent-cyan)' }}>{endpoint}</code>
              </div>
            </div>
          )}

          {/* Connection Error / Setup Instructions */}
          {connectionError && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-danger-subtle)',
                border: '1px solid var(--color-danger-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)', fontWeight: 700, fontSize: '0.85rem' }}>
                <AlertCircle size={16} />
                <span>{connectionError.message}</span>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                <strong>How to fix:</strong> {connectionError.suggestion}
              </div>

              {connectionError.code === 'NOT_INSTALLED_OR_RUNNING' && (
                <div style={{ marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <a
                    href="https://ollama.com/download"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-card)',
                      color: 'var(--accent-primary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <ExternalLink size={12} /> Download Ollama for Windows
                  </a>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      background: '#0d1117',
                      color: '#58a6ff',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <Terminal size={12} /> ollama run llama3.2:3b
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Model Selector & Available Models */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: '6px',
                  letterSpacing: '0.04em',
                }}
              >
                Selected Local LLM Model
              </label>

              {availableModels.length > 0 ? (
                <select
                  value={activeModel}
                  onChange={(e) => handleModelSelect(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {availableModels.map((m) => {
                    const sizeMb = (m.size / (1024 * 1024 * 1024)).toFixed(1);
                    const paramSize = m.details?.parameter_size ? ` (${m.details.parameter_size})` : '';
                    return (
                      <option key={m.name} value={m.name}>
                        {m.name} {paramSize} &bull; {sizeMb} GB
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  {connectionStatus === 'connected'
                    ? 'No models downloaded yet. Run "ollama run llama3.2:3b" in terminal.'
                    : 'Ollama disconnected. Start Ollama to see available models.'}
                </div>
              )}
            </div>

            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: '6px',
                  letterSpacing: '0.04em',
                }}
              >
                Sample Test Prompts
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {SAMPLE_TEST_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTestPrompt(prompt)}
                    style={{
                      fontSize: '0.72rem',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: testPrompt === prompt ? 'var(--accent-primary-subtle)' : 'var(--bg-secondary)',
                      color: testPrompt === prompt ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      border: testPrompt === prompt ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    Prompt #{idx + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Test Prompt Input */}
          <div>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '6px',
                letterSpacing: '0.04em',
              }}
            >
              Test Prompt
            </label>
            <textarea
              rows={2}
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Enter a prompt to test your local Ollama model..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendTestPrompt}
                disabled={isGenerating || connectionStatus !== 'connected' || !activeModel}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Play size={13} /> Send Test Prompt
                  </>
                )}
              </Button>

              {isGenerating && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelGeneration}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}
                >
                  <XCircle size={13} color="var(--color-danger)" /> Cancel
                </Button>
              )}
            </div>

            {generationDuration !== null && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                <span>Response Time: <strong style={{ color: 'var(--text-primary)' }}>{(generationDuration / 1000).toFixed(2)}s</strong></span>
                {generationEvalCount !== null && (
                  <>
                    <span>&bull;</span>
                    <span>Tokens: <strong style={{ color: 'var(--text-primary)' }}>{generationEvalCount}</strong></span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Generation Error */}
          {generationError && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-danger-subtle)',
                border: '1px solid var(--color-danger-border)',
                color: 'var(--color-danger)',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{generationError}</span>
            </div>
          )}

          {/* Generated Response Box */}
          {generatedText && (
            <div
              style={{
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-tertiary)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  <Sparkles size={13} color="var(--accent-primary)" />
                  <span>Response from {activeModel}:</span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyText}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                  }}
                  title="Copy response to clipboard"
                >
                  {copied ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <div
                style={{
                  padding: '14px 16px',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {generatedText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
