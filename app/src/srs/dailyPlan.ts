// PLAN.md §10.5 — daily plan for the Today screen. Built from what
// concretely exists after Phase 4 (skill FSRS cards, errorProfile, leeches,
// packs/index.json module structure). Deliberately NOT included (see report
// / PLAN.md §16 note): point 5 (personal examples — needs
// LESSON_GEN's on-demand AI-lesson feature, §8.4, out of scope here), point
// 6 (writing-vs-speech balance — needs listening/speaking, Phase 5), point 8
// (level-based activity-mix shift — needs a level system Phase 4 does not build).

import type { PacksIndex } from '../engine/types';
import type { SkillStateRecord } from '../db/db';
import { memoryTier, retrievability, type MemoryTier } from './fsrs';

/** §10.5 point 7 — cap on review sessions surfaced per day; the rest wait. */
export const MAX_DAILY_REVIEWS = 3;

export interface DueSkillPlanEntry {
  skillId: string;
  pct: number | undefined;
  tier: MemoryTier | 'new';
}

export interface DailyPlan {
  /** Due skills, weakest-retrievability-first, capped at MAX_DAILY_REVIEWS (§10.5 point 1/7). */
  dueSkills: DueSkillPlanEntry[];
  /** How many more are due but waiting behind the cap. */
  overflowCount: number;
  /** Leech item ids to weave into warmups (§10.5 point 2). */
  leechItemIds: string[];
  /** Next skill to continue in the current module (§10.5 point 3), if any. */
  continueSkillId: string | undefined;
  /** Error-hunt suggestion tags, if any crossed the threshold (§10.5 point 4). */
  errorHuntTags: string[] | undefined;
}

export interface BuildDailyPlanInput {
  skillStates: readonly SkillStateRecord[];
  leechItemIds: readonly string[];
  errorHuntTags: readonly string[] | undefined;
  packsIndex: PacksIndex | undefined;
  now: Date;
}

/** Skills with a due FSRS card at or before `now`, weakest retrievability first. */
export function rankDueSkills(skillStates: readonly SkillStateRecord[], now: Date): DueSkillPlanEntry[] {
  const due = skillStates.filter((s) => s.due !== undefined && s.due <= now.getTime());
  const withPct = due.map((s) => {
    const r = retrievability(s, now);
    const pct = r !== undefined ? Math.round(r * 100) : undefined;
    return { skillId: s.skillId, pct, tier: pct !== undefined ? memoryTier(pct) : ('new' as const) };
  });
  return withPct.sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
}

/** First skill in course order that is `available` or `in_progress` (§10.5 point 3). */
export function findContinueSkill(
  packsIndex: PacksIndex | undefined,
  skillStates: readonly SkillStateRecord[],
): string | undefined {
  if (!packsIndex) return undefined;
  const stateById = new Map(skillStates.map((s) => [s.skillId, s]));
  for (const level of packsIndex.levels) {
    for (const module of level.modules) {
      for (const skill of module.skills) {
        const status = stateById.get(skill.id)?.status;
        if (status === 'in_progress' || status === 'available' || status === undefined) return skill.id;
      }
    }
  }
  return undefined;
}

export function buildDailyPlan(input: BuildDailyPlanInput): DailyPlan {
  const ranked = rankDueSkills(input.skillStates, input.now);
  return {
    dueSkills: ranked.slice(0, MAX_DAILY_REVIEWS),
    overflowCount: Math.max(0, ranked.length - MAX_DAILY_REVIEWS),
    leechItemIds: [...input.leechItemIds],
    continueSkillId: findContinueSkill(input.packsIndex, input.skillStates),
    errorHuntTags: input.errorHuntTags && input.errorHuntTags.length > 0 ? [...input.errorHuntTags] : undefined,
  };
}
