import { useRef, useState, type ReactElement } from 'react';
import { useI18nStore } from '../i18n/store';
import { downloadBackup, exportDatabase, importDatabase, resetDatabase } from '../db/backup';

export function DataBackup(): ReactElement {
  const t = useI18nStore((s) => s.t);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport(): Promise<void> {
    const payload = await exportDatabase({ includeSecrets });
    downloadBackup(payload);
    setMessage(t('settings.data.exported'));
  }

  async function handleImport(file: File): Promise<void> {
    try {
      await importDatabase(JSON.parse(await file.text()));
      setMessage(t('settings.data.imported'));
      window.location.reload();
    } catch {
      setMessage(t('settings.data.invalid'));
    }
  }

  async function handleReset(): Promise<void> {
    if (!window.confirm(t('settings.data.resetConfirm'))) return;
    await resetDatabase();
    setMessage(t('settings.data.resetDone'));
    window.location.reload();
  }

  return (
    <section className="mt-6 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800" data-testid="data-backup">
      <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">{t('settings.data.title')}</h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t('settings.data.intro')}</p>

      <label className="mt-4 flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <input
          type="checkbox"
          checked={includeSecrets}
          onChange={(event) => setIncludeSecrets(event.target.checked)}
          data-testid="backup-include-secrets"
        />
        {t('settings.data.includeSecrets')}
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleExport()}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          data-testid="backup-export"
        >
          {t('settings.data.exportBackup')}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          data-testid="backup-import"
        >
          {t('settings.data.importBackup')}
        </button>
        <button
          type="button"
          onClick={() => void handleReset()}
          className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
          data-testid="backup-reset"
        >
          {t('settings.data.reset')}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImport(file);
          event.target.value = '';
        }}
        aria-label={t('settings.data.importBackup')}
      />

      {message && <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300" role="status">{message}</p>}
    </section>
  );
}
