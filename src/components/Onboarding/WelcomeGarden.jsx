import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useGarden } from '../../context/GardenContext';
import { suggestGoalStructure } from '../../services/geminiService';

const STEP_MICRO_WIN = 'micro_win';
const STEP_MAINTENANCE = 'maintenance';
const STEP_SPROUT = 'sprout';
const STEP_DONE = 'done';

const transition = { type: 'tween', duration: 0.25 };

/** Run a quick celebration (confetti) for the micro-win. */
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
 * 1-Day "Show, Don't Tell" onboarding: 3-step interactive flow + cap.
 * Step A: 3-min micro-win → check off → celebration + plant in garden.
 * Step B: One daily maintenance task (recurrence daily).
 * Step C: One major goal + AI 3 Kaizen steps.
 * Cap: "Done for today" — encourage close or relax, discourage over-planning.
 */
export default function WelcomeGarden({ onComplete }) {
  const {
    userSettings,
    setUserSettings,
    addGoal,
    editGoal,
    goals,
  } = useGarden();

  const [step, setStep] = useState(STEP_MICRO_WIN);
  const [microWinTitle, setMicroWinTitle] = useState('');
  const [microWinGoalId, setMicroWinGoalId] = useState(null);
  const [microWinChecked, setMicroWinChecked] = useState(false);
  const [maintenanceTitle, setMaintenanceTitle] = useState('');
  const [sproutTitle, setSproutTitle] = useState('');
  const [isSproutLoading, setIsSproutLoading] = useState(false);

  const uid = () => crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const handleMicroWinSubmit = () => {
    const title = (microWinTitle || '').trim();
    if (!title) return;
    const goalId = uid();
    const now = new Date().toISOString();
    addGoal({
      id: goalId,
      type: 'kaizen',
      title: title,
      estimatedMinutes: 3,
      totalMinutes: 0,
      createdAt: now,
      subtasks: [],
      milestones: [{ id: uid(), title: `Do it now (3 min)`, completed: false }],
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
    setStep(STEP_MAINTENANCE);
  };

  const handleMaintenanceSubmit = () => {
    const title = (maintenanceTitle || '').trim();
    if (!title) return;
    const now = new Date().toISOString();
    addGoal({
      id: uid(),
      type: 'routine',
      title: title,
      category: 'Care & Hygiene',
      estimatedMinutes: 5,
      totalMinutes: 0,
      createdAt: now,
      recurrence: { type: 'daily' },
      rituals: [
        { id: uid(), title: title, days: [0, 1, 2, 3, 4, 5, 6], frequency: 'weekly', monthDay: null },
      ],
    });
    setStep(STEP_SPROUT);
  };

  const handleSproutSubmit = async () => {
    const title = (sproutTitle || '').trim();
    if (!title) return;
    setIsSproutLoading(true);
    try {
      const aiStructure = await suggestGoalStructure(title, 'kaizen', null, null, 'beginner');
      const now = new Date().toISOString();
      const vines = Array.isArray(aiStructure?.vines) ? aiStructure.vines : [];
      const threeSteps = vines.slice(0, 3).map((v) => ({
        id: uid(),
        title: typeof v === 'string' ? v : (v?.title ?? 'Step'),
        estimatedHours: 0.1,
        completedHours: 0,
      }));
      if (threeSteps.length === 0) threeSteps.push({ id: uid(), title: 'First 5-minute step', estimatedHours: 0.1, completedHours: 0 });

      addGoal({
        id: uid(),
        type: 'kaizen',
        title: title,
        estimatedMinutes: aiStructure?.estimatedMinutes ?? 15,
        targetHours: aiStructure?.targetHours ?? 2,
        totalMinutes: 0,
        createdAt: now,
        subtasks: threeSteps,
        milestones: (aiStructure?.milestones?.length ? aiStructure.milestones.slice(0, 4) : []).map((m) => ({
          id: uid(),
          title: typeof m === 'string' ? m : (m?.title ?? ''),
          completed: false,
        })),
        rituals: (aiStructure?.rituals?.length ? aiStructure.rituals : []).map((r) => ({ ...r, id: uid() })),
      });
    } catch (_) {
      addGoal({
        id: uid(),
        type: 'kaizen',
        title: title,
        estimatedMinutes: 15,
        targetHours: 2,
        totalMinutes: 0,
        createdAt: new Date().toISOString(),
        subtasks: [
          { id: uid(), title: 'First 5-minute step', estimatedHours: 0.1, completedHours: 0 },
          { id: uid(), title: 'Second small step', estimatedHours: 0.1, completedHours: 0 },
          { id: uid(), title: 'Third step', estimatedHours: 0.1, completedHours: 0 },
        ],
        milestones: [],
        rituals: [],
      });
    } finally {
      setIsSproutLoading(false);
      setStep(STEP_DONE);
    }
  };

  const handleFinishOnboarding = () => {
    setUserSettings?.({ ...(userSettings ?? {}), hasOnboarded: true });
    onComplete?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-stone-900/40 backdrop-blur-sm overflow-y-auto safe-area-pt safe-area-pb">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg max-h-[100dvh] sm:max-h-[90vh] my-auto bg-stone-50 rounded-2xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <AnimatePresence mode="wait">
          {/* ——— Step A: The Micro-Win ——— */}
          {step === STEP_MICRO_WIN && (
            <motion.div
              key="micro_win"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={transition}
              className="p-5 sm:p-8 overflow-y-auto flex-1 min-h-0"
            >
              <h1 id="onboarding-title" className="font-serif text-2xl text-stone-900 mb-1">
                Your first win
              </h1>
              <p className="font-sans text-stone-500 text-xs mb-2">Step 1 of 3</p>
              <p className="font-sans text-stone-600 text-sm leading-relaxed mb-6">
                Name one 3-minute task you can do <em>right now</em>. (e.g. drink a glass of water, stretch, put one thing away.)
              </p>

              {!microWinGoalId ? (
                <>
                  <label htmlFor="onboarding-micro-win" className="sr-only">3-minute task</label>
                  <input
                    id="onboarding-micro-win"
                    type="text"
                    value={microWinTitle}
                    onChange={(e) => setMicroWinTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleMicroWinSubmit()}
                    placeholder="e.g. Drink a glass of water"
                    className="w-full py-3 px-4 rounded-xl border border-stone-300 bg-white font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 mb-4"
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
                  <div className="rounded-xl border-2 border-stone-200 bg-white p-4 mb-4">
                    <p className="font-sans text-stone-800 font-medium mb-3">{microWinTitle.trim()}</p>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={microWinChecked}
                        onChange={() => !microWinChecked && handleMicroWinCheckOff()}
                        className="w-5 h-5 rounded border-stone-300 text-moss-600 focus:ring-moss-500/50"
                        aria-label="I did it"
                      />
                      <span className="font-sans text-sm text-stone-700 group-hover:text-stone-900">I did it!</span>
                    </label>
                  </div>
                  {microWinChecked && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-6 p-4 rounded-xl bg-moss-50 border border-moss-200 text-center"
                    >
                      <p className="font-serif text-lg text-moss-800 mb-1">🌟 Nice!</p>
                      <p className="font-sans text-sm text-moss-700">A plant just appeared in your garden. You’re already moving.</p>
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

          {/* ——— Step B: The Root (one daily maintenance) ——— */}
          {step === STEP_MAINTENANCE && (
            <motion.div
              key="maintenance"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={transition}
              className="p-5 sm:p-8 overflow-y-auto flex-1 min-h-0"
            >
              <h2 className="font-serif text-2xl text-stone-900 mb-1">One daily habit</h2>
              <p className="font-sans text-stone-500 text-xs mb-2">Step 2 of 3</p>
              <p className="font-sans text-stone-600 text-sm leading-relaxed mb-6">
                What’s one thing you do (or want to do) every day to keep life running? We’ll add it as a daily rhythm.
              </p>
              <label htmlFor="onboarding-maintenance" className="sr-only">Daily maintenance task</label>
              <input
                id="onboarding-maintenance"
                type="text"
                value={maintenanceTitle}
                onChange={(e) => setMaintenanceTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMaintenanceSubmit()}
                placeholder="e.g. Take meds, Do the dishes, Water plants"
                className="w-full py-3 px-4 rounded-xl border border-stone-300 bg-white font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 mb-6"
                autoFocus
              />
              <button
                type="button"
                onClick={handleMaintenanceSubmit}
                disabled={!(maintenanceTitle || '').trim()}
                className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                Add daily habit
              </button>
            </motion.div>
          )}

          {/* ——— Step C: The Sprout (one major goal + AI steps) ——— */}
          {step === STEP_SPROUT && (
            <motion.div
              key="sprout"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={transition}
              className="p-5 sm:p-8 overflow-y-auto flex-1 min-h-0"
            >
              <h2 className="font-serif text-2xl text-stone-900 mb-1">One big goal</h2>
              <p className="font-sans text-stone-500 text-xs mb-2">Step 3 of 3</p>
              <p className="font-sans text-stone-600 text-sm leading-relaxed mb-6">
                What’s one thing you want to grow toward? Mochi will suggest 3 tiny Kaizen steps to get started.
              </p>
              <label htmlFor="onboarding-sprout" className="sr-only">Major goal</label>
              <input
                id="onboarding-sprout"
                type="text"
                value={sproutTitle}
                onChange={(e) => setSproutTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isSproutLoading && handleSproutSubmit()}
                placeholder="e.g. Learn Spanish, Run 5k, Read more"
                className="w-full py-3 px-4 rounded-xl border border-stone-300 bg-white font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 mb-6"
                autoFocus
                disabled={isSproutLoading}
              />
              <button
                type="button"
                onClick={handleSproutSubmit}
                disabled={!(sproutTitle || '').trim() || isSproutLoading}
                className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:pointer-events-none transition-colors flex items-center justify-center gap-2"
              >
                {isSproutLoading ? (
                  <>✨ Mochi is suggesting 3 steps...</>
                ) : (
                  <>🌱 Plant this goal</>
                )}
              </button>
            </motion.div>
          )}

          {/* ——— Cap: Done for today ——— */}
          {step === STEP_DONE && (
            <motion.div
              key="done"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={transition}
              className="p-5 sm:p-8 overflow-y-auto flex-1 min-h-0 flex flex-col justify-center text-center"
            >
              <h2 className="font-serif text-2xl text-stone-900 mb-3">Done for today</h2>
              <p className="font-sans text-stone-600 text-sm leading-relaxed mb-6 max-w-sm mx-auto">
                You’ve got your first win, a daily habit, and a goal with tiny steps. That’s enough for day one.
              </p>
              <p className="font-sans text-stone-500 text-sm mb-4">
                Close the app and come back tomorrow, or spend a moment in your garden. We’re not about over-planning — just one step at a time.
              </p>
              <p className="font-sans text-stone-400 text-xs mb-8">
                Next, I’ll show you around the garden so you know where everything lives.
              </p>
              <button
                type="button"
                onClick={handleFinishOnboarding}
                className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
              >
                Explore my garden
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
