import { useMemo } from 'react';
import { getPlannedHoursByScope } from '../../../utils/plannedHoursAggregation';
import {
  getWeekDateStrings,
  getLoggedMinutesThisWeekByGoal,
  getRecommendedTaskForToday,
  getNeedsAttention,
  getWeekCapacitySummary,
  getWeekCapacityHours,
} from '../../../services/projectCockpitService';
import { getPlanningEntryConfig } from '../../../constants/plannerPresets';

export function usePlanningSnapshot({
  userSettings,
  logs,
  goals,
  weekAssignments,
  today,
}) {
  const planningEntry = useMemo(() => getPlanningEntryConfig(userSettings ?? {}), [userSettings]);
  const weekDateStrings = useMemo(() => getWeekDateStrings(), []);
  const loggedByGoalThisWeek = useMemo(
    () => getLoggedMinutesThisWeekByGoal(logs ?? [], weekDateStrings),
    [logs, weekDateStrings]
  );
  const weekCapacityHours = useMemo(() => getWeekCapacityHours(userSettings), [userSettings]);
  const plannedTotalMinutes = useMemo(
    () => getPlannedHoursByScope(weekAssignments ?? {}, goals ?? [], 'week').totalMinutes,
    [weekAssignments, goals]
  );
  const recommendedToday = useMemo(
    () => getRecommendedTaskForToday(goals ?? [], weekAssignments ?? {}, today, { logs, userSettings }),
    [goals, weekAssignments, today, logs, userSettings]
  );
  const needsAttention = useMemo(
    () => getNeedsAttention(goals ?? [], logs ?? [], weekAssignments ?? {}, weekCapacityHours, plannedTotalMinutes),
    [goals, logs, weekAssignments, weekCapacityHours, plannedTotalMinutes]
  );
  const weekCapacity = useMemo(
    () => getWeekCapacitySummary(weekAssignments ?? {}, goals ?? [], userSettings, loggedByGoalThisWeek),
    [weekAssignments, goals, userSettings, loggedByGoalThisWeek]
  );

  return {
    planningEntry,
    weekDateStrings,
    loggedByGoalThisWeek,
    weekCapacityHours,
    plannedTotalMinutes,
    recommendedToday,
    needsAttention,
    weekCapacity,
  };
}
