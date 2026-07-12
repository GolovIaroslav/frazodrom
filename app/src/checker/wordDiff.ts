/** Word-level diff for showing which words in `userInput` don't match `reference` (§7.1/§9.2). */
export function wordDiff(userInput: string, reference: string): { text: string; mismatch: boolean }[] {
  const userTokens = userInput.trim().split(/\s+/).filter(Boolean);
  const refTokens = reference.trim().split(/\s+/).filter(Boolean);
  const len = Math.max(userTokens.length, refTokens.length);
  const out: { text: string; mismatch: boolean }[] = [];
  for (let i = 0; i < len; i += 1) {
    const u = userTokens[i];
    const r = refTokens[i];
    if (u === undefined) continue;
    out.push({ text: u, mismatch: u.toLowerCase() !== (r ?? '').toLowerCase() });
  }
  return out;
}
