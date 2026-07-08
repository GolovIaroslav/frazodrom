import { describe, expect, it } from 'vitest';
import { DrillEngine } from './session';
import type { PackItem } from './types';

function item(overrides: Partial<PackItem> = {}): PackItem {
  return {
    id: 's1',
    ru: 'Он студент.',
    en_main: 'He is a student.',
    en_accepted: ['He\'s a student.'],
    sub: 'affirm',
    difficulty: 1,
    cefr_lex: 'A1',
    source: 'tatoeba:1',
    attribution: 'x',
    ...overrides,
  };
}

describe('DrillEngine — happy path', () => {
  it('a correct first-try answer needs a second Enter (advance) to move to the next item', () => {
    const engine = new DrillEngine([item()]);
    const result = engine.submitAnswer('He is a student.');
    expect(result).toEqual({ verdict: 'correct', mustRewrite: false });
    expect(engine.phase).toBe('answer');
    expect(engine.isPendingAdvance).toBe(true);

    engine.advance();
    expect(engine.phase).toBe('finished');
    expect(engine.stats).toEqual({ total: 1, correct: 1 });
  });

  it('finishes immediately for an empty queue', () => {
    const engine = new DrillEngine([]);
    expect(engine.phase).toBe('finished');
  });
});

describe('DrillEngine — REWRITE cycle', () => {
  it('hides the reference, blanks the field, and requires retrieval after give up', () => {
    const engine = new DrillEngine([item()]);
    const refs = engine.giveUp();
    expect(refs).toEqual(['He is a student.', "He's a student."]);
    expect(engine.phase).toBe('rewrite');
    expect(engine.isReferenceVisible).toBe(true);
  });

  it('succeeds on an exact repeat of the shown reference and advances', () => {
    const engine = new DrillEngine([item(), item({ id: 's2' })]);
    engine.giveUp();
    const result = engine.submitRewrite('He is a student.');
    expect(result).toEqual({ success: true, referenceVisible: false });
    expect(engine.phase).toBe('answer');
    expect(engine.currentItem?.id).toBe('s2');
  });

  it('accepts any of the shown reference lines, not just the primary one', () => {
    const engine = new DrillEngine([item()]);
    engine.giveUp();
    const result = engine.submitRewrite("He's a student.");
    expect(result.success).toBe(true);
  });

  it('cycles on a wrong rewrite: fail once, reference reappears, still in rewrite phase', () => {
    const engine = new DrillEngine([item()]);
    engine.giveUp();
    const result = engine.submitRewrite('completely different sentence');
    expect(result).toEqual({ success: false, referenceVisible: false });
    expect(engine.phase).toBe('rewrite');
  });

  it('safety valve: after a 2nd consecutive REWRITE fail, the reference stays visible', () => {
    const engine = new DrillEngine([item()]);
    engine.giveUp();
    engine.submitRewrite('wrong once');
    const second = engine.submitRewrite('wrong twice');
    expect(second).toEqual({ success: false, referenceVisible: true });
    expect(engine.isReferenceVisible).toBe(true);
  });

  it('a minor spelling error is scored correct but still forces a REWRITE', () => {
    const engine = new DrillEngine([item({ en_main: 'He likes tea.', en_accepted: [] })]);
    const result = engine.submitAnswer('He likes tae.');
    expect(result.verdict).toBe('minor_error');
    expect(result.mustRewrite).toBe(true);
    expect(engine.phase).toBe('rewrite');
  });
});

describe('DrillEngine — applyEscalation (tier 3/4 result after a tier 0-2 wrong, §7.2/§6.1)', () => {
  it('correct/acceptable from the judge counts as correct and needs a second Enter to advance, no REWRITE', () => {
    const engine = new DrillEngine([item()]);
    engine.submitAnswer('gibberish');
    const outcome = engine.applyEscalation('acceptable');
    expect(outcome).toEqual({ verdict: 'correct', mustRewrite: false });
    expect(engine.phase).toBe('answer');
    expect(engine.isPendingAdvance).toBe(true);
  });

  it('minor_error from the judge shows the reference and forces REWRITE', () => {
    const engine = new DrillEngine([item()]);
    engine.submitAnswer('gibberish');
    const outcome = engine.applyEscalation('minor_error');
    expect(outcome).toEqual({ verdict: 'minor_error', mustRewrite: true });
    expect(engine.phase).toBe('rewrite');
    expect(engine.isReferenceVisible).toBe(true);
  });

  it('a final wrong from the judge/self-check does NOT reveal the reference or force REWRITE — retry/hint/give-up stay available (§6.1)', () => {
    const engine = new DrillEngine([item()]);
    engine.submitAnswer('gibberish');
    const outcome = engine.applyEscalation('wrong');
    expect(outcome).toEqual({ verdict: 'wrong', mustRewrite: false });
    expect(engine.phase).toBe('answer');
    expect(engine.isReferenceVisible).toBe(false);
  });
});

describe('DrillEngine — hint ladder', () => {
  it('starts at 0 and climbs to L1 then caps at L2', () => {
    const engine = new DrillEngine([item()]);
    expect(engine.currentHintLevel).toBe(0);
    expect(engine.requestHint()).toBe(1);
    expect(engine.requestHint()).toBe(2);
    expect(engine.requestHint()).toBe(2);
  });

  it('resets the hint level after moving to the next item', () => {
    const engine = new DrillEngine([item(), item({ id: 's2' })]);
    engine.requestHint();
    engine.requestHint();
    expect(engine.currentHintLevel).toBe(2);
    engine.submitAnswer('He is a student.');
    engine.advance();
    expect(engine.currentHintLevel).toBe(0);
  });
});

describe('DrillEngine — requeue on failure', () => {
  it('re-inserts a sentence that was answered wrong back into the queue 2-4 slots ahead', () => {
    const items = [item({ id: 's1' }), item({ id: 's2' }), item({ id: 's3' }), item({ id: 's4' })];
    const engine = new DrillEngine(items);

    engine.submitAnswer('totally wrong');
    expect(engine.phase).toBe('answer');
    engine.giveUp();
    engine.submitRewrite('He is a student.');

    const remainingIds: string[] = [];
    let current = engine.currentItem;
    while (current) {
      remainingIds.push(current.id);
      if (current.id === 's1') {
        // the requeued copy of s1 should reappear later in the same session
      }
      const res = engine.submitAnswer(current.en_main);
      if (res.verdict === 'correct') engine.advance();
      current = engine.currentItem;
    }

    expect(remainingIds.filter((id) => id === 's1').length).toBeGreaterThanOrEqual(1);
    expect(remainingIds).toContain('s1');
  });

  it('does not requeue a sentence that was answered correctly on the first try', () => {
    const items = [item({ id: 's1' }), item({ id: 's2' }), item({ id: 's3' })];
    const engine = new DrillEngine(items);
    engine.submitAnswer(items[0]!.en_main);
    engine.advance();
    engine.submitAnswer(items[1]!.en_main);
    engine.advance();
    engine.submitAnswer(items[2]!.en_main);
    engine.advance();
    expect(engine.phase).toBe('finished');
  });
});
