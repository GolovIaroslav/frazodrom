import { useCallback, useState } from 'react';
import { useI18nStore } from '../i18n/store';
import {
  ACTION_REVEALS_ANSWER,
  runTutorAction,
  type TutorActionInput,
  type TutorActionKind,
} from '../llm/tutorActions';

type ActionUiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; text: string; cached: boolean };

const ACTION_ORDER: TutorActionKind[] = ['errors', 'explain', 'variants', 'nuances'];

export interface TutorPanelProps {
  input: TutorActionInput;
  /** Called once when an answer-revealing action («Ошибки»/«Разбор») returns a result — forces REWRITE (§6.1). */
  onRevealed: () => void;
}

export function TutorPanel({ input, onRevealed }: TutorPanelProps): React.ReactElement {
  const t = useI18nStore((s) => s.t);
  const [states, setStates] = useState<Record<TutorActionKind, ActionUiState>>({
    errors: { status: 'idle' },
    explain: { status: 'idle' },
    variants: { status: 'idle' },
    nuances: { status: 'idle' },
  });

  const runAction = useCallback(
    async (kind: TutorActionKind) => {
      setStates((s) => ({ ...s, [kind]: { status: 'loading' } }));
      const result = await runTutorAction(kind, input);
      if (!result) {
        setStates((s) => ({ ...s, [kind]: { status: 'error' } }));
        return;
      }
      setStates((s) => ({ ...s, [kind]: { status: 'done', text: result.text, cached: result.cached } }));
      if (ACTION_REVEALS_ANSWER[kind]) onRevealed();
    },
    [input, onRevealed],
  );

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {ACTION_ORDER.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => void runAction(kind)}
            disabled={states[kind].status === 'loading'}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100"
          >
            {t(`tutor.action.${kind}`)}
          </button>
        ))}
      </div>

      {ACTION_ORDER.map((kind) => {
        const state = states[kind];
        if (state.status === 'idle') return null;
        return (
          <div
            key={kind}
            className="mt-2 rounded bg-neutral-100 p-2 text-sm text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
          >
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t(`tutor.action.${kind}`)}
            </div>
            {state.status === 'loading' && <p>{t('tutor.action.loading')}</p>}
            {state.status === 'error' && (
              <p className="text-red-700 dark:text-red-400">{t('tutor.action.failed')}</p>
            )}
            {state.status === 'done' && (
              <p className="whitespace-pre-wrap">
                {state.text}
                {state.cached && (
                  <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {t('tutor.action.cachedNote')}
                  </span>
                )}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
