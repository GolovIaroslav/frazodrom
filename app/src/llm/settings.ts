// PLAN.md §8.1/§8.2/§8.3/§8.7 — LLM settings persisted in Dexie `kv`, one row
// per key. This module is the single place that knows the kv key names.

import { db } from '../db/db';
import type { Role } from './types';

export interface LocalOpenAIProfile {
  id: string; // e.g. "default"
  label: string;
  baseUrl: string; // e.g. http://localhost:11434/v1
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export type RoutingConfig = Record<Role, string[]>;

// Model aliases (§8.1) — "one file, updated without touching code".
export const MODEL_ALIASES: Record<string, { provider: 'gemini'; model: string }> = {
  'gemini:flash': { provider: 'gemini', model: 'gemini-3.5-flash' },
  'gemini:flash-lite': { provider: 'gemini', model: 'gemini-3.1-flash-lite' },
};

// Judge default routing left unset pending the live benchmark (BLOCKERS.md) —
// an unvalidated model must not become the silent default judge.
export const DEFAULT_ROUTING: RoutingConfig = {
  judge: [],
  tutor: ['gemini:flash', 'ollama:default'],
  generator: ['gemini:flash'],
};

export const DEFAULT_BUDGET_CEILINGS: Record<Role, number> = {
  judge: 800,
  tutor: 150,
  generator: 50,
};

const KV = {
  geminiApiKey: 'llm.gemini.apiKey',
  localOpenaiProfiles: 'llm.localOpenai.profiles',
  routing: 'llm.routing',
  budgetCeilings: 'llm.budget.ceilings',
  judgeAutoSelfCheck: 'llm.judge.autoFallbackToSelf',
  manualOverride: 'llm.manualOverride',
  promptOverride: (name: string) => `llm.prompt.${name}`,
} as const;

async function getKv<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}

async function setKv(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

export async function getGeminiApiKey(): Promise<string | undefined> {
  return getKv<string | undefined>(KV.geminiApiKey, undefined);
}

export async function setGeminiApiKey(key: string): Promise<void> {
  await setKv(KV.geminiApiKey, key);
}

export async function getLocalOpenAIProfiles(): Promise<LocalOpenAIProfile[]> {
  return getKv<LocalOpenAIProfile[]>(KV.localOpenaiProfiles, []);
}

export async function setLocalOpenAIProfiles(profiles: LocalOpenAIProfile[]): Promise<void> {
  await setKv(KV.localOpenaiProfiles, profiles);
}

export async function getRoutingConfig(): Promise<RoutingConfig> {
  return getKv<RoutingConfig>(KV.routing, DEFAULT_ROUTING);
}

export async function setRoutingConfig(config: RoutingConfig): Promise<void> {
  await setKv(KV.routing, config);
}

export async function resetRoutingConfig(): Promise<void> {
  await setKv(KV.routing, DEFAULT_ROUTING);
}

export async function getBudgetCeilings(): Promise<Record<Role, number>> {
  return getKv<Record<Role, number>>(KV.budgetCeilings, DEFAULT_BUDGET_CEILINGS);
}

export async function setBudgetCeilings(ceilings: Record<Role, number>): Promise<void> {
  await setKv(KV.budgetCeilings, ceilings);
}

/** "при недоступности основного судьи — сразу самопроверка" toggle (§8.1). */
export async function getJudgeAutoSelfCheck(): Promise<boolean> {
  return getKv<boolean>(KV.judgeAutoSelfCheck, false);
}

export async function setJudgeAutoSelfCheck(value: boolean): Promise<void> {
  await setKv(KV.judgeAutoSelfCheck, value);
}

/**
 * Manual override (§8.8): picking a model in the chip popover forces that
 * provider id first in every role's chain until cleared ("вернуть авто").
 * Simplification vs. the spec's "until end of day": cleared explicitly only,
 * not on a day boundary — see implementation-notes.md.
 */
export async function getManualOverride(): Promise<string | undefined> {
  return getKv<string | undefined>(KV.manualOverride, undefined);
}

export async function setManualOverride(id: string | undefined): Promise<void> {
  if (id === undefined) await db.kv.delete(KV.manualOverride);
  else await setKv(KV.manualOverride, id);
}

export async function getPromptOverride(name: string): Promise<string | undefined> {
  return getKv<string | undefined>(KV.promptOverride(name), undefined);
}

export async function setPromptOverride(name: string, prompt: string): Promise<void> {
  await setKv(KV.promptOverride(name), prompt);
}

export async function clearPromptOverride(name: string): Promise<void> {
  await db.kv.delete(KV.promptOverride(name));
}
