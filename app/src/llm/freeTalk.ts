// PLAN.md §8.9 — Free Talk: the only mode without a Russian stimulus. Uses
// the `tutor` role/budget (§8.3). Chat prompt + turn-limited chain-walking
// mirror tutorChat.ts; the one-shot summary call mirrors judge.ts's zod
// contract pattern.

import { z } from 'zod';
import { db } from '../db/db';
import type { FreeTalkMessage, FreeTalkSessionRecord } from '../db/db';
import { resolveChain } from './registry';
import { getBudgetCeilings, getManualOverride, getPromptOverride, getRoutingConfig } from './settings';
import { tryConsumeBudget } from './budget';
import type { ChatRequest, Msg, Role } from './types';
import { LLMAuthError, LLMRateLimitError } from './types';
import { emitProviderSwitch } from './switchNotifier';
import { ERROR_TAGS } from './judge';

// Verbatim from PLAN.md §8.6 (FREETALK_SYSTEM). "{LEVEL}"/"{TOPIC}" substituted below.
export const FREETALK_SYSTEM = `You are a friendly English conversation partner chatting with a Russian-speaking learner
(CEFR {LEVEL}) about: "{TOPIC}".
Rules:
- Speak ONLY natural, everyday spoken English. Never switch to Russian, never explain
  grammar mid-conversation, never grade.
- Keep each reply short: 1-3 sentences, almost always with a genuine follow-up question —
  this is a real back-and-forth, not a lecture.
- Match vocabulary and complexity to LEVEL; sound like a real person, not a textbook.
- Minor mistake that does not block meaning → do NOT correct directly. Recast it: reuse
  the corrected form naturally in your own next sentence, in passing.
- Mistake that blocks meaning → ask a brief clarifying question instead of explaining.
- Stay warm and curious; never break character as a conversation partner.
- If the learner writes in Russian or freezes, gently encourage them in English and offer
  one simple phrase to continue with, then keep the conversation going.
- If asked what a word or phrase means, explain briefly in simple English and move on —
  that is a normal conversation move, not a grammar lecture.`;

// Verbatim from PLAN.md §8.6 (FREETALK_SUMMARY_SYSTEM).
export const FREETALK_SUMMARY_SYSTEM = `Given this English conversation transcript between you (tutor) and a Russian-speaking
learner (CEFR {LEVEL}), write a summary for the learner in Russian: 2-3 RECURRING mistake
patterns (not one-off typos), each with one corrected example taken from the learner's own
messages, phrased kindly. If nothing recurs, name 1-2 specific things expressed well instead.
Output ONLY valid JSON: {"summary_ru":"","recurring_tags":[]}
recurring_tags: only from the standard error enum where it clearly applies, else omit.
Under 120 words in summary_ru.`;

export const FREETALK_SYSTEM_PROMPT_NAME = 'FREETALK_SYSTEM';
export const FREETALK_SUMMARY_PROMPT_NAME = 'FREETALK_SUMMARY_SYSTEM';

/** §8.9/§16: "лимит на диалог: 15 реплик юзера ... что раньше". */
export const MAX_FREETALK_USER_TURNS = 15;
/** §8.9: "за 2–3 реплики до лимита — мягкое предупреждение". */
export const FREETALK_WARNING_TURNS_BEFORE_CAP = 3;

export const FreeTalkSummarySchema = z.object({
  summary_ru: z.string().max(600),
  recurring_tags: z.array(z.enum(ERROR_TAGS)).max(5),
});

export type FreeTalkSummary = z.infer<typeof FreeTalkSummarySchema>;

export type FreeTalkTopicId = 'travel' | 'work' | 'hobbies' | 'dailyPlans' | 'controversial';

export interface FreeTalkTopicPreset {
  id: FreeTalkTopicId;
  minLevel: string; // CEFR — e.g. some topics ("спорный вопрос") not offered below A2 (§8.9)
}

// §8.9 preset list — labels come from i18n (freeTalk.topic.<id>), not hardcoded strings.
export const FREETALK_TOPIC_PRESETS: FreeTalkTopicPreset[] = [
  { id: 'travel', minLevel: 'A1' },
  { id: 'work', minLevel: 'A1' },
  { id: 'hobbies', minLevel: 'A1' },
  { id: 'dailyPlans', minLevel: 'A1' },
  { id: 'controversial', minLevel: 'A2' },
];

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function isTopicAvailableAtLevel(preset: FreeTalkTopicPreset, level: string): boolean {
  const levelIdx = CEFR_ORDER.indexOf(level);
  const minIdx = CEFR_ORDER.indexOf(preset.minLevel);
  if (levelIdx === -1 || minIdx === -1) return true;
  return levelIdx >= minIdx;
}

async function activeSystemPrompt(name: string, fallback: string): Promise<string> {
  const override = await getPromptOverride(name);
  return override ?? fallback;
}

function buildFreeTalkSystem(template: string, topic: string, level: string): string {
  return template.replace('{TOPIC}', topic).replace('{LEVEL}', level);
}

export interface FreeTalkChatResult {
  reply: string;
  providerId?: string;
}

/**
 * Sends one Free Talk turn (§8.9). Caller is responsible for the turn-cap
 * check (getFreeTalkTurnStatus below) and for persisting the resulting
 * transcript to Dexie — this function only talks to the LLM.
 */
export async function sendFreeTalkMessage(
  topic: string,
  level: string,
  history: readonly Msg[],
  userMessage: string,
  signal?: AbortSignal,
): Promise<FreeTalkChatResult | undefined> {
  const template = await activeSystemPrompt(FREETALK_SYSTEM_PROMPT_NAME, FREETALK_SYSTEM);
  const system = buildFreeTalkSystem(template, topic, level);

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
    temperature: 0.8,
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
      return { reply: text, providerId: provider.id };
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

export type FreeTalkTurnStatus = 'ok' | 'warning' | 'capped';

/** §8.9: cap is 15 user turns; warn 2-3 turns before. `userTurnsSoFar` excludes the message about to be sent. */
export function getFreeTalkTurnStatus(userTurnsSoFar: number): FreeTalkTurnStatus {
  if (userTurnsSoFar >= MAX_FREETALK_USER_TURNS) return 'capped';
  if (userTurnsSoFar >= MAX_FREETALK_USER_TURNS - FREETALK_WARNING_TURNS_BEFORE_CAP) return 'warning';
  return 'ok';
}

function transcriptText(messages: readonly FreeTalkMessage[]): string {
  return messages.map((m) => `${m.role === 'user' ? 'LEARNER' : 'TUTOR'}: ${m.content}`).join('\n');
}

/**
 * One-shot summary call on "Закончить" (§8.9). Parses/validates the JSON
 * contract with zod (JudgeVerdictSchema's sibling); returns undefined if the
 * whole chain failed or produced unparseable JSON — caller should still mark
 * the session finished (the transcript itself isn't lost) but show no summary.
 */
export async function generateFreeTalkSummary(
  messages: readonly FreeTalkMessage[],
  level: string,
  signal?: AbortSignal,
): Promise<{ summary: FreeTalkSummary; providerId: string } | undefined> {
  const template = await activeSystemPrompt(FREETALK_SUMMARY_PROMPT_NAME, FREETALK_SUMMARY_SYSTEM);
  const system = template.replace('{LEVEL}', level);

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
    messages: [{ role: 'user', content: transcriptText(messages) }],
    json: true,
    temperature: 0,
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
      const parsed = FreeTalkSummarySchema.safeParse(JSON.parse(raw));
      if (!parsed.success) continue;
      return { summary: parsed.data, providerId: provider.id };
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

/** §10.4 — 30-day rolling error-tag counter, written here from Free Talk's recurring_tags (read/consumption UI is Ф4 scope). */
export async function upsertErrorProfileTags(tags: readonly string[], now = Date.now()): Promise<void> {
  for (const tag of tags) {
    const existing = await db.errorProfile.get(tag);
    await db.errorProfile.put({
      tag,
      count30d: (existing?.count30d ?? 0) + 1,
      lastSeen: now,
    });
  }
}

// --- Dexie persistence (§8.9: "Транскрипт... хранится в Dexie до явного завершения") ---

export async function findUnfinishedFreeTalkSession(): Promise<FreeTalkSessionRecord | undefined> {
  return db.freeTalkSessions.filter((s) => !s.finished).first();
}

export async function createFreeTalkSession(topic: string, level: string, now = Date.now()): Promise<number> {
  const id = await db.freeTalkSessions.add({
    topic,
    level,
    messages: [],
    startedAt: now,
    finished: false,
  });
  return id as number;
}

export async function getFreeTalkSession(sessionId: number): Promise<FreeTalkSessionRecord | undefined> {
  return db.freeTalkSessions.get(sessionId);
}

export async function appendFreeTalkMessages(
  sessionId: number,
  newMessages: readonly FreeTalkMessage[],
): Promise<void> {
  const session = await db.freeTalkSessions.get(sessionId);
  if (!session) return;
  await db.freeTalkSessions.update(sessionId, { messages: [...session.messages, ...newMessages] });
}

export async function finishFreeTalkSession(
  sessionId: number,
  summary?: FreeTalkSummary,
): Promise<void> {
  await db.freeTalkSessions.update(sessionId, {
    finished: true,
    summaryRu: summary?.summary_ru,
    recurringTags: summary?.recurring_tags,
  });
}
