import { useCallback, useState } from 'react';
import { useI18nStore } from '../i18n/store';
import { sendTutorChatMessage, type TutorChatContext } from '../llm/tutorChat';
import type { Msg } from '../llm/types';

export interface TutorChatProps {
  ctx: TutorChatContext;
}

/**
 * §8.5 point 2 — free-form "ask the tutor" chat. History lives only in this
 * component's state: it is never written to Dexie and is gone once the drill
 * screen moves to the next item (component is remounted via a `key` on the
 * item id, same as TutorPanel).
 */
export function TutorChat({ ctx }: TutorChatProps): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleSend = useCallback(async () => {
    const message = draft.trim();
    if (!message || pending) return;
    setPending(true);
    setFailed(false);
    setDraft('');
    const result = await sendTutorChatMessage(ctx, history, message, t('tutor.chat.limitReached'));
    setPending(false);
    if (!result) {
      setFailed(true);
      return;
    }
    setHistory((h) => [...h, { role: 'user', content: message }, { role: 'assistant', content: result.reply }]);
  }, [ctx, draft, history, pending, t]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
      >
        {t('tutor.chat.open')}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded border border-neutral-300 p-2 dark:border-neutral-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t('tutor.chat.open')}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-500 underline dark:text-neutral-400"
        >
          {t('tutor.chat.close')}
        </button>
      </div>

      <div className="mt-2 max-h-60 space-y-2 overflow-y-auto">
        {history.map((m, i) => (
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

      <div className="mt-2 flex gap-2">
        <label htmlFor="tutor-chat-input" className="sr-only">
          {t('tutor.chat.placeholder')}
        </label>
        <input
          id="tutor-chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={t('tutor.chat.placeholder')}
          disabled={pending}
          className="flex-1 rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={pending || !draft.trim()}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {t('tutor.chat.send')}
        </button>
      </div>
    </div>
  );
}
