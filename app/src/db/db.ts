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

export interface SkillStateRecord {
  skillId: string;
  status: SkillStatus;
  accuracy: number;
  attemptCount: number;
  correctCount: number;
  // FSRS fields for the skill-level card (populated from Ф4 on).
  due?: number;
  stability?: number;
  difficulty?: number;
}

export interface ItemStateRecord {
  itemId: string;
  seenCount: number;
  failCount: number;
  isLeech: boolean;
  due?: number;
  stability?: number;
  difficulty?: number;
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

export interface SessionRecord {
  id?: number;
  type: string;
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
  }
}

export const db = new FrazodromDB();
