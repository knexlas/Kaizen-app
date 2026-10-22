import { useCallback, useEffect, useMemo } from 'react';
import { useGarden } from '../../context/GardenContext';
import {
  autoPlanDay,
  doneUpdates,
  findFreeStart,
  getDayBlocks,
  getProjects,
  getWeekBacklog,
  indexTasks,
  minutesNow,
  mondayOf,
  planWithBlockCompleted,
  planWithBlockMoved,
  planWithTaskAt,
  planWithoutBlock,
  taskMinutes,
  timeToMinutes,
  weekDates,
} from './leanModel';

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Everything the lean Plan mode (and the watch sync) needs, built on top of GardenContext. */
export function useLeanPlan() {
  const garden = useGarden();
  const {
    goals,
    today,
    weekAssignments,
    loadWeekPlans,
    saveDayPlanForDate,
    addGoal,
    editGoal,
    addSubtask,
    updateSubtask,
    deleteSubtask,
    userSettings,
  } = garden;

  useEffect(() => {
    loadWeekPlans?.();
  }, [loadWeekPlans]);

  const monday = mondayOf(new Date(`${today}T12:00:00`));
  const dates = useMemo(() => weekDates(monday), [monday]);
  const projects = useMemo(() => getProjects(goals), [goals]);
  const index = useMemo(() => indexTasks(goals), [goals]);
  const dayStart = timeToMinutes(userSettings?.workHours?.start ?? userSettings?.dayStart, 9 * 60);
  const dayEnd = timeToMinutes(userSettings?.workHours?.end ?? userSettings?.dayEnd, 18 * 60);

  const dayPlan = useCallback((date) => weekAssignments?.[date] ?? {}, [weekAssignments]);
  const blocksFor = useCallback((date) => getDayBlocks(dayPlan(date), goals), [dayPlan, goals]);
  const weekPlans = useMemo(() => Object.fromEntries(dates.map((d) => [d, dayPlan(d)])), [dates, dayPlan]);
  const weekBacklog = useMemo(() => getWeekBacklog(goals, monday, weekPlans, today), [goals, monday, weekPlans, today]);

  const findTask = useCallback((taskId) => index[taskId] ?? null, [index]);

  const setTaskDone = useCallback((taskId, done) => {
    const entry = index[taskId];
    if (!entry) return;
    updateSubtask(entry.goal.id, taskId, doneUpdates(entry.task, done));
  }, [index, updateSubtask]);

  const updateTask = useCallback((taskId, updates) => {
    const entry = index[taskId];
    if (entry) updateSubtask(entry.goal.id, taskId, updates);
  }, [index, updateSubtask]);

  const removeTask = useCallback((taskId) => {
    const entry = index[taskId];
    if (!entry) return;
    deleteSubtask(entry.goal.id, taskId);
    Object.values(index).forEach(({ task, goal }) => {
      if ((task.blockedBy ?? []).includes(taskId)) {
        updateSubtask(goal.id, task.id, { blockedBy: task.blockedBy.filter((id) => id !== taskId) });
      }
    });
  }, [index, deleteSubtask, updateSubtask]);

  const addTask = useCallback((goalId, title, minutes = 30, extra = {}) => {
    const trimmed = String(title ?? '').trim();
    if (!goalId || !trimmed) return null;
    const id = newId('st');
    addSubtask(goalId, { id, title: trimmed, estimatedHours: minutes / 60, completedHours: 0 });
    // addSubtask only keeps the garden schema; lean fields go on in a follow-up (queued) update.
    if (Object.keys(extra).length > 0) updateSubtask(goalId, id, extra);
    return id;
  }, [addSubtask, updateSubtask]);

  const addProject = useCallback((title) => {
    const trimmed = String(title ?? '').trim();
    if (!trimmed) return null;
    const id = newId('goal');
    // _projectGoal makes it count as a project in the full Kaizen views too.
    addGoal({ id, title: trimmed, type: 'kaizen', _projectGoal: true, subtasks: [] });
    return id;
  }, [addGoal]);

  const renameProject = useCallback((goalId, title) => editGoal(goalId, { title }), [editGoal]);

  const scheduleTask = useCallback((taskId, date, startMinutes) => {
    const entry = index[taskId];
    if (!entry) return;
    saveDayPlanForDate(date, planWithTaskAt(dayPlan(date), entry.task, entry.goal, startMinutes));
  }, [index, dayPlan, saveDayPlanForDate]);

  /** Next free start on `date` for a block of `minutes` (from now when it is today). Late evenings are allowed for manual adds. */
  const nextFreeStart = useCallback((date, minutes) => {
    const from = date === today ? Math.max(dayStart, Math.ceil(minutesNow() / 5) * 5) : dayStart;
    return findFreeStart(blocksFor(date), from, minutes, 24 * 60 - 5);
  }, [today, dayStart, blocksFor]);

  /** Put an existing task in the next free slot on `date`. Returns the start minute or null when the day is full. */
  const scheduleTaskNext = useCallback((taskId, date = today) => {
    const entry = index[taskId];
    if (!entry) return null;
    const start = nextFreeStart(date, taskMinutes(entry.task));
    if (start != null) saveDayPlanForDate(date, planWithTaskAt(dayPlan(date), entry.task, entry.goal, start));
    return start;
  }, [index, today, nextFreeStart, dayPlan, saveDayPlanForDate]);

  /** Create a task and give it the next free slot on `date` in one go (the new task is not in `index` yet). */
  const addTaskToDay = useCallback((goalId, title, minutes, date = today, projectTitle = null) => {
    const goal = { id: goalId, title: projects.find((p) => p.id === goalId)?.title ?? projectTitle ?? title };
    const taskId = addTask(goalId, title, minutes, { weekOf: mondayOf(new Date(`${date}T12:00:00`)) });
    if (!taskId) return null;
    const start = nextFreeStart(date, minutes);
    if (start != null) {
      saveDayPlanForDate(date, planWithTaskAt(dayPlan(date), { id: taskId, title: String(title).trim(), estimatedHours: minutes / 60 }, goal, start));
    }
    return start;
  }, [today, projects, addTask, nextFreeStart, dayPlan, saveDayPlanForDate]);

  const unscheduleBlock = useCallback((date, block) => {
    saveDayPlanForDate(date, planWithoutBlock(dayPlan(date), block));
  }, [dayPlan, saveDayPlanForDate]);

  const moveBlock = useCallback((date, block, newStart) => {
    saveDayPlanForDate(date, planWithBlockMoved(dayPlan(date), block, newStart));
  }, [dayPlan, saveDayPlanForDate]);

  /** Done on a block: marks the block and, when it is a task block, the task itself. */
  const setBlockDone = useCallback((date, block, done) => {
    saveDayPlanForDate(date, planWithBlockCompleted(dayPlan(date), block, done));
    if (block.taskId) setTaskDone(block.taskId, done);
  }, [dayPlan, saveDayPlanForDate, setTaskDone]);

  /** Fill free time on `date` with this week's unscheduled tasks. Returns how many were placed. */
  const planDay = useCallback((date = today) => {
    const { plan, placed } = autoPlanDay({
      dayPlan: dayPlan(date),
      candidates: weekBacklog,
      goals,
      dayStart,
      dayEnd,
      fromMinutes: date === today ? minutesNow() : dayStart,
    });
    if (placed > 0) saveDayPlanForDate(date, plan);
    return placed;
  }, [today, dayPlan, weekBacklog, goals, dayStart, dayEnd, saveDayPlanForDate]);

  /** Spread this week's backlog over today and the remaining weekdays (weekends only if nothing else fits). */
  const planWeek = useCallback(() => {
    let remaining = [...weekBacklog];
    let total = 0;
    const upcoming = dates.filter((d) => d >= today);
    const weekdays = upcoming.filter((d) => new Date(`${d}T12:00:00`).getDay() % 6 !== 0);
    const weekend = upcoming.filter((d) => !weekdays.includes(d));
    [...weekdays, ...weekend].forEach((date) => {
      if (remaining.length === 0) return;
      const { plan, placed } = autoPlanDay({
        dayPlan: dayPlan(date),
        candidates: remaining,
        goals,
        dayStart,
        dayEnd,
        fromMinutes: date === today ? minutesNow() : dayStart,
      });
      if (placed === 0) return;
      saveDayPlanForDate(date, plan);
      const placedIds = new Set(getDayBlocks(plan, goals).map((b) => b.taskId));
      remaining = remaining.filter(({ task }) => !placedIds.has(task.id));
      total += placed;
    });
    return total;
  }, [weekBacklog, dates, today, dayPlan, goals, dayStart, dayEnd, saveDayPlanForDate]);

  return {
    garden,
    today,
    monday,
    dates,
    projects,
    index,
    dayStart,
    dayEnd,
    blocksFor,
    weekBacklog,
    findTask,
    setTaskDone,
    updateTask,
    removeTask,
    addTask,
    addProject,
    renameProject,
    scheduleTask,
    scheduleTaskNext,
    addTaskToDay,
    nextFreeStart,
    unscheduleBlock,
    moveBlock,
    setBlockDone,
    planDay,
    planWeek,
  };
}
