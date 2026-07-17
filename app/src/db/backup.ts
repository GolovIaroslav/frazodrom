import { db } from './db';

const BACKUP_FORMAT_VERSION = 1;
const DB_VERSION = 6;

type BackupTableName =
  | 'kv'
  | 'packs'
  | 'skillState'
  | 'itemState'
  | 'attempts'
  | 'acceptedCache'
  | 'errorProfile'
  | 'sessions'
  | 'exams'
  | 'providerBudget'
  | 'judgeDisputes'
  | 'tutorActionCache'
  | 'freeTalkSessions'
  | 'ttsCache';

export interface BackupPayload {
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  dbVersion: number;
  createdAt: number;
  tables: Partial<Record<BackupTableName, unknown[]>>;
}

const TABLE_NAMES: BackupTableName[] = [
  'kv',
  'packs',
  'skillState',
  'itemState',
  'attempts',
  'acceptedCache',
  'errorProfile',
  'sessions',
  'exams',
  'providerBudget',
  'judgeDisputes',
  'tutorActionCache',
  'freeTalkSessions',
  'ttsCache',
];

const SECRET_KV_KEY = /^llm\.(gemini|groq|openrouter)\.apiKey$|^llm\.(gigachat|yandex)Credentials$/;

function stripSecrets(rows: unknown[], includeSecrets: boolean): unknown[] {
  if (includeSecrets) return rows;

  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object' || !('key' in row)) return [row];
    const record = row as { key: unknown; value?: unknown };
    if (typeof record.key !== 'string') return [row];
    if (SECRET_KV_KEY.test(record.key)) return [];
    if (record.key === 'llm.localOpenai.profiles' && Array.isArray(record.value)) {
      return [
        {
          ...record,
          value: record.value.map((profile) => {
            if (!profile || typeof profile !== 'object') return profile;
            const withoutApiKey = { ...(profile as Record<string, unknown>) };
            delete withoutApiKey.apiKey;
            return withoutApiKey;
          }),
        },
      ];
    }
    return [row];
  });
}

function validatePayload(value: unknown): asserts value is BackupPayload {
  if (!value || typeof value !== 'object') throw new Error('Invalid backup format');
  const payload = value as Partial<BackupPayload>;
  if (payload.formatVersion !== BACKUP_FORMAT_VERSION || !payload.tables || typeof payload.tables !== 'object') {
    throw new Error('Invalid backup format');
  }
}

export async function exportDatabase(options: { includeSecrets?: boolean } = {}): Promise<BackupPayload> {
  const tables: Partial<Record<BackupTableName, unknown[]>> = {};
  for (const tableName of TABLE_NAMES) {
    const rows = await db.table(tableName).toArray();
    tables[tableName] = tableName === 'kv' ? stripSecrets(rows, options.includeSecrets === true) : rows;
  }

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    dbVersion: DB_VERSION,
    createdAt: Date.now(),
    tables,
  };
}

export async function importDatabase(value: unknown): Promise<void> {
  validatePayload(value);
  await db.transaction('rw', db.tables, async () => {
    for (const tableName of TABLE_NAMES) {
      const table = db.table(tableName);
      await table.clear();
      const rows = value.tables[tableName];
      if (rows && rows.length > 0) await table.bulkAdd(rows);
    }
  });
}

export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}

export function downloadBackup(payload: BackupPayload, filename = `frazodrom-backup-${new Date().toISOString().slice(0, 10)}.json`): void {
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
