import Dexie, { type EntityTable } from 'dexie';

// Minimal stub schema for Ф0 — just enough to prove Dexie is wired.
// The full schema (PLAN.md §5.3) is built in a later phase.
interface KvRecord {
  key: string;
  value: unknown;
}

export class FrazodromDB extends Dexie {
  kv!: EntityTable<KvRecord, 'key'>;

  constructor() {
    super('frazodrom');
    this.version(1).stores({
      kv: 'key',
    });
  }
}

export const db = new FrazodromDB();
