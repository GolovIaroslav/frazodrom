import { useEffect, useRef, useState } from 'react';
import { useI18nStore } from '../i18n/store';
import { chooseTranscript, isSpeechRecognitionAvailable } from '../speaking/voice';

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEventLike {
  results: ArrayLike<RecognitionResultLike>;
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionConstructor = new () => RecognitionLike;

function recognitionConstructor(): RecognitionConstructor | undefined {
  const target = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return target.SpeechRecognition ?? target.webkitSpeechRecognition;
}

export function SpeakingPractice({ reference }: { reference: string }): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const [transcript, setTranscript] = useState('');
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const start = async (): Promise<void> => {
    if (recording) return;
    const chunks: BlobPart[] = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        const nextUrl = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
        setAudioUrl((oldUrl) => {
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          return nextUrl;
        });
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      const Constructor = recognitionConstructor();
      if (Constructor) {
        const recognition = new Constructor();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          const parts = Array.from(event.results).map((result) => ({
            transcript: result[0].transcript,
            isFinal: result.isFinal,
          }));
          const next = chooseTranscript(parts);
          if (next) setTranscript(next);
        };
        recognition.onerror = () => undefined;
        recognition.start();
        recognitionRef.current = recognition;
      }
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  const stop = (): void => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  return (
    <section className="mt-3 rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-sm text-neutral-700 dark:text-neutral-300">{t('speaking.afterCorrect')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => void start()} disabled={recording} className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
          {t('speaking.record')}
        </button>
        <button type="button" onClick={stop} disabled={!recording} className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
          {t('speaking.stop')}
        </button>
      </div>
      {!isSpeechRecognitionAvailable() && <p className="mt-2 text-xs text-neutral-500">{t('speaking.sttUnavailable')}</p>}
      {transcript && <p className="mt-2 text-sm">{t('speaking.recognized')}: {transcript}</p>}
      {audioUrl && <audio className="mt-2 w-full" controls src={audioUrl}>{reference}</audio>}
    </section>
  );
}
