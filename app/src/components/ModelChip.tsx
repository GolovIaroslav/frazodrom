// PLAN.md §8.8 — header chip: model that will serve the next LLM call, with
// a popover showing every candidate's status and a link to model settings.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18nStore } from '../i18n/store';
import { getActiveModel, getChainStatus, type ChipInfo } from '../llm/status';
import { setManualOverride } from '../llm/settings';

const STATUS_ICON: Record<ChipInfo['status'], string> = {
  available: '✅',
  limited: '🔒',
  noKey: '⚠️',
  unreachable: '🔌',
  none: '🏠',
};

export function ModelChip(): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const [active, setActive] = useState<ChipInfo | null>(null);
  const [chain, setChain] = useState<ChipInfo[]>([]);
  const [open, setOpen] = useState(false);

  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getActiveModel('judge'), getChainStatus('judge')]).then(([a, c]) => {
      if (cancelled) return;
      setActive(a);
      setChain(c);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  async function pickOverride(id: string) {
    await setManualOverride(id);
    setRefreshTick((n) => n + 1);
  }

  async function clearOverride() {
    await setManualOverride(undefined);
    setRefreshTick((n) => n + 1);
  }

  const label =
    active && active.status !== 'none' ? `⚡ ${active.label}` : `🏠 ${t('modelChip.noModel')}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        {label}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded border border-neutral-300 bg-white p-2 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <ul className="space-y-1">
            {chain.map((c) => (
              <li key={c.id || c.label}>
                <button
                  type="button"
                  onClick={() => c.id && pickOverride(c.id)}
                  className="flex w-full items-center justify-between rounded px-1 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span>
                    {STATUS_ICON[c.status]} {c.label}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {t(`modelChip.${c.status === 'none' ? 'noKey' : c.status}`)}
                  </span>
                </button>
              </li>
            ))}
            {chain.length === 0 && <li className="text-neutral-500">{t('modelChip.noModel')}</li>}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-2 dark:border-neutral-800">
            <button type="button" onClick={() => void clearOverride()} className="underline">
              {t('modelChip.returnToAuto')}
            </button>
            <Link to="/settings" className="underline" onClick={() => setOpen(false)}>
              {t('modelChip.settingsLink')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

