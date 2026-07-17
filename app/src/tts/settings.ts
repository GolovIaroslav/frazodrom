// PLAN.md §9.1 — TTS preferences persisted in Dexie `kv`, same pattern as
// `llm/settings.ts`.

import { db } from '../db/db';
import { getGeminiApiKey } from '../llm/settings';
import type { Accent, Gender, SpeechRate } from './voices';

const KV = {
  accent: 'tts.accent',
  gender: 'tts.gender',
  rate: 'tts.rate',
  autoPlay: 'tts.autoPlay',
  geminiEnabled: 'tts.geminiEnabled',
  kokoroEnabled: 'tts.kokoroEnabled',
  systemPlayCount: 'tts.systemPlayCount',
  kokoroPromptDismissed: 'tts.kokoroPromptDismissed',
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

/** §9.1 — auto-play the reference sentence's audio after a correct answer, default on. */
export async function getAutoPlay(): Promise<boolean> {
  return getKv<boolean>(KV.autoPlay, true);
}

export async function setAutoPlay(value: boolean): Promise<void> {
  await setKv(KV.autoPlay, value);
}

export async function getGeminiEnabled(): Promise<boolean> {
  const saved = await db.kv.get(KV.geminiEnabled);
  if (saved) return saved.value as boolean;
  return Boolean((await getGeminiApiKey())?.trim());
}

export async function setGeminiEnabled(value: boolean): Promise<void> {
  await setKv(KV.geminiEnabled, value);
}

export async function getKokoroEnabled(): Promise<boolean> {
  return getKv<boolean>(KV.kokoroEnabled, false);
}

export async function setKokoroEnabled(value: boolean): Promise<void> {
  await setKv(KV.kokoroEnabled, value);
}

/** §9.1 — "after ~20 system-voice plays, offer the quality-voice prompt". */
const KOKORO_PROMPT_THRESHOLD = 20;

export async function incrementSystemPlayCount(): Promise<number> {
  const count = (await getKv<number>(KV.systemPlayCount, 0)) + 1;
  await setKv(KV.systemPlayCount, count);
  return count;
}

export async function getKokoroPromptDismissed(): Promise<boolean> {
  return getKv<boolean>(KV.kokoroPromptDismissed, false);
}

export async function dismissKokoroPrompt(): Promise<void> {
  await setKv(KV.kokoroPromptDismissed, true);
}

/** Whether the one-time "try the quality voice" nudge should show right now. */
export async function shouldShowKokoroPrompt(): Promise<boolean> {
  const [enabled, dismissed, count] = await Promise.all([
    getKokoroEnabled(),
    getKokoroPromptDismissed(),
    getKv<number>(KV.systemPlayCount, 0),
  ]);
  return !enabled && !dismissed && count >= KOKORO_PROMPT_THRESHOLD;
}
