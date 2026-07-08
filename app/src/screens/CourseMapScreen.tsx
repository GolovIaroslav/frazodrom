import { useI18nStore } from '../i18n/store';

export function CourseMapScreen(): React.ReactElement {
  const t = useI18nStore((s) => s.t);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        {t('courseMap.title')}
      </h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        {t('courseMap.body')}
      </p>
    </div>
  );
}
