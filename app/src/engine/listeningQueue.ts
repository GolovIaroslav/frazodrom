// PLAN.md §9.2 — listening sessions pull from already-covered skills
// ("те же паки предложения пройденных навыков"). "Covered" here means the
// learner has attempted the skill at least once (skillState exists) —
// mirrors the review queue's own selection logic (`pickReviewItems`) rather
// than requiring `status === 'passed'`, since that status is itself only a
// proxy gate (§11 exams don't exist yet, see Ф4's report).

import type { PackItem } from './types';
import { pickReviewItems } from './reviewQueue';

export const LISTENING_PULL_MAX = 10;

export interface ListeningSkillPull {
  skillId: string;
  items: PackItem[];
}

/** Builds a flat listening queue across covered skills, capped at `itemCap`. */
export function buildListeningQueue(
  pulls: readonly { skillId: string; items: readonly PackItem[] }[],
  lastAttemptByItemId: ReadonlyMap<string, number>,
  itemCap: number,
): { items: PackItem[]; itemSkillMap: Record<string, string> } {
  const items: PackItem[] = [];
  const itemSkillMap: Record<string, string> = {};
  for (const pull of pulls) {
    const picked = pickReviewItems(pull.items, lastAttemptByItemId).slice(0, LISTENING_PULL_MAX);
    for (const item of picked) {
      items.push(item);
      itemSkillMap[item.id] = pull.skillId;
    }
  }
  return { items: items.slice(0, itemCap), itemSkillMap };
}
