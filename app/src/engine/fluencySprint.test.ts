import { describe, expect, it } from 'vitest';
import { buildFluencySprint, canStartFluencySprint } from './fluencySprint';
import type { PackItem } from './types';

function item(id: string): PackItem {
  return {
    id,
    ru: 'ru',
    en_main: 'en',
    en_accepted: [],
    sub: 'affirm',
    difficulty: 1,
    cefr_lex: 'A1',
    source: 'tatoeba:1',
    attribution: 'x',
  };
}

describe('canStartFluencySprint (Ф4 AC — gate on accuracy >90%)', () => {
  it('rejects exactly 90% (not strictly greater)', () => {
    expect(canStartFluencySprint(0.9)).toBe(false);
  });
  it('rejects below 90%', () => {
    expect(canStartFluencySprint(0.5)).toBe(false);
  });
  it('accepts above 90%', () => {
    expect(canStartFluencySprint(0.91)).toBe(true);
    expect(canStartFluencySprint(1)).toBe(true);
  });
});

describe('buildFluencySprint (§6.3 — 4/3/2, same set replayed)', () => {
  it('produces 3 rounds with shrinking limits 4/3/2', () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`i${i}`));
    const rounds = buildFluencySprint(items);
    expect(rounds.map((r) => r.limitMinutes)).toEqual([4, 3, 2]);
  });

  it('replays the exact same ~10-item set across every round', () => {
    const items = Array.from({ length: 15 }, (_, i) => item(`i${i}`));
    const rounds = buildFluencySprint(items);
    expect(rounds[0]?.items.length).toBe(10);
    expect(rounds[1]?.items).toEqual(rounds[0]?.items);
    expect(rounds[2]?.items).toEqual(rounds[0]?.items);
  });
});
