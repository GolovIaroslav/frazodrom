import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { MAX_TUTOR_CHAT_TURNS, sendTutorChatMessage } from './tutorChat';
import { resolveChain } from './registry';
import type { LLMProvider, Msg } from './types';
import { setRoutingConfig } from './settings';

vi.mock('./registry', () => ({
  resolveChain: vi.fn(),
}));

beforeEach(async () => {
  await db.kv.clear();
  await db.providerBudget.clear();
  await setRoutingConfig({ judge: [], tutor: ['fake:tutor'], generator: [] });
});

function fakeProvider(id: string, chatImpl: LLMProvider['chat']): LLMProvider {
  return { id, label: id, isConfigured: () => true, chat: chatImpl };
}

const ctx = {
  level: 'A1',
  pattern: 'be + noun',
  ru: 'Он студент.',
  userAnswer: 'He are student.',
  ref: 'He is a student.',
  tags: ['agreement'],
};

describe('sendTutorChatMessage — §8.5 max 6 turns, then a soft limit reply, no persistence', () => {
  it('calls the provider normally under the turn limit', async () => {
    const chat = vi.fn().mockResolvedValue('¿Какая часть речи стоит после he?');
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:tutor', chat)]);

    const result = await sendTutorChatMessage(ctx, [], 'Почему тут ошибка?', 'Давай вернёмся к дриллу.');
    expect(result?.limitReached).toBe(false);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('returns the soft-limit reply without calling the provider once MAX_TUTOR_CHAT_TURNS is reached', async () => {
    const chat = vi.fn().mockResolvedValue('should not be called');
    vi.mocked(resolveChain).mockResolvedValue([fakeProvider('fake:tutor', chat)]);

    const history: Msg[] = [];
    for (let i = 0; i < MAX_TUTOR_CHAT_TURNS; i += 1) {
      history.push({ role: 'user', content: `q${i}` });
      history.push({ role: 'assistant', content: `a${i}` });
    }

    const result = await sendTutorChatMessage(ctx, history, 'one more question', 'Давай вернёмся к дриллу.');
    expect(result).toEqual({ reply: 'Давай вернёмся к дриллу.', limitReached: true });
    expect(chat).not.toHaveBeenCalled();
  });
});
