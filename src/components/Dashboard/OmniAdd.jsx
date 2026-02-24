import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseOmniAddInput } from '../../services/geminiService';

const CHIPS = [
  { id: 'goal', label: 'New Goal', icon: '🎯' },
  { id: 'schedule', label: 'Schedule Event', icon: '📅' },
  { id: 'note', label: 'Brain Dump / Note', icon: '📝' },
];

export default function OmniAdd({
  onOpenGoalCreator,
  onOpenScheduleEvent,
  onOpenBrainDump,
  onParsedRoute,
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setInput('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const close = () => setOpen(false);

  const handleChipClick = (id) => {
    close();
    if (id === 'goal') onOpenGoalCreator?.();
    else if (id === 'schedule') onOpenScheduleEvent?.();
    else if (id === 'note') onOpenBrainDump?.();
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const trimmed = input.trim();
    if (!trimmed) {
      close();
      return;
    }
    setIsParsing(true);
    try {
      const result = await parseOmniAddInput(trimmed);
      if (result && onParsedRoute) {
        onParsedRoute(result);
      }
    } catch (err) {
      if (onParsedRoute) {
        onParsedRoute({ type: 'goal', title: trimmed });
      }
    } finally {
      setIsParsing(false);
      setInput('');
      close();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <>
      {/* Floating + button — center bottom */}
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] w-14 h-14 rounded-full flex items-center justify-center text-2xl font-light text-white shadow-lg focus:outline-none focus:ring-4 focus:ring-moss-500/40 select-none"
        style={{
          background: 'linear-gradient(145deg, #5a7a2a 0%, #4a5d23 100%)',
          boxShadow: '0 8px 24px -4px rgba(74, 93, 35, 0.45), 0 0 0 1px rgba(255,255,255,0.08) inset',
        }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        aria-label="Add something"
      >
        +
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label="What's on your mind?"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-2xl bg-stone-50 border border-stone-200/90 shadow-2xl overflow-hidden"
              style={{
                boxShadow: '0 24px 48px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)',
              }}
            >
              <form onSubmit={handleSubmit} className="p-5">
                <label htmlFor="omni-add-input" className="sr-only">
                  What's on your mind?
                </label>
                <input
                  id="omni-add-input"
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What's on your mind?"
                  disabled={isParsing}
                  className="w-full py-4 px-4 rounded-xl border-2 border-stone-200 bg-white text-stone-900 font-sans text-lg placeholder-stone-400 focus:outline-none focus:border-moss-500 focus:ring-2 focus:ring-moss-500/20 transition-colors disabled:opacity-60"
                />
                <p className="mt-2 font-sans text-xs text-stone-400 text-center">
                  Press Enter to let Mochi route it, or pick one below.
                </p>

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {CHIPS.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => handleChipClick(chip.id)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-sans text-sm font-medium text-stone-700 bg-stone-100 border border-stone-200 hover:bg-moss-50 hover:border-moss-200 hover:text-moss-800 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                    >
                      <span aria-hidden>{chip.icon}</span>
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>

                {isParsing && (
                  <p className="mt-4 font-sans text-sm text-moss-600 text-center" role="status">
                    Mochi is reading…
                  </p>
                )}
              </form>

              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                ×
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
