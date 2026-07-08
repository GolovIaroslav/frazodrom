# MEMORY.md — project working memory

Read by the agent at the start of every session (see AGENTS.md). Keep it under 200 lines: pointers and decisions, not data.
Format: `## Topic → where to look | one-line gist`.

---

## Overview

"Frazodrom" — an open, non-commercial English trainer, RU→EN by pattern (A1–C1): translation drills, FSRS reviews, listening/speaking, exams, a BYOK AI tutor. Backend-less web PWA, hosted on GitHub Pages, corpus from Tatoeba (CC-BY).

## Pointers

- Plan (normative) → PLAN.md | §0 rules, §16 phases Ф0–Ф9 with acceptance criteria
- Skill map → PLAN.md §3.4 | ~75 skills, stable ids
- Data pipeline → PLAN.md §4 | manythings/Tatoeba → JSON packs, CLI `etr`
- Answer-checking cascade → PLAN.md §7 | normalize → accepted-set → LLM judge → self-check
- AI layer and prompts → PLAN.md §8 | BYOK, role routing, budgets, local models §8.7, model switcher §8.8
- Verified external facts → PLAN.md §17.2 | API limits and versions as of 2026-07-07
- Research queries (user runs these themselves) → PLAN.md §17.3

## Key user decisions

- 2026-07-07: platform — web PWA; public free site; name "Frazodrom"; hosting GitHub Pages; project is open, non-commercial; bilingual UI ru+en; local models (Ollama/LM Studio/llama.cpp) — a bonus option, cloud APIs take priority; user's key — localStorage only, no accounts.
- REWRITE mechanic is mandatory: after the correct answer is shown, the user retypes the translation from a blank field (PLAN.md §6.1).
- The user runs external research themselves using ready-made queries (§17.3) for time-sensitive facts (§17.2: provider pricing/limits/versions). Amended 2026-07-08: agents MAY search the web on their own for ordinary implementation questions (library syntax, API shape, how a tool works) — only §17.2-style facts still route through the user.
- 2026-07-08: AGENTS.md merged into CLAUDE.md (single file, English); user maintains their own AGENTS.md separately for Codex. Added: decision-making-under-uncertainty rules and a standing `implementation-notes.md` convention (see CLAUDE.md).
- 2026-07-08: the project is **international** — no country-specific framing anywhere in docs/UI. Regional unavailability of any LLM provider is handled architecturally: as many adapters as possible (incl. GigaChat, Yandex AI Studio) + routing chain + local models; never region-targeted defaults or wording.

## ACTIVE CONTEXT

- 2026-07-08: PLAN.md v1.3 — 260-question audit applied (~45 fixes) + research results №11–14 folded in (§8.2 provider chain incl. GigaChat/Yandex; §14.4 generated-content license; §4.5 CEFR-SP/ReadMe++ ground truth; §3.4 B1-5 chunk methodology). See session log at the bottom of PLAN.md. Ф3 is split into Ф3а/Ф3б/Ф3в.
- User to confirm agent-drafted defaults in §1.1: positioning paragraph, success criteria, distribution mini-plan.
- 2026-07-08: Ф0 done (app/ + pipeline/ scaffold, CI). Agent decisions/deviations logged in implementation-notes.md (local, gitignored).
- 2026-07-08: user asked the agent to run phases autonomously back-to-back (via ScheduleWakeup self-pacing) instead of the human restarting a session per phase — accepted as an operating-mode override of "one phase = one session"; the phase-by-phase implement→verify→log discipline itself is unchanged. Phases with hard human-only steps (manual proofreading Ф1/Ф6, live user testing Ф8, §17.2/17.3 provider-fact confirmation) still stop and go to BLOCKERS.md.
- 2026-07-08: Ф1 done — full no-LLM pipeline (fetch→clean→tag→level→curate→emit→validate), 11 A1-1/A1-2 skills, `etr validate` 0 problems. CEFR calibration run once against CEFR-SP (HF), thresholds left as-is — flagged for your manual spot-check. 100-sentence review sample is in implementation-notes.md, not a PR.
- 2026-07-08: Ф2 done — checker's 3 outstanding wip-tests fixed (adjacent-letter transposition in editDistance.ts, apologised/apologising, guard cleanup that unblocked short-word typos like "teh"); full Dexie v2 schema (10 tables, §5.3); lazy pack loading from repo-root `packs/` (not duplicated into app/); `DrillEngine` state machine (show→check→REWRITE, hint ladder, requeue) in app/src/engine/; DrillScreen + CourseMapScreen on real pack data; storage protection (persist(), incognito heuristic, Web Locks helper — banner not wired yet); a11y basics (aria-live, color+icon+word, focus-visible, rem). Checker tests 167/167 (AC ≥120 met), app-wide 204/204, Playwright smoke (new, none existed before) measures cold-start→first-sentence at ~1.7s on emulated Fast 3G (local vite preview, not real GH Pages — recheck at Ф8). Not built yet: cross-skill interleave wiring, fluency sprints, contrast duels, SRS field population (all correctly later phases). Judgment calls and full detail in implementation-notes.md.
- Confirmed for user: level-skipping is already in the plan (§11 — placement, module skip-test anytime, level exams), not missing. A1 sentence brevity (2–18 tokens, ≤12 for A1–A2) is an intentional CEFR-level design choice (§4.3), not an accident; corpus's "textbook-ish" feel is a known limitation with mitigations already planned (LLM naturalness pass in Ф6, per-sentence "⚑ bad sentence" flag button, honest README disclaimer) — no plan change needed, just reassurance.
- 2026-07-08: Ф3а mostly done, checkbox NOT ticked (AC not fully met) — see BLOCKERS.md. Built: Gemini + `local-openai` adapters, judge tier 3 (JUDGE_SYSTEM verbatim, zod contract §7.4, retries incl. Cyrillic-check), tier 4 self-check, acceptedCache, per-provider+role daily budgets, model chip with manual override, key validation on save, "Don't wait" abort, `judgeDisputes` table + 🚩 flag, 70-case judge fixture set + benchmark harness (tested against mocked providers only). Fixed one real spec violation found on review: escalation to a final "wrong" was force-revealing the reference/REWRITE, skipping the retry/hint/give-up step §6.1 requires — corrected, 3 new tests lock it in. Vitest 250/250, eslint/tsc/build clean. **Hard blocker (BLOCKERS.md):** §7.5's live benchmark run (60-100 cases against real candidate models, ≥80% accuracy gate, result logged in PLAN.md) needs a user-owned API key — cannot run autonomously. `DEFAULT_ROUTING.judge` is left empty on purpose so nothing becomes a silent unvalidated default judge.
- 2026-07-08: Ф3б done — tutor 4 action buttons (Errors/Explain/Variants/Nuances, verbatim ACTION_* prompts) with `tutorActionCache` (Dexie v4, key includes prompt hash so editing a prompt invalidates old cached replies); ephemeral tutor chat (TUTOR_SYSTEM, 6-turn cap, not persisted); prompt editor in Settings (JUDGE_SYSTEM/TUTOR_SYSTEM/ACTION_*) with reset-to-default and a "default was updated" hash-version note; JUDGE_SYSTEM smoke-test on save (mocked-provider tests only — no live key here). Judgment call: only «Ошибки»/«Разбор» force reveal+REWRITE, not «Варианты»/«Нюансы» — followed §6.1's explicit list over §8.5's looser "any action that reveals the answer" phrasing. Vitest 250→262, eslint/tsc/build clean.
- Next step — Ф3в (доп. провайдеры: Groq/OpenRouter/GigaChat/Yandex) or Ф4 (FSRS) — user's choice, PLAN.md §16.
