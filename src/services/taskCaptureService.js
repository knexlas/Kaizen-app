/**
 * Normalize task/event capture payloads from multiple entry points (Quick Add, OmniAdd, planner actions)
 * into one shape consumed by GardenDashboard.
 */

function normalizeEnergyCost(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(3, Math.round(value)));
}

function normalizeRecurrence(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  if (raw.type === 'weekly') return { type: 'weekly', days: Array.isArray(raw.days) ? raw.days : [] };
  if (raw.type === 'monthly') return { type: 'monthly' };
  if (raw.type === 'custom') return { type: 'custom' };
  if (raw.type === 'daily') return { type: 'daily' };
  return undefined;
}

/**
 * @param {Object} input
 * @returns {{
 *   type: 'goal'|'calendar_event',
 *   title: string,
 *   isFixed?: boolean,
 *   context?: 'work'|'personal',
 *   recurrence?: { type: 'daily'|'weekly'|'monthly'|'custom', days?: number[] },
 *   energyCost?: number,
 *   startTime?: string,
 *   endTime?: string,
 * }}
 */
export function normalizeTaskCapture(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const type = raw.type === 'calendar_event' ? 'calendar_event' : 'goal';
  if (type === 'calendar_event') {
    return {
      type,
      title,
      startTime: typeof raw.startTime === 'string' && raw.startTime ? raw.startTime : undefined,
      endTime: typeof raw.endTime === 'string' && raw.endTime ? raw.endTime : undefined,
    };
  }
  const context = raw.context === 'work' ? 'work' : raw.context === 'personal' ? 'personal' : undefined;
  return {
    type,
    title,
    isFixed: raw.isFixed === true,
    context,
    recurrence: normalizeRecurrence(raw.recurrence),
    energyCost: normalizeEnergyCost(raw.energyCost),
  };
}

/** Build normalized day-plan assignment object from backlog/planner task. */
export function toPlanAssignmentFromTask(task, goal) {
  if (!task?.goalId) return null;
  return {
    goalId: task.goalId,
    title: task.title || goal?.title || 'Task',
    duration: Math.max(15, Number(goal?.estimatedMinutes) || 60),
    ...(task.subtaskId ? { subtaskId: task.subtaskId } : {}),
  };
}
