// PLAN.md §10.1/§16 — review-session queue builder. A review session pulls
// 6-10 fresh-or-long-unseen sentences per due skill and interleaves ACROSS
// skills (unlike a plain skill drill, which only interleaves in previously
// passed material — §6.2). Ф4 AC: "review мешает ≥2 навыка".

import type { PackItem } from './types';

export const REVIEW_PULL_MIN = 6;
export const REVIEW_PULL_MAX = 10;

export interface SkillPull {
  skillId: string;
  /** Fresh-or-long-unseen items for this skill, already sliced to 6-10 (§10.1). */
  items: PackItem[];
}

/**
 * Interleaves each due skill's pull into a single review queue, round-robin
 * across skills. `engine/queue.ts`'s `interleaveQueue` is deliberately NOT
 * reused here: it is a minority-injection tool (§6.2 — sprinkle ~30% review
 * items into a mostly-new-material queue) whose fixed "every Nth slot" logic
 * silently drops the tail when merging same-sized or larger sets, which a
 * review session's due-skill pulls typically are. A plain round-robin merge
 * is the simplest thing that actually guarantees every due skill is
 * represented (Ф4 AC: "review мешает ≥2 навыка") — judgment call, see report.
 */
export function buildReviewQueue(pulls: readonly SkillPull[]): PackItem[] {
  const queues = pulls.filter((p) => p.items.length > 0).map((p) => [...p.items]);
  const result: PackItem[] = [];
  let anyLeft = true;
  while (anyLeft) {
    anyLeft = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        result.push(next);
        anyLeft = true;
      }
    }
  }
  return result;
}

/**
 * Picks 6-10 items for a skill's review pull (§10.1: "fresh or long-unseen").
 * Never-attempted items sort first, then attempted items oldest-first, so a
 * review always favors what hasn't been reinforced recently.
 */
export function pickReviewItems(
  items: readonly PackItem[],
  lastAttemptByItemId: ReadonlyMap<string, number>,
): PackItem[] {
  const sorted = [...items].sort((a, b) => {
    const tsA = lastAttemptByItemId.get(a.id);
    const tsB = lastAttemptByItemId.get(b.id);
    if (tsA === undefined && tsB === undefined) return 0;
    if (tsA === undefined) return -1;
    if (tsB === undefined) return 1;
    return tsA - tsB;
  });
  return sorted.slice(0, REVIEW_PULL_MAX);
}

/**
 * Which of the given pulls' skills are represented in `queue`, by itemId
 * membership (PackItem ids don't encode a skill, so this checks against the
 * original per-skill item sets — for tests/telemetry).
 */
export function skillIdsInQueue(queue: readonly PackItem[], pulls: readonly SkillPull[]): string[] {
  const present = new Set(queue.map((item) => item.id));
  return pulls.filter((p) => p.items.some((item) => present.has(item.id))).map((p) => p.skillId);
}
