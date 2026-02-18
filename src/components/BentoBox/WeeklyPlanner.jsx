import { useState } from 'react';
import { useEnergy } from '../../context/EnergyContext';
import GardenNavigation from './GardenNavigation';
import WeatherWidget from './WeatherWidget';
import GoalCardPlaceholder from './GoalCardPlaceholder';

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
  const [weekContext] = useState(INITIAL_WEEK_CONTEXT);
  const [activePlot, setActivePlot] = useState('all');
  const { restMode } = useEnergy();

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
          <div className="border border-dashed border-moss-500/50 rounded-md min-h-[80px] flex items-center justify-center font-sans text-sm text-stone-900/60">
            Time Blocker
          </div>
        </section>
      </div>
    </div>
  );
}

export default WeeklyPlanner;
