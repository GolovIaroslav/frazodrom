import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { synthesizeWithGemini } from './gemini';
import { ensureGeminiAudio } from './speak';

const TEST_KEY = 'test-gemini-key';
const AUDIO_BASE64 = 'AAEC';

beforeEach(async () => {
  await db.kv.clear();
  await db.ttsCache.clear();
  vi.restoreAllMocks();
});

describe('Gemini speech synthesis', () => {
  it('sends a mocked request and converts PCM audio to a WAV blob', async () => {
    await db.kv.put({ key: 'llm.gemini.apiKey', value: TEST_KEY });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ output_audio: { data: AUDIO_BASE64 } }), { status: 200 }),
    );

    const result = await synthesizeWithGemini('It is love.', {
      accent: 'US',
      gender: 'f',
      rate: 1,
    });

    expect(result.type).toBe('audio/wav');
    expect(result.size).toBe(47);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(new Headers(init?.headers).get('x-goog-api-key')).toBe(TEST_KEY);
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'gemini-3.1-flash-tts-preview',
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: 'Kore' }] },
    });
  });

  it('does not call the provider when no key is configured', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(
      synthesizeWithGemini('Hello.', { accent: 'UK', gender: 'm', rate: 0.8 }),
    ).rejects.toThrow('not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides provider details and key when the response is invalid', async () => {
    await db.kv.put({ key: 'llm.gemini.apiKey', value: TEST_KEY });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ output_audio: {} }), { status: 200 }),
    );

    const error = await synthesizeWithGemini('Hello.', { accent: 'UK', gender: 'm', rate: 0.8 }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Gemini TTS returned no audio');
    expect((error as Error).message).not.toContain(TEST_KEY);
  });

  it('caches the generated audio for repeated sentences', async () => {
    await db.kv.bulkPut([
      { key: 'llm.gemini.apiKey', value: TEST_KEY },
      { key: 'tts.geminiEnabled', value: true },
    ]);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ output_audio: { data: AUDIO_BASE64 } }), { status: 200 }),
    );

    await ensureGeminiAudio('It is love.');
    await ensureGeminiAudio('It is love.');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await db.ttsCache.count()).toBe(1);
  });
});
