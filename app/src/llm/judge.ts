// PLAN.md §7.2 (tier 3), §7.4 (zod contract), §8.6 (JUDGE_SYSTEM prompt).

import { z } from 'zod';
import type { ChatRequest, LLMProvider, Role } from './types';
import { LLMAuthError, LLMRateLimitError } from './types';
import { resolveChain } from './registry';
import {
  getBudgetCeilings,
  getJudgeAutoSelfCheck,
  getManualOverride,
  getPromptOverride,
  getRoutingConfig,
} from './settings';
import { tryConsumeBudget } from './budget';

export const ERROR_TAGS = [
  'word_order',
  'verb_tense',
  'verb_form',
  'aux_missing',
  'article',
  'preposition',
  'agreement',
  'pronoun',
  'vocab_choice',
  'spelling',
  'word_missing',
  'word_extra',
  'unnatural',
] as const;

export const JudgeVerdictSchema = z.object({
  verdict: z.enum(['correct', 'acceptable', 'minor_error', 'wrong']),
  error_tags: z.array(z.enum(ERROR_TAGS)).max(3),
  explanation_ru: z.string().max(280),
  corrected: z.string(),
  natural: z.string(),
  add_to_accepted: z.boolean(),
});

export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

// Verbatim from PLAN.md §8.6 (JUDGE_SYSTEM). "Russian" reads as {UI_LANG} per
// the section's preamble — see buildJudgeMessages below.
export const JUDGE_SYSTEM = `You are a strict but fair grader of English translations for Russian-speaking learners.
Input: RU (stimulus), USER (learner's answer), REFS (known correct translations),
PATTERN (the grammar pattern being drilled), LEVEL (CEFR).
Rules:
1. USER need not match REFS word-for-word. Any natural, grammatically correct English
   sentence with the same meaning that USES the drilled PATTERN is correct/acceptable.
2. If USER is correct but avoids the drilled PATTERN (paraphrase), verdict="acceptable",
   add_to_accepted=false, explanation_ru must say the pattern was avoided.
3. Ignore capitalization, terminal punctuation, contractions, US/UK spelling.
4. minor_error = meaning preserved, exactly one small slip (article, preposition, single
   wrong form). wrong = meaning changed, pattern broken, or 2+ grammar errors.
5. explanation_ru: Russian, max 2 short sentences, about THE error only. No praise, no lecture.
6. corrected = USER's sentence with minimal edits. natural = how a native speaker would say it.
7. error_tags only from: [word_order, verb_tense, verb_form, aux_missing, article, preposition,
   agreement, pronoun, vocab_choice, spelling, word_missing, word_extra, unnatural].
8. add_to_accepted=true ONLY if USER is fully correct AND uses the drilled pattern.
Respond with ONLY valid JSON:
{"verdict":"correct|acceptable|minor_error|wrong","error_tags":[],"explanation_ru":"",
 "corrected":"","natural":"","add_to_accepted":false}`;

export interface JudgeCaseInput {
  ru: string;
  userAnswer: string;
  refs: readonly string[];
  pattern: string;
  level: string;
  /** UI language — §8.6: "Russian" in the prompt reads as {UI_LANG}. */
  uiLang: 'ru' | 'en';
}

const CYRILLIC_RE = /[а-яёА-ЯЁ]/;

function buildUserMessage(input: JudgeCaseInput): string {
  return [
    `RU: "${input.ru}"`,
    `USER: "${input.userAnswer}"`,
    `REFS: ${JSON.stringify(input.refs)}`,
    `PATTERN: "${input.pattern}"`,
    `LEVEL: ${input.level}`,
    `UI_LANG: ${input.uiLang}`,
  ].join('\n');
}

async function activeJudgeSystemPrompt(): Promise<string> {
  const override = await getPromptOverride('JUDGE_SYSTEM');
  return override ?? JUDGE_SYSTEM;
}

/** Thrown when a judge candidate could not produce a valid verdict at all — caller should try the next provider / fall to tier 4. */
export class JudgeCallFailedError extends Error {}

const TIER3_TIMEOUT_MS = 8000;

async function callWithTimeout(
  provider: LLMProvider,
  req: ChatRequest,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort);
  }
  try {
    return await provider.chat(req, controller.signal);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

function tryParseVerdict(raw: string): JudgeVerdict | undefined {
  try {
    const json: unknown = JSON.parse(raw);
    const result = JudgeVerdictSchema.safeParse(json);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Runs one judge call end-to-end against a single provider: JSON parse + zod
 * validation with 1 retry on parse failure, then a Cyrillic post-validation
 * retry with a stronger instruction when UI_LANG=ru (§7.4). Throws
 * JudgeCallFailedError if no valid verdict could be obtained.
 */
export async function callJudge(
  provider: LLMProvider,
  input: JudgeCaseInput,
  signal?: AbortSignal,
): Promise<JudgeVerdict> {
  const system = await activeJudgeSystemPrompt();
  const req: ChatRequest = {
    system,
    messages: [{ role: 'user', content: buildUserMessage(input) }],
    json: true,
    temperature: 0,
  };

  let verdict: JudgeVerdict | undefined;
  for (let attempt = 0; attempt < 2 && !verdict; attempt += 1) {
    if (signal?.aborted) throw new JudgeCallFailedError('Aborted ("Don\'t wait")');
    try {
      const raw = await callWithTimeout(provider, req, TIER3_TIMEOUT_MS, signal);
      verdict = tryParseVerdict(raw);
    } catch (err) {
      if (err instanceof LLMAuthError || err instanceof LLMRateLimitError) throw err;
      // network/timeout — fall through to retry loop.
    }
  }
  if (!verdict) throw new JudgeCallFailedError('Judge response did not parse after retry');

  if (input.uiLang === 'ru' && !CYRILLIC_RE.test(verdict.explanation_ru)) {
    if (signal?.aborted) throw new JudgeCallFailedError('Aborted ("Don\'t wait")');
    const strongerReq: ChatRequest = {
      system: `${system}\nIMPORTANT: explanation_ru MUST be written in Russian (Cyrillic script). Your previous answer was not in Russian — fix this.`,
      messages: req.messages,
      json: true,
      temperature: 0,
    };
    try {
      const raw = await callWithTimeout(provider, strongerReq, TIER3_TIMEOUT_MS, signal);
      const retried = tryParseVerdict(raw);
      if (retried && CYRILLIC_RE.test(retried.explanation_ru)) return retried;
    } catch (err) {
      if (err instanceof LLMAuthError || err instanceof LLMRateLimitError) throw err;
    }
    throw new JudgeCallFailedError('explanation_ru failed the Cyrillic check twice');
  }

  return verdict;
}

export interface Tier3Result {
  verdict: JudgeVerdict;
  providerId: string;
}

/**
 * Tier 3 orchestration (§7.2): walks the judge routing chain, skipping
 * unconfigured/budget-exhausted/failed providers, and returns the first
 * successful verdict. Returns undefined if every candidate failed — caller
 * falls to tier 4 (self-check).
 */
export async function runJudgeTier3(
  input: JudgeCaseInput,
  signal?: AbortSignal,
  role: Role = 'judge',
): Promise<Tier3Result | undefined> {
  const [routing, ceilings, autoSelfCheck, override] = await Promise.all([
    getRoutingConfig(),
    getBudgetCeilings(),
    getJudgeAutoSelfCheck(),
    getManualOverride(),
  ]);
  let ids = override ? [override, ...routing[role].filter((id) => id !== override)] : routing[role];
  if (autoSelfCheck) ids = ids.slice(0, 1);
  const providers = await resolveChain(ids);

  for (const provider of providers) {
    if (signal?.aborted) return undefined;
    const configured = await provider.isConfigured();
    if (!configured) continue;
    const ok = await tryConsumeBudget(provider.id, role, ceilings[role]);
    if (!ok) continue;
    try {
      const verdict = await callJudge(provider, input, signal);
      return { verdict, providerId: provider.id };
    } catch {
      // try next provider in the chain
    }
  }
  return undefined;
}
