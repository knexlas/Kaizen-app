import { useState, useMemo } from 'react';
import { useEnergy } from '../../context/EnergyContext';
import { useGarden } from '../../context/GardenContext';
import { fetchWeeklyEvents, pushToCalendar } from '../../services/calendarSyncService';
import { autoFillWeek } from '../../services/plannerEngine';
import GardenNavigation from './GardenNavigation';
import WeatherWidget from './WeatherWidget';
import GoalCardPlaceholder from './GoalCardPlaceholder';

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function getTitleFromAssignment(assignment, goals) {
  if (!assignment) return 'Task';
  if (typeof assignment === 'object' && assignment.title) return assignment.title;
  const goalId = typeof assignment === 'string' ? assignment : assignment?.goalId ?? assignment?.parentGoalId;
  const goal = (goals ?? []).find((g) => g.id === goalId);
  return goal?.title ?? 'Task';
}

const INITIAL_WEEK_CONTEXT = [
  { id: 1, title: 'CPI Data Release', date: 'Tuesday 8:30 AM', impact: 'high', type: 'market', domain: 'trading' },
  { id: 2, title: 'NVDA Earnings', date: 'Wednesday After Close', impact: 'high', type: 'market', domain: 'trading' },
  { id: 3, title: 'Bank Holiday', date: 'Monday', impact: 'low', type: 'holiday', domain: 'family' },
  { id: 4, title: 'Rainy Day', date: 'Tuesday', impact: 'low', type: 'weather', domain: 'fitness' },
];

const PLOT_TO_DOMAIN = { all: null, finance: 'trading', health: 'fitness', creation: 'family' };
const DOMAIN_TO_PLOT_LABEL = { trading: 'Finance', fitness: 'Health', family: 'Creation' };

/**
 * For a given plot, return local events (same domain) and cross-domain high-impact events.
 */
function getRelevantEvents(events, plot) {
  const domain = PLOT_TO_DOMAIN[plot];
  if (plot === 'all' || !domain) {
    return { localEvents: events, crossDomainEvents: [] };
  }
  const localEvents = events.filter((e) => e.domain === domain);
  const crossDomainEvents = events.filter((e) => e.domain !== domain && e.impact === 'high');
  return { localEvents, crossDomainEvents };
}

function WeeklyPlanner({ onStartFocus }) {
  const { goals, googleToken, msToken, weekAssignments, setWeekAssignments, saveDayPlanForDate } = useGarden();
  const [weekContext] = useState(INITIAL_WEEK_CONTEXT);
  const [activePlot, setActivePlot] = useState('all');
  const [autoPlanLoading, setAutoPlanLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const { restMode } = useEnergy();

  const weekDates = useMemo(() => {
    const start = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { dateStr: toDateStr(d), label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) };
    });
  }, []);

  const handleAutoPlan = async () => {
    setAutoPlanLoading(true);
    try {
      const fetchedEvents = googleToken ? await fetchWeeklyEvents(googleToken) : [];
      const filled = autoFillWeek(goals ?? [], fetchedEvents, new Date());
      setWeekAssignments((prev) => ({ ...prev, ...filled }));
      if (saveDayPlanForDate) {
        for (const [dateStr, dayAssignments] of Object.entries(filled)) {
          await saveDayPlanForDate(dateStr, dayAssignments);
        }
      }
    } catch (e) {
      console.warn('Auto-fill week failed', e);
    } finally {
      setAutoPlanLoading(false);
    }
  };

  const handlePushToCalendar = async () => {
    const provider = googleToken ? 'google' : msToken ? 'outlook' : null;
    const token = googleToken ?? msToken ?? null;
    if (!provider || !token) return;
    setPushLoading(true);
    try {
      for (const [dateStr, dayAssignments] of Object.entries(weekAssignments ?? {})) {
        if (!dayAssignments || typeof dayAssignments !== 'object') continue;
        for (const [hour, assignment] of Object.entries(dayAssignments)) {
          const title = getTitleFromAssignment(assignment, goals);
          const [hStr] = hour.split(':');
          const hourNum = parseInt(hStr, 10) || 0;
          const startTime = `${dateStr}T${String(hourNum).padStart(2, '0')}:00:00`;
          const endTime = `${dateStr}T${String(hourNum + 1).padStart(2, '0')}:00:00`;
          const eventObj = { title, startTime, endTime };
          await pushToCalendar(provider, eventObj, token);
        }
      }
    } catch (e) {
      console.warn('Push to calendar failed', e);
    } finally {
      setPushLoading(false);
    }
  };

  const { localEvents, crossDomainEvents } = getRelevantEvents(weekContext, activePlot);
  const stormy = crossDomainEvents.length > 0;
  const crossDomains = [...new Set(crossDomainEvents.map((e) => DOMAIN_TO_PLOT_LABEL[e.domain]))];

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 gap-6">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="font-serif text-stone-900 text-3xl md:text-4xl">
              The Weekly Bento
            </h1>
            {onStartFocus && (
              <button
                type="button"
                onClick={onStartFocus}
                className="px-4 py-2 font-sans text-sm bg-moss-500 text-stone-50 rounded-lg hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
              >
                Start Focus
              </button>
            )}
          </div>
          <GardenNavigation activePlot={activePlot} onSelect={setActivePlot} />
        </header>

        {/* Rest Mode — energy critical */}
        {restMode && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 font-sans text-sm"
            role="alert"
          >
            <span aria-hidden>🌿</span>
            <span>Energy critical. Suggesting low-impact tasks only.</span>
          </div>
        )}

        {/* Shelter Notice — cross-wind from other plots */}
        {stormy && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-stone-200 bg-stone-100 text-stone-700 font-sans text-sm"
            role="status"
            aria-live="polite"
          >
            <span className="shrink-0 text-stone-500" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.59 4.59A2 2 0 1 1 11 8H2" />
                <path d="M10.59 12.41A2 2 0 1 0 14 16H2" />
                <path d="M15.73 8.27A2 2 0 1 1 19 12H2" />
              </svg>
            </span>
            <span>
              Strong headwinds from {crossDomains.join(', ')} today. Recommended: Gentle tasks only.
            </span>
          </div>
        )}

        {/* Section 1: The Terrain — Weather */}
        <section
          className="rounded-lg border-2 border-moss-500 bg-stone-50 p-4"
          aria-label="The Terrain — weather and context"
        >
          <h2 className="font-serif text-stone-900 text-lg mb-3">The Terrain</h2>
          <WeatherWidget localEvents={localEvents} crossDomainEvents={crossDomainEvents} />
        </section>

        {/* Section 2: The Plan — Garden beds / Goal cards */}
        <section
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          aria-label="The Plan — weekly goals"
        >
          <h2 className="font-serif text-stone-900 text-lg col-span-full">The Plan</h2>
          {[1, 2, 3].map((n) => (
            <GoalCardPlaceholder
              key={n}
              stormy={stormy}
              dimmed={restMode}
              highCost
            />
          ))}
        </section>

        {/* Section 3: The Schedule */}
        <section
          className="rounded-lg border-2 border-moss-500 bg-stone-50 p-4 min-h-[120px]"
          aria-label="The Schedule — time blocking"
        >
          <h2 className="font-serif text-stone-900 text-lg mb-3">The Schedule</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={handleAutoPlan}
              disabled={autoPlanLoading}
              className="px-3 py-2 font-sans text-sm bg-moss-100 text-moss-800 rounded-lg hover:bg-moss-200 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-60"
            >
              ✨ Auto-Fill Week
            </button>
            <button
              type="button"
              onClick={handlePushToCalendar}
              disabled={pushLoading || (!googleToken && !msToken)}
              className="px-3 py-2 font-sans text-sm bg-stone-200 text-stone-800 rounded-lg hover:bg-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-500/50 disabled:opacity-60"
            >
              📅 Push to Calendar
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {weekDates.map(({ dateStr, label }) => {
              const dayAssignments = (weekAssignments ?? {})[dateStr] ?? {};
              const entries = Object.entries(dayAssignments).sort(([a], [b]) => a.localeCompare(b));
              return (
                <div key={dateStr} className="rounded-lg border border-stone-200 bg-white p-2 min-h-[80px]">
                  <div className="font-sans text-xs font-medium text-stone-500 mb-2 truncate">{label}</div>
                  <ul className="space-y-1">
                    {entries.map(([time, assignment]) => (
                      <li key={`${dateStr}-${time}`} className="font-sans text-xs text-stone-800 truncate" title={getTitleFromAssignment(assignment, goals)}>
                        <span className="text-stone-400">{time}</span> {getTitleFromAssignment(assignment, goals)}
                      </li>
                    ))}
                  </ul>
                  {entries.length === 0 && (
                    <p className="font-sans text-xs text-stone-400 italic">No tasks</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default WeeklyPlanner;
