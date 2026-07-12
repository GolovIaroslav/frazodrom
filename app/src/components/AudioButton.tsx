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
  // 'busy' covers both "synthesizing" (kokoro cache miss) and "playing" —
  // `speak()` only resolves once playback has actually finished, so there is
  // no separate signal to distinguish the two phases here.
  const [busy, setBusy] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);

  const handleClick = useCallback(async () => {
    setBusy(true);
    try {
      await speak(text, { onSynthesisStart: () => setSynthesizing(true) });
    } catch {
      // swallow — speak() already falls back to Web Speech internally; a
      // thrown error here means no TTS engine is available at all.
    } finally {
      setBusy(false);
      setSynthesizing(false);
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
      {synthesizing ? t('tts.synthesizing') : (label ?? `🔊 ${t('tts.play')}`)}
    </button>
  );
}
