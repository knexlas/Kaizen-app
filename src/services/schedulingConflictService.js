/**
 * Scheduling conflict and duration helpers for day plans.
 * Canonical slot key format is "HH:MM" (e.g. "09:00", "10:30", "10:05"). Planner writes use toCanonicalSlotKey.
 * Minute resolution: events at 10:05 block 10:05–11:05 correctly.
 */

/** Convert minutes since midnight (0–1439) to canonical "HH:MM". */
export function minutesToCanonicalSlotKey(mins) {
  if (mins == null || mins < 0 || mins >= 24 * 60) return null;
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Convert any hour key to canonical "HH:MM". Input: number (9, 9.5), string ("9", "09:00", "10:05", "9.5"). Returns null for "anytime" or invalid. */
export function toCanonicalSlotKey(key) {
  if (key == null) return null;
  const s = String(key).trim();
  if (s === 'anytime') return null;
  const mins = slotKeyToMinutesSinceMidnight(key);
  if (mins == null || mins < 0 || mins > 24 * 60 - 1) return null;
  return minutesToCanonicalSlotKey(mins);
}

/** Minutes since midnight for a slot key. "10:30" → 630, 10.5 → 630, "10:00" → 600. Returns null for anytime/invalid. */
export function slotKeyToMinutesSinceMidnight(key) {
  if (key == null) return null;
  const s = String(key).trim();
  if (s === 'anytime') return null;
  if (s.includes(':')) {
    const parts = s.split(':');
    const h = parseInt(parts[0], 10);
    if (Number.isNaN(h) || h < 0 || h > 23) return null;
    const m = parts[1] != null ? parseInt(parts[1], 10) : 0;
    const mins = Number.isNaN(m) ? 0 : Math.max(0, Math.min(59, m));
    return h * 60 + mins;
  }
  const num = parseFloat(s);
  if (Number.isFinite(num)) {
    const h = Math.floor(num);
    const m = Math.round((num - h) * 60);
    return Math.max(0, Math.min(23 * 60 + 59, h * 60 + m));
  }
  return null;
}

/** Normalize a plan object so all slot keys are canonical "HH:MM". Preserves "anytime". Merges values when two keys map to same canonical key. */
export function normalizePlanKeys(plan) {
  if (!plan || typeof plan !== 'object') return {};
  const result = {};
  for (const [key, value] of Object.entries(plan)) {
    if (key === 'anytime') {
      result.anytime = value;
      continue;
    }
    const canon = toCanonicalSlotKey(key);
    if (!canon) continue;
    const existing = result[canon];
    if (existing !== undefined) {
      const listA = Array.isArray(existing) ? existing : [existing];
      const listB = Array.isArray(value) ? value : value != null ? [value] : [];
      result[canon] = [...listA, ...listB];
    } else {
      result[canon] = value;
    }
  }
  return result;
}

/** Normalize a plan key to integer hour (0–23). Handles "9", "09:00", "9.5", 9. Kept for backward compatibility. */
export function planKeyToHour(key) {
  const mins = slotKeyToMinutesSinceMidnight(key);
  if (mins == null) return null;
  return Math.floor(mins / 60);
}

/** Get duration in minutes for an assignment. Default 60. */
export function getDurationMinutesFromPlanAssignment(assignment) {
  if (!assignment || typeof assignment !== 'object') return 60;
  if (typeof assignment.duration === 'number') return Math.max(1, Math.min(480, assignment.duration));
  return 60;
}

/** Set of integer hours (0–23) that are occupied by existing plan entries (duration-aware, minute-precise). */
export function getOccupiedHours(plan) {
  const occupied = new Set();
  if (!plan || typeof plan !== 'object') return occupied;
  for (const [key, value] of Object.entries(plan)) {
    if (key === 'anytime') continue;
    const startMins = slotKeyToMinutesSinceMidnight(key);
    if (startMins == null) continue;
    const durationMinutes = getDurationMinutesFromPlanAssignment(value);
    const endMins = startMins + durationMinutes;
    const startHour = Math.floor(startMins / 60);
    const endHour = Math.floor((endMins - 1) / 60);
    for (let h = startHour; h <= endHour; h++) {
      if (h >= 0 && h <= 23) occupied.add(h);
    }
  }
  return occupied;
}

/**
 * Check if placing a task at startSlot with durationMinutes would conflict with the plan.
 * startSlot: number (e.g. 10.5 for 10:30) or string "10:30".
 * @returns {{ conflict: boolean, occupiedHours?: number[], conflictingItem?: { hour: number, title: string } }}
 */
export function checkPlacementConflict(plan, startSlot, durationMinutes) {
  const occupied = getOccupiedHours(plan);
  const startMins = slotKeyToMinutesSinceMidnight(startSlot);
  if (startMins == null || startMins < 0 || startMins >= 24 * 60) return { conflict: false };
  const dur = Math.max(1, durationMinutes || 60);
  const endMins = startMins + dur;
  const startHour = Math.floor(startMins / 60);
  const endHour = Math.floor((endMins - 1) / 60);
  const neededHours = [];
  for (let h = startHour; h <= endHour; h++) {
    if (h >= 0 && h <= 23) neededHours.push(h);
  }
  const conflicting = neededHours.filter((h) => occupied.has(h));
  if (conflicting.length === 0) return { conflict: false };

  const firstConflictHour = conflicting[0];
  let conflictingItem = null;
  for (const [key, value] of Object.entries(plan || {})) {
    if (key === 'anytime') continue;
    const keyStart = slotKeyToMinutesSinceMidnight(key);
    if (keyStart == null) continue;
    const durVal = getDurationMinutesFromPlanAssignment(value);
    const keyEnd = keyStart + durVal;
    const conflictStartMins = firstConflictHour * 60;
    const conflictEndMins = (firstConflictHour + 1) * 60;
    if (keyStart < conflictEndMins && keyEnd > conflictStartMins) {
      const title =
        (value && typeof value === 'object' && value.title) ||
        (value && typeof value === 'object' && value.type === 'event' && value.title) ||
        'Scheduled item';
      conflictingItem = { hour: Math.floor(keyStart / 60), title };
      break;
    }
  }

  return {
    conflict: true,
    occupiedHours: conflicting,
    conflictingItem: conflictingItem ?? { hour: firstConflictHour, title: 'Scheduled item' },
  };
}

/**
 * Find the next available start (minute resolution) that can fit durationMinutes without conflict.
 * fromSlot: number (decimal hour e.g. 10.0833) or string "HH:MM". Returns canonical "HH:MM" or null.
 */
export function findNextAvailableStart(plan, fromSlot, durationMinutes, endHour = 23) {
  const fromMins = slotKeyToMinutesSinceMidnight(fromSlot);
  if (fromMins == null || fromMins < 0) return null;
  const endMins = Math.min(endHour * 60, 24 * 60);
  const dur = Math.max(1, durationMinutes || 60);
  for (let m = fromMins; m + dur <= endMins; m += 1) {
    const key = minutesToCanonicalSlotKey(m);
    const result = checkPlacementConflict(plan, key, dur);
    if (!result.conflict) return key;
  }
  return null;
}
