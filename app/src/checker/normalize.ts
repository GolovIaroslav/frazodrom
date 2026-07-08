import { toAmerican } from './britishAmerican';
import { CONTRACTIONS } from './contractions';
import { wordsToNumbers } from './numberWords';

const QUOTE_MAP: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '«': '"',
  '»': '"',
};

function straightenQuotes(s: string): string {
  return s.replace(/[‘’“”«»]/g, (c) => QUOTE_MAP[c] ?? c);
}

function basicClean(s: string): string {
  const nfc = s.normalize('NFC');
  const straightened = straightenQuotes(nfc);
  const lower = straightened.toLowerCase();
  const trimmedPunct = lower.replace(/[.!?]+$/g, '');
  return trimmedPunct.replace(/\s+/g, ' ').trim();
}

/** Strip surrounding punctuation, keep internal apostrophes (contractions). */
function tokenize(s: string): string[] {
  if (s === '') return [];
  return s
    .split(' ')
    .map((tok) => tok.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ''))
    .filter((tok) => tok.length > 0);
}

// Cap branching to avoid pathological blow-up on long, contraction-heavy input.
const MAX_VARIANTS = 16;

function expandContractions(tokens: readonly string[]): string[][] {
  let variants: string[][] = [[]];
  for (const token of tokens) {
    const expansions = CONTRACTIONS[token];
    if (!expansions) {
      for (const variant of variants) variant.push(token);
      continue;
    }
    const next: string[][] = [];
    for (const variant of variants) {
      for (const expansion of expansions) {
        if (next.length >= MAX_VARIANTS) break;
        next.push([...variant, ...expansion.split(' ')]);
      }
    }
    variants = next;
  }
  return variants;
}

/**
 * normalize(s) -> Set<string> of canonical forms (PLAN.md §7.1). Branches on
 * ambiguous contractions (he's -> he is / he has), so the result is a set,
 * not a single string — tier 1 checks for a non-empty intersection.
 */
export function normalize(s: string): Set<string> {
  const cleaned = basicClean(s);
  const tokens = tokenize(cleaned);
  const branches = expandContractions(tokens);

  const out = new Set<string>();
  for (const branch of branches) {
    const withNumbers = wordsToNumbers(branch);
    const withSpelling = withNumbers.map(toAmerican);
    out.add(withSpelling.join(' '));
  }
  return out;
}

/**
 * Surface tokens (basic clean + tokenize, no contraction/number/spelling
 * folding) — used by tier 2's word-for-word diff, which compares what the
 * user actually typed rather than a grammar-normalized form.
 */
export function toSurfaceTokens(s: string): string[] {
  return tokenize(basicClean(s));
}
