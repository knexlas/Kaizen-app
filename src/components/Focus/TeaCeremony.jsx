import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Japanese tea cup SVG ---
function TeaCup() {
  return (
    <svg width="100" height="88" viewBox="0 0 100 88" fill="none" className="overflow-visible">
      <path
        d="M20 38 L20 62 Q28 70 50 70 Q72 70 80 62 L80 38 Q80 26 50 20 Q20 26 20 38 Z"
        fill="white"
        stroke="#E6E2D6"
        strokeWidth="2"
      />
      <ellipse cx="50" cy="38" rx="30" ry="6" fill="none" stroke="#E6E2D6" strokeWidth="1.5" />
    </svg>
  );
}

// --- 3 steam lines: rise and fade (y: -20, opacity: 0) ---
function Steam() {
  const line = (d, delay = 0) => (
    <motion.path
      key={d}
      d={d}
      stroke="#C4B8A8"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      initial={{ opacity: 0.5, y: 0 }}
      animate={{ opacity: 0, y: -20 }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay }}
    />
  );
  return (
    <g className="absolute" style={{ top: 0, left: '50%', transform: 'translateX(-50%)' }}>
      {line('M48 16 Q50 8 52 16', 0)}
      {line('M50 14 Q52 4 54 14', 0.4)}
      {line('M46 18 Q48 10 50 18', 0.8)}
    </g>
  );
}

const RATING_OPTIONS = [
  { id: 'withered', label: 'Drained', emoji: '🥀', border: 'border-slate-200', hover: 'hover:bg-slate-50' },
  { id: 'sustained', label: 'Neutral', emoji: '🍃', border: 'border-moss-200', hover: 'hover:bg-moss-50' },
  { id: 'bloomed', label: 'Energized', emoji: '🌸', border: 'border-amber-200', hover: 'hover:bg-amber-50' },
];

export default function TeaCeremony({ task, completedTask, subtasks = [], onComplete }) {
  const resolvedTask = task ?? completedTask;
  const [rating, setRating] = useState(null);
  const [note, setNote] = useState('');
  const [subtaskId, setSubtaskId] = useState('');

  const handleFinish = () => {
    const log = {
      taskId: resolvedTask?.id ?? null,
      rating: rating ?? null,
      note: note.trim() || undefined,
      timestamp: new Date().toISOString(),
      subtaskId: subtaskId || undefined,
    };
    onComplete?.(log);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="tea-ceremony"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 bg-stone-50 flex flex-col items-center justify-center px-4 py-8"
        role="dialog"
        aria-modal="true"
        aria-label="Post-session reflection"
      >
        {/* Center: Cup + Steam */}
        <motion.div
          className="relative flex justify-center mb-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="relative">
            <TeaCup />
            <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none" style={{ height: 40 }}>
              <svg width="60" height="40" viewBox="0 0 60 40" fill="none" className="overflow-visible">
                <motion.path
                  d="M28 28 Q30 18 32 28 Q34 12 36 28"
                  stroke="#C4B8A8"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ opacity: 0.5, y: 0 }}
                  animate={{ opacity: 0, y: -20 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
                />
                <motion.path
                  d="M24 26 Q26 16 28 26"
                  stroke="#C4B8A8"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ opacity: 0.5, y: 0 }}
                  animate={{ opacity: 0, y: -20 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                />
                <motion.path
                  d="M32 26 Q34 16 36 26"
                  stroke="#C4B8A8"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ opacity: 0.5, y: 0 }}
                  animate={{ opacity: 0, y: -20 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 1 }}
                />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Text */}
        <motion.h2
          className="font-serif text-2xl md:text-3xl text-stone-800 text-center mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          The session is complete.
        </motion.h2>
        <motion.p
          className="font-serif text-lg text-stone-800/80 text-center mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          How did this harvest feel?
        </motion.p>

        {/* Rating cards (horizontal) */}
        <motion.div
          className="grid grid-cols-3 gap-4 w-full max-w-xl mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          {RATING_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRating(opt.id)}
              className={`flex flex-col items-center justify-center p-5 rounded-xl bg-stone-50 border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${opt.border} ${opt.hover} ${
                rating === opt.id ? 'ring-2 ring-moss-500/50 ring-offset-2' : ''
              }`}
            >
              <span className="text-3xl mb-1.5" aria-hidden>
                {opt.emoji}
              </span>
              <span className="font-sans text-stone-800 text-sm font-medium">{opt.label}</span>
            </button>
          ))}
        </motion.div>

        {/* Apply to vine? (when goal has subtasks) */}
        {subtasks?.length > 0 && (
          <motion.div
            className="w-full max-w-md mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.4 }}
          >
            <label htmlFor="tea-vine" className="block font-serif text-stone-800 text-sm mb-2">
              Apply this time to a vine?
            </label>
            <select
              id="tea-vine"
              value={subtaskId}
              onChange={(e) => setSubtaskId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white font-sans text-stone-800 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 transition-colors"
            >
              <option value="">No vine</option>
              {subtasks.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.title}
                </option>
              ))}
            </select>
          </motion.div>
        )}

        {/* Optional insight */}
        <motion.div
          className="w-full max-w-md mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <label htmlFor="tea-lesson" className="block font-serif text-stone-800 text-sm mb-2">
            One lesson for next time…
          </label>
          <input
            id="tea-lesson"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-white font-sans text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 transition-colors"
          />
        </motion.div>

        {/* Sip & Finish */}
        <motion.button
          type="button"
          onClick={handleFinish}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="px-6 py-3 font-serif text-stone-800 bg-stone-200/80 border border-stone-300 rounded-full hover:bg-stone-300/80 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
        >
          Sip &amp; Finish
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}
