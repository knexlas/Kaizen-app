import { useState, useEffect } from 'react';
import { useGarden } from '../../context/GardenContext';
import MochiSpiritWithDialogue from '../Dashboard/MochiSpirit';

const TOUR_STEPS = [
  {
    targetId: 'tour-compass',
    message: (name) => `Welcome, ${name}. This is your Compass. It shows you the one thing that matters right now.`,
  },
  {
    targetId: 'tour-goal-types',
    message: () => 'Here’s how things work: Seeds (Kaizen) are goals with steps and optional practice days. Rocks (Routines) are recurring habits with a weekly target. Projects are bigger goals with phases and milestones — use "Plan a Project" to slice them up. Vitality goals are single numbers you track (sleep, weight, etc.) and they show up in your Ponds below.',
  },
  {
    targetId: 'tour-timeline',
    message: () => 'This is your Day. We plan it together based on your energy, not just your to-do list. Switch to Week or Month view for the bigger picture.',
  },
  {
    targetId: 'tour-battery',
    message: () => 'These are your Spoons. This is your fuel. Never plan more than you have.',
  },
  {
    targetId: 'tour-ponds',
    message: () => 'These are your Vitality Ponds. Any Vitality goal you create (e.g. sleep, weight) appears here. Log numbers and watch your progress.',
  },
  {
    targetId: 'tour-compost',
    message: () => 'The Compost Heap. If you have a distraction, throw it here. Don\'t let it rot in your head.',
  },
  {
    targetId: 'tour-garden-tab',
    message: () => 'This is your Garden. Every goal you nurture — Seeds, Rocks, Projects — grows here. Projects look different (amber) and grow by completing milestones, not just time spent.',
  },
  {
    targetId: 'tour-journal-tab',
    message: () => 'Your Journal. After each session, you\'ll reflect here. Small notes become big insights over time.',
  },
  {
    targetId: 'tour-wisdom',
    message: () => 'And I am always here. Click me if you need advice, a plan, or just want to chat. When creating goals, try "Suggest based on Title" — Mochi can plan for you. Change the title and suggest again for a fresh plan!',
  },
];

export default function SpiritGuideTour({ open = true, onComplete }) {
  const { userSettings } = useGarden();
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

    const step = TOUR_STEPS[index];
    if (!step) {
      onComplete?.();
      return;
    }

    const el = document.getElementById(step.targetId);
    if (!el) {
      setIndex((i) => i + 1);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => {
      const r = el.getBoundingClientRect();
      setRect(r);
    }, 500);
    return () => clearTimeout(timer);
  }, [index, open, onComplete]);

  if (!open) return null;

  const step = TOUR_STEPS[index];
  if (!step || !rect) return null;

  const msg = typeof step.message === 'function' ? step.message(userSettings?.displayName || userSettings?.userName || 'Friend') : step.message;
  const isLast = index >= TOUR_STEPS.length - 1;

  const radius = Math.max(rect.width, rect.height) / 1.5;
  const mask = `radial-gradient(circle at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px, transparent ${radius}px, rgba(0,0,0,0.85) ${radius + 20}px)`;

  const handleNext = () => {
    if (isLast) {
      onComplete?.();
    } else {
      setIndex((i) => i + 1);
      setRect(null);
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
      {/* The Highlighter Box (Visual Only) */}
      <div
        className="absolute border-2 border-amber-400/50 rounded-xl shadow-[0_0_30px_rgba(251,191,36,0.4)] transition-all duration-500 pointer-events-none"
        style={{
          top: rect.top - 10,
          left: rect.left - 10,
          width: rect.width + 20,
          height: rect.height + 20,
        }}
      />

      {/* The Spirit & Text */}
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
        <div className="bg-white p-6 pt-8 rounded-2xl shadow-2xl border-2 border-stone-100 relative z-0 w-full">
          <p className="font-serif text-lg text-moss-800 mb-6 text-center">{msg}</p>
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
              {isLast ? 'Start Growing' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
