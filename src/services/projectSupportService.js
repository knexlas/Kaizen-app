/**
 * Project (freelancer) support: active projects, next steps, deadlines at risk, hours planned, health.
 * Uses existing goal shape: _projectGoal, _projectDeadline, _client, _billable, _blocked, _blockedReason, _waitingOnClient, subtasks (estimatedHours, completedHours, deadline).
 * Next-step logic delegates to nextStepService.getBestNextStepForGoal.
 * Health is derived only (no manual UI state): on_track | at_risk | blocked | unplanned | overdue | stuck.
 */

import { getPlannedHoursByScope } from '../utils/plannedHoursAggregation';
import { daysUntilDeadline as daysUntilDeadlineDate } from './dateUtils';
import { getBestNextStepForGoal } from './nextStepService';

const DAYS_UNTIL_DEADLINE_AT_RISK = 7;
const NEGLECTED_DAYS = 7;

/** Canonical project health states (derived only). */
export const PROJECT_HEALTH_STATES = {
  ON_TRACK: 'on_track',
  AT_RISK: 'at_risk',
  BLOCKED: 'blocked',
  UNPLANNED: 'unplanned',
  OVERDUE: 'overdue',
  STUCK: 'stuck',
};

/** Active project goals (_projectGoal === true). */
export function getActiveProjects(goals) {
  return (goals ?? []).filter((g) => g && g._projectGoal === true);
}

/**
 * Best next step for a project goal (action-phrased, 5–20 min suggested). Returns null when blocked.
 */
export function getNextStepForProject(goal) {
  const best = getBestNextStepForGoal(goal);
  if (!best) return null;
  if (best.blocked && !best.isStarter) return null;
  return {
    subtaskId: best.subtaskId,
    title: best.title,
    estimatedHours: best.estimatedHours ?? (best.suggestedMinutes || 15) / 60,
    completedHours: null,
    suggestedMinutes: best.suggestedMinutes,
    taskId: best.taskId,
    suggestedBreakdown: best.suggestedBreakdown,
    isStarter: best.isStarter,
  };
}

/** Whether project deadline has passed. */
export function hasProjectDeadlinePassed(goal) {
  const days = daysUntilDeadlineDate(goal?._projectDeadline);
  return days !== null && days < 0;
}

/** Whether any subtask has a deadline in the past and is not complete. */
export function hasOverdueSubtask(goal) {
  if (!goal?.subtasks || !Array.isArray(goal.subtasks)) return false;
  const now = new Date();
  return goal.subtasks.some((s) => {
    const dl = s?.deadline;
    if (!dl || typeof dl !== 'string') return false;
    const deadline = new Date(dl + 'T23:59:59');
    if (deadline >= now) return false;
    const comp = Number(s.completedHours) || 0;
    const est = Number(s.estimatedHours) || 0.01;
    return comp < est;
  });
}

/** Selector: deadline is approaching (≤DAYS_UNTIL_DEADLINE_AT_RISK) or already passed. */
export function isDeadlineAtRisk(goal) {
  const days = daysUntilDeadlineDate(goal?._projectDeadline);
  return days !== null && days <= DAYS_UNTIL_DEADLINE_AT_RISK;
}

/** Selector: no concrete next step exists (next step is null). */
export function isProjectStuck(goal) {
  return getNextStepForProject(goal) === null;
}

/** Planned minutes this week for a single goal (from week plan). Selector for cockpit. */
export function getPlannedMinutesThisWeekForGoal(goalId, weekAssignments, goals) {
  const { byGoal } = getPlannedHoursByScope(weekAssignments ?? {}, goals ?? [], 'week');
  const row = byGoal.find((r) => r.goalId === goalId);
  return row ? row.minutes : 0;
}

/** Selector: active project with no planned hours this week. */
export function isProjectUnplanned(goal, weekAssignments, goals) {
  if (!goal?._projectGoal) return false;
  const planned = getPlannedMinutesThisWeekForGoal(goal?.id, weekAssignments, goals);
  return planned === 0;
}

/** Last activity date (YYYY-MM-DD) for goal from logs, or null. */
function getLastActivityForGoal(goalId, logs) {
  if (!goalId || !Array.isArray(logs) || logs.length === 0) return null;
  const entries = logs.filter((l) => l && l.taskId === goalId && l.date);
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
  const d = sorted[0].date;
  return typeof d === 'string' ? d.slice(0, 10) : d instanceof Date ? d.toISOString().slice(0, 10) : null;
}

/** Last touched date (YYYY-MM-DD) for a project from logs. For display in planner. */
export function getLastTouchedDate(goalId, logs) {
  return getLastActivityForGoal(goalId, logs ?? []);
}

/** Whether project is marked "waiting on client" (goal._waitingOnClient === true). */
export function isWaitingOnClient(goal) {
  return goal?._waitingOnClient === true;
}

/**
 * Derived risk score 0–3 for quick scanning. 0 = low, 3 = high.
 * overdue=3, at_risk=2, blocked/stuck=2, unplanned=1, on_track=0.
 */
export function getProjectRiskScore(goal, context = {}) {
  if (!goal?._projectGoal) return 0;
  const { state } = getProjectHealth(goal, context);
  if (state === PROJECT_HEALTH_STATES.OVERDUE) return 3;
  if (state === PROJECT_HEALTH_STATES.AT_RISK || state === PROJECT_HEALTH_STATES.BLOCKED || state === PROJECT_HEALTH_STATES.STUCK) return 2;
  if (state === PROJECT_HEALTH_STATES.UNPLANNED) return 1;
  return 0;
}

/** Whether project was touched in the last N days. */
function wasTouchedRecently(goal, logs, days = NEGLECTED_DAYS) {
  const last = getLastActivityForGoal(goal?.id, logs);
  if (!last) return false;
  const then = new Date(last + 'T12:00:00').getTime();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return then >= cutoff;
}

/**
 * Derived project health: one of on_track | at_risk | blocked | unplanned | overdue | stuck.
 * Evaluation order (first match wins): overdue → blocked → stuck → at_risk → unplanned → on_track.
 * @param {Object} goal - Project goal
 * @param {Object} [context] - Optional { weekAssignments, goals, logs } for at_risk/unplanned/recent progress
 * @returns {{ state: string, reason: string }}
 */
export function getProjectHealth(goal, context = {}) {
  if (!goal?._projectGoal) {
    return { state: PROJECT_HEALTH_STATES.ON_TRACK, reason: 'Not a project.' };
  }

  const { weekAssignments, goals, logs } = context;
  const next = getNextStepForProject(goal);
  const plannedMins = getPlannedMinutesThisWeekForGoal(goal.id, weekAssignments, goals);
  const touchedRecently = wasTouchedRecently(goal, logs ?? [], NEGLECTED_DAYS);
  const deadlineAtRisk = isDeadlineAtRisk(goal);

  // 1. Overdue: project deadline passed or critical overdue subtask
  if (hasProjectDeadlinePassed(goal)) {
    return { state: PROJECT_HEALTH_STATES.OVERDUE, reason: 'Project deadline has passed.' };
  }
  if (hasOverdueSubtask(goal)) {
    return { state: PROJECT_HEALTH_STATES.OVERDUE, reason: 'A critical task is overdue.' };
  }

  // 2. Blocked: explicit blocker or waiting on external dependency
  if (goal._blocked === true) {
    const reason = goal._blockedReason && String(goal._blockedReason).trim()
      ? `Blocked: ${String(goal._blockedReason).trim()}`
      : 'Waiting on external dependency.';
    return { state: PROJECT_HEALTH_STATES.BLOCKED, reason };
  }

  // 3. Stuck: no concrete next step
  if (!next) {
    return { state: PROJECT_HEALTH_STATES.STUCK, reason: 'No concrete next step exists.' };
  }

  // 4. At risk: deadline approaching and (no planned time this week or not touched recently)
  if (deadlineAtRisk && (plannedMins === 0 || !touchedRecently)) {
    if (plannedMins === 0 && !touchedRecently) {
      return { state: PROJECT_HEALTH_STATES.AT_RISK, reason: 'Deadline soon; no time planned this week and no recent progress.' };
    }
    if (plannedMins === 0) {
      return { state: PROJECT_HEALTH_STATES.AT_RISK, reason: 'Deadline soon; no time planned this week.' };
    }
    return { state: PROJECT_HEALTH_STATES.AT_RISK, reason: 'Deadline soon; project not touched recently.' };
  }

  // 5. Unplanned: has next step but no planned hours this week
  if (plannedMins === 0) {
    return { state: PROJECT_HEALTH_STATES.UNPLANNED, reason: 'No time planned this week.' };
  }

  // 6. On track
  return { state: PROJECT_HEALTH_STATES.ON_TRACK, reason: 'Next step defined; recent progress or time planned this week.' };
}

/** Project health state only (string). For callers that need the legacy single value. */
export function getProjectHealthState(goal, context = {}) {
  return getProjectHealth(goal, context).state;
}

/** Human-readable label for health state (for filters and cards). */
export function getProjectHealthLabel(state) {
  const labels = {
    [PROJECT_HEALTH_STATES.ON_TRACK]: 'On track',
    [PROJECT_HEALTH_STATES.AT_RISK]: 'At risk',
    [PROJECT_HEALTH_STATES.BLOCKED]: 'Blocked',
    [PROJECT_HEALTH_STATES.UNPLANNED]: 'Unplanned',
    [PROJECT_HEALTH_STATES.OVERDUE]: 'Overdue',
    [PROJECT_HEALTH_STATES.STUCK]: 'Stuck',
  };
  return labels[state] ?? state;
}

/** Projects with deadline in the past or within DAYS_UNTIL_DEADLINE_AT_RISK days (with remaining work). */
export function getDeadlinesAtRisk(goals) {
  const projects = getActiveProjects(goals);
  return projects.filter((g) => {
    if (!isDeadlineAtRisk(g)) return false;
    const next = getNextStepForProject(g);
    return next !== null;
  });
}

/** Planned minutes this week per goalId. Uses getPlannedHoursByScope(weekAssignments, goals, 'week').byGoal. */
export function getPlannedHoursPerProjectThisWeek(weekAssignments, goals) {
  const { byGoal } = getPlannedHoursByScope(weekAssignments, goals, 'week');
  const projectIds = new Set(getActiveProjects(goals).map((g) => g.id));
  return byGoal.filter((row) => projectIds.has(row.goalId));
}

/** Total estimated hours for a project (sum of subtasks.estimatedHours). */
export function getProjectEstimatedHours(goal) {
  if (!goal || !Array.isArray(goal.subtasks)) return 0;
  return goal.subtasks.reduce((sum, s) => sum + (Number(s.estimatedHours) || 0), 0);
}

/** Total completed hours for a project (sum of subtasks.completedHours). */
export function getProjectCompletedHours(goal) {
  if (!goal || !Array.isArray(goal.subtasks)) return 0;
  return goal.subtasks.reduce((sum, s) => sum + (Number(s.completedHours) || 0), 0);
}

/** Client name for grouping (goal._client or goal.client or null). */
export function getProjectClient(goal) {
  return goal?._client ?? goal?.client ?? null;
}

/** Whether project is marked billable (goal._billable ?? goal.billable ?? false). */
export function isProjectBillable(goal) {
  return goal?._billable === true || goal?.billable === true;
}

/**
 * Projects with no logged progress in the last daysInactive days. Used for recovery: "neglected project revival".
 * @param {Array} goals
 * @param {Array} logs - { taskId, date } entries
 * @param {number} daysInactive
 * @returns {Array} active project goals that are neglected
 */
export function getNeglectedProjects(goals, logs, daysInactive = 7) {
  const active = getActiveProjects(goals);
  if (!Array.isArray(logs) || logs.length === 0) return active;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - daysInactive);
  return active.filter((goal) => {
    const goalLogs = logs.filter((l) => l && l.taskId === goal.id);
    if (goalLogs.length === 0) return true;
    const lastDate = goalLogs.reduce((best, l) => {
      const d = l.date ? new Date(l.date) : null;
      return d && !Number.isNaN(d.getTime()) && (!best || d > best) ? d : best;
    }, null);
    return !lastDate || lastDate < cutoff;
  });
}
