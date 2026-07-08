// PLAN.md §10.1/§10.2/§10.6 — ts-fsrs wrapper. One FSRS card per skill (and,
// for leeches, per item) is stored as a flat set of optional fields on the
// Dexie record (`SkillStateRecord`/`ItemStateRecord`) rather than ts-fsrs's
// own `Card` shape, so this module converts both ways.

import { FSRS, Rating, State, createEmptyCard, generatorParameters, type Card, type Grade } from 'ts-fsrs';

/** FSRS-6 defaults, desired retention 0.9 (§10.1). No fuzz — deterministic due dates for tests/UI. */
export const FSRS_PARAMS = generatorParameters({ request_retention: 0.9, enable_fuzz: false });

export const fsrs = new FSRS(FSRS_PARAMS);

export { Rating };
export type { Grade };

/** The subset of Dexie fields that carry a card's FSRS state (§5.3). */
export interface FsrsFields {
  due?: number;
  stability?: number;
  difficulty?: number;
  scheduledDays?: number;
  learningSteps?: number;
  reps?: number;
  lapses?: number;
  state?: number;
  lastReview?: number;
}

/** True once a card has ever been reviewed (has FSRS fields at all). */
export function hasCard(fields: FsrsFields): boolean {
  return fields.due !== undefined;
}

export function toCard(fields: FsrsFields, now: Date): Card {
  if (!hasCard(fields)) return createEmptyCard(now);
  return {
    due: new Date(fields.due as number),
    stability: fields.stability ?? 0,
    difficulty: fields.difficulty ?? 0,
    elapsed_days: 0,
    scheduled_days: fields.scheduledDays ?? 0,
    learning_steps: fields.learningSteps ?? 0,
    reps: fields.reps ?? 0,
    lapses: fields.lapses ?? 0,
    state: (fields.state ?? State.New) as State,
    last_review: fields.lastReview !== undefined ? new Date(fields.lastReview) : undefined,
  };
}

export function fromCard(card: Card): FsrsFields {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.getTime(),
  };
}

/** PLAN.md §10.2 — session accuracy (0-1 fraction) → FSRS rating. */
export function ratingFromAccuracy(accuracy: number): Grade {
  if (accuracy < 0.6) return Rating.Again;
  if (accuracy < 0.8) return Rating.Hard;
  if (accuracy <= 0.92) return Rating.Good;
  return Rating.Easy;
}

/** Schedules the next review for a card given a rating, returning updated fields. */
export function scheduleReview(fields: FsrsFields, rating: Grade, now: Date): FsrsFields {
  const card = toCard(fields, now);
  const { card: next } = fsrs.next(card, now, rating);
  return fromCard(next);
}

/**
 * Retrievability — probability of recall right now (§10.6). A card with no
 * FSRS fields yet (never reviewed) has no meaningful forecast: callers
 * should treat `undefined` as "not started" rather than 0%.
 */
export function retrievability(fields: FsrsFields, now: Date): number | undefined {
  if (!hasCard(fields)) return undefined;
  const card = toCard(fields, now);
  return fsrs.get_retrievability(card, now, false);
}

/**
 * §10.6 honest-caveat tiers: never a solid alarm color for low values.
 * `pct` is retrievability as a 0-100 rounded percentage.
 */
export type MemoryTier = 'fresh' | 'holding' | 'dueSoon';

export function memoryTier(pct: number): MemoryTier {
  if (pct >= 80) return 'fresh';
  if (pct >= 50) return 'holding';
  return 'dueSoon';
}
