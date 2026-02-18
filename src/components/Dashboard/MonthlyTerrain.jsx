import { useState, useEffect, useMemo } from 'react';
import { fetchMonthEvents } from '../../services/googleCalendarService';
import DayDetailModal from './DayDetailModal';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Density: 1-2 = light (green), 3-4 = moderate (yellow), 5+ or any storm = heavy (red) */
function getDayDensity(dayEvents) {
  if (!dayEvents?.length) return 'empty';
  const count = dayEvents.length;
  const hasStorm = dayEvents.some((e) => e.type === 'storm');
  if (hasStorm || count >= 5) return 'heavy';
  if (count >= 3) return 'moderate';
  return 'light';
}

function DensityDot({ density }) {
  if (density === 'empty') {
    return <span className="inline-block w-2 h-2 rounded-full bg-stone-200" aria-hidden />;
  }
  if (density === 'heavy') {
    return <span className="inline-block w-2 h-2 rounded-full bg-red-500" aria-hidden />;
  }
  if (density === 'moderate') {
    return <span className="inline-block w-2 h-2 rounded-full bg-amber-400" aria-hidden />;
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-moss-500" aria-hidden />;
}

export default function MonthlyTerrain({ googleToken, year: yearProp, month: monthProp }) {
  const now = new Date();
  const [year, setYear] = useState(yearProp ?? now.getFullYear());
  const [month, setMonth] = useState(monthProp ?? now.getMonth() + 1);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    if (!googleToken) {
      setEvents([]);
      return;
    }
    setLoading(true);
    fetchMonthEvents(googleToken, year, month)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [googleToken, year, month]);

  const { grid, daysInMonth, firstWeekday } = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const daysInMonth = last.getDate();
    const firstWeekday = (first.getDay() + 6) % 7;
    const totalCells = 7 * 5;
    const grid = [];
    for (let i = 0; i < totalCells; i++) {
      const dayOfMonth = i - firstWeekday + 1;
      grid.push(dayOfMonth >= 1 && dayOfMonth <= daysInMonth ? dayOfMonth : null);
    }
    return { grid, daysInMonth, firstWeekday };
  }, [year, month]);

  const eventsByDay = useMemo(() => {
    const byDay = {};
    events.forEach((e) => {
      const d = new Date(e.start);
      if (d.getFullYear() === year && d.getMonth() === month - 1) {
        const day = d.getDate();
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(e);
      }
    });
    return byDay;
  }, [events, year, month]);

  const dayDensities = useMemo(() => {
    const out = {};
    for (let day = 1; day <= daysInMonth; day++) {
      out[day] = getDayDensity(eventsByDay[day] ?? []);
    }
    return out;
  }, [eventsByDay, daysInMonth]);

  const heavyDayCount = useMemo(() => {
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (dayDensities[day] === 'heavy') count++;
    }
    return count;
  }, [dayDensities, daysInMonth]);

  const seasonalForecast =
    daysInMonth > 0 && heavyDayCount / daysInMonth > 0.5
      ? 'A Stormy Month ahead. Protect your weekends.'
      : null;

  const monthLabel = useMemo(
    () => new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [year, month]
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="font-serif text-stone-800 text-lg mb-2">The Season</h2>
      <p className="font-sans text-stone-500 text-sm mb-4">{monthLabel}</p>

      {seasonalForecast && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="font-serif text-amber-900 text-sm">Seasonal Forecast</p>
          <p className="font-sans text-amber-800 text-sm mt-0.5">{seasonalForecast}</p>
        </div>
      )}

      {!googleToken && (
        <p className="font-sans text-stone-400 text-sm mb-4">Connect Calendar on Dashboard to see your month.</p>
      )}

      {loading && (
        <p className="font-sans text-stone-500 text-sm mb-4">Loading…</p>
      )}

      <div className="bg-[#FDFCF5] rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-100/60">
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="py-2 text-center font-sans text-xs font-medium text-stone-600 uppercase tracking-wider"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr" style={{ aspectRatio: '7/5' }}>
          {grid.map((dayOfMonth, i) => {
            const density = dayOfMonth != null ? dayDensities[dayOfMonth] : 'empty';
            const isToday =
              dayOfMonth != null &&
              year === now.getFullYear() &&
              month === now.getMonth() + 1 &&
              dayOfMonth === now.getDate();
            const dayEvents = dayOfMonth != null ? (eventsByDay[dayOfMonth] ?? []) : [];
            const dateLabel = dayOfMonth != null
              ? new Date(year, month - 1, dayOfMonth).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
              : '';
            const dayTitle =
              dayOfMonth == null
                ? ''
                : dayEvents.length === 0
                  ? 'No events'
                  : `${dayEvents.length} Event(s): 1. ${(dayEvents[0].title || 'Event').slice(0, 40)}${(dayEvents[0].title || '').length > 40 ? '...' : ''}`;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (dayOfMonth != null) setSelectedDay({ date: dateLabel, events: dayEvents });
                }}
                className={`
                  min-h-[48px] flex flex-col items-center justify-center p-1 border-b border-r border-stone-100
                  ${i % 7 === 6 ? 'border-r-0' : ''}
                  ${dayOfMonth == null ? 'bg-stone-50/50 cursor-default' : 'bg-white cursor-pointer hover:bg-stone-100 transition-colors'}
                  ${isToday ? 'ring-1 ring-moss-500/50 bg-moss-50/30' : ''}
                `}
                title={dayTitle}
                disabled={dayOfMonth == null}
              >
                {dayOfMonth != null && (
                  <>
                    <span
                      className={`font-sans text-xs mb-1 ${isToday ? 'text-moss-700 font-semibold' : 'text-stone-500'}`}
                    >
                      {dayOfMonth}
                    </span>
                    <DensityDot density={density} />
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <DayDetailModal
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}

      <div className="mt-4 flex items-center gap-4 font-sans text-xs text-stone-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-moss-500" /> 1–2 events
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> 3–4 events
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> 5+ or Storm
        </span>
      </div>
    </div>
  );
}
