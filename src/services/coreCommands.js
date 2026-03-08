import { generateDailyPlan, hourFromTimeStr } from './schedulerService';

function clampMinutes(raw, fallback = 5) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(120, Math.round(n)));
}

function buildTinyRoutineGoal(title, minutes = 5) {
  const cleanTitle = String(title ?? '').trim() || 'Tiny next step';
  return {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: 'routine',
    title: cleanTitle,
    estimatedMinutes: clampMinutes(minutes, 5),
    totalMinutes: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Canonical focus start contract for all entry points.
 * Returns a session payload plus optional goal to persist first.
 */
export function startFocusCommand({ goal, title, minutes = 5, subtaskId = null } = {}) {
  if (goal?.id) {
    return {
      goalToCreate: null,
      session: {
        ...goal,
        sessionDurationMinutes: clampMinutes(minutes, 5),
        subtaskId: subtaskId ?? null,
      },
    };
  }
  if (title) {
    const goalToCreate = buildTinyRoutineGoal(title, minutes);
    return {
      goalToCreate,
      session: {
        ...goalToCreate,
        sessionDurationMinutes: clampMinutes(minutes, 5),
        subtaskId: null,
      },
    };
  }
  return { goalToCreate: null, session: null };
}

/**
 * Canonical check-in completion contract for intro/entry flows.
 */
export function completeCheckInCommand({ choice, goals, weeklyEvents, userSettings }) {
  if (choice == null) return { plan: null };
  const eventsForPlan = Array.isArray(weeklyEvents) ? weeklyEvents : [];
  const startHour = hourFromTimeStr(userSettings?.dayStart, 8);
  const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
  const plan = choice === 0
    ? {}
    : generateDailyPlan(goals, choice, eventsForPlan, { stormBufferMinutes: 30, startHour, endHour });
  return { plan };
}

/**
 * Canonical load-relief feedback for "lighten day" entry points.
 */
export function planReliefCommand({ removedItems } = {}) {
  const count = Array.isArray(removedItems) ? removedItems.length : 0;
  if (count <= 0) {
    return { removedCount: 0, message: 'Your plan is already fairly light.' };
  }
  if (count === 1) {
    return { removedCount: 1, message: 'Removed 1 item to create breathing room.' };
  }
  return { removedCount: count, message: `Removed ${count} items to create breathing room.` };
}

