import type { LocalOpenAIProfile, RoutingConfig } from './settings';
import type { ChipInfo } from './status';
import type { Role } from './types';

export const ROLE_ORDER: Role[] = ['judge', 'tutor', 'generator'];
export const LOCAL_PROVIDER_ID = 'ollama:default';

const BUILTIN_PROVIDER_ORDER = [
  'gemini:flash',
  'gemini:flash-lite',
  'groq:llama-8b',
  'openrouter:free',
  'gigachat:pro',
  'yandex:yandexgpt-lite',
] as const;

const BUILTIN_PROVIDER_LABELS: Record<(typeof BUILTIN_PROVIDER_ORDER)[number], string> = {
  'gemini:flash': 'Gemini Flash',
  'gemini:flash-lite': 'Gemini Flash Lite',
  'groq:llama-8b': 'Groq Llama 8B',
  'openrouter:free': 'OpenRouter Free',
  'gigachat:pro': 'GigaChat',
  'yandex:yandexgpt-lite': 'YandexGPT Lite',
};

export interface ProviderOption {
  id: string;
  label: string;
  category: 'cloud' | 'local';
}

export interface RoleReadiness {
  tone: 'ready' | 'warning' | 'blocked';
  reason: 'routeEmpty' | 'active' | 'allLimited' | 'noConfigured' | 'unreachable';
  activeLabel?: string;
}

export function buildProviderOptions(localLabel = 'Local OpenAI-compatible'): ProviderOption[] {
  return [
    ...BUILTIN_PROVIDER_ORDER.map((id) => ({
      id,
      label: BUILTIN_PROVIDER_LABELS[id],
      category: 'cloud' as const,
    })),
    { id: LOCAL_PROVIDER_ID, label: localLabel, category: 'local' as const },
  ];
}

export function addProviderToRole(config: RoutingConfig, role: Role, providerId: string): RoutingConfig {
  if (config[role].includes(providerId)) return config;
  return { ...config, [role]: [...config[role], providerId] };
}

export function removeProviderFromRole(config: RoutingConfig, role: Role, providerId: string): RoutingConfig {
  return { ...config, [role]: config[role].filter((id) => id !== providerId) };
}

export function moveProviderInRole(config: RoutingConfig, role: Role, index: number, delta: -1 | 1): RoutingConfig {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= config[role].length) return config;
  const nextRoleIds = [...config[role]];
  const [moved] = nextRoleIds.splice(index, 1);
  nextRoleIds.splice(nextIndex, 0, moved);
  return { ...config, [role]: nextRoleIds };
}

export function upsertLocalProfile(
  profiles: readonly LocalOpenAIProfile[],
  profile: LocalOpenAIProfile,
): LocalOpenAIProfile[] {
  const existingIndex = profiles.findIndex((item) => item.id === profile.id);
  if (existingIndex === -1) return [...profiles, profile];

  return profiles.map((item, index) => (index === existingIndex ? { ...item, ...profile } : item));
}

export function summarizeRoleReadiness(chain: readonly ChipInfo[]): RoleReadiness {
  if (chain.length === 0) return { tone: 'blocked', reason: 'routeEmpty' };

  const active = chain.find((item) => item.status === 'available');
  if (active) {
    return { tone: 'ready', reason: 'active', activeLabel: active.label };
  }

  if (chain.some((item) => item.status === 'limited')) {
    return { tone: 'warning', reason: 'allLimited' };
  }

  if (chain.some((item) => item.status === 'noKey')) {
    return { tone: 'blocked', reason: 'noConfigured' };
  }

  return { tone: 'blocked', reason: 'unreachable' };
}
