import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterProvider } from './openrouter';
import { LLMAuthError, LLMRateLimitError } from '../types';
import * as settings from '../settings';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OpenRouterProvider', () => {
  it('isConfigured reflects the stored API key', async () => {
    vi.spyOn(settings, 'getOpenRouterApiKey').mockResolvedValue('sk-or-test');
    expect(await new OpenRouterProvider('meta-llama/llama-3.2-3b-instruct:free').isConfigured()).toBe(true);

    vi.spyOn(settings, 'getOpenRouterApiKey').mockResolvedValue(undefined);
    expect(await new OpenRouterProvider('m').isConfigured()).toBe(false);
  });

  it('calls the direct OpenRouter endpoint when no proxy is configured', async () => {
    vi.spyOn(settings, 'getOpenRouterApiKey').mockResolvedValue('sk-or-test');
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hi' } }] }),
    });
    const provider = new OpenRouterProvider('m', fetchImpl as unknown as typeof fetch);

    const result = await provider.chat({ system: 'sys', messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toBe('hi');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('routes through the proxy URL when one is configured (§8.2)', async () => {
    vi.spyOn(settings, 'getOpenRouterApiKey').mockResolvedValue('sk-or-test');
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue('http://localhost:8787');
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const provider = new OpenRouterProvider('m', fetchImpl as unknown as typeof fetch);

    await provider.chat({ system: 's', messages: [] });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:8787/openrouter/chat/completions',
      expect.anything(),
    );
  });

  it('maps 401/429 to the shared LLM error types', async () => {
    vi.spyOn(settings, 'getOpenRouterApiKey').mockResolvedValue('sk-or-test');
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue(undefined);

    const provider401 = new OpenRouterProvider(
      'm',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'nope' }) as unknown as typeof fetch,
    );
    await expect(provider401.chat({ system: 's', messages: [] })).rejects.toBeInstanceOf(LLMAuthError);

    const provider429 = new OpenRouterProvider(
      'm',
      vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'slow' }) as unknown as typeof fetch,
    );
    await expect(provider429.chat({ system: 's', messages: [] })).rejects.toBeInstanceOf(LLMRateLimitError);
  });
});
