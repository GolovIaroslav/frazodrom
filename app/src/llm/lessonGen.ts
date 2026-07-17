// PLAN.md §8.6 (LESSON_GEN_SYSTEM, role=generator), §10.4 — error-hunting's
// "5 personalized generator sentences with WEAK_TAGS". Only the generator
// call itself is built here, mirroring judge.ts's chain-walking + zod
// pattern: the full AI-lesson-on-demand feature (§8.4, TOPIC-driven, save as
// custom_* pack) is explicitly out of scope for Phase 4 — this reuses the same
// prompt/contract with N=5 and a fixed WEAK_TAGS bias for error-hunt use.

import { z } from 'zod';
import { resolveChain } from './registry';
import { getBudgetCeilings, getManualOverride, getPromptOverride, getRoutingConfig } from './settings';
import { tryConsumeBudget } from './budget';
import type { ChatRequest, Role } from './types';
import { LLMAuthError, LLMRateLimitError } from './types';
import { emitProviderSwitch } from './switchNotifier';

// Verbatim from PLAN.md §8.6 (LESSON_GEN_SYSTEM).
export const LESSON_GEN_SYSTEM = `You create a one-shot drill lesson for a Russian-speaking English learner.
Input: TOPIC (free text), LEVEL (CEFR), N (default 15), WEAK_TAGS (learner's frequent errors).
Output ONLY valid JSON:
{"title_ru":"","theory_ru":"3-5 short sentences","items":[
  {"ru":"","en_main":"","en_accepted":[""],"sub":"affirm|neg|question|wh|mixed"}]}
Rules: natural everyday sentences, 4-12 words; vocabulary within LEVEL; idiomatic Russian
stimuli (never word-by-word calques); vary verbs and subjects; no rare proper nouns;
bias 30% of items toward WEAK_TAGS if given; en_accepted = 1-3 alternative correct translations.`;

export const LESSON_GEN_PROMPT_NAME = 'LESSON_GEN_SYSTEM';

export const LessonGenItemSchema = z.object({
  ru: z.string(),
  en_main: z.string(),
  en_accepted: z.array(z.string()),
  sub: z.enum(['affirm', 'neg', 'question', 'wh', 'mixed']),
});

export const LessonGenResultSchema = z.object({
  title_ru: z.string(),
  theory_ru: z.string(),
  items: z.array(LessonGenItemSchema),
});

export type LessonGenResult = z.infer<typeof LessonGenResultSchema>;

export interface ErrorHuntGenInput {
  topic: string;
  level: string;
  weakTags: readonly string[];
  n?: number;
}

async function activeLessonGenPrompt(): Promise<string> {
  const override = await getPromptOverride(LESSON_GEN_PROMPT_NAME);
  return override ?? LESSON_GEN_SYSTEM;
}

function buildUserMessage(input: ErrorHuntGenInput): string {
  return [
    `TOPIC: "${input.topic}"`,
    `LEVEL: ${input.level}`,
    `N: ${input.n ?? 5}`,
    `WEAK_TAGS: ${JSON.stringify(input.weakTags)}`,
  ].join('\n');
}

function tryParse(raw: string): LessonGenResult | undefined {
  try {
    const json: unknown = JSON.parse(raw);
    const result = LessonGenResultSchema.safeParse(json);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Runs the generator-role call for error-hunt's 5 personalized WEAK_TAGS
 * sentences (§10.4). Walks the `generator` routing chain exactly like
 * `runJudgeTier3` — budget-gated, first configured+successful provider
 * wins. Returns undefined if no provider produced a valid result (caller
 * falls back to skill-only error-hunt with no personalized sentences).
 */
export async function runErrorHuntGeneration(
  input: ErrorHuntGenInput,
  signal?: AbortSignal,
): Promise<LessonGenResult | undefined> {
  const role: Role = 'generator';
  const [routing, ceilings, override, system] = await Promise.all([
    getRoutingConfig(),
    getBudgetCeilings(),
    getManualOverride(),
    activeLessonGenPrompt(),
  ]);
  const ids = override ? [override, ...routing[role].filter((id) => id !== override)] : routing[role];
  const providers = await resolveChain(ids);

  const req: ChatRequest = {
    system,
    messages: [{ role: 'user', content: buildUserMessage({ ...input, n: input.n ?? 5 }) }],
    json: true,
    temperature: 0.7,
  };

  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i];
    if (signal?.aborted) return undefined;
    const configured = await provider.isConfigured();
    if (!configured) continue;
    const ok = await tryConsumeBudget(provider.id, role, ceilings[role]);
    if (!ok) continue;
    try {
      const raw = await provider.chat(req, signal);
      const parsed = tryParse(raw);
      if (parsed) return parsed;
    } catch (err) {
      if (err instanceof LLMRateLimitError || err instanceof LLMAuthError) {
        const next = providers[i + 1];
        emitProviderSwitch({
          role,
          fromProviderId: provider.id,
          fromLabel: provider.label,
          toProviderId: next?.id,
          toLabel: next?.label,
          reason: err instanceof LLMRateLimitError ? 'rateLimit' : 'authError',
        });
      }
      // try next provider in the chain
    }
  }
  return undefined;
}
