import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import {
  FREETALK_SUMMARY_SYSTEM,
  FREETALK_SYSTEM,
  FREETALK_TOPIC_PRESETS,
  FreeTalkSummarySchema,
  MAX_FREETALK_USER_TURNS,
  appendFreeTalkMessages,
  createFreeTalkSession,
  finishFreeTalkSession,
  findUnfinishedFreeTalkSession,
  getFreeTalkTurnStatus,
  isTopicAvailableAtLevel,
  upsertErrorProfileTags,
} from './freeTalk';

beforeEach(async () => {
  await db.kv.clear();
  await db.providerBudget.clear();
  await db.freeTalkSessions.clear();
  await db.errorProfile.clear();
});

describe('FREETALK prompts (§8.6, verbatim)', () => {
  it('contains the {TOPIC}/{LEVEL} placeholders', () => {
    expect(FREETALK_SYSTEM).toContain('{LEVEL}');
    expect(FREETALK_SYSTEM).toContain('{TOPIC}');
  });

  it('summary prompt asks for the exact JSON contract', () => {
    expect(FREETALK_SUMMARY_SYSTEM).toContain('{"summary_ru":"","recurring_tags":[]}');
  });
});

describe('getFreeTalkTurnStatus (§8.9: 15-turn cap, warning 2-3 turns before)', () => {
  it('is "ok" well below the cap', () => {
    expect(getFreeTalkTurnStatus(0)).toBe('ok');
    expect(getFreeTalkTurnStatus(10)).toBe('ok');
  });

  it('warns in the last few turns before the cap', () => {
    expect(getFreeTalkTurnStatus(MAX_FREETALK_USER_TURNS - 3)).toBe('warning');
    expect(getFreeTalkTurnStatus(MAX_FREETALK_USER_TURNS - 1)).toBe('warning');
  });

  it('is "capped" at and beyond the limit', () => {
    expect(getFreeTalkTurnStatus(MAX_FREETALK_USER_TURNS)).toBe('capped');
    expect(getFreeTalkTurnStatus(MAX_FREETALK_USER_TURNS + 5)).toBe('capped');
  });
});

describe('FreeTalkSummarySchema (§8.6/§7.4-style zod contract)', () => {
  it('accepts a well-formed summary', () => {
    const result = FreeTalkSummarySchema.safeParse({
      summary_ru: 'Ты часто путаешь предлоги.',
      recurring_tags: ['preposition', 'article'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a tag outside the normative error enum', () => {
    const result = FreeTalkSummarySchema.safeParse({ summary_ru: 'x', recurring_tags: ['made_up_tag'] });
    expect(result.success).toBe(false);
  });

  it('allows an empty recurring_tags array ("nothing recurs")', () => {
    const result = FreeTalkSummarySchema.safeParse({ summary_ru: 'Всё отлично!', recurring_tags: [] });
    expect(result.success).toBe(true);
  });
});

describe('topic presets and level gating (§8.9: "спорный вопрос" not below A2)', () => {
  it('hides the controversial preset below A2', () => {
    const controversial = FREETALK_TOPIC_PRESETS.find((p) => p.id === 'controversial')!;
    expect(isTopicAvailableAtLevel(controversial, 'A1')).toBe(false);
    expect(isTopicAvailableAtLevel(controversial, 'A2')).toBe(true);
  });

  it('offers travel/work/hobbies/dailyPlans even at A1', () => {
    const a1Friendly = FREETALK_TOPIC_PRESETS.filter((p) => isTopicAvailableAtLevel(p, 'A1'));
    expect(a1Friendly.map((p) => p.id).sort()).toEqual(['dailyPlans', 'hobbies', 'travel', 'work'].sort());
  });
});

describe('Free Talk Dexie persistence (§8.9: survives a closed tab)', () => {
  it('a freshly created session is findable as "unfinished"', async () => {
    const id = await createFreeTalkSession('travel', 'A2');
    const unfinished = await findUnfinishedFreeTalkSession();
    expect(unfinished?.id).toBe(id);
    expect(unfinished?.finished).toBe(false);
  });

  it('appended messages persist and accumulate', async () => {
    const id = await createFreeTalkSession('travel', 'A2');
    await appendFreeTalkMessages(id, [{ role: 'user', content: 'Hi', ts: 1 }]);
    await appendFreeTalkMessages(id, [{ role: 'assistant', content: 'Hello!', ts: 2 }]);

    const stored = await db.freeTalkSessions.get(id);
    expect(stored?.messages).toEqual([
      { role: 'user', content: 'Hi', ts: 1 },
      { role: 'assistant', content: 'Hello!', ts: 2 },
    ]);
  });

  it('finishing a session clears it from the "unfinished" lookup and stores the summary', async () => {
    const id = await createFreeTalkSession('work', 'B1');
    await finishFreeTalkSession(id, { summary_ru: 'Молодец!', recurring_tags: ['article'] });

    const unfinished = await findUnfinishedFreeTalkSession();
    expect(unfinished).toBeUndefined();

    const stored = await db.freeTalkSessions.get(id);
    expect(stored?.finished).toBe(true);
    expect(stored?.summaryRu).toBe('Молодец!');
    expect(stored?.recurringTags).toEqual(['article']);
  });
});

describe('upsertErrorProfileTags (§10.4: recurring_tags → errorProfile)', () => {
  it('creates a new errorProfile row on first occurrence', async () => {
    await upsertErrorProfileTags(['article']);
    const row = await db.errorProfile.get('article');
    expect(row?.count30d).toBe(1);
  });

  it('increments an existing row rather than overwriting it', async () => {
    await db.errorProfile.put({ tag: 'preposition', count30d: 4, lastSeen: 1000 });
    await upsertErrorProfileTags(['preposition'], 2000);
    const row = await db.errorProfile.get('preposition');
    expect(row?.count30d).toBe(5);
    expect(row?.lastSeen).toBe(2000);
  });

  it('handles multiple recurring_tags from one summary call', async () => {
    await upsertErrorProfileTags(['article', 'preposition', 'article']);
    expect((await db.errorProfile.get('article'))?.count30d).toBe(2);
    expect((await db.errorProfile.get('preposition'))?.count30d).toBe(1);
  });
});

vi.mock('./registry', () => ({
  resolveChain: vi.fn(),
}));

describe('generateFreeTalkSummary → errorProfile end-to-end (§16 Ф3в AC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a mocked summary reply and the caller can write its recurring_tags to errorProfile', async () => {
    const { resolveChain } = await import('./registry');
    const { generateFreeTalkSummary } = await import('./freeTalk');
    const { setRoutingConfig } = await import('./settings');

    const summaryJson = JSON.stringify({
      summary_ru: 'Ты часто забываешь артикли.',
      recurring_tags: ['article'],
    });
    const provider = {
      id: 'gemini:flash',
      label: 'Gemini flash',
      isConfigured: () => true,
      chat: vi.fn().mockResolvedValue(summaryJson),
    };
    vi.mocked(resolveChain).mockResolvedValue([provider]);
    await setRoutingConfig({ judge: [], tutor: ['gemini:flash'], generator: [] });

    const result = await generateFreeTalkSummary(
      [
        { role: 'user', content: 'I go to school yesterday.', ts: 1 },
        { role: 'assistant', content: 'Nice — I went to school yesterday too!', ts: 2 },
      ],
      'A2',
    );

    expect(result?.summary.recurring_tags).toEqual(['article']);

    await upsertErrorProfileTags(result!.summary.recurring_tags);
    const row = await db.errorProfile.get('article');
    expect(row?.count30d).toBe(1);
  });

  it('accepts a plain-text fallback summary when a local model ignores the JSON contract', async () => {
    const { resolveChain } = await import('./registry');
    const { generateFreeTalkSummary } = await import('./freeTalk');
    const { setRoutingConfig } = await import('./settings');

    const provider = {
      id: 'ollama:default',
      label: 'qwen3.5-4b (localhost:1234)',
      isConfigured: () => true,
      chat: vi.fn().mockResolvedValue('Ты часто пропускаешь артикли и иногда путаешь форму глагола.'),
    };
    vi.mocked(resolveChain).mockResolvedValue([provider]);
    await setRoutingConfig({ judge: [], tutor: ['ollama:default'], generator: [] });

    const result = await generateFreeTalkSummary(
      [
        { role: 'user', content: 'I go to office yesterday.', ts: 1 },
        { role: 'assistant', content: 'Nice — I went to the office yesterday too.', ts: 2 },
      ],
      'A2',
    );

    expect(result?.summary.summary_ru).toContain('артик');
    expect(result?.summary.recurring_tags).toEqual([]);
  });

  it('extracts valid JSON from markdown fences when the provider wraps it', async () => {
    const { resolveChain } = await import('./registry');
    const { generateFreeTalkSummary } = await import('./freeTalk');
    const { setRoutingConfig } = await import('./settings');

    const provider = {
      id: 'gemini:flash',
      label: 'Gemini flash',
      isConfigured: () => true,
      chat: vi
        .fn()
        .mockResolvedValue(
          '```json\n{"summary_ru":"Ты хорошо держал тему разговора.","recurring_tags":[]}\n```',
        ),
    };
    vi.mocked(resolveChain).mockResolvedValue([provider]);
    await setRoutingConfig({ judge: [], tutor: ['gemini:flash'], generator: [] });

    const result = await generateFreeTalkSummary(
      [
        { role: 'user', content: 'I work in support.', ts: 1 },
        { role: 'assistant', content: 'That sounds interesting.', ts: 2 },
      ],
      'A2',
    );

    expect(result?.summary.summary_ru).toContain('тему разговора');
    expect(result?.summary.recurring_tags).toEqual([]);
  });
});
