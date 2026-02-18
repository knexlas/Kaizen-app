import { useState, useEffect } from 'react';
import { fetchWeeklyEvents } from '../../services/CalendarImport';

const WEATHER_CYCLE = ['storm', 'cloud', 'sun'];
const WEATHER_ICONS = { storm: '⛈️', cloud: '☁️', sun: '☀️' };

function formatEventDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function EventRow({ event, weather, onWeatherClick }) {
  return (
    <li className="flex items-center gap-4 py-3 border-b border-stone-200 last:border-0 font-sans text-sm">
      <span className="text-stone-500 w-36 shrink-0">{formatEventDate(event.start)}</span>
      <span className="flex-1 text-stone-900 truncate">{event.title}</span>
      <button
        type="button"
        onClick={onWeatherClick}
        className="shrink-0 w-10 h-10 flex items-center justify-center text-2xl rounded-lg border border-stone-300 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-stone-800 text-stone-50 font-sans text-sm shadow-lg"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

function SundayRitual() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState({});
  const [toast, setToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchWeeklyEvents().then((data) => {
      if (!cancelled) {
        setEvents(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const getWeather = (event) => overrides[event.id] ?? event.weather;

  const handleWeatherClick = (event) => {
    const current = getWeather(event);
    const idx = WEATHER_CYCLE.indexOf(current);
    const next = WEATHER_CYCLE[(idx + 1) % WEATHER_CYCLE.length];
    setOverrides((prev) => ({ ...prev, [event.id]: next }));
    setToast(true);
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 p-6 flex items-center justify-center">
        <p className="font-sans text-stone-500">Loading your week…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-stone-900 text-3xl mb-2">Sunday Ritual</h1>
        <p className="font-sans text-stone-600 text-sm mb-6">
          Review and adjust how each event will feel. Click the icon to cycle: Storm → Cloud → Sun.
        </p>
        <ul className="border border-moss-500 rounded-lg border-2 bg-stone-50 divide-y divide-stone-200 overflow-hidden">
          {events.length === 0 ? (
            <li className="py-8 text-center font-sans text-stone-500 text-sm">No events this week.</li>
          ) : (
            events.map((ev) => (
              <EventRow
                key={ev.id}
                event={ev}
                weather={getWeather(ev)}
                onWeatherClick={() => handleWeatherClick(ev)}
              />
            ))
          )}
        </ul>
      </div>
      <Toast message="Insight saved." visible={toast} />
    </div>
  );
}

export default SundayRitual;
