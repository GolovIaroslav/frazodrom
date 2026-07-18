import { useCallback, useState } from 'react';
import { useI18nStore } from '../i18n/store';
import { speak } from '../tts/speak';

interface AudioButtonProps {
  text: string;
  label?: string;
  className?: string;
}

/** Small reusable play button for TTS playback (§9.1) — used in listening screens and settings voice previews. */
export function AudioButton({ text, label, className }: AudioButtonProps): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(async () => {
    setBusy(true);
    try {
      await speak(text);
    } catch {
      // A thrown error means browser speech is unavailable or was rejected.
      // Audio is supplementary, so the exercise remains usable without it.
    } finally {
      setBusy(false);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy}
      className={
        className ??
        'rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100'
      }
    >
      {label ?? `🔊 ${t('tts.play')}`}
    </button>
  );
}
