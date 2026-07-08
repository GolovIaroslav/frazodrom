// PLAN.md §8.2 — GigaChat adapter (⚠️VERIFY CORS/TLS из браузера, §8.2/§16).
//
// Auth: OAuth client-credentials exchange — POST to
// https://ngw.devices.sberbank.ru:9443/api/v2/oauth with `Authorization: Basic
// <authKey>` (Sber's pre-base64'd "Authorization key") and `scope=<scope>`
// form-encoded, returns { access_token, expires_at } valid ~30 min (verified
// via Sber's public REST docs, 2026-07). Chat is OpenAI-compatible-ish at
// https://gigachat.devices.sberbank.ru/api/v1/chat/completions with
// `Authorization: Bearer <access_token>`.
//
// Routed through `proxy/serve.mjs` by default (same reasoning as Groq/OpenRouter,
// §8.2) — this is also the pragmatic answer to GigaChat's Minsvyaz-rooted TLS
// certificate, which a browser will not trust directly; the proxy's Node
// process can be configured to trust it (see proxy/serve.mjs comments).
//
// UNTESTABLE IN THIS SANDBOX: no live GigaChat account/Authorization key was
// available to exercise this against the real endpoints — see the report /
// BLOCKERS.md. The shape below follows the public REST reference as closely
// as static docs allow; treat the OAuth exchange in particular as
// needs-live-verification.

import type { ChatRequest, LLMProvider } from '../types';
import { LLMAuthError, LLMRateLimitError } from '../types';
import { getGigaChatCredentials, getProxyUrl } from '../settings';

const DIRECT_OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const DIRECT_API_BASE_URL = 'https://gigachat.devices.sberbank.ru/api/v1';

function toRoleAwareError(status: number, message: string): Error {
  if (status === 401 || status === 403) return new LLMAuthError(message);
  if (status === 429) return new LLMRateLimitError(message);
  return new Error(message);
}

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for environments without crypto.randomUUID (e.g. older test runners).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

export class GigaChatProvider implements LLMProvider {
  readonly id: string;
  readonly label: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private cachedToken: CachedToken | undefined;

  constructor(model: string, fetchImpl: typeof fetch = fetch) {
    this.model = model;
    this.id = `gigachat:${model}`;
    this.label = `GigaChat ${model}`;
    this.fetchImpl = fetchImpl;
  }

  async isConfigured(): Promise<boolean> {
    const creds = await getGigaChatCredentials();
    return Boolean(creds?.authKey && creds.authKey.trim().length > 0);
  }

  private async oauthUrl(): Promise<string> {
    const proxyUrl = await getProxyUrl();
    return proxyUrl ? `${proxyUrl.replace(/\/$/, '')}/gigachat-oauth` : DIRECT_OAUTH_URL;
  }

  private async apiBaseUrl(): Promise<string> {
    const proxyUrl = await getProxyUrl();
    return proxyUrl ? `${proxyUrl.replace(/\/$/, '')}/gigachat` : DIRECT_API_BASE_URL;
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 5000) {
      return this.cachedToken.accessToken;
    }
    const creds = await getGigaChatCredentials();
    if (!creds) throw new LLMAuthError('No GigaChat authorization key configured');

    const oauthUrl = await this.oauthUrl();
    const response = await this.fetchImpl(oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        RqUID: randomUuid(),
        Authorization: `Basic ${creds.authKey}`,
      },
      body: `scope=${creds.scope ?? 'GIGACHAT_API_PERS'}`,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw toRoleAwareError(response.status, body || `HTTP ${response.status}`);
    }

    const data = (await response.json()) as { access_token: string; expires_at: number };
    this.cachedToken = { accessToken: data.access_token, expiresAt: data.expires_at };
    return data.access_token;
  }

  async chat(req: ChatRequest, signal?: AbortSignal): Promise<string> {
    const accessToken = await this.getAccessToken();
    const baseUrl = await this.apiBaseUrl();

    const response = await this.fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens,
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
