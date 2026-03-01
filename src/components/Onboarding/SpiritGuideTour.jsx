import { useState, useEffect } from 'react';
import { useGarden } from '../../context/GardenContext';
import MochiSpiritWithDialogue from '../Dashboard/MochiSpirit';

/** Short tour (first-run): 4 steps with stable targets. */
export const SHORT_TOUR_STEPS = [
  { targetId: 'tour-compass', message: (name) => `Welcome, ${name}. This is your Compass — the one thing that matters right now.` },
  { targetId: 'tour-timeline', message: () => "This is your Day. Plan it here based on your energy. Tap a task to start a focus session." },
  { targetId: 'plant-seed-btn', message: () => 'Plant a seed to add a new goal. Small steps grow here.' },
  { targetId: 'mochi-chat-btn', message: () => "I'm Mochi — tap me anytime to brainstorm, plan, or just chat." },
];

/** Full tour (Replay from Settings): reduced to 8 steps with stable targets. */
const FULL_TOUR_STEPS = [
  { targetId: 'tour-compass', message: (name) => `Welcome, ${name}. This is your Compass. It shows the one thing that matters right now.` },
  { targetId: 'tour-timeline', message: () => 'This is your Day. We plan it together based on your energy. Switch to Week or Month for the bigger picture.' },
  { targetId: 'plant-seed-btn', message: () => 'Plant your first seed here to start your journey.' },
  { targetId: 'tour-goal-types', message: () => "Here's how things grow: Seeds, Rocks (habits), Projects, and Vitality goals." },
  { targetId: 'tour-battery', message: () => "These are your Spoons — your fuel. Don't plan more than you have." },
  { targetId: 'tour-compost', message: () => "The Compost Heap. Throw distractions here so they don't rot in your head." },
  { targetId: 'tour-garden-tab', message: () => 'Your Garden. Every goal you nurture grows here.' },
  { targetId: 'mochi-chat-btn', message: () => "I'm always here. Click me for advice, a plan, or to chat. Try \"Suggest based on Title\" when creating goals!" },
];

function findNextVisibleStepIndex(steps, startIndex) {
  for (let i = startIndex; i < steps.length; i++) {
    const el = typeof document !== 'undefined' ? document.getElementById(steps[i].targetId) : null;
    if (el) return i;
  }
  return -1;
}

export default function SpiritGuideTour({ open = true, onComplete, steps: stepsProp }) {
  const { userSettings, plantTutorialSeed } = useGarden();
  const steps = Array.isArray(stepsProp) && stepsProp.length > 0 ? stepsProp : FULL_TOUR_STEPS;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setRect(null);
  }, [open]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!open) return;

    const step = steps[index];
    if (!step) {
      onComplete?.();
      return;
    }

    const el = typeof document !== 'undefined' ? document.getElementById(step.targetId) : null;
    if (!el) {
      const nextIndex = findNextVisibleStepIndex(steps, index + 1);
      if (nextIndex >= 0) {
        setIndex(nextIndex);
        setRect(null);
      } else {
        onComplete?.();
      }
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => {
      const r = el.getBoundingClientRect();
      setRect(r);
    }, 500);
    return () => clearTimeout(timer);
  }, [index, open, onComplete, steps]);

  if (!open) return null;

  const step = steps[index];
  if (!step || !rect) return null;

  const msg = typeof step.message === 'function' ? step.message(userSettings?.displayName || userSettings?.userName || 'Friend') : step.message;
  const isLast = index >= steps.length - 1;

  const radius = Math.max(rect.width, rect.height) / 1.5;
  const mask = `radial-gradient(circle at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px, transparent ${radius}px, rgba(0,0,0,0.85) ${radius + 20}px)`;

  const handleNext = () => {
    if (isLast) {
      plantTutorialSeed?.();
      onComplete?.();
    } else {
      const nextIndex = findNextVisibleStepIndex(steps, index + 1);
      if (nextIndex >= 0) {
        setIndex(nextIndex);
        setRect(null);
      } else {
        onComplete?.();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-auto"
      style={{ background: mask }}
      role="dialog"
      aria-modal="true"
      aria-label="Spirit guide tour"
    >
      <div
        className="absolute border-2 border-amber-400/50 rounded-xl shadow-[0_0_30px_rgba(251,191,36,0.4)] transition-all duration-500 pointer-events-none"
        style={{
          top: rect.top - 10,
          left: rect.left - 10,
          width: rect.width + 20,
          height: rect.height + 20,
        }}
      />
      <div
        className={`absolute flex flex-col items-center p-4 transition-all duration-500 ${
          isMobile ? 'bottom-0 left-0 right-0 pb-10 safe-area-pb' : 'max-w-xs'
        }`}
        style={
          !isMobile
            ? {
                top: rect.bottom + 20 > window.innerHeight - 200 ? rect.top - 200 : rect.bottom + 20,
                left: Math.max(20, Math.min(window.innerWidth - 340, rect.left)),
              }
            : {}
        }
      >
        <div className="mb-[-20px] z-10 relative">
          <MochiSpiritWithDialogue message={null} showBubble={false} />
        </div>
        <div className="relative bg-white dark:bg-stone-800 p-6 pt-8 rounded-2xl shadow-2xl border-2 border-stone-100 dark:border-stone-600 z-0 w-full">
          <button
            type="button"
            onClick={() => onComplete?.()}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
          >
            ×
          </button>
          <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-2 text-center">
            Garden tour
          </p>
          <p className="font-serif text-lg text-moss-800 dark:text-moss-200 mb-1 text-center">{msg}</p>
          <p className="font-sans text-xs text-stone-400 mb-6 text-center">
            You can replay this tour anytime from Settings → &quot;Replay tour&quot;.
          </p>
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => onComplete?.()}
              className="text-xs text-stone-400 font-bold hover:text-stone-600 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded"
            >
              SKIP
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2 bg-moss-600 text-white rounded-full font-bold shadow-md hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
