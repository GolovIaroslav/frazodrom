// PLAN.md §8.1 — resolves a routing-config id ("gemini:flash-lite",
// "ollama:default") to a live LLMProvider instance.

import { GeminiProvider } from './providers/gemini';
import { LocalOpenAIProvider } from './providers/localOpenai';
import { MODEL_ALIASES, getLocalOpenAIProfiles } from './settings';
import type { LLMProvider } from './types';

export async function resolveProviderById(id: string): Promise<LLMProvider | undefined> {
  const alias = MODEL_ALIASES[id];
  if (alias) return new GeminiProvider(alias.model);

  const profiles = await getLocalOpenAIProfiles();
  const profile = profiles.find((p) => p.id === id);
  if (profile) return new LocalOpenAIProvider(profile);

  return undefined;
}

/** First configured, budget-unexhausted provider in a role's fallback chain. */
export async function resolveChain(ids: readonly string[]): Promise<LLMProvider[]> {
  const providers: LLMProvider[] = [];
  for (const id of ids) {
    const provider = await resolveProviderById(id);
    if (provider) providers.push(provider);
  }
  return providers;
}
