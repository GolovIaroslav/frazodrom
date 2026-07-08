import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { runTutorAction, type TutorActionInput } from './tutorActions';
import { resolveChain } from './registry';
import type { LLMProvider } from './types';
import { setPromptOverride, setRoutingConfig } from './settings';

// registry.resolveProviderById only knows Gemini aliases and local-openai
// profiles by id — mocking resolveChain directly is the simplest way to hand
// runTutorAction a chat-mocked fake provider for a made-up routing id.
vi.mock('./registry', () => ({
  resolveChain: vi.fn(),
}));

beforeEach(async () => {
  await db.kv.clear();
  await db.providerBudget.clear();
  await db.tutorActionCache.clear();
  await setRoutingConfig({ judge: [], tutor: ['fake:tutor'], generator: [] });
});

function fakeProvider(id: string, chatImpl: LLMProvider['chat']): LLMProvider {
  return { id, label: id, isConfigured: () => true, chat: chatImpl };
}

const baseInput: TutorActionInput = {
  itemId: 's1',
  ru: 'Он студент.',
  userAnswer: 'He are student.',
  refs: ['He is a student.'],
  verdict: 'wrong',
  tags: ['agreement'],
  pattern: 'be + noun',
  level: 'A1',
};

describe('runTutorAction — «Варианты»/«Нюансы» cache per item, no answer dependency (§8.5)', () => {
  it('a second identical-item «Варианты» click does not call the provider again', async () => {
    const chat = vi.fn().mockResolvedValue('3-5 translations here');
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:tutor', chat)]);

    const first = await runTutorAction('variants', baseInput);
    expect(first?.cached).toBe(false);
    expect(chat).toHaveBeenCalledTimes(1);

    const second = await runTutorAction('variants', baseInput);
    expect(second?.cached).toBe(true);
    expect(second?.text).toBe('3-5 translations here');
    expect(chat).toHaveBeenCalledTimes(1); // still 1 — no second LLM call
  });

  it('does not key «Варианты» on the learner answer — a different wrong answer still hits cache', async () => {
    const chat = vi.fn().mockResolvedValue('cached variants');
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:tutor', chat)]);

    await runTutorAction('variants', baseInput);
    const differentAnswer = { ...baseInput, userAnswer: 'A totally different wrong answer' };
    const result = await runTutorAction('variants', differentAnswer);

    expect(result?.cached).toBe(true);
    expect(chat).toHaveBeenCalledTimes(1);
  });
});

describe('runTutorAction — «Ошибки»/«Разбор» cache per (item + answer) (§8.5)', () => {
  it('a different wrong answer on the same item is NOT a cache hit', async () => {
    const chat = vi.fn().mockResolvedValue('errors reply');
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:tutor', chat)]);

    await runTutorAction('errors', baseInput);
    const differentAnswer = { ...baseInput, userAnswer: 'A completely different mistake' };
    const result = await runTutorAction('errors', differentAnswer);

    expect(result?.cached).toBe(false);
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('the exact same answer (modulo trivial normalization) IS a cache hit', async () => {
    const chat = vi.fn().mockResolvedValue('errors reply');
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:tutor', chat)]);

    await runTutorAction('errors', baseInput);
    const sameAnswerDifferentCase = { ...baseInput, userAnswer: '  He Are Student.  ' };
    const result = await runTutorAction('errors', sameAnswerDifferentCase);

    expect(result?.cached).toBe(true);
    expect(chat).toHaveBeenCalledTimes(1);
  });
});

describe('runTutorAction — prompt edit invalidates the action cache (§8.5)', () => {
  it('editing the active ACTION_VARIANTS prompt causes a fresh LLM call instead of the old cached reply', async () => {
    const chat = vi.fn().mockResolvedValueOnce('old-prompt reply').mockResolvedValueOnce('new-prompt reply');
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:tutor', chat)]);

    const first = await runTutorAction('variants', baseInput);
    expect(first?.text).toBe('old-prompt reply');
    expect(chat).toHaveBeenCalledTimes(1);

    await setPromptOverride('ACTION_VARIANTS', 'A brand new custom prompt for variants.');

    const second = await runTutorAction('variants', baseInput);
    expect(second?.cached).toBe(false);
    expect(second?.text).toBe('new-prompt reply');
    expect(chat).toHaveBeenCalledTimes(2);
  });
});
