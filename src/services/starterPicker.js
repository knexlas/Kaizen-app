/**
 * Picks the best starter task for a 5-min flow: smallest/easiest first.
 * Prefers spoonCost === 1, then smallest estimatedMinutes, then first by order.
 */

/**
 * @param {{ items: Array<{ hour?: string, goalId: string, goal: object, ritualTitle?: string, subtaskId?: string }> }} options
 * @returns {{ goal: object, goalId: string, hour?: string, ritualTitle?: string, subtaskId?: string } | null}
 */
export function pickStarterTask({ items = [] }) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return null;

  const withMeta = list.map((item) => {
    const goal = item.goal;
    const estimatedMinutes = goal?.estimatedMinutes ?? 60;
    const spoonCost = goal?.spoonCost ?? 1;
    return { ...item, estimatedMinutes, spoonCost };
  });

  const sorted = [...withMeta].sort((a, b) => {
    if (a.spoonCost !== b.spoonCost) return (a.spoonCost ?? 1) - (b.spoonCost ?? 1);
    return (a.estimatedMinutes ?? 60) - (b.estimatedMinutes ?? 60);
  });

  const best = sorted[0];
  if (!best?.goal) return null;
  return {
    goal: best.goal,
    goalId: best.goalId ?? best.goal?.id,
    hour: best.hour ?? null,
    ritualTitle: best.ritualTitle ?? null,
    subtaskId: best.subtaskId ?? null,
  };
}
