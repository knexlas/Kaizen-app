import { useEffect, useState } from 'react';

function FocusTimer({ onStopAndReflect, allowMusic = false }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-100 text-stone-900"
      role="dialog"
      aria-modal="true"
      aria-label="Focus mode"
    >
      {/* Enso: slow pulsing circle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-64 h-64 rounded-full border-[3px] border-stone-400"
          style={{ animation: 'enso 4s ease-in-out infinite' }}
          aria-hidden
        />
      </div>

      <style>{`
        @keyframes enso {
          0%, 100% { opacity: 0.4; transform: scale(0.98); }
          50% { opacity: 0.9; transform: scale(1.02); }
        }
      `}</style>

      <button
        type="button"
        onClick={onStopAndReflect}
        className="relative z-10 mt-48 px-6 py-3 font-serif text-stone-800 bg-stone-200/80 border border-stone-400 rounded-full hover:bg-stone-300/80 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
      >
        Stop &amp; Reflect
      </button>

      {allowMusic && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-stone-200/80 border border-stone-400 font-sans text-sm">
          <span className="text-stone-600">Now Playing</span>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-300 hover:bg-stone-400 text-stone-800 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? '⏸' : '▶'}
          </button>
        </div>
      )}
    </div>
  );
}

export default FocusTimer;
