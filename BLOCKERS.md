# BLOCKERS.md — needs a human (money/access/judgment), not a guess

## Ф3а — LLM judge mini-benchmark needs a real, user-owned API key (2026-07-08)

PLAN.md §7.5 requires running 60–100 hand-labeled judge cases against real candidate
models (Gemini and whatever else is wired) and recording accuracy in the plan's log —
a model under 80% must not become the default judge. This inherently needs a live API
key (BYOK, no shared project key exists or should exist — CLAUDE.md forbids adding paid
APIs). I built the benchmark harness and the 60-100 labeled fixture cases as static
Vitest data (used to unit-test the zod contract and cascade logic with mocked responses),
but I cannot run them against a real Gemini/Groq/etc. account and record real accuracy —
that step needs you to supply a key and either run it yourself or hand me a
temporary one to run once.

**What I need from you:** either (a) a BYOK key I can use for one benchmark run (then
you revoke/rotate it), or (b) you run the benchmark yourself via the app's Settings
screen once the judge UI exists, and I'll fold the recorded accuracy into PLAN.md's log.

Until this is resolved, Ф3а's default judge model choice stays unset/flagged, and the
"reset to default" judge fallback conservatively behaves like tier 4 (self-check) rather
than silently trusting an unvalidated model.
