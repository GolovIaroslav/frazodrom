// PLAN.md §8.7 — one adapter for Ollama / LM Studio / llama.cpp's shared
// OpenAI-compatible /v1/chat/completions endpoint.

import type { ChatRequest, LLMProvider } from '../types';
import { LLMAuthError, LLMRateLimitError } from '../types';
import type { LocalOpenAIProfile } from '../settings';

function toRoleAwareError(status: number, message: string): Error {
  if (status === 401 || status === 403) return new LLMAuthError(message);
  if (status === 429) return new LLMRateLimitError(message);
  return new Error(message);
}

export class LocalOpenAIProvider implements LLMProvider {
  readonly id: string;
  readonly label: string;
  private readonly profile: LocalOpenAIProfile;
  private readonly fetchImpl: typeof fetch;

  constructor(profile: LocalOpenAIProfile, fetchImpl: typeof fetch = fetch) {
    this.profile = profile;
    this.fetchImpl = fetchImpl;
    // profile.id IS the full routing-chain id (e.g. "ollama:default", §8.1) — not re-prefixed.
    this.id = profile.id;
    this.label = profile.label || profile.model;
  }

  isConfigured(): boolean {
    return Boolean(this.profile.baseUrl && this.profile.model);
  }

  async chat(req: ChatRequest, signal?: AbortSignal): Promise<string> {
    const timeoutMs = this.profile.timeoutMs ?? 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await this.fetchImpl(`${this.profile.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(this.profile.apiKey ? { Authorization: `Bearer ${this.profile.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.profile.model,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens,
          ...(req.json ? { response_format: { type: 'json_object' } } : {}),
          messages: [{ role: 'system', content: req.system }, ...req.messages],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw toRoleAwareError(response.status, body || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content ?? '';
    } finally {
      clearTimeout(timer);
    }
  }
}
