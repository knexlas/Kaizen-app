/**
 * Given a completed subtask (goalId + subtaskId), find the next uncompleted task in the same milestone/phase.
 * Used by the Next Step Prompter to suggest the next logical step.
 * @param {Array} goals - All goals
 * @param {string} goalId - Goal that contains the completed task
 * @param {string} completedSubtaskId - Subtask that was just completed
 * @returns {{ goalId, subtaskId, title, taskId } | null} - taskId = `subtask-${goalId}-${subtaskId}` for Staging Area
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
  return {
    goalId: goal.id,
    subtaskId: next.id,
    title: next.title || 'Next step',
    taskId: `subtask-${goal.id}-${next.id}`,
  };
}
