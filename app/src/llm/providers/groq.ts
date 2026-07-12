// PLAN.md §8.2 — Groq adapter. Groq's API is directly OpenAI-compatible at
// `/openai/v1/chat/completions` (https://console.groq.com/docs/openai).
// §8.2 flags Groq's from-browser CORS as unreliable → routes through the
// optional local proxy (`proxy/serve.mjs`, §5.1) by default when a proxy URL
// is configured; falls back to calling Groq directly otherwise (useful if the
// user's own setup tolerates CORS, or they run the app from a non-browser shell).

import type { ChatRequest, LLMProvider } from '../types';
import { LLMAuthError, LLMRateLimitError } from '../types';
import { getGroqApiKey, getProxyUrl } from '../settings';

const DIRECT_BASE_URL = 'https://api.groq.com/openai/v1';

function toRoleAwareError(status: number, message: string): Error {
  if (status === 401 || status === 403) return new LLMAuthError(message);
  if (status === 429) return new LLMRateLimitError(message);
  return new Error(message);
}

export class GroqProvider implements LLMProvider {
  readonly id: string;
  readonly label: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(model: string, fetchImpl: typeof fetch = fetch) {
    this.model = model;
    this.id = `groq:${model}`;
    this.label = `Groq ${model}`;
    this.fetchImpl = (input, init) => fetchImpl(input, init);
  }

  async isConfigured(): Promise<boolean> {
    const key = await getGroqApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  private async baseUrl(): Promise<string> {
    const proxyUrl = await getProxyUrl();
    return proxyUrl ? `${proxyUrl.replace(/\/$/, '')}/groq` : DIRECT_BASE_URL;
  }

  async chat(req: ChatRequest, signal?: AbortSignal): Promise<string> {
    const apiKey = await getGroqApiKey();
    if (!apiKey) throw new LLMAuthError('No Groq API key configured');
    const baseUrl = await this.baseUrl();

    const response = await this.fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
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

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? '';
  }
}
