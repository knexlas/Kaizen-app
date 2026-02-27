import { motion, AnimatePresence } from 'framer-motion';

/**
 * Shown after completing a routine when a Kaizen goal or subtask is linked via Habit Stack.
 * Offers to start a 5-minute timer on the linked task.
 */
export default function HabitStackHandoffPrompt({
  open,
  routineName,
  linkedTaskTitle,
  onStart,
  onLater,
}) {
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
        aria-labelledby="habit-stack-handoff-title"
        aria-describedby="habit-stack-handoff-desc"
      >
        <div className="px-4 py-4 rounded-xl border border-moss-200 bg-white shadow-xl">
          <h3 id="habit-stack-handoff-title" className="font-serif text-stone-900 text-lg mb-1">
            Great job finishing {routineName || 'that'}! 🔗
          </h3>
          <p id="habit-stack-handoff-desc" className="font-sans text-sm text-stone-600 mb-4">
            Your Habit Stack says it&apos;s time for <strong className="text-stone-800">{linkedTaskTitle ?? 'your linked task'}</strong>. Start a 5-minute timer now?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onLater}
              className="px-3 py-2 rounded-lg font-sans text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200"
            >
              Later
            </button>
            <button
              type="button"
              onClick={onStart}
              className="px-3 py-2 rounded-lg font-sans text-sm font-medium text-white bg-moss-600 hover:bg-moss-700"
            >
              Start
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
