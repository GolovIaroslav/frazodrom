import { describe, expect, it, vi } from 'vitest';
import { LocalOpenAIProvider } from './localOpenai';
import { LLMAuthError, LLMRateLimitError } from '../types';
import type { LocalOpenAIProfile } from '../settings';

const profile: LocalOpenAIProfile = {
  id: 'ollama:default',
  label: 'Ollama',
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3',
};

describe('LocalOpenAIProvider', () => {
  it('isConfigured requires both baseUrl and model', () => {
    expect(new LocalOpenAIProvider(profile).isConfigured()).toBe(true);
    expect(new LocalOpenAIProvider({ ...profile, model: '' }).isConfigured()).toBe(false);
  });

  it('POSTs to /chat/completions with system + messages + json mode', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hello back' } }] }),
    });
    const provider = new LocalOpenAIProvider(profile, fetchImpl as unknown as typeof fetch);

    const result = await provider.chat({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      json: true,
      temperature: 0,
    });

    expect(result).toBe('hello back');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.model).toBe('llama3');
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'hi' });
  });

  it('maps HTTP 401 to LLMAuthError and 429 to LLMRateLimitError', async () => {
    const provider401 = new LocalOpenAIProvider(
      profile,
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'nope' }) as unknown as typeof fetch,
    );
    await expect(provider401.chat({ system: 's', messages: [] })).rejects.toBeInstanceOf(LLMAuthError);

    const provider429 = new LocalOpenAIProvider(
      profile,
      vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'slow down' }) as unknown as typeof fetch,
    );
    await expect(provider429.chat({ system: 's', messages: [] })).rejects.toBeInstanceOf(LLMRateLimitError);
  });

  it('aborts after the configured timeout', async () => {
    const fetchImpl = vi.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    const provider = new LocalOpenAIProvider(
      { ...profile, timeoutMs: 5 },
      fetchImpl as unknown as typeof fetch,
    );

    await expect(provider.chat({ system: 's', messages: [] })).rejects.toThrow();
  });
});
