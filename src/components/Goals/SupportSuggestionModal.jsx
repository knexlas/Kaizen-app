import { motion, AnimatePresence } from 'framer-motion';
import { getSupportSuggestionsForDomain, buildSupportGoal } from '../../services/goalSupportService';

/**
 * Shown after creating a goal: optional 2–3 support suggestions (habit/task) linked to the goal's domain.
 * User can add one or skip. Calm, low-pressure.
 */
export default function SupportSuggestionModal({ goal, onAddSupport, onSkip }) {
  if (!goal?.id) return null;

  const domain = goal.domain || 'body';
  const suggestions = getSupportSuggestionsForDomain(domain);

  const handleAccept = (suggestion) => {
    const supportGoal = buildSupportGoal(suggestion, goal.id, goal.title);
    onAddSupport?.(supportGoal);
    onSkip?.();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm" role="dialog" aria-labelledby="support-modal-title" aria-modal="true">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-stone-200 bg-white dark:bg-stone-800 dark:border-stone-600 shadow-xl max-w-md w-full p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="support-modal-title" className="font-serif text-stone-900 dark:text-stone-100 text-lg mb-1">
            Would you like one support habit that often helps with this?
          </h2>
          <p className="font-sans text-sm text-stone-500 dark:text-stone-400 mb-4">
            Small, optional — pick one or skip.
          </p>
          <ul className="space-y-2 mb-5">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => handleAccept(s)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800/80 hover:bg-moss-50 dark:hover:bg-moss-900/20 hover:border-moss-300 dark:hover:border-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
                >
                  <span className="font-sans font-medium text-stone-800 dark:text-stone-200 block">{s.label}</span>
                  <span className="font-sans text-xs text-stone-500 dark:text-stone-400">{s.description}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onSkip}
            className="w-full py-2.5 font-sans text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded-xl"
          >
            Skip — I’m good for now
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
