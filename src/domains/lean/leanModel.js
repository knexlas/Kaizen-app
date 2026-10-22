/**
 * Lean Plan mode: a thin read/write layer over the existing garden data.
 * Projects = non-routine goals, tasks = their subtasks, time blocks = day-plan assignments.
 *
 * Fields the lean mode adds to a subtask (all optional, ignored by the garden views):
 *   done: boolean, blockedBy: string[] (subtask ids), weekOf: 'YYYY-MM-DD' (Monday of the week it is planned for)
 */
import { localISODate } from '../../services/dateUtils';
import { minutesToCanonicalSlotKey, slotKeyToMinutesSinceMidnight } from '../../services/schedulingConflictService';

const GAP_MINUTES = 5;

export function isArchived(item) {
  return Boolean(item?.archived || item?.archivedAt || item?.status === 'archived');
}

export function getProjects(goals) {
  return (Array.isArray(goals) ? goals : []).filter((g) => g && g.type !== 'routine' && g.type !== 'vitality' && !isArchived(g));
}

export function isTaskDone(task) {
  if (!task) return false;
  if (typeof task.done === 'boolean') return task.done;
  const est = Number(task.estimatedHours) || 0;
  return est > 0 && (Number(task.completedHours) || 0) >= est;
}

export function taskMinutes(task) {
  const hours = Number(task?.estimatedHours);
  return Number.isFinite(hours) && hours > 0 ? Math.max(5, Math.round(hours * 60)) : 30;
}

/** Index of every subtask by id: { [id]: { task, goal } }. */
export function indexTasks(goals) {
  const index = {};
  (Array.isArray(goals) ? goals : []).forEach((goal) => {
    (goal?.subtasks ?? []).forEach((task) => {
      if (task?.id) index[task.id] = { task, goal };
    });
  });
  return index;
}

/** Open tasks that block this one (blockers that are deleted or done no longer count). */
export function getOpenBlockers(task, index) {
  return (task?.blockedBy ?? [])
    .map((id) => index[id]?.task)
    .filter((blocker) => blocker && !isTaskDone(blocker));
}

export function isTaskBlocked(task, index) {
  return getOpenBlockers(task, index).length > 0;
}

/** Open tasks that are waiting on this one. */
export function getBlockedDependents(task, index) {
  return Object.values(index)
    .map((entry) => entry.task)
    .filter((other) => !isTaskDone(other) && (other.blockedBy ?? []).includes(task.id));
}

/** Toggle payload for updateSubtask that keeps completedHours meaningful for the garden views. */
export function doneUpdates(task, done) {
  if (done) {
    const est = Number(task.estimatedHours) || 0;
    return {
      done: true,
      doneAt: new Date().toISOString(),
      _completedBeforeDone: Number(task.completedHours) || 0,
      completedHours: Math.max(Number(task.completedHours) || 0, est),
    };
  }
  return {
    done: false,
    doneAt: null,
    completedHours: Number(task._completedBeforeDone) || 0,
  };
}

// ---------- dates ----------

export function mondayOf(date = new Date()) {
  const d = new Date(date);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return localISODate(d);
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localISODate(new Date(y, m - 1, d + n));
}

export function weekDates(monday = mondayOf()) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function minutesNow(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

export function hhmm(mins) {
  return minutesToCanonicalSlotKey(Math.max(0, Math.min(24 * 60 - 1, mins)));
}

export function timeToMinutes(value, fallback) {
  const mins = slotKeyToMinutesSinceMidnight(value);
  return mins == null ? fallback : mins;
}

// ---------- day plans ----------

/**
 * Flatten one day plan ({ 'HH:MM': assignment | assignment[] | goalId }) into sorted blocks.
 * Each block keeps its slot key and position so it can be written back.
 */
export function getDayBlocks(dayPlan, goals) {
  const goalById = Object.fromEntries((Array.isArray(goals) ? goals : []).map((g) => [g.id, g]));
  const blocks = [];
  Object.entries(dayPlan ?? {}).forEach(([slot, value]) => {
    const start = slotKeyToMinutesSinceMidnight(slot);
    if (start == null) return;
    const items = Array.isArray(value) ? value : [value];
    items.forEach((item, position) => {
      if (item == null) return;
      const raw = typeof item === 'string' ? { parentGoalId: item } : item;
      const goal = goalById[raw.parentGoalId];
      blocks.push({
        key: `${slot}#${position}#${raw.id ?? raw.parentGoalId ?? ''}`,
        id: raw.id ?? null,
        slot,
        position,
        start,
        duration: Number(raw.duration) > 0 ? Number(raw.duration) : 60,
        title: raw.subtaskTitle || raw.title || goal?.title || 'Block',
        goalId: raw.parentGoalId ?? null,
        goalTitle: goal?.title ?? null,
        taskId: raw.subtaskId ?? null,
        completed: raw.completed === true,
        raw,
      });
    });
  });
  return blocks.sort((a, b) => a.start - b.start);
}

function removeFromPlan(dayPlan, block) {
  const next = { ...(dayPlan ?? {}) };
  const value = next[block.slot];
  if (Array.isArray(value)) {
    const kept = value.filter((_, i) => i !== block.position);
    if (kept.length === 0) delete next[block.slot];
    else next[block.slot] = kept.length === 1 ? kept[0] : kept;
  } else {
    delete next[block.slot];
  }
  return next;
}

function addToPlan(dayPlan, startMinutes, assignment) {
  const next = { ...(dayPlan ?? {}) };
  const slot = hhmm(startMinutes);
  const existing = next[slot];
  if (existing == null) next[slot] = assignment;
  else next[slot] = [...(Array.isArray(existing) ? existing : [existing]), assignment];
  return next;
}

export function newBlockId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function taskAssignment(task, goal, duration = taskMinutes(task)) {
  return {
    id: newBlockId(),
    parentGoalId: goal?.id ?? null,
    title: goal?.title ?? task.title,
    subtaskId: task.id,
    subtaskTitle: task.title,
    type: 'task',
    duration,
  };
}

export function planWithTaskAt(dayPlan, task, goal, startMinutes) {
  return addToPlan(dayPlan, startMinutes, taskAssignment(task, goal));
}

export function planWithoutBlock(dayPlan, block) {
  return removeFromPlan(dayPlan, block);
}

export function planWithBlockMoved(dayPlan, block, newStart) {
  return addToPlan(removeFromPlan(dayPlan, block), newStart, { ...block.raw, id: block.id ?? newBlockId() });
}

export function planWithBlockCompleted(dayPlan, block, completed) {
  const updated = typeof block.raw === 'object' ? { ...block.raw, completed } : { parentGoalId: block.goalId, completed };
  const next = { ...(dayPlan ?? {}) };
  const value = next[block.slot];
  if (Array.isArray(value)) next[block.slot] = value.map((item, i) => (i === block.position ? updated : item));
  else next[block.slot] = updated;
  return next;
}

/**
 * Task ids that already have a block on the given day plans. With `today`, blocks on earlier days
 * only count when they were completed, so missed tasks fall back into the week list.
 */
export function scheduledTaskIds(dayPlans, today = null) {
  const ids = new Set();
  Object.entries(dayPlans ?? {}).forEach(([date, plan]) => {
    getDayBlocks(plan, []).forEach((b) => {
      if (b.taskId && (!today || date >= today || b.completed)) ids.add(b.taskId);
    });
  });
  return ids;
}

// ---------- planning ----------

/** Open, unscheduled tasks planned for this week or rolled over from earlier ones, including ones missed on earlier days. */
export function getWeekBacklog(goals, monday, dayPlans, today = null) {
  const scheduled = scheduledTaskIds(dayPlans, today);
  const out = [];
  getProjects(goals).forEach((goal) => {
    (goal.subtasks ?? []).forEach((task) => {
      // Unfinished tasks from earlier weeks roll over into this one.
      if (task.weekOf && task.weekOf <= monday && !isTaskDone(task) && !scheduled.has(task.id)) out.push({ task, goal });
    });
  });
  return out;
}

/**
 * First start minute >= from where `duration` fits between the busy blocks and before dayEnd.
 * Returns null when the day is full.
 */
export function findFreeStart(blocks, from, duration, dayEnd) {
  let cursor = from;
  const busy = blocks.filter((b) => !b.completed).map((b) => [b.start, b.start + b.duration]).sort((a, b) => a[0] - b[0]);
  for (const [start, end] of busy) {
    if (cursor + duration + GAP_MINUTES <= start) break;
    if (cursor < end + GAP_MINUTES) cursor = end + GAP_MINUTES;
  }
  return cursor + duration <= dayEnd ? cursor : null;
}

/**
 * Fill free time on one day with the given candidates (unblocked first; blocked tasks only after
 * their blockers are placed earlier that day). Returns { plan, placed }.
 */
export function autoPlanDay({ dayPlan, candidates, goals, dayStart, dayEnd, fromMinutes }) {
  const index = indexTasks(goals);
  let plan = dayPlan ?? {};
  let placed = 0;
  const from = Math.max(dayStart, Math.ceil((fromMinutes ?? dayStart) / 5) * 5);
  const ordered = [
    ...candidates.filter(({ task }) => !isTaskBlocked(task, index)),
    ...candidates.filter(({ task }) => isTaskBlocked(task, index)),
  ];
  ordered.forEach(({ task, goal }) => {
    const blocks = getDayBlocks(plan, goals);
    let earliest = from;
    const blockers = getOpenBlockers(task, index);
    for (const blocker of blockers) {
      const blockerBlock = blocks.find((b) => b.taskId === blocker.id);
      if (!blockerBlock) return; // blocker not on this day: leave the task for later
      earliest = Math.max(earliest, blockerBlock.start + blockerBlock.duration + GAP_MINUTES);
    }
    const start = findFreeStart(blocks, earliest, taskMinutes(task), dayEnd);
    if (start == null) return;
    plan = planWithTaskAt(plan, task, goal, start);
    placed += 1;
  });
  return { plan, placed };
}
