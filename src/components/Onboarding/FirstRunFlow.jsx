import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useGarden } from '../../context/GardenContext';
import { setOnboardingCompleted } from '../../services/onboardingStateService';

const STEP_WELCOME = 'welcome';
const STEP_FIRST_ACTION = 'first_action';
const STEP_NEXT_STEP = 'next_step';
const STEP_OPTIONAL_TOUR = 'optional_tour';

const transition = { type: 'tween', duration: 0.25 };

function runCelebration() {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.75 },
      colors: ['#5a7a2a', '#87a84b', '#c9d4a2', '#f5f0e6'],
    });
  } catch (_) {}
}

/**
 * Single first-run orchestrator: welcome → one tiny win → one next step → optional short tour.
 * Action-first; no long product tour before first value.
 */
export default function FirstRunFlow({ onComplete }) {
  const { addGoal, editGoal, updateUserSettings, completeMorningCheckIn } = useGarden();
  const [step, setStep] = useState(STEP_WELCOME);
  const [microWinTitle, setMicroWinTitle] = useState('');
  const [microWinGoalId, setMicroWinGoalId] = useState(null);
  const [microWinChecked, setMicroWinChecked] = useState(false);

  const uid = () => crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const handleComplete = (options = {}) => {
    const { wantsShortTour = false, startFocus = false, goalId = null } = options;
    setOnboardingCompleted(true);
    updateUserSettings({
      hasOnboarded: true,
      ...(wantsShortTour && { pendingShortTour: true }),
      ...(startFocus && goalId && { pendingStartFocus: { goalId } }),
    });
    completeMorningCheckIn(5);
    onComplete?.();
  };

  const handleMicroWinSubmit = () => {
    const title = (microWinTitle || '').trim();
    if (!title) return;
    const goalId = uid();
    const now = new Date().toISOString();
    addGoal({
      id: goalId,
      type: 'kaizen',
      title,
      estimatedMinutes: 3,
      totalMinutes: 0,
      createdAt: now,
      subtasks: [],
      milestones: [{ id: uid(), title: 'Do it now (3 min)', completed: false }],
    });
    setMicroWinGoalId(goalId);
  };

  const handleMicroWinCheckOff = () => {
    if (!microWinGoalId) return;
    editGoal(microWinGoalId, { totalMinutes: 3 });
    setMicroWinChecked(true);
    runCelebration();
  };

  const handleMicroWinNext = () => {
    setStep(STEP_NEXT_STEP);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-stone-900/40 backdrop-blur-sm overflow-y-auto safe-area-pt safe-area-pb">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg max-h-[100dvh] sm:max-h-[90vh] my-auto bg-stone-50 dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-600 shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-title"
      >
        <AnimatePresence mode="wait">
          {/* Step 1: Welcome + tone */}
          {step === STEP_WELCOME && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={transition}
              className="p-6 sm:p-8 flex flex-col justify-center min-h-[280px]"
            >
              <h1 id="first-run-title" className="font-serif text-2xl text-stone-900 dark:text-stone-100 mb-2">
                Welcome to the garden
              </h1>
              <p className="font-sans text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-6">
                One small step at a time. Let&apos;s create your first step — something you can do in about 3 minutes right now.
              </p>
              <button
                type="button"
                onClick={() => setStep(STEP_FIRST_ACTION)}
                className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
              >
                Create my first step
              </button>
            </motion.div>
          )}

          {/* Step 2: First action — one tiny win */}
          {step === STEP_FIRST_ACTION && (
            <motion.div
              key="first_action"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={transition}
              className="p-5 sm:p-8 overflow-y-auto flex-1 min-h-0"
            >
              <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100 mb-1">Your first win</h2>
              <p className="font-sans text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-6">
                Name one 3-minute task you can do <em>right now</em>. (e.g. drink water, stretch, put one thing away.)
              </p>

              {!microWinGoalId ? (
                <>
                  <label htmlFor="first-run-micro-win" className="sr-only">3-minute task</label>
                  <input
                    id="first-run-micro-win"
                    type="text"
                    value={microWinTitle}
                    onChange={(e) => setMicroWinTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleMicroWinSubmit()}
                    placeholder="e.g. Drink a glass of water"
                    className="w-full py-3 px-4 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-700 font-sans text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 mb-4"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleMicroWinSubmit}
                    disabled={!(microWinTitle || '').trim()}
                    className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    Do it now
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-xl border-2 border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700/50 p-4 mb-4">
                    <p className="font-sans text-stone-800 dark:text-stone-200 font-medium mb-3">{microWinTitle.trim()}</p>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={microWinChecked}
                        onChange={() => !microWinChecked && handleMicroWinCheckOff()}
                        className="w-5 h-5 rounded border-stone-300 text-moss-600 focus:ring-moss-500/50"
                        aria-label="I did it"
                      />
                      <span className="font-sans text-sm text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100">I did it!</span>
                    </label>
                  </div>
                  {microWinChecked && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-6 p-4 rounded-xl bg-moss-50 dark:bg-moss-900/20 border border-moss-200 dark:border-moss-700 text-center"
                    >
                      <p className="font-serif text-lg text-moss-800 dark:text-moss-200 mb-1">Nice!</p>
                      <p className="font-sans text-sm text-moss-700 dark:text-moss-300">A plant just appeared in your garden.</p>
                    </motion.div>
                  )}
                  <button
                    type="button"
                    onClick={handleMicroWinNext}
                    disabled={!microWinChecked}
                    className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    Continue
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* Step 3: One next step */}
          {step === STEP_NEXT_STEP && (
            <motion.div
              key="next_step"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={transition}
              className="p-5 sm:p-8 flex flex-col justify-center min-h-[260px]"
            >
              <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100 mb-2">You&apos;re moving</h2>
              <p className="font-sans text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-6">
                Your first step is in your garden. You can start a 5-minute focus anytime from your day view — or just explore when you&apos;re ready.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleComplete({ startFocus: true, goalId: microWinGoalId })}
                  className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
                >
                  Start 5 min focus
                </button>
                <button
                  type="button"
                  onClick={() => setStep(STEP_OPTIONAL_TOUR)}
                  className="w-full py-3 rounded-xl font-sans font-medium text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700/50 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                >
                  I&apos;ll do it later
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Optional short tour */}
          {step === STEP_OPTIONAL_TOUR && (
            <motion.div
              key="optional_tour"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={transition}
              className="p-5 sm:p-8 flex flex-col justify-center min-h-[260px]"
            >
              <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100 mb-2">Quick tour?</h2>
              <p className="font-sans text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-6">
                Want a quick tour of the garden so you know where everything lives? Completely optional — you can replay it anytime from Settings.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleComplete({ wantsShortTour: true })}
                  className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
                >
                  Show me around
                </button>
                <button
                  type="button"
                  onClick={() => handleComplete({ wantsShortTour: false })}
                  className="w-full py-3 rounded-xl font-sans font-medium text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700/50 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                >
                  I&apos;m good — go to my garden
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
