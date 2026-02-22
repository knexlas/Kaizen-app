import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';

/** Resolve goalId from assignment (string or object). */
function getGoalId(val) {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  return val.goalId ?? val.parentGoalId ?? null;
}

/** Resolve display title from assignment and goals. */
function getTitle(val, goalId, goals) {
  if (val && typeof val === 'object' && val.title) return val.title;
  const g = (goals ?? []).find((goal) => goal.id === goalId);
  return g?.title ?? goalId ?? 'Task';
}

/**
 * Adaptive Evening Modal – "Fork in the Road."
 * Steps: intro | wind-down | night-focus | rest
 */
export default function EveningWindDown({
  open,
  onClose,
  assignments = {},
  goals = [],
  onUpdateAssignments,
  onAddLog,
  setEveningMode,
}) {
  const { addSmallJoy } = useGarden();
  const [step, setStep] = useState('intro'); // intro | wind-down | night-focus | rest
  const [gratitude, setGratitude] = useState('');
  const [selectedFocusId, setSelectedFocusId] = useState(null);

  // Normalize assignments into items with hour, val (with id, goalId, title for UI)
  const unfinishedItems = useMemo(() => {
    return Object.entries(assignments)
      .filter(([key, val]) => key !== 'anytime' && val != null)
      .map(([hour, val]) => {
        const goalId = getGoalId(val);
        const title = getTitle(val, goalId, goals);
        const id = goalId ?? `${hour}-${title}`;
        return {
          hour,
          val: { ...(typeof val === 'object' ? val : {}), id, goalId, title },
        };
      });
  }, [assignments, goals]);

  const handleDeferAll = () => {
    onUpdateAssignments?.({});
  };

  const handleNightFocus = () => {
    if (!selectedFocusId) return;
    const focusItem = unfinishedItems.find(
      (i) => i.val.id === selectedFocusId || i.val.goalId === selectedFocusId
    );
    if (!focusItem) return;
    const next = { [focusItem.hour]: assignments[focusItem.hour] };
    onUpdateAssignments?.(next);
    setEveningMode?.('night-owl');
    onClose?.();
  };

  const handleRest = () => {
    if (gratitude.trim()) {
      addSmallJoy?.(gratitude.trim());
      onAddLog?.({
        date: new Date(),
        taskTitle: 'Evening Reflection',
        minutes: 0,
        rating: 5,
        note: `Ikki no mei: ${gratitude}`,
      });
    }
    setEveningMode?.('sleep');
    setStep('rest');
  };

  const handleCloseFromRest = () => {
    setStep('intro');
    setGratitude('');
    setSelectedFocusId(null);
    onClose?.();
  };

  const handleDismiss = () => {
    setStep('intro');
    setGratitude('');
    setSelectedFocusId(null);
    onClose?.();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="relative w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        >
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
          >
            ×
          </button>
          {step === 'intro' && (
            <div className="p-8 text-center">
              <span className="text-4xl mb-4 block" aria-hidden>🌖</span>
              <h2 className="font-serif text-2xl mb-2 text-white">The sun has set.</h2>
              <p className="font-sans text-slate-400 mb-8">How is your energy right now?</p>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => setStep('wind-down')}
                  className="p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600 transition-all text-left group"
                >
                  <span className="block font-medium text-white mb-0.5">🥱 Winding Down</span>
                  <span className="text-sm text-slate-400 group-hover:text-slate-300">
                    I want to clear my mind and rest.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep('night-focus')}
                  className="p-4 rounded-xl bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/30 hover:border-indigo-400 transition-all text-left group"
                >
                  <span className="block font-medium text-indigo-200 mb-0.5">🦉 Second Wind</span>
                  <span className="text-sm text-slate-400 group-hover:text-slate-300">
                    I have energy for one deep session.
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 'wind-down' && (
            <div className="p-8">
              <h2 className="font-serif text-xl mb-4 text-white">Let go of the day.</h2>
              <p className="text-sm text-slate-400 mb-6">
                You planted {Object.keys(assignments).length} seeds today. Whatever grew is enough.
              </p>

              <label htmlFor="evening-gratitude" className="block text-sm font-medium text-slate-300 mb-2">
                Ikki no mei: What was one tiny thing you liked today?
              </label>
              <textarea
                id="evening-gratitude"
                value={gratitude}
                onChange={(e) => setGratitude(e.target.value)}
                placeholder="e.g., The smell of coffee, a warm breeze, a good song..."
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 mb-6 h-20 resize-none"
              />

              <button
                type="button"
                onClick={handleRest}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
              >
                Close the Garden
              </button>
            </div>
          )}

          {step === 'night-focus' && (
            <div className="p-8">
              <h2 className="font-serif text-xl mb-2 text-white">Night Shift.</h2>
              <p className="text-sm text-slate-400 mb-6">
                Pick <strong>ONE</strong> task. We will clear the rest so you can focus.
              </p>

              <div className="max-h-48 overflow-y-auto mb-6 space-y-2 pr-1">
                {unfinishedItems.length === 0 ? (
                  <p className="text-sm text-slate-500">No scheduled tasks left.</p>
                ) : (
                  unfinishedItems.map(({ hour, val }) => (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => setSelectedFocusId(val.id || val.goalId)}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        selectedFocusId === (val.id || val.goalId)
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-700/30 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-xs opacity-50 block">{hour}</span>
                      <span className="font-medium text-sm truncate block">{val.title}</span>
                    </button>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={handleNightFocus}
                disabled={!selectedFocusId}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                Enter Focus Mode
              </button>
            </div>
          )}

          {step === 'rest' && (
            <div className="p-12 text-center">
              <span className="text-4xl mb-4 block" aria-hidden>😴</span>
              <h2 className="font-serif text-2xl text-white mb-2">Goodnight.</h2>
              <p className="text-slate-400 mb-6">The garden is sleeping.</p>
              <button
                type="button"
                onClick={handleCloseFromRest}
                className="text-indigo-400 hover:text-indigo-300 text-sm"
              >
                Close
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
