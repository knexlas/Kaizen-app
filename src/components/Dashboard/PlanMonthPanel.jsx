import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MonthPlanView } from './TimeSlicer';
import { PlannerSkeleton, PremiumEmptyState, PremiumSectionHeader, PrimaryPlannerAction, SecondaryPlannerAction } from './PremiumPlannerPrimitives';
import { getRecentStatusCounts } from '../../domains/recovery/services/antiShameRecurrenceService';

function getMinutesThisMonthForGoal(logs, goalId) {
  if (!Array.isArray(logs) || !goalId) return 0;
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  return logs.reduce((sum, log) => {
    if (log.taskId !== goalId || !log.date) return sum;
    const d = typeof log.date === 'string' ? new Date(log.date) : log.date;
    if (d.getFullYear() !== thisYear || d.getMonth() !== thisMonth) return sum;
    return sum + (Number(log.minutes) || 0);
  }, 0);
}

function rankRoutineSupport(routine, recurringSupportState) {
  const counts = getRecentStatusCounts(recurringSupportState, {
    itemType: 'routine',
    itemId: routine?.id,
    lookbackDays: 21,
  });
  const priority = (
    (routine?.pausedUntil ? 50 : 0)
    + (counts.deferred * 12)
    + (counts.skipped * 9)
    + (counts.light * 5)
    + (Math.min(7, Number(routine?.perWeek) || 0) * 2)
  );
  return { routine, counts, priority };
}

function getRoutineSummary(routine, counts) {
  const summary = [];
  const perWeek = Math.max(0, Number(routine?.perWeek) || 0);
  if (perWeek > 0) summary.push(`${perWeek}x/week`);
  summary.push(`${Math.max(1, Number(routine?.duration) || 15)} min`);
  if (routine?.pausedUntil) summary.push(`paused until ${routine.pausedUntil}`);
  else if (counts.deferred > 0) summary.push('deferred recently');
  else if (counts.skipped > 0) summary.push('skipped recently');
  else if (counts.light > 0) summary.push('running lighter');
  return summary.join(' / ');
}

export default function PlanMonthPanel({
  unscheduledMonthTasks,
  setStagingTaskStatus,
  setPlannerViewMode,
  vaultTasks,
  goals,
  routines = [],
  recurringSupportState = {},
  routineSupportPlacements = [],
  logs,
  weekAssignments,
  weeklyEvents,
  loadDayPlan,
  setPlannerPlanDayDateStr,
  onOpenPlannerSystems,
  monthlyRoadmap,
  isGeneratingMonthPlan,
}) {
  const monthDateStrings = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    });
  }, []);
  const [monthAssignments, setMonthAssignments] = useState({});
  const [loadingMonthAssignments, setLoadingMonthAssignments] = useState(false);
  const [showAllRoutineSupports, setShowAllRoutineSupports] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMonthAssignments() {
      if (typeof loadDayPlan !== 'function' || monthDateStrings.length === 0) {
        setMonthAssignments({});
        return;
      }
      setLoadingMonthAssignments(true);
      try {
        const entries = await Promise.all(
          monthDateStrings.map(async (dateStr) => {
            const plan = await loadDayPlan(dateStr);
            return [dateStr, plan && typeof plan === 'object' ? plan : {}];
          })
        );
        if (cancelled) return;
        setMonthAssignments(
          entries.reduce((acc, [dateStr, plan]) => {
            if (plan && Object.keys(plan).length > 0) acc[dateStr] = plan;
            return acc;
          }, {})
        );
      } catch (error) {
        if (!cancelled) console.warn('PlanMonthPanel: failed to load month assignments', error);
      } finally {
        if (!cancelled) setLoadingMonthAssignments(false);
      }
    }

    loadMonthAssignments();
    return () => {
      cancelled = true;
    };
  }, [loadDayPlan, monthDateStrings]);

  const mergedMonthAssignments = useMemo(
    () => ({ ...(monthAssignments ?? {}), ...(weekAssignments ?? {}) }),
    [monthAssignments, weekAssignments]
  );

  const priorityRoutineSupports = useMemo(() => (
    (Array.isArray(routines) ? routines : [])
      .map((routine) => rankRoutineSupport(routine, recurringSupportState))
      .sort((a, b) => (
        b.priority - a.priority
        || (Number(b.routine?.perWeek) || 0) - (Number(a.routine?.perWeek) || 0)
        || String(a.routine?.title || '').localeCompare(String(b.routine?.title || ''))
      ))
      .slice(0, 6)
  ), [recurringSupportState, routines]);

  const shouldCollapseRoutineSupports = priorityRoutineSupports.length > 3;
  const visibleRoutineSupports = shouldCollapseRoutineSupports && !showAllRoutineSupports
    ? priorityRoutineSupports.slice(0, 3)
    : priorityRoutineSupports;
  const routineSupportPlacementsThisMonth = useMemo(
    () => (Array.isArray(routineSupportPlacements) ? routineSupportPlacements : []).filter((placement) => placement?.dateStr?.slice(0, 7) === monthDateStrings[0]?.slice(0, 7)),
    [routineSupportPlacements, monthDateStrings]
  );

  return (
    <motion.div className="space-y-6 px-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
      {isGeneratingMonthPlan ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-600 dark:bg-slate-800/80">
          <p className="mb-2 font-sans text-sm font-medium text-stone-700 dark:text-stone-300">Shaping month plan...</p>
          <PlannerSkeleton lines={4} />
        </motion.div>
      ) : null}

      <motion.section className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-600 dark:bg-slate-800/80" aria-label="Unscheduled this month" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.03 }}>
        <div className="border-b border-stone-200 px-4 py-3 dark:border-stone-600">
          <PremiumSectionHeader
            title="Unscheduled this month"
            description="Tasks you want to do this month but have not placed into a week yet."
          />
        </div>
        <div className="min-h-[60px] p-3">
          {unscheduledMonthTasks.length === 0 ? (
            <PremiumEmptyState className="py-2" message="Nothing here yet. Move items from Someday or add goals." />
          ) : (
            <ul className="space-y-2">
              {unscheduledMonthTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2 dark:border-stone-700 dark:bg-stone-800/50">
                  <span className="truncate font-sans text-sm text-stone-800 dark:text-stone-200">{task.title}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <SecondaryPlannerAction
                      onClick={() => setStagingTaskStatus((prev) => ({ ...prev, [task.id]: 'someday' }))}
                      className="px-2 py-1 text-xs"
                    >
                      Move to Someday
                    </SecondaryPlannerAction>
                    <PrimaryPlannerAction onClick={() => setPlannerViewMode('week')} className="px-3 py-1.5 text-xs">
                      Open week
                    </PrimaryPlannerAction>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.section>

      <motion.section className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50/50 dark:border-stone-600 dark:bg-stone-800/50" aria-label="Someday" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.06 }}>
        <div className="border-b border-stone-200 px-4 py-3 dark:border-stone-600">
          <PremiumSectionHeader title="Someday" description="Ideas and tasks that are still outside this month's commitments." />
        </div>
        <div className="min-h-[60px] p-3">
          {vaultTasks.length === 0 ? (
            <PremiumEmptyState className="py-2" message="Nothing saved for later yet. New ideas can rest here until they matter." />
          ) : (
            <ul className="space-y-2">
              {vaultTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone-100 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-800/50">
                  <span className="truncate font-sans text-sm text-stone-800 dark:text-stone-200">{task.title}</span>
                  <PrimaryPlannerAction
                    onClick={() => setStagingTaskStatus((prev) => ({ ...prev, [task.id]: 'unscheduled_month' }))}
                    className="px-3 py-1.5 text-xs"
                  >
                    Add to month
                  </PrimaryPlannerAction>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.section>

      <motion.section className="overflow-hidden rounded-xl border border-dashed border-stone-300 bg-stone-50/35 dark:border-stone-600 dark:bg-stone-900/20" aria-label="Routine supports" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.08 }}>
        <div className="border-b border-stone-200/80 px-4 py-3 dark:border-stone-700">
          <PremiumSectionHeader
            title="Routine supports"
            description="Recurring supports stay visible here as quiet monthly context, not as primary commitments."
          />
        </div>
        <div className="p-3">
          {priorityRoutineSupports.length === 0 ? (
            <PremiumEmptyState className="py-2" message="No routines need monthly attention right now." />
          ) : (
            <div className="space-y-2">
              {routineSupportPlacementsThisMonth.length > 0 && (
                <p className="font-sans text-xs text-stone-500 dark:text-stone-400">
                  {routineSupportPlacementsThisMonth.length} support block{routineSupportPlacementsThisMonth.length === 1 ? '' : 's'} already placed this month.
                </p>
              )}
              {visibleRoutineSupports.map(({ routine, counts }) => (
                <div key={routine.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone-200/80 bg-white/80 px-3 py-2 dark:border-stone-700 dark:bg-stone-800/45">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-sm text-stone-800 dark:text-stone-200">{routine.title}</p>
                    <p className="mt-0.5 font-sans text-xs text-stone-500 dark:text-stone-400">
                      {getRoutineSummary(routine, counts)}
                    </p>
                    {routineSupportPlacementsThisMonth.filter((placement) => placement.routineId === routine.id).length > 0 && (
                      <p className="mt-1 font-sans text-[11px] text-moss-700 dark:text-moss-300">
                        Planned:{' '}
                        {routineSupportPlacementsThisMonth
                          .filter((placement) => placement.routineId === routine.id)
                          .map((placement) => {
                            try {
                              const label = new Date(`${placement.dateStr}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                              return placement.mode === 'light' ? `${label} light` : label;
                            } catch {
                              return placement.dateStr;
                            }
                          })
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <SecondaryPlannerAction onClick={() => setPlannerViewMode('week')} className="px-2 py-1 text-xs">
                      Open week
                    </SecondaryPlannerAction>
                    <SecondaryPlannerAction onClick={() => onOpenPlannerSystems?.()} className="px-2 py-1 text-xs">
                      Open systems
                    </SecondaryPlannerAction>
                  </div>
                </div>
              ))}

              {shouldCollapseRoutineSupports && (
                <button
                  type="button"
                  onClick={() => setShowAllRoutineSupports((prev) => !prev)}
                  className="rounded-lg px-2 py-1 font-sans text-xs font-medium text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:text-stone-400 dark:hover:text-stone-200"
                >
                  {showAllRoutineSupports ? 'Show fewer routine supports' : `Show ${priorityRoutineSupports.length - visibleRoutineSupports.length} more`}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.section>

      <motion.section className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-600 dark:bg-slate-800/80" aria-label="Monthly goal progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.09 }}>
        <div className="border-b border-stone-200 px-4 py-3 dark:border-stone-600">
          <PremiumSectionHeader title="Goal progress this month" description="Completed time from focus sessions and logged work." />
        </div>
        <div className="p-3">
          {(() => {
            const activeGoals = (goals ?? []).filter((goal) => goal.type !== 'routine' && !goal.recurrence);
            if (activeGoals.length === 0) {
              return <PremiumEmptyState className="py-2" message="No active goals yet. Add a goal to see progress here." />;
            }
            return (
              <ul className="space-y-3">
                {activeGoals.map((goal) => {
                  const minutesLogged = getMinutesThisMonthForGoal(logs ?? [], goal.id);
                  const hoursLogged = Math.round((minutesLogged / 60) * 10) / 10;
                  const monthlyTarget = goal.monthlyTargetHours ?? (typeof goal.targetHours === 'number' ? goal.targetHours * 4 : null);
                  const isCountdown = typeof monthlyTarget === 'number' && monthlyTarget > 0;
                  return (
                    <li key={goal.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 bg-stone-50/30 px-3 py-2 dark:border-stone-700 dark:bg-stone-800/30">
                      <span className="truncate font-sans text-sm font-medium text-stone-800 dark:text-stone-200">{goal.title}</span>
                      {isCountdown ? (
                        <div className="shrink-0 text-right font-sans text-sm">
                          <span className="text-stone-700 dark:text-stone-300">{hoursLogged} / {monthlyTarget}h</span>
                          <span className="ml-1.5 text-stone-500 dark:text-stone-400">
                            {Math.max(0, Math.round((monthlyTarget - hoursLogged) * 10) / 10)}h remaining
                          </span>
                        </div>
                      ) : (
                        <span className="shrink-0 font-sans text-sm text-stone-700 dark:text-stone-300">{hoursLogged}h this month</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </div>
      </motion.section>

      <motion.section aria-label="Month at a glance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.12 }}>
        {loadingMonthAssignments ? (
          <div className="mb-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-600 dark:bg-slate-800/80">
            <p className="mb-2 font-sans text-sm font-medium text-stone-700 dark:text-stone-300">Loading existing plans...</p>
            <PlannerSkeleton lines={3} />
          </div>
        ) : null}
        <MonthPlanView
          weekAssignments={mergedMonthAssignments}
          goals={goals ?? []}
          onDayClick={setPlannerPlanDayDateStr}
          monthlyRoadmap={monthlyRoadmap}
          onPlanMonth={undefined}
          planningMonth={isGeneratingMonthPlan}
          calendarEvents={weeklyEvents ?? []}
        />
      </motion.section>
    </motion.div>
  );
}
