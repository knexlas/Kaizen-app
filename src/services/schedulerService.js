/**
 * Auto-Scheduler Algorithm for Kaizen (Solid vs Liquid routine goals).
 * Day index: 0 = Sunday, 1 = Monday, ... 6 = Saturday.
 * Times in "HH:mm" (24h). Events: { start, end, type? } with start/end ISO or { dayIndex, start, end, type? }.
 */

const DEFAULT_HOUR_START = 6;
const DEFAULT_HOUR_END = 23;

/** Parse "HH:mm" to minutes since midnight. Exported for callers that need to iterate hour slots. */
export function timeToMinutes(str) {
  if (!str || typeof str !== 'string') return 0;
  const [h, m] = str.trim().split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Get day index 0 (Sun) .. 6 (Sat) from an ISO date string or Date */
function getDayIndex(isoOrDate) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return d.getDay();
}

/** Normalize event to { dayIndex, startMinutes, endMinutes, type }. dayIndex 0=Sun..6=Sat. */
function normalizeEventToWeek(event, weekStartDate) {
  const type = event.type ?? 'leaf';
  let dayIndex;
  let startMinutes;
  let endMinutes;

  if (event.start != null && event.end != null && (typeof event.start === 'string' || event.start instanceof Date)) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const weekStart = new Date(weekStartDate);
    weekStart.setHours(0, 0, 0, 0);
    const dayOffset = Math.floor((start.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
    if (dayOffset < 0 || dayOffset > 6) return null;
    dayIndex = (weekStart.getDay() + dayOffset) % 7;
    startMinutes = start.getHours() * 60 + start.getMinutes();
    endMinutes = end.getHours() * 60 + end.getMinutes();
  } else if (typeof event.dayIndex === 'number' && event.start != null && event.end != null) {
    dayIndex = event.dayIndex;
    startMinutes = timeToMinutes(event.start);
    endMinutes = timeToMinutes(event.end);
  } else {
    return null;
  }

  return { dayIndex, startMinutes, endMinutes, type };
}

/** Merge overlapping intervals (same day), return sorted non-overlapping [{ start, end }, ...]. */
function mergeIntervals(intervals) {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      out.push({ start: sorted[i].start, end: sorted[i].end });
    }
  }
  return out;
}

/**
 * Find available (open) time windows for the week.
 * @param {Array} events - Google/weekly events: { start, end, type? } (ISO) or { dayIndex, start, end, type? }
 * @param {Array} existingPlans - Already scheduled blocks: { dayIndex, start, end } (start/end "HH:mm")
 * @param {Object} options - { weekStartDate?: Date (Monday), startHour?: number, endHour?: number }
 * @returns {Array<{ dayIndex: number, start: string, end: string }>} Open windows. Storm blocks are excluded when possible.
 */
export function findAvailableSlots(events, existingPlans = [], options = {}) {
  const weekStart = options.weekStartDate ?? getDefaultWeekStart();
  const startHour = options.startHour ?? DEFAULT_HOUR_START;
  const endHour = options.endHour ?? DEFAULT_HOUR_END;
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;

  const openWindows = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const blocked = [];

    if (Array.isArray(events)) {
      for (const e of events) {
        const norm = normalizeEventToWeek(e, weekStart);
        if (norm == null || norm.dayIndex !== dayIndex) continue;
        if (norm.type === 'storm') blocked.push({ start: norm.startMinutes, end: norm.endMinutes });
        else blocked.push({ start: norm.startMinutes, end: norm.endMinutes });
      }
    }

    if (Array.isArray(existingPlans)) {
      for (const p of existingPlans) {
        if (p.dayIndex !== dayIndex) continue;
        const s = timeToMinutes(p.start);
        const e = timeToMinutes(p.end);
        if (s < e) blocked.push({ start: s, end: e });
      }
    }

    const merged = mergeIntervals(blocked);
    let cursor = dayStart;
    for (const b of merged) {
      if (b.start > cursor) {
        openWindows.push({
          dayIndex,
          start: minutesToTime(cursor),
          end: minutesToTime(Math.min(b.start, dayEnd)),
        });
      }
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < dayEnd) {
      openWindows.push({
        dayIndex,
        start: minutesToTime(cursor),
        end: minutesToTime(dayEnd),
      });
    }
  }

  return openWindows.filter((w) => timeToMinutes(w.start) < timeToMinutes(w.end));
}

export function getDefaultWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Generate liquid (flexible) schedule: fill available slots with 1h/2h blocks until needed hours met.
 * If goal has subtasks with deadlines, prioritizes subtasks by nearest deadline first and tags blocks with subtaskId/subtaskTitle.
 * @param {Object} goal - { id, title, targetHours?, subtasks?: Array<{ id, title, estimatedHours, completedHours, deadline }>, ... }
 * @param {Array<{ dayIndex, start, end }>} availableSlots - Open windows from findAvailableSlots
 * @returns {Array<{ dayIndex, start, end, durationMinutes, parentGoalId, title, type: 'routine', subtaskId?, subtaskTitle? }>}
 */
export function generateLiquidSchedule(goal, availableSlots) {
  if (!goal?.id || !Array.isArray(availableSlots) || availableSlots.length === 0) return [];

  const settings = goal.schedulerSettings ?? {};
  const preference = (() => {
    const r = settings.ritualName;
    if (r === 'Morning Heavy') return 'morning';
    if (r === 'Afternoon Heavy') return 'afternoon';
    return settings.preference ?? 'balanced';
  })();

  const slotStarts = availableSlots.map((s) => ({
    ...s,
    startMinutes: timeToMinutes(s.start),
    endMinutes: timeToMinutes(s.end),
    durationMinutes: timeToMinutes(s.end) - timeToMinutes(s.start),
  }));

  const sortedSlots = [...slotStarts].sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    if (preference === 'afternoon') return b.startMinutes - a.startMinutes;
    return a.startMinutes - b.startMinutes;
  });

  const subtasks = Array.isArray(goal.subtasks) ? goal.subtasks : [];
  const hasSubtasksWithDeadline = subtasks.some((st) => st.deadline && (Number(st.estimatedHours) || 0) > 0);

  if (hasSubtasksWithDeadline) {
    const demands = subtasks
      .filter((st) => st.deadline && (Number(st.estimatedHours) || 0) > 0)
      .map((st) => ({
        subtaskId: st.id,
        subtaskTitle: st.title,
        remainingMinutes: Math.max(0, (Number(st.estimatedHours) || 0) * 60 - (Number(st.completedHours) || 0) * 60),
        deadline: new Date(st.deadline),
      }))
      .filter((d) => d.remainingMinutes > 0)
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

    const blocks = [];
    let demandIndex = 0;
    for (const slot of sortedSlots) {
      if (demandIndex >= demands.length) break;
      let cursor = slot.startMinutes;
      const slotEnd = slot.endMinutes;
      let d = demands[demandIndex];
      while (d && cursor + 60 <= slotEnd && d.remainingMinutes > 0) {
        const blockDuration = Math.min(120, slotEnd - cursor, d.remainingMinutes);
        const duration = blockDuration >= 120 ? 120 : 60;
        blocks.push({
          dayIndex: slot.dayIndex,
          start: minutesToTime(cursor),
          end: minutesToTime(cursor + duration),
          durationMinutes: duration,
          parentGoalId: goal.id,
          title: goal.title,
          type: 'routine',
          subtaskId: d.subtaskId,
          subtaskTitle: d.subtaskTitle,
        });
        d.remainingMinutes -= duration;
        cursor += duration;
        if (d.remainingMinutes <= 0) {
          demandIndex++;
          d = demands[demandIndex];
        }
      }
    }
    return blocks;
  }

  const weeklyTarget = settings.weeklyTarget ?? (settings.monthlyTarget != null ? settings.monthlyTarget / 4 : null);
  const neededHours = weeklyTarget ?? goal.targetHours ?? 5;
  const targetMinutes = neededHours * 60;
  const blocks = [];
  let filledMinutes = 0;

  for (const slot of sortedSlots) {
    if (filledMinutes >= targetMinutes) break;
    let cursor = slot.startMinutes;
    const slotEnd = slot.endMinutes;
    while (cursor + 60 <= slotEnd && filledMinutes < targetMinutes) {
      const blockDuration = Math.min(120, slotEnd - cursor, targetMinutes - filledMinutes);
      const duration = blockDuration >= 120 ? 120 : 60;
      blocks.push({
        dayIndex: slot.dayIndex,
        start: minutesToTime(cursor),
        end: minutesToTime(cursor + duration),
        durationMinutes: duration,
        parentGoalId: goal.id,
        title: goal.title,
        type: 'routine',
      });
      filledMinutes += duration;
      cursor += duration;
    }
  }

  return blocks;
}

/**
 * Storm warning: (hours remaining) > (workable hours before deadline).
 * @param {Array} goals - Routine goals with subtasks
 * @param {Array} events - Weekly events (blocked time)
 * @param {Object} options - { weekStartDate?, startHour?, endHour? }
 * @returns {Array<{ goalId, goalTitle, subtaskId, subtaskTitle, message }>}
 */
export function getStormWarnings(goals, events = [], options = {}) {
  const weekStart = options.weekStartDate ?? getDefaultWeekStart();
  const startHour = options.startHour ?? DEFAULT_HOUR_START;
  const endHour = options.endHour ?? DEFAULT_HOUR_END;
  const openSlots = findAvailableSlots(events, [], options);
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;

  const workableMinutesByDay = {};
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + dayIndex);
    workableMinutesByDay[dayIndex] = openSlots
      .filter((s) => s.dayIndex === dayIndex)
      .reduce((sum, s) => sum + (timeToMinutes(s.end) - timeToMinutes(s.start)), 0);
  }

  const warnings = [];
  const routineGoals = Array.isArray(goals) ? goals.filter((g) => g.type === 'routine') : [];
  for (const goal of routineGoals) {
    const subtasks = goal.subtasks ?? [];
    for (const st of subtasks) {
      const deadline = st.deadline ? new Date(st.deadline) : null;
      if (!deadline) continue;
      const estimated = (Number(st.estimatedHours) || 0) * 60;
      const completed = (Number(st.completedHours) || 0) * 60;
      const remainingMinutes = Math.max(0, estimated - completed);
      if (remainingMinutes <= 0) continue;

      let workableBeforeDeadline = 0;
      deadline.setHours(23, 59, 59, 999);
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + dayIndex);
        if (dayDate <= deadline) workableBeforeDeadline += workableMinutesByDay[dayIndex] ?? 0;
      }

      if (remainingMinutes > workableBeforeDeadline) {
        warnings.push({
          goalId: goal.id,
          goalTitle: goal.title,
          subtaskId: st.id,
          subtaskTitle: st.title,
          message: `"${st.title}" has ${(remainingMinutes / 60).toFixed(1)}h left but only ${(workableBeforeDeadline / 60).toFixed(1)}h before deadline.`,
        });
      }
    }
  }
  return warnings;
}

/**
 * Generate solid (fixed) schedule: one block per configured day at start-end.
 * @param {Object} goal - { id, title, schedulerSettings?: { mode, days, start, end } }
 * @returns {Array<{ dayIndex, start, end, parentGoalId, title, type: 'routine' }>}
 */
export function generateSolidSchedule(goal) {
  if (!goal?.id) return [];
  const settings = goal.schedulerSettings ?? {};
  if (settings.mode !== 'solid' || !Array.isArray(settings.days) || settings.days.length === 0) return [];

  const start = settings.start ?? '09:00';
  const end = settings.end ?? '17:00';

  return settings.days.map((dayIndex) => ({
    dayIndex,
    start,
    end,
    durationMinutes: timeToMinutes(end) - timeToMinutes(start),
    parentGoalId: goal.id,
    title: goal.title,
    type: 'routine',
  }));
}

/** Hour slots for the day (06:00 .. 23:00), same as TimeSlicer. */
const SLOT_HOURS = Array.from(
  { length: DEFAULT_HOUR_END - DEFAULT_HOUR_START + 1 },
  (_, i) => `${String(DEFAULT_HOUR_START + i).padStart(2, '0')}:00`
);

function getGoalIdFromAssignment(a) {
  if (a == null) return null;
  if (typeof a === 'string') return a;
  if (typeof a === 'object' && a.parentGoalId) return a.parentGoalId;
  if (typeof a === 'object' && a.goalId) return a.goalId;
  return null;
}

/** Priority for removal when energy is low: remove high-focus first (0), then maintenance (1), then restorative (2). */
const REMOVE_ORDER_LOW_ENERGY = { 'high-focus': 0, maintenance: 1, restorative: 2 };
/** Priority for removal when energy is high: remove restorative first, then maintenance, then high-focus. */
const REMOVE_ORDER_HIGH_ENERGY = { restorative: 0, maintenance: 1, 'high-focus': 2 };

function getEnergyType(goal) {
  const t = goal?.energyType;
  if (t === 'high-focus' || t === 'maintenance' || t === 'restorative') return t;
  return 'maintenance';
}

/**
 * Suggest a lighter schedule based on energy level and goal energyType.
 * Goals may have energyType: 'high-focus' | 'maintenance' | 'restorative'.
 * @param {Object} assignments - { '06:00': value, ... }
 * @param {Array} goals - List of goals (with optional energyType)
 * @param {number} maxSlots - Max slots allowed (e.g. from weather + energy)
 * @param {number} energyModifier - From check-in: negative = low energy, 0 = normal, positive = high energy
 * @returns {null|{ assignments: Object, removedItems: Array<{ hour: string, title: string, energyType: string, reason: string }>}} New assignments and explanation, or null if no change needed
 */
export function suggestLoadLightening(assignments, goals, maxSlots, energyModifier = 0) {
  if (!assignments || typeof assignments !== 'object') return null;
  const goalMap = new Map((goals ?? []).map((g) => [g.id, g]));
  const goalIds = new Set(goalMap.keys());

  const filled = SLOT_HOURS.filter((hour) => {
    const gid = getGoalIdFromAssignment(assignments[hour]);
    return gid && goalIds.has(gid);
  }).map((hour) => {
    const a = assignments[hour];
    const gid = getGoalIdFromAssignment(a);
    const goal = goalMap.get(gid);
    const title = (a && typeof a === 'object' && a.title) ? a.title : (goal?.title ?? 'Task');
    const energyType = getEnergyType(goal);
    return { hour, goalId: gid, title, energyType };
  });

  const filledCount = filled.length;
  if (filledCount <= maxSlots) return null;

  const toRemoveCount = filledCount - maxSlots;
  const modifier = Number(energyModifier) || 0;

  const removeOrder = modifier < 0 ? REMOVE_ORDER_LOW_ENERGY : modifier > 0 ? REMOVE_ORDER_HIGH_ENERGY : null;
  const lowEnergy = modifier < 0;
  const highEnergy = modifier > 0;

  const sorted = filled.slice().sort((a, b) => {
    if (removeOrder) {
      const orderA = removeOrder[a.energyType] ?? 1;
      const orderB = removeOrder[b.energyType] ?? 1;
      if (orderA !== orderB) return orderA - orderB;
    }
    return b.hour.localeCompare(a.hour);
  });

  const toRemove = sorted.slice(0, toRemoveCount);
  const next = { ...assignments };
  const removedItems = [];

  toRemove.forEach(({ hour, title, energyType }) => {
    delete next[hour];
    let reason;
    if (lowEnergy) {
      reason = energyType === 'high-focus'
        ? 'Low energy: removed high-focus task to protect your capacity.'
        : energyType === 'maintenance'
          ? 'Low energy: removed maintenance task to lighten the load.'
          : 'Low energy: kept restorative tasks; removed this to fit capacity.';
    } else if (highEnergy) {
      reason = energyType === 'restorative'
        ? 'High energy: removed restorative task to free space for focus work.'
        : energyType === 'maintenance'
          ? 'High energy: removed maintenance task to fit capacity.'
          : 'High energy: kept focus work; removed this to fit capacity.';
    } else {
      reason = 'Over capacity: removed late-day task to fit your limit.';
    }
    removedItems.push({ hour, title, energyType, reason });
  });

  return { assignments: next, removedItems };
}

/**
 * Categorize a goal for balanced scheduling: 'work' (routine/focus) vs 'nourishment' (hobby/rest/social).
 * Goals can set scheduleCategory: 'work' | 'nourishment'. Default 'work'.
 */
function getScheduleCategory(goal) {
  const c = goal?.scheduleCategory;
  if (c === 'nourishment' || c === 'work') return c;
  return 'work';
}

const MAX_CONSECUTIVE_WORK_SLOTS = 4;

/**
 * Generate a simplified daily plan for today: routine goals only, capped by energy.
 * Balances 'Work' vs 'Nourishment' by energy level.
 * @param {Array} goals - All goals (routine goals are used; optional scheduleCategory: 'work' | 'nourishment')
 * @param {number} maxSlotsOrModifier - Spoon count (1–12) used as maxSlots, or legacy energy modifier (-2, 0, 1) for backward compat.
 * @returns {Object} assignments - { '06:00': { id, parentGoalId, title, type: 'routine', duration: 60 }, ... }
 */
export function generateDailyPlan(goals, maxSlotsOrModifier = 0) {
  const routineGoals = Array.isArray(goals) ? goals.filter((g) => g.type === 'routine') : [];
  if (routineGoals.length === 0) return {};

  const todayDayIndex = new Date().getDay();
  const maxSlots =
    typeof maxSlotsOrModifier === 'number' && maxSlotsOrModifier >= 1 && maxSlotsOrModifier <= 12
      ? maxSlotsOrModifier
      : Math.max(1, 6 + (Number(maxSlotsOrModifier) || 0));
  const availableSlotsToday = [{ dayIndex: todayDayIndex, start: '06:00', end: '23:00' }];

  const entriesByCategory = { work: [], nourishment: [] };

  for (const goal of routineGoals) {
    const settings = goal.schedulerSettings ?? {};
    const blocks = settings.mode === 'solid'
      ? generateSolidSchedule(goal).filter((b) => b.dayIndex === todayDayIndex)
      : generateLiquidSchedule(goal, availableSlotsToday).filter((b) => b.dayIndex === todayDayIndex);
    const category = getScheduleCategory(goal);

    for (const block of blocks) {
      let cursor = timeToMinutes(block.start);
      const endMins = timeToMinutes(block.end);
      while (cursor < endMins) {
        const hourStr = minutesToTime(cursor);
        const value = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          parentGoalId: goal.id,
          title: goal.title,
          type: 'routine',
          duration: 60,
          ...(block.subtaskId && { subtaskId: block.subtaskId, subtaskTitle: block.subtaskTitle }),
        };
        entriesByCategory[category].push({ hour: hourStr, value });
        cursor += 60;
      }
    }
  }

  const workEntries = entriesByCategory.work.sort((a, b) => a.hour.localeCompare(b.hour));
  const nourishmentEntries = entriesByCategory.nourishment.sort((a, b) => a.hour.localeCompare(b.hour));
  const modifier =
    typeof maxSlotsOrModifier === 'number' && maxSlotsOrModifier >= 1 && maxSlotsOrModifier <= 12
      ? (maxSlotsOrModifier <= 4 ? -2 : maxSlotsOrModifier >= 9 ? 1 : 0)
      : Number(maxSlotsOrModifier) || 0;

  let selected = [];

  if (modifier <= -2) {
    // Low Energy: ensure at least one Nourishment block (reserve one slot; bump Work if needed)
    const workTake = Math.max(0, maxSlots - 1);
    const oneNourishment = nourishmentEntries.length > 0 ? [nourishmentEntries[0]] : [];
    selected = [...workEntries.slice(0, workTake), ...oneNourishment]
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .slice(0, maxSlots);
  } else if (modifier >= 1) {
    // High Energy: prioritize Work but insert a Nourishment break after every 4 consecutive work slots
    let workIdx = 0;
    let nourishIdx = 0;
    let workInRow = 0;
    for (let slotIndex = 0; slotIndex < maxSlots; slotIndex++) {
      const hour = SLOT_HOURS[slotIndex];
      if (workInRow >= MAX_CONSECUTIVE_WORK_SLOTS && nourishIdx < nourishmentEntries.length) {
        selected.push({ hour, value: nourishmentEntries[nourishIdx++].value });
        workInRow = 0;
      } else if (workIdx < workEntries.length) {
        selected.push({ hour, value: workEntries[workIdx++].value });
        workInRow++;
      } else if (nourishIdx < nourishmentEntries.length) {
        selected.push({ hour, value: nourishmentEntries[nourishIdx++].value });
        workInRow = 0;
      } else break;
    }
  } else {
    // Normal: chronological mix, then cap
    const merged = [...workEntries, ...nourishmentEntries].sort((a, b) => a.hour.localeCompare(b.hour));
    selected = merged.slice(0, maxSlots);
  }

  const assignments = {};
  selected.forEach(({ hour, value }) => {
    assignments[hour] = value;
  });
  return assignments;
}
