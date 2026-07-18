// Browser speech preferences persisted in Dexie `kv`.

import { db } from '../db/db';
import type { Accent, Gender, SpeechRate } from './voices';

const KV = {
  accent: 'tts.accent',
  gender: 'tts.gender',
  rate: 'tts.rate',
  autoPlay: 'tts.autoPlay',
  browserOnlyMigration: 'tts.browserOnlyMigration.v1',
} as const;

async function getKv<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}

async function setKv(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

export async function getAccent(): Promise<Accent> {
  return getKv<Accent>(KV.accent, 'US');
}

export async function setAccent(accent: Accent): Promise<void> {
  await setKv(KV.accent, accent);
}

export async function getGender(): Promise<Gender> {
  return getKv<Gender>(KV.gender, 'f');
}

export async function setGender(gender: Gender): Promise<void> {
  await setKv(KV.gender, gender);
}

export async function getRate(): Promise<SpeechRate> {
  return getKv<SpeechRate>(KV.rate, 1.0);
}

export async function setRate(rate: SpeechRate): Promise<void> {
  await setKv(KV.rate, rate);
}

export async function getAutoPlay(): Promise<boolean> {
  return getKv<boolean>(KV.autoPlay, true);
}

export async function setAutoPlay(value: boolean): Promise<void> {
  await setKv(KV.autoPlay, value);
}

/** Removes data and cache entries created by the retired Kokoro/Gemini TTS engines once. */
export async function clearRetiredTtsData(): Promise<void> {
  if (await db.kv.get(KV.browserOnlyMigration)) return;

  await db.transaction('rw', db.kv, db.ttsCache, async () => {
    await db.ttsCache.clear();
    await db.kv.bulkDelete([
      'tts.geminiEnabled',
      'tts.kokoroEnabled',
      'tts.systemPlayCount',
      'tts.kokoroPromptDismissed',
    ]);
    await db.kv.put({ key: KV.browserOnlyMigration, value: true });
  });

  if (typeof caches === 'undefined') return;
  const names = await caches.keys();
  await Promise.all(names.filter((name) => /kokoro|transformers/i.test(name)).map((name) => caches.delete(name)));
}
