import { describe, expect, it } from 'vitest';
import { buildQueue, interleaveQueue, requeueItem } from './queue';
import type { PackItem } from './types';

function item(overrides: Partial<PackItem>): PackItem {
  return {
    id: 'id',
    ru: 'ru',
    en_main: 'en',
    en_accepted: [],
    sub: 'affirm',
    difficulty: 1,
    cefr_lex: 'A1',
    source: 'tatoeba:1',
    attribution: 'x',
    ...overrides,
  };
}

describe('buildQueue', () => {
  it('orders by difficulty ascending', () => {
    const items = [item({ id: 'd3', difficulty: 3 }), item({ id: 'd1', difficulty: 1 }), item({ id: 'd2', difficulty: 2 })];
    const queue = buildQueue(items);
    expect(queue.map((i) => i.id)).toEqual(['d1', 'd2', 'd3']);
  });

  it('orders sub-drills affirm -> question -> neg -> wh -> mixed within a difficulty', () => {
    const items = [
      item({ id: 'mixed', sub: 'mixed', difficulty: 1 }),
      item({ id: 'wh', sub: 'wh', difficulty: 1 }),
      item({ id: 'neg', sub: 'neg', difficulty: 1 }),
      item({ id: 'question', sub: 'question', difficulty: 1 }),
      item({ id: 'affirm', sub: 'affirm', difficulty: 1 }),
    ];
    const queue = buildQueue(items);
    expect(queue.map((i) => i.id)).toEqual(['affirm', 'question', 'neg', 'wh', 'mixed']);
  });

  it('is stable for ties (keeps original order)', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })];
    expect(buildQueue(items).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty queue for an empty pack', () => {
    expect(buildQueue([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const items = [item({ id: 'b', difficulty: 2 }), item({ id: 'a', difficulty: 1 })];
    buildQueue(items);
    expect(items.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('interleaveQueue', () => {
  it('is a no-op when there is nothing to interleave (first skill of the course, §6.2 edge case)', () => {
    const base = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })];
    const result = interleaveQueue(base, []);
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('inserts roughly every 3rd item from interleaveItems', () => {
    const base = [
      item({ id: '1' }),
      item({ id: '2' }),
      item({ id: '3' }),
      item({ id: '4' }),
      item({ id: '5' }),
      item({ id: '6' }),
    ];
    const other = [item({ id: 'x1' }), item({ id: 'x2' })];
    const result = interleaveQueue(base, other, { interleaveRatio: 0.3 });
    expect(result.map((i) => i.id)).toEqual(['1', '2', '3', 'x1', '4', '5', '6', 'x2']);
  });

  it('inserts every other item at a 0.5 ratio', () => {
    const base = [item({ id: '1' }), item({ id: '2' }), item({ id: '3' }), item({ id: '4' })];
    const other = [item({ id: 'x1' }), item({ id: 'x2' })];
    const result = interleaveQueue(base, other, { interleaveRatio: 0.5 });
    expect(result.map((i) => i.id)).toEqual(['1', '2', 'x1', '3', '4', 'x2']);
  });

  it('stops inserting once interleaveItems is exhausted', () => {
    const base = [item({ id: '1' }), item({ id: '2' }), item({ id: '3' }), item({ id: '4' })];
    const other = [item({ id: 'x1' })];
    const result = interleaveQueue(base, other, { interleaveRatio: 0.5 });
    expect(result.map((i) => i.id)).toEqual(['1', '2', 'x1', '3', '4']);
  });
});

describe('requeueItem', () => {
  it('inserts the item 2-4 positions ahead of the current index', () => {
    const queue = ['a', 'b', 'c', 'd', 'e'];
    const result = requeueItem(queue, 0, 'a-retry', 3);
    expect(result).toEqual(['a', 'b', 'c', 'a-retry', 'd', 'e']);
  });

  it('clamps the offset into the 2-4 range', () => {
    const queue = ['a', 'b', 'c', 'd', 'e'];
    expect(requeueItem(queue, 0, 'x', 0)).toEqual(['a', 'b', 'x', 'c', 'd', 'e']);
    expect(requeueItem(queue, 0, 'x', 10)).toEqual(['a', 'b', 'c', 'd', 'x', 'e']);
  });

  it('does not overflow past the end of the queue', () => {
    const queue = ['a', 'b'];
    expect(requeueItem(queue, 0, 'x', 3)).toEqual(['a', 'b', 'x']);
  });
});
