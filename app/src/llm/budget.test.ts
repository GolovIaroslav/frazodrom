import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { hasBudget, consumeBudget, tryConsumeBudget } from './budget';

beforeEach(async () => {
  await db.providerBudget.clear();
});

describe('budget (§8.3)', () => {
  it('has budget when nothing has been consumed yet', async () => {
    expect(await hasBudget('gemini:flash-lite', 'judge', 800)).toBe(true);
  });

  it('consumeBudget increments the per-role counter for today', async () => {
    await consumeBudget('gemini:flash-lite', 'judge');
    await consumeBudget('gemini:flash-lite', 'judge');
    await consumeBudget('gemini:flash-lite', 'tutor');
    const rows = await db.providerBudget.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].countsByRole).toEqual({ judge: 2, tutor: 1 });
  });

  it('tryConsumeBudget returns false and does not write once the ceiling is hit', async () => {
    expect(await tryConsumeBudget('gemini:flash-lite', 'judge', 2)).toBe(true);
    expect(await tryConsumeBudget('gemini:flash-lite', 'judge', 2)).toBe(true);
    expect(await tryConsumeBudget('gemini:flash-lite', 'judge', 2)).toBe(false);

    const row = await db.providerBudget.get('gemini:flash-lite:' + new Date().toISOString().slice(0, 10));
    // date formatting differs (Pacific tz for gemini), just check total count stayed at ceiling
    const rows = await db.providerBudget.toArray();
    const total = rows.reduce((sum, r) => sum + (r.countsByRole.judge ?? 0), 0);
    expect(total).toBe(2);
    void row;
  });

  it('keeps separate counters for different providers', async () => {
    await consumeBudget('gemini:flash-lite', 'judge');
    await consumeBudget('ollama:default', 'judge');
    const rows = await db.providerBudget.toArray();
    expect(rows).toHaveLength(2);
  });
});
