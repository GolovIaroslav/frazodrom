// PLAN.md §8.5 point 2 ("Ask the tutor") + §8.6 (TUTOR_SYSTEM, verbatim).
// History is NOT persisted (§8.5: keep the implementation simple) — caller keeps it
// in-memory only for the current drill screen session.

import { resolveChain } from './registry';
import { getBudgetCeilings, getManualOverride, getPromptOverride, getRoutingConfig } from './settings';
import { tryConsumeBudget } from './budget';
import type { ChatRequest, Msg, Role } from './types';
import { LLMAuthError, LLMRateLimitError } from './types';
import { emitProviderSwitch } from './switchNotifier';

// Verbatim from PLAN.md §8.6 (TUTOR_SYSTEM). "{LEVEL}/{PATTERN}/{RU}/{USER}/{REF}/{TAGS}" substituted below.
export const TUTOR_SYSTEM = `You are a warm, concise English tutor for a Russian-speaking learner (CEFR {LEVEL}).
Context: drilling pattern "{PATTERN}"; the learner made this mistake:
RU="{RU}", their answer="{USER}", correct="{REF}", error_tags={TAGS}.
Rules:
- Reply in Russian; English only inside examples. Max 120 words per reply.
- Socratic first: if the learner can plausibly find the fix, ask ONE guiding question
  instead of explaining. Explain directly on the second miss.
- One concept per reply. Plain words, no linguistics jargon.
- When the learner gets it, give exactly 2 fresh RU→EN micro-examples of the same pattern.
- Never drift off the current mistake. Never grade — grading happens elsewhere.`;

export const TUTOR_CHAT_PROMPT_NAME = 'TUTOR_SYSTEM';

/** §8.5: maximum six turns, then gently return to the drill — one turn is one learner message + one reply. */
export const MAX_TUTOR_CHAT_TURNS = 6;

export interface TutorChatContext {
  level: string;
  pattern: string;
  ru: string;
  userAnswer: string;
  ref: string;
  tags: readonly string[];
}

async function activeTutorSystemPrompt(): Promise<string> {
  const override = await getPromptOverride(TUTOR_CHAT_PROMPT_NAME);
  return override ?? TUTOR_SYSTEM;
}

function buildSystem(template: string, ctx: TutorChatContext): string {
  return template
    .replace('{LEVEL}', ctx.level)
    .replace('{PATTERN}', ctx.pattern)
    .replace('{RU}', ctx.ru)
    .replace('{USER}', ctx.userAnswer)
    .replace('{REF}', ctx.ref)
    .replace('{TAGS}', JSON.stringify(ctx.tags));
}

export interface TutorChatResult {
  reply: string;
  providerId?: string;
  /** True when the turn limit was hit and the reply is the canned "back to the drill" message (no LLM call, no budget spent). */
  limitReached: boolean;
}

/**
 * Sends one chat turn. `history` holds prior turns (not including the new
 * user message) — pass it back verbatim from the previous result to keep
 * the conversation coherent; nothing here is persisted to Dexie.
 */
export async function sendTutorChatMessage(
  ctx: TutorChatContext,
  history: readonly Msg[],
  userMessage: string,
  softLimitReply: string,
  signal?: AbortSignal,
): Promise<TutorChatResult | undefined> {
  const turnsSoFar = history.filter((m) => m.role === 'assistant').length;
  if (turnsSoFar >= MAX_TUTOR_CHAT_TURNS) {
    return { reply: softLimitReply, limitReached: true };
  }

  const template = await activeTutorSystemPrompt();
  const system = buildSystem(template, ctx);

  const role: Role = 'tutor';
  const [routing, ceilings, override] = await Promise.all([
    getRoutingConfig(),
    getBudgetCeilings(),
    getManualOverride(),
  ]);
  const ids = override ? [override, ...routing[role].filter((id) => id !== override)] : routing[role];
  const providers = await resolveChain(ids);

  const req: ChatRequest = {
    system,
    messages: [...history, { role: 'user', content: userMessage }],
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
      const text = await provider.chat(req, signal);
      if (!text.trim()) continue;
      return { reply: text, providerId: provider.id, limitReached: false };
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
