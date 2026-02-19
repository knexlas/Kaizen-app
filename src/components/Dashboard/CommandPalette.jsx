import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HOURS = Array.from(
  { length: 23 - 6 + 1 },
  (_, i) => `${String(6 + i).padStart(2, '0')}:00`
);

/** Parse time string like "9am", "2pm", "09:00", "14:00" into HH:00 in range 06:00–23:00. */
function parseTimeString(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim().toLowerCase();
  const amPm = trimmed.match(/^(\d{1,2})\s*(am|pm)?$/);
  if (amPm) {
    let hour = parseInt(amPm[1], 10);
    const period = amPm[2];
    if (period === 'pm') hour = hour === 12 ? 12 : hour + 12;
    else if (period === 'am') hour = hour === 12 ? 0 : hour;
    const h = Math.max(6, Math.min(23, hour));
    return `${String(h).padStart(2, '0')}:00`;
  }
  const colon = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (colon) {
    const hour = parseInt(colon[1], 10);
    if (hour >= 6 && hour <= 23) return `${String(hour).padStart(2, '0')}:00`;
  }
  return null;
}

/** Find best-matching goal by title (case-insensitive includes). */
function findGoalByTitle(goals, query) {
  if (!goals?.length || !query?.trim()) return null;
  const q = query.trim().toLowerCase();
  const exact = goals.find((g) => g.title?.toLowerCase() === q);
  if (exact) return exact;
  const starts = goals.find((g) => g.title?.toLowerCase().startsWith(q));
  if (starts) return starts;
  return goals.find((g) => g.title?.toLowerCase().includes(q)) ?? null;
}

/**
 * Simple natural-language parser:
 * - "spirit" / "mirror" → { type: 'spirit' }
 * - "Goal Gym" / "goal Gym" → { type: 'goal', title: 'Gym' }
 * - "Trade 9am" / "Trade 09:00" → { type: 'plant', goalQuery: 'Trade', timeStr: '9am' }
 */
function parseCommand(input) {
  const raw = (input || '').trim();
  if (!raw) return null;

  const spiritMatch = /^(spirit|mirror)$/i.test(raw);
  if (spiritMatch) return { type: 'spirit' };

  const goalMatch = raw.match(/^goal\s+(.+)$/i);
  if (goalMatch) {
    return { type: 'goal', title: goalMatch[1].trim() };
  }

  const parts = raw.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const time = parseTimeString(last);
    if (time) {
      const goalQuery = parts.slice(0, -1).join(' ');
      return { type: 'plant', goalQuery, time };
    }
  }

  return null;
}

const CHEAT_SHEET = [
  { example: 'Trade 9am', hint: '[Task] [Time]' },
  { example: 'Goal Gym', hint: 'Goal [Name]' },
  { example: 'Spirit', hint: 'Customize companion' },
];

export default function CommandPalette({
  open,
  onClose,
  onOpen,
  goals = [],
  assignments = {},
  onAssignmentsChange,
  onOpenGoalCreator,
  onOpenSpiritBuilder,
}) {
  const [query, setQuery] = useState('');
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

  const handleSubmit = useCallback(() => {
    const cmd = parseCommand(query);
    if (!cmd) {
      setQuery('');
      onClose?.();
      return;
    }
    if (cmd.type === 'spirit') {
      onOpenSpiritBuilder?.();
      setQuery('');
      onClose?.();
      return;
    }
    if (cmd.type === 'goal') {
      onOpenGoalCreator?.(cmd.title);
      setQuery('');
      onClose?.();
      return;
    }
    if (cmd.type === 'plant') {
      const goal = findGoalByTitle(goals, cmd.goalQuery);
      if (goal && cmd.time) {
        const next = { ...assignments, [cmd.time]: goal.id };
        onAssignmentsChange?.(next);
        setQuery('');
        onClose?.();
      }
    }
  }, [query, goals, assignments, onAssignmentsChange, onOpenGoalCreator, onClose]);

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
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const down = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onClose]);

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
          aria-label="Command palette"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-stone-50/95 shadow-2xl overflow-hidden"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
            >
              ×
            </button>
            <div className="p-4">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command…"
                className="w-full py-3 px-4 rounded-xl bg-white border-2 border-stone-200 text-stone-900 font-sans text-base placeholder-stone-400 focus:outline-none focus:border-moss-500 focus:ring-2 focus:ring-moss-500/20 transition-colors"
                aria-label="Command input"
              />
            </div>
            <div className="px-4 pb-4 pt-0">
              <p className="font-sans text-xs text-stone-500 mb-2">Examples</p>
              <div className="flex flex-wrap gap-3">
                {CHEAT_SHEET.map(({ example, hint }) => (
                  <span
                    key={example}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 font-sans text-xs"
                  >
                    <kbd className="font-mono text-stone-700">{example}</kbd>
                    <span className="text-stone-400">{hint}</span>
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
