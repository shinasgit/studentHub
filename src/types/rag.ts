// RAG (Retrieval-Augmented Generation) Types for AI Student Hub
// Stage 7: RAG Answer Generation Layer

/**
 * A verified source citation corresponding to a retrieved document chunk.
 */
export interface RagSourceReference {
  /**
   * Unique ID of the chunk (e.g., 'res-net-001_chunk_0').
   */
  chunkId: string;
  /**
   * Unique ID of the resource in Firestore.
   */
  resourceId: string;
  /**
   * Original filename of the PDF (e.g., 'ComputerNetworks_Transport.pdf').
   */
  resourceName: string;
  /**
   * 1-indexed starting page number in the original PDF.
   */
  pageNumber: number;
  /**
   * 1-indexed ending page number if chunk spans multiple PDF pages.
   */
  pageEndNumber?: number;
  /**
   * Formatted page range string (e.g. "4–5") for multi-page citations.
   */
  pageRange?: string;
  /**
   * Normalized cosine similarity score [0.0, 1.0].
   */
  similarity: number;
  /**
   * Raw cosine distance from ChromaDB.
   */
  distance: number;
  /**
   * Associated subject ID (e.g., 'cs-networks-301').
   */
  subjectId?: string;
  /**
   * Associated module ID (e.g., 'mod-transport').
   */
  moduleId?: string;
  /**
   * Short text excerpt for previewing.
   */
  textSnippet?: string;
  /**
   * Whether this citation is strictly verified against retrieved document evidence.
   */
  isVerified?: boolean;
  /**
   * Associated student ID for multi-tenant isolation validation.
   */
  studentId?: string;
  /**
   * Descriptive validation error if citation was invalid or failed verification.
   */
  validationError?: string;
}

/**
 * An individual conversation message turn for context-aware RAG.
 */
export interface RagConversationMessage {
  sender?: 'user' | 'assistant' | 'system';
  role?: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Options for configuring RAG retrieval and answer generation.
 */
export interface RagAnswerOptions {
  /**
   * Maximum number of chunks to retrieve from ChromaDB. Default: 5.
   */
  topK?: number;
  /**
   * Optional minimum similarity threshold for filtering out weak matches.
   */
  minSimilarity?: number;
  /**
   * Maximum characters budget for combined retrieved document passages. Default: 4000.
   */
  maxContextChars?: number;
  /**
   * LLM sampling temperature. Default: 0.3 (lower temperature for factual fidelity).
   */
  temperature?: number;
  /**
   * LLM model name. Default: 'llama3.2:3b'.
   */
  model?: string;
  /**
   * Optional specific resource ID to scope search to a single document.
   */
  resourceId?: string;
  /**
   * Target ChromaDB collection name. Default: 'student_hub_documents'.
   */
  collectionName?: string;
  /**
   * Custom Ollama base URL (e.g. for testing offline conditions).
   */
  customOllamaUrl?: string;
  /**
   * Custom ChromaDB base URL (e.g. for testing offline conditions).
   */
  customChromaUrl?: string;
  /**
   * Abort signal to cancel generation in-flight.
   */
  abortSignal?: AbortSignal;
  /**
   * Prior conversation turns (user/assistant) to resolve follow-ups and context.
   */
  conversationHistory?: RagConversationMessage[];
  /**
   * Maximum number of recent history turns (user + assistant pairs) to include. Default: 3 (6 messages).
   */
  maxHistoryTurns?: number;
  /**
   * Whether to enable query condensation for follow-up questions. Default: true.
   */
  enableQueryCondensation?: boolean;
  /**
   * Whether to enable duplicate and near-duplicate chunk removal. Default: true.
   */
  enableDeduplication?: boolean;
  /**
   * Similarity threshold for near-duplicate chunk detection [0.0 - 1.0]. Default: 0.80.
   */
  nearDuplicateThreshold?: number;
  /**
   * Whether to truncate a remaining oversized chunk to fit available budget space. Default: false.
   */
  allowTailTruncation?: boolean;
  /**
   * Whether to enable progressive streaming of LLM response chunks. Default: false.
   */
  stream?: boolean;
  /**
   * Callback invoked progressively as new token chunks are streamed from the LLM.
   */
  onChunk?: (chunk: string, accumulated: string) => void;
}

/**
 * Structured result produced by the RAG generation pipeline.
 */
export interface RagAnswerResult {
  /**
   * Generated answer grounded in retrieved study material.
   */
  answer: string;
  /**
   * Source references citing documents and page numbers used.
   */
  sources: RagSourceReference[];
  /**
   * Model used for generation (e.g., 'llama3.2:3b').
   */
  model: string;
  /**
   * Total elapsed time in milliseconds.
   */
  durationMs: number;
  /**
   * Time spent in semantic retrieval (milliseconds).
   */
  retrievalDurationMs: number;
  /**
   * Time spent in LLM text generation (milliseconds).
   */
  generationDurationMs: number;
  /**
   * Total chunks retrieved from ChromaDB before context truncation.
   */
  retrievedChunksCount: number;
  /**
   * Actual chunks included in the LLM prompt within context budget.
   */
  usedChunksCount: number;
  /**
   * Number of duplicate or near-duplicate chunks filtered out.
   */
  dedupRemovedCount?: number;
  /**
   * Whether the answer is verified to be grounded in retrieved document chunks.
   */
  isGrounded: boolean;
  /**
   * Execution status.
   */
  status: 'success' | 'no_context' | 'error' | 'cancelled';
  /**
   * Error message if generation failed.
   */
  error?: string;
  /**
   * The assembled prompt sent to the LLM (for debugging and testing).
   */
  assembledPrompt?: string;
  /**
   * Standalone condensed question used for vector retrieval (if condensation was performed).
   */
  condensedQuestion?: string;
  /**
   * Time spent in query condensation (milliseconds).
   */
  condensationDurationMs?: number;
  /**
   * Number of citations that passed strict verification against retrieved evidence.
   */
  verifiedSourcesCount?: number;
  /**
   * Number of citations that failed verification or lacked evidence grounding.
   */
  unverifiedCitationsCount?: number;
  /**
   * Time in milliseconds from request start until the first streamed token was received.
   */
  timeToFirstTokenMs?: number;
  /**
   * Whether this response was delivered via progressive streaming.
   */
  isStreamed?: boolean;
  /**
   * Whether generation was cancelled prematurely by the user.
   */
  isCancelled?: boolean;
}

/**
 * Prompt context bundle prepared for LLM generation.
 */
export interface RagPromptContext {
  systemPrompt: string;
  userPrompt: string;
  sources: RagSourceReference[];
  totalContextChars: number;
  chunksUsed: number;
  dedupRemovedCount?: number;
}
