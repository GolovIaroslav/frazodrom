// PLAN.md §9.1 — "after ~20 system-voice plays, a one-time unobtrusive
// prompt: 'there's a better voice (86 MB, offline forever)'". Tiny event bus,
// same minimal shape as `llm/switchNotifier.ts`, so the UI banner
// (components/KokoroPromptBanner.tsx) doesn't need `tts/speak.ts` to depend
// on React.

type Listener = () => void;

const listeners = new Set<Listener>();

export function onKokoroPrompt(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitKokoroPrompt(): void {
  for (const listener of listeners) listener();
}
