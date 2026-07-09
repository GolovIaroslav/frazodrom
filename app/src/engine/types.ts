// Shapes matching packs/*.json (PLAN.md §4.8) and packs/index.json.

export interface SkillCommonError {
  tag: string;
  ru: string;
}

export interface SkillMeta {
  id: string;
  cefr: string;
  module: string;
  module_title_ru: string;
  title_ru: string;
  pattern: string;
  theory_ru: string;
  common_errors: SkillCommonError[];
  probe_item_ids: string[];
  youglish_query: string;
}

export interface PackItem {
  id: string;
  ru: string;
  en_main: string;
  en_accepted: string[];
  sub: string;
  difficulty: number;
  cefr_lex: string;
  source: string;
  attribution: string;
}

export interface SkillPack {
  schema_version: number;
  skill: SkillMeta;
  items: PackItem[];
}

export interface IndexSkillEntry {
  id: string;
  title_ru: string;
  title_en?: string;
  cefr: string;
  count: number;
  checksum: string;
}

export interface IndexModule {
  id: string;
  title_ru: string;
  title_en?: string;
  skills: IndexSkillEntry[];
}

export interface IndexLevel {
  cefr: string;
  modules: IndexModule[];
}

export interface PacksIndex {
  version: number;
  levels: IndexLevel[];
}
