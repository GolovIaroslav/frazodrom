import Dexie, { type EntityTable } from 'dexie';
import type { SkillPack } from '../engine/types';

// PLAN.md §5.3 — full client-side schema.

export interface KvRecord {
  key: string;
  value: unknown;
}

export interface PackRecord {
  skillId: string;
  version: number;
  checksum: string;
  data: SkillPack;
}

export type SkillStatus = 'locked' | 'available' | 'in_progress' | 'passed';

// FSRS-6 (ts-fsrs) card fields, flattened onto the Dexie record (§10.1). Kept
// as a mixin so skillState/itemState declare the exact same field set — see
// `srs/fsrs.ts`'s `FsrsFields` (mirrors this shape; converts to/from `Card`).
export interface FsrsCardFields {
  due?: number;
  stability?: number;
  difficulty?: number;
  scheduledDays?: number;
  learningSteps?: number;
  reps?: number;
  lapses?: number;
  state?: number;
  lastReview?: number;
}

export interface SkillStateRecord extends FsrsCardFields {
  skillId: string;
  status: SkillStatus;
  accuracy: number;
  attemptCount: number;
  correctCount: number;
}

export interface ItemStateRecord extends FsrsCardFields {
  itemId: string;
  seenCount: number;
  failCount: number;
  isLeech: boolean;
}

export type VerdictSource = 'local' | 'cache' | 'llm' | 'self';

export interface AttemptRecord {
  id?: number;
  itemId: string;
  ts: number;
  userInput: string;
  verdict: 'correct' | 'minor_error' | 'wrong';
  verdictSource: VerdictSource;
  errorTags?: string[];
  /** Which model judged this attempt (§8.8) — undefined for local/cache tiers. */
  model?: string;
  /** Session this attempt belongs to (Phase 4) — used to detect leeches failed across DIFFERENT sessions (§10.3). */
  sessionId?: number;
}

export interface AcceptedCacheRecord {
  ruHash: string;
  entries: { en: string; source: string; ts: number }[];
}

export interface ErrorProfileRecord {
  tag: string;
  count30d: number;
  lastSeen: number;
}

/** PLAN.md §6.3 — session types the engine can build a queue for. */
export type SessionType =
  | 'drill'
  | 'review'
  | 'fluencySprint'
  | 'contrastDuel'
  | 'errorHunt'
  | 'freeTalk'
  | 'listening';

export interface SessionRecord {
  id?: number;
  type: SessionType;
  skillIds: string[];
  startedAt: number;
  finishedAt?: number;
  stats: { total: number; correct: number };
}

export interface ExamRecord {
  id?: number;
  scope: 'module' | 'level';
  scopeId: string;
  score: number;
  passed: boolean;
  ts: number;
}

export interface ProviderBudgetRecord {
  key: string; // `${providerId}:${date}`
  providerId: string;
  date: string;
  countsByRole: Record<string, number>;
}

/** PLAN.md §7.5 — "🚩 I think the AI got this wrong" flag on a judge verdict, logged locally only. */
export interface JudgeDisputeRecord {
  id?: number;
  itemId: string;
  ru: string;
  userAnswer: string;
  verdict: string;
  model: string;
  ts: number;
}

/**
 * PLAN.md §8.5 — tutor action-button cache. `key` is a composite string built
 * by `llm/tutorActions.ts`: item-only actions (Variants/Nuances) key on
 * `itemId + action + promptHash`; answer-dependent actions (Errors/Explain)
 * additionally fold in a hash of the normalized user answer. Either way, a
 * prompt edit changes promptHash and transparently invalidates old entries.
 */
export interface TutorActionCacheRecord {
  key: string;
  action: string;
  itemId: string;
  response: string;
  ts: number;
}

export interface FreeTalkMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

/**
 * PLAN.md §8.9 — Free Talk session transcript, persisted until explicitly
 * finished so a closed tab doesn't lose the conversation (or its eventual
 * summary/recurring_tags). `finished=false` + no `summaryRu` means the
 * screen should offer a resume prompt on next entry.
 */
export interface FreeTalkSessionRecord {
  id?: number;
  topic: string;
  level: string;
  messages: FreeTalkMessage[];
  startedAt: number;
  finished: boolean;
  summaryRu?: string;
  recurringTags?: string[];
}

/**
 * Retired local-TTS cache kept in the schema so old databases and backups
 * remain readable. `clearRetiredTtsData()` removes its rows on app start.
 */
export interface TtsCacheRecord {
  key: string;
  blob: Blob;
  ts: number;
}

export class FrazodromDB extends Dexie {
  kv!: EntityTable<KvRecord, 'key'>;
  packs!: EntityTable<PackRecord, 'skillId'>;
  skillState!: EntityTable<SkillStateRecord, 'skillId'>;
  itemState!: EntityTable<ItemStateRecord, 'itemId'>;
  attempts!: EntityTable<AttemptRecord, 'id'>;
  acceptedCache!: EntityTable<AcceptedCacheRecord, 'ruHash'>;
  errorProfile!: EntityTable<ErrorProfileRecord, 'tag'>;
  sessions!: EntityTable<SessionRecord, 'id'>;
  exams!: EntityTable<ExamRecord, 'id'>;
  providerBudget!: EntityTable<ProviderBudgetRecord, 'key'>;
  judgeDisputes!: EntityTable<JudgeDisputeRecord, 'id'>;
  tutorActionCache!: EntityTable<TutorActionCacheRecord, 'key'>;
  freeTalkSessions!: EntityTable<FreeTalkSessionRecord, 'id'>;
  ttsCache!: EntityTable<TtsCacheRecord, 'key'>;

  constructor() {
    super('frazodrom');
    this.version(1).stores({
      kv: 'key',
    });
    this.version(2).stores({
      kv: 'key',
      packs: 'skillId',
      skillState: 'skillId',
      itemState: 'itemId',
      attempts: '++id, itemId, ts',
      acceptedCache: 'ruHash',
      errorProfile: 'tag',
      sessions: '++id',
      exams: '++id',
      providerBudget: 'key',
    });
    this.version(3).stores({
      judgeDisputes: '++id, itemId, ts',
    });
    this.version(4).stores({
      tutorActionCache: 'key, itemId',
    });
    this.version(5).stores({
      freeTalkSessions: '++id, finished, startedAt',
    });
    this.version(6).stores({
      ttsCache: 'key, ts',
    });
  }
}

export const db = new FrazodromDB();
