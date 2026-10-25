// Ollama Service for Local LLM Communication in AI Student Hub
// 100% Free, Zero Billing, Offline / Local Privacy

import type {
  OllamaModel,
  OllamaTagsResponse,
  OllamaVersionResponse,
  OllamaGenerateRequest,
  OllamaGenerateResponse,
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaChatMessage,
  OllamaConnectionResult,
  OllamaErrorInfo,
} from '../types/ollama';

// Local storage keys for user preferences
export const STORAGE_KEY_ENDPOINT = 'ai_student_hub_ollama_endpoint';
export const STORAGE_KEY_MODEL = 'ai_student_hub_ollama_model';

// Default endpoint options:
// 1. '/api/ollama' uses the Vite local dev proxy to eliminate browser CORS restrictions completely
// 2. 'http://localhost:11434' connects directly to Ollama's default port (requires OLLAMA_ORIGINS="*")
export const DEFAULT_PROXY_ENDPOINT = '/api/ollama';
export const DEFAULT_DIRECT_ENDPOINT = 'http://localhost:11434';

/**
 * Retrieve the active Ollama API base URL.
 * Defaults to the Vite dev proxy for seamless zero-CORS communication.
 */
export const getOllamaBaseUrl = (): string => {
  if (typeof window === 'undefined') return DEFAULT_DIRECT_ENDPOINT;
  return localStorage.getItem(STORAGE_KEY_ENDPOINT) || DEFAULT_PROXY_ENDPOINT;
};

/**
 * Update the active Ollama API base URL.
 */
export const setOllamaBaseUrl = (url: string): void => {
  if (typeof window === 'undefined') return;
  const clean = url.trim().replace(/\/+$/, '');
  localStorage.setItem(STORAGE_KEY_ENDPOINT, clean || DEFAULT_PROXY_ENDPOINT);
};

/**
 * Retrieve the selected local model name from localStorage.
 */
export const getSelectedModel = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_MODEL) || '';
};

/**
 * Store the selected local model name in localStorage.
 */
export const setSelectedModel = (modelName: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_MODEL, modelName.trim());
};

/**
 * Classify raw network and API errors into actionable, student-friendly diagnosis.
 */
export const parseOllamaError = (
  error: unknown,
  requestedModel?: string,
  endpoint?: string
): OllamaErrorInfo => {
  const currentEndpoint = endpoint || getOllamaBaseUrl();
  const rawMsg = error instanceof Error ? error.message : String(error);

  // 1. User or timeout cancellation
  if (
    rawMsg.includes('abort') ||
    rawMsg.includes('AbortError') ||
    rawMsg.includes('cancelled')
  ) {
    return {
      code: 'TIMEOUT_OR_CANCELLED',
      message: 'Request was cancelled or timed out.',
      suggestion: 'You can retry the generation or choose a smaller model.',
      details: rawMsg,
    };
  }

  // 2. CORS Error detection (typically happens when using direct http://localhost:11434 without proxy)
  if (
    currentEndpoint.startsWith('http') &&
    (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError'))
  ) {
    return {
      code: 'CORS_ERROR',
      message: `Cannot reach Ollama at ${currentEndpoint}. This is usually because Ollama is not running, or browser CORS blocked the direct connection.`,
      suggestion:
        'Try switching the endpoint to the Vite Dev Proxy ("/api/ollama") in the connection settings, or start Ollama with OLLAMA_ORIGINS="*" in Windows environment variables.',
      details: rawMsg,
    };
  }

  // 3. Ollama not installed or not running
  if (
    rawMsg.includes('Failed to fetch') ||
    rawMsg.includes('ECONNREFUSED') ||
    rawMsg.includes('connection refused')
  ) {
    return {
      code: 'NOT_INSTALLED_OR_RUNNING',
      message: 'Ollama is not running or not reachable on your computer.',
      suggestion:
        'Make sure Ollama is installed from https://ollama.com/download. If installed, start it by running "ollama serve" in PowerShell or launching Ollama from the Windows Start menu.',
      details: rawMsg,
    };
  }

  // 4. Model not found (404)
  if (rawMsg.includes('not found') || rawMsg.includes('404')) {
    const model = requestedModel || 'the selected model';
    return {
      code: 'MODEL_NOT_FOUND',
      message: `The model "${model}" is not installed in your local Ollama library.`,
      suggestion: `Run "ollama pull ${model}" or "ollama run ${model}" in your terminal to download it.`,
      details: rawMsg,
    };
  }

  // 5. Out of Memory (OOM)
  if (
    rawMsg.toLowerCase().includes('memory') ||
    rawMsg.toLowerCase().includes('oom') ||
    rawMsg.toLowerCase().includes('cuda') ||
    rawMsg.toLowerCase().includes('allocate')
  ) {
    return {
      code: 'OUT_OF_MEMORY',
      message: 'Insufficient GPU VRAM or system RAM to load this model.',
      suggestion:
        'For a 4GB GPU / 16GB RAM laptop, use smaller 3B models like "llama3.2:3b" or "qwen2.5:3b" instead of 70B/14B models.',
      details: rawMsg,
    };
  }

  // 6. Empty response
  if (rawMsg.includes('empty response')) {
    return {
      code: 'EMPTY_RESPONSE',
      message: 'The model returned an empty response.',
      suggestion: 'Check if the model finished processing or try a different prompt.',
      details: rawMsg,
    };
  }

  return {
    code: 'UNKNOWN',
    message: rawMsg || 'An unknown error occurred while communicating with Ollama.',
    suggestion: 'Verify that Ollama is running and test the connection again.',
    details: rawMsg,
  };
};

/**
 * Check whether Ollama is reachable and fetch all locally downloaded models.
 */
export const checkOllamaConnection = async (
  customBaseUrl?: string,
  abortSignal?: AbortSignal
): Promise<OllamaConnectionResult> => {
  const baseUrl = (customBaseUrl || getOllamaBaseUrl()).replace(/\/+$/, '');
  const startTime = performance.now();

  try {
    // 1. Fetch available models from /api/tags
    const tagsResponse = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: abortSignal,
    });

    if (!tagsResponse.ok) {
      const errText = await tagsResponse.text().catch(() => '');
      throw new Error(`Ollama returned status ${tagsResponse.status}: ${errText || tagsResponse.statusText}`);
    }

    const tagsData = (await tagsResponse.json()) as OllamaTagsResponse;
    const latencyMs = Math.round(performance.now() - startTime);
    const models = Array.isArray(tagsData.models) ? tagsData.models : [];

    // 2. Attempt version check (optional)
    let version: string | undefined;
    try {
      const verRes = await fetch(`${baseUrl}/api/version`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: abortSignal,
      });
      if (verRes.ok) {
        const verData = (await verRes.json()) as OllamaVersionResponse;
        version = verData.version;
      }
    } catch {
      // Version endpoint is optional
    }

    if (models.length === 0) {
      return {
        connected: true,
        version,
        models: [],
        latencyMs,
        error: {
          code: 'NO_MODELS',
          message: 'Ollama is running, but no models are currently downloaded.',
          suggestion: 'Run "ollama run llama3.2:3b" in your PowerShell terminal to download a fast 3B model.',
        },
      };
    }

    return {
      connected: true,
      version,
      models,
      latencyMs,
      error: null,
    };
  } catch (err: unknown) {
    const errorInfo = parseOllamaError(err, undefined, baseUrl);
    return {
      connected: false,
      models: [],
      error: errorInfo,
    };
  }
};

/**
 * Retrieve the list of downloaded local models.
 */
export const getAvailableModels = async (
  customBaseUrl?: string,
  abortSignal?: AbortSignal
): Promise<OllamaModel[]> => {
  const res = await checkOllamaConnection(customBaseUrl, abortSignal);
  return res.models;
};

export interface GenerateCompletionOptions {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  abortSignal?: AbortSignal;
  customBaseUrl?: string;
}

export interface GenerateCompletionResult {
  text: string;
  model: string;
  durationMs: number;
  promptEvalCount?: number;
  evalCount?: number;
  evalDurationMs?: number;
}

/**
 * Send a prompt to the selected local Ollama model and return the generated completion.
 */
export const generateCompletion = async (
  options: GenerateCompletionOptions
): Promise<GenerateCompletionResult> => {
  const { model, prompt, system, temperature = 0.7, maxTokens, abortSignal, customBaseUrl } = options;

  if (!model || !model.trim()) {
    throw new Error('Please select an available Ollama model before generating.');
  }

  if (!prompt || !prompt.trim()) {
    throw new Error('Please enter a prompt to generate text.');
  }

  const baseUrl = (customBaseUrl || getOllamaBaseUrl()).replace(/\/+$/, '');
  const startTime = performance.now();

  const payload: OllamaGenerateRequest = {
    model: model.trim(),
    prompt: prompt.trim(),
    stream: false,
    system: system?.trim(),
    options: {
      temperature,
      ...(maxTokens ? { num_predict: maxTokens } : {}),
    },
  };

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Ollama API error (${response.status}): ${errBody || response.statusText}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    const durationMs = Math.round(performance.now() - startTime);

    if (!data.response && data.done) {
      throw new Error('The model completed but returned an empty response.');
    }

    return {
      text: data.response || '',
      model: data.model,
      durationMs,
      promptEvalCount: data.prompt_eval_count,
      evalCount: data.eval_count,
      evalDurationMs: data.eval_duration ? Math.round(data.eval_duration / 1_000_000) : undefined,
    };
  } catch (err: unknown) {
    const errorInfo = parseOllamaError(err, model, baseUrl);
    const enrichedError = new Error(errorInfo.message);
    (enrichedError as unknown as { info: OllamaErrorInfo }).info = errorInfo;
    throw enrichedError;
  }
};

/**
 * Send a chat message list to Ollama's /api/chat endpoint.
 */
export const generateChat = async (
  options: {
    model: string;
    messages: OllamaChatMessage[];
    temperature?: number;
    abortSignal?: AbortSignal;
    customBaseUrl?: string;
  }
): Promise<{ text: string; model: string; durationMs: number }> => {
  const { model, messages, temperature = 0.7, abortSignal, customBaseUrl } = options;
  const baseUrl = (customBaseUrl || getOllamaBaseUrl()).replace(/\/+$/, '');
  const startTime = performance.now();

  const payload: OllamaChatRequest = {
    model: model.trim(),
    messages,
    stream: false,
    options: { temperature },
  };

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Ollama chat error (${response.status}): ${errBody || response.statusText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const durationMs = Math.round(performance.now() - startTime);

    return {
      text: data.message?.content || '',
      model: data.model,
      durationMs,
    };
  } catch (err: unknown) {
    const errorInfo = parseOllamaError(err, model, baseUrl);
    const enrichedError = new Error(errorInfo.message);
    (enrichedError as unknown as { info: OllamaErrorInfo }).info = errorInfo;
    throw enrichedError;
  }
};
