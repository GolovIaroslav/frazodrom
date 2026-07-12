import { describe, expect, it, vi } from 'vitest';
import { validateProviderConnection } from './providerValidation';

describe('validateProviderConnection', () => {
  it('accepts a configured provider that returns a reply', async () => {
    const provider = {
      id: 'test:ok',
      label: 'Test',
      isConfigured: vi.fn().mockResolvedValue(true),
      chat: vi.fn().mockResolvedValue('OK'),
    };

    await expect(validateProviderConnection(provider)).resolves.toBe(true);
    expect(provider.chat).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 8, temperature: 0 }),
      expect.any(AbortSignal),
    );
  });

  it('rejects missing, unconfigured, empty, and failing providers', async () => {
    await expect(validateProviderConnection(undefined)).resolves.toBe(false);
    await expect(
      validateProviderConnection({
        id: 'test:missing',
        label: 'Missing',
        isConfigured: () => false,
        chat: vi.fn(),
      }),
    ).resolves.toBe(false);
    await expect(
      validateProviderConnection({
        id: 'test:empty',
        label: 'Empty',
        isConfigured: () => true,
        chat: vi.fn().mockResolvedValue(''),
      }),
    ).resolves.toBe(false);
    await expect(
      validateProviderConnection({
        id: 'test:failed',
        label: 'Failed',
        isConfigured: () => true,
        chat: vi.fn().mockRejectedValue(new Error('offline')),
      }),
    ).resolves.toBe(false);
  });
});
