// PLAN.md §9.1 — voice catalog. Exact ids/genders confirmed from the
// published `kokoro-js@1.2.1` npm package's `voices/*.bin` file list (Ф5
// perf spike, implementation-notes.md) — not guessed. Grades are copied from
// the package README's own quality table, used only to pick sensible
// defaults (an A/B-grade voice per accent+gender combo), not exposed in the
// UI as a ranking.

export type Accent = 'US' | 'UK';
export type Gender = 'f' | 'm';
export type SpeechRate = 0.7 | 0.85 | 1.0;

export const SPEECH_RATES: readonly SpeechRate[] = [0.7, 0.85, 1.0];

export interface KokoroVoice {
  id: string;
  accent: Accent;
  gender: Gender;
  grade: string;
}

// American English.
const AMERICAN_FEMALE: KokoroVoice[] = [
  { id: 'af_heart', accent: 'US', gender: 'f', grade: 'A' },
  { id: 'af_bella', accent: 'US', gender: 'f', grade: 'A-' },
  { id: 'af_nicole', accent: 'US', gender: 'f', grade: 'B-' },
  { id: 'af_aoede', accent: 'US', gender: 'f', grade: 'C+' },
  { id: 'af_kore', accent: 'US', gender: 'f', grade: 'C+' },
  { id: 'af_sarah', accent: 'US', gender: 'f', grade: 'C+' },
  { id: 'af_nova', accent: 'US', gender: 'f', grade: 'C' },
  { id: 'af_alloy', accent: 'US', gender: 'f', grade: 'C' },
  { id: 'af_sky', accent: 'US', gender: 'f', grade: 'C-' },
  { id: 'af_jessica', accent: 'US', gender: 'f', grade: 'D' },
  { id: 'af_river', accent: 'US', gender: 'f', grade: 'D' },
];

const AMERICAN_MALE: KokoroVoice[] = [
  { id: 'am_fenrir', accent: 'US', gender: 'm', grade: 'C+' },
  { id: 'am_michael', accent: 'US', gender: 'm', grade: 'C+' },
  { id: 'am_puck', accent: 'US', gender: 'm', grade: 'C+' },
  { id: 'am_echo', accent: 'US', gender: 'm', grade: 'D' },
  { id: 'am_eric', accent: 'US', gender: 'm', grade: 'D' },
  { id: 'am_liam', accent: 'US', gender: 'm', grade: 'D' },
  { id: 'am_onyx', accent: 'US', gender: 'm', grade: 'D' },
  { id: 'am_santa', accent: 'US', gender: 'm', grade: 'D-' },
  { id: 'am_adam', accent: 'US', gender: 'm', grade: 'F+' },
];

// British English.
const BRITISH_FEMALE: KokoroVoice[] = [
  { id: 'bf_emma', accent: 'UK', gender: 'f', grade: 'B-' },
  { id: 'bf_isabella', accent: 'UK', gender: 'f', grade: 'C' },
  { id: 'bf_alice', accent: 'UK', gender: 'f', grade: 'D' },
  { id: 'bf_lily', accent: 'UK', gender: 'f', grade: 'D' },
];

const BRITISH_MALE: KokoroVoice[] = [
  { id: 'bm_fable', accent: 'UK', gender: 'm', grade: 'C' },
  { id: 'bm_george', accent: 'UK', gender: 'm', grade: 'C' },
  { id: 'bm_lewis', accent: 'UK', gender: 'm', grade: 'D+' },
  { id: 'bm_daniel', accent: 'UK', gender: 'm', grade: 'D' },
];

export const KOKORO_VOICES: readonly KokoroVoice[] = [
  ...AMERICAN_FEMALE,
  ...AMERICAN_MALE,
  ...BRITISH_FEMALE,
  ...BRITISH_MALE,
];

/** Best-graded voice for a given accent+gender — the default selection. */
export function defaultVoiceFor(accent: Accent, gender: Gender): KokoroVoice {
  const candidates = KOKORO_VOICES.filter((v) => v.accent === accent && v.gender === gender);
  return candidates[0] as KokoroVoice; // each list above is already sorted best-grade-first
}

export function voicesFor(accent: Accent, gender: Gender): readonly KokoroVoice[] {
  return KOKORO_VOICES.filter((v) => v.accent === accent && v.gender === gender);
}
