// PLAN.md §8.8 AC: "при 429 — автопереключение с тостом". The chain-walking
// loops (judge.ts/tutorActions.ts/tutorChat.ts/freeTalk.ts) already fall
// through to the next provider on LLMRateLimitError; this file proves (a)
// the event bus itself works, and (b) a mocked 429 from the first candidate
// in runJudgeTier3's chain fires a switch event AND still returns a verdict
// from the second candidate — i.e. the toast is observable, not just the
// silent fallback.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { onProviderSwitch, emitProviderSwitch, type SwitchEvent } from './switchNotifier';
import type { LLMProvider } from './types';
import { LLMRateLimitError } from './types';

describe('switchNotifier', () => {
  it('notifies subscribers and supports unsubscribing', () => {
    const received: SwitchEvent[] = [];
    const unsubscribe = onProviderSwitch((e) => received.push(e));

    emitProviderSwitch({ role: 'judge', fromProviderId: 'a', fromLabel: 'A', reason: 'rateLimit' });
    expect(received).toHaveLength(1);

    unsubscribe();
    emitProviderSwitch({ role: 'judge', fromProviderId: 'a', fromLabel: 'A', reason: 'rateLimit' });
    expect(received).toHaveLength(1); // no more events after unsubscribe
  });
});

vi.mock('./registry', () => ({
  resolveChain: vi.fn(),
}));

describe('runJudgeTier3 — auto-switch on 429 (§8.8)', () => {
  beforeEach(async () => {
    await db.kv.clear();
    await db.providerBudget.clear();
    vi.clearAllMocks();
  });

  it('emits a switch event naming the next provider when the first candidate 429s, then succeeds via the second', async () => {
    const { resolveChain } = await import('./registry');
    const { runJudgeTier3 } = await import('./judge');
    const { setRoutingConfig } = await import('./settings');

    const validVerdictJson = JSON.stringify({
      verdict: 'correct',
      error_tags: [],
      explanation_ru: 'Всё верно.',
      corrected: 'I see a cat.',
      natural: 'I see a cat.',
      add_to_accepted: true,
    });

    const limited: LLMProvider = {
      id: 'groq:llama-8b',
      label: 'Groq llama-8b',
      isConfigured: () => true,
      chat: vi.fn().mockRejectedValue(new LLMRateLimitError()),
    };
    const fallback: LLMProvider = {
      id: 'gemini:flash',
      label: 'Gemini flash',
      isConfigured: () => true,
      chat: vi.fn().mockResolvedValue(validVerdictJson),
    };

    vi.mocked(resolveChain).mockResolvedValue([limited, fallback]);
    await setRoutingConfig({ judge: ['groq:llama-8b', 'gemini:flash'], tutor: [], generator: [] });

    const events: SwitchEvent[] = [];
    const unsubscribe = onProviderSwitch((e) => events.push(e));

    const result = await runJudgeTier3({
      ru: 'Я вижу кота.',
      userAnswer: 'I see a cat.',
      refs: ['I see a cat.'],
      pattern: 'present simple',
      level: 'A1',
      uiLang: 'ru',
    });

    unsubscribe();

    expect(result?.providerId).toBe('gemini:flash');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      fromProviderId: 'groq:llama-8b',
      toProviderId: 'gemini:flash',
      reason: 'rateLimit',
    });
  });
});
