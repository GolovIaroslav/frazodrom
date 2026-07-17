import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18nStore } from '../i18n/store';
import { loadPack, loadPacksIndex } from '../engine/packs';
import type { PacksIndex } from '../engine/types';
import { db } from '../db/db';
import { memoryTier, retrievability, type MemoryTier } from '../srs/fsrs';
import { canStartFluencySprint } from '../engine/fluencySprint';
import { setPendingSession } from '../engine/sessionLaunch';

export function CourseMapScreen(): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const locale = useI18nStore((s) => s.locale);
  const navigate = useNavigate();
  const [index, setIndex] = useState<PacksIndex | null>(null);
  const [error, setError] = useState(false);
  const [memoryBySkill, setMemoryBySkill] = useState<Map<string, { pct: number; tier: MemoryTier }>>(new Map());
  const [sprintEligible, setSprintEligible] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    loadPacksIndex()
      .then((data) => {
        if (!cancelled) setIndex(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    void db.skillState.toArray().then((states) => {
      if (cancelled) return;
      const now = new Date();
      const map = new Map<string, { pct: number; tier: MemoryTier }>();
      const eligible = new Set<string>();
      for (const state of states) {
        if (canStartFluencySprint(state.accuracy)) eligible.add(state.skillId);
        const r = retrievability(state, now);
        if (r === undefined) continue;
        const pct = Math.round(r * 100);
        map.set(state.skillId, { pct, tier: memoryTier(pct) });
      }
      setMemoryBySkill(map);
      setSprintEligible(eligible);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const localize = (ru: string, en?: string): string => {
    if (locale === 'en') return en ?? ru;
    return ru;
  };

  const startSprint = async (skillId: string): Promise<void> => {
    const pack = await loadPack(skillId);
    setPendingSession({
      type: 'fluencySprint',
      skillIds: [skillId],
      items: pack.items,
      itemSkillMap: Object.fromEntries(pack.items.map((it) => [it.id, skillId])),
    });
    navigate('/sprint');
  };

  const openContextTool = async (skillId: string, tool: 'youglish' | 'reverso'): Promise<void> => {
    const pack = await loadPack(skillId);
    const query = tool === 'youglish' ? pack.skill.youglish_query : pack.skill.pattern;
    const base = tool === 'youglish' ? 'https://youglish.com/pronounce/' : 'https://context.reverso.net/translation/english-russian/';
    window.open(`${base}${encodeURIComponent(query)}${tool === 'youglish' ? '/english' : ''}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div data-testid="course-map-screen" className="p-6">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        {t('courseMap.title')}
      </h1>

      {error && (
        <p className="mt-4 text-red-600 dark:text-red-400">{t('courseMap.error')}</p>
      )}
      {!error && !index && (
        <p className="mt-4 text-neutral-600 dark:text-neutral-400">{t('courseMap.loading')}</p>
      )}

      {index && (
        <div className="mt-6 space-y-8">
          {index.levels.map((level) => (
            <section key={level.cefr}>
              <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                {level.cefr}
              </h2>
              <div className="mt-3 space-y-4">
                {level.modules.map((module) => (
                  <div key={module.id}>
                    <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      {localize(module.title_ru, module.title_en)}
                    </h3>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {module.skills.map((skill) => (
                        <li
                          key={skill.id}
                          className="flex flex-wrap items-center gap-3 rounded border border-neutral-200 p-3 dark:border-neutral-800"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {localize(skill.title_ru, skill.title_en)}
                            </div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-500">
                              {skill.count} {t('courseMap.sentenceCount')}
                            </div>
                            {(() => {
                              const memory = memoryBySkill.get(skill.id);
                              if (!memory) return null;
                              return (
                                <div className="text-xs text-neutral-500 dark:text-neutral-500">
                                  {t(`courseMap.memoryTier.${memory.tier}`).replace('{PCT}', String(memory.pct))}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">
                            <button
                              type="button"
                              onClick={() => void openContextTool(skill.id, 'youglish')}
                              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                            >
                              {t('courseMap.youglish')}
                            </button>
                            <button
                              type="button"
                              onClick={() => void openContextTool(skill.id, 'reverso')}
                              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                            >
                              {t('courseMap.reverso')}
                            </button>
                            {sprintEligible.has(skill.id) && (
                              <button
                                type="button"
                                onClick={() => void startSprint(skill.id)}
                                className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                              >
                                {t('courseMap.startSprint')}
                              </button>
                            )}
                            <Link
                              to={`/drill/${skill.id}`}
                              className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:focus-visible:outline-neutral-100"
                            >
                              {t('courseMap.startDrill')}
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
