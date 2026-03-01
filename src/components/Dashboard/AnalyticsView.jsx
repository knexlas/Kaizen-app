import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGarden } from '../../context/GardenContext';
import { localISODate, getWeekId } from '../../services/dateUtils';
import { getUserInsight, saveUserInsight } from '../../firebase/services';
import { generateSpiritInsight } from '../../services/geminiService';
import { buildReflectionInsights } from '../../services/insightsReflectionService';

const CARD_CLASS = 'rounded-2xl border border-stone-200/90 bg-white/90 dark:bg-stone-800/90 dark:border-stone-600/50 p-4 shadow-sm';
const MOSS_SOFT = 'text-moss-800 dark:text-moss-200';
const MOSS_MUTED = 'text-moss-700/90 dark:text-moss-300/90';

/** Total minutes (all-time) from logs. */
function useTotalHarvest(logs) {
  return useMemo(() => (logs ?? []).reduce((sum, log) => sum + (Number(log.minutes) || 0), 0), [logs]);
}

/** Last 14 days for soft trend. */
function useFocusTrendShort(logs) {
  return useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = localISODate(d);
      const mins = (logs ?? []).reduce((sum, log) => {
        const logDate = typeof log.date === 'string' ? log.date.slice(0, 10) : (log.date ? localISODate(new Date(log.date)) : '');
        return logDate === dateStr ? sum + (Number(log.minutes) || 0) : sum;
      }, 0);
      days.push({ date: dateStr, minutes: mins, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
    }
    return days;
  }, [logs]);
}

/** Soft trend line — minimal, elegant. */
function SoftTrendChart({ data }) {
  if (!data?.length) return null;
  const maxM = Math.max(1, ...data.map((d) => d.minutes));
  const w = 280;
  const h = 72;
  const pad = { t: 4, r: 8, b: 20, l: 28 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;
  const points = data
    .map((d, i) => {
      const x = pad.l + (i / (data.length - 1 || 1)) * chartW;
      const y = pad.t + chartH - (d.minutes / maxM) * chartH;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-full h-20 opacity-90" aria-hidden>
      <defs>
        <linearGradient id="insightsTrendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(74, 93, 35)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(74, 93, 35)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#insightsTrendGrad)" points={`${pad.l},${pad.t + chartH} ${points} ${w - pad.r},${pad.t + chartH}`} />
      <polyline
        fill="none"
        stroke="rgb(74, 93, 35)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function AnalyticsView() {
  const { logs, goals, googleUser, weeklyEvents, getCheckInHistory, today, lastCheckInDate, dailySpoonCount, spiritPoints } = useGarden();
  const weekId = getWeekId();
  const [cachedInsight, setCachedInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [spoonChartData, setSpoonChartData] = useState([]);

  const totalMinutes = useTotalHarvest(logs);
  const focusTrendShort = useFocusTrendShort(logs);

  const checkInRowsForInsights = useMemo(
    () => spoonChartData.map((r) => ({ dateStr: r.dateStr, spoonCount: r.spoons })),
    [spoonChartData]
  );

  const reflection = useMemo(
    () => buildReflectionInsights(logs, goals, checkInRowsForInsights, spiritPoints),
    [logs, goals, checkInRowsForInsights, spiritPoints]
  );

  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid) {
      setInsightLoading(false);
      return;
    }
    getUserInsight(uid, weekId)
      .then((insight) => setCachedInsight(insight))
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
        if (r.dateStr === today && lastCheckInDate === today && typeof dailySpoonCount === 'number') spoons = dailySpoonCount;
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
        if (text) return saveUserInsight(uid, weekId, text).then(() => setCachedInsight({ id: weekId, text, generatedAt: new Date().toISOString() }));
      })
      .catch((err) => console.warn('Generate insight failed', err))
      .finally(() => setGenerating(false));
  }, [googleUser?.uid, weekId, logs, goals, weeklyEvents]);

  const { whatHappened, whatHelped, pattern, suggestion, gardenStory } = reflection;
  const hasAnyData = whatHappened.weekSessions > 0 || whatHappened.totalHarvest > 0;

  return (
    <div className="space-y-8 pb-6">
      {/* Header */}
      <div>
        <h2 className="font-serif text-stone-900 dark:text-stone-100 text-xl mb-1">Reflection</h2>
        <p className="font-sans text-sm text-stone-500 dark:text-stone-400">
          A calm look at what happened, what helped, and what to try next.
        </p>
      </div>

      {/* 1. Lead with interpretation: "What actually worked" */}
      <section className={`${CARD_CLASS} border-moss-200/60 dark:border-moss-800/40 bg-gradient-to-b from-moss-50/50 to-white/80 dark:from-moss-900/20 dark:to-stone-800/80`}>
        <h3 className="font-serif text-stone-800 dark:text-stone-200 text-sm font-medium mb-2">What actually worked</h3>
        {insightLoading ? (
          <p className="font-sans text-sm text-stone-500 dark:text-stone-400 italic">Loading…</p>
        ) : cachedInsight?.text ? (
          <>
            <p className="font-sans text-[15px] leading-relaxed text-stone-700 dark:text-stone-300 whitespace-pre-wrap">{cachedInsight.text}</p>
            <button
              type="button"
              onClick={handleGenerateInsight}
              disabled={generating}
              className="mt-3 text-xs font-sans text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded px-2 py-1"
            >
              {generating ? '…' : 'Regenerate'}
            </button>
          </>
        ) : (
          <>
            {hasAnyData ? (
              <p className="font-sans text-[15px] leading-relaxed text-stone-700 dark:text-stone-300">
                This week you had {whatHappened.weekSessions} session{whatHappened.weekSessions !== 1 ? 's' : ''} over {whatHappened.weekTendingDays} day
                {whatHappened.weekTendingDays !== 1 ? 's' : ''} — {whatHappened.weekMinutes} minutes of focus.
                {whatHappened.topGoalNames.length > 0 && ` Your attention went most to ${whatHappened.topGoalNames.slice(0, 2).join(' and ')}.`}
              </p>
            ) : (
              <p className="font-sans text-sm text-stone-500 dark:text-stone-400 italic">No focus logged yet. When you complete sessions, a short summary will appear here.</p>
            )}
            <button
              type="button"
              onClick={handleGenerateInsight}
              disabled={generating}
              className="mt-3 px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-moss-100 dark:bg-moss-900/40 text-moss-800 dark:text-moss-200 hover:bg-moss-200 dark:hover:bg-moss-800/50 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50"
            >
              {generating ? '…' : 'Generate a snapshot with Mochi'}
            </button>
          </>
        )}
      </section>

      {/* 2. What happened? */}
      <section>
        <h3 className="font-serif text-stone-800 dark:text-stone-200 text-base mb-3">What happened?</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className={`${CARD_CLASS}`}>
            <p className="font-sans text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wider">This week</p>
            <p className={`font-serif text-xl font-medium tabular-nums mt-0.5 ${MOSS_SOFT}`}>
              {whatHappened.weekSessions} session{whatHappened.weekSessions !== 1 ? 's' : ''} · {whatHappened.weekMinutes} min
            </p>
            <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-1">{whatHappened.weekTendingDays} day{whatHappened.weekTendingDays !== 1 ? 's' : ''} you showed up</p>
          </div>
          {whatHappened.topGoalNames.length > 0 && (
            <div className={`${CARD_CLASS}`}>
              <p className="font-sans text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wider">Top focus</p>
              <ul className="font-sans text-sm text-stone-700 dark:text-stone-300 mt-1 space-y-0.5">
                {whatHappened.topGoalNames.slice(0, 3).map((name) => (
                  <li key={name} className="truncate">
                    {name.length > 28 ? name.slice(0, 26) + '…' : name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={`${CARD_CLASS}`}>
            <p className="font-sans text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wider">All-time harvest</p>
            <p className={`font-serif text-xl font-medium tabular-nums mt-0.5 ${MOSS_SOFT}`}>
              {(whatHappened.totalHarvest / 60).toFixed(1)} hours
            </p>
            <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-1">Total focus logged</p>
          </div>
        </div>
        {focusTrendShort.length > 0 && (
          <div className={`${CARD_CLASS} mt-3`}>
            <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mb-2">Last 14 days</p>
            <SoftTrendChart data={focusTrendShort} />
          </div>
        )}
      </section>

      {/* 3. What helped? — insight cards */}
      <section>
        <h3 className="font-serif text-stone-800 dark:text-stone-200 text-base mb-3">What helped?</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {whatHelped.bestDayOfWeek && (
            <div className={`${CARD_CLASS} border-l-4 border-moss-400/50 dark:border-moss-600/50`}>
              <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mb-1">Best focus window</p>
              <p className={`font-sans text-sm ${MOSS_MUTED}`}>Your focus tended to cluster on {whatHelped.bestDayOfWeek}s.</p>
            </div>
          )}
          {whatHelped.checkInEffect && (
            <div className={`${CARD_CLASS} border-l-4 border-moss-400/50 dark:border-moss-600/50`}>
              <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mb-1">Check-in & focus</p>
              <p className={`font-sans text-sm ${MOSS_MUTED}`}>{whatHelped.checkInEffect}</p>
            </div>
          )}
          {whatHelped.shortVsLong && (
            <div className={`${CARD_CLASS} border-l-4 border-moss-400/50 dark:border-moss-600/50`}>
              <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mb-1">Short vs longer sessions</p>
              <p className={`font-sans text-sm ${MOSS_MUTED}`}>{whatHelped.shortVsLong}</p>
            </div>
          )}
          {whatHelped.lowEnergyNote && (
            <div className={`${CARD_CLASS} border-l-4 border-moss-400/50 dark:border-moss-600/50`}>
              <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mb-1">Lower-energy days</p>
              <p className={`font-sans text-sm ${MOSS_MUTED}`}>{whatHelped.lowEnergyNote}</p>
            </div>
          )}
          {!whatHelped.bestDayOfWeek && !whatHelped.checkInEffect && !whatHelped.shortVsLong && !whatHelped.lowEnergyNote && hasAnyData && (
            <div className={`${CARD_CLASS}`}>
              <p className="font-sans text-sm text-stone-500 dark:text-stone-400 italic">Keep logging focus and check-ins. Patterns will show up here over time.</p>
            </div>
          )}
        </div>
      </section>

      {/* 4. What seems to be the pattern? */}
      {pattern && (
        <section>
          <h3 className="font-serif text-stone-800 dark:text-stone-200 text-base mb-3">What seems to be the pattern?</h3>
          <div className={`${CARD_CLASS} border-moss-200/60 dark:border-moss-700/40`}>
            <p className={`font-sans text-[15px] leading-relaxed ${MOSS_MUTED}`}>{pattern}</p>
          </div>
        </section>
      )}

      {/* 5. Weekly reflection ritual + Garden growth + One suggestion */}
      <section className={`${CARD_CLASS} space-y-5 bg-gradient-to-b from-stone-50/80 to-white/80 dark:from-stone-800/50 dark:to-stone-800/30`}>
        <h3 className="font-serif text-stone-800 dark:text-stone-200 text-base">Weekly reflection</h3>
        <p className="font-sans text-sm text-stone-600 dark:text-stone-400">
          Take a moment: What worked? What was difficult? One pattern you noticed?
        </p>
        {gardenStory && (
          <div className="pt-3 border-t border-stone-200/80 dark:border-stone-600/50">
            <p className="font-sans text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1">How your garden grew</p>
            <p className={`font-sans text-sm leading-relaxed ${MOSS_MUTED}`}>{gardenStory}</p>
          </div>
        )}
        {suggestion && (
          <div className="pt-3 border-t border-stone-200/80 dark:border-stone-600/50">
            <p className="font-sans text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1">One thing to try next week</p>
            <p className={`font-sans text-[15px] leading-relaxed font-medium ${MOSS_SOFT}`}>{suggestion}</p>
          </div>
        )}
      </section>

      {/* 6. What to try next — single recommendation card */}
      {suggestion && (
        <section>
          <div className={`${CARD_CLASS} border-2 border-moss-300/50 dark:border-moss-600/40 bg-moss-50/40 dark:bg-moss-900/20`}>
            <p className="font-serif text-stone-800 dark:text-stone-200 text-sm font-medium mb-1">What to try next</p>
            <p className={`font-sans text-[15px] leading-relaxed ${MOSS_MUTED}`}>{suggestion}</p>
          </div>
        </section>
      )}
    </div>
  );
}
