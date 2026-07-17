import { useEffect, useRef, useState } from 'react';
import { useI18nStore } from '../i18n/store';
import { useThemeStore } from '../store/theme';
import type { DictKey, Locale } from '../i18n/dictionaries';
import {
  getGeminiApiKey,
  getGigaChatCredentials,
  getGroqApiKey,
  getJudgeAutoSelfCheck,
  getLocalOpenAIProfiles,
  getOpenRouterApiKey,
  getProxyUrl,
  getRoutingConfig,
  getYandexCredentials,
  resetRoutingConfig,
  setGeminiApiKey,
  setGigaChatCredentials,
  setGroqApiKey,
  setJudgeAutoSelfCheck,
  setLocalOpenAIProfiles,
  setOpenRouterApiKey,
  setProxyUrl,
  setRoutingConfig,
  setYandexCredentials,
  type LocalOpenAIProfile,
  type RoutingConfig,
} from '../llm/settings';
import { formatLocalProviderLabel } from '../llm/localProfile';
import { validateProviderConnection, type ProviderValidationState } from '../llm/providerValidation';
import { resolveProviderById } from '../llm/registry';
import { getChainStatus, type ChipInfo } from '../llm/status';
import { PromptEditor } from '../components/PromptEditor';
import { AudioButton } from '../components/AudioButton';
import {
  getAccent,
  getAutoPlay,
  getGender,
  getKokoroEnabled,
  getRate,
  setAccent,
  setAutoPlay,
  setGender,
  setKokoroEnabled,
  setRate,
} from '../tts/settings';
import type { ModelLoadProgress } from '../tts/kokoro';
import { SPEECH_RATES, type Accent, type Gender, type SpeechRate } from '../tts/voices';
import {
  LOCAL_PROVIDER_ID,
  ROLE_ORDER,
  addProviderToRole,
  buildProviderOptions,
  moveProviderInRole,
  removeProviderFromRole,
  summarizeRoleReadiness,
  upsertLocalProfile,
} from '../llm/settingsUi';
import type { Role } from '../llm/types';
import { getLanguageToolSettings, setLanguageToolSettings } from '../languagetool/settings';
import { DataBackup } from '../components/DataBackup';

type ChainStatusMap = Record<Role, ChipInfo[]>;
type SaveActionKey = 'local' | 'proxy' | 'groq' | 'openrouter' | 'gigachat' | 'yandex' | 'routingDefaults';
type SaveActionState = 'idle' | 'saving' | 'saved';

const EMPTY_CHAIN_STATUS: ChainStatusMap = {
  judge: [],
  tutor: [],
  generator: [],
};

const EMPTY_ROLE_FEEDBACK: Record<Role, boolean> = {
  judge: false,
  tutor: false,
  generator: false,
};

const EMPTY_SAVE_ACTION_STATE: Record<SaveActionKey, SaveActionState> = {
  local: 'idle',
  proxy: 'idle',
  groq: 'idle',
  openrouter: 'idle',
  gigachat: 'idle',
  yandex: 'idle',
  routingDefaults: 'idle',
};

const PROVIDER_IDS = {
  gemini: 'gemini:flash-lite',
  local: LOCAL_PROVIDER_ID,
  groq: 'groq:llama-8b',
  openrouter: 'openrouter:free',
  gigachat: 'gigachat:pro',
  yandex: 'yandex:yandexgpt-lite',
} as const;

const ACTION_BUTTON_BASE_CLASS =
  'transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none';

function toneBadgeClass(tone: 'ready' | 'warning' | 'blocked'): string {
  switch (tone) {
    case 'ready':
      return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
    case 'warning':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
    case 'blocked':
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
  }
}

function boxToneClass(tone: 'ready' | 'warning' | 'blocked'): string {
  switch (tone) {
    case 'ready':
      return 'border-green-200 dark:border-green-900';
    case 'warning':
      return 'border-amber-200 dark:border-amber-900';
    case 'blocked':
      return 'border-red-200 dark:border-red-900';
  }
}

function statusLabelKey(status: ChipInfo['status']): DictKey {
  return `modelChip.${status === 'none' ? 'noKey' : status}`;
}

function actionButtonClass(variant: 'primary' | 'secondary' = 'secondary'): string {
  return [
    ACTION_BUTTON_BASE_CLASS,
    'rounded px-3 py-1.5 text-sm',
    variant === 'primary'
      ? 'bg-neutral-900 font-medium text-white dark:bg-neutral-100 dark:text-neutral-900'
      : 'border border-neutral-300 dark:border-neutral-700',
  ].join(' ');
}

const VOICE_PREVIEW_TEXT = 'Where did you put the keys to the car?';

type KokoroLoadState = 'idle' | 'loading' | 'ready' | 'error';

function TtsSettings(): React.ReactElement {
  const t = useI18nStore((s) => s.t);

  const [accent, setAccentState] = useState<Accent>('US');
  const [gender, setGenderState] = useState<Gender>('f');
  const [rate, setRateState] = useState<SpeechRate>(1.0);
  const [autoPlay, setAutoPlayState] = useState(true);
  const [kokoroEnabled, setKokoroEnabledState] = useState(false);
  const [loadState, setLoadState] = useState<KokoroLoadState>('idle');
  const [loadProgress, setLoadProgress] = useState<ModelLoadProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getAccent(), getGender(), getRate(), getAutoPlay(), getKokoroEnabled()]).then(
      ([a, g, r, ap, ke]) => {
        if (cancelled) return;
        setAccentState(a);
        setGenderState(g);
        setRateState(r);
        setAutoPlayState(ap);
        setKokoroEnabledState(ke);
        if (ke) setLoadState('ready');
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAccentChange(next: Accent) {
    setAccentState(next);
    await setAccent(next);
  }

  async function handleGenderChange(next: Gender) {
    setGenderState(next);
    await setGender(next);
  }

  async function handleRateChange(next: SpeechRate) {
    setRateState(next);
    await setRate(next);
  }

  async function handleAutoPlayToggle() {
    const next = !autoPlay;
    setAutoPlayState(next);
    await setAutoPlay(next);
  }

  async function handleEnableKokoro() {
    setLoadState('loading');
    setLoadProgress(null);
    try {
      const { loadKokoroModel } = await import('../tts/kokoro');
      await loadKokoroModel((p) => setLoadProgress(p));
      await setKokoroEnabled(true);
      setKokoroEnabledState(true);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }

  async function handleDisableKokoro() {
    await setKokoroEnabled(false);
    setKokoroEnabledState(false);
    setLoadState('idle');
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">{t('settings.tts.title')}</h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t('settings.tts.intro')}</p>

      <div className="mt-4 flex flex-wrap gap-4">
        <div>
          <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('settings.tts.accent')}</div>
          <div className="mt-1 flex gap-2">
            {(['US', 'UK'] as Accent[]).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={accent === a}
                onClick={() => void handleAccentChange(a)}
                className={
                  accent === a
                    ? 'rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
                }
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('settings.tts.gender')}</div>
          <div className="mt-1 flex gap-2">
            {(['f', 'm'] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={gender === g}
                onClick={() => void handleGenderChange(g)}
                className={
                  gender === g
                    ? 'rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
                }
              >
                {t(`settings.tts.gender.${g}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('settings.tts.speed')}</div>
          <div className="mt-1 flex gap-2">
            {SPEECH_RATES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={rate === r}
                onClick={() => void handleRateChange(r)}
                className={
                  rate === r
                    ? 'rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
                }
              >
                {r}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <input type="checkbox" checked={autoPlay} onChange={() => void handleAutoPlayToggle()} />
        {t('settings.tts.autoPlay')}
      </label>

      <div className="mt-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('settings.tts.kokoroTitle')}</div>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t('settings.tts.kokoroHint')}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!kokoroEnabled ? (
            <button
              type="button"
              onClick={() => void handleEnableKokoro()}
              disabled={loadState === 'loading'}
              className={actionButtonClass('primary')}
            >
              {loadState === 'loading' ? t('settings.tts.kokoroLoading') : t('settings.tts.kokoroEnable')}
            </button>
          ) : (
            <button type="button" onClick={() => void handleDisableKokoro()} className={actionButtonClass()}>
              {t('settings.tts.kokoroDisable')}
            </button>
          )}
          <AudioButton text={VOICE_PREVIEW_TEXT} label={t('settings.tts.preview')} className={actionButtonClass()} />
        </div>

        {loadState === 'loading' && loadProgress && (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {loadProgress.status}
            {typeof loadProgress.progress === 'number' ? ` — ${Math.round(loadProgress.progress)}%` : ''}
          </p>
        )}
        {loadState === 'ready' && kokoroEnabled && (
          <p className="mt-2 text-xs text-green-700 dark:text-green-400">{t('settings.tts.kokoroReady')}</p>
        )}
        {loadState === 'error' && (
          <p className="mt-2 text-xs text-red-700 dark:text-red-400">{t('settings.tts.kokoroError')}</p>
        )}
      </div>
    </div>
  );
}

function LanguageToolSettings(): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('http://localhost:8010');

  useEffect(() => {
    void getLanguageToolSettings().then((settings) => {
      setEnabled(settings.enabled);
      setUrl(settings.url);
    });
  }, []);

  const save = async (next: boolean, nextUrl = url): Promise<void> => {
    setEnabled(next);
    await setLanguageToolSettings({ enabled: next, url: nextUrl.trim() });
  };

  return (
    <section className="mt-6 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">{t('settings.languagetool.title')}</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t('settings.languagetool.hint')}</p>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={() => void save(!enabled)} />
        {t('settings.languagetool.enable')}
      </label>
      <label className="mt-3 block text-sm">
        {t('settings.languagetool.url')}
        <input value={url} onChange={(event) => setUrl(event.target.value)} onBlur={() => void save(enabled)} className="mt-1 w-full rounded border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900" />
      </label>
    </section>
  );
}

function AiModelsSettings(): React.ReactElement {
  const t = useI18nStore((s) => s.t);

  const [geminiKey, setGeminiKeyInput] = useState('');
  const [localBaseUrl, setLocalBaseUrl] = useState('http://localhost:11434/v1');
  const [localModel, setLocalModel] = useState('');
  const [autoSelfCheck, setAutoSelfCheck] = useState(false);
  const [proxyUrl, setProxyUrlInput] = useState('');
  const [groqKey, setGroqKeyInput] = useState('');
  const [openrouterKey, setOpenrouterKeyInput] = useState('');
  const [gigachatAuthKey, setGigachatAuthKeyInput] = useState('');
  const [yandexApiKey, setYandexApiKeyInput] = useState('');
  const [yandexFolderId, setYandexFolderIdInput] = useState('');

  const [routing, setRouting] = useState<RoutingConfig | null>(null);
  const [localProfiles, setLocalProfiles] = useState<LocalOpenAIProfile[]>([]);
  const [chainStatus, setChainStatus] = useState<ChainStatusMap>(EMPTY_CHAIN_STATUS);
  const [saveActionState, setSaveActionState] = useState<Record<SaveActionKey, SaveActionState>>(EMPTY_SAVE_ACTION_STATE);
  const [providerValidation, setProviderValidation] = useState<Record<string, ProviderValidationState>>({});
  const [roleFeedback, setRoleFeedback] = useState<Record<Role, boolean>>(EMPTY_ROLE_FEEDBACK);
  const resetTimersRef = useRef<number[]>([]);

  useEffect(() => {
    const timers = resetTimersRef.current;
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  function queueReset(callback: () => void, ms = 1400): void {
    const timer = window.setTimeout(callback, ms);
    resetTimersRef.current.push(timer);
  }

  function actionLabel(actionKey: SaveActionKey): string {
    const state = saveActionState[actionKey];
    if (state === 'saving') return t('settings.ai.saving');
    if (state === 'saved') return t('settings.ai.saved');
    return t('settings.ai.save');
  }

  async function runSaveAction(actionKey: SaveActionKey, action: () => Promise<void>): Promise<void> {
    setSaveActionState((state) => ({ ...state, [actionKey]: 'saving' }));
    await action();
    setSaveActionState((state) => ({ ...state, [actionKey]: 'saved' }));
    queueReset(() => {
      setSaveActionState((state) => ({ ...state, [actionKey]: 'idle' }));
    });
  }

  function flashRoleFeedback(role: Role): void {
    setRoleFeedback((state) => ({ ...state, [role]: true }));
    queueReset(() => {
      setRoleFeedback((state) => ({ ...state, [role]: false }));
    });
  }

  async function checkProviderConnection(providerId: string): Promise<void> {
    setProviderValidation((state) => ({ ...state, [providerId]: 'checking' }));
    const provider = await resolveProviderById(providerId);
    const valid = await validateProviderConnection(provider);
    setProviderValidation((state) => ({ ...state, [providerId]: valid ? 'valid' : 'invalid' }));
  }

  function connectionStatus(providerId: string): React.ReactNode {
    const state = providerValidation[providerId] ?? 'idle';
    if (state === 'idle') return null;
    if (state === 'checking') {
      return <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t('settings.ai.validating')}</p>;
    }
    if (state === 'valid') {
      return <p className="mt-2 text-sm text-green-700 dark:text-green-400">{t('settings.ai.connectionValid')}</p>;
    }
    return <p className="mt-2 text-sm text-red-700 dark:text-red-400">{t('settings.ai.connectionInvalid')}</p>;
  }

  async function refreshAiState(): Promise<void> {
    const [routingConfig, profiles, judgeChain, tutorChain, generatorChain, judgeFallback] = await Promise.all([
      getRoutingConfig(),
      getLocalOpenAIProfiles(),
      getChainStatus('judge'),
      getChainStatus('tutor'),
      getChainStatus('generator'),
      getJudgeAutoSelfCheck(),
    ]);

    setRouting(routingConfig);
    setLocalProfiles(profiles);
    setChainStatus({
      judge: judgeChain,
      tutor: tutorChain,
      generator: generatorChain,
    });
    setAutoSelfCheck(judgeFallback);
  }

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const [savedGeminiKey, savedGroqKey, savedOpenRouterKey, savedProxyUrl, savedGigaChat, savedYandex] =
        await Promise.all([
          getGeminiApiKey(),
          getGroqApiKey(),
          getOpenRouterApiKey(),
          getProxyUrl(),
          getGigaChatCredentials(),
          getYandexCredentials(),
        ]);

      if (cancelled) return;

      if (savedGeminiKey) setGeminiKeyInput(savedGeminiKey);
      if (savedGroqKey) setGroqKeyInput(savedGroqKey);
      if (savedOpenRouterKey) setOpenrouterKeyInput(savedOpenRouterKey);
      if (savedProxyUrl) setProxyUrlInput(savedProxyUrl);
      if (savedGigaChat) setGigachatAuthKeyInput(savedGigaChat.authKey);
      if (savedYandex) {
        setYandexApiKeyInput(savedYandex.apiKey);
        setYandexFolderIdInput(savedYandex.folderId);
      }

      const savedProfiles = await getLocalOpenAIProfiles();
      if (cancelled) return;
      const localProfile = savedProfiles.find((profile) => profile.id === LOCAL_PROVIDER_ID);
      if (localProfile) {
        setLocalBaseUrl(localProfile.baseUrl);
        setLocalModel(localProfile.model);
      }

      await refreshAiState();
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveGeminiKey() {
    await setGeminiApiKey(geminiKey);
    await checkProviderConnection(PROVIDER_IDS.gemini);
    await refreshAiState();
  }

  async function handleSaveLocalProfile() {
    const label = formatLocalProviderLabel({
      baseUrl: localBaseUrl,
      label: '',
      model: localModel,
    });
    await runSaveAction('local', async () => {
      const profiles = await getLocalOpenAIProfiles();
      await setLocalOpenAIProfiles(
        upsertLocalProfile(profiles, {
          id: LOCAL_PROVIDER_ID,
          label,
          baseUrl: localBaseUrl.trim(),
          model: localModel.trim(),
        }),
      );
      await refreshAiState();
      await checkProviderConnection(PROVIDER_IDS.local);
    });
  }

  async function handleToggleAutoSelfCheck() {
    const next = !autoSelfCheck;
    setAutoSelfCheck(next);
    await setJudgeAutoSelfCheck(next);
  }

  async function handleSaveRouting(nextRouting: RoutingConfig) {
    setRouting(nextRouting);
    await setRoutingConfig(nextRouting);
    await refreshAiState();
  }

  async function handleRestoreDefaults() {
    await runSaveAction('routingDefaults', async () => {
      await resetRoutingConfig();
      await refreshAiState();
    });
  }

  async function handleAddProvider(role: Role, providerId: string) {
    if (!routing) return;
    await handleSaveRouting(addProviderToRole(routing, role, providerId));
    flashRoleFeedback(role);
  }

  async function handleRemoveProvider(role: Role, providerId: string) {
    if (!routing) return;
    await handleSaveRouting(removeProviderFromRole(routing, role, providerId));
    flashRoleFeedback(role);
  }

  async function handleMoveProvider(role: Role, index: number, delta: -1 | 1) {
    if (!routing) return;
    await handleSaveRouting(moveProviderInRole(routing, role, index, delta));
    flashRoleFeedback(role);
  }

  async function handleSaveProxyUrl() {
    await runSaveAction('proxy', async () => {
      await setProxyUrl(proxyUrl);
      await refreshAiState();
    });
  }

  async function handleSaveGroqKey() {
    await runSaveAction('groq', async () => {
      await setGroqApiKey(groqKey);
      await refreshAiState();
      await checkProviderConnection(PROVIDER_IDS.groq);
    });
  }

  async function handleSaveOpenRouterKey() {
    await runSaveAction('openrouter', async () => {
      await setOpenRouterApiKey(openrouterKey);
      await refreshAiState();
      await checkProviderConnection(PROVIDER_IDS.openrouter);
    });
  }

  async function handleSaveGigaChatKey() {
    await runSaveAction('gigachat', async () => {
      await setGigaChatCredentials({ authKey: gigachatAuthKey });
      await refreshAiState();
      await checkProviderConnection(PROVIDER_IDS.gigachat);
    });
  }

  async function handleSaveYandexCredentials() {
    await runSaveAction('yandex', async () => {
      await setYandexCredentials({ apiKey: yandexApiKey, folderId: yandexFolderId });
      await refreshAiState();
      await checkProviderConnection(PROVIDER_IDS.yandex);
    });
  }

  function readinessMessage(role: Role): string {
    const readiness = summarizeRoleReadiness(chainStatus[role]);
    switch (readiness.reason) {
      case 'routeEmpty':
        return t('settings.ai.readiness.routeEmpty');
      case 'active':
        return t('settings.ai.readiness.active').replace('{MODEL}', readiness.activeLabel ?? '');
      case 'allLimited':
        return t('settings.ai.readiness.allLimited');
      case 'noConfigured':
        return t('settings.ai.readiness.noConfigured');
      case 'unreachable':
        return t('settings.ai.readiness.unreachable');
    }
  }

  const savedLocalProfile = localProfiles.find((profile) => profile.id === LOCAL_PROVIDER_ID);
  const localProviderLabel = savedLocalProfile ? formatLocalProviderLabel(savedLocalProfile) : t('settings.ai.localProviderName');
  const providerOptions = buildProviderOptions(localProviderLabel);
  const providerOptionsById = Object.fromEntries(providerOptions.map((option) => [option.id, option])) as Record<
    string,
    (typeof providerOptions)[number]
  >;

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">{t('settings.ai.title')}</h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t('settings.ai.intro')}</p>

      <div className="mt-6">
        <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">{t('settings.ai.providers.title')}</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t('settings.ai.providers.body')}</p>

        <div className="mt-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
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
              disabled={providerValidation[PROVIDER_IDS.gemini] === 'checking'}
              className={actionButtonClass('primary')}
            >
              {providerValidation[PROVIDER_IDS.gemini] === 'checking' ? t('settings.ai.validating') : t('settings.ai.save')}
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t('settings.ai.providerHint')}</p>
          {connectionStatus(PROVIDER_IDS.gemini)}
        </div>

        <div className="mt-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('settings.ai.localProviderName')}</div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t('settings.ai.localProviderHint')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <label htmlFor="local-base-url" className="sr-only">
              {t('settings.ai.localBaseUrl')}
            </label>
            <input
              id="local-base-url"
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
              disabled={saveActionState.local === 'saving'}
              className={actionButtonClass()}
            >
              {actionLabel('local')}
            </button>
          </div>
          {saveActionState.local === 'saved' && (
            <p className="mt-2 text-sm text-green-700 dark:text-green-400">{t('settings.ai.savedToRoles')}</p>
          )}
          {connectionStatus(PROVIDER_IDS.local)}
        </div>

        <div className="mt-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <label htmlFor="proxy-url" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('settings.ai.proxyUrl')}
          </label>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t('settings.ai.proxyUrlHint')}</p>
          <div className="mt-2 flex gap-2">
            <input
              id="proxy-url"
              placeholder="http://localhost:8787"
              value={proxyUrl}
              onChange={(e) => setProxyUrlInput(e.target.value)}
              className="flex-1 rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
            <button
              type="button"
              onClick={() => void handleSaveProxyUrl()}
              disabled={saveActionState.proxy === 'saving'}
              className={actionButtonClass()}
            >
              {actionLabel('proxy')}
            </button>
          </div>
          {saveActionState.proxy === 'saved' && (
            <p className="mt-2 text-sm text-green-700 dark:text-green-400">{t('settings.ai.proxySaved')}</p>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
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
                onClick={() => void handleSaveGroqKey()}
                disabled={saveActionState.groq === 'saving'}
                className={actionButtonClass()}
              >
                {actionLabel('groq')}
              </button>
            </div>
            {saveActionState.groq === 'saved' && (
              <p className="mt-2 text-sm text-green-700 dark:text-green-400">{t('settings.ai.savedToRoles')}</p>
            )}
            {connectionStatus(PROVIDER_IDS.groq)}
          </div>

          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
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
                onClick={() => void handleSaveOpenRouterKey()}
                disabled={saveActionState.openrouter === 'saving'}
                className={actionButtonClass()}
              >
                {actionLabel('openrouter')}
              </button>
            </div>
            {saveActionState.openrouter === 'saved' && (
              <p className="mt-2 text-sm text-green-700 dark:text-green-400">{t('settings.ai.savedToRoles')}</p>
            )}
            {connectionStatus(PROVIDER_IDS.openrouter)}
          </div>

          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
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
                onClick={() => void handleSaveGigaChatKey()}
                disabled={saveActionState.gigachat === 'saving'}
                className={actionButtonClass()}
              >
                {actionLabel('gigachat')}
              </button>
            </div>
            {saveActionState.gigachat === 'saved' && (
              <p className="mt-2 text-sm text-green-700 dark:text-green-400">{t('settings.ai.savedToRoles')}</p>
            )}
            {connectionStatus(PROVIDER_IDS.gigachat)}
          </div>

          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
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
                onClick={() => void handleSaveYandexCredentials()}
                disabled={saveActionState.yandex === 'saving'}
                className={actionButtonClass()}
              >
                {actionLabel('yandex')}
              </button>
            </div>
            {saveActionState.yandex === 'saved' && (
              <p className="mt-2 text-sm text-green-700 dark:text-green-400">{t('settings.ai.savedToRoles')}</p>
            )}
            {connectionStatus(PROVIDER_IDS.yandex)}
          </div>
        </div>
      </div>

      {routing && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">{t('settings.ai.routing.title')}</h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t('settings.ai.routing.body')}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleRestoreDefaults()}
              className={actionButtonClass()}
            >
              {saveActionState.routingDefaults === 'idle' ? t('settings.ai.routing.restoreDefaults') : actionLabel('routingDefaults')}
            </button>
          </div>

          <div className="mt-3 grid gap-4 xl:grid-cols-3">
            {ROLE_ORDER.map((role) => (
              <div key={role} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="font-medium text-neutral-900 dark:text-neutral-100">{t(`settings.ai.role.${role}`)}</div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t(`settings.ai.role.${role}Hint`)}</p>
                {role === 'judge' && (
                  <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {t('settings.ai.judgeBenchmarkNote')}
                  </p>
                )}

                <div className="mt-3 space-y-2">
                  {routing[role].map((providerId, index) => {
                    const info =
                      chainStatus[role].find((item) => item.id === providerId) ??
                      ({
                        id: providerId,
                        label: providerOptionsById[providerId]?.label ?? providerId,
                        status: 'unreachable',
                      } satisfies ChipInfo);

                    return (
                      <div
                        key={providerId}
                        className="flex items-center justify-between gap-3 rounded border border-neutral-200 p-2 dark:border-neutral-800"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {info.label}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">{t(statusLabelKey(info.status))}</div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => void handleMoveProvider(role, index, -1)}
                            className={`${ACTION_BUTTON_BASE_CLASS} rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-neutral-700`}
                          >
                            {t('settings.ai.routing.moveUp')}
                          </button>
                          <button
                            type="button"
                            disabled={index === routing[role].length - 1}
                            onClick={() => void handleMoveProvider(role, index, 1)}
                            className={`${ACTION_BUTTON_BASE_CLASS} rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-neutral-700`}
                          >
                            {t('settings.ai.routing.moveDown')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveProvider(role, providerId)}
                            className={`${ACTION_BUTTON_BASE_CLASS} rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700`}
                          >
                            {t('settings.ai.routing.remove')}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {routing[role].length === 0 && (
                    <div className="rounded border border-dashed border-neutral-300 p-3 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                      {t('settings.ai.routing.empty')}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    {t('settings.ai.routing.available')}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {providerOptions
                      .filter((option) => !routing[role].includes(option.id))
                      .map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => void handleAddProvider(role, option.id)}
                          className={actionButtonClass()}
                        >
                          {option.label}
                        </button>
                      ))}
                  </div>
                  {roleFeedback[role] && (
                    <p className="mt-2 text-xs text-green-700 dark:text-green-400">{t('settings.ai.routing.saved')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input type="checkbox" checked={autoSelfCheck} onChange={() => void handleToggleAutoSelfCheck()} />
            {t('settings.ai.judgeAutoSelfCheck')}
          </label>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">{t('settings.ai.readiness.title')}</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t('settings.ai.readiness.body')}</p>

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {ROLE_ORDER.map((role) => {
            const readiness = summarizeRoleReadiness(chainStatus[role]);
            return (
              <div
                key={role}
                className={`rounded-lg border p-3 ${boxToneClass(readiness.tone)} bg-white dark:bg-neutral-950`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">{t(`settings.ai.role.${role}`)}</div>
                    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {t(`settings.ai.role.${role}Hint`)}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneBadgeClass(readiness.tone)}`}>
                    {t(`settings.ai.readiness.${readiness.tone}`)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{readinessMessage(role)}</p>
                {chainStatus[role].length > 0 && (
                  <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                    {chainStatus[role].map((item) => item.label).join(' -> ')}
                  </p>
                )}
              </div>
            );
          })}
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
    <div data-testid="settings-screen" className="p-6">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{t('settings.title')}</h1>

      <div className="mt-4">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('settings.theme')}</div>
        <button
          type="button"
          onClick={toggleTheme}
          className="mt-1 rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          {theme === 'dark' ? t('settings.theme.switchToLight') : t('settings.theme.switchToDark')}
        </button>
      </div>

      <div className="mt-4">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('settings.language')}</div>
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

      <TtsSettings />
      <LanguageToolSettings />
      <AiModelsSettings />
      <DataBackup />
    </div>
  );
}
