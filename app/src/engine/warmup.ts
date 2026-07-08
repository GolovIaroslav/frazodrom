// PLAN.md §10.5 point 2 — leeches "vplyayutsya" (woven) into warmups. This is
// exactly the minority-injection shape `interleaveQueue` (§6.2) was built
// for: a handful of leech items sprinkled into an otherwise-normal queue, as
// opposed to `reviewQueue.ts`'s round-robin merge of same-sized due-skill
// pulls (see the comment there for why that one couldn't reuse it).

import type { PackItem } from './types';
import { interleaveQueue } from './queue';

/** Weaves leech items into the front of a session queue as its warmup (§6.2 `reviewWarmup`, §10.5). */
export function weaveLeechesIntoQueue(queue: readonly PackItem[], leechItems: readonly PackItem[]): PackItem[] {
  return interleaveQueue(queue, leechItems);
}
