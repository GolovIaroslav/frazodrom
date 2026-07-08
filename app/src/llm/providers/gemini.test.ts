import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../db/db';
import { GeminiProvider } from './gemini';
import { LLMAuthError, LLMRateLimitError } from '../types';

beforeEach(async () => {
  await db.kv.clear();
});

describe('GeminiProvider', () => {
  it('reports not configured without a stored API key', async () => {
    const provider = new GeminiProvider('gemini-3.5-flash');
    expect(await provider.isConfigured()).toBe(false);
  });

  it('reports configured once a key is stored', async () => {
    await db.kv.put({ key: 'llm.gemini.apiKey', value: 'secret' });
    const provider = new GeminiProvider('gemini-3.5-flash');
    expect(await provider.isConfigured()).toBe(true);
  });

  it('shapes the request with system instruction, temperature, json mode, and roles', async () => {
    await db.kv.put({ key: 'llm.gemini.apiKey', value: 'secret' });
    const generateContent = vi.fn().mockResolvedValue({ text: '{"ok":true}' });
    const provider = new GeminiProvider('gemini-3.5-flash', {
      clientFactory: (apiKey) => {
        expect(apiKey).toBe('secret');
        return { models: { generateContent } };
      },
    });

    const result = await provider.chat({
      system: 'sys',
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ],
      json: true,
      temperature: 0,
      maxTokens: 100,
    });

    expect(result).toBe('{"ok":true}');
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.5-flash',
        contents: [
          { role: 'user', parts: [{ text: 'hello' }] },
          { role: 'model', parts: [{ text: 'hi' }] },
        ],
        config: expect.objectContaining({
          systemInstruction: 'sys',
          temperature: 0,
          maxOutputTokens: 100,
          responseMimeType: 'application/json',
        }),
      }),
    );
  });

  it('throws LLMAuthError without calling the SDK when no key is stored', async () => {
    const provider = new GeminiProvider('gemini-3.5-flash');
    await expect(provider.chat({ system: 's', messages: [] })).rejects.toBeInstanceOf(LLMAuthError);
  });

  it('retries once on a 503 and succeeds on the second attempt', async () => {
    await db.kv.put({ key: 'llm.gemini.apiKey', value: 'secret' });
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce({ status: 503, message: 'Service Unavailable' })
      .mockResolvedValueOnce({ text: 'ok' });
    const provider = new GeminiProvider('gemini-3.5-flash', {
      clientFactory: () => ({ models: { generateContent } }),
    });

    const result = await provider.chat({ system: 's', messages: [{ role: 'user', content: 'x' }] });
    expect(result).toBe('ok');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('retries once on a CORS-shaped TypeError', async () => {
    await db.kv.put({ key: 'llm.gemini.apiKey', value: 'secret' });
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ text: 'ok' });
    const provider = new GeminiProvider('gemini-3.5-flash', {
      clientFactory: () => ({ models: { generateContent } }),
    });

    const result = await provider.chat({ system: 's', messages: [{ role: 'user', content: 'x' }] });
    expect(result).toBe('ok');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 401/403 and throws LLMAuthError', async () => {
    await db.kv.put({ key: 'llm.gemini.apiKey', value: 'bad' });
    const generateContent = vi.fn().mockRejectedValue({ status: 401, message: 'Unauthorized' });
    const provider = new GeminiProvider('gemini-3.5-flash', {
      clientFactory: () => ({ models: { generateContent } }),
    });

    await expect(
      provider.chat({ system: 's', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toBeInstanceOf(LLMAuthError);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('maps a 429 to LLMRateLimitError', async () => {
    await db.kv.put({ key: 'llm.gemini.apiKey', value: 'k' });
    const generateContent = vi.fn().mockRejectedValue({ status: 429, message: 'Too Many Requests' });
    const provider = new GeminiProvider('gemini-3.5-flash', {
      clientFactory: () => ({ models: { generateContent } }),
    });

    await expect(
      provider.chat({ system: 's', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toBeInstanceOf(LLMRateLimitError);
  });

  it('parses an empty response text as an empty string, not a crash', async () => {
    await db.kv.put({ key: 'llm.gemini.apiKey', value: 'k' });
    const generateContent = vi.fn().mockResolvedValue({});
    const provider = new GeminiProvider('gemini-3.5-flash', {
      clientFactory: () => ({ models: { generateContent } }),
    });

    const result = await provider.chat({ system: 's', messages: [{ role: 'user', content: 'x' }] });
    expect(result).toBe('');
  });
});
