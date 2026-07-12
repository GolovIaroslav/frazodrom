import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18nStore } from '../i18n/store';
import { db } from '../db/db';
import { loadPack, loadPacksIndex } from '../engine/packs';
import { buildReviewQueue, pickReviewItems, type SkillPull } from '../engine/reviewQueue';
import { availableContrastDuels, buildContrastDuelQueue } from '../engine/contrastDuel';
import { buildListeningQueue } from '../engine/listeningQueue';
import { setPendingSession, type SessionLaunchRequest } from '../engine/sessionLaunch';
import type { PackItem, PacksIndex } from '../engine/types';
import { buildDailyPlan, type DailyPlan } from '../srs/dailyPlan';
import { getActiveLeechItemIds } from '../srs/leech';
import { suggestErrorHunt, type ErrorHuntSuggestion } from '../srs/errorHunt';
import type { MemoryTier } from '../srs/fsrs';

interface TodayData {
  plan: DailyPlan;
  errorHunt: ErrorHuntSuggestion | undefined;
  duels: [string, string][];
  packsIndex: PacksIndex | undefined;
}

async function loadTodayData(): Promise<TodayData> {
  const [skillStates, leechItemIds, errorHunt, packsIndex] = await Promise.all([
    db.skillState.toArray(),
    getActiveLeechItemIds(),
    suggestErrorHunt(),
    loadPacksIndex().catch(() => undefined as PacksIndex | undefined),
  ]);
  const plan = buildDailyPlan({
    skillStates,
    leechItemIds,
    errorHuntTags: errorHunt?.tags,
    packsIndex,
    now: new Date(),
  });
  const passedSkillIds = new Set(skillStates.filter((s) => s.status === 'passed').map((s) => s.skillId));
  const duels = availableContrastDuels(passedSkillIds);
  return { plan, errorHunt, duels, packsIndex };
}

/** §6.3 duration presets at session start: 5 min (~10 sentences, "no time" — streak-saving), 15 (standard), 25 (full). */
const SESSION_LENGTH_PRESETS = [5, 15, 25] as const;
type SessionLengthMinutes = (typeof SESSION_LENGTH_PRESETS)[number];
const PRESET_ITEM_CAP: Record<SessionLengthMinutes, number> = { 5: 10, 15: 30, 25: 50 };

/** Builds a mixed multi-skill queue (§10.1 pull selection + §10 round-robin interleave) for review/error-hunt sessions. */
async function buildMultiSkillQueue(
  skillIds: readonly string[],
  itemCap: number,
): Promise<{ items: PackItem[]; itemSkillMap: Record<string, string> }> {
  const packs = await Promise.all(skillIds.map((id) => loadPack(id)));
  const attempts = await db.attempts.toArray();
  const lastAttemptByItemId = new Map<string, number>();
  for (const a of attempts) {
    const prev = lastAttemptByItemId.get(a.itemId);
    if (prev === undefined || a.ts > prev) lastAttemptByItemId.set(a.itemId, a.ts);
  }

  const pulls: SkillPull[] = packs.map((pack, i) => ({
    skillId: skillIds[i] as string,
    items: pickReviewItems(pack.items, lastAttemptByItemId),
  }));
  const items = buildReviewQueue(pulls).slice(0, itemCap);
  const itemSkillMap: Record<string, string> = {};
  for (const pull of pulls) {
    for (const item of pull.items) itemSkillMap[item.id] = pull.skillId;
  }
  return { items, itemSkillMap };
}

/** Contrast duels stay short by design (§6.3 mixes forms, isn't a full pack drill) — 10 items per skill, same scale as a fluency-sprint round. */
const DUEL_ITEMS_PER_SKILL = 10;

async function buildDuelQueue(
  skillA: string,
  skillB: string,
): Promise<{ items: PackItem[]; itemSkillMap: Record<string, string> }> {
  const [packA, packB] = await Promise.all([loadPack(skillA), loadPack(skillB)]);
  const itemsA = packA.items.slice(0, DUEL_ITEMS_PER_SKILL);
  const itemsB = packB.items.slice(0, DUEL_ITEMS_PER_SKILL);
  const items = buildContrastDuelQueue(itemsA, itemsB);
  const itemSkillMap: Record<string, string> = {};
  for (const it of itemsA) itemSkillMap[it.id] = skillA;
  for (const it of itemsB) itemSkillMap[it.id] = skillB;
  return { items, itemSkillMap };
}

const LISTENING_ITEM_CAP = 10;

/** §9.2 — listening pulls from skills the learner has already attempted at least once. */
async function buildListeningSessionQueue(): Promise<{
  skillIds: string[];
  items: PackItem[];
  itemSkillMap: Record<string, string>;
} | null> {
  const skillStates = await db.skillState.toArray();
  const skillIds = skillStates.map((s) => s.skillId);
  if (skillIds.length === 0) return null;

  const [packs, attempts] = await Promise.all([
    Promise.all(skillIds.map((id) => loadPack(id))),
    db.attempts.toArray(),
  ]);
  const lastAttemptByItemId = new Map<string, number>();
  for (const a of attempts) {
    const prev = lastAttemptByItemId.get(a.itemId);
    if (prev === undefined || a.ts > prev) lastAttemptByItemId.set(a.itemId, a.ts);
  }

  const pulls = packs.map((pack, i) => ({ skillId: skillIds[i] as string, items: pack.items }));
  const { items, itemSkillMap } = buildListeningQueue(pulls, lastAttemptByItemId, LISTENING_ITEM_CAP);
  if (items.length === 0) return null;
  return { skillIds, items, itemSkillMap };
}

function skillTitle(packsIndex: PacksIndex | undefined, skillId: string, locale: 'ru' | 'en'): string {
  if (!packsIndex) return skillId;
  for (const level of packsIndex.levels) {
    for (const module of level.modules) {
      for (const skill of module.skills) {
        if (skill.id === skillId) return locale === 'en' ? (skill.title_en ?? skill.title_ru) : skill.title_ru;
      }
    }
  }
  return skillId;
}

export function HomeScreen(): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const locale = useI18nStore((s) => s.locale);
  const navigate = useNavigate();
  const [data, setData] = useState<TodayData | null>(null);
  const [sessionLength, setSessionLength] = useState<SessionLengthMinutes>(15);

  useEffect(() => {
    let cancelled = false;
    void loadTodayData().then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startReview = async (skillIds: readonly string[], type: 'review' | 'errorHunt') => {
    const { items, itemSkillMap } = await buildMultiSkillQueue(skillIds, PRESET_ITEM_CAP[sessionLength]);
    if (items.length === 0) return;
    setPendingSession({ type, skillIds: [...skillIds], items, itemSkillMap });
    navigate('/session');
  };

  const startDuel = async (skillA: string, skillB: string) => {
    const { items, itemSkillMap } = await buildDuelQueue(skillA, skillB);
    if (items.length === 0) return;
    setPendingSession({ type: 'contrastDuel', skillIds: [skillA, skillB], items, itemSkillMap });
    navigate('/session');
  };

  const startListening = async (mode: NonNullable<SessionLaunchRequest['listeningMode']>) => {
    const built = await buildListeningSessionQueue();
    if (!built) return;
    setPendingSession({
      type: 'listening',
      skillIds: built.skillIds,
      items: built.items,
      itemSkillMap: built.itemSkillMap,
      listeningMode: mode,
    });
    navigate('/listening');
  };

  const memoryTierLabel = (tier: MemoryTier | 'new', pct: number | undefined): string => {
    if (tier === 'new') return t('home.memoryTier.new');
    const key = `home.memoryTier.${tier}` as const;
    return pct !== undefined ? t(key).replace('{PCT}', String(pct)) : t(key).replace('{PCT}', '?');
  };

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        {t('home.title')}
      </h1>

      {!data && (
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">{t('home.loading')}</p>
      )}

      {data && (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {t('home.sessionLengthTitle')}
            </h2>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label={t('home.sessionLengthTitle')}>
              {SESSION_LENGTH_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  role="radio"
                  aria-checked={sessionLength === minutes}
                  onClick={() => setSessionLength(minutes)}
                  className={
                    sessionLength === minutes
                      ? 'rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
                  }
                >
                  {t('home.sessionLengthMinutes').replace('{N}', String(minutes))}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {t('home.dueSectionTitle')}
            </h2>
            {data.plan.dueSkills.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{t('home.dueEmpty')}</p>
            ) : (
              <>
                <ul className="mt-2 space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
                  {data.plan.dueSkills.map((s) => (
                    <li key={s.skillId} className="flex items-center justify-between">
                      <span>{s.skillId}</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-500">
                        {memoryTierLabel(s.tier, s.pct)}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => void startReview(data.plan.dueSkills.map((s) => s.skillId), 'review')}
                  className="mt-3 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:text-neutral-900"
                >
                  {t('home.reviewButton')}
                </button>
                {data.plan.overflowCount > 0 && (
                  <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
                    {t('home.overflowNote').replace('{N}', String(data.plan.overflowCount))}
                  </p>
                )}
              </>
            )}
          </section>

          {data.plan.leechItemIds.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                {t('home.leechSectionTitle')}
              </h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {t('home.leechCount').replace('{N}', String(data.plan.leechItemIds.length))}
              </p>
            </section>
          )}

          {data.errorHunt && (
            <section>
              <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                {t('home.errorHuntTitle')}
              </h2>
              <button
                type="button"
                onClick={() => data.errorHunt && void startReview(data.errorHunt.skillIds, 'errorHunt')}
                className="mt-2 rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              >
                {t('home.errorHuntButton')}
              </button>
            </section>
          )}

          {data.duels.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                {t('home.duelSectionTitle')}
              </h2>
              <ul className="mt-2 space-y-2">
                {data.duels.map(([a, b]) => (
                  <li key={`${a}-${b}`} className="flex items-center justify-between">
                    <span className="text-sm text-neutral-800 dark:text-neutral-200">
                      {skillTitle(data.packsIndex, a, locale)} ↔ {skillTitle(data.packsIndex, b, locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void startDuel(a, b)}
                      className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                    >
                      {t('home.duelButton')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {t('home.listeningSectionTitle')}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void startListening('dictation')}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              >
                {t('listening.mode.dictation')}
              </button>
              <button
                type="button"
                onClick={() => void startListening('comprehension')}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              >
                {t('listening.mode.comprehension')}
              </button>
              <button
                type="button"
                onClick={() => void startListening('dictogloss')}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              >
                {t('listening.mode.dictogloss')}
              </button>
            </div>
          </section>

          {data.plan.continueSkillId && (
            <section>
              <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                {t('home.continueTitle')}
              </h2>
              <button
                type="button"
                onClick={() => navigate(`/drill/${data.plan.continueSkillId}`)}
                className="mt-2 rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              >
                {t('home.continueButton')}
              </button>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
