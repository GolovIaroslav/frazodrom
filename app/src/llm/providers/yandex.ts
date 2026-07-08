// PLAN.md §8.2 — Yandex AI Studio (YandexGPT + open-model catalog) adapter
// (⚠️VERIFY CORS из браузера, §8.2/§16).
//
// Endpoint: POST https://llm.api.cloud.yandex.net/foundationModels/v1/completion
// with `Authorization: Api-Key <apiKey>` and body
// { modelUri, completionOptions: { stream, temperature, maxTokens },
//   messages: [{ role, text }] } — verified against Yandex Cloud's public REST
// reference (2026-07). This is NOT the OpenAI-compatible shape (no
// `/chat/completions`, message field is `text` not `content`, response is
// `{ result: { alternatives: [{ message, status }] } }`).
//
// Routed through `proxy/serve.mjs` by default (§8.2's "если напрямую нельзя,
// через proxy/").
//
// UNTESTABLE IN THIS SANDBOX: no live Yandex Cloud API key/folder id was
// available to exercise this against the real endpoint — see the report /
// BLOCKERS.md. Response-shape details (`result.alternatives[0].message.text`)
// follow the public docs but have not been confirmed against a live call.

import type { ChatRequest, LLMProvider } from '../types';
import { LLMAuthError, LLMRateLimitError } from '../types';
import { getProxyUrl, getYandexCredentials } from '../settings';

const DIRECT_BASE_URL = 'https://llm.api.cloud.yandex.net';

function toRoleAwareError(status: number, message: string): Error {
  if (status === 401 || status === 403) return new LLMAuthError(message);
  if (status === 429) return new LLMRateLimitError(message);
  return new Error(message);
}

interface YandexCompletionResponse {
  result?: {
    alternatives?: { message?: { role?: string; text?: string }; status?: string }[];
  };
}

export class YandexProvider implements LLMProvider {
  readonly id: string;
  readonly label: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(model: string, fetchImpl: typeof fetch = fetch) {
    this.model = model;
    this.id = `yandex:${model}`;
    this.label = `Yandex ${model}`;
    this.fetchImpl = fetchImpl;
  }

  async isConfigured(): Promise<boolean> {
    const creds = await getYandexCredentials();
    return Boolean(creds?.apiKey && creds.folderId);
  }

  private async baseUrl(): Promise<string> {
    const proxyUrl = await getProxyUrl();
    return proxyUrl ? `${proxyUrl.replace(/\/$/, '')}/yandex` : DIRECT_BASE_URL;
  }

  async chat(req: ChatRequest, signal?: AbortSignal): Promise<string> {
    const creds = await getYandexCredentials();
    if (!creds) throw new LLMAuthError('No Yandex API key/folder id configured');
    const baseUrl = await this.baseUrl();
    const modelUri = `gpt://${creds.folderId}/${this.model}/latest`;

    const response = await this.fetchImpl(`${baseUrl}/foundationModels/v1/completion`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Api-Key ${creds.apiKey}`,
        'x-folder-id': creds.folderId,
      },
      body: JSON.stringify({
        modelUri,
        completionOptions: {
          stream: false,
          temperature: req.temperature ?? 0.7,
          maxTokens: String(req.maxTokens ?? 2000),
        },
        messages: [
          { role: 'system', text: req.system },
          ...req.messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: m.content })),
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw toRoleAwareError(response.status, body || `HTTP ${response.status}`);
    }

    const data = (await response.json()) as YandexCompletionResponse;
    return data.result?.alternatives?.[0]?.message?.text ?? '';
  }
}
