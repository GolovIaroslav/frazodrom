// PLAN.md §9.1 — browser-native speech only. This avoids model downloads,
// WASM synthesis, cloud TTS latency, and background CPU use.

import { cancelWebSpeech, isWebSpeechAvailable, pickWebSpeechVoice, speakWebSpeech } from './webSpeech';
import { getAccent, getGender, getRate } from './settings';

export type SpeakEngine = 'webSpeech';

export interface SpeakResult {
  engine: SpeakEngine;
}

export interface SpeakOptions {
  /** Overrides the persisted speed setting for this call without changing the global preference. */
  rateOverride?: number;
}

export function stopSpeaking(): void {
  cancelWebSpeech();
}

export async function speak(text: string, opts: SpeakOptions = {}): Promise<SpeakResult> {
  stopSpeaking();
  if (!isWebSpeechAvailable()) throw new Error('No browser speech engine available');

  const [accent, gender, defaultRate] = await Promise.all([getAccent(), getGender(), getRate()]);
  const voice = await pickWebSpeechVoice(accent, gender);
  await speakWebSpeech(text, { rate: opts.rateOverride ?? defaultRate, voice });
  return { engine: 'webSpeech' };
}
