// PLAN.md §8.7 — one adapter for Ollama / LM Studio / llama.cpp's shared
// OpenAI-compatible /v1/chat/completions endpoint.

import type { ChatRequest, LLMProvider } from '../types';
import { LLMAuthError, LLMRateLimitError } from '../types';
import { getProxyUrl, type LocalOpenAIProfile } from '../settings';
import { formatLocalProviderLabel } from '../localProfile';

const DEFAULT_LOCAL_PROXY_URL = 'http://localhost:8787';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

function toRoleAwareError(status: number, message: string): Error {
  if (status === 401 || status === 403) return new LLMAuthError(message);
  if (status === 429) return new LLMRateLimitError(message);
  return new Error(message);
}

function normalizeLoopbackUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const browserHost = globalThis.location?.hostname;
    if (browserHost && LOOPBACK_HOSTS.has(browserHost) && LOOPBACK_HOSTS.has(url.hostname) && url.hostname !== browserHost) {
      url.hostname = browserHost;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return rawUrl.replace(/\/$/, '');
  }
}

export class LocalOpenAIProvider implements LLMProvider {
  readonly id: string;
  readonly label: string;
  private readonly profile: LocalOpenAIProfile;
  private readonly fetchImpl: typeof fetch;

  constructor(profile: LocalOpenAIProfile, fetchImpl: typeof fetch = fetch) {
    this.profile = profile;
    this.fetchImpl = (input, init) => fetchImpl(input, init);
    // profile.id IS the full routing-chain id (e.g. "ollama:default", §8.1) — not re-prefixed.
    this.id = profile.id;
    this.label = formatLocalProviderLabel(profile);
  }

  isConfigured(): boolean {
    return Boolean(this.profile.baseUrl && this.profile.model);
  }

  private async proxyBaseUrl(): Promise<string> {
    const configured = (await getProxyUrl())?.trim();
    return `${normalizeLoopbackUrl(configured || DEFAULT_LOCAL_PROXY_URL)}/local`;
  }

  private async send(
    url: string,
    req: ChatRequest,
    signal: AbortSignal | undefined,
    extraHeaders?: Record<string, string>,
  ): Promise<string> {
    const response = await this.fetchImpl(url, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(this.profile.apiKey ? { Authorization: `Bearer ${this.profile.apiKey}` } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify({
        model: this.profile.model,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens,
        // Local OpenAI-compatible servers disagree on response_format support.
        // JSON output is already requested by the role's system prompt.
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
  }

  private shouldRetryViaProxy(err: unknown): boolean {
    if (err instanceof LLMAuthError || err instanceof LLMRateLimitError) return false;
    if (err instanceof DOMException && err.name === 'AbortError') return false;
    if (err instanceof Error && /abort/i.test(err.message)) return false;
    return err instanceof Error || err instanceof TypeError;
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
      try {
        return await this.send(`${normalizeLoopbackUrl(this.profile.baseUrl)}/chat/completions`, req, controller.signal);
      } catch (err) {
        if (!this.shouldRetryViaProxy(err)) throw err;
        const proxyBaseUrl = await this.proxyBaseUrl();
        if (import.meta.env.DEV) {
          console.warn('Local OpenAI direct request failed, retrying through proxy.', err);
        }
        try {
          return await this.send(`${proxyBaseUrl}/chat/completions`, req, controller.signal, {
            'x-local-base-url': normalizeLoopbackUrl(this.profile.baseUrl),
          });
        } catch (proxyErr) {
          if (import.meta.env.DEV) {
            console.warn('Local OpenAI proxy retry failed.', proxyErr);
          }
          throw proxyErr;
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
