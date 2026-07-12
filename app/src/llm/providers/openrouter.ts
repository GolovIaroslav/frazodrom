// PLAN.md §8.2 — OpenRouter adapter, OpenAI-compatible at
// https://openrouter.ai/api/v1/chat/completions (verified via docs, 2026-07).
// §8.2: "⚠️VERIFY CORS на Ф3; иначе proxy" → same proxy-by-default treatment
// as Groq (routes through `proxy/serve.mjs` when a proxy URL is configured,
// otherwise calls OpenRouter directly).

import type { ChatRequest, LLMProvider } from '../types';
import { LLMAuthError, LLMRateLimitError } from '../types';
import { getOpenRouterApiKey, getProxyUrl } from '../settings';

const DIRECT_BASE_URL = 'https://openrouter.ai/api/v1';

function toRoleAwareError(status: number, message: string): Error {
  if (status === 401 || status === 403) return new LLMAuthError(message);
  if (status === 429) return new LLMRateLimitError(message);
  return new Error(message);
}

export class OpenRouterProvider implements LLMProvider {
  readonly id: string;
  readonly label: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(model: string, fetchImpl: typeof fetch = fetch) {
    this.model = model;
    this.id = `openrouter:${model}`;
    this.label = `OpenRouter ${model}`;
    this.fetchImpl = (input, init) => fetchImpl(input, init);
  }

  async isConfigured(): Promise<boolean> {
    const key = await getOpenRouterApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  private async baseUrl(): Promise<string> {
    const proxyUrl = await getProxyUrl();
    return proxyUrl ? `${proxyUrl.replace(/\/$/, '')}/openrouter` : DIRECT_BASE_URL;
  }

  async chat(req: ChatRequest, signal?: AbortSignal): Promise<string> {
    const apiKey = await getOpenRouterApiKey();
    if (!apiKey) throw new LLMAuthError('No OpenRouter API key configured');
    const baseUrl = await this.baseUrl();

    const response = await this.fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        // Optional per OpenRouter docs — identifies the app for rankings, no functional effect.
        'HTTP-Referer': 'https://frazodrom.app',
        'X-Title': 'Frazodrom',
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
