import { describe, expect, it } from 'vitest';
import { nextPlacementLevel, scoreModuleExam, scoreLevelExam } from './assessment';

describe('placement ladder', () => {
  it('moves up at four correct answers and down at two', () => {
    expect(nextPlacementLevel(['A1', 'A2', 'B1'], 'A2', 4)).toBe('B1');
    expect(nextPlacementLevel(['A1', 'A2', 'B1'], 'A2', 2)).toBe('A1');
  });

  it('reports a boundary at exactly three answers', () => {
    expect(nextPlacementLevel(['A1', 'A2', 'B1'], 'A2', 3)).toBeUndefined();
  });
});

describe('exam scoring', () => {
  it('requires 80 percent for a module', () => {
    expect(scoreModuleExam(13, 16).passed).toBe(true);
    expect(scoreModuleExam(12, 16).passed).toBe(false);
  });

  it('substitutes written prompts when listening is unavailable', () => {
    expect(scoreLevelExam(29, 0, false).passed).toBe(true);
    expect(scoreLevelExam(23, 0, true).passed).toBe(false);
    expect(scoreLevelExam(25, 4, true).passed).toBe(true);
  });
});
