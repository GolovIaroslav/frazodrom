import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { getLanguageToolSettings, setLanguageToolSettings } from './settings';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => db.close());

describe('LanguageTool settings', () => {
  it('defaults to disabled local-only checking', async () => {
    await expect(getLanguageToolSettings()).resolves.toEqual({ enabled: false, url: 'http://localhost:8010' });
  });

  it('persists an explicit self-hosted endpoint', async () => {
    await setLanguageToolSettings({ enabled: true, url: 'http://127.0.0.1:8010' });
    await expect(getLanguageToolSettings()).resolves.toEqual({ enabled: true, url: 'http://127.0.0.1:8010' });
  });
});
