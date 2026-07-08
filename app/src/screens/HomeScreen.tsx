import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18nStore } from '../i18n/store';
import { db } from '../db/db';
import { loadPack, loadPacksIndex } from '../engine/packs';
import { buildReviewQueue, pickReviewItems, type SkillPull } from '../engine/reviewQueue';
import { setPendingSession } from '../engine/sessionLaunch';
import type { PackItem, PacksIndex } from '../engine/types';
import { buildDailyPlan, type DailyPlan } from '../srs/dailyPlan';
import { getActiveLeechItemIds } from '../srs/leech';
import { suggestErrorHunt, type ErrorHuntSuggestion } from '../srs/errorHunt';
import type { MemoryTier } from '../srs/fsrs';

interface TodayData {
  plan: DailyPlan;
  errorHunt: ErrorHuntSuggestion | undefined;
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
  return { plan, errorHunt };
}

/** Builds a mixed multi-skill queue (§10.1 pull selection + §10 round-robin interleave) for review/error-hunt sessions. */
async function buildMultiSkillQueue(
  skillIds: readonly string[],
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
  const items = buildReviewQueue(pulls);
  const itemSkillMap: Record<string, string> = {};
  for (const pull of pulls) {
    for (const item of pull.items) itemSkillMap[item.id] = pull.skillId;
  }
  return { items, itemSkillMap };
}

export function HomeScreen(): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const navigate = useNavigate();
  const [data, setData] = useState<TodayData | null>(null);

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
    const { items, itemSkillMap } = await buildMultiSkillQueue(skillIds);
    if (items.length === 0) return;
    setPendingSession({ type, skillIds: [...skillIds], items, itemSkillMap });
    navigate('/session');
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
