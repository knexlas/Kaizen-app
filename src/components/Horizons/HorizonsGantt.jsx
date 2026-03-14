import { useMemo, useState, useCallback } from 'react';
import { useDialog } from '../../context/DialogContext';
/**
 * Parse a range string that may mention 'Week' or 'Day', and return column indices for the current scale.
 * @param {string} rangeStr - e.g. 'Week 1', 'Week 2-4', 'Day 8-10'
 * @param {'days'|'weeks'} scale - Current time scale
 * @param {number} totalCols - Total columns (14 for days, 12 for weeks)
 * @returns {{ start: number, end: number }}
 */
function parseTimeRange(rangeStr, scale, totalCols) {
  if (!rangeStr || typeof rangeStr !== 'string') return { start: 0, end: totalCols - 1 };
  const s = rangeStr.trim();

  const weekMatch = s.match(/Week\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
  const dayMatch = s.match(/Day\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);

  if (scale === 'days' && weekMatch) {
    const w1 = Math.max(1, parseInt(weekMatch[1], 10));
    const w2 = weekMatch[2] ? parseInt(weekMatch[2], 10) : w1;
    const start = (w1 - 1) * 7;
    const end = Math.min(totalCols - 1, w2 * 7 - 1);
    return { start, end: Math.max(start, end) };
  }

  if (scale === 'days' && dayMatch) {
    const d1 = Math.max(0, parseInt(dayMatch[1], 10));
    const d2 = dayMatch[2] ? parseInt(dayMatch[2], 10) : d1;
    const start = Math.min(d1, totalCols - 1);
    const end = Math.min(totalCols - 1, Math.max(d1, d2));
    return { start, end: Math.max(start, end) };
  }

  if (scale === 'weeks' && weekMatch) {
    const w1 = Math.max(1, parseInt(weekMatch[1], 10));
    const w2 = weekMatch[2] ? parseInt(weekMatch[2], 10) : w1;
    const start = Math.min(totalCols - 1, w1 - 1);
    const end = Math.min(totalCols - 1, Math.max(w1, w2) - 1);
    return { start: Math.min(start, end), end };
  }

  if (scale === 'weeks' && dayMatch) {
    const d1 = Math.max(0, parseInt(dayMatch[1], 10));
    const d2 = dayMatch[2] ? parseInt(dayMatch[2], 10) : d1;
    const startWeek = Math.floor(d1 / 7);
    const endWeek = Math.floor(d2 / 7);
    const start = Math.min(totalCols - 1, startWeek);
    const end = Math.min(totalCols - 1, endWeek);
    return { start, end: Math.max(start, end) };
  }

  return { start: 0, end: totalCols - 1 };
}

const TOTAL_DAYS_FALLBACK = 14;
const WEEKS_COLS_FALLBACK = 12;
const MAX_DAYS = 90;
const MAX_WEEKS = 26;

/** Monday of the week that contains the first day of the current month. */
function getFirstWeekMondayOfMonth() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const first = new Date(y, m, 1);
  first.setHours(0, 0, 0, 0);
  const dayOfWeek = first.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? -6 : dayOfWeek === 1 ? 0 : 1 - dayOfWeek;
  const monday = new Date(first);
  monday.setDate(first.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Number of weeks that intersect the current month (Mon–Sun). Caps Horizons to current month only. */
function getWeeksInCurrentMonth() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  first.setHours(0, 0, 0, 0);
  last.setHours(23, 59, 59, 999);
  const monday = getFirstWeekMondayOfMonth();
  let weeks = 0;
  let weekStart = new Date(monday.getTime());
  while (weekStart.getTime() <= last.getTime() + 7 * 24 * 60 * 60 * 1000) {
    const weekEnd = new Date(weekStart.getTime());
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd.getTime() >= first.getTime() && weekStart.getTime() <= last.getTime()) weeks++;
    weekStart.setDate(weekStart.getDate() + 7);
    if (weekStart.getTime() > last.getTime()) break;
  }
  return Math.max(1, Math.min(weeks, 6));
}

/** Get project start and end column indices. Uses phases for start, _projectDeadline for end. */
function getProjectWeekRange(goal, timeScale, totalCols) {
  const milestones = goal.milestones || [];
  let startCol = 0;
  let endCol = totalCols - 1;
  if (milestones.length > 0) {
    const starts = milestones.map((m) => parseTimeRange(m.weekRange, timeScale, totalCols).start);
    startCol = Math.min(...starts, startCol);
    const ends = milestones.map((m) => parseTimeRange(m.weekRange, timeScale, totalCols).end);
    endCol = Math.max(...ends, endCol);
  }
  if (goal._projectDeadline && typeof goal._projectDeadline === 'string') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(goal._projectDeadline + 'T12:00:00');
    deadline.setHours(0, 0, 0, 0);
    if (timeScale === 'days') {
      const dayIndex = Math.round((deadline.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      endCol = Math.max(0, Math.min(totalCols - 1, dayIndex));
    } else {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const deadlineMonday = new Date(deadline);
      deadlineMonday.setDate(deadline.getDate() - ((deadline.getDay() + 6) % 7));
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const weekIndex = Math.round((deadlineMonday.getTime() - monday.getTime()) / oneWeekMs);
      endCol = Math.max(0, Math.min(totalCols - 1, weekIndex));
    }
  }
  return { startWeek: startCol, endWeek: endCol };
}

export default function HorizonsGantt({
  goals = [],
  onGoalClick,
  onDeleteGoal,
  onToggleMilestone,
  onUpdateSubtask,
  onEditGoal,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  onAddSubtask,
  onDeleteSubtask,
  onTaskClick,
  onScheduleTask,
}) {
  const { showConfirm, showPrompt } = useDialog();
  const [timeScale, setTimeScale] = useState('weeks'); // 'days' | 'weeks'
  const [expandedPhases, setExpandedPhases] = useState({});
  const [collapsedProjects, setCollapsedProjects] = useState({}); // { [goalId]: true } = project Gantt collapsed
  const togglePhase = (id) => setExpandedPhases((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleProject = (goalId) => setCollapsedProjects((prev) => ({ ...prev, [goalId]: !prev[goalId] }));

  const projectGoals = useMemo(() => goals.filter((g) => g._projectGoal), [goals]);

  /** Furthest deadline among project goals, or null. Used to size the chart. */
  const chartEndDate = useMemo(() => {
    let end = null;
    projectGoals.forEach((g) => {
      const d = g._projectDeadline && typeof g._projectDeadline === 'string' ? new Date(g._projectDeadline + 'T12:00:00') : null;
      if (d && !Number.isNaN(d.getTime()) && (end == null || d.getTime() > end.getTime())) end = d;
    });
    return end;
  }, [projectGoals]);

  const { columnLabels, currentColIndex, totalCols } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneWeekMs = 7 * oneDayMs;

    if (timeScale === 'days') {
      let totalCols;
      if (chartEndDate && chartEndDate.getTime() >= today.getTime()) {
        const daysToEnd = Math.ceil((chartEndDate.getTime() - today.getTime()) / oneDayMs);
        totalCols = Math.max(1, Math.min(MAX_DAYS, daysToEnd));
      } else {
        totalCols = TOTAL_DAYS_FALLBACK;
      }
      const columnLabels = Array.from({ length: totalCols }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
        const dayNum = d.getDate();
        return `${weekday} ${dayNum}`;
      });
      return { columnLabels, currentColIndex: 0, totalCols };
    }

    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    let totalCols;
    if (chartEndDate && chartEndDate.getTime() >= monday.getTime()) {
      const deadlineMonday = new Date(chartEndDate);
      deadlineMonday.setDate(chartEndDate.getDate() - ((chartEndDate.getDay() + 6) % 7));
      deadlineMonday.setHours(0, 0, 0, 0);
      const weeksToEnd = Math.round((deadlineMonday.getTime() - monday.getTime()) / oneWeekMs) + 1;
      totalCols = Math.max(1, Math.min(MAX_WEEKS, weeksToEnd));
    } else {
      totalCols = WEEKS_COLS_FALLBACK;
    }

    let currentColIndex = 0;
    for (let i = 0; i < totalCols; i++) {
      const weekStart = monday.getTime() + i * oneWeekMs;
      if (todayMs >= weekStart && todayMs < weekStart + oneWeekMs) {
        currentColIndex = i;
        break;
      }
    }
    const columnLabels = Array.from({ length: totalCols }, (_, i) => {
      const w = new Date(monday);
      w.setDate(monday.getDate() + i * 7);
      return w.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    return { columnLabels, currentColIndex, totalCols };
  }, [timeScale, chartEndDate]);

  if (projectGoals.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
        <p className="font-sans text-stone-500 text-sm">No projects yet. Use Plan a Project to create one.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-stone-100 border-b border-stone-200 flex items-center justify-between gap-3">
        <span className="font-serif text-stone-900 font-medium text-base">Project timeline</span>
        <div className="flex rounded-lg border border-stone-300 bg-white p-0.5 font-sans text-xs">
          <button
            type="button"
            onClick={() => setTimeScale('days')}
            className={`px-2.5 py-1 rounded-md transition-colors ${timeScale === 'days' ? 'bg-moss-100 text-moss-800 font-medium' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Days
          </button>
          <button
            type="button"
            onClick={() => setTimeScale('weeks')}
            className={`px-2.5 py-1 rounded-md transition-colors ${timeScale === 'weeks' ? 'bg-moss-100 text-moss-800 font-medium' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Weeks
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-sans text-sm" style={{ minWidth: 560 }}>
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-2 px-3 font-medium text-stone-600 w-40 shrink-0">Project / Phase</th>
              {columnLabels.map((label, i) => {
                const isCurrent = i === currentColIndex;
                return (
                  <th
                    key={i}
                    className={`text-center py-1 px-0.5 font-normal text-[10px] w-10 ${isCurrent ? 'bg-moss-50/50 border-l border-r border-moss-200/60' : 'text-stone-400'}`}
                  >
                    {label}
                    {isCurrent && <span className="block text-[9px] text-moss-600 font-medium mt-0.5">Now</span>}
                  </th>
                );
              })}
              <th className="text-left py-2 px-2 font-medium text-stone-500 text-xs w-24">Deadline</th>
              <th className="w-20 shrink-0" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {projectGoals.flatMap((goal) => {
              const rows = [];
              const isProjectCollapsed = !!collapsedProjects[goal.id];
              const isOverdue = goal._projectDeadline && new Date(goal._projectDeadline + 'T23:59:59') < new Date();
              const subtasksAll = goal.subtasks || [];
              const subtaskTotal = subtasksAll.length;
              const subtaskDone = subtasksAll.filter((st) => (st.completedHours ?? 0) >= (st.estimatedHours || 1)).length;
              const progressPct = subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : 0;
              const { startWeek, endWeek } = getProjectWeekRange(goal, timeScale, totalCols);
              const spanWeeks = Math.max(1, endWeek - startWeek + 1);
              const progressEndWeekExact = startWeek + (spanWeeks * progressPct / 100);

              // 1. MASTER PROJECT ROW (clickable to collapse/expand)
              rows.push(
                <tr
                  key={`proj-${goal.id}`}
                  className={`border-b border-stone-200 bg-stone-50/50 cursor-pointer hover:bg-stone-100/70 transition-colors ${isProjectCollapsed ? 'border-b-2 border-stone-200' : ''}`}
                  onClick={() => toggleProject(goal.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleProject(goal.id); } }}
                  aria-expanded={!isProjectCollapsed}
                  aria-label={isProjectCollapsed ? `Expand ${goal.title}` : `Collapse ${goal.title}`}
                >
                  <td className="py-2 px-3 flex items-center gap-2">
                    <span className="text-stone-400 text-xs w-4 shrink-0" aria-hidden>{isProjectCollapsed ? '▶' : '▼'}</span>
                    <span className="font-medium text-stone-800 font-serif truncate max-w-[150px] sm:max-w-[250px] lg:max-w-[350px]" title={goal.title}>{goal.title}</span>
                    {goal.parentGoalId && (() => {
                      const parent = goals.find((g) => g.id === goal.parentGoalId);
                      return parent ? <span className="text-stone-400 text-xs font-normal truncate" title={parent.title}>→ {parent.title}</span> : null;
                    })()}
                    {isProjectCollapsed && (
                      <span className="text-stone-400 text-xs font-normal">({goal.milestones?.length ?? 0} phases)</span>
                    )}
                  </td>
                  {columnLabels.map((_, i) => {
                    const isCurrent = i === currentColIndex;
                    const inRange = i >= startWeek && i <= endWeek;
                    const isFilled = inRange && i < Math.floor(progressEndWeekExact);
                    const isPartial = inRange && i === Math.floor(progressEndWeekExact) && progressEndWeekExact % 1 > 0;
                    const partialPct = isPartial ? (progressEndWeekExact % 1) * 100 : 100;
                    return (
                      <td key={i} className={`p-0 align-middle w-10 ${isCurrent ? 'bg-moss-50/50 border-l border-r border-moss-200/40' : 'bg-stone-50/50 border-l border-white/50'}`}>
                        {inRange ? (
                          <div className="h-2 w-full mx-0 rounded-none bg-stone-200 overflow-hidden" title={`${subtaskDone}/${subtaskTotal} tasks`}>
                            {isFilled ? (
                              <div className="h-full w-full rounded-none bg-moss-500 transition-all" />
                            ) : isPartial ? (
                              <div className="h-full rounded-none bg-moss-500 transition-all" style={{ width: `${partialPct}%` }} />
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-stone-500 text-xs shrink-0">
                    {goal._projectDeadline ? (
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span>{new Date(goal._projectDeadline + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        {isOverdue && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onGoalClick?.(goal); }}
                            className="inline-flex items-center gap-0.5 text-stone-400 hover:text-stone-600 font-normal underline underline-offset-1 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded px-0.5"
                            title="Update deadline or plan in Edit"
                          >
                            🔄 Needs adjusting
                          </button>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 px-2 w-20 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onGoalClick?.(goal); }} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1 rounded bg-stone-100">
                        ✏️ Edit
                      </button>
                      {onDeleteGoal && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            showConfirm({ message: 'Delete this project? This cannot be undone.', confirmLabel: 'Delete', destructive: true, onConfirm: () => onDeleteGoal(goal.id) });
                          }}
                          className="text-xs text-stone-400 hover:text-red-600 px-2 py-1 rounded bg-stone-100"
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );

              // 2. PHASE ROWS (only when project is expanded)
              if (!isProjectCollapsed) {
              (goal.milestones || []).forEach((phase) => {
                const isExpanded = expandedPhases[phase.id];
                const { start: startWeek, end: endWeek } = parseTimeRange(phase.weekRange, timeScale, totalCols);
                const isDone = phase.completed;
                const isActivePhase = currentColIndex >= startWeek && currentColIndex <= endWeek;

                rows.push(
                  <tr
                    key={`ph-${phase.id}`}
                    onClick={() => togglePhase(phase.id)}
                    className={`border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors ${!isActivePhase ? 'opacity-75' : ''}`}
                  >
                    <td className="py-2 px-3 pl-6 flex items-center gap-2 flex-wrap">
                      {onToggleMilestone && (
                        <input
                          type="checkbox"
                          checked={!!isDone}
                          onChange={(e) => { e.stopPropagation(); }}
                          onClick={(e) => { e.stopPropagation(); onToggleMilestone(goal.id, phase.id); }}
                          className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50 shrink-0"
                          aria-label={`Mark phase "${phase.title}" as ${isDone ? 'incomplete' : 'complete'}`}
                        />
                      )}
                      <span className="text-stone-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                      <span className={`font-sans text-sm ${isDone ? 'text-stone-400 line-through' : isActivePhase ? 'text-stone-800' : 'text-stone-500'}`}>{phase.title}</span>
                      {onUpdateMilestone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            showPrompt({ title: 'Phase title', defaultValue: phase.title, submitLabel: 'Save', onSubmit: (title) => { if (title?.trim()) onUpdateMilestone(goal.id, phase.id, { title: title.trim() }); } });
                          }}
                          className="text-stone-400 hover:text-stone-600 text-xs px-1.5 py-0.5 rounded"
                          title="Edit phase"
                        >
                          ✏️
                        </button>
                      )}
                      {onDeleteMilestone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            showConfirm({ message: `Delete phase "${phase.title}"? Tasks in it will be removed.`, confirmLabel: 'Delete', destructive: true, onConfirm: () => onDeleteMilestone(goal.id, phase.id) });
                          }}
                          className="text-stone-400 hover:text-red-600 text-xs px-1.5 py-0.5 rounded"
                          title="Delete phase"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                    {columnLabels.map((_, i) => {
                      const isCurrent = i === currentColIndex;
                      return (
                        <td key={i} className={`py-1 px-0.5 align-middle w-10 ${isCurrent ? 'bg-moss-50/50 border-l border-r border-moss-200/40' : ''}`}>
                          {i >= startWeek && i <= endWeek && (
                            <div className={`h-3 rounded-full ${isDone ? 'bg-stone-300' : isActivePhase ? 'bg-amber-400' : 'bg-stone-300/80'}`} title={isActivePhase ? 'Active' : 'Future'} />
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-stone-400 text-[10px]">{phase.weekRange}</td>
                    <td className="py-2 px-2 w-20">
                      {onUpdateMilestone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            showPrompt({ title: 'Week range', defaultValue: phase.weekRange, placeholder: 'e.g. Week 1-2', submitLabel: 'Save', onSubmit: (weekRange) => { if (weekRange?.trim()) onUpdateMilestone(goal.id, phase.id, { weekRange: weekRange.trim() }); } });
                          }}
                          className="text-[10px] text-stone-400 hover:text-stone-600"
                          title="Edit week range"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );

                // 3. SUBTASK ROWS (If Expanded) — use subtask's own weekRange when set (sequential tasks)
                if (isExpanded) {
                  const subtasks = (goal.subtasks || []).filter((st) => st.phaseId === phase.id);
                  subtasks.forEach((st) => {
                    const stDone = (st.completedHours ?? 0) >= (st.estimatedHours ?? 0);
                    const stWeekRange = st.weekRange || phase.weekRange;
                    const { start: stStartWeek, end: stEndWeek } = parseTimeRange(stWeekRange, timeScale, totalCols);
                    rows.push(
                      <tr
                        key={`st-${st.id}`}
                        className="border-b border-stone-50/50 bg-stone-50/30 hover:bg-stone-100/50"
                        onClick={(e) => { if (onTaskClick && !e.target.closest('button') && !e.target.closest('input')) onTaskClick({ type: 'subtask', goalId: goal.id, subtaskId: st.id }); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (onTaskClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onTaskClick({ type: 'subtask', goalId: goal.id, subtaskId: st.id }); } }}
                      >
                        <td className="py-1.5 px-3 pl-12 flex items-center gap-2">
                          {onUpdateSubtask && (
                            <input
                              type="checkbox"
                              checked={stDone}
                              onChange={(e) => { e.stopPropagation(); }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateSubtask(goal.id, st.id, { completedHours: stDone ? 0 : (st.estimatedHours || 1) });
                              }}
                              className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50 shrink-0"
                              aria-label={`Mark "${st.title}" as ${stDone ? 'incomplete' : 'complete'}`}
                            />
                          )}
                          <span className={`font-sans text-xs ${stDone ? 'text-stone-400 line-through' : 'text-stone-500'}`}>↳ {st.title}</span>
                          {onUpdateSubtask && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                showPrompt({ title: 'Task title', defaultValue: st.title, submitLabel: 'Save', onSubmit: (title) => { if (title?.trim()) onUpdateSubtask(goal.id, st.id, { title: title.trim() }); } });
                              }}
                              className="text-stone-400 hover:text-stone-600 text-[10px]"
                              title="Edit task"
                            >
                              ✏️
                            </button>
                          )}
                          {onDeleteSubtask && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                showConfirm({ message: `Delete "${st.title}"?`, confirmLabel: 'Delete', destructive: true, onConfirm: () => onDeleteSubtask(goal.id, st.id) });
                              }}
                              className="text-stone-400 hover:text-red-600 text-[10px]"
                              title="Delete task"
                            >
                              🗑️
                            </button>
                          )}
                          {onScheduleTask && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onScheduleTask({
                                  type: 'staging-task',
                                  task: {
                                    id: `subtask-${goal.id}-${st.id}`,
                                    title: st.title || 'Task',
                                    goalId: goal.id,
                                    goalTitle: goal.title,
                                    source: 'subtask',
                                    subtaskId: st.id,
                                    estimatedSparks: 2,
                                  },
                                });
                              }}
                              className="text-moss-600 hover:text-moss-700 text-[10px] font-medium"
                              title="Schedule in week"
                            >
                              Schedule
                            </button>
                          )}
                        </td>
                        {columnLabels.map((_, i) => {
                          const isCurrent = i === currentColIndex;
                          return (
                            <td key={i} className={`py-1 px-0.5 align-middle ${isCurrent ? 'bg-moss-50/50 border-l border-r border-moss-200/40' : ''}`}>
                              {i >= stStartWeek && i <= stEndWeek && (
                                <div className="h-0.5 w-full bg-stone-200" />
                              )}
                            </td>
                          );
                        })}
                        <td className="py-1.5 px-2 text-stone-400 text-[10px]">{st.estimatedHours}h{stWeekRange !== phase.weekRange ? ` · ${stWeekRange}` : ''}</td>
                        <td className="py-1.5 px-2 w-20" />
                      </tr>
                    );
                  });
                  if (onAddSubtask) {
                    rows.push(
                      <tr key={`add-st-${phase.id}`} className="border-b border-stone-50/50 bg-stone-50/20">
                        <td className="py-1.5 px-3 pl-12">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              showPrompt({ title: 'New task', defaultValue: 'New task', submitLabel: 'Add', onSubmit: (title) => { if (title?.trim()) onAddSubtask(goal.id, { title: title.trim(), estimatedHours: 1, phaseId: phase.id, weekRange: phase.weekRange }); } });
                            }}
                            className="text-xs text-moss-600 hover:text-moss-700 font-medium"
                          >
                            + Add task
                          </button>
                        </td>
                        {columnLabels.map((_, i) => <td key={i} className="py-1 px-0.5" />)}
                        <td colSpan={2} className="py-1.5 px-2" />
                      </tr>
                    );
                  }
                }
              });
              if (onAddMilestone) {
                rows.push(
                  <tr key={`add-ms-${goal.id}`} className="border-b border-stone-100 bg-stone-50/30">
                    <td className="py-2 px-3 pl-6">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onAddMilestone(goal.id, { title: 'New phase', weekRange: `Week ${(goal.milestones?.length ?? 0) + 1}` }); }}
                        className="text-xs text-moss-600 hover:text-moss-700 font-medium"
                      >
                        + Add phase
                      </button>
                    </td>
                    {columnLabels.map((_, i) => <td key={i} className="py-1 px-0.5" />)}
                    <td colSpan={2} className="py-2 px-2" />
                  </tr>
                );
              }
              }

              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
