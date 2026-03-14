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

/** Monday–Sunday date strings (YYYY-MM-DD) for the week. If weekStartDate omitted, uses current week. */
function getWeekDates(weekStartDate = null) {
  const ref = weekStartDate ? (weekStartDate instanceof Date ? weekStartDate : new Date(weekStartDate + 'T12:00:00')) : new Date();
  const day = ref.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + diff);
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

/**
 * Planned minutes per day for the given date strings. For capacity UI (planned vs available per day).
 * @param {Object} weekAssignments
 * @param {Array} goals
 * @param {string[]|null} dateStrings - If provided, use these dates; otherwise use current week (Mon–Sun).
 * @returns {{ [dateStr]: number }}
 */
export function getPlannedMinutesByDay(weekAssignments, goals, dateStrings = null) {
  const dates = Array.isArray(dateStrings) && dateStrings.length > 0 ? dateStrings : getWeekDates();
  const out = {};
  const safeGoals = Array.isArray(goals) ? goals : [];
  for (const dateStr of dates) {
    const dayPlan = weekAssignments?.[dateStr];
    if (!dayPlan || typeof dayPlan !== 'object') {
      out[dateStr] = 0;
      continue;
    }
    let total = 0;
    for (const hourKey of Object.keys(dayPlan)) {
      const assignments = getAssignmentsForSlot(dayPlan, hourKey);
      for (const a of assignments) {
        const minutes = getDurationMinutesFromAssignment(a, safeGoals, 15);
        total += minutes;
      }
    }
    out[dateStr] = total;
  }
  return out;
}

