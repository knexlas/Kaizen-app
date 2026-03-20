/**
 * Reward/progression: reinforces meaningful work, not shallow interaction.
 *
 * Stronger rewards for: defining next step, completing planned focus, rescheduling,
 * missed-day recovery, week review, project progress, completing planned work.
 * Weaker or none for: opening screens, tapping, creating tiny low-value tasks, browsing.
 *
 * Returns { message, tone?, icon?, durationMs?, variableBonus?, growthLine?, showVariableBonus?, showGrowthLine?, surface? } or null.
 * variableBonus: { embers?, waterDrops? }; growthLine: optional second line.
 *
 * @param {{ type: string, payload?: object }} input
 */
export function buildReward(input) {
  if (!input?.type) return null;
  const payload = input.payload ?? {};
  switch (input.type) {
    case 'MORNING_CHECKIN_DONE': {
      const { spoonCount, missedDays } = payload;
      return {
        message: typeof spoonCount === 'number' ? `Capacity set: ${spoonCount} spoons.` : 'Capacity set for today.',
        tone: 'moss',
        icon: '🌱',
        durationMs: 2400,
        variableBonus: { waterDrops: 1 },
        growthLine: typeof missedDays === 'number' && missedDays > 1 ? 'You are back. Start small.' : null,
        showVariableBonus: false,
        showGrowthLine: false,
        surface: 'utility',
      };
    }
    case 'LOAD_LIGHTENED': {
      const { removedCount } = payload;
      return {
        message: typeof removedCount === 'number' && removedCount > 0
          ? `Lightened today by ${removedCount} item${removedCount === 1 ? '' : 's'}.`
          : 'Today has been lightened.',
        tone: 'moss',
        icon: '🍃',
        durationMs: 2400,
        variableBonus: { waterDrops: 1 },
        showVariableBonus: false,
        surface: 'utility',
      };
    }
    case 'FOCUS_COMPLETE': {
      const { goalTitle, minutes, spoonCount, fromPlanned } = payload;
      const mins = typeof minutes === 'number' ? minutes : 0;
      const variableBonus = { waterDrops: 1 };
      if (fromPlanned && mins >= 5) {
        variableBonus.embers = mins >= 25 ? 3 : 2;
      } else {
        const lowSpoons = typeof spoonCount === 'number' && spoonCount <= 4;
        if (lowSpoons && mins >= 5) variableBonus.embers = mins >= 25 ? 2 : 1;
        else if (mins >= 25) variableBonus.embers = 1;
      }
      return {
        message: goalTitle ? `${goalTitle} session complete.` : 'Session complete.',
        tone: 'moss',
        icon: '✓',
        durationMs: 2400,
        variableBonus,
        showVariableBonus: false,
        surface: 'utility',
      };
    }
    case 'FOCUS_PERSEVERANCE': {
      return {
        message: 'You put in more time than planned.',
        tone: 'moss',
        icon: '✓',
        durationMs: 2200,
        surface: 'utility',
      };
    }
    case 'MILESTONE_COMPLETE': {
      const { milestoneTitle } = payload;
      return {
        message: milestoneTitle ? `Milestone reached: ${milestoneTitle}.` : 'Milestone reached.',
        tone: 'moss',
        icon: '🌿',
        durationMs: 2600,
        variableBonus: { waterDrops: 1 },
        growthLine: 'Progress saved.',
        showVariableBonus: false,
        showGrowthLine: false,
        surface: 'utility',
      };
    }
    case 'COMPOST_ADDED': {
      return { message: 'Saved for later.', tone: 'moss', icon: '🍂', durationMs: 2200, surface: 'utility' };
    }
    case 'ACTIVATION_START': {
      return { message: 'Focus started.', tone: 'moss', icon: '🌱', durationMs: 1800, surface: 'utility' };
    }
    case 'ACTIVATION_SHORT_SESSION': {
      return { message: 'Short session logged.', tone: 'moss', icon: '✓', durationMs: 2000, surface: 'utility' };
    }
    case 'ACTIVATION_RESUME': {
      return { message: 'Back on task.', tone: 'moss', icon: '🌿', durationMs: 1800, surface: 'utility' };
    }
    case 'ACTIVATION_TINY_STEP': {
      return { message: 'First step set.', tone: 'moss', icon: '🌱', durationMs: 1800, surface: 'utility' };
    }
    case 'TASK_COMPLETE': {
      const { goalTitle } = payload;
      return {
        message: goalTitle ? `${goalTitle} completed.` : 'Task completed.',
        tone: 'moss',
        icon: '✓',
        durationMs: 2400,
        variableBonus: { waterDrops: 1 },
        growthLine: 'Progress saved.',
        showVariableBonus: false,
        showGrowthLine: false,
        surface: 'utility',
      };
    }
    case 'SUPPORT_ACCEPTED': {
      return {
        message: 'Support step added.',
        tone: 'moss',
        icon: '🌱',
        durationMs: 2200,
        variableBonus: { waterDrops: 1 },
        showVariableBonus: false,
        surface: 'utility',
      };
    }
    case 'NEXT_STEP_ADDED': {
      return {
        message: 'Next step added.',
        tone: 'moss',
        icon: '✓',
        durationMs: 2200,
        variableBonus: { waterDrops: 1 },
        showVariableBonus: false,
        surface: 'utility',
      };
    }
    case 'RESCHEDULED': {
      return {
        message: 'Moved to a better time.',
        tone: 'moss',
        icon: '↩',
        durationMs: 2200,
        variableBonus: { waterDrops: 1 },
        showVariableBonus: false,
        surface: 'utility',
      };
    }
    case 'WEEK_REVIEWED': {
      return {
        message: 'Week plan updated.',
        tone: 'moss',
        icon: '✓',
        durationMs: 2400,
        variableBonus: { waterDrops: 1 },
        showVariableBonus: false,
        surface: 'utility',
      };
    }
    default:
      return null;
  }
}
