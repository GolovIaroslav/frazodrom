import { describe, expect, it } from 'vitest';
import { wordDiff } from './wordDiff';

describe('wordDiff (§7.1/§9.2)', () => {
  it('marks no words as mismatched when input equals reference', () => {
    const diff = wordDiff('I am a student', 'I am a student');
    expect(diff.every((t) => !t.mismatch)).toBe(true);
  });

  it('flags only the differing word, case-insensitively', () => {
    const diff = wordDiff('I am a Teacher', 'I am a student');
    expect(diff.map((t) => t.mismatch)).toEqual([false, false, false, true]);
  });

  it('flags extra trailing words in the user input as mismatched', () => {
    const diff = wordDiff('I am a student here', 'I am a student');
    expect(diff).toHaveLength(5);
    expect(diff[4]).toEqual({ text: 'here', mismatch: true });
  });

  it('ignores extra words only in the reference (never emits entries for words the user did not type)', () => {
    const diff = wordDiff('I am', 'I am a student');
    expect(diff).toHaveLength(2);
  });
});
