/** True if `a` can become `b` via exactly one insertion, deletion, substitution, or adjacent-letter transposition. */
export function isEditDistanceOne(a: string, b: string): boolean {
  if (a === b) return false;
  const lenDiff = Math.abs(a.length - b.length);
  if (lenDiff > 1) return false;

  if (a.length === b.length) {
    const mismatchIndices: number[] = [];
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) mismatchIndices.push(i);
      if (mismatchIndices.length > 2) return false;
    }
    if (mismatchIndices.length === 1) return true;
    if (mismatchIndices.length === 2) {
      const [i, j] = mismatchIndices;
      return j === i + 1 && a[i] === b[j] && a[j] === b[i];
    }
    return false;
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
