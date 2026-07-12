// PLAN.md §10 — session bookkeeping. Wires the engine-layer SRS/session
// pieces (fsrs.ts, leech.ts) into Dexie: opens a SessionRecord, and on finish
// rolls per-skill session accuracy into skillState's FSRS card (§10.2) and
// runs the leech check (§10.3) on every item that had a wrong attempt.

import { db } from '../db/db';
import type { SessionType, SkillStateRecord } from '../db/db';
import { ratingFromAccuracy, scheduleReview } from './fsrs';
import { checkAndMarkLeech } from './leech';

export interface ItemOutcome {
  itemId: string;
  skillId: string;
  /** Final verdict for this item this session — 'correct'/'minor_error' both count as correct (§10.2 accuracy). */
  correct: boolean;
}

// §6.3's contrast-duels want a real "skill passed" set ("предлагается, когда
// оба навыка пройдены") but §11's exam-based passing doesn't exist yet — a
// documented accuracy-threshold proxy, same bar as the fluency-sprint gate
// (§16 Ф4 AC, `canStartFluencySprint`), over a minimum sample so a single
// lucky short session can't flip it. Once real exams land (§11), this should
// be replaced or gated further by an exam pass, not removed outright.
export const SKILL_PASS_ACCURACY_THRESHOLD = 0.9;
export const SKILL_PASS_MIN_ATTEMPTS = 10;

export async function startSession(type: SessionType, skillIds: string[], now = Date.now()): Promise<number> {
  const id = await db.sessions.add({ type, skillIds, startedAt: now, stats: { total: 0, correct: 0 } });
  return id as number;
}

/**
 * Finalizes a session: marks it finished with final stats, updates each
 * touched skill's FSRS card from that skill's accuracy THIS session (§10.2 —
 * the rating is per-session, not a lifetime average), and checks leech
 * status for every item that had a wrong attempt (§10.3).
 */
export async function finishSession(
  sessionId: number,
  outcomes: readonly ItemOutcome[],
  now = Date.now(),
): Promise<void> {
  const total = outcomes.length;
  const correct = outcomes.filter((o) => o.correct).length;
  await db.sessions.update(sessionId, { finishedAt: now, stats: { total, correct } });

  const bySkill = new Map<string, ItemOutcome[]>();
  for (const outcome of outcomes) {
    const list = bySkill.get(outcome.skillId) ?? [];
    list.push(outcome);
    bySkill.set(outcome.skillId, list);
  }

  for (const [skillId, items] of bySkill) {
    const skillCorrect = items.filter((i) => i.correct).length;
    const accuracy = items.length > 0 ? skillCorrect / items.length : 0;
    const existing = await db.skillState.get(skillId);
    const rating = ratingFromAccuracy(accuracy);
    const fsrsFields = scheduleReview(existing ?? {}, rating, new Date(now));
    const attemptCount = (existing?.attemptCount ?? 0) + items.length;
    const correctCount = (existing?.correctCount ?? 0) + skillCorrect;
    const lifetimeAccuracy = attemptCount > 0 ? correctCount / attemptCount : 0;
    // Sticky once passed — a single weak session shouldn't un-pass a skill
    // that's otherwise solid; see the constants' doc comment above.
    const status: SkillStateRecord['status'] =
      existing?.status === 'passed' ||
      (attemptCount >= SKILL_PASS_MIN_ATTEMPTS && lifetimeAccuracy > SKILL_PASS_ACCURACY_THRESHOLD)
        ? 'passed'
        : (existing?.status ?? 'in_progress');
    const record: SkillStateRecord = {
      skillId,
      status,
      accuracy,
      attemptCount,
      correctCount,
      ...fsrsFields,
    };
    await db.skillState.put(record);
  }

  for (const outcome of outcomes) {
    if (!outcome.correct) await checkAndMarkLeech(outcome.itemId, now);
  }
}
