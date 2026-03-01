/**
 * Scheduling conflict and duration helpers for day plans.
 * Canonical slot key format is "HH:00" (e.g. "09:00"). All planner writes should use toCanonicalSlotKey.
 * normalizePlanKeys can be used when loading or before saving to migrate legacy keys ("9", "9:00").
 * Plan keys may be string hour "9", "09:00", or decimal "9.5"; we normalize to integer hours for conflict checks.
 */

/** Convert any hour key to canonical "HH:00" format. Input: number (9), string ("9", "09:00", "9:00"). Returns null for "anytime" or invalid. */
export function toCanonicalSlotKey(key) {
  if (key == null) return null;
  const s = String(key).trim();
  if (s === 'anytime') return null;
  const h = planKeyToHour(key);
  if (h == null || h < 0 || h > 23) return null;
  return `${String(h).padStart(2, '0')}:00`;
}

/** Normalize a plan object so all slot keys are canonical "HH:00". Preserves "anytime". Merges values when two keys map to same canonical key. */
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

/** Normalize a plan key to integer hour (0–23). Handles "9", "09:00", "9.5", 9. */
export function planKeyToHour(key) {
  if (key == null) return null;
  const s = String(key).trim();
  if (s === 'anytime') return null;
  const num = parseFloat(s);
  if (!Number.isNaN(num)) return Math.max(0, Math.min(23, Math.floor(num)));
  const h = parseInt(s.slice(0, 2), 10);
  if (!Number.isNaN(h)) return Math.max(0, Math.min(23, h));
  return null;
}

/** Get duration in minutes for an assignment. Default 60. */
export function getDurationMinutesFromPlanAssignment(assignment) {
  if (!assignment || typeof assignment !== 'object') return 60;
  if (typeof assignment.duration === 'number') return Math.max(1, Math.min(480, assignment.duration));
  return 60;
}

/** Set of integer hours that are occupied by existing plan entries (duration-aware). */
export function getOccupiedHours(plan) {
  const occupied = new Set();
  if (!plan || typeof plan !== 'object') return occupied;
  for (const [key, value] of Object.entries(plan)) {
    if (key === 'anytime') continue;
    const startHour = planKeyToHour(key);
    if (startHour == null) continue;
    const durationMinutes = getDurationMinutesFromPlanAssignment(value);
    const durationHours = Math.ceil(durationMinutes / 60);
    for (let h = 0; h < durationHours; h++) {
      const hour = startHour + h;
      if (hour <= 23) occupied.add(hour);
    }
  }
  return occupied;
}

/**
 * Check if placing a task at startHour with durationMinutes would conflict with the plan.
 * startHour: integer 0–23 (or decimal, will be floored).
 * @returns {{ conflict: boolean, occupiedHours?: number[], conflictingItem?: { hour: number, title: string } }}
 */
export function checkPlacementConflict(plan, startHour, durationMinutes) {
  const occupied = getOccupiedHours(plan);
  const start = Math.floor(Number(startHour));
  if (!Number.isFinite(start) || start < 0 || start > 23) return { conflict: false };
  const durationHours = Math.ceil((durationMinutes || 60) / 60);
  const neededHours = [];
  for (let h = 0; h < durationHours; h++) {
    const hour = start + h;
    if (hour <= 23) neededHours.push(hour);
  }
  const conflicting = neededHours.filter((h) => occupied.has(h));
  if (conflicting.length === 0) return { conflict: false };

  const firstConflictHour = conflicting[0];
  let conflictingItem = null;
  for (const [key, value] of Object.entries(plan || {})) {
    if (key === 'anytime') continue;
    const h = planKeyToHour(key);
    if (h == null) continue;
    const dur = getDurationMinutesFromPlanAssignment(value);
    const endH = h + Math.ceil(dur / 60);
    if (firstConflictHour >= h && firstConflictHour < endH) {
      const title =
        (value && typeof value === 'object' && value.title) ||
        (value && typeof value === 'object' && value.type === 'event' && value.title) ||
        'Scheduled item';
      conflictingItem = { hour: h, title };
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
 * Find the next available start hour that can fit durationMinutes without conflict.
 * Returns null if no slot found before endHour (default 23).
 */
export function findNextAvailableStart(plan, fromHour, durationMinutes, endHour = 23) {
  const start = Math.floor(Number(fromHour));
  const dur = Math.ceil((durationMinutes || 60) / 60);
  for (let h = start; h <= endHour - dur + 1; h++) {
    const result = checkPlacementConflict(plan, h, durationMinutes || 60);
    if (!result.conflict) return h;
  }
  return null;
}
