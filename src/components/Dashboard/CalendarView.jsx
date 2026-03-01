import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { localISODate } from '../../services/dateUtils';
import { checkPlacementConflict, findNextAvailableStart, toCanonicalSlotKey } from '../../services/schedulingConflictService';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Build 6-week grid for a month. Each cell: { dateStr, dayNum, isCurrentMonth }. */
function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const firstDay = first.getDay();
  const daysInMonth = last.getDate();
  const cells = [];
  const pad = (n) => String(n).padStart(2, '0');
  const y = year;
  const m = month + 1;

  for (let i = 0; i < 42; i++) {
    const dayNum = i - firstDay + 1;
    if (dayNum < 1) {
      const prevLast = new Date(year, month, 0);
      const d = prevLast.getDate() + dayNum;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      cells.push({
        dateStr: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    } else if (dayNum > daysInMonth) {
      const d = dayNum - daysInMonth;
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      cells.push({
        dateStr: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    } else {
      cells.push({
        dateStr: `${y}-${pad(m)}-${pad(dayNum)}`,
        dayNum,
        isCurrentMonth: true,
      });
    }
  }
  return cells;
}

/** Get events for a date from weeklyEvents (start/end ISO). */
function getEventsForDate(weeklyEvents, dateStr) {
  if (!Array.isArray(weeklyEvents)) return [];
  return weeklyEvents.filter((e) => {
    const start = e.start ? new Date(e.start) : null;
    return start && localISODate(start) === dateStr;
  });
}

/** Get plan items for a date from weekAssignments. Returns array of { hour, assignment, title } for display. */
function getPlanItemsForDate(weekAssignments, goals, dateStr) {
  const dayPlan = weekAssignments?.[dateStr];
  if (!dayPlan || typeof dayPlan !== 'object') return [];
  const goalMap = new Map((goals ?? []).map((g) => [g.id, g]));
  return Object.entries(dayPlan)
    .filter(([, a]) => a != null)
    .map(([hour, a]) => {
      let title = '';
      if (typeof a === 'string') {
        const g = goalMap.get(a);
        title = g?.title ?? 'Task';
      } else if (a?.type === 'event') {
        title = a.title ?? 'Event';
      } else if (a?.title) {
        title = a.title;
      } else if (a?.goalId) {
        const g = goalMap.get(a.goalId);
        title = g?.title ?? a.ritualTitle ?? 'Task';
      } else {
        title = 'Task';
      }
      return { hour, assignment: a, title };
    })
    .sort((a, b) => Number(a.hour) - Number(b.hour));
}

export default function CalendarView({
  goals = [],
  weeklyEvents = [],
  weekAssignments = {},
  loadDayPlan,
  saveDayPlanForDate,
  onAutoPlanWeek,
  onRebalance,
  monthlyQuotas = [],
  rebalanceLoading = false,
  autoPlanLoading = false,
}) {
  const today = useMemo(() => localISODate(), []);
  const [view, setView] = useState('month');
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [quickAddConflict, setQuickAddConflict] = useState(null); // { conflictingItem } when placement would overwrite

  const [weekViewStartStr, setWeekViewStartStr] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    return localISODate(monday);
  });

  const weekViewDays = useMemo(() => {
    const start = new Date(weekViewStartStr + 'T12:00:00');
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { dateStr: localISODate(d), label: WEEKDAY_LABELS[d.getDay()], dayNum: d.getDate(), date: d };
    });
  }, [weekViewStartStr]);

  const weekStart = useMemo(() => {
    const d = new Date(currentYear, currentMonth, 1);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    return monday;
  }, [currentYear, currentMonth]);

  const monthLabel =
    view === 'week' && weekViewDays.length > 0
      ? `${MONTH_NAMES[weekViewDays[0].date.getMonth()]} ${weekViewDays[0].date.getFullYear()}`
      : `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  const monthGrid = useMemo(
    () => getMonthGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const goPrev = () => {
    if (view === 'month') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear((y) => y - 1);
      } else setCurrentMonth((m) => m - 1);
    } else {
      setWeekViewStartStr((prev) => {
        const d = new Date(prev + 'T12:00:00');
        d.setDate(d.getDate() - 7);
        setCurrentMonth(d.getMonth());
        setCurrentYear(d.getFullYear());
        return localISODate(d);
      });
    }
  };

  const goNext = () => {
    if (view === 'month') {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear((y) => y + 1);
      } else setCurrentMonth((m) => m + 1);
    } else {
      setWeekViewStartStr((prev) => {
        const d = new Date(prev + 'T12:00:00');
        d.setDate(d.getDate() + 7);
        setCurrentMonth(d.getMonth());
        setCurrentYear(d.getFullYear());
        return localISODate(d);
      });
    }
  };


  const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

  const closeQuickAddModal = () => {
    setSelectedDate(null);
    setQuickAddTitle('');
    setSelectedTime('09:00');
    setSelectedDuration(30);
    setQuickAddConflict(null);
  };

  const handleDayClick = (dateStr) => {
    setSelectedDate(dateStr);
    setQuickAddTitle('');
    setSelectedTime('09:00');
    setSelectedDuration(30);
  };

  const handleQuickAddGoal = async (dateStr, goalId) => {
    if (!saveDayPlanForDate || !loadDayPlan) return;
    setQuickAddConflict(null);
    setQuickAddSaving(true);
    try {
      const hour = new Date(`${dateStr}T${selectedTime}:00`).getHours();
      const plan = await loadDayPlan(dateStr);
      const planObj = plan && typeof plan === 'object' ? plan : {};
      const conflict = checkPlacementConflict(planObj, hour, selectedDuration);
      if (conflict.conflict) {
        setQuickAddConflict(conflict);
        setQuickAddSaving(false);
        return;
      }
      const exactDateTime = new Date(`${dateStr}T${selectedTime}:00`).toISOString();
      const next = { ...planObj };
      next[toCanonicalSlotKey(hour)] = {
        goalId,
        startTime: exactDateTime,
        duration: selectedDuration,
        type: 'fixed',
        isFixed: true,
      };
      await saveDayPlanForDate(dateStr, next);
      closeQuickAddModal();
    } finally {
      setQuickAddSaving(false);
    }
  };

  const handleQuickAddFreeform = async () => {
    if (!selectedDate || !quickAddTitle.trim() || !saveDayPlanForDate || !loadDayPlan) return;
    setQuickAddConflict(null);
    setQuickAddSaving(true);
    try {
      const hour = new Date(`${selectedDate}T${selectedTime}:00`).getHours();
      const plan = await loadDayPlan(selectedDate);
      const planObj = plan && typeof plan === 'object' ? plan : {};
      const conflict = checkPlacementConflict(planObj, hour, selectedDuration);
      if (conflict.conflict) {
        setQuickAddConflict(conflict);
        setQuickAddSaving(false);
        return;
      }
      const exactDateTime = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
      const next = { ...planObj };
      next[toCanonicalSlotKey(hour)] = {
        type: 'routineTemplate',
        routineId: `quick-${Date.now()}`,
        title: quickAddTitle.trim(),
        duration: selectedDuration,
        startTime: exactDateTime,
        fixed: true,
        isFixed: true,
      };
      await saveDayPlanForDate(selectedDate, next);
      closeQuickAddModal();
    } finally {
      setQuickAddSaving(false);
    }
  };

  const handleQuickAddUseNextSlot = async () => {
    if (!selectedDate || !loadDayPlan) return;
    const plan = await loadDayPlan(selectedDate);
    const planObj = plan && typeof plan === 'object' ? plan : {};
    const hour = new Date(`${selectedDate}T${selectedTime}:00`).getHours();
    const nextHour = findNextAvailableStart(planObj, hour + 1, selectedDuration);
    if (nextHour != null) {
      setSelectedTime(`${String(nextHour).padStart(2, '0')}:00`);
      setQuickAddConflict(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-stone-100 p-1 border border-stone-200">
            <button
              type="button"
              onClick={() => setView('month')}
              className={`px-4 py-2 rounded-lg font-sans text-sm font-medium transition-all ${view === 'month' ? 'bg-white shadow text-stone-800' : 'text-stone-600 hover:text-stone-800'}`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => {
                setView('week');
                setWeekViewStartStr(localISODate(weekStart));
              }}
              className={`px-4 py-2 rounded-lg font-sans text-sm font-medium transition-all ${view === 'week' ? 'bg-white shadow text-stone-800' : 'text-stone-600 hover:text-stone-800'}`}
            >
              Week
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              className="w-10 h-10 rounded-xl border border-stone-200 bg-white flex items-center justify-center text-stone-600 hover:bg-stone-50 font-sans text-lg leading-none"
              aria-label="Previous"
            >
              ‹
            </button>
            <span className="min-w-[180px] text-center font-serif text-lg font-semibold text-stone-800">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={goNext}
              className="w-10 h-10 rounded-xl border border-stone-200 bg-white flex items-center justify-center text-stone-600 hover:bg-stone-50 font-sans text-lg leading-none"
              aria-label="Next"
            >
              ›
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAutoPlanWeek}
            disabled={autoPlanLoading}
            className="px-4 py-2 rounded-xl bg-indigo-100 text-indigo-800 font-sans text-sm font-medium hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
          >
            {autoPlanLoading ? '…' : '✨ Auto-Plan Week'}
          </button>
          {Array.isArray(monthlyQuotas) && monthlyQuotas.length > 0 && (
            <button
              type="button"
              onClick={() => onRebalance?.(monthlyQuotas[0])}
              disabled={rebalanceLoading}
              className="px-4 py-2 rounded-xl bg-amber-100 text-amber-800 font-sans text-sm font-medium hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
            >
              {rebalanceLoading ? '…' : '⚖️ Rebalance Month'}
            </button>
          )}
        </div>
      </div>

      {/* Month View: 7-column grid */}
      {view === 'month' && (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50/80">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-2 text-center font-sans text-xs font-semibold text-stone-500 uppercase tracking-wide"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr min-h-[420px]">
            {monthGrid.map((cell) => {
              const events = getEventsForDate(weeklyEvents, cell.dateStr);
              const planItems = getPlanItemsForDate(weekAssignments, goals, cell.dateStr);
              const isToday = cell.dateStr === today;
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => handleDayClick(cell.dateStr)}
                  className={`min-h-[80px] p-2 border-b border-r border-stone-100 text-left flex flex-col gap-0.5 hover:bg-moss-50/50 transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:ring-inset ${
                    cell.isCurrentMonth ? 'bg-white text-stone-800' : 'bg-stone-50/50 text-stone-400'
                  } ${isToday ? 'ring-2 ring-moss-500/60 ring-inset' : ''}`}
                >
                  <span className={`font-sans text-sm font-medium ${isToday ? 'text-moss-700' : ''}`}>
                    {cell.dayNum}
                  </span>
                  <div className="flex-1 overflow-hidden space-y-0.5">
                    {events.slice(0, 2).map((e, i) => (
                      <div
                        key={i}
                        className="truncate text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800"
                        title={e.title}
                      >
                        {e.title}
                      </div>
                    ))}
                    {planItems.slice(0, 2).map((item, i) => (
                      <div
                        key={i}
                        className="truncate text-[10px] px-1.5 py-0.5 rounded bg-moss-100 text-moss-800"
                        title={`${item.hour}:00 ${item.title}`}
                      >
                        {item.hour}:00 {item.title}
                      </div>
                    ))}
                    {(events.length + planItems.length) > 4 && (
                      <span className="text-[10px] text-stone-400">
                        +{events.length + planItems.length - 4} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View: 7 columns with lists */}
      {view === 'week' && (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50/80">
            {weekViewDays.map(({ dateStr, label, dayNum, date }) => {
              const isToday = dateStr === today;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleDayClick(dateStr)}
                  className={`p-3 text-left border-r border-stone-200 last:border-r-0 hover:bg-moss-50/50 transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${isToday ? 'bg-moss-50/80 ring-2 ring-moss-500/40' : ''}`}
                >
                  <div className="font-sans text-xs text-stone-500 uppercase tracking-wide">{label}</div>
                  <div className={`font-serif text-lg font-semibold ${isToday ? 'text-moss-700' : 'text-stone-800'}`}>
                    {dayNum}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-7 min-h-[320px]">
            {weekViewDays.map(({ dateStr }) => {
              const events = getEventsForDate(weeklyEvents, dateStr);
              const planItems = getPlanItemsForDate(weekAssignments, goals, dateStr);
              const all = [
                ...events.map((e) => ({ type: 'event', title: e.title, time: e.start })),
                ...planItems.map((p) => ({ type: 'plan', title: p.title, time: `${p.hour}:00` })),
              ].sort((a, b) => String(a.time).localeCompare(String(b.time)));
              return (
                <div key={dateStr} className="min-h-[200px] p-2 border-r border-stone-100 last:border-r-0 bg-white">
                  {all.length === 0 ? (
                    <p className="text-xs text-stone-400 py-2">Tap header to add</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {all.map((item, i) => (
                        <li
                          key={i}
                          className={`text-xs px-2 py-1.5 rounded-xl truncate transition-shadow hover:shadow-md ${
                            item.type === 'event' ? 'bg-sky-100 text-sky-800' : 'bg-moss-100 text-moss-800'
                          }`}
                        >
                          {item.time && <span className="font-mono text-[10px] opacity-80 mr-1">{item.time}</span>}
                          {item.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick-add modal */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm"
            onClick={closeQuickAddModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-add-title"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white border border-stone-200 shadow-xl p-6"
            >
              <h2 id="quick-add-title" className="font-serif text-xl font-bold text-stone-800 mb-1">
                Add task
              </h2>
              <p className="font-sans text-sm text-stone-500 mb-4">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <div className="space-y-3 mb-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-sans text-sm font-medium text-stone-700 mb-1">Start time</label>
                    <input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="w-full p-2 rounded-xl border border-stone-200 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                    />
                  </div>
                  <div>
                    <label className="block font-sans text-sm font-medium text-stone-700 mb-1">Duration</label>
                    <select
                      value={selectedDuration}
                      onChange={(e) => setSelectedDuration(Number(e.target.value))}
                      className="w-full p-2 rounded-xl border border-stone-200 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/50 bg-white"
                    >
                      {DURATION_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m} min
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {quickAddConflict?.conflict && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200" role="alert">
                    <p className="font-sans text-sm text-amber-900">
                      This time overlaps with &quot;{quickAddConflict.conflictingItem?.title ?? 'another item'}&quot;.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setQuickAddConflict(null)}
                        className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-stone-200 text-stone-800 hover:bg-stone-300"
                      >
                        Don&apos;t add
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickAddUseNextSlot}
                        className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700"
                      >
                        Find next slot
                      </button>
                    </div>
                  </div>
                )}
                <label className="block font-sans text-sm font-medium text-stone-700">Quick add (free-form)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickAddTitle}
                    onChange={(e) => setQuickAddTitle(e.target.value)}
                    placeholder="e.g. Review docs"
                    className="flex-1 py-2 px-3 rounded-xl border border-stone-200 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddFreeform}
                    disabled={!quickAddTitle.trim() || quickAddSaving}
                    className="px-4 py-2 rounded-xl bg-moss-600 text-white font-sans text-sm font-medium hover:bg-moss-700 disabled:opacity-50"
                  >
                    {quickAddSaving ? '…' : 'Add'}
                  </button>
                </div>
                {goals.length > 0 && (
                  <>
                    <label className="block font-sans text-sm font-medium text-stone-700 mt-4">Or add a goal</label>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {goals.filter((g) => g.type !== 'routine').slice(0, 10).map((g) => (
                        <li key={g.id}>
                          <button
                            type="button"
                            onClick={() => handleQuickAddGoal(selectedDate, g.id)}
                            disabled={quickAddSaving}
                            className="w-full text-left py-2 px-3 rounded-lg font-sans text-sm text-stone-800 hover:bg-stone-100 disabled:opacity-50"
                          >
                            {g.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={closeQuickAddModal}
                className="w-full py-2 rounded-xl font-sans text-sm text-stone-500 hover:bg-stone-100"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
