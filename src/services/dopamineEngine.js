/**
 * Builds reward objects for the single reward overlay (pushReward → RewardOverlay).
 * Use for: action confirmation, reward gained, milestone/unlock. Keeps messages consistent.
 *
 * Returns { message, tone?, icon?, durationMs?, sound?, variableBonus?, growthLine? } or null.
 * - variableBonus: { embers?, waterDrops? } shown as "+N Embers" / "+N Water".
 * - growthLine: optional second line (e.g. "Your [goal] has grown a little.").
 *
 * @param {{ type: string, payload?: object }} input
 * @returns {{ message: string, tone?: string, icon?: string, durationMs?: number, variableBonus?: { embers?: number, waterDrops?: number }, growthLine?: string } | null}
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
      const variableBonus = { waterDrops: 1 };
      if (embers > 0) variableBonus.embers = embers;
      return {
        message,
        tone: 'moss',
        icon: '✨',
        durationMs: 2800,
        variableBonus,
      };
    }
    /** User logged more time than estimated (time blindness / perseverance). */
    case 'FOCUS_PERSEVERANCE': {
      return {
        message: 'Wow, this seed had deep roots! You put in more time than we planned—here are some extra Embers for your perseverance.',
        tone: 'moss',
        icon: '🌿',
        durationMs: 3200,
        variableBonus: { embers: 2 },
      };
    }
    case 'MILESTONE_COMPLETE': {
      const { milestoneTitle } = payload;
      return {
        message: milestoneTitle ? `Milestone: ${milestoneTitle}` : 'Milestone reached!',
        tone: 'moss',
        icon: '🌿',
        durationMs: 2800,
        growthLine: 'Fertilizer applied. +15 min growth.',
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
    case 'ACTIVATION_START': {
      return {
        message: 'You showed up. That counts.',
        tone: 'moss',
        icon: '🌱',
        durationMs: 2200,
      };
    }
    case 'ACTIVATION_SHORT_SESSION': {
      return {
        message: 'Short sessions count. You showed up.',
        tone: 'moss',
        icon: '✨',
        durationMs: 2400,
      };
    }
    case 'ACTIVATION_RESUME': {
      return {
        message: "You came back. That's the rhythm.",
        tone: 'moss',
        icon: '🌿',
        durationMs: 2200,
      };
    }
    case 'ACTIVATION_TINY_STEP': {
      return {
        message: 'You chose a tiny step. That counts.',
        tone: 'moss',
        icon: '🌱',
        durationMs: 2200,
      };
    }
    /** Garden cause-and-effect: task completed from planner (anytime/slot). */
    case 'TASK_COMPLETE': {
      const { goalTitle } = payload;
      return {
        message: goalTitle ? `Nice — ${goalTitle} done.` : 'Task completed.',
        tone: 'moss',
        icon: '✓',
        durationMs: 2800,
        variableBonus: { waterDrops: 1 },
        growthLine: goalTitle ? `Your ${goalTitle} has grown a little.` : 'The garden got a little water.',
      };
    }
    /** Garden cause-and-effect: support suggestion accepted (goal or weekly event). */
    case 'SUPPORT_ACCEPTED': {
      return {
        message: 'Support planted.',
        tone: 'moss',
        icon: '🌱',
        durationMs: 2200,
        variableBonus: { waterDrops: 1 },
        growthLine: '+1 Water — the garden grows with you.',
      };
    }
    default:
      return null;
  }
}
