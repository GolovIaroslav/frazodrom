// PLAN.md §8.8 — provider-switch toast on 429/quota errors. The chain-walking
// loops in judge.ts /
// tutorActions.ts / tutorChat.ts already skip a provider that throws
// LLMRateLimitError and try the next one; this module is the tiny event bus
// that lets a UI toast (components/Toast.tsx) observe that skip happening,
// without those call sites depending on React at all.

export interface SwitchEvent {
  role: string;
  fromProviderId: string;
  fromLabel: string;
  toProviderId?: string;
  toLabel?: string;
  reason: 'rateLimit' | 'authError';
}

type Listener = (event: SwitchEvent) => void;

const listeners = new Set<Listener>();

export function onProviderSwitch(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitProviderSwitch(event: SwitchEvent): void {
  for (const listener of listeners) listener(event);
}
