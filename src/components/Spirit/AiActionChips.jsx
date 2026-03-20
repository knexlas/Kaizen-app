import { extractActionCandidate, extractOperatorActions } from '../../services/aiActionExtractor';

const FALLBACK_ACTIONS = [
  { id: 'START_FOCUS_5', label: 'Start 5-min focus' },
  { id: 'MAKE_EXECUTABLE', label: 'Make task executable' },
];

/**
 * Strong action-first chip row for assistant recommendations.
 * - `actions`: optional explicit action objects [{ id, label, payload?, tone? }]
 * - else derive operator actions from assistant text
 */
export default function AiActionChips({ assistantText, onAction, actions = null, loadingAction = null, compact = false }) {
  if (typeof onAction !== 'function') return null;

  const explicitActions = Array.isArray(actions) ? actions.filter(Boolean) : null;
  const derivedTitle = extractActionCandidate(assistantText).title;
  const derivedActions = extractOperatorActions(assistantText);
  const chips = (explicitActions && explicitActions.length > 0 ? explicitActions : derivedActions.length > 0 ? derivedActions : FALLBACK_ACTIONS)
    .slice(0, compact ? 4 : 6)
    .map((action) => ({
      ...action,
      payload: { title: derivedTitle, ...(action.payload ?? {}) },
    }));

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Assistant actions">
      {chips.map((chip) => {
        const isBusy = loadingAction != null && loadingAction === chip.id;
        const emphasisClass = chip.tone === 'primary'
          ? 'bg-moss-600 text-white border-moss-600 hover:bg-moss-700'
          : chip.tone === 'warn'
            ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700'
            : 'bg-white/90 text-stone-700 border-stone-200 hover:bg-moss-50 hover:border-moss-300 dark:bg-slate-800/80 dark:text-stone-100 dark:border-slate-600 dark:hover:bg-slate-700/80';

        return (
          <button
            key={chip.id}
            type="button"
            disabled={isBusy}
            onClick={() => onAction(chip.id, chip.payload ?? {})}
            className={`rounded-2xl border px-3 py-2 font-sans ${compact ? 'text-xs' : 'text-sm'} font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 disabled:pointer-events-none disabled:opacity-60 ${emphasisClass}`}
            title={chip.description ?? chip.label}
          >
            {isBusy ? 'Working...' : chip.label}
          </button>
        );
      })}
    </div>
  );
}
