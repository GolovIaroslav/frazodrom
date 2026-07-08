import { isEditDistanceOne } from './editDistance';
import { normalize, toSurfaceTokens } from './normalize';
import topWordsList from './topWords.json';

const DICTIONARY = new Set<string>(topWordsList as string[]);

const FUNCTION_WORDS = new Set([
  'a',
  'an',
  'the',
  'do',
  'does',
  'did',
  'is',
  'are',
  'am',
  'was',
  'were',
  'to',
  'of',
  'in',
  'on',
  'at',
  'for',
  'and',
  'or',
  'but',
  'not',
  'this',
  'that',
  'these',
  'those',
  'he',
  'she',
  'it',
  'i',
  'you',
  'we',
  'they',
  'his',
  'her',
  'its',
  'my',
  'your',
  'our',
  'their',
]);

const MORPHEME_SUFFIXES = ['s', 'es', 'ed', 'ing', 'er', 'est'];

function isMorphemeSuffixChange(a: string, b: string): boolean {
  return MORPHEME_SUFFIXES.some((suf) => a + suf === b || b + suf === a);
}

const CYRILLIC_RE = /[а-яёА-ЯЁ]/;

export type CheckTier = 0 | 1 | 2;
export type CheckVerdict = 'correct' | 'wrong';

export interface CheckResult {
  tier: CheckTier;
  verdict: CheckVerdict;
  tag?: 'spelling';
  matchedReference?: string;
}

export interface CheckAnswerInput {
  userInput: string;
  ruStimulus: string;
  enMain: string;
  enAccepted?: readonly string[];
  acceptedCache?: readonly string[];
}

function tier2Check(
  userTokens: readonly string[],
  refTokens: readonly string[],
): { ok: boolean; typoWord?: string } {
  if (userTokens.length !== refTokens.length) return { ok: false };
  const diffIndices: number[] = [];
  for (let i = 0; i < userTokens.length; i += 1) {
    if (userTokens[i] !== refTokens[i]) diffIndices.push(i);
  }
  if (diffIndices.length !== 1) return { ok: false };

  const idx = diffIndices[0] as number;
  const userWord = userTokens[idx] as string;
  const refWord = refTokens[idx] as string;

  if (refWord.length < 4) return { ok: false };
  if (!isEditDistanceOne(userWord, refWord)) return { ok: false };
  if (isMorphemeSuffixChange(userWord, refWord)) return { ok: false };
  if (FUNCTION_WORDS.has(refWord) || FUNCTION_WORDS.has(userWord)) return { ok: false };
  if (DICTIONARY.has(userWord)) return { ok: false };

  return { ok: true, typoWord: userWord };
}

/** Tier 0-2 answer check (PLAN.md §7.2) — no LLM, no network. */
export function checkAnswer(input: CheckAnswerInput): CheckResult {
  const trimmed = input.userInput.trim();

  // tier 0: pre-check, no cascade/LLM spend.
  if (trimmed === '') return { tier: 0, verdict: 'wrong' };
  if (CYRILLIC_RE.test(trimmed)) return { tier: 0, verdict: 'wrong' };
  if (trimmed.toLowerCase() === input.ruStimulus.trim().toLowerCase()) {
    return { tier: 0, verdict: 'wrong' };
  }

  const references = [input.enMain, ...(input.enAccepted ?? []), ...(input.acceptedCache ?? [])];

  // tier 1: exact match against normalize()'d references.
  const referenceNorms = new Set<string>();
  for (const ref of references) {
    for (const n of normalize(ref)) referenceNorms.add(n);
  }
  const userNorms = normalize(trimmed);
  for (const n of userNorms) {
    if (referenceNorms.has(n)) {
      return { tier: 1, verdict: 'correct', matchedReference: n };
    }
  }

  // tier 2: single-word typo tolerance against each reference's surface tokens.
  const userTokens = toSurfaceTokens(trimmed);
  for (const ref of references) {
    const refTokens = toSurfaceTokens(ref);
    const result = tier2Check(userTokens, refTokens);
    if (result.ok) {
      return { tier: 2, verdict: 'correct', tag: 'spelling', matchedReference: ref };
    }
  }

  return { tier: 2, verdict: 'wrong' };
}
