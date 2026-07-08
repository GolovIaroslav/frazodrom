import { useI18nStore } from '../i18n/store';
import { useThemeStore } from '../store/theme';
import type { Locale } from '../i18n/dictionaries';

export function SettingsScreen(): React.ReactElement {
  const { t, locale, setLocale } = useI18nStore((s) => ({
    t: s.t,
    locale: s.locale,
    setLocale: s.setLocale,
  }));
  const { theme, toggleTheme } = useThemeStore((s) => ({
    theme: s.theme,
    toggleTheme: s.toggleTheme,
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        {t('settings.title')}
      </h1>

      <div className="mt-4">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('settings.theme')}
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="mt-1 rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          {theme === 'dark' ? t('settings.theme.dark') : t('settings.theme.light')}
        </button>
      </div>

      <div className="mt-4">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('settings.language')}
        </div>
        <div className="mt-1 flex gap-2">
          {(['ru', 'en'] as Locale[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              aria-pressed={locale === l}
              className={[
                'rounded border px-3 py-1.5 text-sm',
                locale === l
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                  : 'border-neutral-300 text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800',
              ].join(' ')}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
