// PLAN.md §9.1 — one-time nudge after ~20 system-voice plays: "there's a
// better voice (86 MB, offline forever)". Marks itself dismissed as soon as
// it's shown once (not just on explicit close) — it's a single nudge, not a
// recurring banner that would reappear on every subsequent Web Speech play.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18nStore } from '../i18n/store';
import { onKokoroPrompt } from '../tts/kokoroPromptNotifier';
import { dismissKokoroPrompt } from '../tts/settings';

export function KokoroPromptBanner(): React.ReactElement | null {
  const t = useI18nStore((s) => s.t);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return onKokoroPrompt(() => {
      setVisible(true);
      void dismissKokoroPrompt();
    });
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900">
      {t('tts.kokoroNudge')}{' '}
      <Link to="/settings" className="underline decoration-dotted" onClick={() => setVisible(false)}>
        {t('tts.kokoroNudgeLink')}
      </Link>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="ml-3 underline decoration-dotted"
        aria-label={t('toast.dismiss')}
      >
        {t('toast.dismiss')}
      </button>
    </div>
  );
}
