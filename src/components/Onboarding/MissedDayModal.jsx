import { useEffect, useState } from 'react';

export default function MissedDayModal({ open, onChoose }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(!!mq?.matches);
    if (mq) {
      const fn = () => setReducedMotion(mq.matches);
      mq.addEventListener('change', fn);
      return () => mq.removeEventListener('change', fn);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (e.key === 'Escape') onChoose?.(null);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onChoose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="missed-day-title"
    >
      <div
        className={`relative w-full max-w-md rounded-2xl border-2 border-stone-200 bg-stone-50 shadow-xl text-stone-900 overflow-hidden ${reducedMotion ? '' : 'animate-in fade-in duration-200'}`}
      >
        <div className="p-6">
          <h2 id="missed-day-title" className="font-serif text-xl sm:text-2xl text-stone-900 mb-2">
            Welcome back. How’s today?
          </h2>
          <p className="font-sans text-stone-700 text-base leading-relaxed mb-6">
            Pick one — we’ll set up your day and you can change it anytime.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onChoose(1)}
              className="w-full py-4 px-5 rounded-xl font-sans font-medium text-left border-2 border-amber-200 bg-amber-50/80 text-amber-900 hover:border-amber-300 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors"
            >
              <span className="block text-lg font-semibold">1 spoon day</span>
              <span className="block text-sm font-normal text-amber-800/90 mt-0.5">Ultra-light plan — one small slot</span>
            </button>
            <button
              type="button"
              onClick={() => onChoose(3)}
              className="w-full py-4 px-5 rounded-xl font-sans font-medium text-left border-2 border-moss-200 bg-moss-50/80 text-moss-900 hover:border-moss-300 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 transition-colors"
            >
              <span className="block text-lg font-semibold">3 spoon day</span>
              <span className="block text-sm font-normal text-moss-800/90 mt-0.5">Light plan — a few doable slots</span>
            </button>
            <button
              type="button"
              onClick={() => onChoose(0)}
              className="w-full py-4 px-5 rounded-xl font-sans font-medium text-left border-2 border-stone-200 bg-stone-100/80 text-stone-800 hover:border-stone-300 hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 transition-colors"
            >
              <span className="block text-lg font-semibold">No plan — just compost capture</span>
              <span className="block text-sm font-normal text-stone-600 mt-0.5">Capture thoughts; plan later (or not)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
