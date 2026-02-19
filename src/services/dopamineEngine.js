/**
 * Builds reward objects for the reward overlay (pushReward).
 * Returns { message, tone?, icon?, durationMs?, sound?, variableBonus? } or null.
 */

/**
 * @param {{ type: string, payload?: object }} input
 * @returns {{ message: string, tone?: string, icon?: string, durationMs?: number, variableBonus?: { embers?: number } } | null}
 */
export function buildReward(input) {
  if (!input?.type) return null;
  const payload = input.payload ?? {};
  switch (input.type) {
    case 'MORNING_CHECKIN_DONE': {
      const { spoonCount } = payload;
      return {
        message: typeof spoonCount === 'number' ? `Today you have ${spoonCount} spoons. Go gently.` : "Energy set. Start when you're ready.",
        tone: 'moss',
        icon: '🌱',
        durationMs: 2800,
      };
    }
    case 'LOAD_LIGHTENED': {
      const { removedCount } = payload;
      const msg = typeof removedCount === 'number' && removedCount > 0
        ? `Lightened by ${removedCount} item${removedCount === 1 ? '' : 's'}.`
        : 'Good decision. The garden will wait.';
      return { message: msg, tone: 'moss', icon: '🍃', durationMs: 2800 };
    }
    case 'FOCUS_COMPLETE': {
      const { goalTitle, minutes, spoonCount } = payload;
      const mins = typeof minutes === 'number' ? minutes : 0;
      const lowSpoons = typeof spoonCount === 'number' && spoonCount <= 4;
      const embers = lowSpoons && mins >= 5 ? 2 : mins >= 25 ? 1 : 0;
      const message = goalTitle ? `Nice focus on ${goalTitle}.` : 'Focus session complete.';
      return {
        message,
        tone: 'moss',
        icon: '✨',
        durationMs: 2800,
        ...(embers > 0 && { variableBonus: { embers } }),
      };
    }
    case 'MILESTONE_COMPLETE': {
      const { milestoneTitle } = payload;
      return {
        message: milestoneTitle ? `Milestone: ${milestoneTitle}` : 'Milestone reached!',
        tone: 'moss',
        icon: '🌿',
        durationMs: 2800,
      };
    }
    case 'COMPOST_ADDED': {
      return {
        message: 'Added to compost. No guilt.',
        tone: 'moss',
        icon: '🍂',
        durationMs: 2200,
      };
    }
    default:
      return null;
  }
}
