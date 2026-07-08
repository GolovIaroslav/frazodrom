import { useEffect, useState } from 'react';
import { useI18nStore } from '../i18n/store';
import { useThemeStore } from '../store/theme';
import type { Locale } from '../i18n/dictionaries';
import {
  getGeminiApiKey,
  getGigaChatCredentials,
  getGroqApiKey,
  getJudgeAutoSelfCheck,
  getLocalOpenAIProfiles,
  getOpenRouterApiKey,
  getProxyUrl,
  getYandexCredentials,
  setGeminiApiKey,
  setGigaChatCredentials,
  setGroqApiKey,
  setJudgeAutoSelfCheck,
  setLocalOpenAIProfiles,
  setOpenRouterApiKey,
  setProxyUrl,
  setYandexCredentials,
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
  const [proxyUrl, setProxyUrlInput] = useState('');
  const [groqKey, setGroqKeyInput] = useState('');
  const [openrouterKey, setOpenrouterKeyInput] = useState('');
  const [gigachatAuthKey, setGigachatAuthKeyInput] = useState('');
  const [yandexApiKey, setYandexApiKeyInput] = useState('');
  const [yandexFolderId, setYandexFolderIdInput] = useState('');

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
    void getProxyUrl().then((v) => v && setProxyUrlInput(v));
    void getGroqApiKey().then((v) => v && setGroqKeyInput(v));
    void getOpenRouterApiKey().then((v) => v && setOpenrouterKeyInput(v));
    void getGigaChatCredentials().then((v) => v && setGigachatAuthKeyInput(v.authKey));
    void getYandexCredentials().then((v) => {
      if (v) {
        setYandexApiKeyInput(v.apiKey);
        setYandexFolderIdInput(v.folderId);
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

      <div className="mt-4">
        <label htmlFor="proxy-url" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('settings.ai.proxyUrl')}
        </label>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{t('settings.ai.proxyUrlHint')}</p>
        <div className="mt-1 flex gap-2">
          <input
            id="proxy-url"
            placeholder="http://localhost:8787"
            value={proxyUrl}
            onChange={(e) => setProxyUrlInput(e.target.value)}
            className="flex-1 rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <button
            type="button"
            onClick={() => void setProxyUrl(proxyUrl)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            {t('settings.ai.save')}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="groq-key" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('settings.ai.groqKey')}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="groq-key"
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKeyInput(e.target.value)}
              className="flex-1 rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
            <button
              type="button"
              onClick={() => void setGroqApiKey(groqKey)}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
            >
              {t('settings.ai.save')}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="openrouter-key" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('settings.ai.openrouterKey')}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="openrouter-key"
              type="password"
              value={openrouterKey}
              onChange={(e) => setOpenrouterKeyInput(e.target.value)}
              className="flex-1 rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
            <button
              type="button"
              onClick={() => void setOpenRouterApiKey(openrouterKey)}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
            >
              {t('settings.ai.save')}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="gigachat-key" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('settings.ai.gigachatAuthKey')}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="gigachat-key"
              type="password"
              value={gigachatAuthKey}
              onChange={(e) => setGigachatAuthKeyInput(e.target.value)}
              className="flex-1 rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
            <button
              type="button"
              onClick={() => void setGigaChatCredentials({ authKey: gigachatAuthKey })}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
            >
              {t('settings.ai.save')}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="yandex-key" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('settings.ai.yandexApiKey')}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="yandex-key"
              type="password"
              value={yandexApiKey}
              onChange={(e) => setYandexApiKeyInput(e.target.value)}
              className="w-1/2 rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
            <input
              placeholder={t('settings.ai.yandexFolderId')}
              value={yandexFolderId}
              onChange={(e) => setYandexFolderIdInput(e.target.value)}
              className="w-1/2 rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
            <button
              type="button"
              onClick={() => void setYandexCredentials({ apiKey: yandexApiKey, folderId: yandexFolderId })}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
            >
              {t('settings.ai.save')}
            </button>
          </div>
        </div>
      </div>

      <PromptEditor />
    </div>
  );
}

export function SettingsScreen(): React.ReactElement {
  // Separate selectors, not one object-returning selector — see the same
  // fix's comment in DrillScreen.tsx for why that pattern can spiral into
  // "Maximum update depth exceeded".
  const t = useI18nStore((s) => s.t);
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

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
