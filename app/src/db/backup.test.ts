import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { exportDatabase, importDatabase, resetDatabase } from './backup';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  db.close();
});

describe('database backup', () => {
  it('exports progress and settings but excludes provider secrets by default', async () => {
    await db.kv.bulkPut([
      { key: 'llm.gemini.apiKey', value: 'secret' },
      { key: 'llm.routing', value: { judge: [], tutor: [], generator: [] } },
      { key: 'tts.rate', value: 0.85 },
    ]);
    await db.attempts.add({
      itemId: 'item-1',
      ts: 1,
      userInput: 'It works.',
      verdict: 'correct',
      verdictSource: 'local',
    });

    const backup = await exportDatabase();
    expect(backup.dbVersion).toBe(6);
    expect(backup.tables.attempts).toHaveLength(1);
    expect(backup.tables.kv).toEqual([
      { key: 'llm.routing', value: { judge: [], tutor: [], generator: [] } },
      { key: 'tts.rate', value: 0.85 },
    ]);
  });

  it('includes provider secrets only when explicitly requested', async () => {
    await db.kv.put({ key: 'llm.gemini.apiKey', value: 'secret' });

    const backup = await exportDatabase({ includeSecrets: true });
    expect(backup.tables.kv).toContainEqual({ key: 'llm.gemini.apiKey', value: 'secret' });
  });

  it('imports a backup by replacing existing data', async () => {
    await db.attempts.add({
      itemId: 'old',
      ts: 1,
      userInput: 'Old',
      verdict: 'wrong',
      verdictSource: 'self',
    });
    const backup = {
      formatVersion: 1,
      dbVersion: 6,
      createdAt: 1,
      tables: {
        attempts: [
          { id: 42, itemId: 'new', ts: 2, userInput: 'New', verdict: 'correct', verdictSource: 'local' },
        ],
        kv: [{ key: 'tts.rate', value: 1 }],
      },
    };

    await importDatabase(backup);
    expect(await db.attempts.toArray()).toEqual([backup.tables.attempts[0]]);
    expect(await db.kv.toArray()).toEqual(backup.tables.kv);
  });

  it('rejects malformed backups without changing the database', async () => {
    await db.kv.put({ key: 'tts.rate', value: 0.85 });

    await expect(importDatabase({ formatVersion: 2 })).rejects.toThrow(/backup format/i);
    expect(await db.kv.get('tts.rate')).toEqual({ key: 'tts.rate', value: 0.85 });
  });

  it('clears all tables on reset', async () => {
    await db.kv.put({ key: 'tts.rate', value: 0.85 });
    await db.attempts.add({
      itemId: 'item-1',
      ts: 1,
      userInput: 'It works.',
      verdict: 'correct',
      verdictSource: 'local',
    });

    await resetDatabase();
    expect(await Promise.all(db.tables.map((table) => table.count()))).toEqual(
      db.tables.map(() => 0),
    );
  });
});
