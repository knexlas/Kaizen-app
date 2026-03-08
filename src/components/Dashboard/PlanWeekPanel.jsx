import { motion } from 'framer-motion';
import StagingArea, { formatHourKey } from '../CommandCenter/StagingArea';
import { PlannerKpiStrip, PlannerSkeleton, PremiumEmptyState, PremiumSectionHeader, SecondaryPlannerAction } from './PremiumPlannerPrimitives';

export default function PlanWeekPanel({
  plannerTodayPlanItems,
  today,
  setPlannerPlanDayDateStr,
  goals,
  weeklyEvents,
  weekAssignments,
  loadDayPlan,
  saveDayPlanForDate,
  pausedDays,
  needsRescheduling,
  rescheduleNeedsReschedulingItem,
  clearDaySchedule,
  editGoal,
  spawnedVolumeBlocks,
  removeSpawnedVolumeBlock,
  setEditingGoal,
  stagingTaskStatus,
  setStagingTaskStatus,
  plannerScheduleDrawerPreSelect,
  setPlannerScheduleDrawerPreSelect,
  isPlanningWeek = false,
}) {
  return (
    <>
      <motion.div
        id="guide-planner-week"
        className="shrink-0 border-b border-stone-200 dark:border-slate-700 px-1 py-3 mb-4 space-y-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <PremiumSectionHeader
          title="Week Focus"
          description="Place tasks into days first, then set exact times only when needed."
          right={(
            <SecondaryPlannerAction onClick={() => setPlannerPlanDayDateStr(today)}>
              Open Day Planner
            </SecondaryPlannerAction>
          )}
        />
        <PlannerKpiStrip
          items={[
            {
              label: 'planned today',
              value: `${plannerTodayPlanItems.length} block${plannerTodayPlanItems.length !== 1 ? 's' : ''}`,
            },
          ]}
        />
        {isPlanningWeek ? <PlannerSkeleton lines={2} /> : null}
        {plannerTodayPlanItems.length > 0 ? (
          <span className="font-sans text-sm text-stone-600 dark:text-stone-400 block">
            {plannerTodayPlanItems.map((p) => `${formatHourKey(p.hour)} ${p.title}`).join(' · ')}
          </span>
        ) : (
          <PremiumEmptyState className="block" message="Nothing scheduled yet." />
        )}
      </motion.div>

      <motion.section
        className="mb-6"
        aria-label="Unscheduled and this week"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut', delay: 0.05 }}
      >
        <StagingArea
          goals={goals ?? []}
          weeklyEvents={Array.isArray(weeklyEvents) ? weeklyEvents : []}
          weekAssignments={weekAssignments ?? {}}
          loadDayPlan={loadDayPlan}
          saveDayPlanForDate={saveDayPlanForDate}
          pausedDays={pausedDays ?? {}}
          needsRescheduling={needsRescheduling ?? []}
          rescheduleNeedsReschedulingItem={rescheduleNeedsReschedulingItem}
          clearDaySchedule={clearDaySchedule}
          today={today}
          editGoal={editGoal}
          spawnedVolumeBlocks={spawnedVolumeBlocks ?? []}
          removeSpawnedVolumeBlock={removeSpawnedVolumeBlock}
          onTaskClick={(ref) => {
            const goalId = ref?.goalId ?? ref?.task?.goalId;
            if (goalId) setEditingGoal((goals ?? []).find((g) => g.id === goalId) ?? null);
          }}
          onPlanDay={setPlannerPlanDayDateStr}
          stagingTaskStatus={stagingTaskStatus ?? {}}
          setStagingTaskStatus={setStagingTaskStatus}
          initialScheduleSelection={plannerScheduleDrawerPreSelect}
          onConsumeScheduleSelection={() => setPlannerScheduleDrawerPreSelect(null)}
        />
      </motion.section>
    </>
  );
}
