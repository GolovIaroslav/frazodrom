import { describe, expect, it } from 'vitest';
import { REVIEW_PULL_MAX, buildReviewQueue, pickReviewItems, skillIdsInQueue, type SkillPull } from './reviewQueue';
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

describe('buildReviewQueue (Ф4 AC: review mixes ≥2 skills)', () => {
  it('interleaves items from 2 due skills so both are present in the result', () => {
    const pulls: SkillPull[] = [
      { skillId: 'a1_do_questions', items: [item('a1'), item('a2'), item('a3')] },
      { skillId: 'a1_does_questions', items: [item('b1'), item('b2'), item('b3')] },
    ];
    const queue = buildReviewQueue(pulls);
    expect(queue.length).toBe(6);
    const skills = skillIdsInQueue(queue, pulls);
    expect(skills.sort()).toEqual(['a1_do_questions', 'a1_does_questions']);
  });

  it('interleaves 3 due skills, all represented', () => {
    const pulls: SkillPull[] = [
      { skillId: 's1', items: [item('a1'), item('a2')] },
      { skillId: 's2', items: [item('b1'), item('b2')] },
      { skillId: 's3', items: [item('c1'), item('c2')] },
    ];
    const queue = buildReviewQueue(pulls);
    const skills = skillIdsInQueue(queue, pulls);
    expect(skills.sort()).toEqual(['s1', 's2', 's3']);
  });

  it('degenerates to a single skill queue when only one skill is due', () => {
    const pulls: SkillPull[] = [{ skillId: 's1', items: [item('a1'), item('a2')] }];
    const queue = buildReviewQueue(pulls);
    expect(queue.map((i) => i.id)).toEqual(['a1', 'a2']);
  });

  it('returns an empty queue when nothing is due', () => {
    expect(buildReviewQueue([])).toEqual([]);
  });
});

describe('pickReviewItems (§10.1 — fresh or long-unseen first)', () => {
  it('sorts never-attempted items before attempted ones', () => {
    const items = [item('seen'), item('fresh')];
    const lastAttempt = new Map([['seen', 100]]);
    expect(pickReviewItems(items, lastAttempt).map((i) => i.id)).toEqual(['fresh', 'seen']);
  });

  it('sorts attempted items oldest-first', () => {
    const items = [item('recent'), item('old')];
    const lastAttempt = new Map([
      ['recent', 200],
      ['old', 50],
    ]);
    expect(pickReviewItems(items, lastAttempt).map((i) => i.id)).toEqual(['old', 'recent']);
  });

  it('caps the pull at REVIEW_PULL_MAX', () => {
    const items = Array.from({ length: 20 }, (_, i) => item(`i${i}`));
    expect(pickReviewItems(items, new Map()).length).toBe(REVIEW_PULL_MAX);
  });
});
