// PLAN.md §8.1/§8.2 — Gemini adapter via @google/genai. Retries once on a
// CORS-shaped network failure or a 503, per §8.2's retry rule.

import { GoogleGenAI } from '@google/genai';
import type { ChatRequest, LLMProvider } from '../types';
import { LLMAuthError, LLMRateLimitError } from '../types';
import { getGeminiApiKey } from '../settings';

function statusOf(err: unknown): number | undefined {
  if (err && typeof err === 'object') {
    const anyErr = err as { status?: number; code?: number; message?: string };
    if (typeof anyErr.status === 'number') return anyErr.status;
    if (typeof anyErr.code === 'number') return anyErr.code;
    const match = /\b(401|403|429|503)\b/.exec(anyErr.message ?? '');
    if (match) return Number(match[1]);
  }
  return undefined;
}

function isRetryable(err: unknown): boolean {
  const status = statusOf(err);
  if (status === 503) return true;
  // A CORS-blocked request usually surfaces as a generic TypeError with no status.
  if (err instanceof TypeError) return true;
  return false;
}

function toRoleAwareError(err: unknown): Error {
  const status = statusOf(err);
  if (status === 401 || status === 403) return new LLMAuthError();
  if (status === 429) return new LLMRateLimitError();
  return err instanceof Error ? err : new Error(String(err));
}

export interface GeminiProviderOptions {
  /** Injectable for tests; defaults to the real SDK client. */
  clientFactory?: (apiKey: string) => {
    models: {
      generateContent: (args: unknown) => Promise<{ text?: string }>;
    };
  };
}

export class GeminiProvider implements LLMProvider {
  readonly id: string;
  readonly label: string;
  private readonly model: string;
  private readonly clientFactory: NonNullable<GeminiProviderOptions['clientFactory']>;

  constructor(model: string, options: GeminiProviderOptions = {}) {
    this.model = model;
    this.id = `gemini:${model}`;
    this.label = `Gemini ${model}`;
    this.clientFactory =
      options.clientFactory ??
      ((apiKey: string) => {
        const client = new GoogleGenAI({ apiKey });
        return {
          models: {
            generateContent: (args: unknown) =>
              client.models.generateContent(args as Parameters<typeof client.models.generateContent>[0]),
          },
        };
      });
  }

  async isConfigured(): Promise<boolean> {
    const key = await getGeminiApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  async chat(req: ChatRequest, signal?: AbortSignal): Promise<string> {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) throw new LLMAuthError('No Gemini API key configured');
    const client = this.clientFactory(apiKey);

    const contents = req.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const args = {
      model: this.model,
      contents,
      config: {
        systemInstruction: req.system,
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens,
        ...(req.json ? { responseMimeType: 'application/json' } : {}),
      },
      ...(signal ? { abortSignal: signal } : {}),
    };

    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await client.models.generateContent(args);
        return response.text ?? '';
      } catch (err) {
        lastErr = err;
        if (attempt === 0 && isRetryable(err)) continue;
        throw toRoleAwareError(err);
      }
    }
    throw toRoleAwareError(lastErr);
  }
}
