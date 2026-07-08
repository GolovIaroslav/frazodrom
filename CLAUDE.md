# CLAUDE.md — Frazodrom

Normative plan — [PLAN.md](PLAN.md). Session working context — [MEMORY.md](MEMORY.md): read it at the start of a session and update it at the end.

---

## About the project

**"Frazodrom"** (Фразодром) is a free, open, non-commercial English trainer for Russian speakers: RU→EN sentence translation by grammar pattern (A1–C1), spaced repetition (FSRS), listening/speaking, exams, a BYOK AI tutor (bring your own API key). A backend-less web PWA: all progress lives in the browser, hosting is GitHub Pages, data comes from the open Tatoeba corpus (CC-BY).

Stack: `app/` — Vite + React + TypeScript + Tailwind + Zustand + Dexie + ts-fsrs; `pipeline/` — Python 3.12 + uv + polars + spaCy (CLI `etr`); `packs/` — generated course JSON packs (committed).

---

## Behavior

1. **Think before coding.** If something is ambiguous, name the options and ask — don't choose silently. If there's a simpler path, say so.
2. **Simplicity first.** Minimum code that solves the task. Nothing "for later": no abstractions for one-off code, no features nobody asked for. Test: "would a senior say this is overengineered?" — if yes, simplify.
3. **Surgical changes.** Touch only what the task requires. Don't refactor adjacent code, don't "improve" someone else's comments or formatting. Noticed dead code — mention it, don't delete it.
4. **Verifiable criteria.** Every task becomes a check: "add validation" → "write a test for invalid input and make it pass." Every phase in PLAN.md §16 has acceptance criteria — run them.
5. **Don't re-read the whole repo** "to understand" — read narrowly. Store decisions in files (PLAN.md, MEMORY.md), not in chat.

---

## Deciding under uncertainty (important — read carefully)

Implementation always hits gaps the spec didn't cover. Never fill a gap with a silent coin-flip. In order of preference:

1. **Ambiguity you can ask about without stalling the session** → stop and ask the user. Don't guess when a question is cheap.
2. **A real technical unknown (library syntax, API shape, how some tool works)** → you may search the web yourself, calmly, no need to ask permission first. This does **not** cover time-sensitive external facts about LLM-provider pricing/limits/versions (PLAN.md §17.2) — those stay user-verified: pull from §17.2, or hand the user a ready query from §17.3. Don't blend the two: "how does `vite-plugin-pwa` configure precaching" — search it yourself; "what's Gemini's free-tier RPD today" — ask the user to check.
3. **Forced to make a judgment call because stopping to ask would be worse than proceeding** → make the call, then say so explicitly. At the end of your response, add a bold line: **"Decision made on my own: …"** naming exactly what you decided and why. Never let a self-made decision pass unmentioned.
4. **An idea occurs to you that's genuinely valuable but wasn't in the plan, and it's substantial enough to deserve real thought (not a quick judgment call)** → don't implement it and don't decide it yourself. Stop, write up the idea in detail (what it is, why it matters, what it would change) and tell the user this is worth escalating to a stronger thinking model for a verdict before anyone builds it.

## Implementation notes (Thariq's pattern)

While implementing a phase or spec, keep a running **`implementation-notes.md`** at the repo root: append decisions that weren't in the spec, things you had to change, tradeoffs you made, anything the user should know. This file is a standing, pre-authorized exception to the "no new .md files without asking" rule below — always allowed, always append-only during a session. At phase end, fold anything load-bearing from it into the PLAN.md session log (§0.5) and MEMORY.md; the file itself can keep accumulating across phases.

---

## Workflow

- **One phase = one session.** Phases and their criteria are in PLAN.md §16. Rules for working with the plan are in PLAN.md §0. Don't implement future phases.
- At the start of a session, read **MEMORY.md** (working context), then PLAN.md §0 and §16.
- After a phase: run the acceptance criteria, check the box in PLAN.md §16, add 3–5 lines to the log at the end of PLAN.md, update MEMORY.md (only confirmed facts and decisions, kept brief).
- JSON schemas in PLAN.md are normative: changing a schema means recording the change in PLAN.md and the log.

---

## Conventions

- **Languages:** code, comments, commits, docstrings — English. UI strings — only via the i18n dictionary, full ru+en duplication, hardcoded strings are forbidden. Communication with the user — Russian.
- **Commits:** Conventional Commits, title only, no body (`feat(drill): add hint ladder`). Commit often, in small logical steps. Don't mention AI tools in commits.
- **Before committing:** `app/` — eslint + tsc + vitest; `pipeline/` — ruff + mypy + pytest; if you touched packs — `uv run etr validate`.
- **Tests:** any checker bug is first captured as a case in the table-driven tests, then fixed. New logic — test first.
- **Project's money-equivalent:** answer normalization (`normalize()`) is the single source of truth for string comparison; no ad-hoc `.toLowerCase()` comparisons that bypass it.

---

## Forbidden (NEVER)

- Committing secrets, API keys, `.env` — **the repository is public**.
- Adding paid APIs, a backend, accounts, telemetry/analytics — without the user's explicit "yes."
- Generating the course's core content with an LLM at runtime — the course base is built by the pipeline from the corpus (PLAN.md §1.4).
- Hardcoding provider limits in code — config only (PLAN.md §8).
- Hitting the public languagetool.org API with automated requests (self-hosted only, PLAN.md §13.3).
- Creating new .md files without the user's request — except `implementation-notes.md` above, which is standing-authorized.
- Breaking stable skill ids or the pack schema without recording it in PLAN.md.
- Removing Tatoeba (CC-BY) attribution — the "Data and Licenses" page is mandatory.

---

## Claude-specific

- Reply to the user in Russian, briefly and in plain language. Code/commits — English.
- Do deep analysis yourself, without delegating reads to subagents. Use subagents sparingly, only when it's genuinely cheaper.
- Commit often, in small steps.
- One phase from PLAN.md §16 per session; after a phase — check the box, log entry at the end of PLAN.md, a short prompt for the next session.
- Show a plan before big changes; after implementing — run the phase's tests and acceptance criteria.
