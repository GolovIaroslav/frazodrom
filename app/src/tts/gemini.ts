import { getGeminiApiKey } from '../llm/settings';

export const GEMINI_TTS_MODEL = 'gemini-3.1-flash-tts-preview';

interface GeminiTtsResponse {
  output_audio?: { data?: string };
}

function pcmToWav(base64: string, sampleRate = 24_000, channels = 1, bitsPerSample = 16): Blob {
  const pcm = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + pcm.length);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeText(36, 'data');
  view.setUint32(40, pcm.length, true);
  new Uint8Array(buffer, headerSize).set(pcm);
  return new Blob([buffer], { type: 'audio/wav' });
}

function styleFor(accent: 'US' | 'UK', rate: number): string {
  const accentText = accent === 'US' ? 'natural American English' : 'natural British English';
  const speedText = rate < 0.8 ? 'slow and clear' : rate < 0.95 ? 'slightly slow' : 'normal conversational';
  return `Read exactly one English learner sentence in ${accentText}. Use a ${speedText} pace and natural sentence intonation. Do not add commentary.`;
}

export function geminiVoiceFor(gender: 'f' | 'm'): 'Kore' | 'Puck' {
  return gender === 'f' ? 'Kore' : 'Puck';
}

export async function synthesizeWithGemini(
  text: string,
  options: { accent: 'US' | 'UK'; gender: 'f' | 'm'; rate: number; signal?: AbortSignal },
): Promise<Blob> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini TTS is not configured');

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: GEMINI_TTS_MODEL,
      input: `${styleFor(options.accent, options.rate)}\n\n${text}`,
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice: geminiVoiceFor(options.gender) }],
      },
    }),
    signal: options.signal,
  });

  if (!response.ok) throw new Error(`Gemini TTS request failed (${response.status})`);
  const data = (await response.json()) as GeminiTtsResponse;
  const audio = data.output_audio?.data;
  if (!audio) throw new Error('Gemini TTS returned no audio');
  try {
    return pcmToWav(audio);
  } catch {
    throw new Error('Gemini TTS returned invalid audio');
  }
}
