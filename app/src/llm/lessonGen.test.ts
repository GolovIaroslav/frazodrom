import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { LessonGenResultSchema, runErrorHuntGeneration } from './lessonGen';
import { resolveChain } from './registry';
import type { LLMProvider } from './types';
import { setRoutingConfig } from './settings';

vi.mock('./registry', () => ({
  resolveChain: vi.fn(),
}));

beforeEach(async () => {
  await db.kv.clear();
  await db.providerBudget.clear();
  await setRoutingConfig({ judge: [], tutor: [], generator: ['fake:generator'] });
});

function fakeProvider(id: string, chatImpl: LLMProvider['chat']): LLMProvider {
  return { id, label: id, isConfigured: () => true, chat: chatImpl };
}

const validLesson = JSON.stringify({
  title_ru: 'Охота на ошибки',
  theory_ru: 'Пять предложений по твоим слабым местам.',
  items: [
    { ru: 'Он играет в футбол.', en_main: 'He plays football.', en_accepted: [], sub: 'affirm' },
    { ru: 'Она не работает.', en_main: 'She does not work.', en_accepted: [], sub: 'neg' },
  ],
});

describe('LessonGenResultSchema', () => {
  it('accepts a well-formed lesson', () => {
    expect(LessonGenResultSchema.safeParse(JSON.parse(validLesson)).success).toBe(true);
  });

  it('rejects an unknown sub value', () => {
    const bad = JSON.parse(validLesson);
    bad.items[0].sub = 'imperative';
    expect(LessonGenResultSchema.safeParse(bad).success).toBe(false);
  });
});

describe('runErrorHuntGeneration (§10.4 — 5 personalized WEAK_TAGS sentences)', () => {
  it('returns parsed items from the first configured generator provider', async () => {
    const chat = vi.fn().mockResolvedValue(validLesson);
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:generator', chat)]);

    const result = await runErrorHuntGeneration({
      topic: 'error hunt',
      level: 'A1',
      weakTags: ['aux_missing', 'agreement'],
    });

    expect(result?.items.length).toBe(2);
    expect(chat).toHaveBeenCalledTimes(1);
    const req = chat.mock.calls[0]?.[0];
    expect(req.messages[0].content).toContain('aux_missing');
  });

  it('returns undefined when no provider is configured (no live key — falls back to skill-only error-hunt)', async () => {
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:generator', () => Promise.resolve('{}'))]);
    await setRoutingConfig({ judge: [], tutor: [], generator: [] });
    vi.mocked(resolveChain).mockResolvedValue([]);

    const result = await runErrorHuntGeneration({ topic: 'x', level: 'A1', weakTags: [] });
    expect(result).toBeUndefined();
  });

  it('returns undefined when the provider replies with invalid JSON', async () => {
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:generator', () => Promise.resolve('not json'))]);
    const result = await runErrorHuntGeneration({ topic: 'x', level: 'A1', weakTags: [] });
    expect(result).toBeUndefined();
  });
});
