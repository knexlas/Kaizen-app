/**
 * Shared helpers for mixed plan assignment shapes.
 */

/** Resolve goalId from assignment (string, object.goalId, object.parentGoalId). */
export function getGoalIdFromAssignment(assignment) {
  if (assignment == null) return null;
  if (typeof assignment === 'string') return assignment;
  if (typeof assignment === 'object' && assignment.parentGoalId) return assignment.parentGoalId;
  if (typeof assignment === 'object' && assignment.goalId) return assignment.goalId;
  return null;
}

/** Return array of assignments for a slot key (single object/value or array). */
export function getAssignmentsForSlot(dayPlan, slotKey) {
  if (!dayPlan || dayPlan[slotKey] == null) return [];
  const value = dayPlan[slotKey];
  return Array.isArray(value) ? value : [value];
}

/** Derive duration in minutes from assignment with goal fallback. */
export function getDurationMinutesFromAssignment(assignment, goalsOrMap, defaultMinutes = 15) {
  if (!assignment) return Math.max(1, defaultMinutes);
  if (typeof assignment === 'object' && typeof assignment.duration === 'number') {
    return Math.max(1, assignment.duration);
  }
  const goalId = getGoalIdFromAssignment(assignment);
  if (!goalId) return Math.max(1, defaultMinutes);
  let goal = null;
  if (goalsOrMap instanceof Map) goal = goalsOrMap.get(goalId);
  else if (Array.isArray(goalsOrMap)) goal = goalsOrMap.find((g) => g.id === goalId);
  return Math.max(1, Number(goal?.estimatedMinutes) || defaultMinutes);
}
