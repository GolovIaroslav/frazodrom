// Number words 0-100 -> digits (PLAN.md §7.1.3).
const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

const TEENS: Record<string, number> = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/** Merge runs of number words ("twenty two") into a single digit token. */
export function wordsToNumbers(tokens: readonly string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const word = tokens[i];
    if (word === 'hundred' && out.length > 0 && /^\d+$/.test(out[out.length - 1] ?? '')) {
      const prev = Number(out.pop());
      out.push(String(prev * 100));
      i += 1;
      continue;
    }
    if (word in TENS) {
      const next = tokens[i + 1];
      if (next !== undefined && next in ONES && next !== 'zero') {
        out.push(String(TENS[word] + ONES[next]));
        i += 2;
        continue;
      }
      out.push(String(TENS[word]));
      i += 1;
      continue;
    }
    if (word in TEENS) {
      out.push(String(TEENS[word]));
      i += 1;
      continue;
    }
    if (word in ONES) {
      out.push(String(ONES[word]));
      i += 1;
      continue;
    }
    out.push(word);
    i += 1;
  }
  return out;
}
