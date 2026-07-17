// PLAN.md §8.8 — provider-switch toast for Gemini quota fallback to Groq.
// when the provider chain auto-switches on 429/auth error. Subscribes to
// llm/switchNotifier's tiny event bus; self-dismisses after a few seconds.

import { useEffect, useState } from 'react';
import { useI18nStore } from '../i18n/store';
import { onProviderSwitch, type SwitchEvent } from '../llm/switchNotifier';

const AUTO_DISMISS_MS = 6000;

export function Toast(): React.ReactElement | null {
  const t = useI18nStore((s) => s.t);
  const [event, setEvent] = useState<SwitchEvent | null>(null);

  useEffect(() => {
    return onProviderSwitch((e) => setEvent(e));
  }, []);

  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(() => setEvent(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [event]);

  if (!event) return null;

  const message = event.toLabel
    ? t('toast.switched').replace('{FROM}', event.fromLabel).replace('{TO}', event.toLabel)
    : t('toast.switchedNoFallback').replace('{FROM}', event.fromLabel);

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900">
      {message}
      <button
        type="button"
        onClick={() => setEvent(null)}
        className="ml-3 underline decoration-dotted"
        aria-label={t('toast.dismiss')}
      >
        {t('toast.dismiss')}
      </button>
    </div>
  );
}
