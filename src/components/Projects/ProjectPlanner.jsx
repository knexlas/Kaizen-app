import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { localISODate, daysUntilDeadline } from '../../services/dateUtils';
import { sliceProject } from '../../services/geminiService';
import { buildProjectGoalFromPlan } from '../../utils/projectGoalFromPlan';
import { useGarden } from '../../context/GardenContext';
import {
  getActiveProjects,
  getNextStepForProject,
  getProjectHealth,
  getProjectHealthLabel,
  getDeadlinesAtRisk,
  getPlannedHoursPerProjectThisWeek,
  getProjectEstimatedHours,
  getProjectCompletedHours,
  getProjectClient,
  isProjectBillable,
  isProjectUnplanned,
  isWaitingOnClient,
  getLastTouchedDate,
  getProjectRiskScore,
  PROJECT_HEALTH_STATES,
} from '../../services/projectSupportService';
import { getPlannedHoursByScope } from '../../utils/plannedHoursAggregation';
import {
  getWeekDateStrings,
  getLoggedMinutesThisWeekByGoal,
  getRecommendedTaskForToday,
  getNeedsAttention,
  getWeekCapacitySummary,
  getWeekCapacityHours,
} from '../../services/projectCockpitService';
import { getProjectPlannerPresetConfig, getPlannerPreset, PLANNER_PRESET_IDS } from '../../constants/plannerPresets';

/** Parse "Week 1-2" or "Week 3" into 0-based week indices { start, end }. */
function parseWeekRange(weekRangeStr, totalWeeks = 14) {
  if (!weekRangeStr || typeof weekRangeStr !== 'string') return { start: 0, end: totalWeeks - 1 };
  const m = weekRangeStr.trim().match(/Week\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
  if (!m) return { start: 0, end: totalWeeks - 1 };
  const start = Math.max(0, parseInt(m[1], 10) - 1);
  const end = m[2] ? Math.min(totalWeeks - 1, parseInt(m[2], 10) - 1) : start;
  return { start: Math.min(start, end), end };
}

const skillGoals = (goals) => (goals || []).filter((g) => g.type === 'kaizen' && !g._projectGoal);

function formatDeadline(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const PROJECT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'billable', label: 'Billable' },
  { id: 'non_billable', label: 'Non-billable' },
  { id: 'at_risk', label: 'At risk' },
  { id: 'waiting_on_client', label: 'Waiting on client' },
  { id: 'unplanned', label: 'Unplanned' },
  { id: 'this_week', label: 'This week' },
];

function formatLastTouched(dateStr, todayStr) {
  if (!dateStr) return 'Never';
  if (dateStr === todayStr) return 'Today';
  const today = new Date(todayStr + 'T12:00:00');
  const then = new Date(dateStr + 'T12:00:00');
  const diffDays = Math.floor((today - then) / (24 * 60 * 60 * 1000));
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 14) return '1w ago';
  return `${Math.floor(diffDays / 7)}w ago`;
}

export default function ProjectPlanner({
  open,
  onClose,
  onCreateGoals,
  prefillTitle = '',
  prefillParentGoalId = '',
  focusGoalId = null,
  today: todayProp,
  onStartFocus,
  onReschedule,
  onViewTodayPlan,
  onEditGoal,
}) {
  const { goals, weekAssignments, loadWeekPlans, logs, userSettings, today: todayFromContext, addSubtask, editGoal } = useGarden();
  const today = todayProp ?? todayFromContext ?? localISODate();
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'create'
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [clientName, setClientName] = useState('');
  const [billable, setBillable] = useState(false);
  const [parentGoalId, setParentGoalId] = useState('');
  const [skillLevel, setSkillLevel] = useState('intermediate');
  const [isSlicing, setIsSlicing] = useState(false);
  const [plan, setPlan] = useState(null);
  const [sliceError, setSliceError] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [linkedGoals, setLinkedGoals] = useState({});
  const [feedback, setFeedback] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [projectFilter, setProjectFilter] = useState('all');
  const [showFullCockpitForHabit, setShowFullCockpitForHabit] = useState(false);
  const [quickAddGoal, setQuickAddGoal] = useState(null);
  const [blockGoal, setBlockGoal] = useState(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockChecked, setBlockChecked] = useState(true);
  const focusRowRef = useRef(null);

  useEffect(() => {
    if (open && focusGoalId && focusRowRef.current) {
      focusRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [open, focusGoalId]);

  const presetConfig = useMemo(
    () => getProjectPlannerPresetConfig(userSettings ?? {}),
    [userSettings]
  );
  const isHabitFocused = useMemo(() => getPlannerPreset(userSettings ?? {}) === PLANNER_PRESET_IDS.HABIT_FOCUSED, [userSettings]);
  const useMinimalCockpit = isHabitFocused && !showFullCockpitForHabit;

  const activeProjects = useMemo(() => getActiveProjects(goals), [goals]);
  const deadlinesAtRisk = useMemo(() => getDeadlinesAtRisk(goals), [goals]);
  const plannedThisWeek = useMemo(
    () => getPlannedHoursPerProjectThisWeek(weekAssignments ?? {}, goals ?? []),
    [weekAssignments, goals]
  );
  const plannedByGoalId = useMemo(() => {
    const map = {};
    plannedThisWeek.forEach((row) => { map[row.goalId] = row.minutes; });
    return map;
  }, [plannedThisWeek]);

  const weekDateStrings = useMemo(() => getWeekDateStrings(), []);
  const loggedByGoalThisWeek = useMemo(
    () => getLoggedMinutesThisWeekByGoal(logs, weekDateStrings),
    [logs, weekDateStrings]
  );
  const recommendedToday = useMemo(
    () => getRecommendedTaskForToday(goals, weekAssignments, today, { logs, userSettings }),
    [goals, weekAssignments, today, logs, userSettings]
  );
  const weekCapacityHours = useMemo(() => getWeekCapacityHours(userSettings), [userSettings]);
  const plannedTotalMinutes = useMemo(() => {
    const { totalMinutes } = getPlannedHoursByScope(weekAssignments ?? {}, goals ?? [], 'week');
    return totalMinutes;
  }, [weekAssignments, goals]);
  const needsAttention = useMemo(
    () => getNeedsAttention(goals, logs, weekAssignments, weekCapacityHours, plannedTotalMinutes),
    [goals, logs, weekAssignments, weekCapacityHours, plannedTotalMinutes]
  );
  const weekCapacity = useMemo(
    () => getWeekCapacitySummary(weekAssignments, goals, userSettings, loggedByGoalThisWeek),
    [weekAssignments, goals, userSettings, loggedByGoalThisWeek]
  );

  const totalLoggedMinutesThisWeek = useMemo(
    () => Object.values(loggedByGoalThisWeek).reduce((s, m) => s + m, 0),
    [loggedByGoalThisWeek]
  );
  const billableLoggedThisWeek = useMemo(() => {
    let sum = 0;
    activeProjects.forEach((g) => {
      if (!isProjectBillable(g)) return;
      sum += loggedByGoalThisWeek[g.id] || 0;
    });
    return sum / 60;
  }, [activeProjects, loggedByGoalThisWeek]);

  useEffect(() => {
    if (open && typeof loadWeekPlans === 'function') loadWeekPlans();
  }, [open, loadWeekPlans]);

  useEffect(() => {
    if (!open) { setView('dashboard'); setShowFullCockpitForHabit(false); }
  }, [open]);

  useEffect(() => {
    if (open && view === 'dashboard' && presetConfig.defaultProjectFilter) {
      setProjectFilter(presetConfig.defaultProjectFilter);
    }
  }, [open, view, presetConfig.defaultProjectFilter]);

  useEffect(() => {
    if (open && prefillTitle) {
      setName(prefillTitle);
      setView('create');
    }
    if (open && prefillParentGoalId) setParentGoalId(prefillParentGoalId);
  }, [open, prefillTitle, prefillParentGoalId]);

  const healthContext = useMemo(
    () => ({ weekAssignments: weekAssignments ?? {}, goals: goals ?? [], logs: logs ?? [] }),
    [weekAssignments, goals, logs]
  );
  const blockedProjects = activeProjects.filter((g) => getProjectHealth(g, healthContext).state === PROJECT_HEALTH_STATES.BLOCKED);
  const stuckProjects = activeProjects.filter((g) => getProjectHealth(g, healthContext).state === PROJECT_HEALTH_STATES.STUCK);
  const atRiskProjects = deadlinesAtRisk;
  const filteredProjects = useMemo(() => {
    if (projectFilter === 'all') return activeProjects;
    return activeProjects.filter((g) => {
      const health = getProjectHealth(g, healthContext).state;
      const plannedMins = plannedByGoalId[g.id] ?? 0;
      const completedMins = loggedByGoalThisWeek[g.id] ?? 0;
      switch (projectFilter) {
        case 'billable': return isProjectBillable(g);
        case 'non_billable': return !isProjectBillable(g);
        case 'at_risk': return health === PROJECT_HEALTH_STATES.AT_RISK || health === PROJECT_HEALTH_STATES.OVERDUE;
        case 'waiting_on_client': return isWaitingOnClient(g);
        case 'unplanned': return isProjectUnplanned(g, weekAssignments ?? {}, goals ?? []);
        case 'this_week': return plannedMins > 0 || completedMins > 0;
        default: return true;
      }
    });
  }, [activeProjects, projectFilter, healthContext, plannedByGoalId, loggedByGoalThisWeek, weekAssignments, goals]);

  const goToCreate = () => {
    setView('create');
    setPlan(null);
    setSliceError(null);
    setBillable(userSettings?.onboardingRole === 'freelancer' || userSettings?.onboardingUseCase === 'freelance');
  };
  const goToDashboard = () => { setView('dashboard'); setName(''); setDescription(''); setDeadline(''); setClientName(''); setBillable(false); setParentGoalId(''); setPlan(null); setSliceError(null); setSelectedTasks(new Set()); setLinkedGoals({}); setFeedback(''); };

  const handleGeneratePlan = useCallback(async (userFeedback = '') => {
    if (!name.trim()) return;
    setIsSlicing(true);
    if (!userFeedback) {
      setPlan(null);
      setSliceError(null);
    }
    try {
      const result = await sliceProject(name, deadline || null, userFeedback || '', description, goals, skillLevel);
      if (result && Array.isArray(result.phases) && result.phases.length > 0) {
        setPlan(result);
        setFeedback('');
        const allTasks = new Set();
        result.phases.forEach((phase) => {
          (phase.tasks || []).forEach((t) => allTasks.add(t.title));
        });
        setSelectedTasks(allTasks);
        const links = {};
        (result.suggestedLinks ?? []).forEach((l) => {
          if (l.goalId && l.taskTitle) links[l.taskTitle] = l.goalId;
        });
        setLinkedGoals(links);
      } else {
        setSliceError("The plan didn't generate. Try again or describe the project differently.");
      }
    } catch (e) {
      console.error('Project slice failed', e);
      setSliceError("Connection failed. Check Settings or try again later.");
    } finally {
      setIsSlicing(false);
    }
  }, [name, deadline, description, goals, skillLevel]);

  const handleCreate = useCallback(async () => {
    if (!plan || !onCreateGoals || isCreating) return;
    setIsCreating(true);
    try {
    const projectGoal = buildProjectGoalFromPlan(plan, {
      titleOverride: name.trim() || 'Project',
      deadline: deadline || null,
      parentGoalId: parentGoalId || null,
      _client: clientName.trim() || null,
      _billable: billable,
      shouldIncludeTask: (phase, task) => selectedTasks.has(task.title) && !linkedGoals[task.title],
    });

    onCreateGoals([projectGoal]);
    window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Project added.' } }));
    goToDashboard();
    onClose?.();
    setSkillLevel('intermediate');
    } finally {
      setIsCreating(false);
    }
  }, [plan, selectedTasks, linkedGoals, name, deadline, clientName, billable, parentGoalId, onCreateGoals, onClose, isCreating]);

  const toggleTask = (title) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 w-full max-w-4xl max-h-[90vh] flex flex-col"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
          >
            ×
          </button>
          <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-700 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-sans text-stone-900 dark:text-stone-100 text-xl font-semibold">Projects</h2>
              <p className="font-sans text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                {view === 'dashboard'
                  ? 'Active work, next actions, deadlines.'
                  : 'Add a project and break it into steps.'}
              </p>
            </div>
            {view === 'dashboard' && (
              <button
                type="button"
                onClick={goToCreate}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 font-sans text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                Add project
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {view === 'dashboard' && (
              <>
                {/* Habit-focused: minimal cockpit — summary + one suggestion + See all */}
                {useMinimalCockpit && (
                  <section className="rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50/50 dark:bg-stone-800/30 p-4 space-y-3" aria-label="Project summary">
                    <div className="font-sans text-sm text-stone-700 dark:text-stone-300">
                      <span className="font-medium tabular-nums">{activeProjects.length}</span> project{activeProjects.length !== 1 ? 's' : ''}
                      {' · '}
                      {deadlinesAtRisk.length > 0 ? <span className="text-amber-600 dark:text-amber-400 font-medium">{deadlinesAtRisk.length} at risk</span> : 'none at risk'}
                      {' · '}
                      <span className="tabular-nums">{(plannedThisWeek.reduce((s, r) => s + r.minutes, 0) / 60).toFixed(1)}h</span> planned this week
                    </div>
                    {recommendedToday ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-medium text-stone-900 dark:text-stone-100">{recommendedToday.nextStep.title}</p>
                          <p className="font-sans text-xs text-stone-500 dark:text-stone-400">{recommendedToday.reason}</p>
                        </div>
                        {typeof onStartFocus === 'function' && (
                          <button type="button" onClick={() => onStartFocus({ goal: recommendedToday.goal, minutes: recommendedToday.nextStep.suggestedMinutes ?? 15, subtaskId: recommendedToday.nextStep.subtaskId ?? null })} className="shrink-0 px-3 py-1.5 rounded-lg bg-moss-600 text-white font-sans text-sm font-medium hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40">Start focus</button>
                        )}
                      </div>
                    ) : (
                      <p className="font-sans text-xs text-stone-500 dark:text-stone-400">{activeProjects.length === 0 ? 'No projects yet.' : 'No suggested task. Add a next step or plan time.'}</p>
                    )}
                    <button type="button" onClick={() => setShowFullCockpitForHabit(true)} className="font-sans text-xs text-moss-600 dark:text-moss-400 hover:underline focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded">See all projects</button>
                  </section>
                )}

                {/* Full cockpit (or non-habit): 1. Top strip, 2. Portfolio, 3. List, 4. Needs attention, 5. Week capacity */}
                {!useMinimalCockpit && (
                <>
                {/* 1. Top strip: What to work on now — one recommended task, reason, actions */}
                {presetConfig.showTodayStrip && (
                <section className={`rounded-xl border p-4 ${presetConfig.emphasizeTodayStrip ? 'border-moss-300 dark:border-moss-600 bg-moss-50/40 dark:bg-moss-900/20 ring-1 ring-moss-200/50 dark:ring-moss-700/30' : 'border-stone-200 dark:border-stone-600 bg-stone-50/50 dark:bg-stone-800/30'}`} aria-label="What to work on now">
                  <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">What to work on now</h3>
                  {!recommendedToday ? (
                    <p className="font-sans text-sm text-stone-500 dark:text-stone-400">
                      {activeProjects.length === 0 ? 'No projects yet. Add a project to get started.' : 'No concrete next action. Add a next step or plan time for a project.'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-base font-semibold text-stone-900 dark:text-stone-100 truncate" title={`${recommendedToday.goal.title ?? recommendedToday.goal._projectName ?? 'Project'}: ${recommendedToday.nextStep.title}`}>
                          {recommendedToday.nextStep.title}
                        </p>
                        <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-0.5">{recommendedToday.reason}</p>
                        <p className="font-sans text-xs text-stone-400 dark:text-stone-500 mt-0.5">{recommendedToday.goal.title ?? recommendedToday.goal._projectName ?? 'Project'} · ~{recommendedToday.nextStep.suggestedMinutes ?? 15} min</p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {typeof onStartFocus === 'function' && (
                          <button
                            type="button"
                            onClick={() => onStartFocus({ goal: recommendedToday.goal, minutes: recommendedToday.nextStep.suggestedMinutes ?? 15, subtaskId: recommendedToday.nextStep.subtaskId ?? null })}
                            className="px-4 py-2 rounded-lg bg-moss-600 text-white font-sans text-sm font-medium hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                          >
                            Start focus
                          </button>
                        )}
                        {typeof onReschedule === 'function' && (
                          <button type="button" onClick={() => onReschedule(recommendedToday)} className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 font-sans text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800">Reschedule</button>
                        )}
                        {typeof onViewTodayPlan === 'function' && (
                          <button type="button" onClick={onViewTodayPlan} className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 font-sans text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800">View today plan</button>
                        )}
                      </div>
                    </div>
                  )}
                </section>
                )}

                {/* 2. Portfolio summary row — active, at-risk, blocked, overdue, hours */}
                {presetConfig.showPortfolioSummary && (
                <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-7 gap-2 text-center" aria-label="Portfolio summary">
                  <div className="rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800/50 p-2">
                    <p className="font-sans text-lg font-semibold tabular-nums text-stone-900 dark:text-stone-100">{activeProjects.length}</p>
                    <p className="font-sans text-xs text-stone-500 dark:text-stone-400">Active</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800/50 p-2">
                    <p className="font-sans text-lg font-semibold tabular-nums text-stone-900 dark:text-stone-100">{deadlinesAtRisk.length}</p>
                    <p className="font-sans text-xs text-stone-500 dark:text-stone-400">At risk</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800/50 p-2">
                    <p className="font-sans text-lg font-semibold tabular-nums text-stone-900 dark:text-stone-100">{blockedProjects.length}</p>
                    <p className="font-sans text-xs text-stone-500 dark:text-stone-400">Blocked</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 p-2">
                    <p className="font-sans text-lg font-semibold tabular-nums text-amber-800 dark:text-amber-200">{needsAttention.overdueUnscheduled.length}</p>
                    <p className="font-sans text-xs text-amber-600 dark:text-amber-400">Overdue</p>
                  </div>
                  {presetConfig.showPortfolioHours && (
                    <>
                      <div className="rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800/50 p-2">
                        <p className="font-sans text-lg font-semibold tabular-nums text-stone-900 dark:text-stone-100">{(plannedThisWeek.reduce((s, r) => s + r.minutes, 0) / 60).toFixed(1)}h</p>
                        <p className="font-sans text-xs text-stone-500 dark:text-stone-400">Planned</p>
                      </div>
                      <div className="rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800/50 p-2">
                        <p className="font-sans text-lg font-semibold tabular-nums text-stone-900 dark:text-stone-100">{(totalLoggedMinutesThisWeek / 60).toFixed(1)}h</p>
                        <p className="font-sans text-xs text-stone-500 dark:text-stone-400">Done</p>
                      </div>
                      {presetConfig.showBillableInCards && (
                        <div className="rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800/50 p-2">
                          <p className="font-sans text-lg font-semibold tabular-nums text-stone-900 dark:text-stone-100">{billableLoggedThisWeek.toFixed(1)}h</p>
                          <p className="font-sans text-xs text-stone-500 dark:text-stone-400">Billable</p>
                        </div>
                      )}
                    </>
                  )}
                </section>
                )}

                {/* 3. Main project list (default list view) */}
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 className="font-sans text-sm font-medium text-stone-700 dark:text-stone-300">Projects</h3>
                    {activeProjects.length > 0 && (
                      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter projects">
                        {PROJECT_FILTERS.filter((f) => {
                          if (f.id === 'billable' || f.id === 'non_billable') return presetConfig.showBillableInCards;
                          if (f.id === 'waiting_on_client') return presetConfig.showWaitingOnClientInCards;
                          return true;
                        }).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setProjectFilter(f.id)}
                            className={`px-2 py-1 rounded text-xs font-sans transition-colors ${
                              projectFilter === f.id
                                ? 'bg-moss-600 text-white dark:bg-moss-500'
                                : 'border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {activeProjects.length === 0 ? (
                    <p className="font-sans text-sm text-stone-500 dark:text-stone-400">No projects yet.</p>
                  ) : filteredProjects.length === 0 ? (
                    <p className="font-sans text-sm text-stone-500 dark:text-stone-400">No projects match the current filter.</p>
                  ) : (
                    <ul className="space-y-2">
                      {filteredProjects.map((g) => {
                        const client = getProjectClient(g);
                        const { state: healthState, reason: healthReason } = getProjectHealth(g, healthContext);
                        const next = getNextStepForProject(g);
                        const plannedMins = plannedByGoalId[g.id] ?? 0;
                        const plannedHrs = Math.round((plannedMins / 60) * 10) / 10;
                        const completedMins = loggedByGoalThisWeek[g.id] ?? 0;
                        const completedHrs = Math.round((completedMins / 60) * 10) / 10;
                        const lastTouched = getLastTouchedDate(g.id, logs);
                        const riskScore = getProjectRiskScore(g, healthContext);
                        const riskLabel = riskScore >= 2 ? 'High risk' : riskScore === 1 ? 'Some risk' : 'Low risk';
                        const stuck = healthState === PROJECT_HEALTH_STATES.STUCK;
                        const waiting = isWaitingOnClient(g);
                        const healthBadgeClass =
                          healthState === PROJECT_HEALTH_STATES.OVERDUE || healthState === PROJECT_HEALTH_STATES.AT_RISK
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200'
                            : healthState === PROJECT_HEALTH_STATES.BLOCKED || healthState === PROJECT_HEALTH_STATES.STUCK
                            ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200'
                            : healthState === PROJECT_HEALTH_STATES.UNPLANNED
                            ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200'
                            : 'bg-stone-200 dark:bg-stone-600 text-stone-600 dark:text-stone-300';
                        return (
                          <li key={g.id} ref={g.id === focusGoalId ? focusRowRef : undefined} className={`rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800/50 p-3 ${g.id === focusGoalId ? 'ring-2 ring-moss-500/50 ring-offset-2 dark:ring-offset-stone-900' : ''}`}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-sans text-sm font-medium text-stone-900 dark:text-stone-100">{g.title ?? g._projectName ?? 'Project'}</span>
                                {presetConfig.showClientInCards && client && <span className="ml-2 font-sans text-xs text-stone-500 dark:text-stone-400">({client})</span>}
                                {presetConfig.showBillableInCards && (
                                  <span className="ml-2 font-sans text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400">
                                    {isProjectBillable(g) ? 'Billable' : 'Non-billable'}
                                  </span>
                                )}
                                {presetConfig.showWaitingOnClientInCards && waiting && (
                                  <span className="ml-1.5 font-sans text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" title="Waiting on client">
                                    Waiting
                                  </span>
                                )}
                              </div>
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-sans ${healthBadgeClass}`} title={`${healthReason}. ${riskLabel}.`}>
                                {getProjectHealthLabel(healthState)}
                              </span>
                            </div>
                            <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-0.5" title={healthReason}>
                              {healthReason}
                            </p>
                            {(healthState === PROJECT_HEALTH_STATES.BLOCKED || healthState === PROJECT_HEALTH_STATES.STUCK) && presetConfig.showBlockedReasonInCards && g._blockedReason && (
                              <p className="font-sans text-xs text-rose-600 dark:text-rose-400 mt-0.5">Blocked: {String(g._blockedReason).trim()}</p>
                            )}
                            <p className="font-sans text-xs text-stone-600 dark:text-stone-400 mt-1">
                              {next ? `Next: ${next.title}${next.suggestedMinutes != null ? ` (~${next.suggestedMinutes} min)` : ''}` : 'No next step'}
                              {stuck && <span className="ml-1 text-rose-600 dark:text-rose-400">· Stuck</span>}
                            </p>
                            {g._projectDeadline && (
                              <p className="font-sans text-xs text-stone-500 dark:text-stone-400">
                                Due {formatDeadline(g._projectDeadline)}
                                {daysUntilDeadline(g._projectDeadline) !== null && (
                                  <span className={daysUntilDeadline(g._projectDeadline) < 0 ? ' text-amber-600 dark:text-amber-400' : ''}>
                                    {' '}({daysUntilDeadline(g._projectDeadline) < 0 ? 'overdue' : `${daysUntilDeadline(g._projectDeadline)} days left`})
                                  </span>
                                )}
                              </p>
                            )}
                            {(presetConfig.showHoursPlannedCompletedInCards || lastTouched !== null) && (
                              <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                                {presetConfig.showHoursPlannedCompletedInCards && <>This week: {plannedHrs}h planned · {completedHrs}h completed</>}
                                {presetConfig.showHoursPlannedCompletedInCards && lastTouched !== null && ' · '}
                                {lastTouched !== null && `Touched ${formatLastTouched(lastTouched, today)}`}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {typeof onStartFocus === 'function' && next && (
                                <button type="button" onClick={() => onStartFocus({ goal: g, minutes: next.suggestedMinutes ?? 15, subtaskId: next.subtaskId ?? null })} className="px-2 py-1 rounded text-xs font-sans bg-moss-100 dark:bg-moss-900/40 text-moss-700 dark:text-moss-300 hover:bg-moss-200 dark:hover:bg-moss-800">Start</button>
                              )}
                              {typeof onReschedule === 'function' && (
                                <button type="button" onClick={() => onReschedule({ goal: g, nextStep: next })} className="px-2 py-1 rounded text-xs font-sans border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800" title="Schedule or reschedule">Schedule</button>
                              )}
                              {typeof addSubtask === 'function' && (
                                <button type="button" onClick={() => { setQuickAddGoal(g); setQuickAddTitle(''); }} className="px-2 py-1 rounded text-xs font-sans border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800">Add task</button>
                              )}
                              {typeof onEditGoal === 'function' && (
                                <button type="button" onClick={() => { onEditGoal(g); onClose?.(); }} className="px-2 py-1 rounded text-xs font-sans border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800">Review</button>
                              )}
                              {typeof editGoal === 'function' && (
                                <button type="button" onClick={() => { setBlockGoal(g); setBlockChecked(g._blocked === true); setBlockReason(g._blockedReason || ''); }} className="px-2 py-1 rounded text-xs font-sans border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800">Mark blocked</button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                {/* 4. Needs attention panel — shown/hidden by preset */}
                {presetConfig.showNeedsAttention && (
                <section className="rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50/50 dark:bg-stone-800/30 p-4">
                  <h3 className="font-sans text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">Needs attention</h3>
                  <ul className="space-y-1.5 font-sans text-sm text-stone-700 dark:text-stone-300">
                    {needsAttention.noNextStep.length > 0 && (
                      <li>No next step: {needsAttention.noNextStep.map((x) => x.label).join(', ')}</li>
                    )}
                    {needsAttention.overdueUnscheduled.length > 0 && (
                      <li>Overdue unscheduled: {needsAttention.overdueUnscheduled.map((x) => x.label).join(', ')}</li>
                    )}
                    {needsAttention.deadlineRisk.length > 0 && needsAttention.overdueUnscheduled.length === 0 && (
                      <li>Deadline risk: {needsAttention.deadlineRisk.map((x) => x.label).join(', ')}</li>
                    )}
                    {needsAttention.notTouchedRecently.length > 0 && (
                      <li>Not touched recently: {needsAttention.notTouchedRecently.map((x) => x.label).join(', ')}</li>
                    )}
                    {needsAttention.overplannedWeek && <li>Overplanned week</li>}
                    {needsAttention.noNextStep.length === 0 && needsAttention.overdueUnscheduled.length === 0 && needsAttention.deadlineRisk.length === 0 && needsAttention.notTouchedRecently.length === 0 && !needsAttention.overplannedWeek && (
                      <li className="text-stone-500 dark:text-stone-400">Nothing flagged.</li>
                    )}
                  </ul>
                </section>
                )}

                {/* 5. Week capacity panel — available, planned, remaining, overload warning, planned vs completed trend */}
                {presetConfig.showWeekCapacity && (
                <section className={`rounded-xl border p-4 ${weekCapacity.overload ? 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/20' : 'border-stone-200 dark:border-stone-600 bg-stone-50/50 dark:bg-stone-800/30'}`} aria-label="Week capacity">
                  <h3 className="font-sans text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">Week capacity</h3>
                  {weekCapacity.overload && (
                    <p className="font-sans text-sm font-medium text-amber-700 dark:text-amber-300 mb-3">Week is overplanned. Planned time exceeds available hours — consider moving work or reducing scope.</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-sans text-sm">
                    <div>
                      <p className="text-stone-500 dark:text-stone-400">Available</p>
                      <p className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">{weekCapacity.availableHours.toFixed(1)}h</p>
                    </div>
                    <div>
                      <p className="text-stone-500 dark:text-stone-400">Planned</p>
                      <p className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">{weekCapacity.plannedHours.toFixed(1)}h</p>
                    </div>
                    <div>
                      <p className="text-stone-500 dark:text-stone-400">Remaining</p>
                      <p className={`font-semibold tabular-nums ${weekCapacity.remainingHours < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-stone-900 dark:text-stone-100'}`}>{weekCapacity.remainingHours.toFixed(1)}h</p>
                    </div>
                    <div>
                      <p className="text-stone-500 dark:text-stone-400">Done this week</p>
                      <p className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">{weekCapacity.completedThisWeek.toFixed(1)}h</p>
                    </div>
                  </div>
                  {presetConfig.showBillableInCards && (weekCapacity.billablePlanned > 0 || weekCapacity.nonBillablePlanned > 0) && (
                    <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-600">
                      <p className="text-stone-500 dark:text-stone-400 text-xs">Planned: {weekCapacity.billablePlanned.toFixed(1)}h billable · {weekCapacity.nonBillablePlanned.toFixed(1)}h non-billable</p>
                      {typeof weekCapacity.billableCompleted === 'number' && weekCapacity.billableCompleted > 0 && (
                        <p className="text-stone-500 dark:text-stone-400 text-xs mt-0.5">Done (billable): {weekCapacity.billableCompleted.toFixed(1)}h</p>
                      )}
                    </div>
                  )}
                </section>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={goToCreate}
                    className="font-sans text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded px-1 py-0.5"
                  >
                    + Add project
                  </button>
                </div>
                </>
                )}
              </>
            )}

            {view === 'create' && (
          <>
            {sliceError && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 font-sans text-sm text-amber-800">
                {sliceError}
              </div>
            )}
            {view === 'create' && !plan ? (
              <>
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-1">Project name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Launch my portfolio website"
                    className="w-full py-2.5 px-3 rounded-lg border border-stone-200 bg-stone-50 font-sans text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-1">
                    Description <span className="text-stone-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does success look like? Any constraints?"
                    rows={3}
                    className="w-full py-2.5 px-3 rounded-lg border border-stone-200 bg-stone-50 font-sans text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-1">
                    Deadline <span className="text-stone-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-lg border border-stone-200 bg-stone-50 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                  />
                </div>
                {presetConfig.showClientInCards && (
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-1">
                    Client <span className="text-stone-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full py-2.5 px-3 rounded-lg border border-stone-200 bg-stone-50 font-sans text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                  />
                </div>
                )}
                {presetConfig.showBillableInCards && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="project-billable"
                    checked={billable}
                    onChange={(e) => setBillable(e.target.checked)}
                    className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50"
                  />
                  <label htmlFor="project-billable" className="font-sans text-sm text-stone-600">Billable</label>
                </div>
                )}
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-1">
                    Belongs to goal <span className="text-stone-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={parentGoalId}
                    onChange={(e) => setParentGoalId(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-lg border border-stone-200 bg-stone-50 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                    aria-label="Link this project to a skill goal"
                  >
                    <option value="">None</option>
                    {skillGoals(goals).map((g) => (
                      <option key={g.id} value={g.id}>{g.title ?? 'Goal'}</option>
                    ))}
                  </select>
                  <p className="font-sans text-xs text-stone-500 mt-0.5">e.g. &quot;Learn to code&quot; — this project will count toward that goal.</p>
                </div>
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-1">Current Skill Level</label>
                  <select
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-lg border border-stone-200 bg-stone-50 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="expert">Expert</option>
                  </select>
                  <p className="font-sans text-xs text-stone-500 mt-0.5">Subtasks will be sized to match. Experts get 1–2 hour milestones.</p>
                </div>
              </>
            ) : (
              <>
                {plan.summary && (
                  <div className="p-3 rounded-lg bg-moss-50 border border-moss-200">
                    <p className="font-sans text-sm text-moss-800">{plan.summary}</p>
                    {plan.totalWeeks && (
                      <p className="font-sans text-xs text-moss-600 mt-1">
                        Estimated timeline: {plan.totalWeeks} weeks
                      </p>
                    )}
                    {plan.mochiFeedback && (
                      <div className="mt-3 pt-3 border-t border-moss-200/60">
                        <p className="font-sans text-sm text-moss-700">
                          {plan.mochiFeedback}
                        </p>
                      </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-stone-200">
                      <label className="text-xs font-sans font-medium text-stone-600 block mb-2">Need changes? Describe what to add or change:</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="e.g., &quot;Add a testing phase&quot; or &quot;Make it 2 weeks shorter&quot;"
                          className="flex-1 text-sm py-2 px-3 rounded-lg border border-stone-200 focus:ring-2 focus:ring-moss-500 focus:border-moss-500 bg-white font-sans text-stone-900 placeholder-stone-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleGeneratePlan(feedback)}
                          disabled={isSlicing}
                          className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                        >
                          Refine
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {plan.phases?.map((phase, pi) => (
                  <div key={pi} className="rounded-xl border border-stone-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
                      <h4 className="font-serif text-stone-900 text-sm font-medium">{phase.title}</h4>
                      <p className="font-sans text-xs text-stone-500">{phase.weekRange}</p>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {phase.tasks?.map((task, ti) => {
                        const isSelected = selectedTasks.has(task.title);
                        const existingLink = linkedGoals[task.title];
                        const linkedGoal = existingLink ? goals.find((g) => g.id === existingLink) : null;
                        return (
                          <div key={ti} className="flex items-start gap-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTask(task.title)}
                              className="mt-0.5 rounded border-stone-300 text-moss-500 focus:ring-moss-500/50"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-sans text-sm text-stone-800">{task.title}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                                    task.type === 'routine'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-moss-100 text-moss-700'
                                  }`}
                                >
                                  {task.type === 'routine' ? 'Routine' : 'Task'}
                                </span>
                              </div>
                              <span className="font-sans text-xs text-stone-400">
                                {task.estimatedHours}h estimated
                              </span>
                              {linkedGoal && (
                                <span className="block font-sans text-xs text-sky-600 mt-0.5">
                                  Linked to: {linkedGoal.title}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {phase.milestone && (
                        <div className="mt-2 pt-2 border-t border-stone-100">
                          <span className="font-sans text-xs text-stone-500">Milestone: </span>
                          <span className="font-sans text-xs text-stone-700 font-medium">
                            {phase.milestone}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <p className="font-sans text-xs text-stone-400">
                  Uncheck tasks you want to skip. One goal will be created with these as milestones and subtasks. Linked tasks are omitted.
                </p>
              </>
            )}
          </>
            )}

          </div>

          {/* Quick add subtask — compact flow, no full editor */}
          {quickAddGoal && (
            <div className="absolute inset-0 z-10 flex items-end justify-center bg-stone-900/20 rounded-2xl" onClick={() => setQuickAddGoal(null)}>
              <div className="w-full max-w-md bg-white dark:bg-stone-800 rounded-t-2xl border border-stone-200 dark:border-stone-600 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h4 className="font-sans text-sm font-medium text-stone-800 dark:text-stone-200 mb-2">Add next step</h4>
                <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mb-2">{quickAddGoal.title ?? quickAddGoal._projectName ?? 'Project'}</p>
                <input type="text" value={quickAddTitle} onChange={(e) => setQuickAddTitle(e.target.value)} placeholder="Task title" className="w-full py-2 px-3 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 font-sans text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 mb-2" autoFocus />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setQuickAddGoal(null)} className="px-3 py-1.5 rounded-lg font-sans text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700">Cancel</button>
                  <button type="button" onClick={() => { if (quickAddTitle.trim() && addSubtask) { addSubtask(quickAddGoal.id, { title: quickAddTitle.trim(), estimatedHours: 0.5 }); setQuickAddGoal(null); setQuickAddTitle(''); } }} disabled={!quickAddTitle.trim()} className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-50">Add</button>
                </div>
              </div>
            </div>
          )}

          {/* Mark blocked — fast inline block toggle + reason */}
          {blockGoal && (
            <div className="absolute inset-0 z-10 flex items-end justify-center bg-stone-900/20 rounded-2xl" onClick={() => setBlockGoal(null)}>
              <div className="w-full max-w-md bg-white dark:bg-stone-800 rounded-t-2xl border border-stone-200 dark:border-stone-600 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h4 className="font-sans text-sm font-medium text-stone-800 dark:text-stone-200 mb-2">Blocked?</h4>
                <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mb-2">{blockGoal.title ?? blockGoal._projectName ?? 'Project'}</p>
                <label className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={blockChecked} onChange={(e) => setBlockChecked(e.target.checked)} className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50" />
                  <span className="font-sans text-sm text-stone-700 dark:text-stone-300">Mark as blocked</span>
                </label>
                <input type="text" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Reason (optional)" className="w-full py-2 px-3 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 font-sans text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 mb-2" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setBlockGoal(null)} className="px-3 py-1.5 rounded-lg font-sans text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700">Cancel</button>
                  <button type="button" onClick={() => { if (editGoal) { editGoal(blockGoal.id, { _blocked: blockChecked, _blockedReason: blockReason.trim() || undefined }); setBlockGoal(null); setBlockReason(''); } }} className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700">Save</button>
                </div>
              </div>
            </div>
          )}

          {view === 'create' && (
          <div className="px-6 py-4 border-t border-stone-100 flex gap-2">
            {!plan ? (
              <>
                <button
                  type="button"
                  onClick={goToDashboard}
                  className="px-4 py-2.5 rounded-lg border border-stone-200 font-sans text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => handleGeneratePlan()}
                  disabled={!name.trim() || isSlicing}
                  className="flex-1 py-2.5 rounded-lg bg-moss-600 text-white font-sans text-sm font-medium hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSlicing ? 'Generating…' : 'Generate plan'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setPlan(null); setSliceError(null); }}
                  className="px-4 py-2.5 rounded-lg border border-stone-200 font-sans text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Back to form
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex-1 py-2.5 rounded-lg bg-moss-600 text-white font-sans text-sm font-medium hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? 'Creating…' : 'Create project'}
                </button>
              </>
            )}
          </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
