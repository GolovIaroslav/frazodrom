import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import {
  checkAndMarkLeech,
  countFailedSessions,
  getActiveLeechItemIds,
  isLeechStillActive,
  ratingFromLeechOutcome,
  reviewLeech,
} from './leech';
import { Rating } from './fsrs';

beforeEach(async () => {
  await db.attempts.clear();
  await db.itemState.clear();
});

describe('countFailedSessions (§10.3 — ≥2 DIFFERENT sessions)', () => {
  it('does not count repeated fails within the same session twice', async () => {
    await db.attempts.bulkAdd([
      { itemId: 'i1', ts: 1, userInput: 'x', verdict: 'wrong', verdictSource: 'local', sessionId: 1 },
      { itemId: 'i1', ts: 2, userInput: 'x', verdict: 'wrong', verdictSource: 'local', sessionId: 1 },
    ]);
    expect(await countFailedSessions('i1')).toBe(1);
  });

  it('counts fails across two different sessions', async () => {
    await db.attempts.bulkAdd([
      { itemId: 'i1', ts: 1, userInput: 'x', verdict: 'wrong', verdictSource: 'local', sessionId: 1 },
      { itemId: 'i1', ts: 2, userInput: 'x', verdict: 'correct', verdictSource: 'local', sessionId: 1 },
      { itemId: 'i1', ts: 3, userInput: 'x', verdict: 'wrong', verdictSource: 'local', sessionId: 2 },
    ]);
    expect(await countFailedSessions('i1')).toBe(2);
  });

  it('ignores attempts with no sessionId (unattributed data never creates a false leech)', async () => {
    await db.attempts.bulkAdd([
      { itemId: 'i1', ts: 1, userInput: 'x', verdict: 'wrong', verdictSource: 'local' },
      { itemId: 'i1', ts: 2, userInput: 'x', verdict: 'wrong', verdictSource: 'local' },
    ]);
    expect(await countFailedSessions('i1')).toBe(0);
  });
});

describe('checkAndMarkLeech', () => {
  it('does not mark a leech after only one failed session', async () => {
    await db.attempts.add({ itemId: 'i1', ts: 1, userInput: 'x', verdict: 'wrong', verdictSource: 'local', sessionId: 1 });
    const isLeech = await checkAndMarkLeech('i1');
    expect(isLeech).toBe(false);
    expect((await db.itemState.get('i1'))?.isLeech).toBe(false);
  });

  it('marks a leech after failing in 2 different sessions', async () => {
    await db.attempts.bulkAdd([
      { itemId: 'i1', ts: 1, userInput: 'x', verdict: 'wrong', verdictSource: 'local', sessionId: 1 },
      { itemId: 'i1', ts: 2, userInput: 'x', verdict: 'wrong', verdictSource: 'local', sessionId: 2 },
    ]);
    const isLeech = await checkAndMarkLeech('i1');
    expect(isLeech).toBe(true);
    expect((await db.itemState.get('i1'))?.isLeech).toBe(true);
  });
});

describe('ratingFromLeechOutcome (§10.3)', () => {
  it('maps fail/hintAssisted/clean to Again/Hard/Good', () => {
    expect(ratingFromLeechOutcome('fail')).toBe(Rating.Again);
    expect(ratingFromLeechOutcome('hintAssisted')).toBe(Rating.Hard);
    expect(ratingFromLeechOutcome('clean')).toBe(Rating.Good);
  });
});

describe('reviewLeech + isLeechStillActive', () => {
  it('keeps a fresh leech active (stability well under 30 days)', async () => {
    await db.itemState.put({ itemId: 'i1', seenCount: 0, failCount: 2, isLeech: true });
    await reviewLeech('i1', 'clean', Date.now());
    const state = await db.itemState.get('i1');
    expect(state?.isLeech).toBe(true);
    expect(isLeechStillActive(state ?? {})).toBe(true);
  });

  it('resolves a leech once repeated clean reviews push stability past 30 days', async () => {
    let now = Date.now();
    for (let i = 0; i < 8; i += 1) {
      await reviewLeech('i1', 'clean', now);
      const state = await db.itemState.get('i1');
      now = (state?.due as number) ?? now + 24 * 60 * 60 * 1000;
    }
    const state = await db.itemState.get('i1');
    expect(state?.stability).toBeGreaterThan(30);
    expect(state?.isLeech).toBe(false);
  });
});

describe('getActiveLeechItemIds', () => {
  it('returns only itemIds flagged as leeches', async () => {
    await db.itemState.bulkPut([
      { itemId: 'a', seenCount: 1, failCount: 2, isLeech: true },
      { itemId: 'b', seenCount: 1, failCount: 0, isLeech: false },
    ]);
    expect(await getActiveLeechItemIds()).toEqual(['a']);
  });
});
