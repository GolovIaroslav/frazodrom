// PLAN.md §8.3 — daily per-provider+role call counters, safety ceilings not
// a real quota (the provider itself is the source of truth via 429).

import { db } from '../db/db';
import type { Role } from './types';

// Gemini's RPD resets at Pacific midnight (§8.3); other providers use the
// browser's local date — good enough for a soft local counter.
function dateKeyFor(providerId: string, now = new Date()): string {
  const timeZone = providerId.startsWith('gemini:') ? 'America/Los_Angeles' : undefined;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // en-CA formats as YYYY-MM-DD
}

/** True if `providerId`+`role` still has budget left today; does not consume it. */
export async function hasBudget(
  providerId: string,
  role: Role,
  ceiling: number,
  now = new Date(),
): Promise<boolean> {
  const date = dateKeyFor(providerId, now);
  const key = `${providerId}:${date}`;
  const row = await db.providerBudget.get(key);
  const used = row?.countsByRole[role] ?? 0;
  return used < ceiling;
}

/** Increments today's counter for `providerId`+`role` (call after a successful request). */
export async function consumeBudget(providerId: string, role: Role, now = new Date()): Promise<void> {
  const date = dateKeyFor(providerId, now);
  const key = `${providerId}:${date}`;
  const row = await db.providerBudget.get(key);
  const countsByRole = { ...(row?.countsByRole ?? {}) };
  countsByRole[role] = (countsByRole[role] ?? 0) + 1;
  await db.providerBudget.put({ key, providerId, date, countsByRole });
}

/** Atomically checks-then-consumes; returns false without writing if exhausted. */
export async function tryConsumeBudget(
  providerId: string,
  role: Role,
  ceiling: number,
  now = new Date(),
): Promise<boolean> {
  const ok = await hasBudget(providerId, role, ceiling, now);
  if (!ok) return false;
  await consumeBudget(providerId, role, now);
  return true;
}
