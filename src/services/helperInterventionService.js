/**
 * Unified helper (Mochi) intervention model.
 * All nudges/prompts use: type, priority, source, display style, dismiss/snooze behavior.
 * One companion identity: "Mochi" = name, "Spirit" = role/theme.
 */

export const HELPER_INTERVENTION_TYPES = {
  SUPPORT_SUGGESTION: 'support_suggestion',
  HABIT_STACK_HANDOFF: 'habit_stack_handoff',
  NEXT_STEP: 'next_step',
  START_NOW: 'start_now',
  NOTE: 'note',
};

/** Higher number = show first when multiple are queued. */
export const HELPER_PRIORITY = {
  [HELPER_INTERVENTION_TYPES.SUPPORT_SUGGESTION]: 100,
  [HELPER_INTERVENTION_TYPES.HABIT_STACK_HANDOFF]: 90,
  [HELPER_INTERVENTION_TYPES.NEXT_STEP]: 80,
  [HELPER_INTERVENTION_TYPES.START_NOW]: 70,
  [HELPER_INTERVENTION_TYPES.NOTE]: 60,
};

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
