export interface TranscriptPart {
  transcript: string;
  isFinal: boolean;
}

export interface SpeechRecognitionWindow {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
}

export function isSpeechRecognitionAvailable(
  target: SpeechRecognitionWindow = window as SpeechRecognitionWindow,
): boolean {
  return Boolean(target.SpeechRecognition ?? target.webkitSpeechRecognition);
}

export function chooseTranscript(parts: readonly TranscriptPart[]): string {
  return parts.filter((part) => part.isFinal).map((part) => part.transcript).join(' ').trim();
}
