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

export type AliasProvider = 'gemini' | 'groq' | 'openrouter' | 'gigachat' | 'yandex';

// Model aliases (§8.1) — "one file, updated without touching code".
export const MODEL_ALIASES: Record<string, { provider: AliasProvider; model: string }> = {
  'gemini:flash': { provider: 'gemini', model: 'gemini-3.5-flash' },
  'gemini:flash-lite': { provider: 'gemini', model: 'gemini-3.1-flash-lite' },
  // §8.2 — Groq's free-tier judge candidate.
  'groq:llama-8b': { provider: 'groq', model: 'llama-3.1-8b-instant' },
  // §8.2 — OpenRouter's :free reserve for tutor/generator. The exact free
  // catalog drifts (OpenRouter's dashboard is the source of truth) — this id
  // is a reasonable current default, editable here without touching call sites.
  'openrouter:free': { provider: 'openrouter', model: 'meta-llama/llama-3.2-3b-instruct:free' },
  // §8.2 — GigaChat/Yandex: additional adapters that widen regional coverage,
  // deliberately NOT in any default chain below — the user opts in by adding
  // the id to their own routing config once they hold credentials.
  'gigachat:pro': { provider: 'gigachat', model: 'GigaChat' },
  'yandex:yandexgpt-lite': { provider: 'yandex', model: 'yandexgpt-lite' },
};

// Judge default routing left unset pending the live benchmark (BLOCKERS.md) —
// an unvalidated model must not become the silent default judge. Groq's
// documented role is judge-only (§8.2), so it stays out of the tutor/generator
// defaults below, consistent with that same blocker.
export const DEFAULT_ROUTING: RoutingConfig = {
  judge: [],
  tutor: ['gemini:flash', 'openrouter:free', 'ollama:default'],
  generator: ['gemini:flash', 'openrouter:free'],
};

export const DEFAULT_BUDGET_CEILINGS: Record<Role, number> = {
  judge: 800,
  tutor: 150,
  generator: 50,
};

export interface GigaChatCredentials {
  /** Sber's "Authorization key" — a pre-base64'd client_id:client_secret pair. */
  authKey: string;
  scope?: 'GIGACHAT_API_PERS' | 'GIGACHAT_API_B2B' | 'GIGACHAT_API_CORP';
}

export interface YandexCredentials {
  apiKey: string;
  folderId: string;
}

const KV = {
  geminiApiKey: 'llm.gemini.apiKey',
  localOpenaiProfiles: 'llm.localOpenai.profiles',
  routing: 'llm.routing',
  budgetCeilings: 'llm.budget.ceilings',
  judgeAutoSelfCheck: 'llm.judge.autoFallbackToSelf',
  manualOverride: 'llm.manualOverride',
  promptOverride: (name: string) => `llm.prompt.${name}`,
  promptOverrideDefaultHash: (name: string) => `llm.prompt.${name}.defaultHash`,
  // §8.2/§8.9 — additional cloud providers + the optional CORS proxy (Ф3в).
  proxyUrl: 'llm.proxyUrl',
  groqApiKey: 'llm.groq.apiKey',
  openrouterApiKey: 'llm.openrouter.apiKey',
  gigachatCredentials: 'llm.gigachat.credentials',
  yandexCredentials: 'llm.yandex.credentials',
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
  await db.kv.delete(KV.promptOverrideDefaultHash(name));
}

/**
 * Hash of the shipped default prompt text captured at the moment an override
 * was saved (§8.5 "дефолт обновился"). Compared against the current default's
 * hash by the prompt editor — a mismatch means the app shipped a new default
 * while the user still runs a custom override.
 */
export async function getPromptOverrideDefaultHash(name: string): Promise<string | undefined> {
  return getKv<string | undefined>(KV.promptOverrideDefaultHash(name), undefined);
}

export async function setPromptOverrideDefaultHash(name: string, hash: string): Promise<void> {
  await setKv(KV.promptOverrideDefaultHash(name), hash);
}

/**
 * §8.2/§5.1 — optional local CORS proxy (`proxy/serve.mjs`, localhost:8787).
 * Groq/OpenRouter/GigaChat/Yandex adapters route through this URL by default
 * when set (their direct CORS-from-browser behaviour is unverified/unreliable,
 * §8.2); empty/unset means "call the provider's API directly".
 */
export async function getProxyUrl(): Promise<string | undefined> {
  return getKv<string | undefined>(KV.proxyUrl, undefined);
}

export async function setProxyUrl(url: string): Promise<void> {
  await setKv(KV.proxyUrl, url);
}

export async function getGroqApiKey(): Promise<string | undefined> {
  return getKv<string | undefined>(KV.groqApiKey, undefined);
}

export async function setGroqApiKey(key: string): Promise<void> {
  await setKv(KV.groqApiKey, key);
}

export async function getOpenRouterApiKey(): Promise<string | undefined> {
  return getKv<string | undefined>(KV.openrouterApiKey, undefined);
}

export async function setOpenRouterApiKey(key: string): Promise<void> {
  await setKv(KV.openrouterApiKey, key);
}

export async function getGigaChatCredentials(): Promise<GigaChatCredentials | undefined> {
  return getKv<GigaChatCredentials | undefined>(KV.gigachatCredentials, undefined);
}

export async function setGigaChatCredentials(creds: GigaChatCredentials): Promise<void> {
  await setKv(KV.gigachatCredentials, creds);
}

export async function getYandexCredentials(): Promise<YandexCredentials | undefined> {
  return getKv<YandexCredentials | undefined>(KV.yandexCredentials, undefined);
}

export async function setYandexCredentials(creds: YandexCredentials): Promise<void> {
  await setKv(KV.yandexCredentials, creds);
}
