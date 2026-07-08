import { describe, expect, it } from 'vitest';
import { CONTRAST_DUELS, availableContrastDuels, buildContrastDuelQueue } from './contrastDuel';
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

describe('CONTRAST_DUELS', () => {
  it('only references skill ids that currently exist in packs/index.json', () => {
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
    for (const [a, b] of CONTRAST_DUELS) {
      expect(currentSkills.has(a)).toBe(true);
      expect(currentSkills.has(b)).toBe(true);
    }
  });
});

describe('availableContrastDuels', () => {
  it('offers a duel only once both skills are passed', () => {
    expect(availableContrastDuels(new Set(['a1_do_questions']))).toEqual([]);
    expect(availableContrastDuels(new Set(['a1_do_questions', 'a1_does_questions']))).toEqual([
      ['a1_do_questions', 'a1_does_questions'],
    ]);
  });
});

describe('buildContrastDuelQueue', () => {
  it('mixes items from both skills without grouping them by skill', () => {
    const a = [item('a1'), item('a2')];
    const b = [item('b1'), item('b2')];
    const queue = buildContrastDuelQueue(a, b);
    expect(queue.map((i) => i.id)).toEqual(['a1', 'b1', 'a2', 'b2']);
  });
});
