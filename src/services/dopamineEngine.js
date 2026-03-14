/**
 * Reward/progression: reinforces meaningful work, not shallow interaction.
 *
 * Stronger rewards for: defining next step, completing planned focus, rescheduling,
 * missed-day recovery, week review, project progress, completing planned work.
 * Weaker or none for: opening screens, tapping, creating tiny low-value tasks, browsing.
 *
 * Returns { message, tone?, icon?, durationMs?, variableBonus?, growthLine? } or null.
 * variableBonus: { embers?, waterDrops? }; growthLine: optional second line.
 *
 * @param {{ type: string, payload?: object }} input
 */
export function buildReward(input) {
  if (!input?.type) return null;
  const payload = input.payload ?? {};
  switch (input.type) {
    /** Recovery: set energy for the day (incl. after missed days). Celebrates restoration, not consistency. */
    case 'MORNING_CHECKIN_DONE': {
      const { spoonCount, missedDays } = payload;
      const growthLine = typeof missedDays === 'number' && missedDays > 1 ? "You're back. Today starts now." : undefined;
      return {
        message: typeof spoonCount === 'number' ? `Today you have ${spoonCount} spoons. Go gently.` : "Energy set. Start when you're ready.",
        tone: 'moss',
        icon: '🌱',
        durationMs: 2800,
        variableBonus: { waterDrops: 1 },
        growthLine,
      };
    }
    /** Recover: lighten overloaded day. */
    case 'LOAD_LIGHTENED': {
      const { removedCount } = payload;
      const msg = typeof removedCount === 'number' && removedCount > 0
        ? `Lightened by ${removedCount} item${removedCount === 1 ? '' : 's'}.`
        : 'Good decision. The garden will wait.';
      return { message: msg, tone: 'moss', icon: '🍃', durationMs: 2800, variableBonus: { waterDrops: 1 } };
    }
    /** Focus: completed a focus block. Stronger when from planned slot. */
    case 'FOCUS_COMPLETE': {
      const { goalTitle, minutes, spoonCount, fromPlanned } = payload;
      const mins = typeof minutes === 'number' ? minutes : 0;
      const message = goalTitle ? `Nice focus on ${goalTitle}.` : 'Focus session complete.';
      const variableBonus = { waterDrops: 1 };
      if (fromPlanned && mins >= 5) {
        variableBonus.embers = mins >= 25 ? 3 : 2;
      } else {
        const lowSpoons = typeof spoonCount === 'number' && spoonCount <= 4;
        if (lowSpoons && mins >= 5) variableBonus.embers = mins >= 25 ? 2 : 1;
        else if (mins >= 25) variableBonus.embers = 1;
      }
      return { message, tone: 'moss', icon: '✨', durationMs: 2800, variableBonus };
    }
    /** Focus: put in more time than estimated — acknowledge only, no extra embers. */
    case 'FOCUS_PERSEVERANCE': {
      return {
        message: 'You put in more time than planned. Progress saved.',
        tone: 'moss',
        icon: '🌿',
        durationMs: 2600,
      };
    }
    /** Progress: milestone completed on a goal. */
    case 'MILESTONE_COMPLETE': {
      const { milestoneTitle } = payload;
      return {
        message: milestoneTitle ? `Milestone: ${milestoneTitle}` : 'Milestone reached.',
        tone: 'moss',
        icon: '🌿',
        durationMs: 2800,
        variableBonus: { waterDrops: 1 },
        growthLine: 'Progress saved.',
      };
    }
    case 'COMPOST_ADDED': {
      return { message: 'Added to compost. No guilt.', tone: 'moss', icon: '🍂', durationMs: 2200 };
    }
    /** Start: began a focus session — encouraging, no currency (avoids rewarding just opening). */
    case 'ACTIVATION_START': {
      return { message: 'You showed up. That counts.', tone: 'moss', icon: '🌱', durationMs: 2200 };
    }
    case 'ACTIVATION_SHORT_SESSION': {
      return { message: 'Short sessions count. You showed up.', tone: 'moss', icon: '✨', durationMs: 2400 };
    }
    case 'ACTIVATION_RESUME': {
      return { message: "You came back. That's the rhythm.", tone: 'moss', icon: '🌿', durationMs: 2200 };
    }
    /** Start: chose a tiny step — message only (avoid rewarding low-value task creation). */
    case 'ACTIVATION_TINY_STEP': {
      return { message: 'You chose a tiny step. That counts.', tone: 'moss', icon: '🌱', durationMs: 2200 };
    }
    /** Complete: marked planned work done from timeline/anytime. */
    case 'TASK_COMPLETE': {
      const { goalTitle } = payload;
      return {
        message: goalTitle ? `Nice — ${goalTitle} done.` : 'Task completed.',
        tone: 'moss',
        icon: '✓',
        durationMs: 2800,
        variableBonus: { waterDrops: 1 },
        growthLine: goalTitle ? `Your ${goalTitle} has grown a little.` : 'Progress saved.',
      };
    }
    case 'SUPPORT_ACCEPTED': {
      return {
        message: 'Support planted.',
        tone: 'moss',
        icon: '🌱',
        durationMs: 2200,
        variableBonus: { waterDrops: 1 },
      };
    }
    /** Plan: defined a real next step and added it to the week. */
    case 'NEXT_STEP_ADDED': {
      return {
        message: 'Next step added to your week.',
        tone: 'moss',
        icon: '✓',
        durationMs: 2600,
        variableBonus: { waterDrops: 1 },
      };
    }
    /** Recover: rescheduled instead of abandoning (focus exit or planner). */
    case 'RESCHEDULED': {
      return {
        message: 'Task moved. You can pick it up when you\'re ready.',
        tone: 'moss',
        icon: '↩',
        durationMs: 2600,
        variableBonus: { waterDrops: 1 },
      };
    }
    /** Review: applied week plan (reviewed and committed the week). */
    case 'WEEK_REVIEWED': {
      return {
        message: 'Week plan applied. You know what’s ahead.',
        tone: 'moss',
        icon: '✨',
        durationMs: 2800,
        variableBonus: { waterDrops: 1 },
      };
    }
    default:
      return null;
  }
}
