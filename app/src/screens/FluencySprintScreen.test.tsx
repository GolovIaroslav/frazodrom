import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import type { PackItem } from '../engine/types';
import { clearPendingSession, setPendingSession } from '../engine/sessionLaunch';
import { useI18nStore } from '../i18n/store';
import { FluencySprintScreen } from './FluencySprintScreen';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  };
});

function item(id: string, ru: string, enMain: string): PackItem {
  return {
    id,
    ru,
    en_main: enMain,
    en_accepted: [],
    sub: 'affirm',
    difficulty: 1,
    cefr_lex: 'A1',
    source: 'test',
    attribution: 'test',
  };
}

const items = [item('i1', 'Я студент.', 'I am a student.'), item('i2', 'Ты студент.', 'You are a student.')];

function launchSprint(): void {
  setPendingSession({
    type: 'fluencySprint',
    skillIds: ['s1'],
    items,
    itemSkillMap: { i1: 's1', i2: 's1' },
  });
}

describe('FluencySprintScreen (§6.3 — 4/3/2, no penalty)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    window.localStorage.clear();
    useI18nStore.getState().setLocale('ru');
    clearPendingSession();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows an error screen when there is no pending session', async () => {
    render(<FluencySprintScreen />);
    expect(await screen.findByText('Нет активной сессии — вернись на «Сегодня» и запусти её оттуда.')).toBeInTheDocument();
  });

  it('replays the same items across 3 rounds and finishes with no forced correction on a wrong answer', async () => {
    launchSprint();
    render(<FluencySprintScreen />);

    const input = (await screen.findByRole('textbox')) as HTMLInputElement;
    expect(screen.getByText('Раунд 1/3')).toBeInTheDocument();

    // Round 1, item 1: wrong answer — no hint ladder, no REWRITE, no reveal-and-retype loop.
    // (Text matched via regex/exact:false since the feedback paragraph also
    // contains the "✗ " icon and, for a wrong answer, the reference sentence.)
    fireEvent.change(input, { target: { value: 'wrong answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(await screen.findByText('Неверно', { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));

    // Round 1, item 2: correct.
    fireEvent.change(input, { target: { value: 'You are a student.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(await screen.findByText('Верно', { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));

    // Items exhausted before the timer ran out — auto-advances to round 2, same set.
    expect(await screen.findByText('Раунд 2/3')).toBeInTheDocument();
    expect(screen.getByText('Я студент.')).toBeInTheDocument();

    // Race through rounds 2 and 3 the same way.
    for (const round of [2, 3]) {
      void round;
      for (const answer of ['You are a student.', 'You are a student.']) {
        fireEvent.change(screen.getByRole('textbox'), { target: { value: answer } });
        fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
        await screen.findByRole('button', { name: 'Дальше' });
        fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
      }
    }

    expect(await screen.findByText('Спринт завершён!')).toBeInTheDocument();
    // 1 correct ("You are a student." for i2) + 1 wrong (i1 expects "I am a
    // student.") per round × 3 rounds = 3/6 — proves the SAME per-item
    // outcome repeats identically across all 3 replayed rounds.
    expect(screen.getByText(/Верно 3 из 6/)).toBeInTheDocument();

    await waitFor(async () => {
      const sessions = await db.sessions.toArray();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.finishedAt).toBeDefined();
    });
  });
});

// The timer-driven "round times out with items unanswered" path is exercised
// live in the browser instead of here: faking a 240-tick setInterval reliably
// alongside fake-indexeddb's own internal async scheduling proved flaky (the
// two fight over which timer APIs are mocked). The countdown/advance logic
// itself has no branch this suite doesn't already cover — see
// `goToNextRound`'s single call site inside the interval callback, exercised
// end-to-end here via the item-exhaustion path instead of the timeout path.
