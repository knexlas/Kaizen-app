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

export default function HorizonsGantt({ goals = [], onGoalClick }) {
  const [expandedPhases, setExpandedPhases] = useState({});
  const togglePhase = (id) => setExpandedPhases((prev) => ({ ...prev, [id]: !prev[id] }));

  const projectGoals = useMemo(() => goals.filter((g) => g._projectGoal), [goals]);

  const weekLabels = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return Array.from({ length: TOTAL_WEEKS }, (_, i) => {
      const w = new Date(monday);
      w.setDate(monday.getDate() + i * 7);
      return w.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
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
              {weekLabels.map((label, i) => (
                <th key={i} className="text-center py-1 px-0.5 font-normal text-stone-400 text-[10px] w-10">{label}</th>
              ))}
              <th className="text-left py-2 px-2 font-medium text-stone-500 text-xs w-24">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {projectGoals.flatMap((goal) => {
              const rows = [];
              const isOverdue = goal._projectDeadline && new Date(goal._projectDeadline + 'T23:59:59') < new Date();

              // 1. MASTER PROJECT ROW
              rows.push(
                <tr key={`proj-${goal.id}`} className="border-b border-stone-200 bg-stone-50/50">
                  <td className="py-2 px-3 flex items-center justify-between">
                    <span className="font-medium text-stone-800 font-serif">{goal.title}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onGoalClick?.(goal); }} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1 rounded bg-stone-100">
                      ✏️ Edit
                    </button>
                  </td>
                  {weekLabels.map((_, i) => <td key={i} className="bg-stone-50/50 border-l border-white/50" />)}
                  <td className={`py-2 px-2 text-stone-500 text-xs shrink-0 ${isOverdue ? 'text-amber-600' : ''}`}>
                    {goal._projectDeadline ? new Date(goal._projectDeadline + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
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
                      <span className="text-stone-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                      <span className={`font-sans text-sm ${isDone ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{phase.title}</span>
                    </td>
                    {weekLabels.map((_, i) => (
                      <td key={i} className="py-1 px-0.5 align-middle w-10">
                        {i >= startWeek && i <= endWeek && (
                          <div className={`h-3 rounded-full ${isDone ? 'bg-stone-300' : 'bg-amber-300'}`} />
                        )}
                      </td>
                    ))}
                    <td className="py-2 px-2 text-stone-400 text-[10px]">{phase.weekRange}</td>
                  </tr>
                );

                // 3. SUBTASK ROWS (If Expanded)
                if (isExpanded) {
                  const subtasks = (goal.subtasks || []).filter((st) => st.phaseId === phase.id);
                  subtasks.forEach((st) => {
                    const stDone = (st.completedHours ?? 0) >= (st.estimatedHours ?? 0);
                    rows.push(
                      <tr key={`st-${st.id}`} className="border-b border-stone-50/50 bg-stone-50/30">
                        <td className="py-1.5 px-3 pl-12">
                          <span className={`font-sans text-xs ${stDone ? 'text-stone-400 line-through' : 'text-stone-500'}`}>↳ {st.title}</span>
                        </td>
                        {weekLabels.map((_, i) => (
                          <td key={i} className="py-1 px-0.5 align-middle">
                            {i >= startWeek && i <= endWeek && (
                              <div className="h-0.5 w-full bg-stone-200" />
                            )}
                          </td>
                        ))}
                        <td className="py-1.5 px-2 text-stone-400 text-[10px]">{st.estimatedHours}h</td>
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
