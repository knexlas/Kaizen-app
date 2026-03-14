import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getTodayCalendarBlocks,
  getOutstandingForToday,
  getPlannedMinutesFromPlan,
  getAnytimePlannedMinutes,
  isDayOverloaded,
  estimateMinutesForTaskIds,
} from '../../services/dailyPlanningFlowService';

const STEPS = [
  { id: 1, title: 'Your day so far' },
  { id: 2, title: 'What’s on your list' },
  { id: 3, title: 'Choose what fits today' },
  { id: 4, title: 'How much you’re planning' },
  { id: 5, title: 'Check capacity' },
  { id: 6, title: 'You’re set' },
];

function formatTime(minutesSinceMidnight) {
  if (minutesSinceMidnight == null) return '';
  const h = Math.floor(minutesSinceMidnight / 60);
  const m = minutesSinceMidnight % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export default function DailyPlanRitual({
  open,
  onClose,
  today,
  goals = [],
  weeklyEvents = [],
  dayPlan = {},
  dayCapacityHours = 14,
  loadDayPlan,
  saveDayPlanForDate,
  onConfirm,
  findFirstFreeHourKey,
  toPlanAssignmentFromTask,
}) {
  const [step, setStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirmedOverload, setConfirmedOverload] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedIds(new Set());
      setConfirmedOverload(false);
    }
  }, [open]);

  const calendarBlocks = useMemo(() => getTodayCalendarBlocks(today, weeklyEvents), [today, weeklyEvents]);
  const outstanding = useMemo(() => getOutstandingForToday(goals, today), [goals, today]);
  const currentPlanMinutes = useMemo(
    () => getPlannedMinutesFromPlan(dayPlan, goals) + getAnytimePlannedMinutes(dayPlan, goals),
    [dayPlan, goals]
  );
  const selectedMinutes = useMemo(
    () => estimateMinutesForTaskIds(Array.from(selectedIds), outstanding),
    [selectedIds, outstanding]
  );
  const totalAfterAdd = currentPlanMinutes + selectedMinutes;
  const capacityMinutes = dayCapacityHours * 60;
  const isOverloaded = totalAfterAdd > capacityMinutes && selectedIds.size > 0;
  const firstSelectedTask = useMemo(() => {
    const firstId = outstanding.find((t) => selectedIds.has(t.id));
    return firstId ?? null;
  }, [outstanding, selectedIds]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    const selectedTasks = outstanding.filter((t) => selectedIds.has(t.id));
    if (typeof onConfirm === 'function') {
      await onConfirm(selectedTasks);
    }
    onClose?.();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-plan-ritual-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-stone-50 shadow-xl overflow-hidden"
      >
        <div className="px-5 pt-5 pb-2 border-b border-stone-200">
          <div className="flex items-center justify-between gap-2">
            <h2 id="daily-plan-ritual-title" className="font-serif text-lg text-stone-900">
              Plan today
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-200/60"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className="font-sans text-xs text-stone-500 mt-1">
            Step {step} of 6 · {STEPS[step - 1].title}
          </p>
        </div>

        <div className="px-5 py-4 min-h-[240px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="space-y-3"
              >
                <p className="font-sans text-sm text-stone-700">
                  Here’s what’s already on your day. This time is reserved.
                </p>
                {calendarBlocks.length === 0 ? (
                  <p className="font-sans text-sm text-stone-500 italic">Nothing scheduled yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {calendarBlocks.map((b, i) => (
                      <li key={i} className="font-sans text-sm text-stone-800 flex items-center gap-2">
                        <span className="font-mono text-xs text-stone-500 shrink-0">
                          {b.startMins != null ? formatTime(b.startMins) : '—'}
                        </span>
                        {b.title}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="space-y-3"
              >
                <p className="font-sans text-sm text-stone-700">
                  What’s on your list. You’ll choose what fits in a moment.
                </p>
                {outstanding.length === 0 ? (
                  <p className="font-sans text-sm text-stone-500 italic">No outstanding tasks right now.</p>
                ) : (
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                    {outstanding.map((t) => (
                      <li key={t.id} className="font-sans text-sm text-stone-800">
                        {t.title}
                        {t.goalTitle && t.goalTitle !== t.title && (
                          <span className="text-stone-500 ml-1">· {t.goalTitle}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="space-y-3"
              >
                <p className="font-sans text-sm text-stone-700">
                  Tick what you want to do today. The rest can wait.
                </p>
                {outstanding.length === 0 ? (
                  <p className="font-sans text-sm text-stone-500 italic">No tasks to choose from.</p>
                ) : (
                  <ul className="space-y-2 max-h-56 overflow-y-auto">
                    {outstanding.map((t) => (
                      <li key={t.id} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          id={`ritual-${t.id}`}
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleSelected(t.id)}
                          className="mt-1 rounded border-stone-300 text-moss-600 focus:ring-moss-500"
                        />
                        <label htmlFor={`ritual-${t.id}`} className="font-sans text-sm text-stone-800 cursor-pointer">
                          {t.title}
                          <span className="text-stone-500 font-normal"> ~{t.estimatedMinutes ?? 30} min</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="space-y-3"
              >
                <p className="font-sans text-sm text-stone-700">Your day at a glance.</p>
                <div className="rounded-xl bg-stone-100 border border-stone-200 p-4 space-y-2">
                  <p className="font-sans text-sm text-stone-800">
                    Already planned: <strong>{((currentPlanMinutes || 0) / 60).toFixed(1)} h</strong>
                  </p>
                  {selectedIds.size > 0 && (
                    <p className="font-sans text-sm text-stone-800">
                      Adding: <strong>{(selectedMinutes / 60).toFixed(1)} h</strong> ({selectedIds.size} task
                      {selectedIds.size !== 1 ? 's' : ''})
                    </p>
                  )}
                  <p className="font-sans text-sm text-stone-600">
                    Total: <strong>{(totalAfterAdd / 60).toFixed(1)} h</strong> · Capacity: {dayCapacityHours} h
                  </p>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="space-y-3"
              >
                {isOverloaded && !confirmedOverload ? (
                  <>
                    <p className="font-sans text-sm text-stone-700">
                      This is a lot for one day. You can remove something from your choices or continue as is.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="px-4 py-2 rounded-xl font-sans text-sm font-medium bg-stone-200 text-stone-800 hover:bg-stone-300"
                      >
                        Choose fewer
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmedOverload(true)}
                        className="px-4 py-2 rounded-xl font-sans text-sm font-medium border border-stone-300 text-stone-700 hover:bg-stone-100"
                      >
                        Continue anyway
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="font-sans text-sm text-stone-700">
                    {isOverloaded && confirmedOverload
                      ? 'You’re good. You can always move things later.'
                      : 'This fits your capacity.'}
                  </p>
                )}
              </motion.div>
            )}

            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="space-y-4"
              >
                <p className="font-sans text-sm text-stone-700">
                  Here’s your day. You can change it anytime in your timeline or planner.
                </p>
                {firstSelectedTask ? (
                  <div className="rounded-xl border-2 border-moss-200 bg-moss-50/80 p-4">
                    <p className="font-sans text-xs font-semibold uppercase tracking-wider text-moss-800 mb-1">
                      Do this first
                    </p>
                    <p className="font-sans text-base font-medium text-stone-900">{firstSelectedTask.title}</p>
                    {firstSelectedTask.goalTitle && firstSelectedTask.goalTitle !== firstSelectedTask.title && (
                      <p className="font-sans text-sm text-stone-600 mt-0.5">{firstSelectedTask.goalTitle}</p>
                    )}
                  </div>
                ) : selectedIds.size === 0 ? (
                  <p className="font-sans text-sm text-stone-500">No new tasks added. Your existing plan is unchanged.</p>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-5 py-4 border-t border-stone-200 flex justify-between gap-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2 rounded-xl font-sans text-sm font-medium text-stone-600 hover:bg-stone-200"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 6 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="px-4 py-2 rounded-xl font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 rounded-xl font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700"
            >
              Confirm
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
