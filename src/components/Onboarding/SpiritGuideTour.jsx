import { useCallback, useEffect, useRef, useState } from 'react';
import { useGarden } from '../../context/GardenContext';
import MochiSpiritWithDialogue from '../Dashboard/MochiSpirit';

const MOBILE_BREAKPOINT = 640;
const VIEWPORT_PADDING = 16;
const TOOLTIP_GAP = 20;
const DESKTOP_CARD_WIDTH = 320;
const DESKTOP_CARD_HEIGHT = 260;

/** Short tour (first-run): 4 steps with stable targets. */
export const SHORT_TOUR_STEPS = [
  { targetId: 'tour-compass', message: (name) => `Welcome, ${name}. This is your Compass: the one thing that matters right now.` },
  { targetId: 'tour-timeline', message: () => 'This is your Day. Plan it here based on your energy, then tap a task to start.' },
  { targetId: 'plant-seed-btn', message: () => 'Plant a seed here to add something new to your garden.' },
  { targetId: 'mochi-chat-btn', message: () => "I'm Mochi. Tap me anytime to brainstorm, plan, or talk something through." },
];

/** Full tour (Replay from Settings): reduced to 8 steps with stable targets. */
const FULL_TOUR_STEPS = [
  { targetId: 'tour-compass', message: (name) => `Welcome, ${name}. This is your Compass. It shows the one thing that matters right now.` },
  { targetId: 'tour-timeline', message: () => 'This is your Day. Plan it here based on your energy, then switch to Week or Month when you need the bigger picture.' },
  { targetId: 'plant-seed-btn', message: () => 'Plant your first seed here to start something small and real.' },
  { targetId: 'tour-goal-types', message: () => 'This is how work grows here: Seeds, routines, projects, and vitality goals.' },
  { targetId: 'tour-battery', message: () => 'These are your spoons. They help you plan within the energy you actually have.' },
  { targetId: 'tour-compost', message: () => "This is the Compost Heap. Toss distractions here so they don't keep circling in your head." },
  { targetId: 'tour-garden-tab', message: () => 'This is your Garden. The things you keep tending will grow here over time.' },
  { targetId: 'mochi-chat-btn', message: () => 'Mochi is always nearby when you want help planning, rewriting, or getting unstuck.' },
];

function findNextVisibleStepIndex(steps, startIndex) {
  for (let i = startIndex; i < steps.length; i += 1) {
    const el = typeof document !== 'undefined' ? document.getElementById(steps[i].targetId) : null;
    if (el) return i;
  }
  return -1;
}

function getDesktopTooltipPosition(targetRect, cardBounds) {
  const width = Math.min(cardBounds?.width || DESKTOP_CARD_WIDTH, Math.max(220, window.innerWidth - (VIEWPORT_PADDING * 2)));
  const height = cardBounds?.height || DESKTOP_CARD_HEIGHT;

  let left = targetRect.right + TOOLTIP_GAP;
  if (left + width > window.innerWidth - VIEWPORT_PADDING) {
    left = targetRect.left - TOOLTIP_GAP - width;
  }
  if (left < VIEWPORT_PADDING) {
    left = Math.min(
      window.innerWidth - VIEWPORT_PADDING - width,
      Math.max(VIEWPORT_PADDING, targetRect.left + (targetRect.width / 2) - (width / 2))
    );
  }

  let top = targetRect.top + (targetRect.height / 2) - (height / 2);
  top = Math.max(VIEWPORT_PADDING, Math.min(top, window.innerHeight - VIEWPORT_PADDING - height));

  return {
    top,
    left,
    width,
    maxWidth: `calc(100vw - ${VIEWPORT_PADDING * 2}px)`,
  };
}

export default function SpiritGuideTour({ open = true, onComplete, steps: stepsProp }) {
  const { userSettings, plantTutorialSeed } = useGarden();
  const steps = Array.isArray(stepsProp) && stepsProp.length > 0 ? stepsProp : FULL_TOUR_STEPS;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false);
  const cardRef = useRef(null);

  const measureCurrentTarget = useCallback(() => {
    if (!open) return;
    const step = steps[index];
    if (!step) return;

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

    setRect(el.getBoundingClientRect());
  }, [index, onComplete, open, steps]);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setRect(null);
    setTooltipStyle({});
  }, [open]);

  useEffect(() => {
    const syncLayout = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      measureCurrentTarget();
    };

    window.addEventListener('resize', syncLayout);
    return () => window.removeEventListener('resize', syncLayout);
  }, [measureCurrentTarget]);

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

    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    const frame = requestAnimationFrame(measureCurrentTarget);
    const timer = setTimeout(measureCurrentTarget, 420);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [index, measureCurrentTarget, onComplete, open, steps]);

  useEffect(() => {
    if (!open) return undefined;

    const syncPosition = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      measureCurrentTarget();
    };

    window.addEventListener('scroll', syncPosition, true);
    window.addEventListener('resize', syncPosition);

    return () => {
      window.removeEventListener('scroll', syncPosition, true);
      window.removeEventListener('resize', syncPosition);
    };
  }, [measureCurrentTarget, open]);

  const step = steps[index];
  const msg = typeof step?.message === 'function'
    ? step.message(userSettings?.displayName || userSettings?.userName || 'Friend')
    : step?.message;

  useEffect(() => {
    if (!open || !rect || isMobile) {
      setTooltipStyle({});
      return;
    }

    const updateTooltipStyle = () => {
      const bounds = {
        width: cardRef.current?.offsetWidth || DESKTOP_CARD_WIDTH,
        height: cardRef.current?.offsetHeight || DESKTOP_CARD_HEIGHT,
      };
      setTooltipStyle(getDesktopTooltipPosition(rect, bounds));
    };

    updateTooltipStyle();
    const frame = requestAnimationFrame(updateTooltipStyle);
    return () => cancelAnimationFrame(frame);
  }, [isMobile, msg, open, rect]);

  if (!open) return null;
  if (!step || !rect) return null;

  const isLast = index >= steps.length - 1;
  const radius = Math.max(rect.width, rect.height) / 1.5;
  const mask = `radial-gradient(circle at ${rect.left + (rect.width / 2)}px ${rect.top + (rect.height / 2)}px, transparent ${radius}px, rgba(0,0,0,0.85) ${radius + 20}px)`;

  const handleNext = () => {
    if (isLast) {
      plantTutorialSeed?.();
      onComplete?.();
      return;
    }

    const nextIndex = findNextVisibleStepIndex(steps, index + 1);
    if (nextIndex >= 0) {
      setIndex(nextIndex);
      setRect(null);
    } else {
      onComplete?.();
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
        className="absolute rounded-xl border-2 border-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.4)] transition-all duration-500 pointer-events-none"
        style={{
          top: rect.top - 10,
          left: rect.left - 10,
          width: rect.width + 20,
          height: rect.height + 20,
        }}
      />

      <div
        className={`absolute z-10 transition-all duration-500 ${isMobile ? 'bottom-0 left-0 right-0 px-3' : ''}`}
        style={isMobile ? { paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' } : tooltipStyle}
      >
        <div className={`flex flex-col items-center ${isMobile ? 'mx-auto max-w-xl' : ''}`}>
          <div className="relative z-10 mb-[-20px]">
            <MochiSpiritWithDialogue message={null} showBubble={false} />
          </div>
          <div
            ref={cardRef}
            className={`relative z-0 rounded-2xl border-2 border-stone-100 bg-white p-6 pt-8 shadow-2xl dark:border-stone-600 dark:bg-stone-800 ${
              isMobile ? 'w-full' : 'w-[320px]'
            }`}
          >
            <button
              type="button"
              onClick={() => onComplete?.()}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:hover:bg-stone-700"
            >
              x
            </button>
            <p className="mb-2 text-center font-sans text-[10px] uppercase tracking-[0.2em] text-stone-400">
              Garden tour
            </p>
            <p className="mb-1 text-center font-serif text-lg text-moss-800 dark:text-moss-200">{msg}</p>
            <p className="mb-6 text-center font-sans text-xs text-stone-400">
              Replay this anytime from Settings &gt; "Replay tour".
            </p>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => onComplete?.()}
                className="rounded font-sans text-xs font-bold text-stone-400 hover:text-stone-600 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="rounded-full bg-moss-600 px-6 py-2 font-sans text-sm font-bold text-white shadow-md hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
              >
                {isLast ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
