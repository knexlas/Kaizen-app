/**
 * Lightweight 3-step preference onboarding. Stores answers in userSettings; drives defaults only.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import {
  ONBOARDING_USE_CASE_OPTIONS,
  ONBOARDING_ROLE_OPTIONS,
  ONBOARDING_PRIORITY_OPTIONS,
  MAX_PRIORITIES,
  ONBOARDING_STYLE_OPTIONS,
} from '../../constants/onboardingPreferences';

const transition = { type: 'tween', duration: 0.2 };

export default function PreferenceOnboarding({ onComplete }) {
  const { updateUserSettings } = useGarden();
  const [step, setStep] = useState(1);
  const [useCase, setUseCase] = useState(null);
  const [role, setRole] = useState(null);
  const [priorities, setPriorities] = useState([]);
  const [stylePreference, setStylePreference] = useState('balanced');

  const togglePriority = (id) => {
    setPriorities((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_PRIORITIES) return prev;
      return [...prev, id];
    });
  };

  const handleFinish = () => {
    updateUserSettings({
      onboardingUseCase: useCase,
      onboardingRole: role,
      onboardingPriorities: priorities,
      gamificationIntensity: stylePreference === 'minimal' || stylePreference === 'playful' ? stylePreference : 'balanced',
      onboardingPreferencesCompleted: true,
    });
    onComplete?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-600 shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preference-onboarding-title"
      >
        <div className="px-6 pt-6 pb-2">
          <p className="font-sans text-xs text-stone-500 dark:text-stone-400">
            Step {step} of 3
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={transition}
              className="px-6 pb-6"
            >
              <h2 id="preference-onboarding-title" className="font-serif text-xl text-stone-900 dark:text-stone-100 mb-1">
                What do you mainly use this app for?
              </h2>
              <p className="font-sans text-sm text-stone-500 dark:text-stone-400 mb-4">
                Pick one — we’ll use it to tailor defaults.
              </p>
              <ul className="space-y-2">
                {ONBOARDING_USE_CASE_OPTIONS.map((opt) => (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => setUseCase(opt.id)}
                      className={`w-full text-left py-3 px-4 rounded-xl font-sans text-sm transition-colors border-2 ${
                        useCase === opt.id
                          ? 'border-moss-500 bg-moss-50 dark:bg-moss-900/20 text-stone-900 dark:text-stone-100'
                          : 'border-stone-200 dark:border-stone-600 hover:border-stone-300 dark:hover:border-stone-500 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => useCase && setStep(2)}
                disabled={!useCase}
                className="mt-5 w-full py-3 rounded-xl font-sans font-medium text-white bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                Next
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={transition}
              className="px-6 pb-6"
            >
              <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100 mb-1">
                Which best describes you?
              </h2>
              <p className="font-sans text-sm text-stone-500 dark:text-stone-400 mb-4">
                Helps us suggest the right language and shortcuts.
              </p>
              <ul className="space-y-2">
                {ONBOARDING_ROLE_OPTIONS.map((opt) => (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => setRole(opt.id)}
                      className={`w-full text-left py-3 px-4 rounded-xl font-sans text-sm transition-colors border-2 ${
                        role === opt.id
                          ? 'border-moss-500 bg-moss-50 dark:bg-moss-900/20 text-stone-900 dark:text-stone-100'
                          : 'border-stone-200 dark:border-stone-600 hover:border-stone-300 dark:hover:border-stone-500 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl font-sans font-medium text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700/50 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => role && setStep(3)}
                  disabled={!role}
                  className="flex-1 py-3 rounded-xl font-sans font-medium text-white bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  Next
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={transition}
              className="px-6 pb-6"
            >
              <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100 mb-1">
                What should the app help you with most?
              </h2>
              <p className="font-sans text-sm text-stone-500 dark:text-stone-400 mb-4">
                Pick up to {MAX_PRIORITIES}. You can change this in Settings anytime.
              </p>
              <ul className="space-y-2">
                {ONBOARDING_PRIORITY_OPTIONS.map((opt) => {
                  const selected = priorities.includes(opt.id);
                  const disabled = !selected && priorities.length >= MAX_PRIORITIES;
                  return (
                    <li key={opt.id}>
                      <button
                        type="button"
                        onClick={() => !disabled && togglePriority(opt.id)}
                        disabled={disabled}
                        className={`w-full text-left py-3 px-4 rounded-xl font-sans text-sm transition-colors border-2 flex items-center gap-3 ${
                          selected
                            ? 'border-moss-500 bg-moss-50 dark:bg-moss-900/20 text-stone-900 dark:text-stone-100'
                            : disabled
                            ? 'border-stone-100 dark:border-stone-700 text-stone-400 dark:text-stone-500 cursor-not-allowed'
                            : 'border-stone-200 dark:border-stone-600 hover:border-stone-300 dark:hover:border-stone-500 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                            selected ? 'border-moss-600 bg-moss-500 text-white' : 'border-stone-300 dark:border-stone-500'
                          }`}
                          aria-hidden
                        >
                          {selected ? '✓' : ''}
                        </span>
                        {opt.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="font-sans text-sm font-medium text-stone-700 dark:text-stone-300 mt-4 mb-2">How do you like your app to feel?</p>
              <div className="flex flex-wrap gap-2">
                {ONBOARDING_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStylePreference(opt.id)}
                    className={`py-2 px-3 rounded-lg font-sans text-sm transition-colors border-2 ${
                      stylePreference === opt.id
                        ? 'border-moss-500 bg-moss-50 dark:bg-moss-900/20 text-stone-900 dark:text-stone-100'
                        : 'border-stone-200 dark:border-stone-600 hover:border-stone-300 dark:hover:border-stone-500 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-xl font-sans font-medium text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700/50 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-1 py-3 rounded-xl font-sans font-medium text-white bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
