import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import type { SkillPack } from '../engine/types';
import { useI18nStore } from '../i18n/store';
import { DrillScreen } from './DrillScreen';

const loadPackMock = vi.fn();
const runJudgeTier3Mock = vi.fn();

vi.mock('../engine/packs', () => ({
  loadPack: (...args: unknown[]) => loadPackMock(...args),
}));

vi.mock('../llm/judge', () => ({
  runJudgeTier3: (...args: unknown[]) => runJudgeTier3Mock(...args),
}));

vi.mock('../db/storage', () => ({
  ensureStoragePersisted: vi.fn().mockResolvedValue(undefined),
  checkStorageQuota: vi.fn().mockResolvedValue({ likelyPrivateMode: false }),
}));

vi.mock('../components/TutorPanel', () => ({
  TutorPanel: () => null,
}));

vi.mock('../components/TutorChat', () => ({
  TutorChat: () => null,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ skillId: 's1' }),
    Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  };
});

const pack: SkillPack = {
  schema_version: 1,
  skill: {
    id: 's1',
    cefr: 'A1',
    module: 'm1',
    module_title_ru: 'Модуль',
    title_ru: 'Навык',
    pattern: 'I am + noun',
    theory_ru: 'Теория',
    common_errors: [],
    probe_item_ids: [],
    youglish_query: 'i am',
  },
  items: [
    {
      id: 'i1',
      ru: 'Я студент.',
      en_main: 'I am a student.',
      en_accepted: [],
      sub: 'affirm',
      difficulty: 1,
      cefr_lex: 'A1',
      source: 'test',
      attribution: 'test',
    },
  ],
};

async function renderDrill(): Promise<HTMLInputElement> {
  render(<DrillScreen />);
  await screen.findByText('Я студент.');
  return screen.getByRole('textbox') as HTMLInputElement;
}

describe('DrillScreen attempt persistence', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.delete();
    await db.open();
    window.localStorage.clear();
    useI18nStore.getState().setLocale('ru');
    loadPackMock.mockResolvedValue(pack);
    runJudgeTier3Mock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('records a local correct first-try answer', async () => {
    const input = await renderDrill();

    fireEvent.change(input, { target: { value: 'I am a student.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));

    await waitFor(async () => {
      expect(await db.attempts.count()).toBe(1);
    });

    const attempts = await db.attempts.toArray();
    expect(attempts).toEqual([
      expect.objectContaining({
        itemId: 'i1',
        userInput: 'I am a student.',
        verdict: 'correct',
        verdictSource: 'local',
      }),
    ]);
    expect(runJudgeTier3Mock).not.toHaveBeenCalled();
  });

  it('records a local wrong attempt when the learner gives up immediately', async () => {
    await renderDrill();

    fireEvent.click(screen.getByRole('button', { name: 'Сдаться' }));

    await waitFor(async () => {
      expect(await db.attempts.count()).toBe(1);
    });

    const attempts = await db.attempts.toArray();
    expect(attempts).toEqual([
      expect.objectContaining({
        itemId: 'i1',
        userInput: '',
        verdict: 'wrong',
        verdictSource: 'local',
      }),
    ]);
  });

  it('does not persist a tentative local wrong when self-check overturns it', async () => {
    const input = await renderDrill();

    fireEvent.change(input, { target: { value: 'Totally wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));

    await screen.findByRole('button', { name: 'Я был прав' });
    fireEvent.click(screen.getByRole('button', { name: 'Я был прав' }));

    await waitFor(async () => {
      expect(await db.attempts.count()).toBe(1);
    });

    const attempts = await db.attempts.toArray();
    expect(attempts).toEqual([
      expect.objectContaining({
        itemId: 'i1',
        userInput: 'Totally wrong',
        verdict: 'correct',
        verdictSource: 'self',
      }),
    ]);
  });

  it('flushes a pending local wrong before a later local correction', async () => {
    const input = await renderDrill();

    fireEvent.change(input, { target: { value: 'Totally wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));

    await screen.findByRole('button', { name: 'Я был прав' });

    fireEvent.change(input, { target: { value: 'I am a student.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));

    await waitFor(async () => {
      expect(await db.attempts.count()).toBe(2);
    });

    const attempts = await db.attempts.toArray();
    expect(attempts[0]).toMatchObject({
      itemId: 'i1',
      userInput: 'Totally wrong',
      verdict: 'wrong',
      verdictSource: 'local',
    });
    expect(attempts[1]).toMatchObject({
      itemId: 'i1',
      userInput: 'I am a student.',
      verdict: 'correct',
      verdictSource: 'local',
    });
    expect(screen.queryByRole('button', { name: 'Я был прав' })).not.toBeInTheDocument();
  });
});
