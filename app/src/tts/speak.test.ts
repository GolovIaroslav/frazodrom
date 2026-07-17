import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { speak } from './speak';

beforeEach(async () => {
  await db.kv.clear();
  await db.ttsCache.clear();
  vi.restoreAllMocks();
});

describe('speech engine selection', () => {
  it('does not fall back to local speech when selected cloud speech fails', async () => {
    await db.kv.put({ key: 'llm.gemini.apiKey', value: 'test-key' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network unavailable'));

    await expect(speak('It is love.')).rejects.toThrow('local speech fallback is disabled');
  });
});
