// PLAN.md §9.1 — top-level TTS orchestrator. Picks kokoro-js (if the user
// opted in) or Web Speech (always-available instant fallback), transparently
// cache-first for kokoro output. Screens should go through this module
// rather than calling `tts/kokoro.ts` / `tts/webSpeech.ts` directly.

import { buildTtsCacheKey, getCachedAudio, putCachedAudio } from './cache';
import { synthesizeWithGemini } from './gemini';
import type { ModelLoadProgress } from './kokoro';
import { cancelWebSpeech, isWebSpeechAvailable, pickWebSpeechVoice, speakWebSpeech } from './webSpeech';
import { defaultVoiceFor } from './voices';
import {
  getAccent,
  getGender,
  getGeminiEnabled,
  getKokoroEnabled,
  getRate,
  incrementSystemPlayCount,
  shouldShowKokoroPrompt,
} from './settings';
import { emitKokoroPrompt } from './kokoroPromptNotifier';

export type SpeakEngine = 'gemini' | 'kokoro' | 'webSpeech';

export interface SpeakResult {
  engine: SpeakEngine;
}

let currentAudio: HTMLAudioElement | null = null;

/** Stops whatever is currently playing (either engine). Safe to call anytime. */
export function stopSpeaking(): void {
  cancelWebSpeech();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
}

function playBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      reject(new Error('audio playback failed'));
    };
    void audio.play().catch(reject);
  });
}

/** Synthesizes (or reads from cache) and returns the Blob, without playing it — used to prefetch the next item. */
export async function ensureKokoroAudio(text: string): Promise<Blob> {
  const [accent, gender, rate] = await Promise.all([getAccent(), getGender(), getRate()]);
  const voice = defaultVoiceFor(accent, gender);
  const key = await buildTtsCacheKey(text, voice.id, rate);
  const cached = await getCachedAudio(key);
  if (cached) return cached;
  const { synthesizeWithKokoro } = await import('./kokoro');
  const { blob } = await synthesizeWithKokoro(text, voice.id, rate);
  await putCachedAudio(key, blob);
  return blob;
}

/** Synthesizes with Gemini TTS or returns the cached audio without playing it. */
export async function ensureGeminiAudio(text: string, rateOverride?: number): Promise<Blob> {
  const [accent, gender, defaultRate] = await Promise.all([getAccent(), getGender(), getRate()]);
  const rate = rateOverride ?? defaultRate;
  const voice = gender === 'f' ? 'Kore' : 'Puck';
  const key = await buildTtsCacheKey(text, `gemini:${accent}:${voice}`, rate);
  const cached = await getCachedAudio(key);
  if (cached) return cached;
  const blob = await synthesizeWithGemini(text, { accent, gender, rate });
  await putCachedAudio(key, blob);
  return blob;
}

/** Background prefetch — no-op if kokoro isn't enabled; swallows errors otherwise (best-effort warm-up). */
export function prefetchKokoro(text: string): void {
  void getKokoroEnabled().then((enabled) => {
    if (enabled) void ensureKokoroAudio(text).catch(() => undefined);
  });
}

export interface SpeakOptions {
  /** Prevent automatic flows from using local speech when cloud speech is unavailable. */
  allowLocalFallback?: boolean;
  /** Called once if kokoro needs to synthesize (cache miss) — screens can show a spinner. */
  onSynthesisStart?: () => void;
  /** Forwarded to `loadKokoroModel` the very first time the model itself has to download. */
  onModelLoadProgress?: (p: ModelLoadProgress) => void;
  /** Overrides the persisted speed setting for this one call — e.g. dictation's own speed control (§9.2), without touching the global default. */
  rateOverride?: number;
}

/**
 * Speaks `text` using the user's configured engine. Falls back to Web Speech
 * if kokoro is disabled, or if kokoro synthesis fails for any reason (never
 * leaves the user with silence).
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<SpeakResult> {
  stopSpeaking();
  const [geminiEnabled, kokoroEnabled] = await Promise.all([getGeminiEnabled(), getKokoroEnabled()]);

  if (geminiEnabled) {
    try {
      const blob = await ensureGeminiAudio(text, opts.rateOverride);
      await playBlob(blob);
      return { engine: 'gemini' };
    } catch {
      // Do not silently switch to a different voice when cloud speech is selected.
      throw new Error('Gemini TTS is unavailable; local speech fallback is disabled');
    }
  }

  if (opts.allowLocalFallback === false) {
    throw new Error('Cloud TTS is not configured; local speech fallback is disabled');
  }

  if (kokoroEnabled) {
    try {
      const [accent, gender, defaultRate] = await Promise.all([getAccent(), getGender(), getRate()]);
      const rate = opts.rateOverride ?? defaultRate;
      const voice = defaultVoiceFor(accent, gender);
      const key = await buildTtsCacheKey(text, voice.id, rate);
      let blob = await getCachedAudio(key);
      if (!blob) {
        opts.onSynthesisStart?.();
        const { loadKokoroModel, synthesizeWithKokoro } = await import('./kokoro');
        await loadKokoroModel(opts.onModelLoadProgress);
        const result = await synthesizeWithKokoro(text, voice.id, rate);
        blob = result.blob;
        await putCachedAudio(key, blob);
      }
      await playBlob(blob);
      return { engine: 'kokoro' };
    } catch {
      // Fall through to Web Speech — kokoro must never leave the learner
      // without audio (model load failure, WASM unsupported, etc).
    }
  }

  if (!isWebSpeechAvailable()) {
    throw new Error('No TTS engine available');
  }
  const [accent, gender, defaultRate] = await Promise.all([getAccent(), getGender(), getRate()]);
  const voice = await pickWebSpeechVoice(accent, gender);
  await speakWebSpeech(text, { rate: opts.rateOverride ?? defaultRate, voice });
  void incrementSystemPlayCount().then(() => {
    void shouldShowKokoroPrompt().then((show) => {
      if (show) emitKokoroPrompt();
    });
  });
  return { engine: 'webSpeech' };
}
