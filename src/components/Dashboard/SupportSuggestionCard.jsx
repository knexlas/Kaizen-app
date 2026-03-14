import { createFromSupportSuggestion, SUPPORT_DOMAINS } from '../../services/domainSupportService';

/**
 * Gentle prompt after goal creation. Offers 2–3 optional support suggestions.
 * Framed as help, not obligations; user always in control. Garden/kaizen tone.
 */
export default function SupportSuggestionCard({ open, parentGoal, domainId, suggestions = [], onAccept, onDismiss }) {
  const resolvedDomainId = domainId ?? suggestions[0]?.domain;
  if (!open || !parentGoal || !resolvedDomainId) return null;

  const domain = SUPPORT_DOMAINS.find((d) => d.id === resolvedDomainId);

  const handleAdd = (template) => {
    const result = createFromSupportSuggestion(template, parentGoal.id);
    if (result) onAccept?.(result);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-suggestion-title"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="support-suggestion-title" className="font-serif text-lg text-stone-900 dark:text-stone-100 mb-1">
          Optional support step
        </h2>
        <p className="font-sans text-sm text-stone-600 dark:text-stone-400 mb-4">
          Add one small habit to support this goal. Optional.
        </p>
        <ul className="space-y-3 mb-5" aria-label="Support suggestions">
          {suggestions.slice(0, 3).map((s) => (
            <li key={s.id}>
              <div
                className="rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50/60 dark:bg-stone-700/30 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                role="article"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium text-stone-800 dark:text-stone-200">{s.title || s.label}</p>
                  {s.description && (
                    <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-0.5">{s.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleAdd(s)}
                  className="shrink-0 px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-moss-500/90 text-white hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-1 dark:focus:ring-offset-stone-800 transition-colors"
                  aria-label={`Add ${s.title || s.label}`}
                >
                  Add
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-2 rounded-lg font-sans text-sm font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700/50 focus:outline-none focus:ring-2 focus:ring-stone-400/30"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
