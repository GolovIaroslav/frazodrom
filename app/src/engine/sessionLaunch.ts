// Hands a pre-built queue (review/fluency-sprint/contrast-duel/error-hunt,
// §6.3/§10) from the screen that assembled it (e.g. the "Сегодня" screen) to
// the generic SessionScreen that runs it. A plain module-level slot is
// simplest here: these sessions are launched by an in-app button click and
// consumed on the very next navigation, so there is nothing to persist
// across a reload (same as the rest of the drill flow's transient state).

import type { PackItem } from './types';
import type { SessionType } from '../db/db';

export interface SessionLaunchRequest {
  type: SessionType;
  skillIds: string[];
  items: PackItem[];
  /** itemId → skillId, needed because a mixed queue's items don't carry their own skill id. */
  itemSkillMap: Record<string, string>;
  /** Fluency-sprint round time limits in minutes, e.g. [4, 3, 2] (§6.3). */
  roundLimitMinutes?: readonly number[];
}

let pending: SessionLaunchRequest | undefined;

export function setPendingSession(req: SessionLaunchRequest): void {
  pending = req;
}

/**
 * Read-only — does NOT clear the slot. Deliberately non-destructive: React
 * StrictMode's dev-mode double-invoke (mount → cleanup → mount) means the
 * effect that consumes this can run twice for one real navigation, and a
 * destructive "take" would make the second (surviving) invocation see
 * nothing. Call `clearPendingSession()` once the consuming effect has
 * actually succeeded (see DrillScreen's loading effect).
 */
export function peekPendingSession(): SessionLaunchRequest | undefined {
  return pending;
}

export function clearPendingSession(): void {
  pending = undefined;
}
