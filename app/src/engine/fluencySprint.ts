// PLAN.md §6.3 — fluency sprint (Nation's 4/3/2). Only on skills the learner
// already has accuracy > 90% on; the SAME ~10-sentence set is replayed 3
// rounds with shrinking time limits, no error penalties.

import type { PackItem } from './types';

/** Phase 4 AC: sprint opens only for skills with accuracy >90%. Strict >, per §6.3. */
export function canStartFluencySprint(accuracy: number): boolean {
  return accuracy > 0.9;
}

export const FLUENCY_SPRINT_ROUND_MINUTES = [4, 3, 2] as const;
export const FLUENCY_SPRINT_ITEM_COUNT = 10;

export interface FluencySprintRound {
  round: number;
  limitMinutes: number;
  items: PackItem[];
}

/**
 * Picks up to FLUENCY_SPRINT_ITEM_COUNT items (stable order — pack order is
 * fine, this is drilling fluency on already-mastered material, not novelty)
 * and replays the SAME set across all 3 rounds with shrinking limits.
 */
export function buildFluencySprint(items: readonly PackItem[]): FluencySprintRound[] {
  const set = items.slice(0, FLUENCY_SPRINT_ITEM_COUNT);
  return FLUENCY_SPRINT_ROUND_MINUTES.map((limitMinutes, i) => ({
    round: i + 1,
    limitMinutes,
    items: set,
  }));
}
