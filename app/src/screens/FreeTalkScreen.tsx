// PLAN.md §8.9 — Free Talk MVP: topic picker → chat (tutor role) → persisted
// transcript survives a closed tab → "Закончить" gives a one-shot summary and
// writes recurring_tags to errorProfile (§10.4, consumption UI is Ф4 scope).

import { useEffect, useState } from 'react';
import { useI18nStore } from '../i18n/store';
import { hasAnyConfiguredProvider } from '../llm/status';
import {
  FREETALK_TOPIC_PRESETS,
  appendFreeTalkMessages,
  createFreeTalkSession,
  findUnfinishedFreeTalkSession,
  finishFreeTalkSession,
  generateFreeTalkSummary,
  getFreeTalkSession,
  getFreeTalkTurnStatus,
  isTopicAvailableAtLevel,
  sendFreeTalkMessage,
  upsertErrorProfileTags,
  type FreeTalkSummary,
} from '../llm/freeTalk';
import type { FreeTalkMessage, FreeTalkSessionRecord } from '../db/db';
import type { Msg } from '../llm/types';

// No SRS/user-level tracking exists yet (Ф4 scope, §10) — Free Talk uses a
// fixed comfort-level default and an honest hint instead of inventing one.
// See the Ф3в report for this call.
const DEFAULT_LEVEL = 'A2';

function toHistory(messages: readonly FreeTalkMessage[]): Msg[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export function FreeTalkScreen(): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);
  const [unfinished, setUnfinished] = useState<FreeTalkSessionRecord | undefined>(undefined);
  const [session, setSession] = useState<FreeTalkSessionRecord | undefined>(undefined);
  const [customTopic, setCustomTopic] = useState('');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [summary, setSummary] = useState<FreeTalkSummary | undefined>(undefined);
  const [summaryFailed, setSummaryFailed] = useState(false);

  useEffect(() => {
    void hasAnyConfiguredProvider('tutor').then(setHasProvider);
    void findUnfinishedFreeTalkSession().then(setUnfinished);
  }, []);

  async function handleResume() {
    if (!unfinished) return;
    setSession(unfinished);
    setUnfinished(undefined);
  }

  async function handleFinishOld() {
    if (!unfinished || unfinished.id === undefined) return;
    await handleFinishSession(unfinished);
    setUnfinished(undefined);
  }

  async function handleStart(topic: string) {
    const id = await createFreeTalkSession(topic, DEFAULT_LEVEL);
    const created = await getFreeTalkSession(id);
    if (created) setSession(created);
  }

  async function handleSend() {
    const message = draft.trim();
    if (!message || pending || !session || session.id === undefined) return;
    setPending(true);
    setFailed(false);
    setDraft('');

    const history = toHistory(session.messages);
    const result = await sendFreeTalkMessage(session.topic, session.level, history, message);
    setPending(false);
    if (!result) {
      setFailed(true);
      return;
    }
    const now = Date.now();
    const newMessages: FreeTalkMessage[] = [
      { role: 'user', content: message, ts: now },
      { role: 'assistant', content: result.reply, ts: now },
    ];
    await appendFreeTalkMessages(session.id, newMessages);
    setSession((s) => (s ? { ...s, messages: [...s.messages, ...newMessages] } : s));
  }

  async function handleFinishSession(target: FreeTalkSessionRecord) {
    if (target.id === undefined) return;
    if (target.messages.length === 0) {
      await finishFreeTalkSession(target.id);
      return;
    }
    const result = await generateFreeTalkSummary(target.messages, target.level);
    if (!result) {
      setSummaryFailed(true);
      await finishFreeTalkSession(target.id);
      return;
    }
    await finishFreeTalkSession(target.id, result.summary);
    if (result.summary.recurring_tags.length > 0) {
      await upsertErrorProfileTags(result.summary.recurring_tags);
    }
    setSummary(result.summary);
  }

  async function handleFinish() {
    if (!session) return;
    await handleFinishSession(session);
    setSession(undefined);
  }

  if (hasProvider === false) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">{t('freeTalk.title')}</h1>
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">{t('freeTalk.noProvider')}</p>
      </div>
    );
  }

  if (summary || summaryFailed) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">{t('freeTalk.summaryTitle')}</h1>
        {summary && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-neutral-900 dark:text-neutral-100">{summary.summary_ru}</p>
          </div>
        )}
        {summaryFailed && (
          <p className="mt-4 text-sm text-red-700 dark:text-red-400">{t('freeTalk.summaryFailed')}</p>
        )}
        <button
          type="button"
          onClick={() => {
            setSummary(undefined);
            setSummaryFailed(false);
          }}
          className="mt-4 rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          {t('freeTalk.backToDrills')}
        </button>
      </div>
    );
  }

  if (unfinished) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">{t('freeTalk.title')}</h1>
        <p className="mt-4 text-sm text-neutral-700 dark:text-neutral-300">{t('freeTalk.resumePrompt')}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void handleResume()}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            {t('freeTalk.resume')}
          </button>
          <button
            type="button"
            onClick={() => void handleFinishOld()}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            {t('freeTalk.finishOld')}
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">{t('freeTalk.title')}</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t('freeTalk.intro')}</p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">{t('freeTalk.levelHint')}</p>

        <div className="mt-4">
          <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('freeTalk.topicPicker')}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {FREETALK_TOPIC_PRESETS.filter((p) => isTopicAvailableAtLevel(p, DEFAULT_LEVEL)).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => void handleStart(t(`freeTalk.topic.${preset.id}`))}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
              >
                {t(`freeTalk.topic.${preset.id}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder={t('freeTalk.customTopicPlaceholder')}
            className="flex-1 rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <button
            type="button"
            disabled={!customTopic.trim()}
            onClick={() => void handleStart(customTopic.trim())}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {t('freeTalk.start')}
          </button>
        </div>
      </div>
    );
  }

  const userTurns = session.messages.filter((m) => m.role === 'user').length;
  const turnStatus = getFreeTalkTurnStatus(userTurns);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{session.topic}</h1>

      <div className="mt-4 max-h-96 space-y-2 overflow-y-auto rounded border border-neutral-300 p-3 dark:border-neutral-700">
        {session.messages.map((m, i) => (
          <p
            key={i}
            className={
              m.role === 'user'
                ? 'text-sm text-neutral-900 dark:text-neutral-100'
                : 'text-sm text-neutral-700 dark:text-neutral-300'
            }
          >
            <span className="font-medium">{m.role === 'user' ? '> ' : ''}</span>
            {m.content}
          </p>
        ))}
        {failed && <p className="text-sm text-red-700 dark:text-red-400">{t('tutor.chat.failed')}</p>}
      </div>

      {turnStatus === 'warning' && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t('freeTalk.warningNearLimit')}</p>
      )}
      {turnStatus === 'capped' && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t('freeTalk.budgetExhausted')}</p>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={t('freeTalk.inputPlaceholder')}
          disabled={pending || turnStatus === 'capped'}
          className="flex-1 rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={pending || !draft.trim() || turnStatus === 'capped'}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {t('freeTalk.send')}
        </button>
        <button
          type="button"
          onClick={() => void handleFinish()}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          {t('freeTalk.finish')}
        </button>
      </div>
    </div>
  );
}
