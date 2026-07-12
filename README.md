# Frazodrom (Фразодром)

Free, open-source English pattern trainer for Russian speakers: translate sentences from Russian to English following grammar patterns (A1–C1), drilling constructions to automaticity. Spaced repetition (FSRS), listening/speaking, exams, a BYOK AI tutor with your own API key. Runs in the browser, no accounts, progress stored locally.

**Status: in development.** Implementation plan — [PLAN.md](PLAN.md).

## AI setup at a glance

The app uses separate AI roles:

- `Judge` for ambiguous drill checking
- `Tutor` for explanations, hints, and chat
- `Generator` for generated content

Supported providers currently include Gemini, Groq, OpenRouter, GigaChat,
Yandex AI Studio, and local OpenAI-compatible servers such as Ollama, LM
Studio, or llama.cpp.

If a local OpenAI-compatible model works from the terminal but not from the
browser, it is usually a CORS issue. In that case, run `proxy/serve.mjs`, set
`Proxy URL` to `http://localhost:8787`, and route the browser request through
that proxy.

The proxy listens on `127.0.0.1` and accepts local app origins by default. If
you run Frazodrom from a deployed site, add that exact origin to
`PROXY_ALLOWED_ORIGINS` in `proxy/.env`; do not expose the proxy host to the
network unless you understand the security tradeoff.

Important: `Judge` is intentionally empty by default until the real live-model
benchmark from the plan is completed. Saving a key is not enough by itself —
to enable AI checking in drills, add a model to the `Judge` route in Settings.

Non-commercial project. Sentences from the [Tatoeba](https://tatoeba.org) corpus (CC-BY 2.0 FR). Code — MIT.
