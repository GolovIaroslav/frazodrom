# AGENTS.md — Universal Cross-Platform AI Agent Rules
# Works in: Antigravity, Cursor, VS Code Copilot, Claude Code, Codex CLI, Gemini CLI, Windsurf
# Place in: project root (auto-detected by all tools)
# Source stack: Karpathy + Caveman + Anthropic leaked memory arch + Superpowers

---

## CORE BEHAVIORAL RULES

### 1. Think Before Coding
- State assumptions explicitly. If uncertain → ASK, don't guess.
- Multiple interpretations exist? Present them — don't pick silently.
- Simpler approach exists? Say so. Push back when warranted.
- Something unclear? Stop. Name what's confusing. Ask.

### 2. Simplicity First
- Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- 200 lines when 50 would do? Rewrite it.
- Test: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
- Touch ONLY what is needed for the request.
- Do NOT improve adjacent code, comments, or formatting.
- Do NOT refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Notice unrelated dead code? Mention it — don't delete it.
- YOUR changes made imports/variables unused? Remove those. Pre-existing dead code? Leave it.
- Test: Every changed line must trace directly to the user's request.

### 4. Goal-Driven Execution
- Transform every task into verifiable success criteria.
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- For multi-step tasks, state a plan:
  ```
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  ```

---

## COMMUNICATION STYLE

Default: concise and direct. No filler. No pleasantries.
When user says "caveman" or "less tokens":
- Drop articles (a, an, the), filler words, hedging
- Use fragments. Technical terms stay exact.
- Code blocks stay unchanged — caveman speech around code only.
- Pattern: `[thing] [problem] [reason]. [fix]:`
- Deactivate when user says "normal" or "подробнее"

---

## WORKING MEMORY — READ MEMORY.md FIRST

At the START of every session:
1. Check if `MEMORY.md` exists in project root
2. If yes — read it BEFORE doing anything else
3. Use it to understand: what was decided, what files matter, what patterns are used

During session — maintain mental scratchpad:
- Current goal, assumptions made, files touched, open questions, next step

After session — update MEMORY.md with significant details only:
- Architectural decisions (WHY, not just what)
- Bugs found and their root cause pattern
- Non-obvious file purposes
- Constraints not visible in code

MEMORY.md rules:
- Keep under 200 lines (index only — store pointers not data)
- Format: `## [Topic] → see [path] | [one-line summary]`
- Only update after confirmed successful file write

---

## WORKFLOW FOR NON-TRIVIAL TASKS

For features touching 3+ files, new projects, complex refactors:

**In this project, PLAN.md §16 already IS the plan** (phases Ф0–Ф9, each with acceptance criteria) — for work that fits inside a phase, skip Phase 1/2 below and go straight to EXECUTE. Only run Phase 1/2 for ad-hoc work that falls outside any PLAN.md phase.

**Phase 1 — BRAINSTORM (mandatory gate)**
- Read context (MEMORY.md, relevant files)
- Ask clarifying questions
- Propose 2–3 approaches with tradeoffs
- NO code until design is approved by user

**Phase 2 — PLAN**
- Map files to CREATE / MODIFY / READ
- Break into tasks of 2–5 minutes each
- Each task: exact file paths + verification step
- State the plan in chat — do NOT save it to `docs/plans/*.md` (this project forbids new .md files without the user's request; see Off-limits below)

**Phase 3 — EXECUTE**
- One task at a time
- Verify each task before moving on
- Write failing test → code → refactor (when applicable)
- Self-review before marking done

For trivial tasks (typo fix, obvious one-liner): skip workflow.

---

## ANTI-PATTERNS

NEVER:
- Read entire codebase "just to understand" — use targeted reads
- Store reasoning in chat — store decisions in files
- Speculatively update memory — only after confirmed writes
- Re-explain context you already have

---

## PROJECT SPECIFICS

**Project:** "Frazodrom" — free, open, non-commercial English trainer for Russian speakers (RU→EN pattern drills, FSRS reviews, listening/speaking, exams, BYOK AI tutor). Backend-less web PWA, progress local-only, hosted on GitHub Pages. Normative doc — **PLAN.md** (architecture, phases §16, schemas, prompts); Claude Code additionally reads **CLAUDE.md**.

**Stack:** `app/` — Vite + React + TypeScript + Tailwind + Zustand + Dexie + ts-fsrs. `pipeline/` — Python 3.12 + uv + polars + spaCy (CLI `etr`). `packs/` — generated course JSON, committed. No backend.

**Conventions:**
- Code, comments, commits, docstrings — English. UI strings — only via the i18n dictionary (full ru+en), no hardcoded strings. Talk to the user in Russian.
- Commits: Conventional Commits, title only, no body, no AI mentions. Commit often, small steps.
- Before committing: `app/` → eslint + tsc + vitest; `pipeline/` → ruff + mypy + pytest; touched packs → `uv run etr validate`.
- Any checker bug → table-driven test case first, then fix. New logic → test first.
- `normalize()` is the single source of truth for answer comparison — no ad-hoc `.toLowerCase()` comparisons bypassing it.
- One phase (PLAN.md §16) per session; after a phase: run acceptance criteria, check the box, 3–5-line log entry at the end of PLAN.md, update MEMORY.md.

**Off-limits:**
- Committing secrets, API keys, `.env` — repo is public.
- Paid APIs, backend, accounts, telemetry/analytics — without the user's explicit yes.
- Generating core course content with an LLM at runtime (course base is pipeline-built from the corpus).
- Hardcoding provider limits in code — config only.
- Automated requests to the public languagetool.org API (self-hosted only).
- New .md files without the user's request (exception: `implementation-notes.md`, standing-authorized — see CLAUDE.md).
- Breaking stable skill ids or the pack schema without recording it in PLAN.md.
- Removing Tatoeba (CC-BY) attribution.
