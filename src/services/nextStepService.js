const MIN_SUGGESTED_MINUTES = 5;
const MAX_SUGGESTED_MINUTES = 20;
const LARGE_STEP_HOURS = 1;
const STARTER_ACTION_TITLE = 'Define the first 15-minute step';
const STARTER_ACTION_MINUTES = 15;

/** Clamp suggested duration to 5–20 minutes for display; actual estimatedHours is preserved. */
function suggestedMinutesFromHours(estimatedHours) {
  const mins = Math.round((Number(estimatedHours) || 0) * 60) || MIN_SUGGESTED_MINUTES;
  return Math.max(MIN_SUGGESTED_MINUTES, Math.min(MAX_SUGGESTED_MINUTES, mins));
}

/** True if the step is large enough to suggest breaking into smaller steps. */
function isLargeStep(estimatedHours) {
  return (Number(estimatedHours) || 0) > LARGE_STEP_HOURS;
}

/** Ensure title is action-phrased: if it looks like a noun phrase (no leading verb), prefix with "Do: ". */
function toActionPhrase(title) {
  if (!title || typeof title !== 'string') return STARTER_ACTION_TITLE;
  const t = title.trim();
  if (!t) return STARTER_ACTION_TITLE;
  const verbLead = /^(complete|do|draft|write|send|call|review|check|add|create|edit|submit|schedule|reply|read|watch|list|outline|prepare|finish|start|open|close|update|fix|test|run|build|design|sketch|email|post|upload|download)/i.test(t);
  if (verbLead) return t;
  return `Do: ${t}`;
}

/**
 * Get the first uncompleted subtask for a goal (by phaseId then array order).
 * @returns {{ subtaskId, title, estimatedHours, completedHours } | null}
 */
function getFirstUncompletedSubtask(goal) {
  if (!goal || !Array.isArray(goal.subtasks) || goal.subtasks.length === 0) return null;
  const subs = goal.subtasks.slice().sort((a, b) => {
    const pa = a.phaseId ?? '';
    const pb = b.phaseId ?? '';
    if (pa !== pb) return String(pa).localeCompare(String(pb));
    return 0;
  });
  for (const s of subs) {
    const comp = Number(s.completedHours) || 0;
    const est = Number(s.estimatedHours) || 0.01;
    if (comp < est) return { subtaskId: s.id, title: s.title || 'Next step', estimatedHours: est, completedHours: comp };
  }
  return null;
}

/**
 * Best next step for any goal (project or kaizen). Deterministic.
 * Returns a single, concrete, 5–20 min suggested action; uses fallbacks for no subtasks / blocked / too large.
 *
 * @param {Object} goal - Goal with id, title, subtasks (optional), _projectGoal (optional)
 * @returns {{ goalId, subtaskId, title, suggestedMinutes, estimatedHours, taskId, blocked, isStarter, suggestedBreakdown } | null}
 *   - blocked: true if no actionable step (all subtasks done or none exist and we don't create one on the fly)
 *   - isStarter: true if this is the synthetic "define first step" action (no subtask yet)
 *   - suggestedBreakdown: true if the step is > 1 hour and should be broken into smaller steps
 */
export function getBestNextStepForGoal(goal) {
  if (!goal?.id) return null;

  const raw = getFirstUncompletedSubtask(goal);

  if (!raw) {
    const hasSubtasks = Array.isArray(goal.subtasks) && goal.subtasks.length > 0;
    if (hasSubtasks) {
      return {
        goalId: goal.id,
        subtaskId: null,
        title: null,
        suggestedMinutes: null,
        estimatedHours: null,
        taskId: null,
        blocked: true,
        isStarter: false,
        suggestedBreakdown: false,
      };
    }
    return {
      goalId: goal.id,
      subtaskId: null,
      title: STARTER_ACTION_TITLE,
      suggestedMinutes: STARTER_ACTION_MINUTES,
      estimatedHours: STARTER_ACTION_MINUTES / 60,
      taskId: null,
      blocked: false,
      isStarter: true,
      suggestedBreakdown: false,
    };
  }

  const suggestedMinutes = suggestedMinutesFromHours(raw.estimatedHours);
  const suggestedBreakdown = isLargeStep(raw.estimatedHours);
  const title = toActionPhrase(raw.title);

  return {
    goalId: goal.id,
    subtaskId: raw.subtaskId,
    title,
    suggestedMinutes,
    estimatedHours: raw.estimatedHours,
    taskId: `subtask-${goal.id}-${raw.subtaskId}`,
    blocked: false,
    isStarter: false,
    suggestedBreakdown,
  };
}

/**
 * Given a completed subtask (goalId + subtaskId), find the next uncompleted task in the same milestone/phase.
 * Used by the Next Step Prompter to suggest the next logical step.
 * Returns best-next-step shape (action-phrased title, suggestedMinutes 5–20) when possible.
 *
 * @param {Array} goals - All goals
 * @param {string} goalId - Goal that contains the completed task
 * @param {string} completedSubtaskId - Subtask that was just completed
 * @returns {{ goalId, subtaskId, title, taskId, suggestedMinutes } | null} - taskId for Staging Area
 */
export function getNextTaskInSequence(goals, goalId, completedSubtaskId) {
  if (!goalId || !completedSubtaskId || !Array.isArray(goals)) return null;
  const goal = goals.find((g) => g.id === goalId);
  if (!goal || !Array.isArray(goal.subtasks)) return null;
  const completed = goal.subtasks.find((s) => s.id === completedSubtaskId);
  if (!completed) return null;
  const phaseId = completed.phaseId ?? null;
  const phaseSubtasks = phaseId
    ? goal.subtasks.filter((s) => s.phaseId === phaseId)
    : goal.subtasks;
  const idx = phaseSubtasks.findIndex((s) => s.id === completedSubtaskId);
  if (idx < 0 || idx >= phaseSubtasks.length - 1) return null;
  const next = phaseSubtasks[idx + 1];
  if (!next) return null;
  const completedHours = Number(next.completedHours) || 0;
  const estimatedHours = Number(next.estimatedHours) || 0.01;
  if (completedHours >= estimatedHours) return null;

  const suggestedMinutes = suggestedMinutesFromHours(estimatedHours);
  const title = toActionPhrase(next.title || 'Next step');

  return {
    goalId: goal.id,
    subtaskId: next.id,
    title,
    taskId: `subtask-${goal.id}-${next.id}`,
    suggestedMinutes,
  };
}

/*
 * RULES FOR GENERATING A NEXT STEP (deterministic, no AI required)
 * ---------------------------------------------------------------
 * 1. SOURCE: First uncompleted subtask where completedHours < estimatedHours, ordered by phaseId then array index.
 * 2. BLOCKED: If there are subtasks and all are complete, return blocked (do not invent progress).
 * 3. STARTER (no subtasks): Return one synthetic step: title = "Define the first 15-minute step", suggestedMinutes = 15, isStarter = true.
 * 4. DURATION: suggestedMinutes = clamp(estimatedHours * 60, 5, 20). Actual estimatedHours is kept for tracking.
 * 5. LARGE STEP: If estimatedHours > 1, set suggestedBreakdown = true; UI shows "Break into 3 smaller steps".
 * 6. ACTION PHRASING: If the subtask title does not start with a verb (from a fixed list), prefix with "Do: " so it reads as an action.
 */
