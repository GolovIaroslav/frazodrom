import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18nStore } from '../i18n/store';
import { loadPacksIndex } from '../engine/packs';
import type { PacksIndex } from '../engine/types';

export function CourseMapScreen(): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const [index, setIndex] = useState<PacksIndex | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPacksIndex()
      .then((data) => {
        if (!cancelled) setIndex(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6">
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
                      {module.title_ru}
                    </h3>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {module.skills.map((skill) => (
                        <li
                          key={skill.id}
                          className="flex items-center justify-between rounded border border-neutral-200 p-3 dark:border-neutral-800"
                        >
                          <div>
                            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {skill.title_ru}
                            </div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-500">
                              {skill.count} {t('courseMap.sentenceCount')}
                            </div>
                          </div>
                          <Link
                            to={`/drill/${skill.id}`}
                            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:focus-visible:outline-neutral-100"
                          >
                            {t('courseMap.startDrill')}
                          </Link>
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
