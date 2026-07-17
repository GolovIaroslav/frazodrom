// PLAN.md §14.6 — storage protection: persistent storage grant, a private-mode
// heuristic, and a multi-tab write guard via Web Locks.

const PERSIST_REQUESTED_KEY = 'frazodrom.storagePersistRequested';
// Below this quota (bytes), assume we're likely in a private/incognito tab
// (browsers usually cap private-mode storage far below normal quota).
const SUSPICIOUSLY_SMALL_QUOTA_BYTES = 120 * 1024 * 1024;

/** Requests persistent storage on first progress write (idempotent per session). */
export async function ensureStoragePersisted(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  if (window.localStorage.getItem(PERSIST_REQUESTED_KEY) === '1') return;
  try {
    await navigator.storage.persist();
    window.localStorage.setItem(PERSIST_REQUESTED_KEY, '1');
  } catch {
    // Best-effort — not all browsers support this.
  }
}

export interface StorageWarning {
  likelyPrivateMode: boolean;
  quotaBytes?: number;
}

/** Heuristic: an abnormally small quota suggests private/incognito mode. */
export async function checkStorageQuota(): Promise<StorageWarning> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { likelyPrivateMode: false };
  }
  try {
    const { quota } = await navigator.storage.estimate();
    if (quota === undefined) return { likelyPrivateMode: false };
    return { likelyPrivateMode: quota < SUSPICIOUSLY_SMALL_QUOTA_BYTES, quotaBytes: quota };
  } catch {
    return { likelyPrivateMode: false };
  }
}

const TAB_LOCK_NAME = 'frazodrom-single-tab';

/**
 * Multi-tab guard (§14.6d): tries to hold a Web Lock for the app's
 * lifetime; `onLostLock` fires if another tab already holds it (lock
 * acquisition never resolves the callback in that case, so a short
 * `navigator.locks.request(..., {ifAvailable:true})` probe is used first).
 */
export async function guardSingleTab(onOtherTabOpen: () => void): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.locks) return;
  try {
    const gotLock = await navigator.locks.request(TAB_LOCK_NAME, { ifAvailable: true }, (lock) => {
      if (!lock) return false;
      // Hold the lock for as long as this tab is open.
      return new Promise<boolean>(() => {});
    });
    if (gotLock === false) onOtherTabOpen();
  } catch {
    // Web Locks unsupported — degrade silently, no guard.
  }
}
