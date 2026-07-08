import { useEffect, useState } from 'react';
import { useI18nStore } from '../i18n/store';
import { useThemeStore } from '../store/theme';
import type { Locale } from '../i18n/dictionaries';
import {
  getGeminiApiKey,
  getJudgeAutoSelfCheck,
  getLocalOpenAIProfiles,
  setGeminiApiKey,
  setJudgeAutoSelfCheck,
  setLocalOpenAIProfiles,
} from '../llm/settings';
import { GeminiProvider } from '../llm/providers/gemini';
import { PromptEditor } from '../components/PromptEditor';

type KeyValidationState = 'idle' | 'checking' | 'valid' | 'invalid';

function AiModelsSettings(): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const [geminiKey, setGeminiKeyInput] = useState('');
  const [keyState, setKeyState] = useState<KeyValidationState>('idle');
  const [localBaseUrl, setLocalBaseUrl] = useState('http://localhost:11434/v1');
  const [localModel, setLocalModel] = useState('');
  const [autoSelfCheck, setAutoSelfCheck] = useState(false);

  useEffect(() => {
    void getGeminiApiKey().then((k) => k && setGeminiKeyInput(k));
    void getJudgeAutoSelfCheck().then(setAutoSelfCheck);
    void getLocalOpenAIProfiles().then((profiles) => {
      const p = profiles.find((x) => x.id === 'ollama:default');
      if (p) {
        setLocalBaseUrl(p.baseUrl);
        setLocalModel(p.model);
      }
    });
  }, []);

  // §8.2 — saving a cloud key triggers one test mini-call so a bad key is
  // caught immediately, not mid-drill-session.
  async function handleSaveGeminiKey() {
    await setGeminiApiKey(geminiKey);
    setKeyState('checking');
    try {
      const provider = new GeminiProvider('gemini-3.1-flash-lite');
      await provider.chat({ system: 'Reply with OK.', messages: [{ role: 'user', content: 'ping' }], maxTokens: 5 });
      setKeyState('valid');
    } catch {
      setKeyState('invalid');
    }
  }

  async function handleSaveLocalProfile() {
    await setLocalOpenAIProfiles([
      {
        id: 'ollama:default',
        label: 'Ollama',
        baseUrl: localBaseUrl,
        model: localModel,
      },
    ]);
  }

  async function handleToggleAutoSelfCheck() {
    const next = !autoSelfCheck;
    setAutoSelfCheck(next);
    await setJudgeAutoSelfCheck(next);
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
        {t('settings.ai.title')}
      </h2>

      <div className="mt-2">
        <label htmlFor="gemini-key" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('settings.ai.geminiKey')}
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="gemini-key"
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKeyInput(e.target.value)}
            className="flex-1 rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <button
            type="button"
            onClick={() => void handleSaveGeminiKey()}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            {keyState === 'checking' ? t('settings.ai.validating') : t('settings.ai.save')}
          </button>
        </div>
        {keyState === 'valid' && (
          <p className="mt-1 text-sm text-green-700 dark:text-green-400">{t('settings.ai.valid')}</p>
        )}
        {keyState === 'invalid' && (
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">{t('settings.ai.invalid')}</p>
        )}
      </div>

      <div className="mt-4">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('settings.ai.localBaseUrl')}
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            value={localBaseUrl}
            onChange={(e) => setLocalBaseUrl(e.target.value)}
            className="rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <input
            placeholder={t('settings.ai.localModel')}
            value={localModel}
            onChange={(e) => setLocalModel(e.target.value)}
            className="rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <button
            type="button"
            onClick={() => void handleSaveLocalProfile()}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            {t('settings.ai.save')}
          </button>
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <input type="checkbox" checked={autoSelfCheck} onChange={() => void handleToggleAutoSelfCheck()} />
        {t('settings.ai.judgeAutoSelfCheck')}
      </label>

      <PromptEditor />
    </div>
  );
}

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

      <AiModelsSettings />
    </div>
  );
}
