// Ollama Types for AI Student Hub Local LLM Integration

export interface OllamaModelDetails {
  parent_model?: string;
  format?: string;
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: OllamaModelDetails;
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

export interface OllamaVersionResponse {
  version: string;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
    top_k?: number;
    stop?: string[];
  };
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number; // nanoseconds
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaChatMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

export type OllamaConnectionStatus = 'checking' | 'connected' | 'disconnected' | 'error';

export type OllamaErrorCode =
  | 'NOT_INSTALLED_OR_RUNNING'
  | 'NO_MODELS'
  | 'MODEL_NOT_FOUND'
  | 'OUT_OF_MEMORY'
  | 'CORS_ERROR'
  | 'TIMEOUT_OR_CANCELLED'
  | 'EMPTY_RESPONSE'
  | 'UNKNOWN';

export interface OllamaErrorInfo {
  code: OllamaErrorCode;
  message: string;
  suggestion: string;
  details?: string;
}

export interface OllamaConnectionResult {
  connected: boolean;
  version?: string;
  models: OllamaModel[];
  latencyMs?: number;
  error?: OllamaErrorInfo | null;
}
