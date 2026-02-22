import { useState, useEffect } from 'react';
import { useEnergy } from '../../context/EnergyContext';
import GardenIntro from './GardenIntro';

const WEATHER_CYCLE = ['storm', 'cloud', 'sun'];
const WEATHER_ICONS = { storm: '⛈️', cloud: '☁️', sun: '☀️' };

/** Spoon cost: Storm +2, Cloud +1, Sun -1 (restorative). */
const SPOON_COST = { storm: 2, cloud: 1, sun: -1 };

const BORDER_CLASS = {
  storm: 'border-l-4 border-slate-400',
  cloud: 'border-l-4 border-stone-200',
  sun: 'border-l-4 border-amber-300',
};

function formatDay(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function EventRow({ event, weather, onWeatherClick }) {
  const borderClass = BORDER_CLASS[weather];
  const dayLabel = event.date
    ? formatDay(event.date instanceof Date ? event.date : new Date(event.date))
    : (event.dayIndex != null ? DAY_LABELS[event.dayIndex] : '—');
  const timeLabel = event.time ?? '';
  return (
    <li
      className={`flex items-center gap-4 py-3 px-4 bg-stone-50 border-l-4 ${borderClass} border-b border-stone-200/80 last:border-b-0 font-sans text-sm transition-[border-color] duration-300`}
    >
      <span className="text-stone-500 w-40 shrink-0">
        {dayLabel}{timeLabel ? ` · ${timeLabel}` : ''}
      </span>
      <span className="flex-1 text-stone-900 truncate">{event.title}</span>
      <button
        type="button"
        onClick={onWeatherClick}
        className="shrink-0 w-10 h-10 flex items-center justify-center text-2xl rounded-lg border border-stone-300 hover:bg-moss-100/50 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-transform duration-200 hover:scale-105 active:scale-95"
        title={`Weather: ${weather}. Click to change.`}
        aria-label={`Event weather ${weather}. Click to cycle.`}
      >
        {WEATHER_ICONS[weather]}
      </button>
    </li>
  );
}

function Toast({ message, visible }) {
  if (!visible) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg bg-stone-800 text-stone-50 font-sans text-sm shadow-lg transition-opacity duration-300"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

const DEFAULT_WEEKLY_WEATHER = ['cloud', 'storm', 'sun', 'cloud', 'storm', 'sun', 'cloud'];

function SundayRitual({ events = [], onCompleteRitual }) {
  const [showGardenIntro, setShowGardenIntro] = useState(true);
  const [overrides, setOverrides] = useState({});
  const [toast, setToast] = useState(null);
  const { dailyEnergy } = useEnergy();

  const weeklyWeather = events.length >= 7
    ? events.slice(0, 7).map((e) => e.defaultWeather ?? e.type ?? 'cloud')
    : DEFAULT_WEEKLY_WEATHER;

  if (showGardenIntro) {
    return (
      <GardenIntro
        weeklyWeather={weeklyWeather}
        onEnterGarden={() => setShowGardenIntro(false)}
      />
    );
  }

  const getWeather = (event) => overrides[event.id] ?? event.defaultWeather ?? event.type ?? 'cloud';

  const handleWeatherClick = (event) => {
    const current = getWeather(event);
    const idx = WEATHER_CYCLE.indexOf(current);
    const next = WEATHER_CYCLE[(idx + 1) % WEATHER_CYCLE.length];
    setOverrides((prev) => ({ ...prev, [event.id]: next }));
    setToast('Insight saved.');
  };

  const totalSpoonCost = events.reduce((sum, ev) => sum + (SPOON_COST[getWeather(ev)] ?? 0), 0);
  const weeklyAvailable = dailyEnergy * 7;

  const handleCommit = () => {
    if (typeof onCompleteRitual === 'function') {
      onCompleteRitual(overrides);
    } else {
      const required = Math.max(0, totalSpoonCost);
      setToast(`This week requires ${required} Spoons. You have ${weeklyAvailable} available.`);
    }
  };

  useEffect(() => {
    if (toast == null) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="min-h-screen bg-stone-100 py-8 px-4 flex items-start justify-center">
      <div className="w-full max-w-2xl rounded-xl border-2 border-moss-500 bg-stone-50 shadow-sm overflow-hidden">
        <header className="p-6 pb-4 border-b border-stone-200">
          <h1 className="font-serif text-stone-900 text-2xl md:text-3xl">
            The Week Ahead
          </h1>
          <p className="font-sans text-stone-600 text-sm mt-1">
            Prune your week. Tap an event to change its weather.
          </p>
        </header>

        <ul className="divide-y divide-stone-200/80">
          {events.map((ev) => (
            <EventRow
              key={ev.id}
              event={ev}
              weather={getWeather(ev)}
              onWeatherClick={() => handleWeatherClick(ev)}
            />
          ))}
        </ul>

        <footer className="p-6 pt-4 border-t border-stone-200">
          <button
            type="button"
            onClick={handleCommit}
            className="w-full py-3 px-4 font-sans font-medium rounded-lg bg-moss-500 text-stone-50 hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
          >
            Plan My Energy
          </button>
        </footer>
      </div>

      <Toast message={toast} visible={!!toast} />
    </div>
  );
}

export default SundayRitual;
