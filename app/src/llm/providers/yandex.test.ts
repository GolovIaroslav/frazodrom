import { afterEach, describe, expect, it, vi } from 'vitest';
import { YandexProvider } from './yandex';
import { LLMAuthError, LLMRateLimitError } from '../types';
import * as settings from '../settings';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('YandexProvider', () => {
  it('isConfigured requires both apiKey and folderId', async () => {
    vi.spyOn(settings, 'getYandexCredentials').mockResolvedValue({ apiKey: 'k', folderId: 'f' });
    expect(await new YandexProvider('yandexgpt-lite').isConfigured()).toBe(true);

    vi.spyOn(settings, 'getYandexCredentials').mockResolvedValue(undefined);
    expect(await new YandexProvider('yandexgpt-lite').isConfigured()).toBe(false);
  });

  it('POSTs to the completion endpoint with modelUri/messages and reads result.alternatives[0].message.text', async () => {
    vi.spyOn(settings, 'getYandexCredentials').mockResolvedValue({ apiKey: 'k', folderId: 'folder1' });
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue(undefined);

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { alternatives: [{ message: { role: 'assistant', text: 'privet' } }] } }),
    });
    const provider = new YandexProvider('yandexgpt-lite', fetchImpl as unknown as typeof fetch);

    const result = await provider.chat({ system: 'sys', messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toBe('privet');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.modelUri).toBe('gpt://folder1/yandexgpt-lite/latest');
    expect(body.messages[0]).toEqual({ role: 'system', text: 'sys' });
    const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Api-Key k');
    expect(headers['x-folder-id']).toBe('folder1');
  });

  it('routes through the proxy when configured', async () => {
    vi.spyOn(settings, 'getYandexCredentials').mockResolvedValue({ apiKey: 'k', folderId: 'f' });
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue('http://localhost:8787');
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: { alternatives: [] } }) });
    const provider = new YandexProvider('yandexgpt-lite', fetchImpl as unknown as typeof fetch);

    await provider.chat({ system: 's', messages: [] });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:8787/yandex/foundationModels/v1/completion',
      expect.anything(),
    );
  });

  it('maps 401/429 to the shared LLM error types', async () => {
    vi.spyOn(settings, 'getYandexCredentials').mockResolvedValue({ apiKey: 'k', folderId: 'f' });
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue(undefined);

    const provider401 = new YandexProvider(
      'm',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'nope' }) as unknown as typeof fetch,
    );
    await expect(provider401.chat({ system: 's', messages: [] })).rejects.toBeInstanceOf(LLMAuthError);

    const provider429 = new YandexProvider(
      'm',
      vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'slow' }) as unknown as typeof fetch,
    );
    await expect(provider429.chat({ system: 's', messages: [] })).rejects.toBeInstanceOf(LLMRateLimitError);
  });
});
