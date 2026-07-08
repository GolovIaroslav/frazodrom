import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroqProvider } from './groq';
import { LLMAuthError, LLMRateLimitError } from '../types';
import * as settings from '../settings';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GroqProvider', () => {
  it('isConfigured reflects the stored API key', async () => {
    vi.spyOn(settings, 'getGroqApiKey').mockResolvedValue('gsk_test');
    const provider = new GroqProvider('llama-3.1-8b-instant');
    expect(await provider.isConfigured()).toBe(true);

    vi.spyOn(settings, 'getGroqApiKey').mockResolvedValue(undefined);
    expect(await new GroqProvider('llama-3.1-8b-instant').isConfigured()).toBe(false);
  });

  it('calls the direct Groq OpenAI-compatible endpoint when no proxy is configured', async () => {
    vi.spyOn(settings, 'getGroqApiKey').mockResolvedValue('gsk_test');
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hi' } }] }),
    });
    const provider = new GroqProvider('llama-3.1-8b-instant', fetchImpl as unknown as typeof fetch);

    const result = await provider.chat({ system: 'sys', messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toBe('hi');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    const call = fetchImpl.mock.calls[0][1] as { headers: Record<string, string> };
    expect(call.headers.Authorization).toBe('Bearer gsk_test');
  });

  it('routes through the proxy URL when one is configured (§8.2)', async () => {
    vi.spyOn(settings, 'getGroqApiKey').mockResolvedValue('gsk_test');
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue('http://localhost:8787');
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const provider = new GroqProvider('llama-3.1-8b-instant', fetchImpl as unknown as typeof fetch);

    await provider.chat({ system: 's', messages: [] });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:8787/groq/chat/completions',
      expect.anything(),
    );
  });

  it('maps 401/429 to the shared LLM error types', async () => {
    vi.spyOn(settings, 'getGroqApiKey').mockResolvedValue('gsk_test');
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue(undefined);

    const provider401 = new GroqProvider(
      'm',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'nope' }) as unknown as typeof fetch,
    );
    await expect(provider401.chat({ system: 's', messages: [] })).rejects.toBeInstanceOf(LLMAuthError);

    const provider429 = new GroqProvider(
      'm',
      vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'slow' }) as unknown as typeof fetch,
    );
    await expect(provider429.chat({ system: 's', messages: [] })).rejects.toBeInstanceOf(LLMRateLimitError);
  });

  it('throws LLMAuthError immediately when no key is configured', async () => {
    vi.spyOn(settings, 'getGroqApiKey').mockResolvedValue(undefined);
    const provider = new GroqProvider('m');
    await expect(provider.chat({ system: 's', messages: [] })).rejects.toBeInstanceOf(LLMAuthError);
  });
});
