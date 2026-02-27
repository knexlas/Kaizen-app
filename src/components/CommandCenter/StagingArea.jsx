import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { localISODate } from '../../services/dateUtils';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_DAILY_SPARKS = 10;

/** Format day-plan hour key (e.g. 9 or 9.5) as display time "9:00" or "9:30". Exported for Command Center Today strip. */
export function formatHourKey(key) {
  const n = Number(key);
  if (!Number.isFinite(n)) return `${key}`;
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  if (m === 0) return `${h}:00`;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return isMobile;
}

/** Build list of unscheduled staging tasks from goals: narrative breakdown + flexible subtasks (no deadline). Excludes routines and recurrence. Someday Vault: only tasks for current month or milestone without activeMonth. */
export function buildBacklogTasks(goals, currentMonthStr) {
  const list = [];
  const seen = new Set();
  const month = currentMonthStr && currentMonthStr.length >= 7 ? currentMonthStr.slice(0, 7) : null; // YYYY-MM

  (goals || []).forEach((goal) => {
    if (goal.type === 'routine' || goal.recurrence) return;
    const breakdown = goal.narrativeBreakdown;
    if (breakdown && Array.isArray(breakdown.milestones)) {
      breakdown.milestones.forEach((milestone, mi) => {
        const activeMonth = milestone.activeMonth ?? milestone.active_month ?? null;
        if (month && activeMonth && activeMonth !== month) return;
        (milestone.tasks || []).forEach((task, ti) => {
          const id = `narrative-${goal.id}-m${mi}-t${ti}`;
          if (seen.has(id)) return;
          seen.add(id);
          list.push({
            id,
            title: task.title || 'Task',
            goalId: goal.id,
            goalTitle: goal.title,
            milestoneTitle: milestone.title ?? `Phase ${mi + 1}`,
            source: 'narrative',
            milestoneIndex: mi,
            taskIndex: ti,
            estimatedSparks: task.estimatedSparks ?? 2,
            isKaizen: Boolean(task.isKaizen),
            defaultStatus: 'active',
          });
        });
      });
    }

    const subtasks = Array.isArray(goal.subtasks) ? goal.subtasks : [];
    subtasks.forEach((st) => {
      if (st.deadline) return;
      const id = `subtask-${goal.id}-${st.id}`;
      if (seen.has(id)) return;
      seen.add(id);
      list.push({
        id,
        title: st.title || 'Subtask',
        goalId: goal.id,
        goalTitle: goal.title,
        source: 'subtask',
        subtaskId: st.id,
        estimatedSparks: 2,
        isKaizen: false,
        defaultStatus: 'someday',
      });
    });
  });

  return list;
}

/** Group flat backlog tasks into tree: goal → milestones (or Subtasks) → tasks. For display/accordion only. */
export function buildBacklogTree(flatTasks) {
  if (!Array.isArray(flatTasks) || flatTasks.length === 0) return [];
  const byGoal = new Map();
  flatTasks.forEach((task) => {
    const gid = task.goalId ?? 'unknown';
    if (!byGoal.has(gid)) {
      byGoal.set(gid, { goalId: gid, goalTitle: task.goalTitle ?? 'Goal', milestones: [], subtasks: [] });
    }
    const goalNode = byGoal.get(gid);
    if (task.source === 'subtask') {
      goalNode.subtasks.push(task);
    } else {
      const mi = task.milestoneIndex ?? 0;
      const mTitle = task.milestoneTitle ?? `Phase ${mi + 1}`;
      let mile = goalNode.milestones.find((m) => m.milestoneIndex === mi);
      if (!mile) {
        mile = { milestoneTitle: mTitle, milestoneIndex: mi, tasks: [] };
        goalNode.milestones.push(mile);
      }
      mile.tasks.push(task);
    }
  });
  byGoal.forEach((node) => {
    node.milestones.sort((a, b) => a.milestoneIndex - b.milestoneIndex);
  });
  return Array.from(byGoal.values());
}

/** Get events for a date from weeklyEvents (start/end ISO). */
function getEventsForDate(weeklyEvents, dateStr) {
  if (!Array.isArray(weeklyEvents)) return [];
  return weeklyEvents.filter((e) => {
    const start = e.start ? new Date(e.start) : null;
    return start && localISODate(start) === dateStr;
  });
}

function isAssignmentFixed(a) {
  if (!a || typeof a !== 'object') return false;
  return a.isFixed === true || a.type === 'fixed' || a.fixed === true;
}

/** Capacity bar for a day column: total Sparks vs max; warning when over. */
function CapacityBar({ totalSparks, maxSparks = MAX_DAILY_SPARKS }) {
  const pct = Math.min(100, (totalSparks / maxSparks) * 100);
  const isOver = totalSparks > maxSparks;
  return (
    <div className="shrink-0 px-1 py-1.5" title={isOver ? 'This day is looking pretty full!' : undefined}>
      <div className="h-2 w-full rounded-full bg-stone-300 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOver ? 'bg-amber-400' : 'bg-moss-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-stone-500 mt-0.5 tabular-nums" title={isOver ? 'This day is looking pretty full!' : undefined}>
        {totalSparks}/{maxSparks}
      </p>
      {isOver && (
        <p className="text-[10px] text-amber-700 truncate" title="This day is looking pretty full!">
          Pretty full
        </p>
      )}
    </div>
  );
}

/** Time slots: every 15 min from 8:00 to 20:00 (8 + i/4 for i = 0..48). */
const TIME_SLOT_OPTIONS = Array.from({ length: 49 }, (_, i) => 8 + i / 4);

/** Accordion list: goal → milestone → tasks. compact = picker (click only); otherwise supports drag. scheduleButtonLabel = "Pick a day" style for Someday. */
function GroupedBacklogList({ flatTasks, selectedTaskId, onSelectTask, compact = false, renderDraggableTask, scheduleButtonLabel }) {
  const tree = useMemo(() => buildBacklogTree(flatTasks), [flatTasks]);
  const [expandedGoalId, setExpandedGoalId] = useState(null);
  const [expandedMilestone, setExpandedMilestone] = useState(null); // 'goalId-milestoneIndex' or 'goalId-subtasks'

  if (!Array.isArray(flatTasks) || flatTasks.length === 0) {
    return (
      <div className={compact ? 'max-h-40 overflow-y-auto rounded-lg border border-stone-200' : ''}>
        <p className="px-3 py-4 font-sans text-sm text-stone-400">No tasks in backlog. Add goals first.</p>
      </div>
    );
  }

  const toggleGoal = (goalId) => setExpandedGoalId((prev) => (prev === goalId ? null : goalId));
  const toggleMilestone = (key) => setExpandedMilestone((prev) => (prev === key ? null : key));

  return (
    <div className={compact ? 'max-h-40 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100' : 'space-y-2'}>
      {tree.map((goalNode) => {
        const goalOpen = expandedGoalId === goalNode.goalId;
        return (
          <div key={goalNode.goalId} className="rounded-lg border border-stone-100 bg-stone-50/80 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGoal(goalNode.goalId)}
              className="w-full flex items-center justify-between gap-2 py-2 px-3 text-left hover:bg-stone-100/80 font-sans text-sm font-medium text-stone-800"
            >
              <span className="truncate">{goalNode.goalTitle}</span>
              <span className="shrink-0 text-stone-400" aria-hidden>{goalOpen ? '▼' : '▶'}</span>
            </button>
            {goalOpen && (
              <div className="border-t border-stone-200 bg-white/60 px-2 pb-2 space-y-1">
                {goalNode.milestones.map((mil) => {
                  const mKey = `${goalNode.goalId}-m${mil.milestoneIndex}`;
                  const mileOpen = expandedMilestone === mKey;
                  return (
                    <div key={mKey} className="rounded border border-stone-100 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleMilestone(mKey)}
                        className="w-full flex items-center justify-between gap-2 py-1.5 px-2 text-left hover:bg-stone-50 font-sans text-xs font-semibold text-stone-600 uppercase tracking-wider"
                      >
                        <span className="truncate">{mil.milestoneTitle}</span>
                        <span className="shrink-0 text-stone-400">{mileOpen ? '▼' : '▶'}</span>
                      </button>
                      {mileOpen && (
                        <div className="bg-white">
                          {mil.tasks.map((task) =>
                            compact ? (
                              <button
                                key={task.id}
                                type="button"
                                onClick={() => onSelectTask(task)}
                                className={`w-full text-left px-3 py-2 font-sans text-sm transition-colors ${selectedTaskId === task.id ? 'bg-moss-100 text-moss-900' : 'hover:bg-stone-50 text-stone-800'}`}
                              >
                                <span className="block truncate font-medium">{task.title}</span>
                              </button>
                            ) : renderDraggableTask ? (
                              renderDraggableTask(task)
                            ) : scheduleButtonLabel && onSelectTask ? (
                              <div key={task.id} className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-sm font-sans text-sm text-stone-800 flex flex-col gap-1.5">
                                <span className="block truncate font-medium">{task.title}</span>
                                {task.goalTitle && <span className="block text-xs text-stone-500 truncate">{task.goalTitle}</span>}
                                <button type="button" onClick={() => onSelectTask({ type: 'staging-task', task })} className="self-start mt-0.5 text-xs font-medium text-moss-600 hover:text-moss-700">
                                  {scheduleButtonLabel}
                                </button>
                              </div>
                            ) : onSelectTask ? (
                              <button
                                key={task.id}
                                type="button"
                                onClick={() => onSelectTask({ type: 'staging-task', task })}
                                className="w-full text-left rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-sm hover:bg-stone-50 font-sans text-sm font-medium text-stone-800"
                              >
                                <span className="block truncate">{task.title}</span>
                                {task.goalTitle && <span className="block font-sans text-xs text-stone-500 truncate mt-0.5">{task.goalTitle}</span>}
                              </button>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {goalNode.subtasks.length > 0 && (
                  <div className="rounded border border-stone-100 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleMilestone(`${goalNode.goalId}-subtasks`)}
                      className="w-full flex items-center justify-between gap-2 py-1.5 px-2 text-left hover:bg-stone-50 font-sans text-xs font-semibold text-stone-600 uppercase tracking-wider"
                    >
                      <span>Subtasks</span>
                      <span className="shrink-0 text-stone-400">{expandedMilestone === `${goalNode.goalId}-subtasks` ? '▼' : '▶'}</span>
                    </button>
                    {expandedMilestone === `${goalNode.goalId}-subtasks` && (
                      <div className="bg-white">
                        {goalNode.subtasks.map((task) =>
                          compact ? (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => onSelectTask(task)}
                              className={`w-full text-left px-3 py-2 font-sans text-sm transition-colors ${selectedTaskId === task.id ? 'bg-moss-100 text-moss-900' : 'hover:bg-stone-50 text-stone-800'}`}
                            >
                              <span className="block truncate font-medium">{task.title}</span>
                            </button>
                          ) : renderDraggableTask ? (
                            renderDraggableTask(task)
                          ) : scheduleButtonLabel && onSelectTask ? (
                            <div key={task.id} className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-sm font-sans text-sm text-stone-800 flex flex-col gap-1.5">
                              <span className="block truncate font-medium">{task.title}</span>
                              {task.goalTitle && <span className="block text-xs text-stone-500 truncate">{task.goalTitle}</span>}
                              <button type="button" onClick={() => onSelectTask({ type: 'staging-task', task })} className="self-start mt-0.5 text-xs font-medium text-moss-600 hover:text-moss-700">
                                {scheduleButtonLabel}
                              </button>
                            </div>
                          ) : onSelectTask ? (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => onSelectTask({ type: 'staging-task', task })}
                              className="w-full text-left rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-sm hover:bg-stone-50 font-sans text-sm font-medium text-stone-800"
                            >
                              <span className="block truncate">{task.title}</span>
                              {task.goalTitle && <span className="block font-sans text-xs text-stone-500 truncate mt-0.5">{task.goalTitle}</span>}
                            </button>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Decimal hour (e.g. 9.5) to "HH:mm" for input type="time". */
function timeSlotToInput(slot) {
  const n = Number(slot);
  if (!Number.isFinite(n)) return '09:00';
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "HH:mm" string to decimal hour key. */
function inputToTimeSlot(str) {
  if (!str || typeof str !== 'string') return 9;
  const [h, m] = str.split(':').map(Number);
  if (!Number.isFinite(h)) return 9;
  const mins = Number.isFinite(m) ? m : 0;
  return h + mins / 60;
}

/** Drawer: "Schedule for [date]" — pick time + task from backlog, or add event/block. */
export function PlanDayDrawer({ dateStr, open, onClose, backlogTasks, loadDayPlan, saveDayPlanForDate, goals = [] }) {
  const [planMode, setPlanMode] = useState('task'); // 'task' | 'event'
  const [timeSlot, setTimeSlot] = useState(9);
  const [timeInput, setTimeInput] = useState('09:00');
  const [selectedTask, setSelectedTask] = useState(null);
  const [eventTitle, setEventTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [existingPlan, setExistingPlan] = useState(null);

  useEffect(() => {
    if (!open || !dateStr) return;
    setSelectedTask(null);
    setEventTitle('');
    let cancelled = false;
    (async () => {
      try {
        const plan = typeof loadDayPlan === 'function' ? await loadDayPlan(dateStr) : null;
        if (cancelled) return;
        const planObj = plan && typeof plan === 'object' ? plan : {};
        setExistingPlan(planObj);
        const usedSlots = new Set(Object.keys(planObj).map(Number));
        const firstFree = TIME_SLOT_OPTIONS.find((s) => !usedSlots.has(s));
        const slot = firstFree !== undefined ? firstFree : 9;
        setTimeSlot(slot);
        setTimeInput(timeSlotToInput(slot));
      } catch {
        if (!cancelled) {
          setTimeSlot(9);
          setTimeInput('09:00');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, dateStr, loadDayPlan]);

  const handleSave = useCallback(async (addAnother = false) => {
    if (!dateStr || !selectedTask || typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return;
    setSaving(true);
    try {
      const plan = await loadDayPlan(dateStr);
      const next = { ...(plan && typeof plan === 'object' ? plan : {}) };
      next[String(timeSlot)] = {
        goalId: selectedTask.goalId,
        title: selectedTask.title,
      };
      await saveDayPlanForDate(dateStr, next);
      if (addAnother) {
        setSelectedTask(null);
        const planAfter = await loadDayPlan(dateStr);
        const planObj = planAfter && typeof planAfter === 'object' ? planAfter : {};
        setExistingPlan(planObj);
        const usedSlots = new Set(Object.keys(planObj).map(Number));
        const firstFree = TIME_SLOT_OPTIONS.find((s) => !usedSlots.has(s));
        const slot = firstFree !== undefined ? firstFree : 9;
        setTimeSlot(slot);
        setTimeInput(timeSlotToInput(slot));
      } else {
        onClose();
      }
    } catch (err) {
      console.warn('PlanDayDrawer save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [dateStr, timeSlot, selectedTask, loadDayPlan, saveDayPlanForDate, onClose]);

  const handleSaveEvent = useCallback(async (addAnother = false) => {
    const title = (eventTitle || '').trim();
    if (!dateStr || !title || typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return;
    setSaving(true);
    try {
      const plan = await loadDayPlan(dateStr);
      const next = { ...(plan && typeof plan === 'object' ? plan : {}) };
      next[String(timeSlot)] = { type: 'event', title };
      await saveDayPlanForDate(dateStr, next);
      if (addAnother) {
        setEventTitle('');
        const planAfter = await loadDayPlan(dateStr);
        const planObj = planAfter && typeof planAfter === 'object' ? planAfter : {};
        setExistingPlan(planObj);
        const usedSlots = new Set(Object.keys(planObj).map(Number));
        const firstFree = TIME_SLOT_OPTIONS.find((s) => !usedSlots.has(s));
        const slot = firstFree !== undefined ? firstFree : 9;
        setTimeSlot(slot);
        setTimeInput(timeSlotToInput(slot));
      } else {
        onClose();
      }
    } catch (err) {
      console.warn('PlanDayDrawer save event failed:', err);
    } finally {
      setSaving(false);
    }
  }, [dateStr, timeSlot, eventTitle, loadDayPlan, saveDayPlanForDate, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !dateStr) return null;
  const dateLabel = (() => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  })();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-day-drawer-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-2xl bg-white border border-stone-200 shadow-xl p-4 max-h-[90vh] overflow-y-auto flex flex-col"
        >
          <h2 id="plan-day-drawer-title" className="font-serif text-stone-900 text-lg mb-1">
            Schedule for this day
          </h2>
          <p className="font-sans text-sm text-stone-500 mb-2">{dateLabel}</p>
          {existingPlan && Object.keys(existingPlan).length > 0 && (
            <div className="mb-3 p-2.5 rounded-lg bg-stone-50 border border-stone-200">
              <p className="font-sans text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">Already scheduled</p>
              <ul className="space-y-0.5 font-sans text-sm text-stone-700">
                {Object.entries(existingPlan)
                  .filter(([, a]) => a != null)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([hour, a]) => {
                    let title = 'Task';
                    if (typeof a === 'object' && a.type === 'event') title = a.title ?? 'Event';
                    else if (typeof a === 'object' && a.title) title = a.title;
                    else if (typeof a === 'object' && a.goalId) {
                      const g = (goals || []).find((x) => x.id === a.goalId);
                      title = g?.title ?? a.ritualTitle ?? 'Task';
                    } else if (typeof a === 'string') {
                      const g = (goals || []).find((x) => x.id === a);
                      title = g?.title ?? 'Task';
                    }
                    return (
                      <li key={hour} className="flex gap-2">
                        <span className="font-mono text-xs text-stone-500 shrink-0">{formatHourKey(Number(hour))}</span>
                        <span className="truncate">{title}</span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
          <div className="flex gap-1 border-b border-stone-200 mb-3">
            <button
              type="button"
              onClick={() => setPlanMode('task')}
              className={`px-3 py-2 font-sans text-sm font-medium rounded-t ${planMode === 'task' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Schedule a task
            </button>
            <button
              type="button"
              onClick={() => setPlanMode('event')}
              className={`px-3 py-2 font-sans text-sm font-medium rounded-t ${planMode === 'event' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Add event / block
            </button>
          </div>
          <div className="space-y-3 mb-4">
            <label className="block font-sans text-sm font-medium text-stone-700">Time</label>
            <input
              type="time"
              value={timeInput}
              onChange={(e) => {
                const v = e.target.value;
                setTimeInput(v);
                setTimeSlot(inputToTimeSlot(v));
              }}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 font-sans text-sm"
            />
            {planMode === 'task' && (
              <>
                <label className="block font-sans text-sm font-medium text-stone-700">Task</label>
                <GroupedBacklogList
                  flatTasks={backlogTasks || []}
                  selectedTaskId={selectedTask?.id}
                  onSelectTask={setSelectedTask}
                  compact
                />
              </>
            )}
            {planMode === 'event' && (
              <>
                <label className="block font-sans text-sm font-medium text-stone-700">What</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. Meeting, Lunch, Focus block"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-sans text-sm"
                />
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 min-w-[80px] py-2.5 rounded-xl font-sans text-sm text-stone-500 hover:bg-stone-100">
              Done
            </button>
            {planMode === 'task' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={!selectedTask || saving}
                  className="flex-1 min-w-[80px] py-2.5 rounded-xl font-sans text-sm font-medium bg-stone-200 text-stone-800 hover:bg-stone-300 disabled:opacity-50"
                >
                  {saving ? '…' : 'Add another'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={!selectedTask || saving}
                  className="flex-1 min-w-[80px] py-2.5 rounded-xl font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-50"
                >
                  {saving ? '…' : 'Add'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveEvent(true)}
                  disabled={!eventTitle.trim() || saving}
                  className="flex-1 min-w-[80px] py-2.5 rounded-xl font-sans text-sm font-medium bg-stone-200 text-stone-800 hover:bg-stone-300 disabled:opacity-50"
                >
                  {saving ? '…' : 'Add another'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEvent(false)}
                  disabled={!eventTitle.trim() || saving}
                  className="flex-1 min-w-[80px] py-2.5 rounded-xl font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-50"
                >
                  {saving ? '…' : 'Add'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Bottom sheet for mobile: "Schedule [Task] for:" with day buttons. */
function ScheduleDrawer({ selected, open, onClose, weekViewDays, today, onSelectDay, weekAssignments = {}, weeklyEvents = [], goals = [], scheduledTasks = {} }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !selected) return null;
  const title = selected.task?.title ?? selected.item?.title ?? 'Task';
  const dayLabels = weekViewDays.map(({ dateStr }) => {
    const d = new Date(dateStr + 'T12:00:00');
    const isToday = dateStr === today;
    const isTomorrow = (() => {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      return localISODate(t) === dateStr;
    })();
    const short = d.toLocaleDateString(undefined, { weekday: 'short' });
    const events = getEventsForDate(weeklyEvents, dateStr);
    const planItems = getPlanItemsForDate(weekAssignments, goals, dateStr);
    const scheduled = scheduledTasks[dateStr] || [];
    const eventCount = events.length;
    const taskCount = planItems.length + scheduled.length;
    const loadHint = eventCount > 0 && taskCount > 0
      ? `${eventCount} event${eventCount !== 1 ? 's' : ''}, ${taskCount} task${taskCount !== 1 ? 's' : ''}`
      : eventCount > 0
        ? `${eventCount} event${eventCount !== 1 ? 's' : ''}`
        : taskCount > 0
          ? `${taskCount} task${taskCount !== 1 ? 's' : ''}`
          : null;
    return { dateStr, label: isToday ? 'Today' : isTomorrow ? 'Tomorrow' : short, loadHint };
  });
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-drawer-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-2xl bg-white border border-stone-200 shadow-xl p-4"
        >
          <h2 id="schedule-drawer-title" className="font-serif text-stone-900 text-lg mb-1">
            Schedule for:
          </h2>
          <p className="font-sans text-sm text-moss-700 font-medium truncate mb-4">{title}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {dayLabels.map(({ dateStr, label, loadHint }) => (
              <button
                key={dateStr}
                type="button"
                onClick={() => {
                  onSelectDay(dateStr);
                  onClose();
                }}
                className="py-3 px-3 rounded-xl font-sans text-sm font-medium bg-moss-100 text-moss-800 hover:bg-moss-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 flex flex-col items-center gap-0.5"
              >
                <span>{label}</span>
                {loadHint && <span className="text-xs font-normal text-moss-600">{loadHint}</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-4 py-2.5 rounded-xl font-sans text-sm text-stone-500 hover:bg-stone-100"
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Get plan items for a date from weekAssignments (with isFixed for visual weight). Exported for Command Center Today strip. */
export function getPlanItemsForDate(weekAssignments, goals, dateStr) {
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
      } else if (a?.type === 'event') title = a.title ?? 'Event';
      else if (a?.title) title = a.title;
      else if (a?.goalId) {
        const g = goalMap.get(a.goalId);
        title = g?.title ?? a.ritualTitle ?? 'Task';
      } else title = 'Task';
      return { hour, assignment: a, title, isFixed: isAssignmentFixed(a) };
    })
    .sort((a, b) => Number(a.hour) - Number(b.hour));
}

/** Single task/event card on the timeline: fixed = solid + bold + lock; flexible = soft + dashed + leaf; event = sky. */
function TimelineTaskCard({ title, timeLabel, isFixed, variant = 'plan' }) {
  const isEvent = variant === 'event';
  if (isFixed) {
    return (
      <div
        className={`text-sm px-2.5 py-2 rounded-lg truncate border-2 font-semibold flex items-center gap-1.5 shadow-sm ${
          isEvent ? 'border-sky-300 bg-sky-100 text-sky-900' : 'border-stone-300 bg-stone-100 text-stone-900'
        }`}
      >
        {timeLabel && <span className="font-mono text-xs opacity-90 shrink-0">{timeLabel}</span>}
        <span className="truncate">{title}</span>
        <span className="shrink-0" aria-hidden>🔒</span>
      </div>
    );
  }
  if (isEvent) {
    return (
      <div className="text-sm px-2.5 py-2 rounded-lg truncate border border-sky-300 bg-sky-50/80 text-sky-900 flex items-center gap-1.5">
        {timeLabel && <span className="font-mono text-xs opacity-90 shrink-0">{timeLabel}</span>}
        <span className="truncate">{title}</span>
      </div>
    );
  }
  return (
    <div className="text-sm px-2.5 py-2 rounded-lg truncate border border-dashed border-moss-300 bg-moss-50/80 text-moss-900 flex items-center gap-1.5">
      {timeLabel && <span className="font-mono text-xs opacity-90 shrink-0">{timeLabel}</span>}
      <span className="truncate">{title}</span>
      <span className="shrink-0" aria-hidden>🍃</span>
    </div>
  );
}

function DraggableNeedsReschedulingTask({ item, isDragging }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `reschedule-${item.id}`,
    data: { type: 'needs-rescheduling', item },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${isDragging ? 'opacity-50 shadow-md' : 'hover:bg-amber-100'}`}
    >
      <div className="font-sans text-sm font-medium text-amber-900 truncate">{item.title}</div>
      <div className="font-sans text-xs text-amber-700 mt-0.5">Mandatory · drop on a day to reschedule</div>
    </div>
  );
}

function DraggableBacklogTask({ task, isDragging, onTaskClick }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: task.id,
    data: { type: 'staging-task', task },
  });
  const taskRef = task.source === 'narrative'
    ? { type: 'narrative', goalId: task.goalId, milestoneIndex: task.milestoneIndex, taskIndex: task.taskIndex }
    : task.source === 'subtask'
      ? { type: 'subtask', goalId: task.goalId, subtaskId: task.subtaskId }
      : null;
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 flex items-start gap-2 ${isDragging ? 'opacity-50 shadow-md' : 'hover:bg-stone-50'}`}
    >
      <div {...listeners} {...attributes} className="flex-1 min-w-0 cursor-grab active:cursor-grabbing">
        <div className="font-sans text-sm font-medium text-stone-800 truncate">{task.title}</div>
        {(task.milestoneTitle || task.goalTitle) && (
          <div className="font-sans text-xs text-stone-500 truncate mt-0.5">
            {task.source === 'narrative' && task.milestoneTitle
              ? `${task.milestoneTitle}${task.goalTitle ? ` · ${task.goalTitle}` : ''}`
              : task.goalTitle}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-stone-400 text-xs">{'✦'.repeat(task.estimatedSparks || 1)}</span>
          {task.isKaizen && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-moss-100 text-moss-700">Kaizen</span>
          )}
        </div>
      </div>
      {onTaskClick && taskRef && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onTaskClick(taskRef); }} className="shrink-0 p-1.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100" title="Task details & notes">
          📝
        </button>
      )}
    </div>
  );
}

/** Spawned volume block from Sunday Ritual Pacer — drag onto a day to schedule. */
function DraggableSpawnedVolumeBlock({ block, isDragging }) {
  const metric = (block.targetMetric ?? 'Hours').toLowerCase();
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: block.id,
    data: { type: 'spawned-volume-block', block },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-lg border border-moss-300 bg-moss-50 px-3 py-2 shadow-sm cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${isDragging ? 'opacity-50 shadow-md' : 'hover:bg-moss-100/80'}`}
    >
      <div className="font-sans text-sm font-medium text-moss-900 truncate">{block.goalTitle} ({block.blockValue} {metric})</div>
      <div className="font-sans text-[10px] text-moss-600 mt-0.5">From Pacing · drag to a day</div>
    </div>
  );
}

/** Volume goal card: drag to spawn a time block (generator). */
function DraggableVolumeGeneratorCard({ goal, isDragging }) {
  const progress = goal.currentProgress ?? 0;
  const target = goal.targetValue ?? 0;
  const metric = goal.targetMetric ?? 'Hours';
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `volume-gen-${goal.id}`,
    data: { type: 'volume-generator', goal },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-lg border-2 border-dashed border-moss-400 bg-moss-50/80 px-3 py-2 shadow-sm cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${isDragging ? 'opacity-50 shadow-md' : 'hover:bg-moss-100/80'}`}
    >
      <div className="font-sans text-sm font-medium text-moss-900 truncate">{goal.title}</div>
      <div className="font-sans text-xs text-moss-700 mt-0.5">
        {progress}/{target} {metric.toLowerCase()}
      </div>
      <div className="font-sans text-[10px] text-moss-600 mt-1">Drag to add a time block</div>
    </div>
  );
}

/** Droppable slot for "bump": dropping a backlog task here replaces this flexible task (sends it back to backlog). */
function DroppableBumpSlot({ dateStr, displacedTask, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `bump-${dateStr}-${displacedTask.id}`,
    data: { type: 'bump-slot', dateStr, displacedTask },
  });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[28px] rounded-lg ${isOver ? 'ring-2 ring-moss-400 bg-moss-100' : ''}`}
    >
      {children}
    </div>
  );
}

function DraggableScheduledTask({ task, isDragging, dateStr, onCompleteVolumeBlock, onTaskClick }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: task.id,
    data: { type: 'staging-task', task },
  });
  const isVolumeBlock = task.source === 'volume-block' && task.volumeGoalId != null;
  const hasTaskDetail = task.source === 'narrative' || task.source === 'subtask';
  return (
    <div
      ref={setNodeRef}
      className={`text-sm px-2.5 py-2 rounded-lg border border-dashed flex items-center gap-1.5 ${
        isDragging ? 'opacity-50 bg-moss-200 border-moss-300' : 'bg-moss-50/80 text-moss-800 border-moss-300'
      }`}
    >
      <div {...listeners} {...attributes} className="flex-1 min-w-0 flex items-center gap-1.5 cursor-grab active:cursor-grabbing focus:outline-none">
        <span className="truncate">{task.title}</span>
        <span className="shrink-0" aria-hidden>🍃</span>
      </div>
      {onTaskClick && hasTaskDetail && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onTaskClick({ type: 'staging', task }); }} className="shrink-0 p-1 rounded text-stone-400 hover:text-stone-600" title="Details & notes">
          📝
        </button>
      )}
      {isVolumeBlock && onCompleteVolumeBlock && dateStr && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCompleteVolumeBlock(task, dateStr); }}
          className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-moss-600 text-white hover:bg-moss-700"
          title="Mark done and add to quota"
        >
          Done
        </button>
      )}
    </div>
  );
}

function DroppableDayColumn({ dateStr, label, dayNum, isToday, children, scheduledForDay, events, planItems, activeDragId, isPaused, totalSparks, onCompleteVolumeBlock, onTaskClick, onPlanDay }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${dateStr}`,
    data: { type: 'day', dateStr, isPaused: !!isPaused },
  });
  const isDragging = Boolean(activeDragId);
  const isOverCapacity = isDragging && totalSparks != null && totalSparks >= MAX_DAILY_SPARKS && !isOver;
  return (
    <div
      ref={setNodeRef}
      className={`relative flex flex-col min-w-[100px] flex-1 border-r-2 border-stone-200 last:border-r-0 ${isToday ? 'border-l-4 border-l-moss-500 bg-moss-50/30' : ''} ${isOver && !isPaused ? 'bg-moss-50 ring-2 ring-moss-400/50 ring-inset' : ''} ${!isPaused && !isOver && !isToday ? 'bg-stone-50/50' : ''} ${isPaused ? 'bg-slate-100/80' : ''} ${isOverCapacity ? 'opacity-75 ring-2 ring-amber-300/60 ring-inset' : ''}`}
    >
      {isPaused && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-300/60 rounded-sm m-1 pointer-events-none" aria-hidden>
          <span className="font-sans text-xs font-medium text-slate-700 px-2 py-1.5 rounded bg-white/95 shadow-sm">Recovery · Do not disturb</span>
        </div>
      )}
      <div
        className={`shrink-0 py-2.5 px-1.5 text-center border-b-2 ${
          isToday ? 'bg-moss-100 font-semibold text-moss-900 border-moss-300' : 'bg-stone-100 text-stone-800 border-stone-200'
        } ${isPaused ? 'opacity-75' : ''}`}
      >
        <div className="font-sans text-xs font-medium uppercase tracking-wide">{label}</div>
        <div className="font-serif text-2xl mt-0.5">{dayNum}</div>
        {totalSparks != null && (
          <CapacityBar totalSparks={totalSparks} maxSparks={MAX_DAILY_SPARKS} />
        )}
      </div>
      <div className="flex-1 min-h-[200px] p-2.5 flex flex-col gap-1.5 overflow-y-auto">
        {events.map((e, i) => (
          <TimelineTaskCard
            key={`ev-${i}`}
            title={e.title}
            timeLabel={e.start ? new Date(e.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null}
            isFixed
            variant="event"
          />
        ))}
        {planItems.map((p, i) => (
          <TimelineTaskCard
            key={`plan-${i}`}
            title={p.title}
            timeLabel={formatHourKey(p.hour)}
            isFixed={p.isFixed}
            variant={p.assignment?.type === 'event' ? 'event' : 'plan'}
          />
        ))}
        {scheduledForDay.map((t) => (
          <DroppableBumpSlot key={t.id} dateStr={dateStr} displacedTask={t}>
            <DraggableScheduledTask task={t} isDragging={activeDragId === t.id} dateStr={dateStr} onCompleteVolumeBlock={onCompleteVolumeBlock} onTaskClick={onTaskClick} />
          </DroppableBumpSlot>
        ))}
        {children}
        {!isPaused && onPlanDay && (
          <div className="mt-1 flex flex-col gap-1">
            {events.length === 0 && planItems.length === 0 && scheduledForDay.length === 0 && (
              <p className="font-sans text-xs text-stone-400 text-center">No tasks yet</p>
            )}
            <button
              type="button"
              onClick={() => onPlanDay(dateStr)}
              className="py-2 rounded-lg border border-dashed border-stone-300 text-stone-500 hover:bg-stone-50 hover:text-stone-700 font-sans text-xs font-medium transition-colors"
              title="Schedule for this day"
            >
              ＋ Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StagingArea({
  goals = [],
  weeklyEvents = [],
  weekAssignments = {},
  loadDayPlan,
  saveDayPlanForDate,
  pausedDays = {},
  needsRescheduling = [],
  rescheduleNeedsReschedulingItem,
  clearDaySchedule,
  today,
  editGoal,
  spawnedVolumeBlocks = [],
  removeSpawnedVolumeBlock,
  onTaskClick,
  onPlanDay,
  stagingTaskStatus: stagingTaskStatusProp,
  setStagingTaskStatus: setStagingTaskStatusProp,
  initialScheduleSelection,
  onConsumeScheduleSelection,
}) {
  const [scheduledTasks, setScheduledTasks] = useState(() => ({})); // { [dateStr]: task[] }
  const [activeDragId, setActiveDragId] = useState(null);
  useEffect(() => {
    if (initialScheduleSelection && typeof onConsumeScheduleSelection === 'function') {
      setScheduleDrawerSelected(initialScheduleSelection);
      onConsumeScheduleSelection();
    }
  }, [initialScheduleSelection, onConsumeScheduleSelection]);
  const [volumeBlockPending, setVolumeBlockPending] = useState(null); // { goal, dateStr } | null
  const [volumeBlockCustomHours, setVolumeBlockCustomHours] = useState('');

  const todayStr = useMemo(() => (today ? localISODate(new Date(today)) : localISODate(new Date())), [today]);
  const weekViewDays = useMemo(() => {
    const start = todayStr ? new Date(todayStr + 'T00:00:00') : new Date();
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return {
        dateStr: localISODate(d),
        label: WEEKDAY_LABELS[(d.getDay() + 6) % 7],
        dayNum: d.getDate(),
      };
    });
  }, [todayStr]);

  const currentMonthStr = useMemo(() => (todayStr || '').slice(0, 7), [todayStr]);
  const allBacklogTasks = useMemo(() => buildBacklogTasks(goals, currentMonthStr), [goals, currentMonthStr]);
  const scheduledTaskIds = useMemo(
    () => new Set(Object.values(scheduledTasks).flat().map((t) => t.id)),
    [scheduledTasks]
  );
  const unscheduledTasks = useMemo(
    () => allBacklogTasks.filter((t) => !scheduledTaskIds.has(t.id)),
    [allBacklogTasks, scheduledTaskIds]
  );

  const [stagingTaskStatusLocal, setStagingTaskStatusLocal] = useState(() => ({}));
  const stagingTaskStatus = stagingTaskStatusProp ?? stagingTaskStatusLocal;
  const setStagingTaskStatus = setStagingTaskStatusProp ?? setStagingTaskStatusLocal;
  const effectiveStatus = useCallback(
    (task) => stagingTaskStatus[task.id] ?? task.defaultStatus ?? 'someday',
    [stagingTaskStatus]
  );
  const activeUnscheduled = useMemo(
    () => unscheduledTasks.filter((t) => effectiveStatus(t) === 'active'),
    [unscheduledTasks, effectiveStatus]
  );
  const somedayUnscheduled = useMemo(
    () => unscheduledTasks.filter((t) => effectiveStatus(t) === 'someday'),
    [unscheduledTasks, effectiveStatus]
  );
  const [backlogTab, setBacklogTab] = useState('this-week');
  const promoteToThisWeek = useCallback((taskId) => {
    setStagingTaskStatus((prev) => ({ ...prev, [taskId]: 'active' }));
  }, [setStagingTaskStatus]);

  const activeVolumeGoals = useMemo(
    () => (goals || []).filter((g) => g.type === 'volume' && ((g.currentProgress ?? 0) < (g.targetValue ?? 0))),
    [goals]
  );

  const handleCompleteVolumeBlock = useCallback(
    (task, dateStr) => {
      if (task.source !== 'volume-block' || !task.volumeGoalId || !editGoal) return;
      const goal = goals.find((g) => g.id === task.volumeGoalId);
      if (!goal) return;
      const prev = goal.currentProgress ?? 0;
      const value = Number(task.blockValue) || 0;
      editGoal(goal.id, { currentProgress: prev + value });
      setScheduledTasks((prevState) => {
        const next = { ...prevState };
        next[dateStr] = (next[dateStr] || []).filter((t) => t.id !== task.id);
        if ((next[dateStr] || []).length === 0) delete next[dateStr];
        return next;
      });
    },
    [goals, editGoal]
  );

  const confirmVolumeBlockDuration = useCallback(
    (hours) => {
      const pending = volumeBlockPending;
      if (!pending || !pending.goal || !pending.dateStr) return;
      const value = Number(hours);
      if (!Number.isFinite(value) || value <= 0) return;
      const metric = pending.goal.targetMetric ?? 'Hours';
      const taskId = `vol-${pending.goal.id}-${Date.now()}`;
      const task = {
        id: taskId,
        title: `${pending.goal.title} (${value} ${metric.toLowerCase()})`,
        source: 'volume-block',
        volumeGoalId: pending.goal.id,
        blockValue: value,
        goalId: pending.goal.id,
        goalTitle: pending.goal.title,
        estimatedSparks: Math.min(MAX_DAILY_SPARKS, Math.max(1, Math.round(value))),
      };
      setScheduledTasks((prev) => {
        const byDate = { ...prev };
        if (!byDate[pending.dateStr]) byDate[pending.dateStr] = [];
        byDate[pending.dateStr] = [...byDate[pending.dateStr], task];
        return byDate;
      });
      setVolumeBlockPending(null);
      setVolumeBlockCustomHours('');
    },
    [volumeBlockPending]
  );

  const isMobile = useIsMobile();
  const [scheduleDrawerSelected, setScheduleDrawerSelected] = useState(null);
  const [conflictPending, setConflictPending] = useState(null);

  const checkCalendarConflict = useCallback(
    (dateStr) => {
      const events = getEventsForDate(weeklyEvents, dateStr);
      if (events.length === 0) return null;
      const first = events[0];
      return first.summary || first.title || 'Imported event';
    },
    [weeklyEvents]
  );

  const handleScheduleFromDrawer = useCallback(
    (dateStr) => {
      const sel = scheduleDrawerSelected;
      if (!sel) return;
      if (sel.type === 'volume-generator' && sel.goal) {
        setVolumeBlockPending({ goal: sel.goal, dateStr });
        setScheduleDrawerSelected(null);
        return;
      }
      if (sel.type === 'spawned-volume-block' && sel.block && removeSpawnedVolumeBlock) {
        const block = sel.block;
        const metric = block.targetMetric ?? 'Hours';
        const task = {
          id: block.id,
          title: `${block.goalTitle} (${block.blockValue} ${metric.toLowerCase()})`,
          source: 'volume-block',
          volumeGoalId: block.goalId,
          blockValue: block.blockValue,
          goalId: block.goalId,
          goalTitle: block.goalTitle,
          estimatedSparks: Math.min(MAX_DAILY_SPARKS, Math.max(1, Math.round(block.blockValue))),
        };
        setScheduledTasks((prev) => {
          const byDate = { ...prev };
          if (!byDate[dateStr]) byDate[dateStr] = [];
          byDate[dateStr] = [...byDate[dateStr], task];
          return byDate;
        });
        removeSpawnedVolumeBlock(block.id);
        setScheduleDrawerSelected(null);
        return;
      }
      const eventName = checkCalendarConflict(dateStr);
      const apply = () => {
        if (sel.type === 'needs-rescheduling' && sel.item && rescheduleNeedsReschedulingItem) {
          rescheduleNeedsReschedulingItem(sel.item, dateStr);
          setScheduleDrawerSelected(null);
          return;
        }
        if (sel.type === 'staging-task' && sel.task) {
          const task = sel.task;
          setScheduledTasks((prev) => {
            const byDate = { ...prev };
            Object.keys(byDate).forEach((ds) => {
              byDate[ds] = (byDate[ds] || []).filter((t) => t.id !== task.id);
            });
            if (!byDate[dateStr]) byDate[dateStr] = [];
            byDate[dateStr] = [...byDate[dateStr], { ...task }];
            return byDate;
          });
          setScheduleDrawerSelected(null);
        }
      };
      if (eventName) {
        setConflictPending({ dateStr, eventName, apply });
        return;
      }
      apply();
    },
    [scheduleDrawerSelected, rescheduleNeedsReschedulingItem, checkCalendarConflict, removeSpawnedVolumeBlock]
  );

  const handleDragStart = useCallback((event) => {
    setActiveDragId(event.active.id);
  }, []);

  const handleDragEnd = useCallback((event) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const taskData = active?.data?.current;
    const overData = over?.data?.current;

    if (overData?.type === 'day' && overData?.dateStr && overData.isPaused) return;

    if (taskData?.type === 'volume-generator' && taskData?.goal && overData?.type === 'day' && overData?.dateStr) {
      setVolumeBlockPending({ goal: taskData.goal, dateStr: overData.dateStr });
      return;
    }

    if (taskData?.type === 'spawned-volume-block' && taskData?.block && overData?.type === 'day' && overData?.dateStr && removeSpawnedVolumeBlock) {
      const block = taskData.block;
      const metric = block.targetMetric ?? 'Hours';
      const task = {
        id: block.id,
        title: `${block.goalTitle} (${block.blockValue} ${metric.toLowerCase()})`,
        source: 'volume-block',
        volumeGoalId: block.goalId,
        blockValue: block.blockValue,
        goalId: block.goalId,
        goalTitle: block.goalTitle,
        estimatedSparks: Math.min(MAX_DAILY_SPARKS, Math.max(1, Math.round(block.blockValue))),
      };
      setScheduledTasks((prev) => {
        const byDate = { ...prev };
        if (!byDate[overData.dateStr]) byDate[overData.dateStr] = [];
        byDate[overData.dateStr] = [...byDate[overData.dateStr], task];
        return byDate;
      });
      removeSpawnedVolumeBlock(block.id);
      return;
    }

    if (taskData?.type === 'needs-rescheduling' && taskData.item && overData?.type === 'day' && overData?.dateStr && rescheduleNeedsReschedulingItem) {
      const dateStr = overData.dateStr;
      const eventName = checkCalendarConflict(dateStr);
      if (eventName) {
        setConflictPending({
          dateStr,
          eventName,
          apply: () => rescheduleNeedsReschedulingItem(taskData.item, dateStr),
        });
        return;
      }
      rescheduleNeedsReschedulingItem(taskData.item, dateStr);
      return;
    }

    if (overData?.type === 'bump-slot' && overData?.dateStr && overData?.displacedTask) {
      const dateStr = overData.dateStr;
      const displaced = overData.displacedTask;
      if (taskData?.type === 'needs-rescheduling' && taskData.item && rescheduleNeedsReschedulingItem) {
        rescheduleNeedsReschedulingItem(taskData.item, dateStr);
        setScheduledTasks((prev) => {
          const next = { ...prev };
          next[dateStr] = (next[dateStr] || []).filter((t) => t.id !== displaced.id);
          if ((next[dateStr] || []).length === 0) delete next[dateStr];
          return next;
        });
        window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Bumped a flexible task back to your staging area to make room.' } }));
        return;
      }
      if (taskData?.type === 'staging-task' && taskData.task) {
        const task = taskData.task;
        setScheduledTasks((prev) => {
          const byDate = { ...prev };
          const arr = [...(byDate[dateStr] || [])];
          const idx = arr.findIndex((t) => t.id === displaced.id);
          if (idx >= 0) arr[idx] = { ...task };
          else arr.push({ ...task });
          byDate[dateStr] = arr;
          Object.keys(byDate).forEach((ds) => {
            if (ds !== dateStr) byDate[ds] = (byDate[ds] || []).filter((t) => t.id !== task.id);
          });
          return byDate;
        });
        window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Bumped a flexible task back to your staging area to make room.' } }));
        return;
      }
    }

    if (!taskData || taskData.type !== 'staging-task' || !taskData.task) return;
    const task = taskData.task;

    if (overData?.type === 'day' && overData?.dateStr) {
      const dateStr = overData.dateStr;
      const eventName = checkCalendarConflict(dateStr);
      if (eventName) {
        setConflictPending({
          dateStr,
          eventName,
          apply: () => {
            setScheduledTasks((prev) => {
              const byDate = { ...prev };
              Object.keys(byDate).forEach((ds) => {
                byDate[ds] = (byDate[ds] || []).filter((t) => t.id !== task.id);
              });
              if (!byDate[dateStr]) byDate[dateStr] = [];
              byDate[dateStr] = [...byDate[dateStr], { ...task }];
              return byDate;
            });
          },
        });
        return;
      }
      setScheduledTasks((prev) => {
        const byDate = { ...prev };
        Object.keys(byDate).forEach((ds) => {
          byDate[ds] = (byDate[ds] || []).filter((t) => t.id !== task.id);
        });
        if (!byDate[dateStr]) byDate[dateStr] = [];
        byDate[dateStr] = [...byDate[dateStr], { ...task }];
        return byDate;
      });
    }

    if (over?.id === 'backlog') {
      setScheduledTasks((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((ds) => {
          next[ds] = (next[ds] || []).filter((t) => t.id !== task.id);
        });
        Object.keys(next).forEach((ds) => {
          if ((next[ds] || []).length === 0) delete next[ds];
        });
        return next;
      });
    }
  }, [rescheduleNeedsReschedulingItem, checkCalendarConflict, removeSpawnedVolumeBlock]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: isMobile ? 400 : 150, tolerance: 8 } })
  );

  const backlogDroppable = useDroppable({ id: 'backlog', data: { type: 'backlog' } });
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [pauseClearing, setPauseClearing] = useState(false);

  const timelineAndBacklog = (
    <div className="flex flex-col lg:flex-row gap-4 w-full">
        {/* Left: Timeline (70%) — calendar days with fixed events + droppable columns */}
        <div className="lg:w-[70%] min-w-0 flex flex-col rounded-xl border-2 border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b-2 border-stone-200 bg-stone-100/80 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-stone-800 text-lg">This week</h2>
              {weekViewDays.length >= 2 && (
                <p className="font-sans text-xs text-stone-500 mt-0.5">
                  {(() => {
                    try {
                      const start = new Date(weekViewDays[0].dateStr + 'T12:00:00');
                      const end = new Date(weekViewDays[6].dateStr + 'T12:00:00');
                      return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
                    } catch {
                      return null;
                    }
                  })()}
                </p>
              )}
              <p className="font-sans text-sm text-stone-500 mt-0.5">{isMobile ? 'Tap a task in the backlog to schedule it for a day.' : 'Drag tasks from the backlog onto a day to schedule them.'}</p>
            </div>
            {clearDaySchedule && todayStr && (
              <button
                type="button"
                onClick={() => setShowPauseConfirm(true)}
                className="shrink-0 px-3 py-2 rounded-xl font-sans text-sm font-medium text-amber-800 border border-amber-300 bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                ⏸️ Pause Day
              </button>
            )}
          </div>
          {showPauseConfirm && clearDaySchedule && todayStr && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <p className="font-sans text-sm text-amber-900 flex-1">Clear today&apos;s schedule? Flexible tasks go back to the backlog; mandatory tasks will need rescheduling.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPauseConfirm(false)} disabled={pauseClearing} className="px-3 py-1.5 rounded-lg font-sans text-sm text-stone-600 hover:bg-stone-100">Cancel</button>
                <button
                  type="button"
                  onClick={async () => {
                    setPauseClearing(true);
                    try {
                      await clearDaySchedule(todayStr);
                      setShowPauseConfirm(false);
                    } finally {
                      setPauseClearing(false);
                    }
                  }}
                  disabled={pauseClearing}
                  className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-70"
                >
                  {pauseClearing ? '…' : 'Clear today'}
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-1 min-h-0 overflow-x-auto">
            {weekViewDays.map(({ dateStr, label, dayNum }) => {
              const events = getEventsForDate(weeklyEvents, dateStr);
              const planItems = getPlanItemsForDate(weekAssignments, goals, dateStr);
              const scheduledForDay = scheduledTasks[dateStr] || [];
              const isToday = dateStr === todayStr;
              const isPaused = Boolean(pausedDays[dateStr]);
              const totalSparks = events.length * 2 + planItems.length * 2 + scheduledForDay.reduce((s, t) => s + (t.estimatedSparks ?? 2), 0);
              return (
                <DroppableDayColumn
                  key={dateStr}
                  dateStr={dateStr}
                  label={label}
                  dayNum={dayNum}
                  isToday={isToday}
                  events={events}
                  planItems={planItems}
                  scheduledForDay={scheduledForDay}
                  activeDragId={activeDragId}
                  isPaused={isPaused}
                  totalSparks={totalSparks}
                  onCompleteVolumeBlock={handleCompleteVolumeBlock}
                  onTaskClick={onTaskClick}
                  onPlanDay={onPlanDay}
                />
              );
            })}
          </div>
        </div>

        {/* Right: Backlog (30%) — unscheduled tasks, draggable */}
        <div
          ref={backlogDroppable.setNodeRef}
          className={`lg:w-[30%] min-w-0 flex flex-col rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/50 overflow-hidden ${backlogDroppable.isOver ? 'border-moss-400 bg-moss-50/50' : ''}`}
        >
          <div className="px-4 py-3 border-b border-stone-200 bg-white shrink-0">
            <h2 className="font-serif text-stone-800 text-lg">Unscheduled tasks</h2>
            <p className="font-sans text-sm text-stone-500">From milestones & flexible subtasks. Drop here to un-schedule.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
            {needsRescheduling.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-sans text-sm font-semibold text-amber-800">Needs rescheduling</h3>
                <p className="font-sans text-xs text-amber-700">{isMobile ? 'Tap to pick a day.' : 'Mandatory tasks from a paused day. Drag onto a day to reschedule.'}</p>
                {isMobile
                  ? needsRescheduling.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setScheduleDrawerSelected({ type: 'needs-rescheduling', item })}
                        className="w-full text-left rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm hover:bg-amber-100 font-sans text-sm font-medium text-amber-900"
                      >
                        {item.title}
                      </button>
                    ))
                  : needsRescheduling.map((item) => (
                      <DraggableNeedsReschedulingTask key={item.id} item={item} isDragging={activeDragId === `reschedule-${item.id}`} />
                    ))}
              </div>
            )}
            <div className="space-y-2">
              {needsRescheduling.length > 0 && <h3 className="font-sans text-sm font-semibold text-stone-600">Backlog</h3>}
              <div className="flex gap-1 border-b border-stone-200 mb-2">
                <button
                  type="button"
                  onClick={() => setBacklogTab('this-week')}
                  className={`px-3 py-1.5 font-sans text-sm font-medium rounded-t ${backlogTab === 'this-week' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => setBacklogTab('someday')}
                  className={`px-3 py-1.5 font-sans text-sm font-medium rounded-t ${backlogTab === 'someday' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  Someday / Vault
                </button>
              </div>
              {backlogTab === 'this-week' && (
                <>
                  {spawnedVolumeBlocks.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-sans text-xs font-semibold text-moss-700 uppercase tracking-wide">Spawned this week</h3>
                      {isMobile
                        ? spawnedVolumeBlocks.map((block) => (
                            <button
                              key={block.id}
                              type="button"
                              onClick={() => setScheduleDrawerSelected({ type: 'spawned-volume-block', block })}
                              className="w-full text-left rounded-lg border border-moss-300 bg-moss-50 px-3 py-2 font-sans text-sm text-moss-900 hover:bg-moss-100/80"
                            >
                              <span className="block truncate font-medium">{block.goalTitle} ({block.blockValue} {(block.targetMetric || 'Hours').toLowerCase()})</span>
                              <span className="text-[10px] text-moss-600">Tap to pick a day</span>
                            </button>
                          ))
                        : spawnedVolumeBlocks.map((block) => (
                            <DraggableSpawnedVolumeBlock key={block.id} block={block} isDragging={activeDragId === block.id} />
                          ))}
                    </div>
                  )}
                  {activeVolumeGoals.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-sans text-xs font-semibold text-moss-700 uppercase tracking-wide">Quota / Volume</h3>
                      {isMobile
                        ? activeVolumeGoals.map((goal) => (
                            <button
                              key={goal.id}
                              type="button"
                              onClick={() => setScheduleDrawerSelected({ type: 'volume-generator', goal })}
                              className="w-full text-left rounded-lg border-2 border-dashed border-moss-400 bg-moss-50/80 px-3 py-2 font-sans text-sm text-moss-900 hover:bg-moss-100/80"
                            >
                              <span className="block truncate font-medium">{goal.title}</span>
                              <span className="text-xs text-moss-700">{(goal.currentProgress ?? 0)}/{(goal.targetValue ?? 0)} {(goal.targetMetric ?? 'Hours').toLowerCase()} · Tap to add block</span>
                            </button>
                          ))
                        : activeVolumeGoals.map((goal) => (
                            <DraggableVolumeGeneratorCard key={goal.id} goal={goal} isDragging={activeDragId === `volume-gen-${goal.id}`} />
                          ))}
                    </div>
                  )}
                  {activeUnscheduled.length === 0 && activeVolumeGoals.length === 0 && spawnedVolumeBlocks.length === 0 ? (
                    <p className="font-sans text-sm text-stone-400 py-4 text-center">No tasks for this week. Promote from Someday or add goals.</p>
                  ) : (
                    <GroupedBacklogList
                      flatTasks={activeUnscheduled}
                      onSelectTask={isMobile ? setScheduleDrawerSelected : undefined}
                      renderDraggableTask={isMobile ? undefined : (task) => (
                        <DraggableBacklogTask key={task.id} task={task} isDragging={activeDragId === task.id} onTaskClick={onTaskClick} />
                      )}
                    />
                  )}
                </>
              )}
              {backlogTab === 'someday' && (
                <>
                  {somedayUnscheduled.length === 0 ? (
                    <p className="font-sans text-sm text-stone-400 py-4 text-center">Someday vault is empty. Ideas will land here by default.</p>
                  ) : (
                    <GroupedBacklogList
                      flatTasks={somedayUnscheduled}
                      onSelectTask={setScheduleDrawerSelected}
                      scheduleButtonLabel="Pick a day to schedule"
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
  );

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {timelineAndBacklog}
      </DndContext>
      <ScheduleDrawer
        selected={scheduleDrawerSelected}
        open={!!scheduleDrawerSelected}
        onClose={() => setScheduleDrawerSelected(null)}
        weekViewDays={weekViewDays}
        today={todayStr}
        onSelectDay={handleScheduleFromDrawer}
        weekAssignments={weekAssignments}
        weeklyEvents={weeklyEvents}
        goals={goals}
        scheduledTasks={scheduledTasks}
      />
      {volumeBlockPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="volume-block-duration-title">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-stone-200">
            <h3 id="volume-block-duration-title" className="font-sans text-base font-semibold text-stone-800 mb-2">How long is this block?</h3>
            <p className="font-sans text-sm text-stone-600 mb-4">{volumeBlockPending.goal?.title} — pick duration to add to your week.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button type="button" onClick={() => confirmVolumeBlockDuration(1)} className="px-4 py-2 rounded-lg font-sans text-sm font-medium bg-moss-100 text-moss-800 hover:bg-moss-200">1 hr</button>
              <button type="button" onClick={() => confirmVolumeBlockDuration(2)} className="px-4 py-2 rounded-lg font-sans text-sm font-medium bg-moss-100 text-moss-800 hover:bg-moss-200">2 hrs</button>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={0.5}
                step={0.5}
                placeholder="Custom"
                value={volumeBlockCustomHours}
                onChange={(e) => setVolumeBlockCustomHours(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-stone-300 font-sans text-sm"
              />
              <button
                type="button"
                onClick={() => { const v = parseFloat(volumeBlockCustomHours); if (Number.isFinite(v) && v > 0) confirmVolumeBlockDuration(v); }}
                className="px-3 py-2 rounded-lg font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700"
              >
                Add
              </button>
            </div>
            <button type="button" onClick={() => { setVolumeBlockPending(null); setVolumeBlockCustomHours(''); }} className="mt-3 w-full py-1.5 font-sans text-sm text-stone-500 hover:text-stone-700">Cancel</button>
          </div>
        </div>
      )}
      {conflictPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-stone-200">
            <h3 id="conflict-title" className="font-sans text-base font-semibold text-amber-800 mb-2">Conflict</h3>
            <p className="font-sans text-sm text-stone-700 mb-4">
              You scheduled this during an imported calendar event (&apos;{conflictPending.eventName}&apos;). Keep it here, or bump back to staging?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setConflictPending(null);
                }}
                className="px-3 py-2 rounded-lg font-sans text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200"
              >
                Bump back
              </button>
              <button
                type="button"
                onClick={() => {
                  conflictPending.apply();
                  setConflictPending(null);
                }}
                className="px-3 py-2 rounded-lg font-sans text-sm font-medium text-white bg-moss-600 hover:bg-moss-700"
              >
                Keep
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
