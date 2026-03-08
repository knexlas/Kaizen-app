/**
 * Planned hours aggregation by scope (week / month / day).
 * Sums real duration from assignments (assignment.duration or goal.estimatedMinutes).
 */

import { localISODate } from '../services/dateUtils';
import {
  getGoalIdFromAssignment,
  getDurationMinutesFromAssignment,
  getAssignmentsForSlot,
} from '../services/planAssignmentUtils';

/** Monday–Sunday date strings (YYYY-MM-DD) for the current week. */
function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localISODate(d);
  });
}

/** All date strings for the current month. */
function getMonthDates() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return localISODate(d);
  });
}

/**
 * Aggregate planned minutes from weekAssignments for a given scope.
 * @param {Object} weekAssignments - { [dateStr]: { [hourKey]: assignment | assignment[] } }
 * @param {Array} goals - List of goals (id, title, type, estimatedMinutes)
 * @param {'day'|'week'|'month'} scope
 * @returns {{ totalMinutes: number, byGoal: Array<{ goalId: string, title: string, type: string, minutes: number }> }}
 */
export function getPlannedHoursByScope(weekAssignments, goals, scope = 'week') {
  const safeGoals = Array.isArray(goals) ? goals : [];
  const byGoalMinutes = {};
  let totalMinutes = 0;

  let dateStrings = [];
  if (scope === 'day') {
    dateStrings = [localISODate()];
  } else if (scope === 'week') {
    dateStrings = getWeekDates();
  } else if (scope === 'month') {
    dateStrings = getMonthDates();
  }

  for (const dateStr of dateStrings) {
    const dayPlan = weekAssignments?.[dateStr];
    if (!dayPlan || typeof dayPlan !== 'object') continue;
    for (const hourKey of Object.keys(dayPlan)) {
      const assignments = getAssignmentsForSlot(dayPlan, hourKey);
      for (const a of assignments) {
        const goalId = getGoalIdFromAssignment(a);
        if (!goalId) continue;
        const minutes = getDurationMinutesFromAssignment(a, safeGoals, 15);
        byGoalMinutes[goalId] = (byGoalMinutes[goalId] || 0) + minutes;
        totalMinutes += minutes;
      }
    }
  }

  const goalMap = new Map(safeGoals.map((g) => [g.id, g]));
  const byGoal = Object.entries(byGoalMinutes)
    .map(([goalId, minutes]) => ({
      goalId,
      title: goalMap.get(goalId)?.title ?? 'Task',
      type: goalMap.get(goalId)?.type ?? 'kaizen',
      minutes,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return { totalMinutes, byGoal };
}
