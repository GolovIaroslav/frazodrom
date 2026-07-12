import type { LocalOpenAIProfile } from './settings';

const GENERIC_LOCAL_LABEL = 'Local OpenAI-compatible';

export function formatLocalProviderLabel(profile: Pick<LocalOpenAIProfile, 'baseUrl' | 'label' | 'model'>): string {
  const model = profile.model.trim();
  const host = safeHost(profile.baseUrl);

  if (model && host) return `${model} (${host})`;
  if (model) return model;
  if (profile.label.trim()) return profile.label.trim();
  return GENERIC_LOCAL_LABEL;
}

function safeHost(baseUrl: string): string | undefined {
  try {
    return new URL(baseUrl).host || undefined;
  } catch {
    return undefined;
  }
}
