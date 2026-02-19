import { useMemo, useState } from 'react';

function getLatestMetricValue(goal) {
  const metrics = Array.isArray(goal?.metrics) ? goal.metrics : [];
  if (metrics.length === 0) return null;
  const sorted = [...metrics].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return sorted[0]?.value;
}

function getMetricValueDaysAgo(goal, daysAgo) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  const targetStr = targetDate.toISOString().slice(0, 10);
  const metrics = Array.isArray(goal?.metrics) ? goal.metrics : [];
  const entry = metrics.find((e) => (e.date || '').slice(0, 10) === targetStr);
  if (entry) return entry.value;
  const sorted = [...metrics].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const before = sorted.filter((e) => (e.date || '').slice(0, 10) <= targetStr);
  if (before.length === 0) return null;
  return before[before.length - 1]?.value;
}

export default function HorizonsMetrics({ goals = [], logMetric, onRecord }) {
  const [daysAgo, setDaysAgo] = useState(3);
  const vitalityGoals = useMemo(() => (goals || []).filter((g) => g.type === 'vitality'), [goals]);

  if (vitalityGoals.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
        <p className="font-sans text-stone-500 text-sm">No vitality metrics yet. Add a vitality goal to track over time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-serif text-stone-800 text-base">Tracking metrics</h3>
        <select
          value={daysAgo}
          onChange={(e) => setDaysAgo(Number(e.target.value))}
          className="font-sans text-sm border border-stone-200 rounded-lg px-3 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
        >
          <option value={3}>Compare to 3 days ago</option>
          <option value={7}>Compare to 7 days ago</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {vitalityGoals.map((goal) => {
          const latest = getLatestMetricValue(goal);
          const past = getMetricValueDaysAgo(goal, daysAgo);
          const unit = goal.metricSettings?.unit || '';
          const entries = Array.isArray(goal.metrics) ? goal.metrics.slice(-14) : [];
          const trend = latest != null && past != null ? latest - past : null;
          const trendUp = goal.metricSettings?.direction !== 'lower';
          const improved = trend !== null && (trendUp ? trend > 0 : trend < 0);
          return (
            <div key={goal.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💧</span>
                <span className="font-sans text-sm font-medium text-stone-800">{goal.title}</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-sans text-2xl font-bold text-stone-900 tabular-nums">
                  {latest != null ? latest : '—'}
                </span>
                {unit && <span className="font-sans text-sm text-stone-500">{unit}</span>}
              </div>
              <div className="font-sans text-xs text-stone-500 mb-2">
                {daysAgo} days ago: {past != null ? past + ' ' + unit : '—'}
              </div>
              {trend !== null && (
                <div className={`font-sans text-xs font-medium ${improved ? 'text-moss-600' : 'text-amber-600'}`}>
                  {improved ? '↑' : '↓'} {trend > 0 ? '+' : ''}{trend} {unit} vs {daysAgo}d ago
                </div>
              )}
              {entries.length > 1 && (
                <div className="flex items-end gap-px h-10 mt-2">
                  {(() => {
                    const vals = entries.map((e) => e.value);
                    const mn = Math.min(...vals);
                    const mx = Math.max(...vals);
                    const range = mx - mn || 1;
                    return vals.map((v, idx) => (
                      <div
                        key={idx}
                        className="flex-1 rounded-sm bg-sky-300/70 min-w-[2px]"
                        style={{ height: Math.max(4, ((v - mn) / range) * 36) + 'px' }}
                        title={entries[idx].date + ': ' + v + ' ' + unit}
                      />
                    ));
                  })()}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <input
                  type="number"
                  step="any"
                  placeholder="Log value"
                  className="flex-1 py-1.5 px-2 rounded-md border border-stone-200 bg-white font-sans text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 tabular-nums"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const num = parseFloat(e.target.value);
                      if (!Number.isNaN(num)) {
                        logMetric?.(goal.id, num);
                        e.target.value = '';
                        onRecord?.();
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling;
                    const num = parseFloat(input.value);
                    if (!Number.isNaN(num)) {
                      logMetric?.(goal.id, num);
                      input.value = '';
                      onRecord?.();
                    }
                  }}
                  className="shrink-0 py-1.5 px-3 rounded-md bg-moss-600 text-white font-sans text-xs font-medium hover:bg-moss-700"
                >
                  Log
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
