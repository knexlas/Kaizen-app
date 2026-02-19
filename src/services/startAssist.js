/**
 * Start Assist: pick a suggested task for "Help me start" flow.
 * Returns a goal-like task the user can start, or null if no tasks today.
 */

/**
 * @param {{ todayTasks: Array<{ goalId: string, goal: object }> }} options
 * @returns {object | null} A task (goal) to suggest, or null for "no tasks" mode
 */
export function pickStarterTask({ todayTasks = [] }) {
  const tasks = Array.isArray(todayTasks) ? todayTasks : [];
  const first = tasks.find((t) => t?.goal);
  if (!first?.goal) return null;
  return first.goal;
}
