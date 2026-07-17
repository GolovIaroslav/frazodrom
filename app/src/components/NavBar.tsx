import { NavLink } from 'react-router-dom';
import { useI18nStore } from '../i18n/store';
import { ModelChip } from './ModelChip';

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  [
    'rounded px-3 py-2 text-sm font-medium',
    isActive
      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
      : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
  ].join(' ');

export function NavBar(): React.ReactElement {
  const t = useI18nStore((s) => s.t);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        <NavLink to="/" end className={linkClass}>
          {t('nav.home')}
        </NavLink>
        <NavLink to="/course-map" className={linkClass}>
          {t('nav.courseMap')}
        </NavLink>
        <NavLink to="/free-talk" className={linkClass}>
          {t('nav.freeTalk')}
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          {t('nav.settings')}
        </NavLink>
      </div>
      <ModelChip />
    </nav>
  );
}
