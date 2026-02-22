/**
 * Auto-Scheduler Algorithm for Kaizen (Solid vs Liquid routine goals).
 * Day index: 0 = Sunday, 1 = Monday, ... 6 = Saturday.
 * Times in "HH:mm" (24h). Events: { start, end, type? } with start/end ISO or { dayIndex, start, end, type? }.
 */

import { localISODate } from './dateUtils';

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
 * Storm events are blocked; optional buffer expands storm blocks so time before/after is also unavailable.
 * @param {Array} events - Google/weekly events: { start, end, type? } (ISO) or { dayIndex, start, end, type? }
 * @param {Array} existingPlans - Already scheduled blocks: { dayIndex, start, end } (start/end "HH:mm")
 * @param {Object} options - { weekStartDate?, startHour?, endHour?, stormBufferMinutes?: number }
 * @returns {Array<{ dayIndex: number, start: string, end: string }>} Open windows.
 */
export function findAvailableSlots(events, existingPlans = [], options = {}) {
  const weekStart = options.weekStartDate ?? getDefaultWeekStart();
  const startHour = options.startHour ?? DEFAULT_HOUR_START;
  const endHour = options.endHour ?? DEFAULT_HOUR_END;
  const stormBufferMinutes = Math.max(0, Number(options.stormBufferMinutes) || 0);
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;

  const openWindows = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const blocked = [];

    if (Array.isArray(events)) {
      for (const e of events) {
        const norm = normalizeEventToWeek(e, weekStart);
        if (norm == null || norm.dayIndex !== dayIndex) continue;
        const start = Math.max(dayStart, norm.startMinutes - (norm.type === 'storm' ? stormBufferMinutes : 0));
        const end = Math.min(dayEnd, norm.endMinutes + (norm.type === 'storm' ? stormBufferMinutes : 0));
        blocked.push({ start, end });
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
 * Storm impact for a single day: capacity reduction and human-readable reason.
 * @param {Array} events - Weekly events (start/end ISO or dayIndex, start, end; type 'storm'|'leaf'|'sun')
 * @param {number} dayIndex - 0=Sun..6=Sat
 * @param {Object} options - { weekStartDate?, stormBufferMinutes?, stormCapacityCostPerEvent?: number }
 * @returns {{ stormCount: number, capacityReduction: number, bufferMinutesUsed: number, reason: string }}
 */
export function getStormImpactForDay(events, dayIndex, options = {}) {
  const weekStart = options.weekStartDate ?? getDefaultWeekStart();
  const stormBufferMinutes = Math.max(0, Number(options.stormBufferMinutes) || 0);
  const costPerEvent = Math.max(0, Number(options.stormCapacityCostPerEvent) ?? 1);

  let stormCount = 0;
  let totalStormMinutes = 0;

  if (Array.isArray(events)) {
    for (const e of events) {
      const norm = normalizeEventToWeek(e, weekStart);
      if (norm == null || norm.dayIndex !== dayIndex || norm.type !== 'storm') continue;
      stormCount += 1;
      const buffer = stormBufferMinutes * 2;
      totalStormMinutes += (norm.endMinutes - norm.startMinutes) + buffer;
    }
  }

  const capacityReduction = Math.min(stormCount * costPerEvent, 6);
  const bufferUsed = stormCount > 0 ? stormBufferMinutes : 0;
  const reason =
    stormCount === 0
      ? ''
      : bufferUsed > 0
        ? `${stormCount} storm event${stormCount !== 1 ? 's' : ''} today; capacity reduced by ${capacityReduction} spoon${capacityReduction !== 1 ? 's' : ''}; ${stormBufferMinutes} min buffer before/after storms.`
        : `${stormCount} storm event${stormCount !== 1 ? 's' : ''} today; capacity reduced by ${capacityReduction} spoon${capacityReduction !== 1 ? 's' : ''}.`;

  return { stormCount, capacityReduction, bufferMinutesUsed: bufferUsed, reason };
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
    const a = assignments[hour];
    const gid = getGoalIdFromAssignment(a);
    return (gid && goalIds.has(gid)) || (a && typeof a === 'object' && a.type === 'recovery');
  }).map((hour) => {
    const a = assignments[hour];
    const gid = getGoalIdFromAssignment(a);
    const goal = goalMap.get(gid);
    const title = (a && typeof a === 'object' && a.title) ? a.title : (goal?.title ?? 'Task');
    const energyType = getEnergyType(goal);
    const spoonCost = a && typeof a === 'object' && (a.type === 'recovery' || a.spoonCost === 0) ? 0 : getSpoonCost(goal ?? a);
    return { hour, goalId: gid, title, energyType, spoonCost };
  });

  const filledSpoonTotal = filled.reduce((sum, f) => sum + (f.spoonCost ?? 1), 0);
  if (filledSpoonTotal <= maxSlots) return null;
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

  // Remove items (only cost > 0) until spoon total <= maxSlots (budget)
  const next = { ...assignments };
  const removedItems = [];
  let currentTotal = filledSpoonTotal;
  const removable = sorted.filter((f) => (f.spoonCost ?? 1) > 0);
  for (const item of removable) {
    if (currentTotal <= maxSlots) break;
    const cost = item.spoonCost ?? 1;
    delete next[item.hour];
    currentTotal -= cost;
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
    removedItems.push({ hour: item.hour, title: item.title, energyType: item.energyType, reason });
  }

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

/** Spoon cost per slot (1–4). Default 1 for backward compat. Exported for capacity UI. */
export function getSpoonCost(goalOrAssignment) {
  const n = goalOrAssignment?.spoonCost ?? 1;
  return Math.max(1, Math.min(4, Number(n) || 1));
}

const MAX_CONSECUTIVE_WORK_SLOTS = 4;
const HIGH_SPOON_COST_THRESHOLD = 3; // Insert recovery after tasks with cost >= this

/**
 * Generate a simplified daily plan for today: routine goals only, capped by energy.
 * When calendarEvents is provided, storm events reduce capacity and optional buffer blocks exclude time before/after storms.
 * @param {Array} goals - All goals (routine goals are used)
 * @param {number} maxSlotsOrModifier - Spoon count (1–12) or legacy modifier (-2, 0, 1)
 * @param {Array} [calendarEvents] - Optional weekly events; when provided, storm impact reduces capacity and open windows exclude storms (+ buffer)
 * @param {Object} [options] - { stormBufferMinutes?: number, stormCapacityCostPerEvent?: number, weekStartDate?: Date }
 * @returns {Object} assignments - { '06:00': { id, parentGoalId, title, type: 'routine', duration: 60 }, ... }
 */
export function generateDailyPlan(goals, maxSlotsOrModifier = 0, calendarEvents = null, options = {}) {
  const routineGoals = Array.isArray(goals) ? goals.filter((g) => g.type === 'routine') : [];
  if (routineGoals.length === 0) return {};
  if (maxSlotsOrModifier === 0) return {};

  const todayDayIndex = new Date().getDay();
  let maxSlots =
    typeof maxSlotsOrModifier === 'number' && maxSlotsOrModifier >= 1 && maxSlotsOrModifier <= 12
      ? maxSlotsOrModifier
      : Math.max(1, 6 + (Number(maxSlotsOrModifier) || 0));

  const now = new Date();
  const currentHour = now.getHours();
  const startHour = Math.max(6, currentHour + 1);
  const startStr = `${String(startHour).padStart(2, '0')}:00`;

  if (startHour >= 23) return {};

  const opts = { weekStartDate: getDefaultWeekStart(), startHour: DEFAULT_HOUR_START, endHour: DEFAULT_HOUR_END, ...options };
  const stormBufferMinutes = Math.max(0, Number(opts.stormBufferMinutes) ?? 30);

  let futureHours;
  if (Array.isArray(calendarEvents) && calendarEvents.length > 0) {
    const stormImpact = getStormImpactForDay(calendarEvents, todayDayIndex, { ...opts, stormBufferMinutes });
    maxSlots = Math.max(1, maxSlots - stormImpact.capacityReduction);

    const openSlotsToday = findAvailableSlots(calendarEvents, [], { ...opts, stormBufferMinutes })
      .filter((s) => s.dayIndex === todayDayIndex);
    const startMins = timeToMinutes(startStr);
    const slotHourSet = new Set();
    for (const slot of openSlotsToday) {
      let cursor = timeToMinutes(slot.start);
      const endMins = timeToMinutes(slot.end);
      while (cursor + 60 <= endMins && cursor >= startMins - 60) {
        if (cursor >= startMins) slotHourSet.add(minutesToTime(cursor));
        cursor += 60;
      }
    }
    futureHours = Array.from(slotHourSet).sort();
  } else {
    futureHours = Array.from(
      { length: DEFAULT_HOUR_END - startHour + 1 },
      (_, i) => `${String(startHour + i).padStart(2, '0')}:00`
    );
  }

  const availableSlotsToday = [{ dayIndex: todayDayIndex, start: startStr, end: '23:00' }];

  const entriesByCategory = { work: [], nourishment: [] };

  const spoonBudget = maxSlots;

  for (const goal of routineGoals) {
    const settings = goal.schedulerSettings ?? {};
    const blocks = settings.mode === 'solid'
      ? generateSolidSchedule(goal).filter((b) => b.dayIndex === todayDayIndex)
      : generateLiquidSchedule(goal, availableSlotsToday).filter((b) => b.dayIndex === todayDayIndex);
    const category = getScheduleCategory(goal);
    const cost = getSpoonCost(goal);

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
          spoonCost: cost,
          ...(block.subtaskId && { subtaskId: block.subtaskId, subtaskTitle: block.subtaskTitle }),
        };
        entriesByCategory[category].push({ hour: hourStr, value, spoonCost: cost });
        cursor += 60;
      }
    }
  }

  function makeRecoveryValue() {
    return {
      id: `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      parentGoalId: null,
      title: 'Rest',
      type: 'recovery',
      duration: 60,
      spoonCost: 0,
    };
  }

  const workEntries = entriesByCategory.work.sort((a, b) => a.hour.localeCompare(b.hour));
  const nourishmentEntries = entriesByCategory.nourishment.sort((a, b) => a.hour.localeCompare(b.hour));
  const modifier =
    typeof maxSlotsOrModifier === 'number' && maxSlotsOrModifier >= 1 && maxSlotsOrModifier <= 12
      ? (maxSlotsOrModifier <= 4 ? -2 : maxSlotsOrModifier >= 9 ? 1 : 0)
      : Number(maxSlotsOrModifier) || 0;

  /** Build selected list: stay within spoon budget, insert recovery after high-cost (>= 3) tasks. */
  function selectWithinSpoonBudget(candidateEntries, futureHours) {
    const selected = [];
    let totalSpent = 0;
    let slotIdx = 0;
    let needRecoveryNext = false;
    let entryIdx = 0;
    while (slotIdx < futureHours.length) {
      const hour = futureHours[slotIdx];
      if (needRecoveryNext) {
        selected.push({ hour, value: makeRecoveryValue() });
        needRecoveryNext = false;
        slotIdx++;
        continue;
      }
      if (entryIdx >= candidateEntries.length) break;
      const entry = candidateEntries[entryIdx];
      const cost = entry.spoonCost ?? 1;
      if (totalSpent + cost > spoonBudget) break;
      selected.push({ hour, value: entry.value });
      totalSpent += cost;
      if (cost >= HIGH_SPOON_COST_THRESHOLD) needRecoveryNext = true;
      entryIdx++;
      slotIdx++;
    }
    return selected;
  }

  let candidateEntries = [];

  if (modifier <= -2) {
    // Low Energy: reserve ~1 spoon for nourishment, fill rest with work
    const reserveSpoons = 1;
    let workSpent = 0;
    const workTake = [];
    for (const e of workEntries) {
      const c = e.spoonCost ?? 1;
      if (workSpent + c > spoonBudget - reserveSpoons) break;
      workTake.push(e);
      workSpent += c;
    }
    const oneNourishment = nourishmentEntries.length > 0 ? [nourishmentEntries[0]] : [];
    candidateEntries = [...workTake, ...oneNourishment].sort((a, b) => a.hour.localeCompare(b.hour));
  } else if (modifier >= 1) {
    // High Energy: interleave work with nourishment every 4 work slots; then cap by spoon budget
    const interleaved = [];
    let workIdx = 0;
    let nourishIdx = 0;
    let workInRow = 0;
    let totalSpent = 0;
    while (totalSpent < spoonBudget && (workIdx < workEntries.length || nourishIdx < nourishmentEntries.length)) {
      if (workInRow >= MAX_CONSECUTIVE_WORK_SLOTS && nourishIdx < nourishmentEntries.length) {
        interleaved.push(nourishmentEntries[nourishIdx++]);
        workInRow = 0;
      } else if (workIdx < workEntries.length) {
        const e = workEntries[workIdx++];
        if (totalSpent + (e.spoonCost ?? 1) > spoonBudget) break;
        interleaved.push(e);
        totalSpent += e.spoonCost ?? 1;
        workInRow++;
      } else if (nourishIdx < nourishmentEntries.length) {
        interleaved.push(nourishmentEntries[nourishIdx++]);
        workInRow = 0;
      } else break;
    }
    candidateEntries = interleaved;
  } else {
    // Normal: chronological mix, cap by spoon budget
    const merged = [...workEntries, ...nourishmentEntries].sort((a, b) => a.hour.localeCompare(b.hour));
    let total = 0;
    for (const e of merged) {
      if (total + (e.spoonCost ?? 1) > spoonBudget) break;
      candidateEntries.push(e);
      total += e.spoonCost ?? 1;
    }
  }

  const selected = selectWithinSpoonBudget(candidateEntries, futureHours);

  const assignments = {};
  selected.forEach(({ hour, value }) => {
    assignments[hour] = value;
  });

  // Demo at 14:00: startStr='15:00', futureHours=['15:00'..'23:00']; no assignments in the past.
  const isDev = (typeof import.meta !== 'undefined' && import.meta.env?.DEV) || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');
  if (isDev && startHour === 15) {
    console.log('[generateDailyPlan] At 14:00 → from 15:00 onward', { startStr, keys: Object.keys(assignments) });
  }
  return assignments;
}

/**
 * Smart Plan: auto-fill today's schedule using gaps from calendar and goals.
 * @param {Array} goals - All goals (filters to Routine + Kaizen)
 * @param {Array} calendarEvents - Weekly events: { start, end } (ISO) or { dayIndex, start, end }
 * @param {string|number} energyLevel - 'high' | 'low' | 'normal', or spoon count (1–12), or modifier (-2, 0, 1)
 * @returns {Object} assignments - { '09:00': value, ... } compatible with TimeSlicer
 */
export function autoFillDailyPlan(goals, calendarEvents, energyLevel = 'normal') {
  const todayDayIndex = new Date().getDay();
  const workStart = 9 * 60; // 09:00
  const workEnd = 18 * 60; // 18:00 (6 PM)

  const options = {
    weekStartDate: getDefaultWeekStart(),
    startHour: 9,
    endHour: 18,
    stormBufferMinutes: 30,
  };

  const openSlots = findAvailableSlots(calendarEvents ?? [], [], options)
    .filter((s) => s.dayIndex === todayDayIndex);

  const slotHours = [];
  for (const slot of openSlots) {
    let cursor = timeToMinutes(slot.start);
    const endMins = timeToMinutes(slot.end);
    while (cursor + 60 <= endMins) {
      slotHours.push(minutesToTime(cursor));
      cursor += 60;
    }
  }

  // Only plan in the future: filter out slots that are already past
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nextHourMins = Math.ceil(nowMins / 60) * 60;
  const futureSlotHours = slotHours.filter((h) => timeToMinutes(h) >= nextHourMins);

  if (futureSlotHours.length === 0) return {};

  const eligibleGoals = (goals ?? []).filter(
    (g) => g?.id && (g.type === 'routine' || g.type === 'kaizen')
  );
  if (eligibleGoals.length === 0) return {};

  const energyStr = String(energyLevel).toLowerCase();
  const isHigh =
    energyStr === 'high' ||
    (typeof energyLevel === 'number' && energyLevel >= 9);
  const isLow =
    energyStr === 'low' ||
    (typeof energyLevel === 'number' && energyLevel <= 4);

  const sorted = [...eligibleGoals].sort((a, b) => {
    const minsA = Number(a?.estimatedMinutes) || 60;
    const minsB = Number(b?.estimatedMinutes) || 60;
    const adminA = getEnergyType(a) === 'maintenance' ? 1 : 0;
    const adminB = getEnergyType(b) === 'maintenance' ? 1 : 0;
    if (isHigh) {
      return minsB - minsA;
    }
    if (isLow) {
      if (adminA !== adminB) return adminA - adminB;
      return minsA - minsB;
    }
    return 0;
  });

  const assignments = {};
  let goalIdx = 0;
  const maxSlots = Math.min(
    futureSlotHours.length,
    typeof energyLevel === 'number' && energyLevel >= 1 && energyLevel <= 12
      ? energyLevel
      : isLow
        ? Math.min(4, futureSlotHours.length)
        : futureSlotHours.length
  );

  for (let i = 0; i < maxSlots && goalIdx < sorted.length; i++) {
    const hour = futureSlotHours[i];
    const goal = sorted[goalIdx++];
    if (goal.type === 'routine') {
      assignments[hour] = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        parentGoalId: goal.id,
        title: goal.title,
        type: 'routine',
        duration: 60,
      };
    } else {
      assignments[hour] = goal.id;
    }
  }

  return assignments;
}

const DAY_NAMES_TO_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

/**
 * Convert AI weekly plan into concrete daily assignments for each day.
 * @param {Object} weekPlan - { monday: [{ goalId, hours }], ... } from AI
 * @param {Array} goals - All goals
 * @param {Array} calendarEvents - Weekly calendar events
 * @returns {Object} { 'YYYY-MM-DD': { '09:00': assignment, ... }, ... }
 */
export function materializeWeeklyPlan(weekPlan, goals, calendarEvents = []) {
  if (!weekPlan || typeof weekPlan !== 'object') return {};

  const today = new Date();
  const todayDay = today.getDay();
  const diff = todayDay === 0 ? -6 : 1 - todayDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);

  const goalMap = new Map((goals ?? []).map((g) => [g.id, g]));
  const result = {};

  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  for (let i = 0; i < 7; i++) {
    const dayName = dayOrder[i];
    const dayItems = weekPlan[dayName];
    if (!Array.isArray(dayItems) || dayItems.length === 0) continue;

    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = localISODate(d);
    const dayIndex = d.getDay();

    const options = { weekStartDate: getDefaultWeekStart(), startHour: DEFAULT_HOUR_START, endHour: DEFAULT_HOUR_END, stormBufferMinutes: 30 };
    const openSlots = findAvailableSlots(calendarEvents ?? [], [], options)
      .filter((s) => s.dayIndex === dayIndex);

    const slotHours = [];
    for (const slot of openSlots) {
      let cursor = timeToMinutes(slot.start);
      const endMins = timeToMinutes(slot.end);
      while (cursor + 60 <= endMins) {
        slotHours.push(minutesToTime(cursor));
        cursor += 60;
      }
    }

    const dayAssignments = {};
    let slotIdx = 0;

    for (const item of dayItems) {
      const goalId = item.goalId;
      const hours = Math.max(1, Math.round(item.hours ?? 1));
      const goal = goalMap.get(goalId);
      if (!goal) continue;

      for (let h = 0; h < hours && slotIdx < slotHours.length; h++) {
        const hour = slotHours[slotIdx++];
        if (goal.type === 'routine') {
          dayAssignments[hour] = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            parentGoalId: goal.id,
            title: goal.title,
            type: 'routine',
            duration: 60,
            _autoGenerated: true,
          };
        } else {
          dayAssignments[hour] = goal.id;
        }
      }
    }

    if (Object.keys(dayAssignments).length > 0) {
      result[dateStr] = dayAssignments;
    }
  }

  return result;
}
