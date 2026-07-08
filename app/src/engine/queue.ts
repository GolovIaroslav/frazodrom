import type { PackItem } from './types';

// PLAN.md §6.2 — sub-drill order within a difficulty tier.
const SUB_ORDER = ['affirm', 'question', 'neg', 'wh', 'mixed'];

function subRank(sub: string): number {
  const idx = SUB_ORDER.indexOf(sub);
  return idx === -1 ? SUB_ORDER.length : idx;
}

/**
 * Orders a skill's new sentences by difficulty 1→5, and within a difficulty
 * by sub-drill order affirm → question → neg → wh → mixed (PLAN.md §6.2).
 * Stable otherwise (keeps pack order for ties) for deterministic sessions.
 */
export function buildQueue(items: readonly PackItem[]): PackItem[] {
  return [...items].sort((a, b) => {
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return subRank(a.sub) - subRank(b.sub);
  });
}

export interface InterleaveOptions {
  /** Fraction of interleaved items among the total (default 0.3, §6.2). */
  interleaveRatio?: number;
}

/**
 * Interleaves items from previously-passed skills roughly every 3rd slot.
 * When there is nothing to interleave from (e.g. the very first skill of
 * the course), this is a required no-op edge case (§6.2) — the base queue
 * is returned unchanged.
 */
export function interleaveQueue(
  baseQueue: readonly PackItem[],
  interleaveItems: readonly PackItem[],
  options: InterleaveOptions = {},
): PackItem[] {
  if (interleaveItems.length === 0) return [...baseQueue];

  const ratio = options.interleaveRatio ?? 0.3;
  const every = Math.max(1, Math.round(1 / ratio));
  const result: PackItem[] = [];
  let interleaveIdx = 0;

  for (let i = 0; i < baseQueue.length; i += 1) {
    result.push(baseQueue[i] as PackItem);
    if ((i + 1) % every === 0 && interleaveIdx < interleaveItems.length) {
      result.push(interleaveItems[interleaveIdx] as PackItem);
      interleaveIdx += 1;
    }
  }
  return result;
}

/**
 * Inserts a failed item back into the queue 2–4 positions ahead (§6.2).
 * `offset` is injectable for deterministic tests; defaults to 3.
 */
export function requeueItem<T>(queue: readonly T[], currentIndex: number, item: T, offset = 3): T[] {
  const insertAt = Math.min(queue.length, currentIndex + Math.min(4, Math.max(2, offset)));
  const result = [...queue];
  result.splice(insertAt, 0, item);
  return result;
}
