/**
 * Action-first project detail: header → next action → week plan → task list (grouped) → notes.
 * Reduces overwhelm; prioritizes doing over browsing. Reuses next-step and scheduling logic.
 */

import { useMemo, useState } from 'react';
import { useGarden } from '../../context/GardenContext';
import {
  getNextStepForProject,
  getProjectHealth,
  getProjectHealthLabel,
  getProjectEstimatedHours,
  getProjectCompletedHours,
  getProjectClient,
  getPlannedHoursPerProjectThisWeek,
} from '../../services/projectSupportService';
import { getWeekDateStrings, getLoggedMinutesThisWeekByGoal } from '../../services/projectCockpitService';
import { getGoalIdFromAssignment, getAssignmentsForSlot, getDurationMinutesFromAssignment } from '../../services/planAssignmentUtils';

function formatDeadline(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/** Planned minutes per day for this goal (from weekAssignments). */
function getPlannedMinutesByDayForGoal(goalId, weekAssignments, goals) {
  const weekDates = getWeekDateStrings();
  const out = {};
  const safeGoals = Array.isArray(goals) ? goals : [];
  for (const dateStr of weekDates) {
    const dayPlan = weekAssignments?.[dateStr];
    if (!dayPlan || typeof dayPlan !== 'object') {
      out[dateStr] = 0;
      continue;
    }
    let total = 0;
    for (const slotKey of Object.keys(dayPlan)) {
      const assignments = getAssignmentsForSlot(dayPlan, slotKey);
      for (const a of assignments) {
        if (getGoalIdFromAssignment(a) !== goalId) continue;
        total += getDurationMinutesFromAssignment(a, safeGoals, 15);
      }
    }
    out[dateStr] = total;
  }
  return out;
}

/** Group subtasks into Next, Backlog, Waiting/blocked, Recently done. */
function groupSubtasks(goal, nextStep) {
  const subtasks = goal?.subtasks ?? [];
  const nextId = nextStep?.subtaskId ?? null;
  const now = new Date();
  const next = [];
  const backlog = [];
  const waiting = [];
  const done = [];
  for (const st of subtasks) {
    const est = Number(st.estimatedHours) || 0.01;
    const comp = Number(st.completedHours) || 0;
    const completed = est > 0 && comp >= est;
    const overdue = st.deadline && new Date(st.deadline + 'T23:59:59') < now && !completed;
    if (completed) {
      done.push(st);
    } else if (st.id === nextId) {
      next.push(st);
    } else if (overdue) {
      waiting.push(st);
    } else {
      backlog.push(st);
    }
  }
  return { next, backlog, waiting, done };
}

export default function ProjectDetailView({
  goal,
  onClose,
  onStartFocus,
  onReschedule,
  onEditSettings,
  updateSubtask,
}) {
  const { goals, weekAssignments, logs, today } = useGarden();
  const [showNotes, setShowNotes] = useState(false);

  const healthContext = useMemo(
    () => ({ goals: goals ?? [], logs: logs ?? [], weekAssignments: weekAssignments ?? {} }),
    [goals, logs, weekAssignments]
  );

  const { state: healthState, reason: healthReason } = useMemo(
    () => getProjectHealth(goal, healthContext),
    [goal, healthContext]
  );

  const nextStep = useMemo(() => getNextStepForProject(goal), [goal]);
  const plannedThisWeekRows = useMemo(
    () => getPlannedHoursPerProjectThisWeek(weekAssignments ?? {}, goals ?? []),
    [weekAssignments, goals]
  );
  const plannedMinutesThisWeek = useMemo(() => {
    const row = plannedThisWeekRows.find((r) => r.goalId === goal?.id);
    return row ? row.minutes : 0;
  }, [plannedThisWeekRows, goal?.id]);

  const weekDateStrings = useMemo(() => getWeekDateStrings(), []);
  const loggedByGoal = useMemo(() => getLoggedMinutesThisWeekByGoal(logs, weekDateStrings), [logs, weekDateStrings]);
  const completedMinutesThisWeek = useMemo(() => loggedByGoal[goal?.id] ?? 0, [loggedByGoal, goal?.id]);

  const plannedByDay = useMemo(
    () => getPlannedMinutesByDayForGoal(goal?.id, weekAssignments ?? {}, goals ?? []),
    [goal?.id, weekAssignments, goals]
  );

  const estimatedTotal = useMemo(() => getProjectEstimatedHours(goal), [goal]);
  const completedTotal = useMemo(() => getProjectCompletedHours(goal), [goal]);
  const remainingEstimate = Math.max(0, estimatedTotal - completedTotal);

  const { next: nextTasks, backlog, waiting, done } = useMemo(
    () => groupSubtasks(goal, nextStep),
    [goal, nextStep]
  );

  const client = getProjectClient(goal);
  const hasNotes = goal?.notes && String(goal.notes).trim().length > 0;

  if (!goal) return null;

  const handleMarkDone = () => {
    if (!nextStep?.subtaskId || !updateSubtask || !goal?.id) return;
    const st = (goal.subtasks ?? []).find((s) => s.id === nextStep.subtaskId);
    if (!st) return;
    const est = Number(st.estimatedHours) || 0.25;
    updateSubtask(goal.id, nextStep.subtaskId, { completedHours: est });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Project header */}
      <header className="border-b border-stone-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100">
            {goal.title ?? goal._projectName ?? 'Project'}
          </h2>
          <span
            className="shrink-0 px-2 py-0.5 rounded text-xs font-sans bg-stone-200 dark:bg-stone-600 text-stone-700 dark:text-stone-300"
            title={healthReason}
          >
            {getProjectHealthLabel(healthState)}
          </span>
        </div>
        {client && (
          <p className="font-sans text-sm text-stone-500 dark:text-stone-400 mt-0.5">{client}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 font-sans text-xs text-stone-500 dark:text-stone-400">
          {goal._projectDeadline && (
            <span>Due {formatDeadline(goal._projectDeadline)}</span>
          )}
          <span>{(plannedMinutesThisWeek / 60).toFixed(1)}h planned this week</span>
          <span>{(completedMinutesThisWeek / 60).toFixed(1)}h done this week</span>
        </div>
      </header>

      {/* 2. Immediate next action block */}
      <section className="rounded-xl border-2 border-moss-200 dark:border-moss-700 bg-moss-50/50 dark:bg-moss-900/20 p-4">
        <h3 className="font-sans text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">Next action</h3>
        {nextStep ? (
          <>
            <p className="font-sans text-base font-medium text-stone-900 dark:text-stone-100">
              {nextStep.title}
            </p>
            {nextStep.suggestedMinutes != null && (
              <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                ~{nextStep.suggestedMinutes} min
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {typeof onStartFocus === 'function' && (
                <button
                  type="button"
                  onClick={() => onStartFocus({ goal, minutes: nextStep.suggestedMinutes ?? 15, subtaskId: nextStep.subtaskId ?? null })}
                  className="px-4 py-2 rounded-lg bg-moss-600 text-white font-sans text-sm font-medium hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                >
                  Start focus
                </button>
              )}
              {updateSubtask && nextStep.subtaskId && (
                <button
                  type="button"
                  onClick={handleMarkDone}
                  className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 font-sans text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                >
                  Mark done
                </button>
              )}
              <button
                type="button"
                onClick={() => onEditSettings?.()}
                className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 font-sans text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                title="Break down or edit task"
              >
                Break down
              </button>
              {typeof onReschedule === 'function' && (
                <button
                  type="button"
                  onClick={() => onReschedule({ goal, nextStep })}
                  className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 font-sans text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                >
                  Reschedule
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="font-sans text-sm text-stone-500 dark:text-stone-400">
              No next step. Add or complete tasks to unblock.
            </p>
            {typeof onEditSettings === 'function' && (
              <button
                type="button"
                onClick={onEditSettings}
                className="mt-2 px-4 py-2 rounded-lg border border-moss-400 dark:border-moss-600 font-sans text-sm text-moss-700 dark:text-moss-300 hover:bg-moss-50 dark:hover:bg-moss-900/30 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                Edit project & tasks
              </button>
            )}
          </>
        )}
      </section>

      {/* 3. This week plan */}
      <section>
        <h3 className="font-sans text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">This week</h3>
        <div className="rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50/50 dark:bg-stone-800/30 p-3 font-sans text-sm">
          <p className="text-stone-700 dark:text-stone-300">
            <strong>{(plannedMinutesThisWeek / 60).toFixed(1)}h</strong> planned
            {Object.keys(plannedByDay).some((d) => plannedByDay[d] > 0) && (
              <span className="text-stone-500 dark:text-stone-400 ml-1">
                ({Object.entries(plannedByDay)
                  .filter(([, m]) => m > 0)
                  .map(([d, m]) => `${d.slice(5)} ${(m / 60).toFixed(1)}h`)
                  .join(', ')})
              </span>
            )}
          </p>
          <p className="text-stone-600 dark:text-stone-400 mt-0.5">
            {remainingEstimate > 0 ? `${remainingEstimate.toFixed(1)}h remaining` : 'No remaining estimate'} · {completedTotal.toFixed(1)}h done total
          </p>
        </div>
      </section>

      {/* 4. Task list grouped */}
      <section>
        <h3 className="font-sans text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">Tasks</h3>
        <div className="space-y-4">
          {plannedMinutesThisWeek > 0 && (
            <div>
              <p className="font-sans text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1.5">Planned</p>
              <p className="font-sans text-sm text-stone-600 dark:text-stone-400 py-1">
                {(plannedMinutesThisWeek / 60).toFixed(1)}h this week
                {Object.entries(plannedByDay).filter(([, m]) => m > 0).length > 0 && (
                  <span className="text-stone-400 dark:text-stone-500 ml-1">
                    ({Object.entries(plannedByDay)
                      .filter(([, m]) => m > 0)
                      .map(([d, m]) => `${d.slice(5)} ${(m / 60).toFixed(1)}h`)
                      .join(', ')})
                  </span>
                )}
              </p>
            </div>
          )}
          {nextTasks.length > 0 && (
            <div>
              <p className="font-sans text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1.5">Next</p>
              <ul className="space-y-1">
                {nextTasks.map((st) => (
                  <li key={st.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-moss-50 dark:bg-moss-900/20 border border-moss-200/60 dark:border-moss-800 font-sans text-sm text-stone-800 dark:text-stone-200">
                    <span className="w-4 h-4 rounded border-2 border-moss-500 shrink-0" aria-hidden />
                    {st.title}
                    <span className="text-stone-500 dark:text-stone-400 text-xs">{(Number(st.estimatedHours) || 0).toFixed(1)}h</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {backlog.length > 0 && (
            <div>
              <p className="font-sans text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1.5">Backlog</p>
              <ul className="space-y-1">
                {backlog.map((st) => {
                  const est = Number(st.estimatedHours) || 0;
                  const comp = Number(st.completedHours) || 0;
                  return (
                    <li key={st.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-stone-50 dark:bg-stone-800/50 font-sans text-sm">
                      {updateSubtask && (
                        <input
                          type="checkbox"
                          checked={est > 0 && comp >= est}
                          onChange={() => updateSubtask(goal.id, st.id, { completedHours: comp >= est ? 0 : est })}
                          className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50 w-4 h-4 shrink-0"
                          aria-label={`Mark "${st.title}" done`}
                        />
                      )}
                      <span className="text-stone-700 dark:text-stone-300">{st.title}</span>
                      <span className="text-stone-400 dark:text-stone-500 text-xs">{comp.toFixed(1)}h / {est.toFixed(1)}h</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {waiting.length > 0 && (
            <div>
              <p className="font-sans text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5">Waiting / blocked</p>
              <ul className="space-y-1">
                {waiting.map((st) => (
                  <li key={st.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800 font-sans text-sm text-stone-700 dark:text-stone-300">
                    <span className="w-4 h-4 rounded border border-amber-500 shrink-0" aria-hidden />
                    {st.title}
                    {st.deadline && <span className="text-amber-600 dark:text-amber-400 text-xs">Overdue {st.deadline}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <p className="font-sans text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1.5">Recently done</p>
              <ul className="space-y-1">
                {done.slice(0, 10).map((st) => (
                  <li key={st.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg font-sans text-sm text-stone-400 dark:text-stone-500 line-through">
                    <span className="w-4 h-4 rounded bg-moss-500 text-white flex items-center justify-center text-[10px] shrink-0">✓</span>
                    {st.title}
                  </li>
                ))}
                {done.length > 10 && <p className="font-sans text-xs text-stone-400 pl-6">+{done.length - 10} more</p>}
              </ul>
            </div>
          )}
          {nextTasks.length === 0 && backlog.length === 0 && waiting.length === 0 && done.length === 0 && (
            <p className="font-sans text-sm text-stone-500 dark:text-stone-400">No tasks yet.</p>
          )}
        </div>
      </section>

      {/* 5. Notes / context (progressive disclosure) */}
      {hasNotes && (
        <section>
          <button
            type="button"
            onClick={() => setShowNotes((p) => !p)}
            className="font-sans text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded px-1 -ml-1"
          >
            {showNotes ? 'Hide notes' : 'Notes & context'}
          </button>
          {showNotes && (
            <div className="mt-2 p-3 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800/30 font-sans text-sm text-stone-600 dark:text-stone-400 whitespace-pre-wrap">
              {goal.notes}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
