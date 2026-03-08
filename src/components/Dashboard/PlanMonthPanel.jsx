import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MonthPlanView } from './TimeSlicer';
import { PlannerSkeleton, PremiumEmptyState, PremiumSectionHeader, PrimaryPlannerAction, SecondaryPlannerAction } from './PremiumPlannerPrimitives';

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

export default function PlanMonthPanel({
  unscheduledMonthTasks,
  setStagingTaskStatus,
  setPlannerViewMode,
  vaultTasks,
  goals,
  logs,
  weekAssignments,
  weeklyEvents,
  loadDayPlan,
  setPlannerPlanDayDateStr,
  monthlyRoadmap,
  handlePlanMonth,
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

  return (
    <motion.div className="space-y-6 px-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
      {isGeneratingMonthPlan ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-slate-800/80 p-4">
          <p className="font-sans text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">Shaping your month...</p>
          <PlannerSkeleton lines={4} />
        </motion.div>
      ) : null}
      <motion.section className="rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-slate-800/80 overflow-hidden" aria-label="Unscheduled this month" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.03 }}>
        <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-600">
          <PremiumSectionHeader
            title="Unscheduled this month"
            description="Tasks you intend to do this month but haven't placed yet."
          />
        </div>
        <div className="p-3 min-h-[60px]">
          {unscheduledMonthTasks.length === 0 ? (
            <PremiumEmptyState className="py-2" message="Nothing here yet. Promote from Vault or add goals." />
          ) : (
            <ul className="space-y-2">
              {unscheduledMonthTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone-100 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 px-3 py-2">
                  <span className="font-sans text-sm text-stone-800 dark:text-stone-200 truncate">{task.title}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <SecondaryPlannerAction
                      onClick={() => setStagingTaskStatus((prev) => ({ ...prev, [task.id]: 'someday' }))}
                      className="px-2 py-1 text-xs"
                    >
                      Back to Vault
                    </SecondaryPlannerAction>
                    <PrimaryPlannerAction onClick={() => setPlannerViewMode('week')} className="px-3 py-1.5 text-xs">
                      Open Week Planner
                    </PrimaryPlannerAction>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.section>

      <motion.section className="rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50/50 dark:bg-stone-800/50 overflow-hidden" aria-label="Someday vault" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.06 }}>
        <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-600">
          <PremiumSectionHeader title="Someday / Vault" description="Ideas and tasks not yet committed to this month." />
        </div>
        <div className="p-3 min-h-[60px]">
          {vaultTasks.length === 0 ? (
            <PremiumEmptyState className="py-2" message="Vault is empty. New subtasks and narrative tasks land here by default." />
          ) : (
            <ul className="space-y-2">
              {vaultTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800/50 px-3 py-2">
                  <span className="font-sans text-sm text-stone-800 dark:text-stone-200 truncate">{task.title}</span>
                  <PrimaryPlannerAction
                    onClick={() => setStagingTaskStatus((prev) => ({ ...prev, [task.id]: 'unscheduled_month' }))}
                    className="px-3 py-1.5 text-xs"
                  >
                    Add to this month
                  </PrimaryPlannerAction>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.section>

      <motion.section className="rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-slate-800/80 overflow-hidden" aria-label="Monthly goal progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.09 }}>
        <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-600">
          <PremiumSectionHeader title="Goal progress this month" description="Completed time from focus sessions and logged work." />
        </div>
        <div className="p-3">
          {(() => {
            const activeGoals = (goals ?? []).filter((g) => g.type !== 'routine' && !g.recurrence);
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
                    <li key={goal.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 dark:border-stone-700 bg-stone-50/30 dark:bg-stone-800/30 px-3 py-2">
                      <span className="font-sans text-sm font-medium text-stone-800 dark:text-stone-200 truncate">{goal.title}</span>
                      {isCountdown ? (
                        <div className="shrink-0 text-right font-sans text-sm">
                          <span className="text-stone-700 dark:text-stone-300">{hoursLogged} / {monthlyTarget}h</span>
                          <span className="text-stone-500 dark:text-stone-400 ml-1.5">
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
          <div className="rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-slate-800/80 p-4 mb-3">
            <p className="font-sans text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">Loading existing plans...</p>
            <PlannerSkeleton lines={3} />
          </div>
        ) : null}
        <MonthPlanView
          weekAssignments={mergedMonthAssignments}
          goals={goals ?? []}
          onDayClick={setPlannerPlanDayDateStr}
          monthlyRoadmap={monthlyRoadmap}
          onPlanMonth={handlePlanMonth}
          planningMonth={isGeneratingMonthPlan}
          calendarEvents={weeklyEvents ?? []}
          planMonthLabel="Shape with Mochi"
          planMonthBusyLabel="... Shaping month"
        />
      </motion.section>
    </motion.div>
  );
}
