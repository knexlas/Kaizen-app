import { useMemo, useState } from 'react';
import { useGarden } from '../../context/GardenContext';
import { localISODate } from '../../services/dateUtils';

/** Minimal SVG sparkline: line of values + optional horizontal dashed target. */
function Sparkline({ data = [], target }) {
  const values = Array.isArray(data) ? data.map((d) => (typeof d === 'number' ? d : d?.value)) : [];
  const clean = values.filter((v) => v != null && !Number.isNaN(Number(v))).map(Number);
  if (clean.length < 2) {
    return (
      <p className="font-sans text-xs text-stone-400 italic py-2">Need more data points to draw a chart.</p>
    );
  }
  const targetNum = target != null && !Number.isNaN(Number(target)) ? Number(target) : null;
  const min = Math.min(...clean, targetNum ?? clean[0]);
  const max = Math.max(...clean, targetNum ?? clean[0]);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const toX = (i) => (i / (clean.length - 1)) * w;
  const toY = (v) => h - ((v - min) / range) * h;
  const points = clean.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const targetY = targetNum != null ? toY(targetNum) : null;
  return (
    <div className="w-full h-8 flex items-center">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full text-blue-500" preserveAspectRatio="none">
        {targetY != null && targetY >= 0 && targetY <= h && (
          <line x1={0} y1={targetY} x2={w} y2={targetY} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" opacity={0.6} className="text-stone-400" />
        )}
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function getLatestMetricValue(goal) {
  const metrics = Array.isArray(goal?.metrics) ? goal.metrics : [];
  if (metrics.length === 0) return null;
  const sorted = [...metrics].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return sorted[0]?.value;
}

function getMetricValueDaysAgo(goal, daysAgo) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  const targetStr = localISODate(targetDate);
  const metrics = Array.isArray(goal?.metrics) ? goal.metrics : [];
  const entry = metrics.find((e) => (e.date || '').slice(0, 10) === targetStr);
  if (entry) return entry.value;
  const sorted = [...metrics].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const before = sorted.filter((e) => (e.date || '').slice(0, 10) <= targetStr);
  if (before.length === 0) return null;
  return before[before.length - 1]?.value;
}

export default function HorizonsMetrics({ goals = [], logMetric, onRecord }) {
  const { deleteGoal } = useGarden();
  const [daysAgo, setDaysAgo] = useState(3);
  const vitalityGoals = useMemo(
    () =>
      (goals || []).filter(
        (g) =>
          g.type === 'vitality' ||
          (g.metricSettings && g.metricSettings.targetValue !== undefined) ||
          g.targetValue !== undefined
      ),
    [goals]
  );

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
          const historyArray = Array.isArray(goal.history)
            ? goal.history
            : (Array.isArray(goal.metrics) ? [...goal.metrics].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((e) => ({ value: e.value })) : []);
          const trend = latest != null && past != null ? latest - past : null;
          const trendUp = goal.metricSettings?.direction !== 'lower';
          const improved = trend !== null && (trendUp ? trend > 0 : trend < 0);
          return (
            <div key={goal.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm relative">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">💧</span>
                  <span className="font-sans text-sm font-medium text-stone-800 truncate">
                    {goal.metricSettings?.metricName ?? goal.title}
                  </span>
                </div>
                {deleteGoal && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Drain this pond? This cannot be undone.')) {
                        deleteGoal(goal.id);
                      }
                    }}
                    className="shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    aria-label="Delete this metric"
                    title="Drain this pond"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3-3V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                )}
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
              <div className="mt-2 min-h-[2rem]">
                <Sparkline data={historyArray} target={goal.metricSettings?.targetValue} />
              </div>
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
