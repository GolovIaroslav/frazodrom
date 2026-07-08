// PLAN.md §7.2/§7.5 — acceptedCache writes from a judge verdict, and the
// dispute-driven removal that keeps a bad add_to_accepted from living forever.

import { db } from '../db/db';
import { ruHash } from './hash';

export async function addToAcceptedCache(
  ruStimulus: string,
  en: string,
  source: string,
  ts = Date.now(),
): Promise<void> {
  const key = ruHash(ruStimulus);
  const row = await db.acceptedCache.get(key);
  const entries = row?.entries ?? [];
  if (entries.some((e) => e.en.trim().toLowerCase() === en.trim().toLowerCase())) return;
  await db.acceptedCache.put({ ruHash: key, entries: [...entries, { en, source, ts }] });
}

export async function getAcceptedCacheEntries(ruStimulus: string): Promise<string[]> {
  const row = await db.acceptedCache.get(ruHash(ruStimulus));
  return row?.entries.map((e) => e.en) ?? [];
}

/** §7.5 — "remove this from acceptedCache" offered next to a 🚩 dispute on a correct/acceptable verdict. */
export async function removeFromAcceptedCache(ruStimulus: string, en: string): Promise<void> {
  const key = ruHash(ruStimulus);
  const row = await db.acceptedCache.get(key);
  if (!row) return;
  const entries = row.entries.filter((e) => e.en.trim().toLowerCase() !== en.trim().toLowerCase());
  if (entries.length === 0) await db.acceptedCache.delete(key);
  else await db.acceptedCache.put({ ruHash: key, entries });
}
