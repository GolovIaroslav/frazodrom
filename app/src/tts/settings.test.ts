import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import {
  getAccent,
  getAutoPlay,
  getGender,
  getRate,
  setAccent,
  setAutoPlay,
  setGender,
  setRate,
} from './settings';

beforeEach(async () => {
  await db.kv.clear();
});

describe('tts/settings (§9.1)', () => {
  it('defaults to browser speech preferences', async () => {
    expect(await getAccent()).toBe('US');
    expect(await getGender()).toBe('f');
    expect(await getRate()).toBe(1.0);
    expect(await getAutoPlay()).toBe(true);
  });

  it('persists each setting independently', async () => {
    await setAccent('UK');
    await setGender('m');
    await setRate(0.7);
    await setAutoPlay(false);

    expect(await getAccent()).toBe('UK');
    expect(await getGender()).toBe('m');
    expect(await getRate()).toBe(0.7);
    expect(await getAutoPlay()).toBe(false);
  });
});
