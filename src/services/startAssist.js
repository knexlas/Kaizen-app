/**
 * Start Assist: pick a suggested task for "Help me start" flow.
 * Returns a goal-like task the user can start, or null if no tasks today.
 * Prefers: spoonCost === 1, then smallest estimatedMinutes, then first.
 */

import { inferTaskTimingType } from './energyDictionaryService';
import { getTimingFitScore } from './insightsReflectionService';

/**
 * @param {{ todayTasks: Array<{ goalId: string, goal: object }>, items?: Array<{ hour?: string, goalId: string, goal: object, ritualTitle?: string, subtaskId?: string }> }} options
 *   - todayTasks: legacy list (no hour)
 *   - items: list with optional hour for ordering; used for "Start tiny" 5-min flow
 * @returns {object | null} A task (goal) to suggest, or null for "no tasks" mode. If items provided, returns { goal, goalId, hour?, ritualTitle?, subtaskId? }.
 */
export function pickStarterTask({ todayTasks = [], items = [], learnedEnergyProfile = null, now = new Date() }) {
  const list = Array.isArray(items) && items.length > 0 ? items : (Array.isArray(todayTasks) ? todayTasks.map((t) => ({ goalId: t.goalId, goal: t.goal })) : []);
  if (list.length === 0) return null;
  const currentHour = now instanceof Date ? now.getHours() : new Date().getHours();

  const withMeta = list.map((item) => {
    const goal = item.goal;
    const estimatedMinutes = goal?.estimatedMinutes ?? 60;
    const spoonCost = goal?.spoonCost ?? 1;
    const taskType = inferTaskTimingType(goal ?? item);
    const timingScore = learnedEnergyProfile ? getTimingFitScore(learnedEnergyProfile, taskType, currentHour) : 0;
    return { ...item, estimatedMinutes, spoonCost, timingScore };
  });

  const sorted = [...withMeta].sort((a, b) => {
    if (a.timingScore !== b.timingScore) return b.timingScore - a.timingScore;
    if (a.spoonCost !== b.spoonCost) return (a.spoonCost ?? 1) - (b.spoonCost ?? 1);
    return (a.estimatedMinutes ?? 60) - (b.estimatedMinutes ?? 60);
  });

  const best = sorted[0];
  if (!best?.goal) return null;

  if (items?.length > 0) {
    return {
      goal: best.goal,
      goalId: best.goalId ?? best.goal?.id,
      hour: best.hour ?? null,
      ritualTitle: best.ritualTitle ?? null,
      subtaskId: best.subtaskId ?? null,
    };
  }
  return best.goal;
}
