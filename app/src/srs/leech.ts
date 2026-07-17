// PLAN.md §10.3 — leeches. A sentence failed ≥2 times across DIFFERENT
// sessions gets its own per-item FSRS card (itemState's placeholder fields),
// rated by outcome, and is woven into warmups/review until stability > 30
// days. Voice/STT failures never create leeches (§9.4) — there is no STT in
// this app yet (Phases 5/7), so every attempt recorded today is a text attempt;
// this module simply never special-cases a voice modality, which is the
// correct no-op for now (there is nothing to guard against yet).

import { db } from '../db/db';
import { Rating, hasCard, scheduleReview, type FsrsFields, type Grade } from './fsrs';

/** Days of stability above which a leech is considered resolved (§10.3). */
export const LEECH_RESOLVED_STABILITY_DAYS = 30;

/**
 * Counts the number of DISTINCT sessions in which `itemId` was answered
 * "wrong" (tier 0-2 or an escalated final verdict — either way `verdict:
 * 'wrong'` on the attempt). Attempts without a `sessionId` (older data, or a
 * call site that hasn't been wired to a session yet) cannot be attributed to
 * a session and are ignored for this count — undercounting is the safe
 * direction here (never a false leech from unattributed data).
 */
export async function countFailedSessions(itemId: string): Promise<number> {
  const attempts = await db.attempts.where('itemId').equals(itemId).toArray();
  const failedSessionIds = new Set<number>();
  for (const a of attempts) {
    if (a.verdict === 'wrong' && a.sessionId !== undefined) failedSessionIds.add(a.sessionId);
  }
  return failedSessionIds.size;
}

/**
 * Checks whether `itemId` should become (or remain) a leech and, if so,
 * ensures `itemState.isLeech` is set — creating the row if needed. Call this
 * after recording a "wrong" attempt with a `sessionId`. Returns whether the
 * item is a leech after this call.
 */
export async function checkAndMarkLeech(itemId: string, now = Date.now()): Promise<boolean> {
  const failedSessions = await countFailedSessions(itemId);
  const existing = await db.itemState.get(itemId);
  const isLeech = failedSessions >= 2;

  if (!existing) {
    await db.itemState.put({
      itemId,
      seenCount: 0,
      failCount: failedSessions,
      isLeech,
    });
    return isLeech;
  }

  if (existing.isLeech !== isLeech) {
    await db.itemState.put({ ...existing, isLeech });
  }
  void now;
  return isLeech;
}

/** Outcome of a leech's next attempt → FSRS rating (§10.3). */
export type LeechOutcome = 'fail' | 'hintAssisted' | 'clean';

export function ratingFromLeechOutcome(outcome: LeechOutcome): Grade {
  if (outcome === 'fail') return Rating.Again;
  if (outcome === 'hintAssisted') return Rating.Hard;
  return Rating.Good;
}

/** Updates a leech's own FSRS card after an attempt on it (§10.3). */
export async function reviewLeech(itemId: string, outcome: LeechOutcome, now = Date.now()): Promise<void> {
  const existing = await db.itemState.get(itemId);
  const fields: FsrsFields = existing ?? {};
  const rating = ratingFromLeechOutcome(outcome);
  const updated = scheduleReview(fields, rating, new Date(now));
  await db.itemState.put({
    itemId,
    seenCount: (existing?.seenCount ?? 0) + 1,
    failCount: (existing?.failCount ?? 0) + (outcome === 'fail' ? 1 : 0),
    isLeech: (updated.stability ?? 0) <= LEECH_RESOLVED_STABILITY_DAYS,
    ...updated,
  });
}

/** True while a leech should still surface in warmups/review (§10.3). */
export function isLeechStillActive(fields: FsrsFields): boolean {
  if (!hasCard(fields)) return true;
  return (fields.stability ?? 0) <= LEECH_RESOLVED_STABILITY_DAYS;
}

/**
 * Fetches all itemIds currently flagged as active leeches, for warmup/review
 * weaving. `itemState` only indexes `itemId` (§5.3), so this is a full-table
 * scan — fine at this app's scale (hundreds, not millions, of items).
 */
export async function getActiveLeechItemIds(): Promise<string[]> {
  const all = await db.itemState.toArray();
  return all.filter((r) => r.isLeech).map((r) => r.itemId);
}
