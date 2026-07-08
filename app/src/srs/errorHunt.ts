// PLAN.md §10.4 — error-hunting: top-3 error tags (by errorProfile.count30d)
// above a threshold → a static tag→skills lookup → a session drawing from
// those skills. A handful of representative entries, concretely justified
// from the CURRENT 11 A1 skills (packs/index.json) — not a speculative
// mapping of all ~75 skills from §3.4 that don't exist in packs yet.

import { db } from '../db/db';
import type { ErrorProfileRecord } from '../db/db';

export const TAG_TO_SKILLS: Readonly<Record<string, readonly string[]>> = {
  // "he go" / "she don't" — 3rd person -s and do/does agreement.
  aux_missing: ['a1_do_questions', 'a1_does_questions'],
  agreement: ['a1_pres_simple_3rd', 'a1_does_questions'],
  // "he no go" / word order in questions and negatives.
  word_order: ['a1_be_neg_quest', 'a1_do_questions', 'a1_dont_doesnt'],
  // his/her/my mixups.
  pronoun: ['a1_pronouns_poss'],
  // "much English" instead of "usually/often" — frequency-adverb misuse.
  vocab_choice: ['a1_freq_adverbs'],
};

/** §10.4 — a tag only "counts" for the suggestion once it crosses this 30-day frequency. */
export const ERROR_HUNT_THRESHOLD = 3;

export interface ErrorHuntSuggestion {
  tags: string[];
  skillIds: string[];
}

/**
 * Reads `errorProfile`, takes the top-3 tags by count30d, keeps only those
 * above the threshold, and maps them (via TAG_TO_SKILLS) to a deduplicated
 * skill list. Returns undefined when nothing crosses the threshold or no
 * top tag maps to a known skill — the "Сегодня" screen simply omits the
 * suggestion in that case (§10.5 point 4: "если какой-то тег > порога").
 */
export async function suggestErrorHunt(threshold = ERROR_HUNT_THRESHOLD): Promise<ErrorHuntSuggestion | undefined> {
  const all = await db.errorProfile.toArray();
  const top = rankTopTags(all, threshold);
  if (top.length === 0) return undefined;

  const skillIds = [...new Set(top.flatMap((tag) => TAG_TO_SKILLS[tag] ?? []))];
  if (skillIds.length === 0) return undefined;

  return { tags: top, skillIds };
}

/** Pure helper (testable without Dexie): top-3 tags by count30d above threshold. */
export function rankTopTags(rows: readonly ErrorProfileRecord[], threshold = ERROR_HUNT_THRESHOLD): string[] {
  return [...rows]
    .filter((r) => r.count30d > threshold)
    .sort((a, b) => b.count30d - a.count30d)
    .slice(0, 3)
    .map((r) => r.tag);
}
