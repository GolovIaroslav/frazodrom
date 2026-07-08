// PLAN.md §8.5 — registry of the runtime prompts shown in Settings → "Модели
// ИИ" prompt editor. Only the six documented there for Ф3б; FREETALK_SYSTEM /
// FREETALK_SUMMARY_SYSTEM / LESSON_GEN_SYSTEM are later phases (§8.9/§8.4) and
// intentionally excluded.

import { JUDGE_SYSTEM } from './judge';
import { TUTOR_SYSTEM } from './tutorChat';
import { ACTION_ERRORS, ACTION_EXPLAIN, ACTION_NUANCES, ACTION_VARIANTS } from './tutorActions';

export const EDITABLE_PROMPT_NAMES = [
  'JUDGE_SYSTEM',
  'TUTOR_SYSTEM',
  'ACTION_ERRORS',
  'ACTION_EXPLAIN',
  'ACTION_VARIANTS',
  'ACTION_NUANCES',
] as const;

export type EditablePromptName = (typeof EDITABLE_PROMPT_NAMES)[number];

/** Only JUDGE_SYSTEM is a JSON-role prompt (§8.5) — its editor gets the smoke test + warning. */
export const JSON_ROLE_PROMPTS: readonly EditablePromptName[] = ['JUDGE_SYSTEM'];

export const PROMPT_DEFAULTS: Record<EditablePromptName, string> = {
  JUDGE_SYSTEM,
  TUTOR_SYSTEM,
  ACTION_ERRORS,
  ACTION_EXPLAIN,
  ACTION_VARIANTS,
  ACTION_NUANCES,
};
