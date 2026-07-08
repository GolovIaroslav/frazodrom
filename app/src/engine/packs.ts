import { db } from '../db/db';
import type { PacksIndex, SkillPack } from './types';

// Packs are static files copied into the app's public output from ../packs
// (see vite.config.ts). Fetch is relative to BASE_URL so it works both in
// dev and under a GitHub Pages sub-path.
function packUrl(path: string): string {
  return `${import.meta.env.BASE_URL}packs/${path}`;
}

let indexPromise: Promise<PacksIndex> | undefined;

export function loadPacksIndex(): Promise<PacksIndex> {
  indexPromise ??= fetch(packUrl('index.json')).then((res) => {
    if (!res.ok) throw new Error(`Failed to load packs/index.json: ${res.status}`);
    return res.json() as Promise<PacksIndex>;
  });
  return indexPromise;
}

/**
 * Lazily loads a skill pack: cached copy from Dexie if present, otherwise
 * fetches packs/{skillId}.json and stores it (PLAN.md §5.3).
 */
export async function loadPack(skillId: string): Promise<SkillPack> {
  const cached = await db.packs.get(skillId);
  if (cached) return cached.data;

  const res = await fetch(packUrl(`${skillId}.json`));
  if (!res.ok) throw new Error(`Failed to load pack ${skillId}: ${res.status}`);
  const data = (await res.json()) as SkillPack;

  await db.packs.put({
    skillId,
    version: data.schema_version,
    checksum: '',
    data,
  });

  return data;
}
