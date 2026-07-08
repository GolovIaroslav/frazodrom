import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { smokeTestJudgePrompt } from './promptSmokeTest';
import { resolveChain } from './registry';
import type { LLMProvider } from './types';
import { setRoutingConfig } from './settings';

vi.mock('./registry', () => ({
  resolveChain: vi.fn(),
}));

beforeEach(async () => {
  await db.kv.clear();
  await db.providerBudget.clear();
  await setRoutingConfig({ judge: ['fake:judge'], tutor: [], generator: [] });
});

function fakeProvider(id: string, chatImpl: LLMProvider['chat']): LLMProvider {
  return { id, label: id, isConfigured: () => true, chat: chatImpl };
}

const validVerdictJson = JSON.stringify({
  verdict: 'correct',
  error_tags: [],
  explanation_ru: 'Всё верно.',
  corrected: 'I see a cat.',
  natural: 'I see a cat.',
  add_to_accepted: true,
});

describe('smokeTestJudgePrompt — a broken custom JUDGE_SYSTEM must be caught, not silently swallowed (§8.5)', () => {
  it('reports "invalid" when the candidate prompt makes the model reply with non-JSON', async () => {
    const chat = vi.fn().mockResolvedValue('Sure! Here is my grading: looks good.');
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:judge', chat)]);

    const result = await smokeTestJudgePrompt('You are a judge. Just chat with the user.');
    expect(result.outcome).toBe('invalid');
    expect(result.error).toBeTruthy();
  });

  it('reports "invalid" when the reply is valid JSON but fails the JudgeVerdictSchema', async () => {
    const chat = vi.fn().mockResolvedValue(JSON.stringify({ verdict: 'super-correct', notes: 'nope' }));
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:judge', chat)]);

    const result = await smokeTestJudgePrompt('You are a judge prompt missing the schema instructions.');
    expect(result.outcome).toBe('invalid');
  });

  it('reports "ok" when the candidate prompt produces a schema-valid verdict', async () => {
    const chat = vi.fn().mockResolvedValue(validVerdictJson);
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:judge', chat)]);

    const result = await smokeTestJudgePrompt('A perfectly normal JUDGE_SYSTEM prompt.');
    expect(result.outcome).toBe('ok');
  });

  it('reports "no-provider" when no judge-role provider is configured in this environment', async () => {
    await setRoutingConfig({ judge: [], tutor: [], generator: [] });
    vi.mocked(resolveChain).mockResolvedValue([]);

    const result = await smokeTestJudgePrompt('Any prompt text.');
    expect(result.outcome).toBe('no-provider');
  });
});
