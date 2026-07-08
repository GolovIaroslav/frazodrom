import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { addToAcceptedCache, getAcceptedCacheEntries, removeFromAcceptedCache } from './acceptedCache';
import { ruHash } from './hash';

beforeEach(async () => {
  await db.acceptedCache.clear();
});

describe('acceptedCache (§7.2/§7.5)', () => {
  it('adds a judge-accepted variant keyed by the RU stimulus', async () => {
    await addToAcceptedCache('Я вижу кошку.', 'I can see a cat.', 'gemini:flash-lite');
    expect(await getAcceptedCacheEntries('Я вижу кошку.')).toEqual(['I can see a cat.']);
  });

  it('does not duplicate the same accepted variant (case-insensitive)', async () => {
    await addToAcceptedCache('Я вижу кошку.', 'I can see a cat.', 'gemini:flash-lite');
    await addToAcceptedCache('Я вижу кошку.', 'I CAN SEE A CAT.', 'gemini:flash-lite');
    expect(await getAcceptedCacheEntries('Я вижу кошку.')).toHaveLength(1);
  });

  it('removeFromAcceptedCache (§7.5 dispute flow) deletes just that variant', async () => {
    await addToAcceptedCache('Я вижу кошку.', 'I can see a cat.', 'gemini:flash-lite');
    await addToAcceptedCache('Я вижу кошку.', 'I see a cat.', 'gemini:flash-lite');
    await removeFromAcceptedCache('Я вижу кошку.', 'I can see a cat.');
    expect(await getAcceptedCacheEntries('Я вижу кошку.')).toEqual(['I see a cat.']);
  });

  it('removeFromAcceptedCache deletes the whole row once empty', async () => {
    await addToAcceptedCache('Я вижу кошку.', 'I can see a cat.', 'gemini:flash-lite');
    await removeFromAcceptedCache('Я вижу кошку.', 'I can see a cat.');
    expect(await db.acceptedCache.get(ruHash('Я вижу кошку.'))).toBeUndefined();
  });
});
