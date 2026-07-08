export type HintLevel = 1 | 2;

/**
 * Hint ladder (§6.1): L1 is the formula-level pattern hint; L2 opens each
 * word letter-by-letter (first letter revealed, rest masked).
 */
export function getHint(level: HintLevel, pattern: string, enMain: string): string {
  if (level === 1) return pattern;

  return enMain
    .split(' ')
    .map((word) => {
      const letters = word.match(/[a-zA-Z]/g);
      if (!letters || letters.length === 0) return word;
      let shown = 0;
      return word.replace(/[a-zA-Z]/g, (ch) => {
        shown += 1;
        return shown === 1 ? ch : '_';
      });
    })
    .join(' ');
}
