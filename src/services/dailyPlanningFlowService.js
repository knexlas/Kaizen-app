/**
 * Lightweight daily planning flow: calendar, outstanding tasks, estimate, overload check.
 * Used by DailyPlanRitual for a guided, low-overwhelm sequence.
 */

import { localISODate } from './dateUtils';
import { getCalendarEventsForDate } from './scheduleAdapter';
import { getAssignmentsForSlot, getGoalIdFromAssignment, getDurationMinutesFromAssignment } from './planAssignmentUtils';
import { getBestNextStepForGoal } from './nextStepService';
import { getActiveProjects } from './projectSupportService';

/** Events on the given date (from weeklyEvents). Returns [{ start, end, title, startMins? }]. */
export function getTodayCalendarBlocks(dateStr, weeklyEvents) {
  const events = getCalendarEventsForDate(weeklyEvents ?? [], dateStr);
  return events.map((e) => {
    const start = e?.start ?? e?.date;
    const end = e?.end;
    const startDate = start instanceof Date ? start : start ? new Date(start) : null;
    const endDate = end instanceof Date ? end : end ? new Date(end) : null;
    const startMins = startDate && !Number.isNaN(startDate.getTime()) ? startDate.getHours() * 60 + startDate.getMinutes() : null;
    const endMins = endDate && !Number.isNaN(endDate.getTime()) ? endDate.getHours() * 60 + endDate.getMinutes() : null;
    return {
      start: start,
      end: end,
      title: e?.title ?? 'Event',
      startMins,
      endMins,
    };
  }).filter((b) => b.title);
}

/** Outstanding tasks for today: backlog (buildBacklogTasks-style) + next steps from active projects. */
export function getOutstandingForToday(goals, dateStr) {
  const monthStr = dateStr && dateStr.length >= 7 ? dateStr.slice(0, 7) : null;
  const list = [];
  const seen = new Set();

  (goals ?? []).forEach((goal) => {
    if (goal.type === 'routine' || goal.recurrence) return;
    const breakdown = goal.narrativeBreakdown;
    if (breakdown && Array.isArray(breakdown.milestones)) {
      breakdown.milestones.forEach((milestone, mi) => {
        const activeMonth = milestone.activeMonth ?? milestone.active_month ?? null;
        if (monthStr && activeMonth && activeMonth !== monthStr) return;
        (milestone.tasks || []).forEach((task, ti) => {
          const id = `narrative-${goal.id}-m${mi}-t${ti}`;
          if (seen.has(id)) return;
          seen.add(id);
          list.push({
            id,
            title: task.title || 'Task',
            goalId: goal.id,
            goalTitle: goal.title,
            estimatedMinutes: (task.estimatedMinutes ?? task.estimatedSparks ?? 2) * 15,
            source: 'narrative',
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
      const estHours = Number(st.estimatedHours);
      list.push({
        id,
        title: st.title || 'Subtask',
        goalId: goal.id,
        goalTitle: goal.title,
        subtaskId: st.id,
        estimatedMinutes: Number.isFinite(estHours) ? Math.round(estHours * 60) : 30,
        source: 'subtask',
      });
    });
  });

  const projects = getActiveProjects(goals ?? []);
  projects.forEach((goal) => {
    const next = getBestNextStepForGoal(goal);
    if (!next || next.blocked) return;
    const id = next.taskId ?? `next-${goal.id}-${next.subtaskId ?? 'g'}`;
    if (seen.has(id)) return;
    seen.add(id);
    list.push({
      id,
      title: next.title || 'Next step',
      goalId: goal.id,
      goalTitle: goal.title,
      subtaskId: next.subtaskId,
      estimatedMinutes: (next.suggestedMinutes ?? 15),
      source: 'next_step',
    });
  });

  return list;
}

/** Total planned minutes from a day plan (slots only, not anytime). */
export function getPlannedMinutesFromPlan(dayPlan, goals) {
  if (!dayPlan || typeof dayPlan !== 'object') return 0;
  const safeGoals = Array.isArray(goals) ? goals : [];
  let total = 0;
  for (const slotKey of Object.keys(dayPlan)) {
    if (slotKey === 'anytime') continue;
    const assignments = getAssignmentsForSlot(dayPlan, slotKey);
    for (const a of assignments) {
      total += getDurationMinutesFromAssignment(a, safeGoals, 30);
    }
  }
  return total;
}

/** Planned minutes for anytime items (estimate 30 min each if no duration). */
export function getAnytimePlannedMinutes(dayPlan, goals) {
  if (!dayPlan?.anytime || !Array.isArray(dayPlan.anytime)) return 0;
  const safeGoals = Array.isArray(goals) ? goals : [];
  return dayPlan.anytime.reduce((sum, a) => sum + getDurationMinutesFromAssignment(a, safeGoals, 30), 0);
}

/** Whether the day is over capacity (planned hours > capacityHours). */
export function isDayOverloaded(dayPlan, capacityHours, goals) {
  const slotMins = getPlannedMinutesFromPlan(dayPlan, goals);
  const anytimeMins = getAnytimePlannedMinutes(dayPlan, goals);
  const totalMins = slotMins + anytimeMins;
  const capacityMins = (Number(capacityHours) || 14) * 60;
  return totalMins > capacityMins;
}

/** Estimate minutes for a list of outstanding tasks (by id). */
export function estimateMinutesForTaskIds(taskIds, outstandingList) {
  const map = new Map((outstandingList ?? []).map((t) => [t.id, t]));
  return (taskIds ?? []).reduce((sum, id) => sum + (map.get(id)?.estimatedMinutes ?? 30), 0);
}
