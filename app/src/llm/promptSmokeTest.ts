// PLAN.md §8.5 — saving a custom JSON-role prompt runs a smoke test:
// one test call + zod validation. JUDGE_SYSTEM is the only JSON role among the six
// editable runtime prompts (§8.5's own list — TUTOR_SYSTEM/ACTION_* are plain
// text tutor replies, not JSON).

import { buildUserMessage, JudgeVerdictSchema, type JudgeCaseInput } from './judge';
import { resolveChain } from './registry';
import { getBudgetCeilings, getManualOverride, getRoutingConfig } from './settings';
import { tryConsumeBudget } from './budget';
import type { ChatRequest, Role } from './types';

/** Fixed, real-shaped test case (§8.5: one test call) — not user data. */
export const SMOKE_TEST_CASE: JudgeCaseInput = {
  ru: 'Я вижу кошку.',
  userAnswer: 'I see a cat.',
  refs: ['I see a cat.'],
  pattern: 'a/an',
  level: 'A1',
  uiLang: 'ru',
};

export type SmokeTestOutcome = 'ok' | 'invalid' | 'no-provider';

export interface SmokeTestResult {
  outcome: SmokeTestOutcome;
  error?: string;
}

/**
 * Runs one real-shaped call against `promptText` as the JUDGE_SYSTEM
 * candidate (not whatever is currently saved) and zod-validates the reply.
 * `'no-provider'` means no configured/budgeted judge-role provider exists in
 * this environment — distinct from `'invalid'` so the UI doesn't conflate
 * "couldn't test" with "tested and broken".
 */
export async function smokeTestJudgePrompt(
  promptText: string,
  signal?: AbortSignal,
): Promise<SmokeTestResult> {
  const role: Role = 'judge';
  const [routing, ceilings, override] = await Promise.all([
    getRoutingConfig(),
    getBudgetCeilings(),
    getManualOverride(),
  ]);
  const ids = override ? [override, ...routing[role].filter((id) => id !== override)] : routing[role];
  const providers = await resolveChain(ids);

  const req: ChatRequest = {
    system: promptText,
    messages: [{ role: 'user', content: buildUserMessage(SMOKE_TEST_CASE) }],
    json: true,
    temperature: 0,
  };

  for (const provider of providers) {
    if (signal?.aborted) return { outcome: 'no-provider' };
    const configured = await provider.isConfigured();
    if (!configured) continue;
    const ok = await tryConsumeBudget(provider.id, role, ceilings[role]);
    if (!ok) continue;
    try {
      const raw = await provider.chat(req, signal);
      const json: unknown = JSON.parse(raw);
      const result = JudgeVerdictSchema.safeParse(json);
      return result.success ? { outcome: 'ok' } : { outcome: 'invalid', error: 'response does not match the verdict schema' };
    } catch (err) {
      return { outcome: 'invalid', error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { outcome: 'no-provider' };
}
