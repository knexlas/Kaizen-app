import { motion, AnimatePresence } from 'framer-motion';

/**
 * Rich toast shown after completing a task when there is a "next step" in the same milestone.
 * Offers [ Add to This Week ] and [ Leave in Vault ].
 */
export default function NextStepPrompt({ open, completedTitle, nextStep, onAddToThisWeek, onLeaveInVault }) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[101] w-[90vw] max-w-md pointer-events-auto"
        role="dialog"
        aria-labelledby="next-step-title"
        aria-describedby="next-step-desc"
      >
        <div className="px-4 py-4 rounded-xl border border-moss-200 bg-white shadow-xl">
          <h3 id="next-step-title" className="font-serif text-stone-900 text-lg mb-1">
            Great work on {completedTitle || 'that'}! 🌟
          </h3>
          <p id="next-step-desc" className="font-sans text-sm text-stone-600 mb-4">
            The next step for this milestone is <strong className="text-stone-800">{nextStep?.title ?? '—'}</strong>.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { onLeaveInVault?.(); }}
              className="px-3 py-2 rounded-lg font-sans text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200"
            >
              Leave in Vault
            </button>
            <button
              type="button"
              onClick={() => { onAddToThisWeek?.(nextStep?.taskId); onAddToThisWeek && onLeaveInVault?.(); }}
              className="px-3 py-2 rounded-lg font-sans text-sm font-medium text-white bg-moss-600 hover:bg-moss-700"
            >
              Add to This Week
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
