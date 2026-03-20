import { generateDailyPlan, getSpoonCost, hourFromTimeStr } from './schedulerService';
import { getAssignmentsForSlot, getGoalIdFromAssignment } from './planAssignmentUtils';

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
 * planContext: { dateStr, slotKey } when starting from a scheduled slot (enables reschedule/return on exit).
 */
export function startFocusCommand({ goal, title, minutes = 5, subtaskId = null, planContext = null } = {}) {
  if (goal?.id) {
    return {
      goalToCreate: null,
      session: {
        ...goal,
        sessionDurationMinutes: clampMinutes(minutes, 5),
        subtaskId: subtaskId ?? null,
        planContext: planContext && planContext.dateStr && planContext.slotKey ? { dateStr: planContext.dateStr, slotKey: planContext.slotKey } : null,
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
        planContext: null,
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

function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan ?? {}));
}

function slotKeyToMinutes(slotKey) {
  const [h, m] = String(slotKey ?? '').split(':').map(Number);
  if (!Number.isFinite(h)) return Number.POSITIVE_INFINITY;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

function buildHourlySlotKey(hour) {
  return `${String(Math.max(0, Math.min(23, hour))).padStart(2, '0')}:00`;
}

function listScheduledSlotKeys(dayPlan) {
  return Object.keys(dayPlan ?? {})
    .filter((key) => key !== 'anytime')
    .sort((a, b) => slotKeyToMinutes(a) - slotKeyToMinutes(b));
}

function firstFreeHourKey(dayPlan, startHour, endHour, options = {}) {
  const afterMinutes = Number.isFinite(options.afterMinutes) ? options.afterMinutes : -1;
  for (let hour = startHour; hour < endHour; hour += 1) {
    const key = buildHourlySlotKey(hour);
    if (slotKeyToMinutes(key) <= afterMinutes) continue;
    if (getAssignmentsForSlot(dayPlan, key).length === 0) return key;
  }
  return null;
}

function setSlotAssignments(dayPlan, slotKey, assignments) {
  if (!slotKey) return;
  if (!assignments || assignments.length === 0) {
    delete dayPlan[slotKey];
    return;
  }
  dayPlan[slotKey] = assignments.length === 1 ? assignments[0] : assignments;
}

function removeAssignmentFromSlot(dayPlan, slotKey, matcher) {
  const assignments = getAssignmentsForSlot(dayPlan, slotKey);
  if (assignments.length === 0) return null;
  const index = assignments.findIndex(matcher);
  if (index < 0) return null;
  const [removed] = assignments.splice(index, 1);
  setSlotAssignments(dayPlan, slotKey, assignments);
  return removed;
}

function pushAnytimeAssignment(dayPlan, assignment) {
  if (!assignment) return;
  dayPlan.anytime = Array.isArray(dayPlan.anytime) ? [...dayPlan.anytime, assignment] : [assignment];
}

function buildPlannedAssignment(goal, titleOverride = null, extras = {}) {
  if (!goal?.id) return null;
  return {
    goalId: goal.id,
    title: titleOverride ?? goal.title ?? 'Focus block',
    type: goal.type || 'kaizen',
    spoonCost: getSpoonCost(goal),
    ...extras,
  };
}

export function buildGoalFromDraftPlan({ title, steps = [], estimatedMinutes = 30, type = 'kaizen' } = {}) {
  const cleanTitle = String(title ?? '').trim() || 'Draft plan';
  const uid = () => crypto.randomUUID?.() ?? `goal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const cleanSteps = (Array.isArray(steps) ? steps : [])
    .map((step) => String(step ?? '').trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    id: uid(),
    type,
    title: cleanTitle,
    estimatedMinutes: clampMinutes(estimatedMinutes, 30),
    totalMinutes: 0,
    createdAt: new Date().toISOString(),
    subtasks: cleanSteps.map((step) => ({
      id: uid(),
      title: step,
      estimatedHours: 0.25,
      completedHours: 0,
    })),
  };
}

export function buildGoalFromCapture({
  title,
  captureKind = 'task',
  estimatedMinutes,
  energyCost,
  isFixed,
  context,
  recurrence,
} = {}) {
  const isHabit = captureKind === 'habit';
  const baseGoal = buildGoalFromDraftPlan({
    title,
    steps: [title],
    estimatedMinutes: estimatedMinutes ?? (isHabit ? 15 : 30),
    type: isHabit ? 'routine' : 'kaizen',
  });

  return {
    ...baseGoal,
    ...(typeof energyCost === 'number' ? { energyCost: Math.max(0, Math.min(3, Math.round(energyCost))) } : {}),
    ...(isFixed === true ? { isFixed: true } : {}),
    ...(context ? { context } : {}),
    ...(recurrence ? { recurrence } : {}),
    ...(isHabit ? { rituals: [] } : {}),
    captureSource: 'omni_add',
  };
}

export function protectFocusBlockCommand({ dayPlan, goal, preferredStartHour = 9, preferredEndHour = 12, dayEndHour = 22 } = {}) {
  if (!goal?.id) return { changed: false, reason: 'missing_goal' };
  const nextPlan = clonePlan(dayPlan);
  const slotKey =
    firstFreeHourKey(nextPlan, preferredStartHour, preferredEndHour)
    ?? firstFreeHourKey(nextPlan, preferredEndHour, dayEndHour)
    ?? null;
  if (!slotKey) return { changed: false, reason: 'no_free_slot', nextPlan };
  nextPlan[slotKey] = buildPlannedAssignment(goal, `Focus: ${goal.title}`, { fixed: true });
  return { changed: true, nextPlan, slotKey };
}

export function moveLowEnergyTasksLaterCommand({ dayPlan, goals = [], lowEnergyThreshold = 1, lateStartHour = 14, dayEndHour = 22 } = {}) {
  const nextPlan = clonePlan(dayPlan);
  const goalMap = new Map((goals ?? []).map((goal) => [goal.id, goal]));
  const scheduledKeys = listScheduledSlotKeys(nextPlan);
  const earlySlots = scheduledKeys.filter((key) => slotKeyToMinutes(key) < lateStartHour * 60);

  for (const slotKey of earlySlots) {
    const assignments = getAssignmentsForSlot(nextPlan, slotKey);
    const assignment = assignments[0];
    const goalId = getGoalIdFromAssignment(assignment);
    const goal = goalId ? goalMap.get(goalId) : null;
    const spoonCost = getSpoonCost(goal ?? assignment);
    if (spoonCost > lowEnergyThreshold) continue;

    const laterSlot = firstFreeHourKey(nextPlan, lateStartHour, dayEndHour, { afterMinutes: slotKeyToMinutes(slotKey) });
    const removed = removeAssignmentFromSlot(nextPlan, slotKey, (_, index) => index === 0);
    if (!removed) continue;
    if (laterSlot) {
      nextPlan[laterSlot] = removed;
      return { changed: true, nextPlan, movedTitle: removed?.title ?? goal?.title ?? 'Task', destination: laterSlot };
    }
    pushAnytimeAssignment(nextPlan, removed);
    return { changed: true, nextPlan, movedTitle: removed?.title ?? goal?.title ?? 'Task', destination: 'anytime' };
  }

  return { changed: false, reason: 'no_low_energy_task', nextPlan };
}

export function pullTaskForwardCommand({ dayPlan, goalId = null, targetStartHour = 8, targetEndHour = 12 } = {}) {
  const nextPlan = clonePlan(dayPlan);
  const earlySlot = firstFreeHourKey(nextPlan, targetStartHour, targetEndHour);
  if (!earlySlot) return { changed: false, reason: 'no_early_slot', nextPlan };

  if (Array.isArray(nextPlan.anytime) && nextPlan.anytime.length > 0) {
    const anytimeIndex = goalId
      ? nextPlan.anytime.findIndex((item) => getGoalIdFromAssignment(item) === goalId)
      : 0;
    if (anytimeIndex >= 0) {
      const [assignment] = nextPlan.anytime.splice(anytimeIndex, 1);
      if (nextPlan.anytime.length === 0) delete nextPlan.anytime;
      nextPlan[earlySlot] = assignment;
      return { changed: true, nextPlan, slotKey: earlySlot, movedTitle: assignment?.title ?? 'Task' };
    }
  }

  const scheduledKeys = listScheduledSlotKeys(nextPlan).sort((a, b) => slotKeyToMinutes(b) - slotKeyToMinutes(a));
  for (const slotKey of scheduledKeys) {
    if (slotKeyToMinutes(slotKey) <= slotKeyToMinutes(earlySlot)) continue;
    const assignments = getAssignmentsForSlot(nextPlan, slotKey);
    const index = goalId
      ? assignments.findIndex((item) => getGoalIdFromAssignment(item) === goalId)
      : 0;
    if (index < 0) continue;
    const removed = removeAssignmentFromSlot(nextPlan, slotKey, (_, itemIndex) => itemIndex === index);
    if (!removed) continue;
    nextPlan[earlySlot] = removed;
    return { changed: true, nextPlan, slotKey: earlySlot, movedTitle: removed?.title ?? 'Task' };
  }

  return { changed: false, reason: 'no_matching_task', nextPlan };
}

export function minimumViableDayCommand({ dayPlan, keepGoalId = null, keepCount = 2 } = {}) {
  const nextPlan = clonePlan(dayPlan);
  const scheduledKeys = listScheduledSlotKeys(nextPlan);
  if (scheduledKeys.length <= keepCount) return { changed: false, reason: 'already_small', nextPlan, removedItems: [] };

  const ranked = scheduledKeys.map((slotKey) => {
    const assignment = getAssignmentsForSlot(nextPlan, slotKey)[0];
    return {
      slotKey,
      assignment,
      goalId: getGoalIdFromAssignment(assignment),
    };
  });

  const keepers = [];
  if (keepGoalId) {
    const matching = ranked.find((item) => item.goalId === keepGoalId);
    if (matching) keepers.push(matching.slotKey);
  }
  ranked.forEach((item) => {
    if (keepers.length >= keepCount) return;
    if (!keepers.includes(item.slotKey)) keepers.push(item.slotKey);
  });

  const removedItems = [];
  ranked.forEach((item) => {
    if (keepers.includes(item.slotKey)) return;
    const removed = removeAssignmentFromSlot(nextPlan, item.slotKey, (_, index) => index === 0);
    if (!removed) return;
    pushAnytimeAssignment(nextPlan, removed);
    removedItems.push({ slotKey: item.slotKey, title: removed?.title ?? 'Task' });
  });

  return {
    changed: removedItems.length > 0,
    nextPlan,
    removedItems,
    keptSlots: keepers,
  };
}
