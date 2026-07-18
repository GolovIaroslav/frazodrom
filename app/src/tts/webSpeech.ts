// PLAN.md §9.1 — browser-native `speechSynthesis`. Voice quality and
// availability depend on the browser and operating system.

import type { Accent, Gender } from './voices';

export function isWebSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** `getVoices()` can resolve asynchronously on first call in some browsers. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    const onVoicesChanged = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    // Some browsers never fire the event if voices were already available
    // synchronously by the time this promise settles elsewhere — bounded wait.
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
  });
}

/** Picks a system voice matching the requested accent, best-effort. */
export async function pickWebSpeechVoice(
  accent: Accent,
  gender: Gender,
): Promise<SpeechSynthesisVoice | undefined> {
  const voices = await loadVoices();
  const langPrefix = accent === 'US' ? 'en-US' : 'en-GB';
  // Word-boundary-anchored: a bare `/male/i` substring match would also hit
  // "Female" (it's a substring of it), silently picking the wrong gender.
  const genderHint = gender === 'f' ? /\bfemale\b|\bwoman\b/i : /\bmale\b|\bman\b/i;
  const inLang = voices.filter((v) => v.lang.startsWith(langPrefix));
  const pool = inLang.length > 0 ? inLang : voices.filter((v) => v.lang.startsWith('en'));
  return pool.find((v) => genderHint.test(v.name)) ?? pool[0] ?? voices[0];
}

export interface WebSpeechOptions {
  rate: number;
  voice?: SpeechSynthesisVoice;
}

/** Speaks `text` via `speechSynthesis`, resolving once playback ends (or errors). */
export function speakWebSpeech(text: string, opts: WebSpeechOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel(); // never overlap two utterances
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = opts.rate;
    if (opts.voice) utterance.voice = opts.voice;
    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(new Error(e.error));
    window.speechSynthesis.speak(utterance);
  });
}

export function cancelWebSpeech(): void {
  if (isWebSpeechAvailable()) window.speechSynthesis.cancel();
}
