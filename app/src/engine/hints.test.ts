import { describe, expect, it } from 'vitest';
import { getHint } from './hints';

describe('getHint', () => {
  it('L1 returns the skill formula/pattern', () => {
    expect(getHint(1, 'I am / he is / they are + …', 'I am a student.')).toBe(
      'I am / he is / they are + …',
    );
  });

  it('L2 reveals only the first letter of each word', () => {
    expect(getHint(2, 'pattern', 'I am a student')).toBe('I a_ a s______');
  });

  it('L2 preserves non-letter characters (punctuation, apostrophes)', () => {
    expect(getHint(2, 'pattern', "It's love.")).toBe("I_'_ l___.");
  });
});
