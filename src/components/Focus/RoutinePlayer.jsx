import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { vibrateShort } from '../../utils/vibration';

const CHIME_SOUND = 'https://assets.mixkit.co/sfx/preview/mixkit-gong-sound-2746.mp3';

/**
 * Normalize routine into steps array. Routine can have steps[] or be a single-step (title + duration).
 * @param {Object} routine - { title, duration, steps?: Array<{ title, estimatedMinutes? }> }
 * @returns {Array<{ title: string, estimatedMinutes: number }>}
 */
function getSteps(routine) {
  if (!routine) return [];
  const steps = Array.isArray(routine.steps) && routine.steps.length > 0
    ? routine.steps
    : [{ title: routine.title || 'Step', estimatedMinutes: Math.max(1, Math.min(120, Number(routine.duration) || 5)) }];
  return steps.map((s) => ({
    title: typeof s.title === 'string' ? s.title : 'Step',
    estimatedMinutes: Math.max(1, Math.min(120, Number(s.estimatedMinutes) ?? Number(s.duration) ?? 5)),
  }));
}

function playChime() {
  try {
    const audio = new Audio(CHIME_SOUND);
    audio.volume = 0.4;
    audio.play().catch(() => {});
  } catch (_) {}
}

export default function RoutinePlayer({ routine, onClose }) {
  const steps = getSteps(routine);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const intervalRef = useRef(null);
  const chimePlayedRef = useRef(false);

  const currentStep = steps[currentIndex];
  const totalSeconds = currentStep ? currentStep.estimatedMinutes * 60 : 0;
  const isLastStep = currentIndex >= steps.length - 1;
  const isComplete = steps.length === 0 || (isLastStep && secondsLeft <= 0 && hasStarted);

  const resetTimerForStep = useCallback((index) => {
    const step = steps[index];
    if (step) setSecondsLeft(step.estimatedMinutes * 60);
    chimePlayedRef.current = false;
  }, [steps]);

  useEffect(() => {
    resetTimerForStep(currentIndex);
  }, [currentIndex, resetTimerForStep]);

  useEffect(() => {
    if (!hasStarted || isPaused || !currentStep) return;
    if (secondsLeft <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (!chimePlayedRef.current) {
        chimePlayedRef.current = true;
        playChime();
        vibrateShort();
      }
      if (autoPlay && !isLastStep) {
        const t = setTimeout(() => setCurrentIndex((i) => i + 1), 800);
        return () => clearTimeout(t);
      }
      return;
    }
    intervalRef.current = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, [hasStarted, isPaused, secondsLeft, currentStep, autoPlay, isLastStep]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleNextStep = () => {
    vibrateShort();
    if (currentIndex < steps.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const progressPercent = totalSeconds > 0 && hasStarted
    ? Math.min(100, ((totalSeconds - secondsLeft) / totalSeconds) * 100)
    : 0;

  if (!routine || steps.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <p className="font-sans text-stone-400">No steps in this routine.</p>
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-stone-500 hover:text-white">Close</button>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900 flex flex-col items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Routine complete">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-md"
        >
          <div className="text-6xl mb-4">✓</div>
          <h2 className="font-serif text-2xl text-white mb-2">Routine complete</h2>
          <p className="font-sans text-stone-400 mb-8">{routine.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-3 bg-moss-500 hover:bg-moss-600 text-white font-sans font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-moss-400"
          >
            Done
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900 flex flex-col items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Routine player"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg text-stone-500 hover:text-white hover:bg-stone-700/50 focus:outline-none focus:ring-2 focus:ring-moss-500 z-10"
        aria-label="Close"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {!hasStarted ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center text-center max-w-md"
        >
          <h2 className="font-serif text-2xl text-white mb-2">{routine.title}</h2>
          <p className="font-sans text-stone-400 mb-6">{steps.length} step{steps.length !== 1 ? 's' : ''}</p>
          <button
            type="button"
            onClick={() => { setHasStarted(true); }}
            className="px-10 py-4 bg-moss-500 hover:bg-moss-600 text-white font-sans text-lg font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-moss-400 shadow-lg"
          >
            Start
          </button>
        </motion.div>
      ) : (
        <>
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center justify-center text-center"
              >
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="6"
                    />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="rgba(122, 166, 65, 0.9)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray="289"
                      initial={{ strokeDashoffset: 289 }}
                      animate={{ strokeDashoffset: 289 - (289 * progressPercent) / 100 }}
                      transition={{ duration: 0.5 }}
                    />
                  </svg>
                  <div className="relative text-center">
                    <span className="font-mono text-4xl sm:text-5xl font-light tabular-nums text-white">
                      {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                    </span>
                  </div>
                </div>
                <h1 className="mt-8 font-serif text-2xl sm:text-3xl text-white max-w-md">
                  {currentStep?.title}
                </h1>
                <p className="mt-2 font-sans text-sm text-stone-500">
                  Step {currentIndex + 1} of {steps.length}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="w-full max-w-md flex flex-col items-center gap-4 pb-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleNextStep}
                disabled={currentIndex >= steps.length - 1}
                className="px-6 py-3 bg-stone-700 hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500"
              >
                Next step
              </button>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPlay}
                  onChange={(e) => setAutoPlay(e.target.checked)}
                  className="rounded border-stone-500 bg-stone-800 text-moss-500 focus:ring-moss-500"
                />
                <span className="font-sans text-sm text-stone-400">Auto-advance</span>
              </label>
            </div>
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              className="font-sans text-sm text-stone-500 hover:text-stone-300"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
