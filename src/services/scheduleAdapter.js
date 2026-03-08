import { toCanonicalSlotKey, slotKeyToMinutesSinceMidnight } from './schedulingConflictService';
import {
  getGoalIdFromAssignment as sharedGoalIdFromAssignment,
  getDurationMinutesFromAssignment as sharedDurationFromAssignment,
} from './planAssignmentUtils';

function goalIdFromAssignment(a) {
  return sharedGoalIdFromAssignment(a);
}

function ritualTitleFromAssignment(a) {
  return a && typeof a === 'object' && 'ritualTitle' in a ? a.ritualTitle : null;
}

function durationFromAssignment(assignment, goalsMap) {
  return sharedDurationFromAssignment(assignment, goalsMap, 15);
}

function hourOrder(slotKey) {
  if (slotKey === 'anytime') return 24 * 60 + 99;
  const mins = slotKeyToMinutesSinceMidnight(slotKey);
  if (mins == null) return 98;
  return mins;
}

function normalizeTitle(value) {
  return String(value ?? '').trim().toLowerCase();
}

function minutesFromDateish(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

export function getCalendarEventsForDate(calendarEvents, dateStr) {
  if (!Array.isArray(calendarEvents) || !dateStr) return [];
  return calendarEvents.filter((event) => {
    const rawDate = event?.start ?? event?.date ?? null;
    if (!rawDate) return false;
    const parsed = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return false;
    const localDateStr = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    return localDateStr === dateStr;
  });
}

export function dedupeCalendarEventsForDate(calendarEvents, dayPlan, dateStr) {
  const dayEvents = getCalendarEventsForDate(calendarEvents, dateStr);
  if (!dayPlan || typeof dayPlan !== 'object' || dayEvents.length === 0) return dayEvents;

  const planEvents = flattenDayPlan(dayPlan).filter(({ assignment }) => assignment && typeof assignment === 'object' && assignment.type === 'event');
  if (planEvents.length === 0) return dayEvents;

  return dayEvents.filter((event) => {
    const eventTitle = normalizeTitle(event?.title ?? event?.summary ?? '');
    const eventStart = minutesFromDateish(event?.start ?? event?.date ?? null);
    const eventEnd = minutesFromDateish(event?.end ?? null);

    return !planEvents.some(({ slotKey, assignment }) => {
      const assignmentTitle = normalizeTitle(assignment?.title ?? '');
      if (assignmentTitle && eventTitle && assignmentTitle !== eventTitle) return false;

      const assignmentStart =
        minutesFromDateish(assignment?.startTime ?? null) ??
        slotKeyToMinutesSinceMidnight(toCanonicalSlotKey(slotKey) ?? slotKey);
      const assignmentEnd =
        minutesFromDateish(assignment?.endTime ?? null) ??
        (assignmentStart != null && Number.isFinite(Number(assignment?.duration))
          ? assignmentStart + Number(assignment.duration)
          : null);

      if (eventStart != null && assignmentStart != null && eventStart !== assignmentStart) return false;
      if (eventEnd != null && assignmentEnd != null && Math.abs(eventEnd - assignmentEnd) > 1) return false;
      return true;
    });
  });
}

export function isAssignmentFixed(a) {
  if (!a || typeof a !== 'object') return false;
  return a.isFixed === true || a.type === 'fixed' || a.fixed === true;
}

export function flattenDayPlan(dayPlan) {
  if (!dayPlan || typeof dayPlan !== 'object') return [];
  return Object.entries(dayPlan).flatMap(([slotKey, raw]) => {
    if (raw == null) return [];
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((assignment, index) => ({ slotKey, assignment, index }));
  });
}

export function getPlanItemsForDate(weekAssignments, goals, dateStr) {
  const dayPlan = weekAssignments?.[dateStr];
  if (!dayPlan || typeof dayPlan !== 'object') return [];
  const goalsMap = new Map((goals ?? []).map((g) => [g.id, g]));
  return flattenDayPlan(dayPlan)
    .map(({ slotKey, assignment, index }) => {
      const goalId = goalIdFromAssignment(assignment);
      const goal = goalId ? goalsMap.get(goalId) : null;
      const title =
        ritualTitleFromAssignment(assignment) ||
        (assignment && typeof assignment === 'object' ? assignment.title : null) ||
        goal?.title ||
        'Task';
      const duration = durationFromAssignment(assignment, goalsMap);
      const type =
        goal?.type ||
        (assignment && typeof assignment === 'object' && assignment.type) ||
        'task';
      const canonicalHour = toCanonicalSlotKey(slotKey) ?? slotKey;
      return {
        hour: canonicalHour,
        slotKey,
        order: hourOrder(canonicalHour),
        index,
        assignment,
        goalId,
        title,
        type,
        duration,
        isFixed: isAssignmentFixed(assignment),
      };
    })
    .sort((a, b) => a.order - b.order || a.index - b.index);
}

export function summarizeDayPlan(dayPlan, goals) {
  const goalsMap = new Map((goals ?? []).map((g) => [g.id, g]));
  const buckets = {};
  for (const { assignment } of flattenDayPlan(dayPlan)) {
    const goalId = goalIdFromAssignment(assignment);
    const ritualTitle = ritualTitleFromAssignment(assignment);
    const assignmentType = assignment && typeof assignment === 'object' ? assignment.type : null;
    const assignmentTitle = assignment && typeof assignment === 'object' ? assignment.title : null;
    const minutes = durationFromAssignment(assignment, goalsMap);

    const key = goalId
      ? ritualTitle
        ? `ritual:${goalId}:${ritualTitle}`
        : `goal:${goalId}`
      : `misc:${assignmentType || 'task'}:${(assignmentTitle || 'task').toLowerCase()}`;
    const title = ritualTitle || assignmentTitle || goalsMap.get(goalId)?.title || 'Task';
    const type = goalsMap.get(goalId)?.type || assignmentType || 'task';
    if (!buckets[key]) buckets[key] = { goalId: goalId || key, title, type, minutes: 0 };
    buckets[key].minutes += minutes;
  }
  return Object.values(buckets)
    .map((entry) => ({ ...entry, hours: Math.round((entry.minutes / 60) * 10) / 10 }))
    .sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
}
