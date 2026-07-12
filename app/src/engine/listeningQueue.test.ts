import { describe, expect, it } from 'vitest';
import { buildListeningQueue } from './listeningQueue';
import type { PackItem } from './types';

function item(id: string): PackItem {
  return {
    id,
    ru: `ru-${id}`,
    en_main: `en-${id}`,
    en_accepted: [],
    sub: 'x',
    difficulty: 1,
    cefr_lex: 'A1',
    source: 'test',
    attribution: 'test',
  };
}

describe('buildListeningQueue (§9.2)', () => {
  it('pulls from every covered skill and records itemSkillMap', () => {
    const pulls = [
      { skillId: 'a', items: [item('a1'), item('a2')] },
      { skillId: 'b', items: [item('b1')] },
    ];
    const { items, itemSkillMap } = buildListeningQueue(pulls, new Map(), 10);
    expect(items.map((i) => i.id).sort()).toEqual(['a1', 'a2', 'b1']);
    expect(itemSkillMap).toEqual({ a1: 'a', a2: 'a', b1: 'b' });
  });

  it('caps the total queue at itemCap', () => {
    const pulls = [{ skillId: 'a', items: Array.from({ length: 8 }, (_, i) => item(`a${i}`)) }];
    const { items } = buildListeningQueue(pulls, new Map(), 5);
    expect(items).toHaveLength(5);
  });

  it('favors never-attempted items first, per skill (reuses pickReviewItems ordering)', () => {
    const pulls = [{ skillId: 'a', items: [item('seen'), item('fresh')] }];
    const lastAttempt = new Map([['seen', 1000]]);
    const { items } = buildListeningQueue(pulls, lastAttempt, 10);
    expect(items[0]?.id).toBe('fresh');
  });
});
