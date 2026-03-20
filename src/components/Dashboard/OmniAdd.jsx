import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseOmniAddInput } from '../../services/geminiService';
import { getTaskDictionaryEntry } from '../../services/energyDictionaryService';
import { useGarden } from '../../context/GardenContext';
import { normalizeTaskCapture, overrideCaptureClassification } from '../../services/taskCaptureService';

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

const ENERGY_COST_OPTIONS = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
];

const CAPTURE_OPTIONS = [
  { id: 'task', label: 'Task' },
  { id: 'habit', label: 'Habit' },
  { id: 'project', label: 'Project' },
  { id: 'note', label: 'Note' },
  { id: 'someday', label: 'Later' },
  { id: 'calendar_event', label: 'Event' },
];

const DEBOUNCE_MS = 400;
const MIN_TITLE_LENGTH_FOR_LOOKUP = 2;

function getCaptureSummary(capture) {
  switch (capture?.captureKind) {
    case 'project':
      return 'This looks like a project and should go to Project Planner.';
    case 'habit':
      return 'This looks like a habit or recurring practice.';
    case 'calendar_event':
      return 'This looks like a scheduled event.';
    case 'scheduled_item':
      return 'This looks like a task with a time or date.';
    case 'someday':
      return 'This looks like something to keep for later.';
    case 'note':
      return 'This looks like a note or idea for the inbox.';
    case 'task':
    default:
      return 'This looks like a task you can act on.';
  }
}

function buildRecurrencePayload(recurrence) {
  if (!recurrence || recurrence === 'none') return undefined;
  if (recurrence === 'weekly') return { type: 'weekly', days: [] };
  if (recurrence === 'monthly') return { type: 'monthly' };
  if (recurrence === 'custom') return { type: 'custom' };
  return { type: 'daily' };
}

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
  const [draftCapture, setDraftCapture] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [learnedFromHistory, setLearnedFromHistory] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  const [context, setContext] = useState('personal');
  const [recurrence, setRecurrence] = useState('none');
  const [energyCost, setEnergyCost] = useState(1);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setInput('');
    setDraftCapture(null);
    setShowDetails(false);
    setIsFixed(false);
    setContext('personal');
    setRecurrence('none');
    setEnergyCost(1);
    setLearnedFromHistory(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, input, uid]);

  const close = () => setOpen(false);

  const buildManualPayload = () => ({
    isFixed,
    context,
    recurrence: buildRecurrencePayload(recurrence),
    energyCost: energyCost >= 0 && energyCost <= 3 ? energyCost : 1,
  });

  const handleAnalyze = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      close();
      return;
    }
    setIsParsing(true);
    try {
      const result = await parseOmniAddInput(trimmed);
      const capture = normalizeTaskCapture({ ...(result || {}), ...buildManualPayload() }, trimmed);
      setDraftCapture(capture);
    } catch {
      setDraftCapture(normalizeTaskCapture({ title: trimmed, ...buildManualPayload() }, trimmed));
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!draftCapture) {
      await handleAnalyze();
      return;
    }
    await onParsedRoute?.(draftCapture);
    setInput('');
    setDraftCapture(null);
    close();
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (draftCapture) await handleConfirm();
      else await handleAnalyze();
    }
  };

  const handleOverride = (kind) => {
    if (!draftCapture) return;
    const nextKind = kind === 'task' && draftCapture.scheduledDate ? 'scheduled_item' : kind;
    setDraftCapture(overrideCaptureClassification(draftCapture, nextKind));
  };

  const handleSendToInbox = async () => {
    const fallback = draftCapture
      ? overrideCaptureClassification(draftCapture, 'note')
      : normalizeTaskCapture({ title: input.trim(), ...buildManualPayload() }, input.trim());
    await onParsedRoute?.(fallback);
    setInput('');
    setDraftCapture(null);
    close();
  };

  return (
    <>
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
        aria-label="Capture something"
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
            aria-label="Capture"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-2xl bg-stone-50 border border-stone-200/90 shadow-2xl overflow-hidden"
              style={{
                boxShadow: '0 24px 48px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)',
              }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draftCapture) handleConfirm();
                  else handleAnalyze();
                }}
                className="p-5"
              >
                <div className="space-y-2">
                  <label htmlFor="omni-add-input" className="font-sans text-sm font-medium text-stone-700">
                    Dump it here. I will sort it.
                  </label>
                  <input
                    id="omni-add-input"
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setDraftCapture(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="email Lisa tomorrow, gym 3x this week, idea for D&D map..."
                    disabled={isParsing}
                    className="w-full py-4 px-4 rounded-xl border-2 border-stone-200 bg-white text-stone-900 font-sans text-lg placeholder-stone-400 focus:outline-none focus:border-moss-500 focus:ring-2 focus:ring-moss-500/20 transition-colors disabled:opacity-60"
                  />
                  <p className="font-sans text-xs text-stone-500">
                    Press Enter to classify it. Most captures only need one confirmation.
                  </p>
                </div>

                {draftCapture ? (
                  <div className="mt-5 rounded-2xl border border-moss-200 bg-moss-50/70 p-4 space-y-4">
                    <div className="space-y-1">
                      <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-moss-700">
                        {draftCapture.captureKind === 'calendar_event' ? 'Scheduled event' : `Looks like a ${draftCapture.captureKind.replace('_', ' ')}`}
                      </p>
                      <p className="font-sans text-sm text-stone-700">{getCaptureSummary(draftCapture)}</p>
                      {draftCapture.isAmbiguous && (
                        <p className="font-sans text-xs text-stone-500">
                          This one is a little fuzzy, so inbox is the safe fallback.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {CAPTURE_OPTIONS
                        .filter((option) => draftCapture.scheduledDate || option.id !== 'calendar_event')
                        .map((option) => {
                          const selectedKind = draftCapture.captureKind === 'scheduled_item' && option.id === 'task'
                            ? 'task'
                            : draftCapture.captureKind;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => handleOverride(option.id)}
                              className={`px-3 py-1.5 rounded-full font-sans text-xs font-medium border transition-colors ${
                                selectedKind === option.id
                                  ? 'bg-moss-600 border-moss-600 text-white'
                                  : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={isParsing}
                        className="px-4 py-2.5 rounded-xl font-sans text-sm font-semibold bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-60"
                      >
                        {draftCapture.confirmationLabel}
                      </button>
                      {draftCapture.captureKind !== 'note' && draftCapture.captureKind !== 'someday' && (
                        <button
                          type="button"
                          onClick={handleSendToInbox}
                          className="px-4 py-2.5 rounded-xl font-sans text-sm font-medium border border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
                        >
                          Save to inbox
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDraftCapture(null)}
                        className="px-4 py-2.5 rounded-xl font-sans text-sm font-medium text-stone-500 hover:text-stone-700"
                      >
                        Reparse
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-sans text-stone-500">
                    <span className="px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200">task</span>
                    <span className="px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200">habit</span>
                    <span className="px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200">project</span>
                    <span className="px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200">scheduled item</span>
                    <span className="px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200">note</span>
                    <span className="px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200">later</span>
                  </div>
                )}

                <div className="mt-5 border-t border-stone-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowDetails((prev) => !prev)}
                    className="font-sans text-sm font-medium text-stone-600 hover:text-stone-800"
                  >
                    {showDetails ? 'Hide details' : 'Refine details'}
                  </button>

                  {showDetails && (
                    <div className="mt-4 space-y-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans text-xs text-stone-500">Energy</span>
                        {ENERGY_COST_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setEnergyCost(opt.value);
                              setLearnedFromHistory(false);
                              setDraftCapture(null);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg font-sans text-xs font-medium border transition-colors ${
                              energyCost === opt.value
                                ? 'bg-amber-50 border-amber-300 text-amber-800'
                                : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                        {learnedFromHistory && (
                          <span className="px-2 py-1 rounded-md bg-moss-50 border border-moss-200 text-moss-700 font-sans text-xs">
                            Learned from history
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans text-xs text-stone-500">Type</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsFixed(true);
                            setDraftCapture(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-sans text-xs font-medium border transition-colors ${
                            isFixed ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                          }`}
                        >
                          Fixed
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsFixed(false);
                            setDraftCapture(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-sans text-xs font-medium border transition-colors ${
                            !isFixed ? 'bg-sky-50 border-sky-300 text-sky-800' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                          }`}
                        >
                          Flexible
                        </button>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans text-xs text-stone-500">Context</span>
                        <button
                          type="button"
                          onClick={() => {
                            setContext('work');
                            setDraftCapture(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-sans text-xs font-medium border transition-colors ${
                            context === 'work' ? 'bg-stone-700 border-stone-600 text-white' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                          }`}
                        >
                          Work
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setContext('personal');
                            setDraftCapture(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-sans text-xs font-medium border transition-colors ${
                            context === 'personal' ? 'bg-moss-100 border-moss-300 text-moss-800' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                          }`}
                        >
                          Personal
                        </button>
                      </div>

                      <div className="space-y-2">
                        <span className="font-sans text-xs text-stone-500 block">Repeat</span>
                        <div className="flex flex-wrap gap-2">
                          {RECURRENCE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setRecurrence(opt.value);
                                setDraftCapture(null);
                              }}
                              className={`px-3 py-1.5 rounded-lg font-sans text-xs font-medium border transition-colors ${
                                recurrence === opt.value
                                  ? 'bg-violet-50 border-violet-300 text-violet-800'
                                  : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-stone-200 pt-4">
                  <div className="font-sans text-xs text-stone-500">
                    Need a structured flow instead?
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        onOpenGoalCreator?.(input.trim());
                      }}
                      className="font-sans text-xs font-medium text-stone-600 hover:text-stone-800"
                    >
                      Goal creator
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        onOpenScheduleEvent?.(input.trim());
                      }}
                      className="font-sans text-xs font-medium text-stone-600 hover:text-stone-800"
                    >
                      Schedule event
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        onOpenBrainDump?.();
                      }}
                      className="font-sans text-xs font-medium text-stone-600 hover:text-stone-800"
                    >
                      Inbox
                    </button>
                  </div>
                </div>

                {isParsing && (
                  <p className="mt-4 font-sans text-sm text-moss-600 text-center" role="status">
                    Sorting your capture...
                  </p>
                )}
              </form>

              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                x
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
