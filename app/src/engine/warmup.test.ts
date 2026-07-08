import { describe, expect, it } from 'vitest';
import { weaveLeechesIntoQueue } from './warmup';
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

describe('weaveLeechesIntoQueue (§10.5 point 2 — leeches in warmups)', () => {
  it('includes every leech item in the resulting queue', () => {
    const base = [item('n1'), item('n2'), item('n3'), item('n4')];
    const leeches = [item('leech1')];
    const result = weaveLeechesIntoQueue(base, leeches);
    expect(result.map((i) => i.id)).toContain('leech1');
    expect(result.length).toBe(5);
  });

  it('is a no-op when there are no leeches (§6.2 edge case)', () => {
    const base = [item('n1'), item('n2')];
    expect(weaveLeechesIntoQueue(base, [])).toEqual(base);
  });
});
