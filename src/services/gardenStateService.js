/**
 * Maps project and planning state to garden/world state.
 * Garden reflects: nurtured projects, neglected projects, restored projects,
 * healthy planning rhythm, and completed meaningful sessions.
 * Avoids fake positivity: visuals align with real work state; representation is gentle, not punitive.
 */

import { getGoalProgressPercent } from '../components/Garden/gardenProgress';
import { getProjectHealthState, PROJECT_HEALTH_STATES } from './projectSupportService';
import { localISODate } from './dateUtils';

/** Garden state for a single goal: drives visual (flora) and copy. */
export const GOAL_GARDEN_STATE = {
  NURTURED: 'nurtured',   // recent activity, has next step (or not a project)
  NEGLECTED: 'neglected',  // no activity in NEGLECT_DAYS
  RESTORED: 'restored',    // was neglected, then activity in last RESTORED_WINDOW_DAYS
  STUCK: 'stuck',          // project with no next step (blocked)
};

const NEGLECT_DAYS = 7;
const RESTORED_WINDOW_DAYS = 3;

/**
 * Last activity (log) date for a goal. Returns ISO date string or null.
 */
export function getLastActivityForGoal(goalId, logs) {
  if (!goalId || !Array.isArray(logs)) return null;
  const entries = logs.filter((l) => l && l.taskId === goalId && l.date);
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
  const d = sorted[0].date;
  const date = typeof d === 'string' ? d.slice(0, 10) : d instanceof Date ? localISODate(d) : null;
  return date;
}

/**
 * Whether the goal was neglected (no activity in NEGLECT_DAYS).
 */
function wasNeglected(lastActivityDateStr) {
  if (!lastActivityDateStr) return true;
  const then = new Date(lastActivityDateStr + 'T12:00:00').getTime();
  const cutoff = Date.now() - NEGLECT_DAYS * 24 * 60 * 60 * 1000;
  return then < cutoff;
}

/**
 * Whether there was recent activity after neglect (activity in last RESTORED_WINDOW_DAYS).
 */
function hasRecentActivity(lastActivityDateStr) {
  if (!lastActivityDateStr) return false;
  const then = new Date(lastActivityDateStr + 'T12:00:00').getTime();
  const cutoff = Date.now() - RESTORED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return then >= cutoff;
}

/**
 * Per-goal garden state from goals, logs, and project health.
 * @param {Object} goal
 * @param {Array} logs
 * @param {Function} [getProjectHealthFn] - (goal, context?) => health state string. If omitted, uses getProjectHealthState(goal, { logs }).
 * @returns {{ state: string, lastActivityAt: string|null, progressPercent: number }}
 */
export function getGoalGardenState(goal, logs, getProjectHealthFn) {
  const progressPercent = getGoalProgressPercent(goal);
  const lastActivityAt = getLastActivityForGoal(goal?.id, logs);
  const isProject = goal?._projectGoal === true;
  const health = isProject
    ? (typeof getProjectHealthFn === 'function' ? getProjectHealthFn(goal, { logs }) : getProjectHealthState(goal, { logs }))
    : PROJECT_HEALTH_STATES.ON_TRACK;

  if (isProject && (health === PROJECT_HEALTH_STATES.STUCK || health === PROJECT_HEALTH_STATES.BLOCKED)) {
    return { state: GOAL_GARDEN_STATE.STUCK, lastActivityAt, progressPercent };
  }

  const neglected = wasNeglected(lastActivityAt);
  const recent = hasRecentActivity(lastActivityAt);

  if (neglected && recent) {
    return { state: GOAL_GARDEN_STATE.RESTORED, lastActivityAt, progressPercent };
  }
  if (neglected) {
    return { state: GOAL_GARDEN_STATE.NEGLECTED, lastActivityAt, progressPercent };
  }
  return { state: GOAL_GARDEN_STATE.NURTURED, lastActivityAt, progressPercent };
}

/**
 * Overall garden summary: counts and planning rhythm.
 * Used for garden-level copy and to avoid fake positivity (e.g. show "2 projects could use attention").
 * @param {Array} goals
 * @param {Array} logs
 * @param {string} lastCheckInDate - ISO date of last check-in
 * @param {Object} weekAssignments - plan data for this week
 */
export function getGardenSummary(goals, logs, lastCheckInDate, weekAssignments = {}) {
  const today = localISODate(new Date());
  const getHealth = (g, ctx) => getProjectHealthState(g, { ...ctx, logs: logs ?? [], weekAssignments, goals });
  const activeGoals = (goals ?? []).filter((g) => g && g.type !== 'routine');
  const states = activeGoals.map((g) => getGoalGardenState(g, logs ?? [], getHealth));

  const nurturedCount = states.filter((s) => s.state === GOAL_GARDEN_STATE.NURTURED).length;
  const neglectedCount = states.filter((s) => s.state === GOAL_GARDEN_STATE.NEGLECTED).length;
  const restoredCount = states.filter((s) => s.state === GOAL_GARDEN_STATE.RESTORED).length;
  const stuckCount = states.filter((s) => s.state === GOAL_GARDEN_STATE.STUCK).length;

  const checkInRecent = lastCheckInDate === today;
  const hasPlanThisWeek = typeof weekAssignments === 'object' && Object.keys(weekAssignments).length > 0;
  const planningRhythmHealthy = checkInRecent && hasPlanThisWeek;

  return {
    nurturedCount,
    neglectedCount,
    restoredCount,
    stuckCount,
    totalActive: activeGoals.length,
    planningRhythmHealthy,
    checkInRecent,
  };
}

/**
 * Human-readable label for garden state (for UI tooltips or detail panel).
 */
export function getGardenStateLabel(state) {
  switch (state) {
    case GOAL_GARDEN_STATE.NURTURED:
      return 'Active';
    case GOAL_GARDEN_STATE.NEGLECTED:
      return 'No recent activity';
    case GOAL_GARDEN_STATE.RESTORED:
      return 'Recently picked up again';
    case GOAL_GARDEN_STATE.STUCK:
      return 'No next step';
    default:
      return null;
  }
}
