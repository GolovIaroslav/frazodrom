/** Small sync string hash (FNV-1a) — used for acceptedCache's `ruHash` key and prompt-hash invalidation (§8.5). Not cryptographic, just a stable local key. */
export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/** Canonical key into `acceptedCache` for a RU stimulus (PLAN.md §5.3/§7.2). */
export function ruHash(ruStimulus: string): string {
  return fnv1aHash(ruStimulus.trim().toLowerCase());
}
