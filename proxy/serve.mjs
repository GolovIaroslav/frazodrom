#!/usr/bin/env node
// PLAN.md §5.1/§8.2 — optional, single-file, dependency-free CORS proxy.
//
// Usage: `node proxy/serve.mjs` → listens on http://localhost:8787.
// Not required to use the app: Gemini alone (called directly from the
// browser) covers every role. Run this only if you also want to use
// Groq / OpenRouter / GigaChat / Yandex AI Studio from the browser and their
// APIs don't tolerate direct CORS requests from your origin (§8.2).
//
// Config: copy `proxy/.env.example` to `proxy/.env` (or export the same
// variables in your shell) with your own keys:
//   GROQ_API_KEY=...
//   OPENROUTER_API_KEY=...
//   GIGACHAT_AUTH_KEY=...          (Sber's pre-base64'd "Authorization key")
//   YANDEX_API_KEY=...
//   PROXY_PORT=8787                (optional, defaults to 8787)
//
// In the app's Settings → Models, set "Proxy URL" to http://localhost:8787
// and the Groq/OpenRouter/GigaChat/Yandex adapters will route through it.
//
// The proxy only forwards these paths, injecting the matching key from its
// own environment (never trusts a key sent by the browser):
//   /groq/*           -> https://api.groq.com/openai/*            (Bearer)
//   /openrouter/*     -> https://openrouter.ai/api/*               (Bearer)
//   /gigachat-oauth   -> https://ngw.devices.sberbank.ru:9443/api/v2/oauth (Basic)
//   /gigachat/*       -> https://gigachat.devices.sberbank.ru/api/*        (Bearer, token passed through)
//   /yandex/*         -> https://llm.api.cloud.yandex.net/*        (Api-Key, x-folder-id passed through)
//
// GigaChat TLS note: Sber's endpoints chain to a Minsvyaz root CA that Node's
// default trust store does not recognize (§8.2 "⚠️VERIFY... TLS-сертификат").
// If you hit a self-signed-certificate error, either install Minsvyaz's
// "russian_trusted_root_ca" into your OS/Node trust store, or (development
// only, insecure) start the proxy with
// `NODE_TLS_REJECT_UNAUTHORIZED=0 node proxy/serve.mjs`. This is a genuine
// blocker without a live GigaChat account to verify against — see BLOCKERS.md.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const PORT = Number(process.env.PROXY_PORT) || 8787;

const ROUTES = [
  {
    prefix: '/groq/',
    target: (path) => `https://api.groq.com/openai/${path}`,
    authHeader: () => (process.env.GROQ_API_KEY ? `Bearer ${process.env.GROQ_API_KEY}` : undefined),
  },
  {
    prefix: '/openrouter/',
    target: (path) => `https://openrouter.ai/api/${path}`,
    authHeader: () => (process.env.OPENROUTER_API_KEY ? `Bearer ${process.env.OPENROUTER_API_KEY}` : undefined),
  },
  {
    prefix: '/gigachat-oauth',
    target: () => 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
    authHeader: () => (process.env.GIGACHAT_AUTH_KEY ? `Basic ${process.env.GIGACHAT_AUTH_KEY}` : undefined),
  },
  {
    prefix: '/gigachat/',
    target: (path) => `https://gigachat.devices.sberbank.ru/api/${path}`,
    // Access token was obtained by the client via /gigachat-oauth — pass its
    // own Authorization header through unchanged.
    authHeader: undefined,
  },
  {
    prefix: '/yandex/',
    target: (path) => `https://llm.api.cloud.yandex.net/${path}`,
    // Api-Key + x-folder-id are the user's own Yandex credentials — pass through.
    authHeader: undefined,
  },
];

function matchRoute(url) {
  for (const route of ROUTES) {
    if (url === route.prefix || url.startsWith(route.prefix)) {
      const rest = url.startsWith(route.prefix) ? url.slice(route.prefix.length) : '';
      return { route, rest };
    }
  }
  return undefined;
}

const server = createServer(async (req, res) => {
  // Minimal CORS: the browser app calls this from its own origin during dev/local use.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, RqUID, x-folder-id');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const match = matchRoute(req.url ?? '');
  if (!match) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unknown proxy route' }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const targetUrl = match.route.target(match.rest);
  const headers = { 'Content-Type': req.headers['content-type'] ?? 'application/json' };
  const injectedAuth = match.route.authHeader?.();
  if (injectedAuth) headers.Authorization = injectedAuth;
  else if (req.headers.authorization) headers.Authorization = req.headers.authorization;
  if (req.headers.rquid) headers.RqUID = req.headers.rquid;
  if (req.headers['x-folder-id']) headers['x-folder-id'] = req.headers['x-folder-id'];
  if (req.headers.accept) headers.Accept = req.headers.accept;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' });
    res.end(text);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy upstream request failed', detail: String(err) }));
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Frazodrom CORS proxy listening on http://localhost:${PORT}`);
});
