// PLAN.md §8.1 — provider interface (BYOK AI layer).

export type Role = 'judge' | 'tutor' | 'generator';

export interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  system: string;
  messages: Msg[];
  json?: boolean;
  maxTokens?: number;
  /** judge and every JSON role are called with temperature 0 — otherwise verdicts are non-deterministic. */
  temperature?: number;
}

/** Thrown by providers on HTTP 401/403 — "check your key" in the UI (§8.8), distinct from rate limits. */
export class LLMAuthError extends Error {
  constructor(message = 'Invalid or unauthorized API key') {
    super(message);
    this.name = 'LLMAuthError';
  }
}

/** Thrown by providers on HTTP 429 / quota exhaustion — triggers auto-fallback (§8.8). */
export class LLMRateLimitError extends Error {
  constructor(message = 'Rate limit exceeded') {
    super(message);
    this.name = 'LLMRateLimitError';
  }
}

export interface LLMProvider {
  id: string;
  label: string;
  /** Key entered / URL reachable — cheap local check, no network call. */
  isConfigured(): boolean | Promise<boolean>;
  chat(req: ChatRequest, signal?: AbortSignal): Promise<string>;
}
