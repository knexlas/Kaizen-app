import { useMemo } from 'react';
import { useGarden } from '../../context/GardenContext';

const DOMAINS = [
  { id: 'body', label: 'Body', emoji: '🌿', color: '#4A5D23' },
  { id: 'mind', label: 'Mind', emoji: '🧠', color: '#5B21B6' },
  { id: 'spirit', label: 'Spirit', emoji: '✨', color: '#B45309' },
  { id: 'finance', label: 'Finance', emoji: '📈', color: '#0E7490' },
];

/** Total minutes (all-time) from logs. */
function useTotalHarvest(logs) {
  return useMemo(() => {
    return (logs ?? []).reduce((sum, log) => sum + (Number(log.minutes) || 0), 0);
  }, [logs]);
}

/** Minutes per day for last 30 days. */
function useFocusTrend(logs) {
  return useMemo(() => {
    const days = [];
    const now = new Date();
    const numDays = 30;
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const mins = (logs ?? []).reduce((sum, log) => {
        const logDate = typeof log.date === 'string' ? log.date.slice(0, 10) : (log.date && log.date.toISOString?.().slice(0, 10));
        if (logDate !== dateStr) return sum;
        return sum + (Number(log.minutes) || 0);
      }, 0);
      days.push({ date: dateStr, minutes: mins, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
    }
    return days;
  }, [logs]);
}

/** By domain (from goal lookup). */
function useDistribution(logs, goals) {
  return useMemo(() => {
    const byDomain = { body: 0, mind: 0, spirit: 0, finance: 0 };
    const goalMap = new Map((goals ?? []).map((g) => [g.id, g]));
    (logs ?? []).forEach((log) => {
      const goal = goalMap.get(log.taskId);
      const domain = goal?.domain && byDomain.hasOwnProperty(goal.domain) ? goal.domain : 'body';
      byDomain[domain] = (byDomain[domain] || 0) + (Number(log.minutes) || 0);
    });
    return DOMAINS.map((d) => ({ id: d.id, label: d.label, emoji: d.emoji, color: d.color, minutes: byDomain[d.id] || 0 })).filter(
      (x) => x.minutes > 0
    );
  }, [logs, goals]);
}

/** GitHub-style: activity per day for last ~3 months (14 weeks). */
function useActivityHeatmap(logs) {
  return useMemo(() => {
    const byDate = {};
    (logs ?? []).forEach((log) => {
      const dateStr = typeof log.date === 'string' ? log.date.slice(0, 10) : (log.date && log.date.toISOString?.().slice(0, 10));
      if (!dateStr) return;
      const mins = Number(log.minutes) || 0;
      byDate[dateStr] = (byDate[dateStr] || 0) + mins;
    });
    const now = new Date();
    const days = [];
    const totalDays = 14 * 7;
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({ date: dateStr, minutes: byDate[dateStr] || 0 });
    }
    const maxMins = Math.max(1, ...days.map((x) => x.minutes));
    return { days, maxMins };
  }, [logs]);
}

function FocusTrendChart({ data }) {
  if (!data?.length) return <p className="font-sans text-sm text-stone-500 italic">No focus data yet.</p>;
  const maxM = Math.max(1, ...data.map((d) => d.minutes));
  const w = 320;
  const h = 120;
  const pad = { t: 8, r: 8, b: 24, l: 36 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;
  const points = data.map((d, i) => {
    const x = pad.l + (i / (data.length - 1 || 1)) * chartW;
    const y = pad.t + chartH - (d.minutes / maxM) * chartH;
    return `${x},${y}`;
  }).join(' ');
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="font-serif text-stone-800 text-sm mb-3">Focus Trend (last 30 days)</h3>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-full h-32" aria-hidden>
        <polyline
          fill="none"
          stroke="#4A5D23"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <text x={pad.l} y={pad.t + 10} className="fill-stone-400 font-sans text-[10px]">{maxM}m</text>
        <text x={w - pad.r - 24} y={h - 4} className="fill-stone-400 font-sans text-[10px]">Today</text>
      </svg>
    </div>
  );
}

function DistributionChart({ data }) {
  if (!data?.length) return <p className="font-sans text-sm text-stone-500 italic">No domain data yet.</p>;
  const total = data.reduce((s, d) => s + d.minutes, 0);
  if (total === 0) return <p className="font-sans text-sm text-stone-500 italic">No focus logged yet.</p>;
  const r = 60;
  const cx = 70;
  const cy = 70;
  let acc = 0;
  const segments = data.map((d) => {
    const pct = d.minutes / total;
    const start = acc;
    acc += pct;
    const startAngle = (start - 0.25) * 2 * Math.PI;
    const endAngle = (acc - 0.25) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = pct > 0.5 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { path, color: d.color, label: d.label, emoji: d.emoji, pct: (pct * 100).toFixed(0) };
  });
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="font-serif text-stone-800 text-sm mb-3">Domain Balance</h3>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 140 140" className="w-32 h-32 shrink-0" aria-hidden>
          {segments.map((seg, i) => (
            <path key={i} d={seg.path} fill={seg.color} stroke="#fff" strokeWidth="1" />
          ))}
        </svg>
        <ul className="font-sans text-sm text-stone-700 space-y-1">
          {segments.map((seg, i) => (
            <li key={i} className="flex items-center gap-2">
              <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: seg.color }} aria-hidden />
              {seg.emoji} {seg.label}: {seg.pct}%
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ActivityHeatmap({ days, maxMins }) {
  const cols = 7;
  const rows = Math.ceil(days.length / cols);
  const cellSize = 12;
  const gap = 2;
  const w = cols * (cellSize + gap) - gap;
  const h = rows * (cellSize + gap) - gap;
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="font-serif text-stone-800 text-sm mb-3">Vitality Streak</h3>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-full" style={{ maxHeight: 140 }} aria-hidden>
        {days.map((d, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const x = col * (cellSize + gap);
          const y = row * (cellSize + gap);
          const intensity = maxMins > 0 ? d.minutes / maxMins : 0;
          const fill = intensity === 0 ? '#f5f5f4' : intensity < 0.33 ? '#bbf7d0' : intensity < 0.66 ? '#86efac' : '#4ade80';
          return <rect key={d.date} x={x} y={y} width={cellSize} height={cellSize} rx={2} fill={fill} />;
        })}
      </svg>
      <p className="font-sans text-xs text-stone-500 mt-2">Lighter = less focus · Darker = more focus</p>
    </div>
  );
}

function TotalHarvest({ totalMinutes }) {
  const hours = (totalMinutes / 60).toFixed(1);
  return (
    <div className="rounded-xl border border-stone-200 bg-moss-50/50 p-4">
      <h3 className="font-serif text-stone-800 text-sm mb-1">Total Harvest</h3>
      <p className="font-sans text-2xl font-medium text-moss-800 tabular-nums">{hours} hours</p>
      <p className="font-sans text-xs text-stone-500 mt-1">All-time focus logged</p>
    </div>
  );
}

export default function AnalyticsView() {
  const { logs, goals } = useGarden();
  const totalMinutes = useTotalHarvest(logs);
  const focusTrend = useFocusTrend(logs);
  const distribution = useDistribution(logs, goals);
  const heatmap = useActivityHeatmap(logs);

  return (
    <div className="space-y-8">
      <h2 className="font-serif text-stone-900 text-xl">Insights</h2>
      <p className="font-sans text-sm text-stone-600">Your progress over time — patterns, focus, and growth.</p>

      <TotalHarvest totalMinutes={totalMinutes} />

      <FocusTrendChart data={focusTrend} />
      <DistributionChart data={distribution} />
      <ActivityHeatmap days={heatmap.days} maxMins={heatmap.maxMins} />
    </div>
  );
}
