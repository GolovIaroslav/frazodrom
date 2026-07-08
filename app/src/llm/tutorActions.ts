// PLAN.md §8.5 (tutor action buttons + caching rules), §8.6 (CONTEXT template
// + ACTION_ERRORS/EXPLAIN/VARIANTS/NUANCES, verbatim).

import { db } from '../db/db';
import { fnv1aHash } from './hash';
import { resolveChain } from './registry';
import { getBudgetCeilings, getManualOverride, getPromptOverride, getRoutingConfig } from './settings';
import { tryConsumeBudget } from './budget';
import type { ChatRequest, Role } from './types';

export type TutorActionKind = 'errors' | 'explain' | 'variants' | 'nuances';

// Verbatim from PLAN.md §8.6.
export const ACTION_ERRORS = `List the learner's mistakes, one by one. For each: quote the wrong fragment → show the fix
→ explain WHY in one short sentence (rule or usage).
Max 3 mistakes, most important first; if more remain, add one line "Ещё мелочи: …".
If the answer is fully correct — say so and name one thing done well.
Format: numbered list. Under 90 words total.`;

export const ACTION_EXPLAIN = `Explain how the CORRECT sentence is built, like a tutor at a whiteboard:
1) skeleton: the word order / pattern formula applied to THIS sentence;
2) why the key forms are used (tense, auxiliary, article) — only those that matter here;
3) one memory hook: a mini-rule or analogy the learner can reuse in similar sentences.
Do not analyse the learner's answer here (that is the Errors button). Under 110 words.`;

export const ACTION_VARIANTS = `Give 3-5 natural English translations of RU, from most standard to conversational.
Label each: (нейтральный) / (разговорный) / (формальный) where relevant.
After each — max one short line in Russian: when this version fits.
Only sentences a native speaker would actually say; no invented rare phrasings.`;

export const ACTION_NUANCES = `Point out the subtleties of this sentence that Russian speakers usually miss:
close synonyms and which one natives prefer here, articles, prepositions, collocations,
register, false friends. Max 4 bullets, one sentence each. Only nuances REAL for this
sentence — no generic grammar lecture. If there is a classic RU-speaker trap, start with it.`;

export const ACTION_PROMPT_DEFAULTS: Record<TutorActionKind, string> = {
  errors: ACTION_ERRORS,
  explain: ACTION_EXPLAIN,
  variants: ACTION_VARIANTS,
  nuances: ACTION_NUANCES,
};

/** Names as used by the prompt-override store / editor (§8.5). */
export const ACTION_PROMPT_NAMES: Record<TutorActionKind, string> = {
  errors: 'ACTION_ERRORS',
  explain: 'ACTION_EXPLAIN',
  variants: 'ACTION_VARIANTS',
  nuances: 'ACTION_NUANCES',
};

/**
 * §8.5: «Варианты»/«Нюансы» depend only on the sentence — the learner's
 * specific wrong answer is not part of their cache key (and, per §6.1's
 * explicit revealing-actions list, they do not force REWRITE the way
 * «Ошибки»/«Разбор»/give-up do).
 */
export const ACTION_DEPENDS_ON_ANSWER: Record<TutorActionKind, boolean> = {
  errors: true,
  explain: true,
  variants: false,
  nuances: false,
};

/** Same list, from the reveal side: does this action force REWRITE per §6.1? */
export const ACTION_REVEALS_ANSWER: Record<TutorActionKind, boolean> = {
  errors: true,
  explain: true,
  variants: false,
  nuances: false,
};

export interface TutorActionInput {
  itemId: string;
  ru: string;
  userAnswer: string;
  refs: readonly string[];
  verdict: string;
  tags: readonly string[];
  pattern: string;
  level: string;
}

/** Light local normalization for the cache key only — not the full checker cascade (out of scope here). */
function normalizeAnswerForKey(answer: string): string {
  return answer
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

export async function activeActionPrompt(kind: TutorActionKind): Promise<string> {
  const override = await getPromptOverride(ACTION_PROMPT_NAMES[kind]);
  return override ?? ACTION_PROMPT_DEFAULTS[kind];
}

function buildContext(input: TutorActionInput): string {
  return [
    'CONTEXT',
    `RU (task): "${input.ru}"`,
    `LEARNER (their answer): "${input.userAnswer}"`,
    `CORRECT (main): "${input.refs[0] ?? ''}"; also accepted: ${JSON.stringify(input.refs.slice(1))}`,
    `VERDICT: ${input.verdict}; error_tags: ${JSON.stringify(input.tags)}`,
    `PATTERN drilled: "${input.pattern}" (CEFR ${input.level})`,
    'Write in Russian; English only inside examples. Plain language, no linguistics jargon.',
  ].join('\n');
}

/** Cache key per §8.5: item id (+ answer hash for answer-dependent actions) + active-prompt hash. */
export function buildCacheKey(kind: TutorActionKind, input: TutorActionInput, promptText: string): string {
  const promptHash = fnv1aHash(promptText);
  const answerPart = ACTION_DEPENDS_ON_ANSWER[kind] ? fnv1aHash(normalizeAnswerForKey(input.userAnswer)) : '';
  return `${input.itemId}|${kind}|${answerPart}|${promptHash}`;
}

export interface TutorActionResult {
  text: string;
  cached: boolean;
  providerId?: string;
}

/**
 * Runs one tutor action button (§8.5). Cache-first: a hit costs no LLM call
 * and no budget. A miss walks the `tutor` role's routing chain exactly like
 * `runJudgeTier3` (budget-gated, first configured provider wins), writes the
 * result to `tutorActionCache`, and returns it.
 */
export async function runTutorAction(
  kind: TutorActionKind,
  input: TutorActionInput,
  signal?: AbortSignal,
): Promise<TutorActionResult | undefined> {
  const promptText = await activeActionPrompt(kind);
  const key = buildCacheKey(kind, input, promptText);

  const cached = await db.tutorActionCache.get(key);
  if (cached) return { text: cached.response, cached: true };

  const role: Role = 'tutor';
  const [routing, ceilings, override] = await Promise.all([
    getRoutingConfig(),
    getBudgetCeilings(),
    getManualOverride(),
  ]);
  const ids = override ? [override, ...routing[role].filter((id) => id !== override)] : routing[role];
  const providers = await resolveChain(ids);

  const req: ChatRequest = {
    system: `${buildContext(input)}\n\n${promptText}`,
    messages: [{ role: 'user', content: 'Write your reply now, following the instructions above.' }],
    temperature: 0.7,
  };

  for (const provider of providers) {
    if (signal?.aborted) return undefined;
    const configured = await provider.isConfigured();
    if (!configured) continue;
    const ok = await tryConsumeBudget(provider.id, role, ceilings[role]);
    if (!ok) continue;
    try {
      const text = await provider.chat(req, signal);
      if (!text.trim()) continue;
      await db.tutorActionCache.put({ key, action: kind, itemId: input.itemId, response: text, ts: Date.now() });
      return { text, cached: false, providerId: provider.id };
    } catch {
      // try next provider in the chain
    }
  }
  return undefined;
}
