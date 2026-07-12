import { describe, expect, it } from 'vitest';
import { formatLocalProviderLabel } from './localProfile';

describe('formatLocalProviderLabel', () => {
  it('shows the model name together with the host when both are present', () => {
    expect(
      formatLocalProviderLabel({
        baseUrl: 'http://localhost:1234/v1',
        label: 'Local OpenAI-compatible',
        model: 'qwen3.5-4b',
      }),
    ).toBe('qwen3.5-4b (localhost:1234)');
  });

  it('falls back to the saved label when the model is empty', () => {
    expect(
      formatLocalProviderLabel({
        baseUrl: 'http://localhost:1234/v1',
        label: 'Local OpenAI-compatible',
        model: '',
      }),
    ).toBe('Local OpenAI-compatible');
  });
});
