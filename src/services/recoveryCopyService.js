/**
 * Recovery-oriented copy: plain, kind language; one clear action per moment.
 * Reduces shame, encourages re-entry, celebrates restoration (not consistency).
 * No guilt-based streak messaging.
 */

import { HELPER_INTERVENTION_TYPES } from './helperInterventionService';

/** Copy for each recovery intervention: { title, message, actionLabel } */
export const RECOVERY_COPY = {
  [HELPER_INTERVENTION_TYPES.FOCUS_ABANDONED]: {
    title: 'Session stopped',
    message: 'No problem. Start again whenever you\'re ready—or add it to your list for later.',
    actionLabel: 'View my day',
  },
  [HELPER_INTERVENTION_TYPES.OVERLOADED]: {
    title: 'Today looks full',
    message: 'You can lighten the plan so it fits your energy. One step at a time.',
    actionLabel: 'Lighten today',
  },
  [HELPER_INTERVENTION_TYPES.NO_NEXT_STEP]: {
    title: 'Project could use one step',
    message: 'Add one small next step to unblock it. You can do it when you\'re ready.',
    actionLabel: 'Add next step',
  },
  [HELPER_INTERVENTION_TYPES.MISSED_DAY_RECOVERY]: {
    title: 'Welcome back',
    message: 'Your garden is still here. Set today\'s energy and pick what fits.',
    actionLabel: 'Set today\'s energy',
  },
  [HELPER_INTERVENTION_TYPES.OVERDUE_UNSCHEDULED]: {
    title: 'Something’s waiting',
    message: 'An overdue task isn’t scheduled. Reschedule it when you\'re ready—no guilt.',
    actionLabel: 'Open planner',
  },
};

/** Neglected project revival: shown when opening project planner with inactive projects. */
export const NEGLECTED_PROJECT_COPY = {
  title: 'A project hasn’t had progress in a while',
  message: 'Pick one small step when you\'re ready. Restoration counts.',
  actionLabel: 'Pick one step',
};

/** Missed-day modal: restoration-focused, no streak mention. */
export const MISSED_DAY_MODAL = {
  title: 'Welcome back. How’s today?',
  subtitle: 'Pick one — we’ll set up your day. You can change it anytime.',
  optionLight: '1 spoon day',
  optionLightDesc: 'Ultra-light — one small slot',
  optionMedium: '3 spoon day',
  optionMediumDesc: 'Light plan — a few doable slots',
  optionCapture: 'No plan — just capture',
  optionCaptureDesc: 'Capture thoughts; plan later (or not)',
};

/** Reward growth line when returning after missed day(s). */
export function getReturnGrowthLine(missedDays) {
  if (typeof missedDays === 'number' && missedDays > 1) {
    return "You're back. Today starts now.";
  }
  return undefined;
}
