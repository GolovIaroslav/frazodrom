// PLAN.md §9.2 — the 3 listening modes: dictation (hear EN -> type EN),
// comprehension (hear EN -> type RU meaning), dictogloss (hear EN once ->
// reconstruct from memory). All 3 share one screen: loading/bookkeeping
// boilerplate is identical, only the check/reveal logic differs per mode. No
// REWRITE, no judge escalation, no hint ladder — §9.2 is explicit that this
// is tier 1-2 / self-check only, LLM is never called here.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18nStore } from '../i18n/store';
import { checkAnswer } from '../checker/cascade';
import { wordDiff } from '../checker/wordDiff';
import { peekPendingSession, clearPendingSession, type SessionLaunchRequest } from '../engine/sessionLaunch';
import { startSession, finishSession, type ItemOutcome } from '../srs/sessionBookkeeping';
import { db } from '../db/db';
import { speak, stopSpeaking, prefetchKokoro } from '../tts/speak';
import { SPEECH_RATES, type SpeechRate } from '../tts/voices';

type Phase = 'loading' | 'error' | 'running' | 'finished';
type ListeningMode = NonNullable<SessionLaunchRequest['listeningMode']>;

const DICTATION_MAX_REPLAYS = 3;

/** RU comprehension check is a soft normalized-string hint, not the EN checker cascade (§9.2) — different language, no accepted-set. */
function normalizeRu(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"'«»()]/g, '')
    .replace(/\s+/g, ' ');
}

export function ListeningScreen(): React.ReactElement {
  const t = useI18nStore((s) => s.t);

  const [phase, setPhase] = useState<Phase>('loading');
  const [mode, setMode] = useState<ListeningMode>('dictation');
  const [items, setItems] = useState<SessionLaunchRequest['items']>([]);
  const [itemSkillMap, setItemSkillMap] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState<'correct' | 'wrong' | null>(null);
  const [awaitingSelfCheck, setAwaitingSelfCheck] = useState(false);
  const [replaysUsed, setReplaysUsed] = useState(0);
  const [rate, setRate] = useState<SpeechRate>(1.0);
  const [finalStats, setFinalStats] = useState({ correct: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const sessionIdRef = useRef<number | null>(null);
  const outcomesRef = useRef<ItemOutcome[]>([]);
  const bookkeptRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const request = peekPendingSession();
      if (!request || request.type !== 'listening' || !request.listeningMode || request.items.length === 0) {
        setPhase('error');
        return;
      }
      const id = await startSession('listening', request.skillIds);
      if (cancelled) return;
      clearPendingSession();
      setMode(request.listeningMode);
      setItems(request.items);
      setItemSkillMap(request.itemSkillMap);
      sessionIdRef.current = id;
      setPhase('running');
    }
    void run().catch(() => {
      if (!cancelled) setPhase('error');
    });
    return () => {
      cancelled = true;
      stopSpeaking();
    };
  }, []);

  const item = items[idx];

  // Auto-play on entering each item (all 3 modes are audio-first, §9.2).
  // Dictogloss plays exactly once — no replay affordance is rendered for it.
  useEffect(() => {
    if (phase !== 'running' || !item) return;
    void speak(item.en_main, {
      rateOverride: mode === 'dictogloss' ? 1.0 : rate,
      allowLocalFallback: false,
    }).catch(() => undefined);
    const next = items[idx + 1];
    if (next) prefetchKokoro(next.en_main);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the item itself changes
  }, [phase, item?.id]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [idx, phase, verdict, awaitingSelfCheck]);

  const finishListening = useCallback(() => {
    if (bookkeptRef.current || sessionIdRef.current === null) return;
    bookkeptRef.current = true;
    const outcomes = outcomesRef.current;
    void finishSession(sessionIdRef.current, outcomes);
    setFinalStats({ total: outcomes.length, correct: outcomes.filter((o) => o.correct).length });
    setPhase('finished');
  }, []);

  const recordOutcome = useCallback(
    (correct: boolean) => {
      if (!item) return;
      const skillId = itemSkillMap[item.id];
      if (skillId) outcomesRef.current.push({ itemId: item.id, skillId, correct });
      void db.attempts.add({
        itemId: item.id,
        ts: Date.now(),
        userInput: input,
        verdict: correct ? 'correct' : 'wrong',
        verdictSource: mode === 'comprehension' || awaitingSelfCheck ? 'self' : 'local',
        sessionId: sessionIdRef.current ?? undefined,
      });
    },
    [item, itemSkillMap, input, mode, awaitingSelfCheck],
  );

  const goToNext = useCallback(() => {
    const nextIdx = idx + 1;
    setInput('');
    setVerdict(null);
    setAwaitingSelfCheck(false);
    setReplaysUsed(0);
    if (nextIdx >= items.length) {
      finishListening();
    } else {
      setIdx(nextIdx);
    }
  }, [idx, items.length, finishListening]);

  const handleReplay = useCallback(() => {
    if (!item) return;
    if (mode === 'dictation' && replaysUsed >= DICTATION_MAX_REPLAYS) return;
    setReplaysUsed((n) => n + 1);
    void speak(item.en_main, { rateOverride: rate }).catch(() => undefined);
  }, [item, mode, replaysUsed, rate]);

  // Dictation: strict tier 0-2 check, diff shown, no self-check (deterministic).
  const handleDictationCheck = useCallback(() => {
    if (!item) return;
    if (verdict !== null) {
      goToNext();
      return;
    }
    const result = checkAnswer({ userInput: input, ruStimulus: item.ru, enMain: item.en_main, enAccepted: item.en_accepted });
    const correct = result.verdict === 'correct';
    setVerdict(correct ? 'correct' : 'wrong');
    recordOutcome(correct);
  }, [item, verdict, input, goToNext, recordOutcome]);

  // Dictogloss: same tier 0-2 check, but a miss falls through to self-check against the shown reference (§9.2 — no semantic metric exists).
  const handleDictoglossCheck = useCallback(() => {
    if (!item) return;
    if (verdict !== null || awaitingSelfCheck) return;
    const result = checkAnswer({ userInput: input, ruStimulus: item.ru, enMain: item.en_main, enAccepted: item.en_accepted });
    if (result.verdict === 'correct') {
      setVerdict('correct');
      recordOutcome(true);
    } else {
      setAwaitingSelfCheck(true);
    }
  }, [item, verdict, awaitingSelfCheck, input, recordOutcome]);

  // Comprehension: normalized RU compare is a soft hint only; the user's self-check always decides (§9.2).
  const handleComprehensionCheck = useCallback(() => {
    if (verdict !== null || awaitingSelfCheck) return;
    setAwaitingSelfCheck(true);
  }, [verdict, awaitingSelfCheck]);

  const handleSelfReport = useCallback(
    (wasRight: boolean) => {
      setAwaitingSelfCheck(false);
      setVerdict(wasRight ? 'correct' : 'wrong');
      recordOutcome(wasRight);
    },
    [recordOutcome],
  );

  const handlePrimaryAction = useCallback(() => {
    if (verdict !== null) {
      goToNext();
      return;
    }
    if (mode === 'dictation') handleDictationCheck();
    else if (mode === 'dictogloss') handleDictoglossCheck();
    else handleComprehensionCheck();
  }, [verdict, mode, goToNext, handleDictationCheck, handleDictoglossCheck, handleComprehensionCheck]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !awaitingSelfCheck) {
        e.preventDefault();
        handlePrimaryAction();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePrimaryAction, awaitingSelfCheck]);

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
          {t('listening.finishedTitle')}
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          {t('listening.finishedBody')
            .replace('{CORRECT}', String(finalStats.correct))
            .replace('{TOTAL}', String(finalStats.total))}
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {t('session.backToToday')}
        </Link>
      </div>
    );
  }

  if (!item) return <div className="p-6" />;

  const diff = mode !== 'comprehension' && verdict === 'wrong' && !awaitingSelfCheck ? wordDiff(input, item.en_main) : null;
  const ruNormalizedHint =
    mode === 'comprehension' && awaitingSelfCheck && normalizeRu(input) === normalizeRu(item.ru);

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
        <span>{t(`listening.mode.${mode}`)}</span>
        <span>{idx + 1} / {items.length}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleReplay}
          disabled={mode === 'dictogloss' || (mode === 'dictation' && replaysUsed >= DICTATION_MAX_REPLAYS)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100"
        >
          🔊 {t('listening.replay')}
          {mode === 'dictation' && ` (${DICTATION_MAX_REPLAYS - replaysUsed})`}
        </button>
        {mode === 'dictation' && (
          <div className="flex gap-1" role="radiogroup" aria-label={t('listening.speed')}>
            {SPEECH_RATES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={rate === r}
                onClick={() => setRate(r)}
                className={
                  rate === r
                    ? 'rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
                }
              >
                {r}×
              </button>
            ))}
          </div>
        )}
      </div>

      <label htmlFor="listening-input" className="sr-only">
        {mode === 'comprehension' ? t('listening.inputRuLabel') : t('listening.inputEnLabel')}
      </label>
      <input
        id="listening-input"
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={mode === 'comprehension' ? t('listening.inputRuPlaceholder') : t('listening.inputEnPlaceholder')}
        disabled={awaitingSelfCheck}
        autoFocus
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        className="mt-3 w-full rounded border border-neutral-300 p-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus-visible:outline-neutral-100"
      />

      {!awaitingSelfCheck && (
        <button
          type="button"
          onClick={handlePrimaryAction}
          className="mt-3 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {verdict !== null ? t('drill.next') : t('drill.check')}
        </button>
      )}

      {diff && (
        <p className="mt-3 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">{t('drill.yourAnswer')}: </span>
          {diff.map((tok, i) => (
            <span
              key={i}
              className={
                tok.mismatch
                  ? 'underline decoration-red-500 decoration-2 text-red-700 dark:text-red-400'
                  : 'text-neutral-800 dark:text-neutral-200'
              }
            >
              {tok.text}{' '}
            </span>
          ))}
        </p>
      )}

      {verdict && !awaitingSelfCheck && (
        <p
          className={
            verdict === 'wrong'
              ? 'mt-3 font-medium text-red-700 dark:text-red-400'
              : 'mt-3 font-medium text-green-700 dark:text-green-400'
          }
        >
          {verdict === 'wrong' ? '✗' : '✓'} {t(`drill.verdict.${verdict}`)}
          {verdict === 'wrong' && mode === 'dictogloss' && (
            <span className="ml-2 font-normal text-neutral-600 dark:text-neutral-400">{item.en_main}</span>
          )}
        </p>
      )}

      {awaitingSelfCheck && (
        <div className="mt-3 rounded bg-neutral-100 p-2 text-sm text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          <p>
            {t('drill.reference')}: <span className="font-medium">{mode === 'comprehension' ? item.ru : item.en_main}</span>
          </p>
          {mode === 'comprehension' && ruNormalizedHint && (
            <p className="mt-1 text-xs text-green-700 dark:text-green-400">{t('listening.looksMatching')}</p>
          )}
          <p className="mt-1">{t('listening.selfCheckPrompt')}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => handleSelfReport(true)}
              className="rounded bg-green-700 px-3 py-1 text-xs font-medium text-white"
            >
              {t('drill.selfCorrect')}
            </button>
            <button
              type="button"
              onClick={() => handleSelfReport(false)}
              className="rounded bg-red-700 px-3 py-1 text-xs font-medium text-white"
            >
              {t('drill.selfWrong')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
