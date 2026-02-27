import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseOmniAddInput } from '../../services/geminiService';
import { getTaskDictionaryEntry } from '../../services/energyDictionaryService';
import { useGarden } from '../../context/GardenContext';

/** Recurrence options for Rhythms. Value stored in task.recurrence. */
const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

/** Energy cost for tasks: 0 = Zero-Spark, 1–3 = Light/Medium/Heavy. Stored on goal/task as energyCost. */
const ENERGY_COST_OPTIONS = [
  { value: 0, label: '0 ⚡ Freebie', title: 'Zero-Spark / Freebie' },
  { value: 1, label: '1 Light', title: 'Light effort' },
  { value: 2, label: '2 Medium', title: 'Medium effort' },
  { value: 3, label: '3 Heavy', title: 'Heavy effort' },
];

const CHIPS = [
  { id: 'goal', label: 'New Goal', icon: '🎯' },
  { id: 'schedule', label: 'Schedule Event', icon: '📅' },
  { id: 'note', label: 'Brain Dump / Note', icon: '📝' },
];

const DEBOUNCE_MS = 400;
const MIN_TITLE_LENGTH_FOR_LOOKUP = 2;

export default function OmniAdd({
  onOpenGoalCreator,
  onOpenScheduleEvent,
  onOpenBrainDump,
  onParsedRoute,
}) {
  const { googleUser } = useGarden();
  const uid = googleUser?.uid;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  /** True when energy slider was auto-set from Task Dictionary (show "Based on your history"). */
  const [learnedFromHistory, setLearnedFromHistory] = useState(false);
  /** Fixed/Mandatory (lock) vs Flexible (wave). Work/synced events default to Fixed. */
  const [isFixed, setIsFixed] = useState(false);
  /** Work vs Personal context tag. */
  const [context, setContext] = useState('personal');
  /** Repeat / Rhythm: none | daily | weekly | monthly | custom. Shown in dropdown behind cycle icon. */
  const [recurrence, setRecurrence] = useState('none');
  const [recurrenceDropdownOpen, setRecurrenceDropdownOpen] = useState(false);
  /** Energy cost 0 (Freebie), 1 (Light), 2 (Medium), 3 (Heavy). Default 1. */
  const [energyCost, setEnergyCost] = useState(1);
  const inputRef = useRef(null);
  const recurrenceRef = useRef(null);

  useEffect(() => {
    if (open) {
      setInput('');
      setIsFixed(false);
      setContext('personal');
      setRecurrence('none');
      setRecurrenceDropdownOpen(false);
      setEnergyCost(1);
      setLearnedFromHistory(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  /** Debounced Task Dictionary lookup: when user types a task name, snap energy to learned cost if any. */
  useEffect(() => {
    if (!uid || !open) return;
    const trimmed = input.trim();
    if (trimmed.length < MIN_TITLE_LENGTH_FOR_LOOKUP) {
      setLearnedFromHistory(false);
      return;
    }
    const t = setTimeout(() => {
      getTaskDictionaryEntry(uid, trimmed)
        .then((entry) => {
          if (entry?.learnedCost != null && entry.learnedCost >= 0 && entry.learnedCost <= 3) {
            setEnergyCost(Math.round(entry.learnedCost));
            setLearnedFromHistory(true);
          } else {
            setLearnedFromHistory(false);
          }
        })
        .catch(() => setLearnedFromHistory(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [uid, open, input]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (recurrenceRef.current && !recurrenceRef.current.contains(e.target)) setRecurrenceDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        const isCalendar = result.type === 'calendar_event';
        const recurrencePayload = recurrence && recurrence !== 'none' ? (recurrence === 'weekly' ? { type: 'weekly', days: [] } : recurrence === 'monthly' ? { type: 'monthly' } : recurrence === 'custom' ? { type: 'custom' } : { type: 'daily' }) : undefined;
        onParsedRoute({
          ...result,
          isFixed: isCalendar ? true : isFixed,
          context: isCalendar ? 'work' : context,
          recurrence: recurrencePayload,
          energyCost: energyCost >= 0 && energyCost <= 3 ? energyCost : 1,
        });
      }
    } catch (err) {
      if (onParsedRoute) {
        const recurrencePayload = recurrence && recurrence !== 'none' ? (recurrence === 'weekly' ? { type: 'weekly', days: [] } : recurrence === 'monthly' ? { type: 'monthly' } : recurrence === 'custom' ? { type: 'custom' } : { type: 'daily' }) : undefined;
        onParsedRoute({ type: 'goal', title: trimmed, isFixed, context, recurrence: recurrencePayload, energyCost: energyCost >= 0 && energyCost <= 3 ? energyCost : 1 });
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

                  <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <span className="font-sans text-xs text-stone-500 mr-1">Energy:</span>
                    {ENERGY_COST_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setEnergyCost(opt.value); setLearnedFromHistory(false); }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-sans text-xs font-medium border transition-colors ${energyCost === opt.value ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'}`}
                        aria-pressed={energyCost === opt.value}
                        aria-label={`${opt.label} (${opt.value})`}
                        title={opt.title}
                      >
                        <span aria-hidden>⚡</span> {opt.value} {opt.label}
                      </button>
                    ))}
                    {learnedFromHistory && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-moss-50 border border-moss-200 text-moss-700 font-sans text-xs" title="Based on your past feedback">
                        <span aria-hidden>🧠</span> Based on your history
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-sans text-xs text-stone-500 mr-1">Type:</span>
                    <button
                      type="button"
                      onClick={() => setIsFixed(true)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-sans text-xs font-medium border transition-colors ${isFixed ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'}`}
                      aria-pressed={isFixed}
                      aria-label="Fixed / Mandatory"
                    >
                      <span aria-hidden>🔒</span> Fixed
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFixed(false)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-sans text-xs font-medium border transition-colors ${!isFixed ? 'bg-sky-50 border-sky-300 text-sky-800' : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'}`}
                      aria-pressed={!isFixed}
                      aria-label="Flexible"
                    >
                      <span aria-hidden>〰️</span> Flexible
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-sans text-xs text-stone-500 mr-1">Context:</span>
                    <button
                      type="button"
                      onClick={() => setContext('work')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-sans text-xs font-medium border transition-colors ${context === 'work' ? 'bg-stone-700 border-stone-600 text-white' : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'}`}
                      aria-pressed={context === 'work'}
                      aria-label="Work"
                    >
                      Work
                    </button>
                    <button
                      type="button"
                      onClick={() => setContext('personal')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-sans text-xs font-medium border transition-colors ${context === 'personal' ? 'bg-moss-100 border-moss-300 text-moss-800' : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'}`}
                      aria-pressed={context === 'personal'}
                      aria-label="Personal"
                    >
                      Personal
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-sans text-xs text-stone-500">Repeat:</span>
                    <div className="relative inline-block" ref={recurrenceRef}>
                      <button
                        type="button"
                        onClick={() => setRecurrenceDropdownOpen((o) => !o)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-sans text-xs font-medium border transition-colors min-h-[32px] ${recurrence !== 'none' ? 'bg-violet-50 border-violet-300 text-violet-800' : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'}`}
                        aria-expanded={recurrenceDropdownOpen}
                        aria-haspopup="listbox"
                        aria-label="Repeat / Rhythm"
                      >
                        <span aria-hidden className="shrink-0" title="Repeat">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 1l4 4-4 4" />
                            <path d="M3 11V9a4 4 0 014-4h14" />
                            <path d="M7 23l-4-4 4-4" />
                            <path d="M21 13v2a4 4 0 01-4 4H3" />
                          </svg>
                        </span>
                        <span className="max-w-[100px] truncate">
                          {RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.label ?? 'Does not repeat'}
                        </span>
                      </button>
                      {recurrenceDropdownOpen && (
                        <div
                          className="absolute left-0 top-full z-50 mt-1 py-1 min-w-[160px] rounded-lg bg-white border border-stone-200 shadow-lg max-h-[220px] overflow-y-auto"
                          role="listbox"
                          aria-label="Repeat options"
                        >
                          {RECURRENCE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              role="option"
                              aria-selected={recurrence === opt.value}
                              onClick={() => { setRecurrence(opt.value); setRecurrenceDropdownOpen(false); }}
                              className={`w-full text-left px-4 py-2 font-sans text-sm hover:bg-stone-100 focus:bg-stone-100 focus:outline-none ${recurrence === opt.value ? 'text-moss-700 bg-moss-50' : 'text-stone-700'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

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
