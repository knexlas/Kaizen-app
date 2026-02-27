import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { useGarden } from '../../context/GardenContext';
import { localISODate, getWeekId } from '../../services/dateUtils';
import { getUserInsight, saveUserInsight } from '../../firebase/services';
import { generateSpiritInsight } from '../../services/geminiService';

const DOMAINS = [
  { id: 'body', label: 'Body', emoji: '🌿', color: '#4A5D23' },
  { id: 'mind', label: 'Mind', emoji: '🧠', color: '#5B21B6' },
  { id: 'spirit', label: 'Spirit', emoji: '✨', color: '#B45309' },
  { id: 'finance', label: 'Finance', emoji: '📈', color: '#0E7490' },
];

const SPOON_COLOR = '#fbbf24';
const SPOON_GLOW = '0 0 12px rgba(251, 191, 36, 0.6)';

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
      const dateStr = localISODate(d);
      const mins = (logs ?? []).reduce((sum, log) => {
        const logDate = typeof log.date === 'string' ? log.date.slice(0, 10) : (log.date ? localISODate(new Date(log.date)) : '');
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

/** Last 7 days: totalMinutes per goal (for Time Distribution chart). */
function useTimeDistributionLast7(logs, goals) {
  return useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = localISODate(cutoff);
    const goalMap = new Map((goals ?? []).map((g) => [g.id, g]));
    const byGoal = {};
    (logs ?? []).forEach((log) => {
      const logDate = typeof log.date === 'string' ? log.date.slice(0, 10) : (log.date ? localISODate(new Date(log.date)) : '');
      if (logDate < cutoffStr) return;
      const mins = Number(log.minutes) || 0;
      const goalId = log.taskId;
      const goal = goalMap.get(goalId);
      const name = goal?.title ?? log.taskTitle ?? 'Other';
      byGoal[name] = (byGoal[name] || 0) + mins;
    });
    return Object.entries(byGoal)
      .map(([name, minutes]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, minutes, hours: (minutes / 60).toFixed(1) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10);
  }, [logs, goals]);
}

/** GitHub-style: activity per day for last ~3 months (14 weeks). */
function useActivityHeatmap(logs) {
  return useMemo(() => {
    const byDate = {};
    (logs ?? []).forEach((log) => {
      const dateStr = typeof log.date === 'string' ? log.date.slice(0, 10) : (log.date ? localISODate(new Date(log.date)) : '');
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
      const dateStr = localISODate(d);
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

/** Spoons/Energy over last 7 days — Recharts LineChart with soft glow. */
function SpoonsLineChart({ data }) {
  if (!data?.length) return <p className="font-sans text-sm text-stone-500 italic">No check-in data for the last 7 days. Complete your morning check-in to see Spoons here.</p>;
  const hasAny = data.some((d) => typeof d.spoons === 'number');
  if (!hasAny) return <p className="font-sans text-sm text-stone-500 italic">No Spoons logged yet. Check in each morning to see your energy over time.</p>;
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="font-serif text-stone-800 text-sm mb-3">Energy / Spoons over time</h3>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} stroke="#a8a29e" />
            <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="#a8a29e" />
            <Tooltip
              formatter={(value) => [value != null ? `${value} spoons` : '—', 'Spoons']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="spoons"
              stroke={SPOON_COLOR}
              strokeWidth={2.5}
              dot={{ fill: SPOON_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: SPOON_COLOR, stroke: '#fff', strokeWidth: 2 }}
              style={{ filter: `drop-shadow(${SPOON_GLOW})` }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Time distribution by goal — last 7 days, Recharts BarChart. */
function TimeDistributionBarChart({ data }) {
  if (!data?.length) return <p className="font-sans text-sm text-stone-500 italic">No focus logged in the last 7 days. Log time on goals to see where your time went.</p>;
  const colors = ['#4A5D23', '#5B21B6', '#B45309', '#0E7490', '#64748b', '#059669', '#be185d', '#0369a1'];
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="font-serif text-stone-800 text-sm mb-3">Time distribution (last 7 days)</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
            <XAxis type="number" unit=" min" tick={{ fontSize: 11 }} stroke="#a8a29e" />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} stroke="#a8a29e" />
            <Tooltip formatter={(value) => [`${(value / 60).toFixed(1)} hrs`, 'Minutes']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="minutes" radius={4} fill="#4A5D23" name="Minutes">
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function AnalyticsView() {
  const {
    logs,
    goals,
    googleUser,
    weeklyEvents,
    getCheckInHistory,
    today,
    lastCheckInDate,
    dailySpoonCount,
  } = useGarden();

  const weekId = getWeekId();
  const [cachedInsight, setCachedInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [spoonChartData, setSpoonChartData] = useState([]);

  const totalMinutes = useTotalHarvest(logs);
  const focusTrend = useFocusTrend(logs);
  const distribution = useDistribution(logs, goals);
  const heatmap = useActivityHeatmap(logs);
  const timeDistributionLast7 = useTimeDistributionLast7(logs, goals);

  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid) {
      setInsightLoading(false);
      return;
    }
    getUserInsight(uid, weekId)
      .then((insight) => {
        setCachedInsight(insight);
      })
      .catch(() => setCachedInsight(null))
      .finally(() => setInsightLoading(false));
  }, [googleUser?.uid, weekId]);

  useEffect(() => {
    if (!getCheckInHistory) return;
    getCheckInHistory().then((rows) => {
      const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const merged = rows.map((r) => {
        const d = new Date(r.dateStr + 'T12:00:00');
        const dayLabel = dayLabels[d.getDay()];
        let spoons = r.spoonCount;
        if (r.dateStr === today && lastCheckInDate === today && typeof dailySpoonCount === 'number') {
          spoons = dailySpoonCount;
        }
        return { ...r, dayLabel, spoons: spoons ?? null };
      });
      setSpoonChartData(merged);
    });
  }, [getCheckInHistory, today, lastCheckInDate, dailySpoonCount]);

  const handleGenerateInsight = useCallback(() => {
    const uid = googleUser?.uid;
    if (!uid) return;
    setGenerating(true);
    const events = Array.isArray(weeklyEvents) ? weeklyEvents : [];
    generateSpiritInsight(logs ?? [], goals ?? [], events)
      .then((text) => {
        if (text) {
          return saveUserInsight(uid, weekId, text).then(() => {
            setCachedInsight({ id: weekId, text, generatedAt: new Date().toISOString() });
          });
        }
      })
      .catch((err) => console.warn('Generate insight failed', err))
      .finally(() => setGenerating(false));
  }, [googleUser?.uid, weekId, logs, goals, weeklyEvents]);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-serif text-stone-900 text-xl mb-1">Insights</h2>
        <p className="font-sans text-sm text-stone-600">Your progress over time — patterns, focus, and growth.</p>
      </div>

      {/* Executive summary: AI narrative (cover letter) at top */}
      <section className="rounded-2xl border-2 border-stone-200 bg-gradient-to-b from-amber-50/80 to-stone-50 p-6 shadow-sm">
        <h3 className="font-serif text-stone-800 text-base mb-3">Weekly snapshot</h3>
        {insightLoading ? (
          <p className="font-sans text-sm text-stone-500 italic">Loading…</p>
        ) : cachedInsight?.text ? (
          <>
            <p className="font-serif text-stone-800 text-[15px] leading-relaxed whitespace-pre-wrap">{cachedInsight.text}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerateInsight}
                disabled={generating}
                className="px-3 py-1.5 rounded-full text-xs font-sans font-medium bg-stone-200 text-stone-700 hover:bg-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
              >
                {generating ? '…' : '🔄 Regenerate'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="font-sans text-sm text-stone-500 italic mb-4">No insight generated for this week yet.</p>
            <button
              type="button"
              onClick={handleGenerateInsight}
              disabled={generating}
              className="px-4 py-2 rounded-xl font-sans text-sm font-medium bg-amber-500 text-stone-900 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
            >
              {generating ? 'Generating…' : '🪄 Generate Snapshot'}
            </button>
          </>
        )}
      </section>

      {/* Appendices: hard data and charts */}
      <section>
        <h3 className="font-serif text-stone-800 text-base mb-4">Data</h3>
        <div className="space-y-6">
          <TotalHarvest totalMinutes={totalMinutes} />

          <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
            <SpoonsLineChart data={spoonChartData} />
            <TimeDistributionBarChart data={timeDistributionLast7} />
          </div>

          <FocusTrendChart data={focusTrend} />
          <DistributionChart data={distribution} />
          <ActivityHeatmap days={heatmap.days} maxMins={heatmap.maxMins} />
        </div>
      </section>
    </div>
  );
}
