import { describe, expect, it } from 'vitest';
import { MAX_DAILY_REVIEWS, buildDailyPlan, findContinueSkill, rankDueSkills } from './dailyPlan';
import type { SkillStateRecord } from '../db/db';
import type { PacksIndex } from '../engine/types';
import { scheduleReview, Rating } from './fsrs';

function skillState(overrides: Partial<SkillStateRecord> & { skillId: string }): SkillStateRecord {
  return { status: 'in_progress', accuracy: 0, attemptCount: 0, correctCount: 0, ...overrides };
}

describe('rankDueSkills (§10.5 point 1/7 — weakest retrievability first)', () => {
  it('excludes skills not yet due', () => {
    const future = Date.now() + 100000;
    const states = [skillState({ skillId: 's1', due: future })];
    expect(rankDueSkills(states, new Date())).toEqual([]);
  });

  it('orders due skills weakest-first', () => {
    const now = new Date();
    const weak = scheduleReview({}, Rating.Again, now); // low stability → low retrievability sooner
    const strong = scheduleReview({}, Rating.Easy, now);
    const states = [
      skillState({ skillId: 'strong', ...strong, due: now.getTime() - 1 }),
      skillState({ skillId: 'weak', ...weak, due: now.getTime() - 1 }),
    ];
    const later = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const ranked = rankDueSkills(states, later);
    expect(ranked[0]?.skillId).toBe('weak');
  });
});

describe('buildDailyPlan (§10.5 point 7 — cap at 3, rest wait)', () => {
  it('caps due skills at MAX_DAILY_REVIEWS and reports overflow', () => {
    const now = new Date();
    const states = Array.from({ length: 5 }, (_, i) =>
      skillState({ skillId: `s${i}`, due: now.getTime() - 1, stability: i + 1, difficulty: 5, lastReview: now.getTime() - 1000 }),
    );
    const plan = buildDailyPlan({ skillStates: states, leechItemIds: [], errorHuntTags: undefined, packsIndex: undefined, now });
    expect(plan.dueSkills.length).toBe(MAX_DAILY_REVIEWS);
    expect(plan.overflowCount).toBe(2);
  });

  it('carries leeches and an error-hunt suggestion through unchanged', () => {
    const plan = buildDailyPlan({
      skillStates: [],
      leechItemIds: ['i1', 'i2'],
      errorHuntTags: ['aux_missing'],
      packsIndex: undefined,
      now: new Date(),
    });
    expect(plan.leechItemIds).toEqual(['i1', 'i2']);
    expect(plan.errorHuntTags).toEqual(['aux_missing']);
  });

  it('omits the error-hunt suggestion when nothing crossed the threshold', () => {
    const plan = buildDailyPlan({
      skillStates: [],
      leechItemIds: [],
      errorHuntTags: [],
      packsIndex: undefined,
      now: new Date(),
    });
    expect(plan.errorHuntTags).toBeUndefined();
  });
});

describe('findContinueSkill (§10.5 point 3 — new material of current module)', () => {
  const index: PacksIndex = {
    version: 1,
    levels: [
      {
        cefr: 'A1',
        modules: [
          {
            id: 'a1_m1',
            title_ru: 'm1',
            skills: [
              { id: 's1', title_ru: 'x', cefr: 'A1', count: 1, checksum: 'a' },
              { id: 's2', title_ru: 'x', cefr: 'A1', count: 1, checksum: 'a' },
            ],
          },
        ],
      },
    ],
  };

  it('picks the first non-passed skill in course order', () => {
    const states = [skillState({ skillId: 's1', status: 'passed' })];
    expect(findContinueSkill(index, states)).toBe('s2');
  });

  it('returns undefined without a packs index', () => {
    expect(findContinueSkill(undefined, [])).toBeUndefined();
  });
});
