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

## Ф3в — GigaChat/Yandex AI Studio adapters are untested against a live account (2026-07-08)

Built both adapters (`app/src/llm/providers/gigachat.ts`, `yandex.ts`) from public REST docs
(OAuth client-credentials exchange for GigaChat, `foundationModels/v1/completion` shape for
Yandex), routed through the optional local proxy (`proxy/serve.mjs`) by default per §8.2's
own "⚠️VERIFY CORS/TLS из браузера — если напрямую нельзя, через proxy/" — but neither has
been exercised against a real account, so I can't confirm the request/response shapes are
exactly right, or whether GigaChat's TLS certificate (rooted at a Russian CA not in most
default trust stores) causes real connection failures. `serve.mjs` has an inline comment
about a possible `NODE_TLS_REJECT_UNAUTHORIZED=0` workaround for local dev — that is NOT a
production fix, just a note for whoever first tests this live.

**What's needed from you:** if you want these two providers actually usable, get a GigaChat
key (freemium, §8.2) and/or a Yandex AI Studio key and test one real call each through
`proxy/serve.mjs` (`node proxy/serve.mjs`, fill `proxy/.env` from `.env.example`). Report
back what broke (wrong endpoint, auth shape, TLS) and I'll fix the adapter. Until then,
treat both as best-effort/unverified — Gemini + local-openai + Groq + OpenRouter remain the
adapters with any real confidence behind them (Groq/OpenRouter endpoint shapes were verified
against current public docs, also not against a live key, but their OpenAI-compatible shape
is much more standardized and lower-risk).

## Ф5 — wh-question intonation needs a human ear-check (2026-07-12)

PLAN.md §16 Ф5's own acceptance criteria literally says "wh-questions on the
default voices sound with question intonation (check by ear when picking
voices)" — this is a perceptual judgment call I cannot make; I have no way to
listen to synthesized audio. Everything else in Ф5 is built and verified live
in a real browser (Playwright driving the system chromium, both `npm run dev`
and a production `npm run preview` build): all 3 listening modes play end to
end with no console errors, kokoro-js works fully offline after the first
model download (verified with true CDP `setOffline` against a fresh,
never-before-synthesized sentence — zero external requests, only an unrelated
favicon 404), and live voice switching (US/female → UK/male) works without
reload. Only this one ear-check is unverified, so Ф5's checkbox is left
unticked pending it.

**What I need from you:** open Settings → "Включить качественный голос" →
"🔊 Проверить голос" (or just play a few wh-question sentences from any
skill pack, e.g. "Where did you put the keys?" / "What time is it?"), on a
couple of the default voices (`af_heart` US female, `bm_george`/`bm_daniel`
UK male — the current per-accent+gender defaults, see `tts/voices.ts`), and
tell me if the question intonation sounds natural/acceptable. If a specific
voice sounds flat or robotic on wh-questions, say which one and I'll swap the
default (`defaultVoiceFor()` in `app/src/tts/voices.ts` is a one-line change
per accent+gender group — the full 28-voice catalog with quality grades is
already there to pick a replacement from).
