import { getDurationMinutesFromPlanAssignment } from '../../../services/schedulingConflictService';

export function buildBacklogTasks(goals, currentMonthStr) {
  const list = [];
  const seen = new Set();
  const month = currentMonthStr && currentMonthStr.length >= 7 ? currentMonthStr.slice(0, 7) : null;

  (goals || []).forEach((goal) => {
    if (goal.type === 'routine' || goal.recurrence) return;
    const breakdown = goal.narrativeBreakdown;
    if (breakdown && Array.isArray(breakdown.milestones)) {
      breakdown.milestones.forEach((milestone, mi) => {
        const activeMonth = milestone.activeMonth ?? milestone.active_month ?? null;
        if (month && activeMonth && activeMonth !== month) return;
        (milestone.tasks || []).forEach((task, ti) => {
          const id = `narrative-${goal.id}-m${mi}-t${ti}`;
          if (seen.has(id)) return;
          seen.add(id);
          list.push({
            id,
            title: task.title || 'Task',
            goalId: goal.id,
            goalTitle: goal.title,
            milestoneTitle: milestone.title ?? `Phase ${mi + 1}`,
            source: 'narrative',
            milestoneIndex: mi,
            taskIndex: ti,
            estimatedSparks: task.estimatedSparks ?? 2,
            isKaizen: Boolean(task.isKaizen),
            defaultStatus: 'active',
          });
        });
      });
    }

    const subtasks = Array.isArray(goal.subtasks) ? goal.subtasks : [];
    subtasks.forEach((st) => {
      if (st.deadline) return;
      const id = `subtask-${goal.id}-${st.id}`;
      if (seen.has(id)) return;
      seen.add(id);
      list.push({
        id,
        title: st.title || 'Subtask',
        goalId: goal.id,
        goalTitle: goal.title,
        source: 'subtask',
        subtaskId: st.id,
        estimatedSparks: 2,
        isKaizen: false,
        defaultStatus: 'someday',
      });
    });
  });

  return list;
}

export function buildBacklogTree(flatTasks) {
  if (!Array.isArray(flatTasks) || flatTasks.length === 0) return [];
  const byGoal = new Map();
  flatTasks.forEach((task) => {
    const gid = task.goalId ?? 'unknown';
    if (!byGoal.has(gid)) {
      byGoal.set(gid, { goalId: gid, goalTitle: task.goalTitle ?? 'Goal', milestones: [], subtasks: [] });
    }
    const goalNode = byGoal.get(gid);
    if (task.source === 'subtask') {
      goalNode.subtasks.push(task);
    } else {
      const mi = task.milestoneIndex ?? 0;
      const mTitle = task.milestoneTitle ?? `Phase ${mi + 1}`;
      let mile = goalNode.milestones.find((m) => m.milestoneIndex === mi);
      if (!mile) {
        mile = { milestoneTitle: mTitle, milestoneIndex: mi, tasks: [] };
        goalNode.milestones.push(mile);
      }
      mile.tasks.push(task);
    }
  });
  byGoal.forEach((node) => {
    node.milestones.sort((a, b) => a.milestoneIndex - b.milestoneIndex);
  });
  return Array.from(byGoal.values());
}

export function timeSlotToInput(slot) {
  if (slot != null && typeof slot === 'string' && /^\d{1,2}:\d{1,2}$/.test(slot.trim())) {
    const [h, m] = slot.trim().split(':').map(Number);
    if (Number.isFinite(h) && Number.isFinite(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  const n = Number(slot);
  if (!Number.isFinite(n)) return '09:00';
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function inputToTimeSlot(str) {
  if (!str || typeof str !== 'string') return 9;
  const [h, m] = str.split(':').map(Number);
  if (!Number.isFinite(h)) return 9;
  const mins = Number.isFinite(m) ? Math.max(0, Math.min(59, m)) : 0;
  return h + mins / 60;
}

export function getTaskDurationMinutes(selectedTask, goals) {
  if (!selectedTask || !Array.isArray(goals)) return 60;
  const goal = goals.find((g) => g.id === selectedTask.goalId);
  if (selectedTask.subtaskId && goal?.subtasks?.length) {
    const st = goal.subtasks.find((s) => s.id === selectedTask.subtaskId);
    const hours = Number(st?.estimatedHours);
    if (hours > 0) return Math.min(480, Math.round(hours * 60));
  }
  if (goal?.estimatedMinutes) return Math.min(480, Math.max(1, Number(goal.estimatedMinutes)));
  const sparks = Number(selectedTask.estimatedSparks);
  if (sparks > 0) return Math.min(120, Math.max(30, sparks * 30));
  return 60;
}

export function normalizeEventDurationInput(value, fallback = 60) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(15, Math.min(480, parsed));
}

export function getPlannedMinutesFromPlan(plan) {
  if (!plan || typeof plan !== 'object') return 0;
  let total = 0;
  for (const [key, value] of Object.entries(plan)) {
    if (key === 'anytime') continue;
    const list = Array.isArray(value) ? value : [value];
    for (const a of list) total += getDurationMinutesFromPlanAssignment(a);
  }
  return total;
}
