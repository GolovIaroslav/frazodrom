// PLAN.md §6.3 — contrast-duels: mixed pairs of two skills learners commonly
// confuse, offered only once both are passed; mixes items from both without
// warning. Static table, concrete pairs from the CURRENT A1 skillset only
// (packs/index.json as of Ф4) — do not invent pairs for skills that don't
// exist yet; extend this table as later modules land.

import type { PackItem } from './types';

/** [skillA, skillB] — order is not meaningful, just a stable pair id. */
export const CONTRAST_DUELS: readonly [string, string][] = [
  // "Do you...?" vs "Does he/she...?" — the classic 3rd-person-singular mixup.
  ['a1_do_questions', 'a1_does_questions'],
  // Present Simple I/you/we/they (V1) vs he/she (V-s) — same confusion, statement form.
  ['a1_pres_simple_i', 'a1_pres_simple_3rd'],
];

export function availableContrastDuels(passedSkillIds: ReadonlySet<string>): [string, string][] {
  return CONTRAST_DUELS.filter(([a, b]) => passedSkillIds.has(a) && passedSkillIds.has(b));
}

/**
 * Mixes items from both skills of a duel "without warning" (§6.3) — a
 * deterministic alternating merge is enough to interleave the two forms;
 * true randomization is a UI-layer concern (shuffle before display) and not
 * needed for the engine's queue-building contract.
 */
export function buildContrastDuelQueue(itemsA: readonly PackItem[], itemsB: readonly PackItem[]): PackItem[] {
  const result: PackItem[] = [];
  const max = Math.max(itemsA.length, itemsB.length);
  for (let i = 0; i < max; i += 1) {
    if (itemsA[i]) result.push(itemsA[i] as PackItem);
    if (itemsB[i]) result.push(itemsB[i] as PackItem);
  }
  return result;
}
