import { describe, expect, it, vi } from 'vitest';
import { Rating, fromCard, hasCard, memoryTier, ratingFromAccuracy, retrievability, scheduleReview, toCard } from './fsrs';
import { createEmptyCard } from 'ts-fsrs';

describe('ratingFromAccuracy (§10.2 table)', () => {
  it('maps <60% to Again', () => {
    expect(ratingFromAccuracy(0)).toBe(Rating.Again);
    expect(ratingFromAccuracy(0.59)).toBe(Rating.Again);
  });
  it('maps 60-79% to Hard', () => {
    expect(ratingFromAccuracy(0.6)).toBe(Rating.Hard);
    expect(ratingFromAccuracy(0.79)).toBe(Rating.Hard);
  });
  it('maps 80-92% to Good', () => {
    expect(ratingFromAccuracy(0.8)).toBe(Rating.Good);
    expect(ratingFromAccuracy(0.92)).toBe(Rating.Good);
  });
  it('maps >92% to Easy', () => {
    expect(ratingFromAccuracy(0.93)).toBe(Rating.Easy);
    expect(ratingFromAccuracy(1)).toBe(Rating.Easy);
  });
});

describe('toCard/fromCard round-trip', () => {
  it('treats an empty field set as a fresh card', () => {
    expect(hasCard({})).toBe(false);
    const now = new Date('2026-07-08T00:00:00Z');
    const card = toCard({}, now);
    const empty = createEmptyCard(now);
    expect(card.state).toBe(empty.state);
    expect(card.reps).toBe(0);
  });

  it('restores a previously-saved card from its fields', () => {
    const now = new Date('2026-07-08T00:00:00Z');
    const fields = fromCard(createEmptyCard(now));
    const restored = toCard(fields, now);
    expect(restored.due.getTime()).toBe(fields.due);
    expect(restored.stability).toBe(fields.stability);
  });
});

describe('due-date scheduling with fake timers (Ф4 AC)', () => {
  it('pushes the due date into the future after a Good review, and further out on a second Good review', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T00:00:00Z'));
    const now1 = new Date();

    const afterFirst = scheduleReview({}, Rating.Good, now1);
    expect(afterFirst.due).toBeGreaterThan(now1.getTime());
    const firstInterval = (afterFirst.due as number) - now1.getTime();

    // advance the clock to exactly the first due date, then review again
    vi.setSystemTime(new Date(afterFirst.due as number));
    const now2 = new Date();
    const afterSecond = scheduleReview(afterFirst, Rating.Good, now2);
    const secondInterval = (afterSecond.due as number) - now2.getTime();

    expect(secondInterval).toBeGreaterThan(firstInterval);
    vi.useRealTimers();
  });

  it('shortens the next interval after an Again (fail) review compared to a prior Good streak', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T00:00:00Z'));
    let fields = scheduleReview({}, Rating.Good, new Date());
    vi.setSystemTime(new Date(fields.due as number));
    fields = scheduleReview(fields, Rating.Good, new Date());
    const goodDue = fields.due as number;

    vi.setSystemTime(new Date(goodDue));
    const afterAgain = scheduleReview(fields, Rating.Again, new Date(goodDue));
    const dayMs = 24 * 60 * 60 * 1000;
    // Again should schedule a short relearning step, much sooner than the
    // multi-day interval a repeated Good review would have produced.
    expect((afterAgain.due as number) - goodDue).toBeLessThan(dayMs);
    vi.useRealTimers();
  });

  it('retrievability decays as the due date approaches from a past review', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T00:00:00Z'));
    const reviewed = scheduleReview({}, Rating.Good, new Date());

    const soonAfter = retrievability(reviewed, new Date(reviewed.lastReview as number));
    vi.setSystemTime(new Date((reviewed.due as number) + 10 * 24 * 60 * 60 * 1000));
    const longAfter = retrievability(reviewed, new Date());

    expect(soonAfter).toBeDefined();
    expect(longAfter).toBeDefined();
    expect((longAfter as number)).toBeLessThan(soonAfter as number);
    vi.useRealTimers();
  });

  it('returns undefined retrievability for a never-reviewed card', () => {
    expect(retrievability({}, new Date())).toBeUndefined();
  });
});

describe('memoryTier (§10.6 — never alarm-red, tiered honesty caveat)', () => {
  it('tiers percentages without producing an alarm color at the low end', () => {
    expect(memoryTier(95)).toBe('fresh');
    expect(memoryTier(65)).toBe('holding');
    expect(memoryTier(20)).toBe('dueSoon');
  });
});
