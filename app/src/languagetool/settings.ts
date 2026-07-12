import { db } from '../db/db';

const KEY = 'languagetool.settings';

export interface LanguageToolSettings {
  enabled: boolean;
  url: string;
}

const DEFAULT_SETTINGS: LanguageToolSettings = { enabled: false, url: 'http://localhost:8010' };

export async function getLanguageToolSettings(): Promise<LanguageToolSettings> {
  const row = await db.kv.get(KEY);
  return row ? (row.value as LanguageToolSettings) : DEFAULT_SETTINGS;
}

export async function setLanguageToolSettings(settings: LanguageToolSettings): Promise<void> {
  await db.kv.put({ key: KEY, value: settings });
}
