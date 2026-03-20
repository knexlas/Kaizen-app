/**
 * Project cockpit: today recommendation, week capacity, logged hours this week, needs attention.
 * Reuses projectSupportService and plannedHoursAggregation.
 *
 * Today recommendation: deterministic priority order, never vague, with short explanation.
 * See RECOMMENDATION_RULES at end of file.
 */

import { localISODate, weekdayIndexMon0, daysUntilDeadline } from './dateUtils';
import { getPlannedHoursByScope } from '../utils/plannedHoursAggregation';
import { getAssignmentsForSlot } from './planAssignmentUtils';
import { getRecommendationForTaskType } from './insightsReflectionService';
import {
  getActiveProjects,
  getNextStepForProject,
  getProjectHealthState,
  getDeadlinesAtRisk,
  getNeglectedProjects,
  isProjectBillable,
  PROJECT_HEALTH_STATES,
} from './projectSupportService';
import { getBestNextStepForGoal } from './nextStepService';

const DEFAULT_DAY_START = 8; // 08:00
const DEFAULT_DAY_END = 22;   // 22:00
const HOURS_PER_DAY_DEFAULT = DEFAULT_DAY_END - DEFAULT_DAY_START;
const DAYS_PER_WEEK = 7;
const NEGLECTED_DAYS = 7;

/** Suggested duration bounds when we prefer small steps (overloaded or returning after drift). */
const PREFER_SMALL_MIN = 5;
const PREFER_SMALL_MAX = 20;

/** Current week Mon–Sun date strings (YYYY-MM-DD). */
export function getWeekDateStrings(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const mon0 = weekdayIndexMon0(d);
  const monday = new Date(d);
  monday.setDate(d.getDate() - mon0);
  return Array.from({ length: DAYS_PER_WEEK }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return localISODate(day);
  });
}

/** Normalize log date to YYYY-MM-DD. */
function logDateStr(log) {
  if (!log?.date) return null;
  const s = typeof log.date === 'string' ? log.date : (log.date instanceof Date ? log.date.toISOString() : '');
  return s.slice(0, 10);
}

/**
 * Logged minutes this week per goalId (taskId). Only logs whose date falls in weekDateStrings.
 */
export function getLoggedMinutesThisWeekByGoal(logs, weekDateStrings = null) {
  const week = Array.isArray(weekDateStrings) && weekDateStrings.length === 7
    ? new Set(weekDateStrings)
    : new Set(getWeekDateStrings());
  const byGoal = {};
  (logs ?? []).forEach((log) => {
    const dateStr = logDateStr(log);
    if (!dateStr || !week.has(dateStr)) return;
    const goalId = log.taskId;
    if (!goalId) return;
    const mins = Number(log.minutes) || 0;
    byGoal[goalId] = (byGoal[goalId] || 0) + mins;
  });
  return byGoal;
}

/** Total logged minutes this week (all goals). */
export function getTotalLoggedMinutesThisWeek(logs, weekDateStrings = null) {
  const byGoal = getLoggedMinutesThisWeekByGoal(logs, weekDateStrings);
  return Object.values(byGoal).reduce((s, m) => s + m, 0);
}

/** Completed minutes this week for a single goal. Selector for cockpit. */
export function getCompletedMinutesThisWeekForGoal(goalId, logs, weekDateStrings = null) {
  const byGoal = getLoggedMinutesThisWeekByGoal(logs ?? [], weekDateStrings);
  return byGoal[goalId] ?? 0;
}

/** Whether the week is overplanned (planned hours exceed available capacity). */
export function isOverplanned(weekCapacityHours, plannedTotalMinutes) {
  if (!weekCapacityHours || weekCapacityHours <= 0) return false;
  const plannedHours = (plannedTotalMinutes ?? 0) / 60;
  return plannedHours > weekCapacityHours;
}

/**
 * Week capacity: available hours from userSettings (dayStart–dayEnd × 7).
 * dayStart/dayEnd like '08:00' / '22:00'.
 */
export function getWeekCapacityHours(userSettings = null) {
  const start = parseTimeToHour(userSettings?.dayStart ?? '08:00');
  const end = parseTimeToHour(userSettings?.dayEnd ?? '22:00');
  const hoursPerDay = Math.max(0, end - start) || HOURS_PER_DAY_DEFAULT;
  return hoursPerDay * DAYS_PER_WEEK;
}

function parseTimeToHour(str) {
  if (!str || typeof str !== 'string') return DEFAULT_DAY_START;
  const parts = str.trim().split(':');
  const h = parseInt(parts[0], 10);
  return Number.isNaN(h) ? DEFAULT_DAY_START : Math.max(0, Math.min(24, h));
}

/**
 * Whether a next step is concrete (has a clear action title). We never recommend vague work.
 * Starter ("Define the first 15-minute step") and action-phrased subtask titles count as concrete.
 */
function isConcreteNextStep(next) {
  return next != null && typeof next.title === 'string' && next.title.trim().length > 0;
}

/**
 * Normalize next step from getNextStepForProject or getBestNextStepForGoal to a consistent shape
 * { title, suggestedMinutes, subtaskId, isStarter } for the recommendation result.
 */
function toRecommendationNextStep(next, bestRaw) {
  if (!next) return null;
  const mins = next.suggestedMinutes ?? (next.estimatedHours != null ? Math.round(next.estimatedHours * 60) : 15);
  return {
    title: next.title?.trim() || 'Next step',
    suggestedMinutes: Math.max(1, Math.min(120, mins)),
    subtaskId: next.subtaskId ?? bestRaw?.subtaskId ?? null,
    isStarter: next.isStarter === true || bestRaw?.isStarter === true,
  };
}

/** True when we should prefer small (5–20 min) steps: overloaded week or user behind (little done this week). */
function shouldPreferSmallStep(weekCapacityHours, plannedTotalMinutes, completedMinutesThisWeek) {
  const plannedHours = (plannedTotalMinutes ?? 0) / 60;
  const overloaded = weekCapacityHours > 0 && plannedHours > weekCapacityHours;
  const behind = (completedMinutesThisWeek ?? 0) < 60; // less than 1h done this week
  return overloaded || behind;
}

/** Whether the step is in the "small" range (5–20 min) for overloaded/behind preference. */
function isSmallStep(next, preferredMax = PREFER_SMALL_MAX) {
  const m = next?.suggestedMinutes ?? (next?.estimatedHours != null ? next.estimatedHours * 60 : 15);
  return m >= PREFER_SMALL_MIN && m <= preferredMax;
}

/**
 * Deterministic recommendation for "Today needs this".
 * Priority: 1) planned today → 2) at-risk with next step → 3) deadline-near → 4) newly unblocked (stuck+starter) → 5) high-priority active → 6) small recovery when behind.
 * Never recommends vague work; prefers 5–20 min steps when overloaded or behind.
 *
 * @param {Array} goals
 * @param {Object} weekAssignments
 * @param {string} [todayStr]
 * @param {Object} [context] - Optional { logs, userSettings } for behind detection; and weekCapacityHours, plannedTotalMinutes, completedMinutesThisWeek if precomputed.
 * @returns {{ goal, nextStep: { title, suggestedMinutes, subtaskId, isStarter }, reason } | null}
 */
export function getRecommendedTaskForToday(goals, weekAssignments, todayStr = null, context = {}) {
  const today = todayStr || localISODate();
  const active = getActiveProjects(goals ?? []);
  if (active.length === 0) return null;

  const {
    logs,
    userSettings,
    weekCapacityHours: ctxCapacityHours,
    plannedTotalMinutes: ctxPlannedMins,
    completedMinutesThisWeek: ctxCompletedMins,
  } = context;

  const weekCapacityHours = ctxCapacityHours ?? getWeekCapacityHours(userSettings);
  const plannedTotalMinutes = ctxPlannedMins ?? getPlannedHoursByScope(weekAssignments ?? {}, goals ?? [], 'week').totalMinutes;
  const loggedByGoal = ctxCompletedMins != null ? null : getLoggedMinutesThisWeekByGoal(logs ?? [], null);
  const completedMinutesThisWeek = ctxCompletedMins ?? (loggedByGoal ? Object.values(loggedByGoal).reduce((s, m) => s + m, 0) : 0);

  const preferSmall = shouldPreferSmallStep(weekCapacityHours, plannedTotalMinutes, completedMinutesThisWeek);
  const atRisk = getDeadlinesAtRisk(goals ?? []);
  const neglected = getNeglectedProjects(goals ?? [], logs ?? [], NEGLECTED_DAYS);
  const healthContext = { goals: goals ?? [], logs: logs ?? [], weekAssignments: weekAssignments ?? {} };

  // Build set and ordered list of goal IDs planned for today (by slot order for deterministic pick)
  const dayPlan = (weekAssignments ?? {})[today];
  const goalIdsPlannedToday = new Set();
  const goalIdsPlannedTodayOrdered = [];
  if (dayPlan && typeof dayPlan === 'object') {
    const slotKeys = Object.keys(dayPlan).sort();
    for (const key of slotKeys) {
      const slot = dayPlan[key];
      const arr = Array.isArray(slot) ? slot : (slot ? [slot] : []);
      for (const a of arr) {
        const id = a?.parentGoalId ?? a?.goalId ?? (typeof a === 'string' ? a : null);
        if (id && !goalIdsPlannedToday.has(id)) {
          goalIdsPlannedToday.add(id);
          goalIdsPlannedTodayOrdered.push(id);
        }
      }
    }
  }

  const goalMap = new Map((goals ?? []).map((g) => [g.id, g]));

  /** Pick first concrete next step from a list of goals; optionally require small step when preferSmall. */
  function firstConcrete(goalList, options = {}) {
    const requireSmall = options.requireSmall === true && preferSmall;
    for (const g of goalList) {
      const next = getNextStepForProject(g);
      if (!next || !isConcreteNextStep(next)) continue;
      const step = toRecommendationNextStep(next, getBestNextStepForGoal(g));
      if (!step) continue;
      if (requireSmall && !isSmallStep(step)) continue;
      return { goal: g, nextStep: step, reason: options.reason ?? 'Next action available.' };
    }
    return null;
  }

  // ——— 1. Planned task scheduled for today ———
  for (const goalId of goalIdsPlannedTodayOrdered) {
    const g = goalMap.get(goalId);
    if (!g || !g._projectGoal) continue;
    const next = getNextStepForProject(g);
    if (!next || !isConcreteNextStep(next)) continue;
    const step = toRecommendationNextStep(next, getBestNextStepForGoal(g));
    if (preferSmall && !isSmallStep(step)) continue;
    return { goal: g, nextStep: step, reason: 'Scheduled for today.' };
  }
  for (const goalId of goalIdsPlannedTodayOrdered) {
    const g = goalMap.get(goalId);
    if (!g || !g._projectGoal) continue;
    const next = getNextStepForProject(g);
    if (!next || !isConcreteNextStep(next)) continue;
    const step = toRecommendationNextStep(next, getBestNextStepForGoal(g));
    return { goal: g, nextStep: step, reason: 'Scheduled for today.' };
  }

  // ——— 2. At-risk project with concrete next step (and 3. deadline-near: same set, order by deadline) ———
  const atRiskWithStep = atRisk.filter((g) => isConcreteNextStep(getNextStepForProject(g)));
  const atRiskSorted = [...atRiskWithStep].sort((a, b) => {
    const da = daysUntilDeadline(a?._projectDeadline);
    const db = daysUntilDeadline(b?._projectDeadline);
    if (da == null && db == null) return 0;
    if (da == null) return 1;
    if (db == null) return -1;
    return da - db; // soonest first
  });
  for (const g of atRiskSorted) {
    const next = getNextStepForProject(g);
    const step = toRecommendationNextStep(next, getBestNextStepForGoal(g));
    if (preferSmall && !isSmallStep(step)) continue;
    const days = daysUntilDeadline(g?._projectDeadline);
    const reason = days != null && days < 0 ? 'Overdue; needs progress.' : 'Deadline soon; needs progress.';
    return { goal: g, nextStep: step, reason };
  }
  for (const g of atRiskSorted) {
    const next = getNextStepForProject(g);
    const step = toRecommendationNextStep(next, getBestNextStepForGoal(g));
    const days = daysUntilDeadline(g?._projectDeadline);
    const reason = days != null && days < 0 ? 'Overdue; needs progress.' : 'Deadline soon; needs progress.';
    return { goal: g, nextStep: step, reason };
  }

  // ——— 4. Newly unblocked: stuck project with starter (define first step) ———
  const stuck = active.filter((g) => getProjectHealthState(g, healthContext) === PROJECT_HEALTH_STATES.STUCK);
  for (const g of stuck) {
    const best = getBestNextStepForGoal(g);
    if (!best?.isStarter || !isConcreteNextStep(best)) continue;
    const step = toRecommendationNextStep(
      { title: best.title, suggestedMinutes: best.suggestedMinutes ?? 15, isStarter: true },
      best
    );
    return { goal: g, nextStep: step, reason: 'No next step yet; define one to unblock.' };
  }

  // ——— 5. Concrete next step from high-priority active project (at-risk, then neglected, then rest) ———
  const highPriority = [...atRisk];
  neglected.forEach((g) => { if (!highPriority.includes(g)) highPriority.push(g); });
  active.forEach((g) => { if (!highPriority.includes(g)) highPriority.push(g); });
  const r5 = firstConcrete(highPriority, { requireSmall: preferSmall, reason: 'High-priority project; next step available.' });
  if (r5) return r5;
  const r5Any = firstConcrete(highPriority, { reason: 'High-priority project; next step available.' });
  if (r5Any) return r5Any;

  // ——— 6. Small recovery task when behind (neglected project, small step only) ———
  if (preferSmall && neglected.length > 0) {
    for (const g of neglected) {
      const next = getNextStepForProject(g);
      if (!next || !isConcreteNextStep(next)) continue;
      const step = toRecommendationNextStep(next, getBestNextStepForGoal(g));
      if (!isSmallStep(step)) continue;
      return { goal: g, nextStep: step, reason: 'Quick win to get back on track.' };
    }
  }

  return null;
}

/*
 * RECOMMENDATION RULES (deterministic, evaluated in order)
 * ———————————————————————————————————————————————————————
 * 1. Planned task scheduled for today
 *    Project has at least one slot in today’s plan (weekAssignments[today]) and has a concrete next step.
 *    When preferSmall (overloaded or behind), we pick the first planned-for-today task that is 5–20 min; otherwise first planned.
 * 2. At-risk project with concrete next step
 *    Project is in getDeadlinesAtRisk (deadline in ≤7 days or overdue) and has a concrete next step.
 *    Sorted by days until deadline (soonest first). When preferSmall, we prefer a 5–20 min step in this set.
 * 3. Deadline-near task
 *    Same pool as (2); ordering by deadline already covers “deadline-near”.
 * 4. Newly unblocked project task
 *    Project is stuck (no next step) but has a starter: “Define the first 15-minute step” from getBestNextStepForGoal.
 * 5. Concrete next step from high-priority active project
 *    Priority order: at-risk first, then neglected, then any active. First project with a concrete next step.
 *    When preferSmall we first try to find a 5–20 min step in this set; else we take any concrete step.
 * 6. Small recovery task when the user is behind
 *    Only when preferSmall and there are neglected projects. First neglected project with a concrete next step that is 5–20 min.
 *
 * FALLBACK BEHAVIOR
 * —————————————————
 * - If no active projects: return null.
 * - If a tier has no valid candidate (e.g. no planned-for-today has a concrete step): fall through to the next tier.
 * - When preferSmall, we first try to satisfy the tier with a small step; if none, we retry the same tier without the small constraint so we still recommend something concrete.
 * - Final fallback: return null (no vague recommendation).
 *
 * WHAT COUNTS AS A VALID CONCRETE TASK
 * ————————————————————————————————————
 * - Next step must come from getNextStepForProject(goal) or getBestNextStepForGoal(goal) (for starter).
 * - Concrete = next has a non-empty string title (action-phrased or “Define the first 15-minute step”).
 * - We never recommend when next is null (blocked with no starter) or when title is missing/empty.
 * - suggestedMinutes is normalized to 1–120 for display; when preferSmall we only recommend steps with suggestedMinutes in [5, 20].
 */

/**
 * Needs attention: no next step, overdue/unscheduled, deadline risk, not touched recently, overplanned week.
 */
export function getNeedsAttention(goals, logs, weekAssignments, weekCapacityHours, plannedTotalMinutes) {
  const active = getActiveProjects(goals ?? []);
  const atRisk = getDeadlinesAtRisk(goals ?? []);
  const neglected = getNeglectedProjects(goals ?? [], logs ?? [], NEGLECTED_DAYS);
  const context = { goals: goals ?? [], logs: logs ?? [], weekAssignments: weekAssignments ?? {} };
  const noNextStep = active.filter((g) => getProjectHealthState(g, context) === 'stuck');
  const plannedMins = plannedTotalMinutes ?? getPlannedHoursByScope(weekAssignments ?? {}, goals ?? [], 'week').totalMinutes;
  const overplannedWeek = weekCapacityHours > 0 && plannedMins / 60 > weekCapacityHours;

  return {
    noNextStep: noNextStep.map((g) => ({ goal: g, label: g.title ?? g._projectName ?? 'Project' })),
    overdueUnscheduled: atRisk.filter((g) => {
      const dl = g._projectDeadline;
      if (!dl) return false;
      return new Date(dl + 'T23:59:59') < new Date();
    }).map((g) => ({ goal: g, label: g.title ?? g._projectName ?? 'Project' })),
    deadlineRisk: atRisk.map((g) => ({ goal: g, label: g.title ?? g._projectName ?? 'Project' })),
    notTouchedRecently: neglected.map((g) => ({ goal: g, label: g.title ?? g._projectName ?? 'Project' })),
    overplannedWeek,
  };
}

/**
 * Week capacity summary: available, planned, remaining, overload, billable vs non-billable split, planned vs completed trend.
 */
export function getWeekCapacitySummary(weekAssignments, goals, userSettings, loggedMinutesByGoal = null) {
  const availableHours = getWeekCapacityHours(userSettings);
  const { totalMinutes, byGoal } = getPlannedHoursByScope(weekAssignments ?? {}, goals ?? [], 'week');
  const plannedHours = totalMinutes / 60;
  const remainingHours = Math.max(0, availableHours - plannedHours);
  const overload = plannedHours > availableHours;
  let billablePlanned = 0;
  let nonBillablePlanned = 0;
  const goalMap = new Map((goals ?? []).map((g) => [g.id, g]));
  byGoal.forEach((row) => {
    const g = goalMap.get(row.goalId);
    const hrs = row.minutes / 60;
    if (isProjectBillable(g)) billablePlanned += hrs; else nonBillablePlanned += hrs;
  });
  const completedTotalMins = loggedMinutesByGoal
    ? Object.values(loggedMinutesByGoal).reduce((s, m) => s + m, 0)
    : 0;
  const completedThisWeek = completedTotalMins / 60;
  let billableCompleted = 0;
  if (loggedMinutesByGoal && Array.isArray(goals)) {
    goals.forEach((g) => {
      if (isProjectBillable(g) && g.id) billableCompleted += (loggedMinutesByGoal[g.id] ?? 0) / 60;
    });
  }

  return {
    availableHours,
    plannedHours,
    remainingHours,
    overload,
    billablePlanned,
    nonBillablePlanned,
    completedThisWeek,
    completedTotalMinutes: completedTotalMins,
    billableCompleted,
  };
}

function formatHourLabel(hour) {
  const suffix = hour >= 12 ? 'pm' : 'am';
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}${suffix}`;
}

export function getBestFocusWindow(dayPlan, calendarEvents = [], userSettings = null, learnedEnergyProfile = null) {
  const learnedFocus = getRecommendationForTaskType(learnedEnergyProfile, 'deep_work');
  if (learnedEnergyProfile?.focusWindow && learnedFocus?.label) {
    return {
      ...learnedEnergyProfile.focusWindow,
      source: 'behavioral',
    };
  }
  const startHour = parseTimeToHour(userSettings?.dayStart ?? '08:00');
  const endHour = parseTimeToHour(userSettings?.dayEnd ?? '22:00');
  const busyHours = new Set();

  Object.keys(dayPlan ?? {}).forEach((slotKey) => {
    if (slotKey === 'anytime') return;
    if (getAssignmentsForSlot(dayPlan, slotKey).length === 0) return;
    const hour = parseTimeToHour(slotKey);
    busyHours.add(hour);
  });

  (calendarEvents ?? []).forEach((event) => {
    const start = event?.start ? new Date(event.start) : null;
    const end = event?.end ? new Date(event.end) : null;
    if (!start || Number.isNaN(start.getTime())) return;
    const endHourValue = end && !Number.isNaN(end.getTime()) ? Math.max(start.getHours() + 1, end.getHours()) : start.getHours() + 1;
    for (let hour = start.getHours(); hour < endHourValue; hour += 1) {
      busyHours.add(hour);
    }
  });

  let best = null;
  let currentStart = null;
  for (let hour = startHour; hour <= endHour; hour += 1) {
    const isBusy = hour === endHour || busyHours.has(hour);
    if (!isBusy && currentStart == null) currentStart = hour;
    if (isBusy && currentStart != null) {
      const duration = hour - currentStart;
      if (duration > 0 && (!best || duration > best.duration)) {
        best = { startHour: currentStart, endHour: hour, duration };
      }
      currentStart = null;
    }
  }

  if (!best) return null;
  return {
    ...best,
    label: `${formatHourLabel(best.startHour)}-${formatHourLabel(best.endHour)}`,
  };
}

export function getAssistantOperatorSignals({
  dayPlan = {},
  goals = [],
  logs = [],
  weekAssignments = {},
  userSettings = null,
  dailyEnergy = null,
  compostCount = 0,
  calendarEvents = [],
  learnedEnergyProfile = null,
} = {}) {
  const weekCapacityHours = getWeekCapacityHours(userSettings);
  const plannedTotalMinutes = getPlannedHoursByScope(weekAssignments ?? {}, goals ?? [], 'week').totalMinutes;
  const needsAttention = getNeedsAttention(goals ?? [], logs ?? [], weekAssignments ?? {}, weekCapacityHours, plannedTotalMinutes);
  const focusWindow = getBestFocusWindow(dayPlan, calendarEvents, userSettings, learnedEnergyProfile);
  const signals = [];

  if (typeof dailyEnergy === 'number' && dailyEnergy <= 4 && Object.keys(dayPlan ?? {}).length > 4) {
    signals.push({
      id: 'overloaded-energy',
      tone: 'amber',
      message: 'You planned too much for your current energy.',
      actionId: 'MINIMUM_VIABLE_DAY',
    });
  }

  if (focusWindow?.duration >= 2) {
    signals.push({
      id: 'focus-window',
      tone: 'moss',
      message: focusWindow.source === 'behavioral'
        ? `${focusWindow.explanation ?? `You usually focus best around ${focusWindow.label}.`}`
        : `Your best deep-work window is probably ${focusWindow.label}.`,
      actionId: 'PROTECT_FOCUS_BLOCK',
    });
  }

  if ((needsAttention.noNextStep?.length ?? 0) > 0) {
    const blocked = needsAttention.noNextStep[0];
    signals.push({
      id: 'blocked-project',
      tone: 'stone',
      message: `${blocked.label} is blocked because it has no next action.`,
      actionId: 'BREAK_NEXT_3_STEPS',
      goalId: blocked.goal?.id ?? null,
    });
  }

  if (compostCount >= 7) {
    signals.push({
      id: 'uncategorized-captures',
      tone: 'stone',
      message: `You have ${compostCount} uncategorized captures. Want me to sort one into a draft plan?`,
      actionId: 'NOTE_TO_PLAN',
    });
  }

  if (signals.length === 0 && weekCapacityHours > 0 && (plannedTotalMinutes / 60) > weekCapacityHours) {
    signals.push({
      id: 'week-overload',
      tone: 'amber',
      message: 'This week is over capacity. A rebalance would make it more realistic.',
      actionId: 'REBALANCE_WEEK',
    });
  }

  return signals.slice(0, 3);
}
