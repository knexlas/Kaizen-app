import { useMemo, useState } from 'react';

function parseWeekRange(weekRangeStr, totalWeeks = 14) {
  if (!weekRangeStr || typeof weekRangeStr !== 'string') return { start: 0, end: totalWeeks - 1 };
  const m = weekRangeStr.trim().match(/Week\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
  if (!m) return { start: 0, end: totalWeeks - 1 };
  const start = Math.max(0, parseInt(m[1], 10) - 1);
  const end = m[2] ? Math.min(totalWeeks - 1, parseInt(m[2], 10) - 1) : start;
  return { start: Math.min(start, end), end };
}

const TOTAL_WEEKS = 14;

export default function HorizonsGantt({
  goals = [],
  onGoalClick,
  onDeleteGoal,
  onToggleMilestone,
  onUpdateSubtask,
}) {
  const [expandedPhases, setExpandedPhases] = useState({});
  const togglePhase = (id) => setExpandedPhases((prev) => ({ ...prev, [id]: !prev[id] }));

  const projectGoals = useMemo(() => goals.filter((g) => g._projectGoal), [goals]);

  const { weekLabels, currentWeekIndex } = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const mondayMs = monday.getTime();
    const todayMs = today.getTime();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    let currentWeekIndex = 0;
    for (let i = 0; i < TOTAL_WEEKS; i++) {
      const weekStart = mondayMs + i * oneWeekMs;
      if (todayMs >= weekStart && todayMs < weekStart + oneWeekMs) {
        currentWeekIndex = i;
        break;
      }
    }
    const weekLabels = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
      const w = new Date(monday);
      w.setDate(monday.getDate() + i * 7);
      return w.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    return { weekLabels, currentWeekIndex };
  }, []);

  if (projectGoals.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
        <p className="font-sans text-stone-500 text-sm">No projects yet. Use Plan a Project to create one.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-stone-100 border-b border-stone-200 font-serif text-stone-900 font-medium text-base">
        Project timeline
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-sans text-sm" style={{ minWidth: 560 }}>
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-2 px-3 font-medium text-stone-600 w-40 shrink-0">Project / Phase</th>
              {weekLabels.map((label, i) => {
                const isCurrentWeek = i === currentWeekIndex;
                return (
                  <th
                    key={i}
                    className={`text-center py-1 px-0.5 font-normal text-[10px] w-10 ${isCurrentWeek ? 'bg-moss-50/50 border-l border-r border-moss-200/60' : 'text-stone-400'}`}
                  >
                    {label}
                    {isCurrentWeek && <span className="block text-[9px] text-moss-600 font-medium mt-0.5">Now</span>}
                  </th>
                );
              })}
              <th className="text-left py-2 px-2 font-medium text-stone-500 text-xs w-24">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {projectGoals.flatMap((goal) => {
              const rows = [];
              const isOverdue = goal._projectDeadline && new Date(goal._projectDeadline + 'T23:59:59') < new Date();
              const subtasksAll = goal.subtasks || [];
              const subtaskTotal = subtasksAll.length;
              const subtaskDone = subtasksAll.filter((st) => (st.completedHours ?? 0) >= (st.estimatedHours || 1)).length;
              const progressPct = subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : 0;

              // 1. MASTER PROJECT ROW
              rows.push(
                <tr key={`proj-${goal.id}`} className="border-b border-stone-200 bg-stone-50/50">
                  <td className="py-2 px-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-medium text-stone-800 font-serif truncate">{goal.title}</span>
                      {subtaskTotal > 0 && (
                        <div className="shrink-0 w-16 h-1.5 rounded-full bg-stone-200 overflow-hidden" title={`${subtaskDone}/${subtaskTotal} tasks`}>
                          <div className="h-full rounded-full bg-moss-500 transition-all" style={{ width: `${progressPct}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onGoalClick?.(goal); }} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1 rounded bg-stone-100">
                        ✏️ Edit
                      </button>
                      {onDeleteGoal && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this project? This cannot be undone.')) onDeleteGoal(goal.id);
                          }}
                          className="text-xs text-stone-400 hover:text-red-600 px-2 py-1 rounded bg-stone-100"
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </td>
                  {weekLabels.map((_, i) => {
                    const isCurrentWeek = i === currentWeekIndex;
                    return (
                      <td key={i} className={`bg-stone-50/50 border-l border-white/50 ${isCurrentWeek ? 'bg-moss-50/50 border-l border-r border-moss-200/40' : ''}`} />
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
                </tr>
              );

              // 2. PHASE ROWS
              (goal.milestones || []).forEach((phase) => {
                const isExpanded = expandedPhases[phase.id];
                const { start: startWeek, end: endWeek } = parseWeekRange(phase.weekRange, TOTAL_WEEKS);
                const isDone = phase.completed;

                rows.push(
                  <tr key={`ph-${phase.id}`} onClick={() => togglePhase(phase.id)} className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors">
                    <td className="py-2 px-3 pl-6 flex items-center gap-2">
                      {onToggleMilestone && (
                        <input
                          type="checkbox"
                          checked={!!isDone}
                          onChange={(e) => { e.stopPropagation(); }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleMilestone(goal.id, phase.id);
                          }}
                          className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50 shrink-0"
                          aria-label={`Mark phase "${phase.title}" as ${isDone ? 'incomplete' : 'complete'}`}
                        />
                      )}
                      <span className="text-stone-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                      <span className={`font-sans text-sm ${isDone ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{phase.title}</span>
                    </td>
                    {weekLabels.map((_, i) => {
                      const isCurrentWeek = i === currentWeekIndex;
                      return (
                        <td key={i} className={`py-1 px-0.5 align-middle w-10 ${isCurrentWeek ? 'bg-moss-50/50 border-l border-r border-moss-200/40' : ''}`}>
                          {i >= startWeek && i <= endWeek && (
                            <div className={`h-3 rounded-full ${isDone ? 'bg-stone-300' : 'bg-amber-300'}`} />
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-stone-400 text-[10px]">{phase.weekRange}</td>
                  </tr>
                );

                // 3. SUBTASK ROWS (If Expanded) — use subtask's own weekRange when set (sequential tasks)
                if (isExpanded) {
                  const totalWeeks = Math.max(1, Number(goal._projectTotalWeeks) || TOTAL_WEEKS);
                  const subtasks = (goal.subtasks || []).filter((st) => st.phaseId === phase.id);
                  subtasks.forEach((st) => {
                    const stDone = (st.completedHours ?? 0) >= (st.estimatedHours ?? 0);
                    const stWeekRange = st.weekRange || phase.weekRange;
                    const { start: stStartWeek, end: stEndWeek } = parseWeekRange(stWeekRange, totalWeeks);
                    rows.push(
                      <tr key={`st-${st.id}`} className="border-b border-stone-50/50 bg-stone-50/30">
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
                        </td>
                        {weekLabels.map((_, i) => {
                          const isCurrentWeek = i === currentWeekIndex;
                          return (
                            <td key={i} className={`py-1 px-0.5 align-middle ${isCurrentWeek ? 'bg-moss-50/50 border-l border-r border-moss-200/40' : ''}`}>
                              {i >= stStartWeek && i <= stEndWeek && (
                                <div className="h-0.5 w-full bg-stone-200" />
                              )}
                            </td>
                          );
                        })}
                        <td className="py-1.5 px-2 text-stone-400 text-[10px]">{st.estimatedHours}h{stWeekRange !== phase.weekRange ? ` · ${stWeekRange}` : ''}</td>
                      </tr>
                    );
                  });
                }
              });

              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
