import { describe, expect, it } from 'vitest';
import {
  LOCAL_PROVIDER_ID,
  addProviderToRole,
  buildProviderOptions,
  moveProviderInRole,
  removeProviderFromRole,
  summarizeRoleReadiness,
  upsertLocalProfile,
} from './settingsUi';
import type { RoutingConfig } from './settings';

const baseRouting: RoutingConfig = {
  judge: [],
  tutor: ['gemini:flash'],
  generator: [],
};

describe('settingsUi helpers', () => {
  it('builds provider options including a generic local entry', () => {
    const options = buildProviderOptions();
    expect(options.some((option) => option.id === 'gemini:flash')).toBe(true);
    expect(options.find((option) => option.id === LOCAL_PROVIDER_ID)?.label).toBe('Local OpenAI-compatible');
  });

  it('adds and removes provider ids per role without duplicates', () => {
    const withJudge = addProviderToRole(baseRouting, 'judge', 'groq:llama-8b');
    expect(withJudge.judge).toEqual(['groq:llama-8b']);

    const deduped = addProviderToRole(withJudge, 'judge', 'groq:llama-8b');
    expect(deduped.judge).toEqual(['groq:llama-8b']);

    const removed = removeProviderFromRole(deduped, 'judge', 'groq:llama-8b');
    expect(removed.judge).toEqual([]);
  });

  it('reorders providers inside one role chain', () => {
    const routing: RoutingConfig = {
      judge: ['gemini:flash', 'groq:llama-8b', LOCAL_PROVIDER_ID],
      tutor: [],
      generator: [],
    };

    const movedUp = moveProviderInRole(routing, 'judge', 1, -1);
    expect(movedUp.judge).toEqual(['groq:llama-8b', 'gemini:flash', LOCAL_PROVIDER_ID]);

    const movedDown = moveProviderInRole(movedUp, 'judge', 1, 1);
    expect(movedDown.judge).toEqual(['groq:llama-8b', LOCAL_PROVIDER_ID, 'gemini:flash']);
  });

  it('updates one local profile without deleting other profiles or advanced options', () => {
    const profiles = [
      {
        id: LOCAL_PROVIDER_ID,
        label: 'Old local model',
        baseUrl: 'http://localhost:11434/v1',
        model: 'old-model',
        timeoutMs: 30_000,
      },
      {
        id: 'ollama:secondary',
        label: 'Secondary model',
        baseUrl: 'http://localhost:11435/v1',
        model: 'secondary-model',
      },
    ];

    expect(
      upsertLocalProfile(profiles, {
        id: LOCAL_PROVIDER_ID,
        label: 'Qwen',
        baseUrl: 'http://localhost:1234/v1',
        model: 'qwen3.5-4b',
      }),
    ).toEqual([
      {
        id: LOCAL_PROVIDER_ID,
        label: 'Qwen',
        baseUrl: 'http://localhost:1234/v1',
        model: 'qwen3.5-4b',
        timeoutMs: 30_000,
      },
      profiles[1],
    ]);
  });

  it('summarizes role readiness from chain status', () => {
    expect(summarizeRoleReadiness([])).toEqual({ tone: 'blocked', reason: 'routeEmpty' });

    expect(
      summarizeRoleReadiness([{ id: 'g', label: 'Gemini', status: 'available' }]),
    ).toEqual({
      tone: 'ready',
      reason: 'active',
      activeLabel: 'Gemini',
    });

    expect(
      summarizeRoleReadiness([
        { id: 'g', label: 'Gemini', status: 'limited' },
        { id: 'o', label: 'OpenRouter', status: 'limited' },
      ]),
    ).toEqual({
      tone: 'warning',
      reason: 'allLimited',
    });

    expect(
      summarizeRoleReadiness([
        { id: 'g', label: 'Gemini', status: 'noKey' },
        { id: 'o', label: 'OpenRouter', status: 'unreachable' },
      ]),
    ).toEqual({
      tone: 'blocked',
      reason: 'noConfigured',
    });

    expect(
      summarizeRoleReadiness([{ id: LOCAL_PROVIDER_ID, label: 'Local', status: 'unreachable' }]),
    ).toEqual({
      tone: 'blocked',
      reason: 'unreachable',
    });
  });
});
