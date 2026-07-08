/** True if `a` can become `b` via exactly one insertion, deletion, or substitution. */
export function isEditDistanceOne(a: string, b: string): boolean {
  if (a === b) return false;
  const lenDiff = Math.abs(a.length - b.length);
  if (lenDiff > 1) return false;

  if (a.length === b.length) {
    let mismatches = 0;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) mismatches += 1;
      if (mismatches > 1) return false;
    }
    return mismatches === 1;
  }

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] === shorter[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    i += 1;
  }
  return true;
}
