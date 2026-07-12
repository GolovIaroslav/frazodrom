// PLAN.md §9.1 — persistent cache for synthesized kokoro-js audio, keyed by
// (text, voice, speed). See kokoro.ts's header comment for why this matters:
// synthesis is well below real-time, but a review-heavy app replays the same
// sentences constantly, so caching turns a slow first encounter into an
// instant one on every later review.

import { db } from '../db/db';

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildTtsCacheKey(text: string, voiceId: string, speed: number): Promise<string> {
  return sha256Hex(`${voiceId}|${speed}|${text}`);
}

export async function getCachedAudio(key: string): Promise<Blob | undefined> {
  const row = await db.ttsCache.get(key);
  return row?.blob;
}

export async function putCachedAudio(key: string, blob: Blob): Promise<void> {
  await db.ttsCache.put({ key, blob, ts: Date.now() });
}
