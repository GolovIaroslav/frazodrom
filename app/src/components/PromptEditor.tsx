import { useEffect, useState } from 'react';
import { useI18nStore } from '../i18n/store';
import { fnv1aHash } from '../llm/hash';
import {
  clearPromptOverride,
  getPromptOverride,
  getPromptOverrideDefaultHash,
  setPromptOverride,
  setPromptOverrideDefaultHash,
} from '../llm/settings';
import { EDITABLE_PROMPT_NAMES, JSON_ROLE_PROMPTS, PROMPT_DEFAULTS } from '../llm/prompts';
import { smokeTestJudgePrompt } from '../llm/promptSmokeTest';

type SmokeUiState = 'idle' | 'testing' | 'ok' | 'invalid' | 'no-provider';

function PromptRow({ name }: { name: (typeof EDITABLE_PROMPT_NAMES)[number] }): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const defaultText = PROMPT_DEFAULTS[name];
  const isJsonRole = JSON_ROLE_PROMPTS.includes(name);

  const [text, setText] = useState(defaultText);
  const [defaultUpdated, setDefaultUpdated] = useState(false);
  const [smoke, setSmoke] = useState<SmokeUiState>('idle');

  useEffect(() => {
    void (async () => {
      const [override, savedDefaultHash] = await Promise.all([
        getPromptOverride(name),
        getPromptOverrideDefaultHash(name),
      ]);
      setText(override ?? defaultText);
      if (savedDefaultHash && savedDefaultHash !== fnv1aHash(defaultText)) setDefaultUpdated(true);
    })();
    // Only re-run if the prompt name changes — defaultText is a module-level constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  async function handleSave() {
    await setPromptOverride(name, text);
    await setPromptOverrideDefaultHash(name, fnv1aHash(defaultText));
    setDefaultUpdated(false);
    if (isJsonRole) {
      setSmoke('testing');
      const result = await smokeTestJudgePrompt(text);
      setSmoke(result.outcome);
    }
  }

  async function handleReset() {
    await clearPromptOverride(name);
    setText(defaultText);
    setDefaultUpdated(false);
    setSmoke('idle');
  }

  return (
    <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{name}</span>
        {defaultUpdated && (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            {t('settings.ai.prompts.defaultUpdated')}
          </span>
        )}
      </div>
      {isJsonRole && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t('settings.ai.prompts.jsonWarning')}</p>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        className="mt-2 w-full rounded border border-neutral-300 p-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          {t('settings.ai.prompts.save')}
        </button>
        <button
          type="button"
          onClick={() => void handleReset()}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          {t('settings.ai.prompts.reset')}
        </button>
        {smoke === 'testing' && (
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {t('settings.ai.prompts.smokeTesting')}
          </span>
        )}
        {smoke === 'ok' && (
          <span className="text-sm text-green-700 dark:text-green-400">{t('settings.ai.prompts.smokeOk')}</span>
        )}
        {smoke === 'invalid' && (
          <span className="text-sm text-red-700 dark:text-red-400">{t('settings.ai.prompts.smokeInvalid')}</span>
        )}
        {smoke === 'no-provider' && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('settings.ai.prompts.smokeNoProvider')}
          </span>
        )}
      </div>
    </div>
  );
}

export function PromptEditor(): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
        {t('settings.ai.prompts.title')}
      </h2>
      {EDITABLE_PROMPT_NAMES.map((name) => (
        <PromptRow key={name} name={name} />
      ))}
    </div>
  );
}
