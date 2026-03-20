import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EXAMPLES = [
  'email Lisa tomorrow',
  'idea for D&D map',
  'gym 3x this week',
  'book dentist',
  'plan launch project for leave app',
];

export default function CommandPalette({
  open,
  onClose,
  onOpen,
  onOpenSpiritBuilder,
  onCapture,
}) {
  const [query, setQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (open) return;
      const inInput = e.target.closest('input, textarea, [contenteditable="true"]');
      if (inInput) return;
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const isSlash = e.key === '/';
      if (isCmdK || isSlash) {
        e.preventDefault();
        onOpen?.();
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, [open, onOpen]);

  const handleSubmit = useCallback(async () => {
    const raw = query.trim();
    if (!raw) {
      onClose?.();
      return;
    }
    if (/^(spirit|mirror)$/i.test(raw)) {
      onOpenSpiritBuilder?.();
      setQuery('');
      onClose?.();
      return;
    }
    setIsSubmitting(true);
    try {
      await onCapture?.(raw);
      setQuery('');
      onClose?.();
    } finally {
      setIsSubmitting(false);
    }
  }, [query, onCapture, onClose, onOpenSpiritBuilder]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, onClose]
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setIsSubmitting(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4 backdrop-blur-md bg-stone-900/30"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Universal capture"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl rounded-2xl border border-stone-200 bg-stone-50/95 shadow-2xl overflow-hidden"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
            >
              x
            </button>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <h2 className="font-serif text-2xl text-stone-800">Capture anything</h2>
                <p className="font-sans text-sm text-stone-500">
                  Tasks, ideas, habits, projects, and scheduled items all start here.
                </p>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Dump it here..."
                className="w-full py-3.5 px-4 rounded-xl bg-white border-2 border-stone-200 text-stone-900 font-sans text-base placeholder-stone-400 focus:outline-none focus:border-moss-500 focus:ring-2 focus:ring-moss-500/20 transition-colors"
                aria-label="Capture input"
              />
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setQuery(example)}
                    className="px-3 py-1.5 rounded-full border border-stone-200 bg-white font-sans text-xs text-stone-600 hover:border-stone-300 hover:bg-stone-100"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !query.trim()}
                  className="px-4 py-2.5 rounded-xl font-sans text-sm font-semibold bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-60"
                >
                  {isSubmitting ? 'Capturing...' : 'Capture'}
                </button>
                <button
                  type="button"
                  onClick={onOpenSpiritBuilder}
                  className="font-sans text-sm text-stone-500 hover:text-stone-700"
                >
                  Open spirit builder
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
