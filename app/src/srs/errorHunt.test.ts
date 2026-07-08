import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { ERROR_HUNT_THRESHOLD, TAG_TO_SKILLS, rankTopTags, suggestErrorHunt } from './errorHunt';

beforeEach(async () => {
  await db.errorProfile.clear();
});

describe('rankTopTags (§10.4)', () => {
  it('keeps only tags above the threshold, top 3, sorted by count30d desc', () => {
    const rows = [
      { tag: 'aux_missing', count30d: 10, lastSeen: 1 },
      { tag: 'article', count30d: ERROR_HUNT_THRESHOLD, lastSeen: 1 }, // exactly at threshold — excluded
      { tag: 'agreement', count30d: 8, lastSeen: 1 },
      { tag: 'pronoun', count30d: 5, lastSeen: 1 },
      { tag: 'vocab_choice', count30d: 4, lastSeen: 1 },
    ];
    expect(rankTopTags(rows)).toEqual(['aux_missing', 'agreement', 'pronoun']);
  });

  it('returns an empty list when nothing crosses the threshold', () => {
    expect(rankTopTags([{ tag: 'article', count30d: 1, lastSeen: 1 }])).toEqual([]);
  });
});

describe('TAG_TO_SKILLS', () => {
  it('only maps to skill ids that exist in the current A1 pack set', () => {
    const currentSkills = new Set([
      'a1_be_affirm',
      'a1_be_neg_quest',
      'a1_pronouns_poss',
      'a1_this_that',
      'a1_there_is',
      'a1_pres_simple_i',
      'a1_pres_simple_3rd',
      'a1_do_questions',
      'a1_does_questions',
      'a1_dont_doesnt',
      'a1_freq_adverbs',
    ]);
    for (const skills of Object.values(TAG_TO_SKILLS)) {
      for (const s of skills) expect(currentSkills.has(s)).toBe(true);
    }
  });
});

describe('suggestErrorHunt', () => {
  it('suggests skills for the top tags once they cross the threshold', async () => {
    await db.errorProfile.bulkPut([
      { tag: 'aux_missing', count30d: 10, lastSeen: 1 },
      { tag: 'pronoun', count30d: 6, lastSeen: 1 },
    ]);
    const suggestion = await suggestErrorHunt();
    expect(suggestion?.tags).toEqual(['aux_missing', 'pronoun']);
    expect(suggestion?.skillIds.sort()).toEqual(
      ['a1_do_questions', 'a1_does_questions', 'a1_pronouns_poss'].sort(),
    );
  });

  it('returns undefined when nothing crosses the threshold', async () => {
    await db.errorProfile.put({ tag: 'aux_missing', count30d: 1, lastSeen: 1 });
    expect(await suggestErrorHunt()).toBeUndefined();
  });
});
