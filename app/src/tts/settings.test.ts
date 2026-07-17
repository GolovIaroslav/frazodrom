import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import {
  dismissKokoroPrompt,
  getAccent,
  getAutoPlay,
  getGender,
  getGeminiEnabled,
  getKokoroEnabled,
  getRate,
  incrementSystemPlayCount,
  setAccent,
  setAutoPlay,
  setGender,
  setKokoroEnabled,
  setRate,
  shouldShowKokoroPrompt,
} from './settings';

beforeEach(async () => {
  await db.kv.clear();
});

describe('tts/settings (§9.1)', () => {
  it('defaults: US accent, female voice, 1.0x speed, auto-play on, kokoro off', async () => {
    expect(await getAccent()).toBe('US');
    expect(await getGender()).toBe('f');
    expect(await getRate()).toBe(1.0);
    expect(await getAutoPlay()).toBe(true);
    expect(await getKokoroEnabled()).toBe(false);
    expect(await getGeminiEnabled()).toBe(false);
  });

  it('selects cloud speech automatically when a Gemini key is already stored', async () => {
    await db.kv.put({ key: 'llm.gemini.apiKey', value: 'test-key' });
    expect(await getGeminiEnabled()).toBe(true);
  });

  it('persists each setting independently', async () => {
    await setAccent('UK');
    await setGender('m');
    await setRate(0.7);
    await setAutoPlay(false);
    await setKokoroEnabled(true);

    expect(await getAccent()).toBe('UK');
    expect(await getGender()).toBe('m');
    expect(await getRate()).toBe(0.7);
    expect(await getAutoPlay()).toBe(false);
    expect(await getKokoroEnabled()).toBe(true);
  });

  it('shouldShowKokoroPrompt only fires once the system-voice play count reaches 20, and never once kokoro is enabled or the prompt is dismissed', async () => {
    for (let i = 0; i < 19; i += 1) await incrementSystemPlayCount();
    expect(await shouldShowKokoroPrompt()).toBe(false);

    await incrementSystemPlayCount(); // 20th play
    expect(await shouldShowKokoroPrompt()).toBe(true);

    await setKokoroEnabled(true);
    expect(await shouldShowKokoroPrompt()).toBe(false);
    await setKokoroEnabled(false);

    await dismissKokoroPrompt();
    expect(await shouldShowKokoroPrompt()).toBe(false);
  });
});
