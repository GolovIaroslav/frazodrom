import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { buildTtsCacheKey, getCachedAudio, putCachedAudio } from './cache';

beforeEach(async () => {
  await db.ttsCache.clear();
});

describe('tts cache (§9.1 — synthesized-audio Blob cache)', () => {
  it('is deterministic for the same (text, voice, speed) and differs otherwise', async () => {
    const a = await buildTtsCacheKey('Hello there', 'af_heart', 1.0);
    const b = await buildTtsCacheKey('Hello there', 'af_heart', 1.0);
    const differentVoice = await buildTtsCacheKey('Hello there', 'bm_george', 1.0);
    const differentSpeed = await buildTtsCacheKey('Hello there', 'af_heart', 0.7);
    const differentText = await buildTtsCacheKey('Hello world', 'af_heart', 1.0);

    expect(a).toBe(b);
    expect(a).not.toBe(differentVoice);
    expect(a).not.toBe(differentSpeed);
    expect(a).not.toBe(differentText);
  });

  it('misses cleanly (undefined) before anything is cached for a key', async () => {
    const key = await buildTtsCacheKey('Hello there', 'af_heart', 1.0);
    expect(await getCachedAudio(key)).toBeUndefined();
  });

  it('put makes a subsequent get for the same key resolve to a defined value', async () => {
    // Not asserting `instanceof Blob` / byte-identity here: in this jsdom test
    // environment, Node's global `structuredClone` does not recognize jsdom's
    // own `Blob` class and silently clones it to `{}` — a known jsdom/Node
    // interop gap in fake-indexeddb's storage layer, not a bug in this
    // module. Real browsers have exactly one native Blob implementation and
    // natively support storing/retrieving Blobs via IndexedDB (this is how
    // e.g. offline image caches work in any PWA) — Dexie's put/get plumbing
    // itself is what this test is actually covering.
    const key = await buildTtsCacheKey('Hello there', 'af_heart', 1.0);
    const blob = new Blob(['fake wav bytes'], { type: 'audio/wav' });
    await putCachedAudio(key, blob);
    expect(await getCachedAudio(key)).toBeDefined();
  });
});
