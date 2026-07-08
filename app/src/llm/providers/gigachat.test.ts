import { afterEach, describe, expect, it, vi } from 'vitest';
import { GigaChatProvider } from './gigachat';
import { LLMAuthError, LLMRateLimitError } from '../types';
import * as settings from '../settings';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GigaChatProvider', () => {
  it('isConfigured requires an authKey', async () => {
    vi.spyOn(settings, 'getGigaChatCredentials').mockResolvedValue({ authKey: 'abc' });
    expect(await new GigaChatProvider('GigaChat').isConfigured()).toBe(true);

    vi.spyOn(settings, 'getGigaChatCredentials').mockResolvedValue(undefined);
    expect(await new GigaChatProvider('GigaChat').isConfigured()).toBe(false);
  });

  it('exchanges the authorization key for an access token, then calls chat/completions with it', async () => {
    vi.spyOn(settings, 'getGigaChatCredentials').mockResolvedValue({ authKey: 'b64key', scope: 'GIGACHAT_API_PERS' });
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue(undefined);

    const fetchImpl = vi
      .fn()
      // 1) OAuth exchange
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok123', expires_at: Date.now() + 30 * 60 * 1000 }),
      })
      // 2) chat completion
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'privet' } }] }),
      });

    const provider = new GigaChatProvider('GigaChat', fetchImpl as unknown as typeof fetch);
    const result = await provider.chat({ system: 'sys', messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toBe('privet');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://ngw.devices.sberbank.ru:9443/api/v2/oauth');
    const oauthHeaders = fetchImpl.mock.calls[0][1].headers as Record<string, string>;
    expect(oauthHeaders.Authorization).toBe('Basic b64key');

    expect(fetchImpl.mock.calls[1][0]).toBe('https://gigachat.devices.sberbank.ru/api/v1/chat/completions');
    const chatHeaders = fetchImpl.mock.calls[1][1].headers as Record<string, string>;
    expect(chatHeaders.Authorization).toBe('Bearer tok123');
  });

  it('caches the access token across calls until it is near expiry', async () => {
    vi.spyOn(settings, 'getGigaChatCredentials').mockResolvedValue({ authKey: 'b64key' });
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue(undefined);

    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('oauth')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: 'tok-cached', expires_at: Date.now() + 30 * 60 * 1000 }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) });
    });

    const provider = new GigaChatProvider('GigaChat', fetchImpl as unknown as typeof fetch);
    await provider.chat({ system: 's', messages: [] });
    await provider.chat({ system: 's', messages: [] });

    const oauthCalls = fetchImpl.mock.calls.filter((c) => String(c[0]).includes('oauth'));
    expect(oauthCalls).toHaveLength(1);
  });

  it('routes through the proxy for both oauth and chat when configured', async () => {
    vi.spyOn(settings, 'getGigaChatCredentials').mockResolvedValue({ authKey: 'b64key' });
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue('http://localhost:8787');

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 't', expires_at: Date.now() + 1e6 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) });

    const provider = new GigaChatProvider('GigaChat', fetchImpl as unknown as typeof fetch);
    await provider.chat({ system: 's', messages: [] });

    expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost:8787/gigachat-oauth');
    expect(fetchImpl.mock.calls[1][0]).toBe('http://localhost:8787/gigachat/chat/completions');
  });

  it('maps a 401 during oauth to LLMAuthError and a 429 during chat to LLMRateLimitError', async () => {
    vi.spyOn(settings, 'getGigaChatCredentials').mockResolvedValue({ authKey: 'b64key' });
    vi.spyOn(settings, 'getProxyUrl').mockResolvedValue(undefined);

    const provider401 = new GigaChatProvider(
      'GigaChat',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'nope' }) as unknown as typeof fetch,
    );
    await expect(provider401.chat({ system: 's', messages: [] })).rejects.toBeInstanceOf(LLMAuthError);

    const fetch429 = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 't', expires_at: Date.now() + 1e6 }) })
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'slow' });
    const provider429 = new GigaChatProvider('GigaChat', fetch429 as unknown as typeof fetch);
    await expect(provider429.chat({ system: 's', messages: [] })).rejects.toBeInstanceOf(LLMRateLimitError);
  });
});
