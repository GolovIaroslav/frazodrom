// PLAN.md §7.5 — judge mini-benchmark harness. Takes a provider and the
// hand-labeled fixture cases and reports per-case pass/fail + accuracy.
//
// This is infrastructure only: running it against a REAL model and recording
// the accuracy in PLAN.md's log is a separate, human-gated step (needs a
// live, user-owned API key — see BLOCKERS.md). Do not treat a run against a
// mocked/fake provider as that step.

import type { LLMProvider } from './types';
import { callJudge } from './judge';
import type { JudgeFixtureCase } from './judgeFixtures';

export interface BenchmarkCaseResult {
  id: string;
  pass: boolean;
  expected: string;
  actual?: string;
  error?: string;
}

export interface BenchmarkReport {
  providerId: string;
  total: number;
  passed: number;
  accuracy: number; // 0..1
  results: BenchmarkCaseResult[];
}

export async function runJudgeBenchmark(
  provider: LLMProvider,
  cases: readonly JudgeFixtureCase[],
  uiLang: 'ru' | 'en' = 'ru',
): Promise<BenchmarkReport> {
  const results: BenchmarkCaseResult[] = [];

  for (const c of cases) {
    try {
      const verdict = await callJudge(provider, {
        ru: c.ru,
        userAnswer: c.userAnswer,
        refs: c.refs,
        pattern: c.pattern,
        level: c.level,
        uiLang,
      });
      results.push({
        id: c.id,
        pass: verdict.verdict === c.expected,
        expected: c.expected,
        actual: verdict.verdict,
      });
    } catch (err) {
      results.push({
        id: c.id,
        pass: false,
        expected: c.expected,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const passed = results.filter((r) => r.pass).length;
  return {
    providerId: provider.id,
    total: results.length,
    passed,
    accuracy: results.length === 0 ? 0 : passed / results.length,
    results,
  };
}

/** §7.5 — a candidate model under 80% accuracy must not become the default judge. */
export const JUDGE_ACCURACY_GATE = 0.8;
