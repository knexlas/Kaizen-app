import { getWeekId, localISODate } from '../../../services/dateUtils';

function toPlacementDate(dateLike) {
  if (dateLike instanceof Date) return dateLike;
  if (typeof dateLike === 'string' && dateLike) return new Date(`${dateLike}T12:00:00`);
  return new Date();
}

export function getRoutineSupportWeekId(dateLike = new Date()) {
  return getWeekId(toPlacementDate(dateLike));
}

export function createRoutineSupportPlacement(input = {}) {
  const placementDate = toPlacementDate(input.dateStr ?? input.date ?? new Date());
  const dateStr = localISODate(placementDate);
  const durationMinutes = Math.max(5, Math.min(180, Math.round(Number(input.durationMinutes ?? input.duration) || 15)));
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    id: input.id ?? `routine-support-${input.routineId ?? 'item'}-${dateStr}`,
    routineId: input.routineId ?? null,
    title: typeof input.title === 'string' && input.title.trim() ? input.title.trim() : 'Routine support',
    dateStr,
    weekId: typeof input.weekId === 'string' && input.weekId ? input.weekId : getRoutineSupportWeekId(placementDate),
    durationMinutes,
    mode: input.mode === 'light' ? 'light' : 'normal',
    source: input.source ?? 'systems',
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  };
}

export function normalizeRoutineSupportPlacements(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      try {
        return createRoutineSupportPlacement(item);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (
      String(a.dateStr).localeCompare(String(b.dateStr))
      || String(a.title).localeCompare(String(b.title))
    ));
}

export function buildRoutineSupportPlacementFromRoutine(routine, options = {}) {
  return createRoutineSupportPlacement({
    id: options.id,
    createdAt: options.createdAt,
    routineId: routine?.id ?? null,
    title: routine?.title ?? 'Routine support',
    dateStr: options.dateStr,
    durationMinutes: options.mode === 'light'
      ? Math.max(5, Math.round((Number(routine?.duration) || 15) * 0.6))
      : Math.max(5, Number(routine?.duration) || 15),
    mode: options.mode === 'light' ? 'light' : 'normal',
    source: options.source ?? 'systems',
  });
}

export function getRoutineSupportPlacementForWeek(placements, routineId, weekId) {
  if (!routineId || !weekId || !Array.isArray(placements)) return null;
  return placements.find((placement) => placement?.routineId === routineId && placement?.weekId === weekId) ?? null;
}

export function getRoutineSupportPlacementsForDate(placements, dateStr) {
  if (!dateStr || !Array.isArray(placements)) return [];
  return placements.filter((placement) => placement?.dateStr === dateStr);
}
