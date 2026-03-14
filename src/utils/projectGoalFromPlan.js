/**
 * Build a project goal from a normalized slice/document plan.
 * Single source of truth for project creation from sliceProject or planProjectFromDocument.
 * Used by ProjectPlanner (create from slice) and CompostHeap (plan from document).
 *
 * @param {object} plan - Normalized plan from normalizeSliceProjectParsed: { title, summary, totalWeeks, phases }
 * @param {object} options - { titleOverride?, deadline?, parentGoalId?, _client?, _billable?, shouldIncludeTask?(phase, task) }
 * @returns {{ id, type, title, domain, estimatedMinutes, targetHours, milestones, subtasks, notes, rituals, _projectName, _projectDeadline, _projectTotalWeeks, _projectGoal, ...extras }}
 */
export function buildProjectGoalFromPlan(plan, options = {}) {
  const {
    titleOverride,
    deadline = null,
    parentGoalId = null,
    _client = null,
    _billable = false,
    shouldIncludeTask = () => true,
  } = options;

  const uid = () => crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const totalWeeks = Math.max(1, Number(plan?.totalWeeks) || 14);
  const milestones = [];
  const subtasks = [];

  (plan?.phases || []).forEach((phase) => {
    const phaseId = uid();
    milestones.push({
      id: phaseId,
      title: phase.title || phase.milestone || 'Phase milestone',
      weekRange: phase.weekRange || null,
      completed: false,
    });
    (phase.tasks || []).forEach((task) => {
      if (!shouldIncludeTask(phase, task)) return;
      const estimatedRaw = Number(task?.estimatedHours);
      const estimatedHours = Math.max(0, Number.isFinite(estimatedRaw) ? estimatedRaw : 2);
      subtasks.push({
        id: uid(),
        phaseId,
        title: String(task?.title ?? task?.name ?? '').trim() || 'Task',
        estimatedHours,
        completedHours: 0,
        deadline: null,
        color: null,
        weekRange: task?.weekRange != null && String(task.weekRange).trim() ? String(task.weekRange).trim() : null,
      });
    });
  });

  const notesParts = [plan?.summary || ''].filter(Boolean);
  if (totalWeeks) notesParts.push(`${totalWeeks} weeks`);
  if (deadline) notesParts.push(`Deadline: ${deadline}`);
  const notes = notesParts.join(' \u00b7 ') || undefined;

  const projectTitle = (titleOverride && String(titleOverride).trim()) || (plan?.title && String(plan.title).trim()) || (plan?.summary || 'Project').trim().slice(0, 200) || 'Project';

  return {
    id: uid(),
    type: 'kaizen',
    title: projectTitle,
    domain: 'mind',
    estimatedMinutes: 60,
    targetHours: subtasks.reduce((sum, st) => sum + (st.estimatedHours || 0), 0) || 5,
    totalMinutes: 0,
    createdAt: new Date().toISOString(),
    milestones,
    subtasks,
    notes,
    rituals: [],
    _projectName: projectTitle,
    _projectDeadline: deadline && String(deadline).trim() ? String(deadline).trim() : null,
    _projectTotalWeeks: totalWeeks,
    _projectGoal: true,
    ...(parentGoalId && { parentGoalId }),
    ...(_client && String(_client).trim() && { _client: String(_client).trim() }),
    ...(_billable && { _billable: true }),
  };
}
