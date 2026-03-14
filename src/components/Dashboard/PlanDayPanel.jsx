import { AnimatePresence, motion } from 'framer-motion';
import { formatHourKey } from '../CommandCenter/StagingArea';
import { PlannerKpiStrip, PlannerSkeleton, PremiumEmptyState, PremiumSectionHeader, PrimaryPlannerAction, SecondaryPlannerAction } from './PremiumPlannerPrimitives';

export default function PlanDayPanel({
  plannerTodayPlanItems,
  plannerDayExpanded,
  setPlannerDayExpanded,
  setPlannerPlanDayDateStr,
  today,
  setActiveTab,
  plannerTodayBacklogTasks,
  handleQuickScheduleTodayTask,
  isPlanningDay = false,
  onPlanTodayRitual,
}) {
  return (
    <motion.div className="mb-6 px-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
      <div className="rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-4">
        <PremiumSectionHeader
          className="mb-2"
          title="Day Focus"
          description="Keep today realistic. Expand to review and adjust."
          right={(
            <SecondaryPlannerAction onClick={() => setPlannerDayExpanded((prev) => !prev)} className="py-1 px-2 text-xs">
              {plannerDayExpanded ? 'Collapse' : 'Expand'}
            </SecondaryPlannerAction>
          )}
        />
        <PlannerKpiStrip
          className="mb-3"
          items={[
            {
              label: 'planned today',
              value: `${plannerTodayPlanItems.length} block${plannerTodayPlanItems.length !== 1 ? 's' : ''}`,
            },
          ]}
        />
        <AnimatePresence initial={false}>
          {isPlanningDay ? (
            <motion.div key="day-skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              <PlannerSkeleton lines={2} className="mb-3" />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {plannerDayExpanded ? (
            <motion.div
              key="day-expanded"
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mt-3 rounded-xl border border-stone-200/70 dark:border-slate-700/70 bg-stone-50/50 dark:bg-slate-900/20 p-3 overflow-hidden"
            >
              {plannerTodayPlanItems.length > 0 ? (
                <ul className="space-y-1.5 mb-3">
                  {plannerTodayPlanItems.map((p, index) => (
                    <li key={`${p.id ?? p.title}-${p.hour}-${index}`} className="font-sans text-sm text-stone-700 dark:text-stone-300">
                      <span className="font-medium">{formatHourKey(p.hour)}</span> {p.title}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {onPlanTodayRitual && (
                  <PrimaryPlannerAction onClick={onPlanTodayRitual}>
                    Shape your day
                  </PrimaryPlannerAction>
                )}
                <PrimaryPlannerAction onClick={() => setPlannerPlanDayDateStr(today)}>
                  Open Day Planner
                </PrimaryPlannerAction>
                <SecondaryPlannerAction onClick={() => setActiveTab('today')}>
                  Open Today Timeline
                </SecondaryPlannerAction>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-200/70 dark:border-slate-700/70">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-sans text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Today backlog</p>
                  <button
                    type="button"
                    onClick={() => setPlannerPlanDayDateStr(today)}
                    className="font-sans text-xs text-moss-600 dark:text-moss-400 hover:underline focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded px-1"
                  >
                    Open Day Planner
                  </button>
                </div>
                {plannerTodayBacklogTasks.length > 0 ? (
                  <ul className="space-y-1.5">
                    {plannerTodayBacklogTasks.map((task) => (
                      <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white/70 dark:bg-slate-800/50 px-2.5 py-2">
                        <div className="min-w-0">
                          <p className="font-sans text-sm text-stone-800 dark:text-stone-200 truncate">{task.title}</p>
                          {task.goalTitle && <p className="font-sans text-[11px] text-stone-500 dark:text-stone-400 truncate">{task.goalTitle}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickScheduleTodayTask(task)}
                          className="shrink-0 px-2.5 py-1.5 rounded-md font-sans text-xs font-medium bg-moss-600 text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40 premium-transition"
                        >
                          Quick add
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <PremiumEmptyState className="text-xs" message="No backlog items ready. Add tasks in goals or move items into this month." />
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
