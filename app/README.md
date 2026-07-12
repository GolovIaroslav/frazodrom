# App package

This folder contains the browser app for Frazodrom: drills, review sessions,
Free Talk, local persistence, and the BYOK AI layer.

## Development

- `npm run dev` starts the local app
- `npm run build` builds the production bundle
- `npm run lint` runs ESLint
- `npm run test` runs the Vitest suite

## AI model setup

The app separates AI into three roles:

- `Judge` checks ambiguous drill answers
- `Tutor` powers help actions, explanations, and chat
- `Generator` powers generated content and personalized exercises

Each role uses its own routing chain. The app tries the first configured model
in the chain, then falls back to the next one if the current provider is
unavailable or out of budget.

Supported provider types in the app today:

- Gemini
- Groq
- OpenRouter
- GigaChat
- Yandex AI Studio
- local OpenAI-compatible endpoints such as Ollama, LM Studio, or llama.cpp

If a local OpenAI-compatible server works from the terminal but fails from the
browser, it is usually missing CORS headers. In that case, run
`proxy/serve.mjs`, set `Proxy URL` to `http://localhost:8787`, and let the app
route the browser request through that proxy.

The proxy binds to `127.0.0.1` and allows local app origins by default. For a
deployed app, add its exact origin to `PROXY_ALLOWED_ORIGINS` in `proxy/.env`.
The `/local` route intentionally accepts only loopback and private IPv4 model
servers.

## Important note about Judge

`Judge` is intentionally empty by default. This matches the project plan:
until a real benchmark is run against live user-owned keys, no model should
quietly become the default drill judge.

If you want AI checking in drills, open Settings and add at least one model to
the `Judge` chain yourself.
