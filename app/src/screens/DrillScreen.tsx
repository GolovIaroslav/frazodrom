import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18nStore } from '../i18n/store';
import { loadPack } from '../engine/packs';
import { buildQueue } from '../engine/queue';
import { DrillEngine, type Verdict } from '../engine/session';
import { getHint } from '../engine/hints';
import type { SkillPack } from '../engine/types';
import { ensureStoragePersisted, checkStorageQuota } from '../db/storage';

function wordDiff(userInput: string, reference: string): { text: string; mismatch: boolean }[] {
  const userTokens = userInput.trim().split(/\s+/).filter(Boolean);
  const refTokens = reference.trim().split(/\s+/).filter(Boolean);
  const len = Math.max(userTokens.length, refTokens.length);
  const out: { text: string; mismatch: boolean }[] = [];
  for (let i = 0; i < len; i += 1) {
    const u = userTokens[i];
    const r = refTokens[i];
    if (u === undefined) continue;
    out.push({ text: u, mismatch: u.toLowerCase() !== (r ?? '').toLowerCase() });
  }
  return out;
}

export function DrillScreen(): React.ReactElement {
  const { skillId } = useParams<{ skillId: string }>();
  const t = useI18nStore((s) => s.t);

  const [pack, setPack] = useState<SkillPack | null>(null);
  const [error, setError] = useState(false);
  const [privateModeWarning, setPrivateModeWarning] = useState(false);
  // Wrapped in a fresh box on every mutation so React sees a new reference
  // and re-renders (DrillEngine itself is a plain mutable class, not state).
  const [engineBox, setEngineBox] = useState<{ engine: DrillEngine } | null>(null);
  const engine = engineBox?.engine ?? null;
  const rerender = useCallback(() => {
    setEngineBox((box) => (box ? { engine: box.engine } : box));
  }, []);

  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!skillId) return;
    let cancelled = false;
    loadPack(skillId)
      .then((data) => {
        if (cancelled) return;
        setPack(data);
        setEngineBox({ engine: new DrillEngine(buildQueue(data.items)) });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [skillId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [verdict, engine?.phase, engine?.currentItem]);

  useEffect(() => {
    void ensureStoragePersisted();
    checkStorageQuota().then((w) => {
      if (w.likelyPrivateMode) setPrivateModeWarning(true);
    });
  }, []);

  const handleCheck = useCallback(() => {
    if (!engine) return;
    if (engine.phase === 'answer') {
      if (engine.isPendingAdvance) {
        engine.advance();
        setInput('');
        setVerdict(null);
        rerender();
        return;
      }
      const result = engine.submitAnswer(input);
      setVerdict(result.verdict);
      setAnnouncement(t(`drill.verdict.${result.verdict}`));
      rerender();
    } else if (engine.phase === 'rewrite') {
      const result = engine.submitRewrite(input);
      setVerdict(result.success ? 'correct' : 'wrong');
      setAnnouncement(t(`drill.verdict.${result.success ? 'correct' : 'wrong'}`));
      setInput('');
      if (result.success) setVerdict(null);
      rerender();
    }
  }, [engine, input, rerender, t]);

  const handleHint = useCallback(() => {
    if (!engine || !pack) return;
    engine.requestHint();
    rerender();
  }, [engine, pack, rerender]);

  const handleGiveUp = useCallback(() => {
    if (!engine) return;
    engine.giveUp();
    setInput('');
    setVerdict(null);
    rerender();
  }, [engine, rerender]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCheck();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleHint();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleGiveUp();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCheck, handleHint, handleGiveUp]);

  const hintText = useMemo(() => {
    if (!engine || !pack || engine.currentHintLevel === 0) return null;
    const item = engine.currentItem;
    if (!item) return null;
    return getHint(engine.currentHintLevel, pack.skill.pattern, item.en_main);
  }, [engine, pack]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600 dark:text-red-400">{t('drill.error')}</p>
      </div>
    );
  }

  if (!pack || !engine) {
    return (
      <div className="p-6">
        <p className="text-neutral-600 dark:text-neutral-400">{t('drill.loading')}</p>
      </div>
    );
  }

  if (engine.phase === 'finished') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          {t('drill.finishedTitle')}
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">{t('drill.finishedBody')}</p>
        <Link
          to="/course-map"
          className="mt-4 inline-block rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {t('drill.backToMap')}
        </Link>
      </div>
    );
  }

  const item = engine.currentItem;
  if (!item) return <div className="p-6" />;

  const isRewrite = engine.phase === 'rewrite';
  const diff = verdict === 'wrong' && !isRewrite ? wordDiff(input, item.en_main) : null;

  return (
    <div className="mx-auto max-w-xl p-6">
      {privateModeWarning && (
        <p
          role="alert"
          className="mb-4 rounded border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          ⚠ {t('drill.privateModeWarning')}
        </p>
      )}

      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        {t('drill.progress')}: {engine.remaining}
      </div>

      <h1 className="mt-2 text-xl font-medium text-neutral-900 dark:text-neutral-100">
        {item.ru}
      </h1>

      {isRewrite && (
        <p className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-300">
          {t('drill.rewriteTitle')}
        </p>
      )}

      {engine.isReferenceVisible && (
        <p className="mt-2 rounded bg-neutral-100 p-2 text-sm text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {t('drill.reference')}: <span className="font-medium">{item.en_main}</span>
        </p>
      )}

      {hintText && !isRewrite && (
        <p className="mt-2 rounded bg-blue-50 p-2 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-200">
          {hintText}
        </p>
      )}

      <label htmlFor="drill-input" className="sr-only">
        {isRewrite ? t('drill.rewritePlaceholder') : t('drill.inputLabel')}
      </label>
      <input
        id="drill-input"
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={isRewrite ? t('drill.rewritePlaceholder') : t('drill.inputPlaceholder')}
        autoFocus
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        className="mt-3 w-full rounded border border-neutral-300 p-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus-visible:outline-neutral-100"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCheck}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {isRewrite
            ? t('drill.rewriteSubmit')
            : engine.isPendingAdvance
              ? t('drill.next')
              : t('drill.check')}
        </button>
        {!isRewrite && (
          <>
            <button
              type="button"
              onClick={handleHint}
              className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            >
              {t('drill.hint')}
            </button>
            <button
              type="button"
              onClick={handleGiveUp}
              className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            >
              {t('drill.giveUp')}
            </button>
          </>
        )}
      </div>

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

      {verdict && (
        <p
          className={
            verdict === 'wrong'
              ? 'mt-3 font-medium text-red-700 dark:text-red-400'
              : verdict === 'correct'
                ? 'mt-3 font-medium text-green-700 dark:text-green-400'
                : 'mt-3 font-medium text-amber-700 dark:text-amber-400'
          }
        >
          {verdict === 'wrong' ? '✗' : verdict === 'correct' ? '✓' : '~'}{' '}
          {t(`drill.verdict.${verdict}`)}
        </p>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
