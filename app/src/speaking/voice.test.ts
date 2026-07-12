import { describe, expect, it } from 'vitest';
import { chooseTranscript, isSpeechRecognitionAvailable } from './voice';

describe('voice helpers', () => {
  it('detects either Chrome STT constructor', () => {
    expect(isSpeechRecognitionAvailable({ SpeechRecognition: class {} })).toBe(true);
    expect(isSpeechRecognitionAvailable({ webkitSpeechRecognition: class {} })).toBe(true);
    expect(isSpeechRecognitionAvailable({})).toBe(false);
  });

  it('uses the final transcript when Chrome sends interim alternatives', () => {
    expect(
      chooseTranscript([
        { transcript: 'I have', isFinal: false },
        { transcript: 'I have finished', isFinal: true },
      ]),
    ).toBe('I have finished');
  });
});
