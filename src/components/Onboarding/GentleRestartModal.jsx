import { useEffect, useState } from 'react';

export default function GentleRestartModal({ open, onFreshStart, onReviewCompost, onDismiss, onGuidedRestart }) {
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
      if (e.key === 'Escape') onDismiss?.();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gentle-restart-title"
    >
      <div
        className={`relative w-full max-w-md rounded-2xl border-2 border-stone-200 bg-stone-50 shadow-xl text-stone-900 overflow-hidden ${reducedMotion ? '' : 'animate-in fade-in duration-200'}`}
        style={reducedMotion ? {} : undefined}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
        >
          ×
        </button>
        <div className="p-6">
          <h2 id="gentle-restart-title" className="font-serif text-xl sm:text-2xl text-stone-900 mb-2">
            Welcome back. No catching up.
          </h2>
          <p className="font-sans text-stone-700 text-base leading-relaxed mb-6">
            Let&apos;s reset to today. Anything unfinished can become compost (fuel), not guilt.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onFreshStart}
              className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2"
            >
              Start fresh today
            </button>
            <button
              type="button"
              onClick={onReviewCompost}
              className="w-full py-3 rounded-xl font-sans font-medium border-2 border-stone-300 bg-white text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2"
            >
              Review compost (optional)
            </button>
            {onGuidedRestart && (
              <button
                type="button"
                onClick={onGuidedRestart}
                className="w-full py-3 rounded-xl font-sans font-medium border-2 border-moss-300 bg-moss-50 text-moss-800 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2"
              >
                Guided restart (optional)
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-2 font-sans text-sm text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 rounded-lg"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
