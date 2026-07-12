import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { db } from './db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(async () => {
  db.close();
});

describe('FrazodromDB — schema v6 (PLAN.md §5.3/§7.5/§8.5/§8.9/§9.1)', () => {
  it('declares every table from §5.3 plus judgeDisputes (§7.5), tutorActionCache (§8.5), freeTalkSessions (§8.9), and ttsCache (§9.1)', () => {
    const tableNames = db.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual(
      [
        'acceptedCache',
        'attempts',
        'errorProfile',
        'exams',
        'freeTalkSessions',
        'itemState',
        'judgeDisputes',
        'kv',
        'packs',
        'providerBudget',
        'sessions',
        'skillState',
        'ttsCache',
        'tutorActionCache',
      ].sort(),
    );
  });

  it('round-trips a judgeDispute record (§7.5 flag button)', async () => {
    const id = await db.judgeDisputes.add({
      itemId: 's1',
      ru: 'Он студент.',
      userAnswer: 'He are a student.',
      verdict: 'minor_error',
      model: 'gemini:flash-lite',
      ts: Date.now(),
    });
    expect(typeof id).toBe('number');
    const count = await db.judgeDisputes.count();
    expect(count).toBe(1);
  });

  it('round-trips a pack record', async () => {
    const pack = {
      schema_version: 1,
      skill: {
        id: 'a1_be_affirm',
        cefr: 'A1',
        module: 'a1_m1',
        module_title_ru: 'x',
        title_ru: 'x',
        pattern: 'x',
        theory_ru: 'x',
        common_errors: [],
        probe_item_ids: [],
        youglish_query: 'x',
      },
      items: [],
    };
    await db.packs.put({ skillId: 'a1_be_affirm', version: 1, checksum: 'abc', data: pack });
    const stored = await db.packs.get('a1_be_affirm');
    expect(stored?.data.skill.id).toBe('a1_be_affirm');
  });

  it('records an attempt with an auto-incrementing id', async () => {
    const id = await db.attempts.add({
      itemId: 's1',
      ts: Date.now(),
      userInput: 'He is a student.',
      verdict: 'correct',
      verdictSource: 'local',
    });
    expect(typeof id).toBe('number');
    const count = await db.attempts.count();
    expect(count).toBe(1);
  });

  it('tracks skill status transitions', async () => {
    await db.skillState.put({
      skillId: 'a1_be_affirm',
      status: 'in_progress',
      accuracy: 0.8,
      attemptCount: 10,
      correctCount: 8,
    });
    const state = await db.skillState.get('a1_be_affirm');
    expect(state?.status).toBe('in_progress');
  });
});

describe('FrazodromDB — upgrade from a v1-only database (PLAN.md §15)', () => {
  it('preserves existing kv data when upgrading a v1 database to v2', async () => {
    await db.delete();

    // Simulate an existing user who only ever had the Ф0 stub schema.
    const v1 = new Dexie('frazodrom');
    v1.version(1).stores({ kv: 'key' });
    await v1.open();
    await v1.table('kv').put({ key: 'locale', value: 'ru' });
    v1.close();

    // Reopening with the full v2 schema must not lose that row.
    await db.open();
    const kvRow = await db.kv.get('locale');
    expect(kvRow?.value).toBe('ru');

    const tableNames = db.tables.map((t) => t.name);
    expect(tableNames).toContain('packs');
  });
});
