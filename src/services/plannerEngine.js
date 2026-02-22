export const ENERGY_ZONES = {
  HIGH: { start: 9, end: 12, label: 'Deep Work 🧠' },
  MEDIUM: { start: 13, end: 17, label: 'Action Mode ⚡' },
  LOW: { start: 17, end: 21, label: 'Gentle Admin 🍵' },
};

/**
 * Generates milestones working backward from a hard deadline (e.g., Marathon).
 * @param {string} goalTitle
 * @param {string} endDateStr - "2024-05-01"
 */
export function generateBackwardsPlan(goalTitle, endDateStr) {
  const end = new Date(endDateStr);
  const now = new Date();
  const weeks = Math.floor((end - now) / (1000 * 60 * 60 * 24 * 7));

  const milestones = [];

  // Simple heuristic: Break into 4 phases
  for (let i = 1; i <= 4; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + (weeks / 4) * i * 7);
    milestones.push({
      title: `${goalTitle} - Phase ${i}`,
      deadline: date.toISOString().split('T')[0],
      completed: false,
    });
  }
  return milestones;
}

/**
 * Re-shuffles the schedule when a task is missed.
 * Moves the missed task to the next available slot based on priority.
 */
export function recalibrateSchedule(missedTask, currentSchedule) {
  const newSchedule = { ...currentSchedule };

  // Find next empty slot
  // (Placeholder logic: in a real app, this would check calendar events)
  console.log('Recalibrating for missed task:', missedTask.title);

  return newSchedule;
}

/**
 * Auto-assigns tasks to hours based on Energy Level.
 */
export function optimizeDailySchedule(tasks, energyLevel = 'medium') {
  // 1. Sort tasks: Deep work first
  const deepTasks = tasks.filter((t) => t.estimatedMinutes >= 45);
  const quickTasks = tasks.filter((t) => t.estimatedMinutes < 45);

  const schedule = {};

  // 2. Assign High Energy tasks to Morning (9-12)
  if (energyLevel === 'high' || energyLevel === 'medium') {
    deepTasks.forEach((t, i) => {
      const hour = 9 + i;
      if (hour < 12) schedule[`${hour}:00`] = t;
    });
  }

  // 3. Assign remaining to afternoon
  quickTasks.forEach((t, i) => {
    const hour = 13 + i;
    if (hour < 17) schedule[`${hour}:00`] = t;
  });

  return schedule;
}

// --- Auto-fill week (7-day window) ---

import { localISODate } from './dateUtils';

function toDateStr(d) {
  return localISODate(d);
}

function parseStartDate(startDate) {
  if (startDate == null) return new Date();
  if (startDate instanceof Date) return new Date(startDate.getTime());
  const d = new Date(String(startDate).trim() + 'T12:00:00');
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Hour string to minutes since midnight (e.g. "09:00" -> 540). */
function hourToMinutes(h) {
  if (!h || typeof h !== 'string') return 0;
  const [hr, min] = h.trim().split(':').map(Number);
  return (hr ?? 0) * 60 + (min ?? 0);
}

/** Minutes to "HH:00" string. */
function minutesToHour(mins) {
  const h = Math.floor(mins / 60);
  return `${String(h).padStart(2, '0')}:00`;
}

/**
 * Get events that overlap a given date (YYYY-MM-DD).
 * Supports: { start, end } (ISO) or { dayIndex, start, end } (start/end "HH:mm", dayIndex 0=Sun).
 */
function getEventsForDate(dateStr, calendarEvents, weekStartDate) {
  if (!Array.isArray(calendarEvents) || calendarEvents.length === 0) return [];
  const d = new Date(dateStr + 'T12:00:00');
  const dayIndex = d.getDay(); // 0 Sun .. 6 Sat

  return calendarEvents.filter((e) => {
    if (e.start != null && e.end != null && (typeof e.start === 'string' || e.start instanceof Date)) {
      const start = new Date(e.start);
      const end = new Date(e.end);
      const eventDateStart = toDateStr(start);
      const eventDateEnd = toDateStr(end);
      return dateStr >= eventDateStart && dateStr <= eventDateEnd;
    }
    if (typeof e.dayIndex === 'number' && e.start != null && e.end != null) {
      return e.dayIndex === dayIndex;
    }
    return false;
  });
}

/**
 * For a given date and events on that date, return a Set of hour strings "HH:00" that are blocked.
 * Event times: ISO (use getHours) or "HH:mm" (parse).
 */
function getBlockedHoursForDate(dateStr, calendarEvents, weekStartDate) {
  const events = getEventsForDate(dateStr, calendarEvents, weekStartDate);
  const blocked = new Set();

  for (const e of events) {
    let startMins;
    let endMins;
    if (e.start != null && e.end != null && (typeof e.start === 'string' || e.start instanceof Date)) {
      const start = new Date(e.start);
      const end = new Date(e.end);
      const eventStart = toDateStr(start);
      const eventEnd = toDateStr(end);
      if (eventStart === dateStr && eventEnd === dateStr) {
        startMins = start.getHours() * 60 + start.getMinutes();
        endMins = end.getHours() * 60 + end.getMinutes();
      } else if (eventStart === dateStr) {
        startMins = start.getHours() * 60 + start.getMinutes();
        endMins = 24 * 60;
      } else if (eventEnd === dateStr) {
        startMins = 0;
        endMins = end.getHours() * 60 + end.getMinutes();
      } else {
        startMins = 0;
        endMins = 24 * 60;
      }
    } else {
      startMins = hourToMinutes(e.start);
      endMins = hourToMinutes(e.end);
    }
    for (let m = Math.floor(startMins / 60) * 60; m < endMins; m += 60) {
      blocked.add(minutesToHour(m));
    }
  }
  return blocked;
}

/** Return array of "HH:00" in [startHour, endHour) that are not blocked. */
function getAvailableSlotsForDate(dateStr, calendarEvents, startHour, endHour) {
  const blocked = getBlockedHoursForDate(dateStr, calendarEvents, null);
  const out = [];
  for (let h = startHour; h < endHour; h++) {
    const key = minutesToHour(h * 60);
    if (!blocked.has(key)) out.push(key);
  }
  return out;
}

/**
 * Auto-fill a 7-day calendar window with routines (early morning / evening) and incomplete subtasks (daytime).
 * @param {Array} goals - All goals (routines + kaizen/project)
 * @param {Array} calendarEvents - Events: { start, end } (ISO) or { dayIndex, start, end }
 * @param {Date|string} startDate - First day of the week (default today)
 * @returns {Object} { "YYYY-MM-DD": { "09:00": { title, goalId, subtaskId? }, ... }, ... } matching weekAssignments
 */
export function autoFillWeek(goals, calendarEvents, startDate) {
  const start = parseStartDate(startDate);
  const dateStrings = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dateStrings.push(toDateStr(d));
  }

  const result = {};
  dateStrings.forEach((dateStr) => {
    result[dateStr] = {};
  });

  const routines = (goals ?? []).filter((g) => g?.type === 'routine' && g?.id);
  const kaizenGoals = (goals ?? []).filter((g) => g?.id && (g.type === 'kaizen' || g._projectGoal));
  const incompleteSubtasks = [];
  kaizenGoals.forEach((goal) => {
    const subs = Array.isArray(goal.subtasks) ? goal.subtasks : [];
    subs.forEach((st) => {
      const est = Number(st.estimatedHours) || 0;
      const done = Number(st.completedHours) || 0;
      if (est > 0 && done < est) {
        incompleteSubtasks.push({
          goalId: goal.id,
          subtaskId: st.id,
          title: st.title || 'Task',
        });
      }
    });
  });

  // 1. Routines → 08:00 (early morning) or 18:00 (evening) for every day
  const MORNING_SLOT = '08:00';
  const EVENING_SLOT = '18:00';
  dateStrings.forEach((dateStr) => {
    const dayAssignments = result[dateStr];
    const blocked = getBlockedHoursForDate(dateStr, calendarEvents, null);

    routines.forEach((r, idx) => {
      const preferMorning = idx % 2 === 0;
      const morningFree = !blocked.has(MORNING_SLOT) && !dayAssignments[MORNING_SLOT];
      const eveningFree = !blocked.has(EVENING_SLOT) && !dayAssignments[EVENING_SLOT];
      const routineAssignment = {
        parentGoalId: r.id,
        goalId: r.id,
        title: r.title,
        type: 'routine',
        duration: 60,
      };
      if (preferMorning && morningFree) {
        dayAssignments[MORNING_SLOT] = routineAssignment;
      } else if (preferMorning && eveningFree) {
        dayAssignments[EVENING_SLOT] = routineAssignment;
      } else if (!preferMorning && eveningFree) {
        dayAssignments[EVENING_SLOT] = routineAssignment;
      } else if (!preferMorning && morningFree) {
        dayAssignments[MORNING_SLOT] = routineAssignment;
      }
    });
  });

  // 2. Daytime slots 09:00–17:00 for subtasks; prioritize days with fewer calendar events
  const daytimeStart = 9;
  const daytimeEnd = 18; // 17:00 is last slot start

  const dayBusyCount = dateStrings.map((dateStr) => {
    const blocked = getBlockedHoursForDate(dateStr, calendarEvents, null);
    const daytimeBlocked = [];
    for (let h = daytimeStart; h < daytimeEnd; h++) {
      if (blocked.has(minutesToHour(h * 60))) daytimeBlocked.push(h);
    }
    return { dateStr, blockedCount: daytimeBlocked.length, freeCount: daytimeEnd - daytimeStart - daytimeBlocked.length };
  });
  dayBusyCount.sort((a, b) => a.blockedCount - b.blockedCount);

  const slotQueue = [];
  dayBusyCount.forEach(({ dateStr }) => {
    const slots = getAvailableSlotsForDate(dateStr, calendarEvents, daytimeStart, daytimeEnd);
    slots.forEach((hour) => {
      slotQueue.push({ dateStr, hour });
    });
  });

  incompleteSubtasks.forEach((st, idx) => {
    const slot = slotQueue[idx];
    if (!slot) return;
    const dayAssignments = result[slot.dateStr];
    if (dayAssignments[slot.hour]) return;
    dayAssignments[slot.hour] = {
      title: st.title,
      goalId: st.goalId,
      subtaskId: st.subtaskId,
      subtaskTitle: st.title,
    };
  });

  return result;
}
