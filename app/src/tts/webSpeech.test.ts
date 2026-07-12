import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isWebSpeechAvailable, pickWebSpeechVoice } from './webSpeech';

function fakeVoice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang, default: false, localService: true, voiceURI: name } as SpeechSynthesisVoice;
}

const VOICES = [
  fakeVoice('Microsoft Zira - English (United States)', 'en-US'),
  fakeVoice('Microsoft David - English (United States)', 'en-US'),
  fakeVoice('Google UK English Female', 'en-GB'),
  fakeVoice('Google UK English Male', 'en-GB'),
];

beforeEach(() => {
  // @ts-expect-error -- jsdom has no speechSynthesis; stub the minimal surface this module uses.
  window.speechSynthesis = {
    getVoices: () => VOICES,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    cancel: () => undefined,
    speak: () => undefined,
  };
});

afterEach(() => {
  // @ts-expect-error -- undo the stub between tests.
  delete window.speechSynthesis;
  vi.restoreAllMocks();
});

describe('webSpeech (§9.1/§9.3 fallback)', () => {
  it('reports availability based on window.speechSynthesis', () => {
    expect(isWebSpeechAvailable()).toBe(true);
  });

  it('picks a voice matching the requested accent and gender hint', async () => {
    const usFemale = await pickWebSpeechVoice('US', 'f');
    expect(usFemale?.name).toContain('Zira');

    const ukMale = await pickWebSpeechVoice('UK', 'm');
    expect(ukMale?.name).toContain('Male');
  });

  it('falls back to any English voice when the requested accent has none', async () => {
    window.speechSynthesis.getVoices = () => [VOICES[0] as SpeechSynthesisVoice];
    const ukVoice = await pickWebSpeechVoice('UK', 'f');
    expect(ukVoice?.lang).toBe('en-US');
  });
});
