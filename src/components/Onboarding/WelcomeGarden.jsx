import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import SpiritBuilder from './SpiritBuilder';

const STEP_HELLO = 'hello';
const STEP_SPIRIT = 'spirit';
const STEP_SEED = 'seed';

/**
 * Welcome onboarding wizard. Shown when user has no displayName and no goals.
 * Cannot be closed until finished. Step 1: displayName. Step 2: SpiritBuilder. Step 3: first goal (routine).
 */
export default function WelcomeGarden() {
  const { userSettings, setUserSettings, initializeStarterGarden, goals } = useGarden();
  const [step, setStep] = useState(STEP_HELLO);
  const [displayName, setDisplayName] = useState(userSettings?.displayName ?? '');
  const [firstSeed, setFirstSeed] = useState('');

  const handleHelloNext = () => {
    const trimmed = (displayName || '').trim();
    if (!trimmed) return;
    setUserSettings?.({ ...(userSettings ?? {}), displayName: trimmed });
    setStep(STEP_SPIRIT);
  };

  const handleSpiritComplete = () => {
    const hasGoals = Array.isArray(goals) && goals.length > 0;
    if (hasGoals) {
      setUserSettings?.({ ...(userSettings ?? {}), hasOnboarded: true });
      return;
    }
    setStep(STEP_SEED);
  };

  const handlePlantSeed = () => {
    const title = (firstSeed || '').trim();
    if (!title) return;
    initializeStarterGarden(title);
    setUserSettings?.({ ...(userSettings ?? {}), hasOnboarded: true });
  };

  const transition = { type: 'tween', duration: 0.25 };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-stone-50 rounded-2xl border border-stone-200 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
      >
        <AnimatePresence mode="wait">
          {step === STEP_HELLO && (
            <motion.div
              key="hello"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={transition}
              className="p-8 md:p-10"
            >
              <h1 id="welcome-title" className="font-serif text-2xl md:text-3xl text-stone-900 mb-4">
                Welcome to Kaizen.
              </h1>
              <p className="font-sans text-stone-600 text-base leading-relaxed mb-8">
                Productivity often feels like a factory. We prefer a garden. Things take time to grow, and seasons change.
              </p>
              <label htmlFor="welcome-display-name" className="block font-sans text-sm font-medium text-stone-700 mb-2">
                What should we call you?
              </label>
              <input
                id="welcome-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full py-3 px-4 rounded-xl border border-stone-300 bg-white font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 mb-6"
                autoFocus
              />
              <button
                type="button"
                onClick={handleHelloNext}
                disabled={!(displayName || '').trim()}
                className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                Continue
              </button>
            </motion.div>
          )}

          {step === STEP_SPIRIT && (
            <motion.div
              key="spirit"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={transition}
              className="p-6 md:p-8"
            >
              <h2 className="font-serif text-xl text-stone-900 mb-2 text-center">The Spirit</h2>
              <p className="font-sans text-sm text-stone-500 mb-6 text-center">
                Customize your companion. They will guide you through the garden.
              </p>
              <SpiritBuilder mode="create" onComplete={handleSpiritComplete} />
            </motion.div>
          )}

          {step === STEP_SEED && (
            <motion.div
              key="seed"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={transition}
              className="p-8 md:p-10"
            >
              <h2 className="font-serif text-2xl text-stone-900 mb-4">The First Seed</h2>
              <p className="font-sans text-stone-600 text-base leading-relaxed mb-6">
                What is one thing you want to focus on this week?
              </p>
              <label htmlFor="welcome-first-seed" className="sr-only">
                One focus for this week
              </label>
              <input
                id="welcome-first-seed"
                type="text"
                value={firstSeed}
                onChange={(e) => setFirstSeed(e.target.value)}
                placeholder="e.g. Read 50 pages"
                className="w-full py-3 px-4 rounded-xl border border-stone-300 bg-white font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 mb-6"
                autoFocus
              />
              <button
                type="button"
                onClick={handlePlantSeed}
                disabled={!(firstSeed || '').trim()}
                className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:pointer-events-none transition-colors flex items-center justify-center gap-2"
              >
                <span aria-hidden>🌱</span>
                Plant Seed
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
