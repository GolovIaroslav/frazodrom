import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkStorageQuota, ensureStoragePersisted } from './storage';

const originalStorage = navigator.storage;

afterEach(() => {
  Object.defineProperty(navigator, 'storage', { value: originalStorage, configurable: true });
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('ensureStoragePersisted', () => {
  it('calls navigator.storage.persist() once and remembers it in localStorage', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });

    await ensureStoragePersisted();
    await ensureStoragePersisted();

    expect(persist).toHaveBeenCalledTimes(1);
  });
});

describe('checkStorageQuota', () => {
  it('flags an abnormally small quota as likely private mode', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: vi.fn().mockResolvedValue({ quota: 50 * 1024 * 1024 }) },
      configurable: true,
    });
    const result = await checkStorageQuota();
    expect(result.likelyPrivateMode).toBe(true);
  });

  it('does not flag a normal quota', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: vi.fn().mockResolvedValue({ quota: 2 * 1024 * 1024 * 1024 }) },
      configurable: true,
    });
    const result = await checkStorageQuota();
    expect(result.likelyPrivateMode).toBe(false);
  });
});
