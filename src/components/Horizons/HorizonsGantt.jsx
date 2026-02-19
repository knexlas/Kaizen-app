import { useMemo } from 'react';

function getWeekIndex(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const today = new Date();
  const todayMon = new Date(today);
  todayMon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const diffMs = mon - todayMon;
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function getProjectProgressPercent(goal) {
  const ms = Array.isArray(goal?.milestones) ? goal.milestones : [];
  if (ms.length === 0) return 0;
  const done = ms.filter((m) => m.completed).length;
  return Math.round((done / ms.length) * 100);
}

const TOTAL_WEEKS = 14;

export default function HorizonsGantt({ goals = [] }) {
  const projectGoals = useMemo(() => goals.filter((g) => g._projectGoal), [goals]);
  const byProject = useMemo(() => {
    const map = {};
    projectGoals.forEach((g) => {
      const name = g._projectName || 'Project';
      if (!map[name]) map[name] = [];
      map[name].push(g);
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => (a._projectPhase || '').localeCompare(b._projectPhase || '')));
    return map;
  }, [projectGoals]);

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
            {Object.entries(byProject).flatMap(([projectName, items]) =>
              items.map((goal) => {
                const deadline = goal._projectDeadline;
                const endWeek = deadline ? Math.min(TOTAL_WEEKS - 1, Math.max(0, getWeekIndex(deadline))) : TOTAL_WEEKS - 1;
                const startWeek = 0;
                const progress = getProjectProgressPercent(goal);
                const isOverdue = deadline && new Date(deadline + 'T23:59:59') < new Date();
                return (
                  <tr key={goal.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="py-2 px-3 align-middle">
                      <span className="font-medium text-stone-800">{goal.title}</span>
                      {items.length > 1 && <span className="block text-[10px] text-stone-400">{projectName}</span>}
                    </td>
                    {weekLabels.map((_, i) => (
                      <td key={i} className="py-1 px-0.5 align-middle w-10">
                        {i >= startWeek && i <= endWeek ? (
                          <div className="h-5 rounded bg-amber-100 border border-amber-200 overflow-hidden">
                            {i === startWeek && (
                              <div
                                className="h-full rounded-l bg-amber-400/80"
                                style={{ width: progress + '%', minWidth: progress > 0 ? 4 : 0 }}
                                title={progress + '% complete'}
                              />
                            )}
                          </div>
                        ) : null}
                      </td>
                    ))}
                    <td className="py-2 px-2 text-stone-500 text-xs shrink-0">
                      {deadline ? (
                        <span className={isOverdue ? 'text-amber-600' : ''}>
                          {new Date(deadline + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
