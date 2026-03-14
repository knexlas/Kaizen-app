/**
 * Helper (decision support) intervention model. Calm, minimal prompts.
 * Only show when: no next step, overdue unscheduled, overloaded, focus abandoned, missed-day recovery.
 * Each intervention has one purpose: clarify | unblock | start | recover.
 */

export const HELPER_INTERVENTION_TYPES = {
  NEXT_STEP: 'next_step',
  HABIT_STACK_HANDOFF: 'habit_stack_handoff',
  SUPPORT_SUGGESTION: 'support_suggestion',
  NO_NEXT_STEP: 'no_next_step',
  OVERDUE_UNSCHEDULED: 'overdue_unscheduled',
  OVERLOADED: 'overloaded',
  FOCUS_ABANDONED: 'focus_abandoned',
  MISSED_DAY_RECOVERY: 'missed_day_recovery',
  NEGLECTED_PROJECT_REVIVAL: 'neglected_project_revival',
  START_NOW: 'start_now',
  NOTE: 'note',
};

/** Purpose of the intervention (one per type). */
export const HELPER_PURPOSE = {
  [HELPER_INTERVENTION_TYPES.NEXT_STEP]: 'unblock',
  [HELPER_INTERVENTION_TYPES.HABIT_STACK_HANDOFF]: 'start',
  [HELPER_INTERVENTION_TYPES.SUPPORT_SUGGESTION]: 'clarify',
  [HELPER_INTERVENTION_TYPES.NO_NEXT_STEP]: 'unblock',
  [HELPER_INTERVENTION_TYPES.OVERDUE_UNSCHEDULED]: 'recover',
  [HELPER_INTERVENTION_TYPES.OVERLOADED]: 'clarify',
  [HELPER_INTERVENTION_TYPES.FOCUS_ABANDONED]: 'recover',
  [HELPER_INTERVENTION_TYPES.MISSED_DAY_RECOVERY]: 'recover',
  [HELPER_INTERVENTION_TYPES.NEGLECTED_PROJECT_REVIVAL]: 'recover',
  [HELPER_INTERVENTION_TYPES.START_NOW]: 'start',
  [HELPER_INTERVENTION_TYPES.NOTE]: 'clarify',
};

/** Higher number = show first when multiple are queued. */
export const HELPER_PRIORITY = {
  [HELPER_INTERVENTION_TYPES.NEXT_STEP]: 80,
  [HELPER_INTERVENTION_TYPES.HABIT_STACK_HANDOFF]: 85,
  [HELPER_INTERVENTION_TYPES.SUPPORT_SUGGESTION]: 60,
  [HELPER_INTERVENTION_TYPES.NO_NEXT_STEP]: 75,
  [HELPER_INTERVENTION_TYPES.OVERDUE_UNSCHEDULED]: 78,
  [HELPER_INTERVENTION_TYPES.OVERLOADED]: 70,
  [HELPER_INTERVENTION_TYPES.FOCUS_ABANDONED]: 72,
  [HELPER_INTERVENTION_TYPES.MISSED_DAY_RECOVERY]: 65,
  [HELPER_INTERVENTION_TYPES.NEGLECTED_PROJECT_REVIVAL]: 68,
  [HELPER_INTERVENTION_TYPES.START_NOW]: 70,
  [HELPER_INTERVENTION_TYPES.NOTE]: 50,
};

/** Cooldown (ms) per type before showing the same again. */
const COOLDOWN_MS = {
  [HELPER_INTERVENTION_TYPES.NEXT_STEP]: 15 * 60 * 1000,
  [HELPER_INTERVENTION_TYPES.HABIT_STACK_HANDOFF]: 15 * 60 * 1000,
  [HELPER_INTERVENTION_TYPES.SUPPORT_SUGGESTION]: 4 * 60 * 60 * 1000,
  [HELPER_INTERVENTION_TYPES.NO_NEXT_STEP]: 60 * 60 * 1000,
  [HELPER_INTERVENTION_TYPES.OVERDUE_UNSCHEDULED]: 60 * 60 * 1000,
  [HELPER_INTERVENTION_TYPES.OVERLOADED]: 30 * 60 * 1000,
  [HELPER_INTERVENTION_TYPES.FOCUS_ABANDONED]: 30 * 60 * 1000,
  [HELPER_INTERVENTION_TYPES.MISSED_DAY_RECOVERY]: 24 * 60 * 60 * 1000,
  [HELPER_INTERVENTION_TYPES.NEGLECTED_PROJECT_REVIVAL]: 24 * 60 * 60 * 1000,
  [HELPER_INTERVENTION_TYPES.START_NOW]: 10 * 60 * 1000,
  [HELPER_INTERVENTION_TYPES.NOTE]: 20 * 60 * 1000,
};

const STORAGE_KEY_PREFIX = 'kaizen_helper_last_';

/** Return cooldown ms for type (default 15 min). */
export function getHelperCooldownMs(type) {
  return COOLDOWN_MS[type] ?? 15 * 60 * 1000;
}

/** Check if we should show this intervention (cooldown not elapsed). Uses sessionStorage. */
export function shouldShowIntervention(type) {
  if (!type) return false;
  try {
    const key = STORAGE_KEY_PREFIX + type;
    const raw = sessionStorage.getItem(key);
    const last = raw ? parseInt(raw, 10) : 0;
    const cooldown = getHelperCooldownMs(type);
    return Date.now() - last >= cooldown;
  } catch {
    return true;
  }
}

/** Record that this intervention type was shown (call when adding to queue or when user sees it). */
export function recordHelperShown(type) {
  if (!type) return;
  try {
    sessionStorage.setItem(STORAGE_KEY_PREFIX + type, String(Date.now()));
  } catch (_) {}
}

const nextId = (() => {
  let n = 0;
  return () => `helper-${Date.now()}-${++n}`;
})();

/**
 * @typedef {Object} HelperIntervention
 * @property {string} id
 * @property {string} type - one of HELPER_INTERVENTION_TYPES
 * @property {number} priority
 * @property {string} [source] - e.g. 'task_complete', 'goal_create', 'routine_complete'
 * @property {'card'|'modal'} displayStyle
 * @property {Object} payload - type-specific data for the UI
 */

/**
 * @param {string} type
 * @param {Object} payload
 * @returns {HelperIntervention}
 */
export function createIntervention(type, payload = {}) {
  const priority = HELPER_PRIORITY[type] ?? 50;
  const displayStyle = type === HELPER_INTERVENTION_TYPES.START_NOW ? 'modal' : 'card';
  return {
    id: nextId(),
    type,
    priority,
    source: payload.source,
    displayStyle,
    payload: { ...payload },
  };
}

/** Get the single intervention to show from a queue (highest priority; stable order by id if tie). */
export function getCurrentIntervention(queue) {
  if (!Array.isArray(queue) || queue.length === 0) return null;
  const sorted = [...queue].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (a.id || '').localeCompare(b.id || '');
  });
  return sorted[0];
}

/** Remove one intervention by id from the queue. */
export function removeFromQueue(queue, id) {
  return (queue || []).filter((i) => i.id !== id);
}
