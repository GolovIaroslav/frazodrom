// Exercises the benchmark harness + judge contract/cascade wiring against a
// MOCKED provider standing in for a real model. This is NOT the real §7.5
// live-model benchmark run (needs a user-owned API key — see BLOCKERS.md);
// it only proves the harness, fixtures, and zod contract work end-to-end.

import { describe, expect, it } from 'vitest';
import { runJudgeBenchmark, JUDGE_ACCURACY_GATE } from './benchmark';
import { judgeFixtures } from './judgeFixtures';
import type { LLMProvider } from './types';

function oracleProvider(): LLMProvider {
  return {
    id: 'mock:oracle',
    label: 'Mock oracle (always matches expected)',
    isConfigured: () => true,
    chat: async (req) => {
      const userMsg = req.messages[req.messages.length - 1]?.content ?? '';
      const ruLine = /^RU: "(.*)"$/m.exec(userMsg)?.[1];
      const fixture = judgeFixtures.find((f) => f.ru === ruLine);
      if (!fixture) throw new Error(`no fixture matched for ${ruLine}`);
      return JSON.stringify({
        verdict: fixture.expected,
        error_tags: [],
        explanation_ru: 'Тестовое объяснение с кириллицей.',
        corrected: fixture.refs[0],
        natural: fixture.refs[0],
        add_to_accepted: fixture.expectedAddToAccepted,
      });
    },
  };
}

function alwaysWrongProvider(): LLMProvider {
  return {
    id: 'mock:always-wrong',
    label: 'Mock (always says wrong)',
    isConfigured: () => true,
    chat: async () =>
      JSON.stringify({
        verdict: 'wrong',
        error_tags: [],
        explanation_ru: 'Тест.',
        corrected: 'x',
        natural: 'x',
        add_to_accepted: false,
      }),
  };
}

describe('judge fixtures (§7.5)', () => {
  it('has 60-100 hand-labeled cases', () => {
    expect(judgeFixtures.length).toBeGreaterThanOrEqual(60);
    expect(judgeFixtures.length).toBeLessThanOrEqual(100);
  });

  it('covers every required category', () => {
    const categories = new Set(judgeFixtures.map((f) => f.category));
    for (const c of ['article', 'preposition', 'pattern_avoided', 'bre_ame', 'minor_vs_wrong']) {
      expect(categories.has(c as never)).toBe(true);
    }
  });

  it('has unique ids', () => {
    const ids = judgeFixtures.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('runJudgeBenchmark (harness only — mocked provider, not a real model run)', () => {
  it('reports 100% accuracy for a provider that always matches the hand-labeled expectation', async () => {
    const report = await runJudgeBenchmark(oracleProvider(), judgeFixtures);
    expect(report.accuracy).toBe(1);
    expect(report.passed).toBe(judgeFixtures.length);
    expect(report.results.every((r) => r.pass)).toBe(true);
  });

  it('reports low accuracy — and would fail the 80% gate — for a bad provider', async () => {
    const report = await runJudgeBenchmark(alwaysWrongProvider(), judgeFixtures);
    expect(report.accuracy).toBeLessThan(JUDGE_ACCURACY_GATE);
  });

  it('runs against a small subset without throwing (per-category smoke check)', async () => {
    const subset = judgeFixtures.filter((f) => f.category === 'pattern_avoided');
    const report = await runJudgeBenchmark(oracleProvider(), subset);
    expect(report.total).toBe(subset.length);
    expect(report.accuracy).toBe(1);
  });
});
