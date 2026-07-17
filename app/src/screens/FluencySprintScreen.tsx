// PLAN.md §6.3 — fluency sprint (Nation's 4/3/2): the SAME ~10-item set,
// already-mastered material (accuracy >90%, gated before launch), replayed
// across 3 rounds with shrinking time limits. Errors do not penalize FSRS — no
// hint ladder, no REWRITE, no judge escalation, no requeue: this is tempo
// practice on material the learner already knows, not a correctness test.
// A round ends either when its items run out or its timer hits zero,
// whichever comes first; the reference DrillEngine state machine (built for
// REWRITE/escalation) doesn't fit this shape, so this screen manages its own
// small local state instead of reusing it — see the Phase 4 report.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18nStore } from '../i18n/store';
import { checkAnswer } from '../checker/cascade';
import { buildFluencySprint, type FluencySprintRound } from '../engine/fluencySprint';
import { peekPendingSession, clearPendingSession } from '../engine/sessionLaunch';
import { startSession, finishSession, type ItemOutcome } from '../srs/sessionBookkeeping';
import { db } from '../db/db';

type Phase = 'loading' | 'error' | 'running' | 'finished';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function FluencySprintScreen(): React.ReactElement {
  const t = useI18nStore((s) => s.t);

  const [phase, setPhase] = useState<Phase>('loading');
  const [rounds, setRounds] = useState<FluencySprintRound[] | null>(null);
  const [skillId, setSkillId] = useState<string>('');
  const [roundIdx, setRoundIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState<'correct' | 'wrong' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [finalStats, setFinalStats] = useState({ correct: 0, total: 0 });

  const sessionIdRef = useRef<number | null>(null);
  const outcomesRef = useRef<ItemOutcome[]>([]);
  const bookkeptRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      // Non-destructive peek, cleared only once this invocation is known to
      // have won — React StrictMode's dev-mode double-invoke (mount →
      // cleanup → mount) runs this effect twice per real navigation; if the
      // first (soon-to-be-cancelled) invocation cleared the slot before its
      // `await` had a chance to let `cancelled` flip, the second (surviving)
      // invocation would peek an already-empty slot and show a false "no
      // active session" error. Same fix as DrillScreen's `sessionLaunch`
      // handling — clear after the await, guarded by `cancelled`.
      const request = peekPendingSession();
      if (!request || request.type !== 'fluencySprint' || request.skillIds.length !== 1) {
        setPhase('error');
        return;
      }
      const built = buildFluencySprint(request.items);
      const id = await startSession('fluencySprint', request.skillIds);
      if (cancelled) return;
      clearPendingSession();
      setRounds(built);
      setSkillId(request.skillIds[0] as string);
      setSecondsLeft((built[0]?.limitMinutes ?? 4) * 60);
      sessionIdRef.current = id;
      setPhase('running');
    }
    void run().catch(() => {
      if (!cancelled) setPhase('error');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [phase, roundIdx, itemIdx]);

  const finishSprint = useCallback(() => {
    if (bookkeptRef.current || sessionIdRef.current === null) return;
    bookkeptRef.current = true;
    const outcomes = outcomesRef.current;
    void finishSession(sessionIdRef.current, outcomes);
    setFinalStats({ total: outcomes.length, correct: outcomes.filter((o) => o.correct).length });
    setPhase('finished');
  }, []);

  const goToNextRound = useCallback(() => {
    const nextRoundIdx = roundIdx + 1;
    if (!rounds || nextRoundIdx >= rounds.length) {
      finishSprint();
      return;
    }
    setRoundIdx(nextRoundIdx);
    setItemIdx(0);
    setInput('');
    setVerdict(null);
    setSecondsLeft((rounds[nextRoundIdx]?.limitMinutes ?? 0) * 60);
  }, [rounds, roundIdx, finishSprint]);

  // Countdown — ticks once per second while a round is running. Tracks the
  // remaining time in a plain closure variable (not React state) so the
  // "hit zero → advance round" decision is made from inside the interval's
  // own callback rather than a second effect reacting to state — the state
  // setters here run inside an async timer callback, not synchronously
  // during the effect body, so there's nothing for React to re-derive on
  // every render and no cascading-render/double-invoke risk under StrictMode.
  useEffect(() => {
    const currentRound = rounds?.[roundIdx];
    if (phase !== 'running' || !currentRound) return;
    let remaining = currentRound.limitMinutes * 60;
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        setSecondsLeft(0);
        goToNextRound();
      } else {
        setSecondsLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, roundIdx, rounds, goToNextRound]);

  const round = rounds?.[roundIdx];
  const item = round?.items[itemIdx];

  const handleCheck = useCallback(() => {
    if (!round || !item) return;

    if (verdict !== null) {
      // Second Enter (or click) after feedback — move to the next item.
      const nextItemIdx = itemIdx + 1;
      setInput('');
      setVerdict(null);
      if (nextItemIdx >= round.items.length) {
        goToNextRound();
      } else {
        setItemIdx(nextItemIdx);
      }
      return;
    }

    const result = checkAnswer({
      userInput: input,
      ruStimulus: item.ru,
      enMain: item.en_main,
      enAccepted: item.en_accepted,
    });
    const correct = result.verdict === 'correct';
    outcomesRef.current.push({ itemId: item.id, skillId, correct });
    void db.attempts.add({
      itemId: item.id,
      ts: Date.now(),
      userInput: input,
      verdict: correct ? 'correct' : 'wrong',
      verdictSource: 'local',
      sessionId: sessionIdRef.current ?? undefined,
    });
    setVerdict(correct ? 'correct' : 'wrong');
  }, [round, item, verdict, input, itemIdx, skillId, goToNextRound]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCheck();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCheck]);

  if (phase === 'loading') {
    return (
      <div className="p-6">
        <p className="text-neutral-600 dark:text-neutral-400">{t('drill.loading')}</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="p-6">
        <p className="text-red-600 dark:text-red-400">{t('session.noPendingSession')}</p>
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          {t('sprint.finishedTitle')}
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          {t('sprint.finishedBody')
            .replace('{CORRECT}', String(finalStats.correct))
            .replace('{TOTAL}', String(finalStats.total))}
        </p>
        <Link
          to="/course-map"
          className="mt-4 inline-block rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {t('drill.backToMap')}
        </Link>
      </div>
    );
  }

  if (!round || !item) return <div className="p-6" />;

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
        <span>{t('sprint.roundLabel').replace('{ROUND}', String(roundIdx + 1)).replace('{TOTAL}', String(rounds?.length ?? 3))}</span>
        <span className="font-mono text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {formatTime(secondsLeft)}
        </span>
      </div>

      <h1 className="mt-2 text-xl font-medium text-neutral-900 dark:text-neutral-100">{item.ru}</h1>

      <label htmlFor="sprint-input" className="sr-only">
        {t('drill.inputLabel')}
      </label>
      <input
        id="sprint-input"
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t('drill.inputPlaceholder')}
        autoFocus
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        className="mt-3 w-full rounded border border-neutral-300 p-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus-visible:outline-neutral-100"
      />

      <button
        type="button"
        onClick={handleCheck}
        className="mt-3 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {verdict !== null ? t('drill.next') : t('drill.check')}
      </button>

      {verdict !== null && (
        <p
          className={
            verdict === 'wrong'
              ? 'mt-3 font-medium text-red-700 dark:text-red-400'
              : 'mt-3 font-medium text-green-700 dark:text-green-400'
          }
        >
          {verdict === 'wrong' ? '✗' : '✓'} {t(`drill.verdict.${verdict}`)}
          {verdict === 'wrong' && (
            <span className="ml-2 font-normal text-neutral-600 dark:text-neutral-400">
              {item.en_main}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
