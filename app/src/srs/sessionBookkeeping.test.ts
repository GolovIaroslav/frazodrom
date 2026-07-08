import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { finishSession, startSession } from './sessionBookkeeping';

beforeEach(async () => {
  await db.sessions.clear();
  await db.skillState.clear();
  await db.itemState.clear();
  await db.attempts.clear();
});

describe('startSession/finishSession (§10)', () => {
  it('records final stats and finishedAt', async () => {
    const id = await startSession('drill', ['s1'], 1000);
    await finishSession(
      id,
      [
        { itemId: 'i1', skillId: 's1', correct: true },
        { itemId: 'i2', skillId: 's1', correct: false },
      ],
      2000,
    );
    const session = await db.sessions.get(id);
    expect(session?.finishedAt).toBe(2000);
    expect(session?.stats).toEqual({ total: 2, correct: 1 });
  });

  it('sets accuracy from THIS session, not a lifetime average, and schedules an FSRS due date', async () => {
    await db.skillState.put({
      skillId: 's1',
      status: 'in_progress',
      accuracy: 0.5,
      attemptCount: 10,
      correctCount: 5,
    });
    const id = await startSession('drill', ['s1'], 1000);
    await finishSession(
      id,
      [
        { itemId: 'i1', skillId: 's1', correct: true },
        { itemId: 'i2', skillId: 's1', correct: true },
      ],
      2000,
    );
    const state = await db.skillState.get('s1');
    expect(state?.accuracy).toBe(1);
    expect(state?.attemptCount).toBe(12);
    expect(state?.correctCount).toBe(7);
    expect(state?.due).toBeGreaterThan(2000);
  });

  it('rolls up accuracy per skill when a session spans multiple skills', async () => {
    const id = await startSession('review', ['a', 'b'], 1000);
    await finishSession(
      id,
      [
        { itemId: 'a1', skillId: 'a', correct: true },
        { itemId: 'a2', skillId: 'a', correct: true },
        { itemId: 'b1', skillId: 'b', correct: false },
        { itemId: 'b2', skillId: 'b', correct: true },
      ],
      2000,
    );
    const a = await db.skillState.get('a');
    const b = await db.skillState.get('b');
    expect(a?.accuracy).toBe(1);
    expect(b?.accuracy).toBe(0.5);
  });

  it('marks an item a leech once it has a wrong attempt in 2 different sessions', async () => {
    await db.attempts.add({
      itemId: 'i1',
      ts: 500,
      userInput: 'x',
      verdict: 'wrong',
      verdictSource: 'local',
      sessionId: 1,
    });
    const id = await startSession('drill', ['s1'], 1000);
    await db.attempts.add({
      itemId: 'i1',
      ts: 1500,
      userInput: 'x',
      verdict: 'wrong',
      verdictSource: 'local',
      sessionId: id,
    });
    await finishSession(id, [{ itemId: 'i1', skillId: 's1', correct: false }], 2000);
    const item = await db.itemState.get('i1');
    expect(item?.isLeech).toBe(true);
  });
});
