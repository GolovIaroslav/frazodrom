import { describe, expect, it } from 'vitest';
import { KOKORO_VOICES, defaultVoiceFor, voicesFor } from './voices';

describe('kokoro voice catalog (§9.1, exact ids from the published npm package)', () => {
  it('has 28 English voices split across 4 accent+gender groups', () => {
    expect(KOKORO_VOICES).toHaveLength(28);
    expect(voicesFor('US', 'f')).toHaveLength(11);
    expect(voicesFor('US', 'm')).toHaveLength(9);
    expect(voicesFor('UK', 'f')).toHaveLength(4);
    expect(voicesFor('UK', 'm')).toHaveLength(4);
  });

  it('every voice id is unique and prefixed for its accent+gender', () => {
    const ids = KOKORO_VOICES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of KOKORO_VOICES) {
      const prefix = { US: { f: 'af_', m: 'am_' }, UK: { f: 'bf_', m: 'bm_' } }[v.accent][v.gender];
      expect(v.id.startsWith(prefix)).toBe(true);
    }
  });

  it('defaultVoiceFor picks the best-graded voice per accent+gender', () => {
    expect(defaultVoiceFor('US', 'f').id).toBe('af_heart'); // A-grade, per the README's own table
    expect(defaultVoiceFor('UK', 'f').id).toBe('bf_emma'); // B- grade, best of the 4 UK female voices
  });
});
