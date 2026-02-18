import { useState, useMemo } from 'react';
import DayDetailModal from './DayDetailModal';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COSTS = { storm: 3, leaf: 1, sun: -1 };

const StormIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-600 shrink-0 mx-auto">
    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 11l-4 6h6l-4 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const LeafIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-moss-500 shrink-0 mx-auto">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SunIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-500 shrink-0 mx-auto">
    <circle cx="12" cy="12" r="5" strokeWidth="2" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

function getDominantWeather(dayEvents) {
  if (!dayEvents?.length) return 'sun';
  const types = dayEvents.map((e) => e.type);
  if (types.includes('storm')) return 'storm';
  if (types.includes('leaf')) return 'leaf';
  return 'sun';
}

function getDayCost(dayEvents) {
  if (!dayEvents?.length) return 0;
  return dayEvents.reduce((sum, e) => sum + (COSTS[e.type] ?? 0), 0);
}

function getBarHeight(cost) {
  if (cost > 5) return 'h-32';
  if (cost > 2) return 'h-24';
  if (cost > 0) return 'h-20';
  return 'h-16';
}

function getBarColor(cost) {
  if (cost > 5) return 'bg-slate-400';
  if (cost > 0) return 'bg-moss-400';
  return 'bg-amber-300';
}

// Normalize events: support both { dayIndex, type } and { date, defaultWeather }
function normalizeEvents(raw) {
  const list = Array.isArray(raw) ? raw : raw?.events ?? [];
  return list.map((e) => {
    if (e.dayIndex != null && e.type != null) return e;
    const date = e.date instanceof Date ? e.date : new Date(e.date);
    const dayIndex = (date.getDay() + 6) % 7; // Mon=0 .. Sun=6
    const type = e.type ?? (e.defaultWeather === 'cloud' ? 'leaf' : e.defaultWeather ?? 'sun');
    return { ...e, dayIndex, type, title: e.title ?? 'Event' };
  });
}

export default function WeeklyMap({ weeklyPlan, selectedDate, onSelectDate, weekDateLabels }) {
  const [hoveredDay, setHoveredDay] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const events = useMemo(() => normalizeEvents(weeklyPlan), [weeklyPlan]);

  const dayData = useMemo(() => {
    return DAY_LABELS.map((label, dayIndex) => {
      const dayEvents = events.filter((e) => e.dayIndex === dayIndex);
      const cost = getDayCost(dayEvents);
      const date = Array.isArray(weekDateLabels) && weekDateLabels[dayIndex] != null
        ? weekDateLabels[dayIndex]
        : label;
      return {
        label,
        dayIndex,
        dayEvents,
        date,
        cost,
        weather: getDominantWeather(dayEvents),
        barHeight: getBarHeight(cost),
        barColor: getBarColor(cost),
      };
    });
  }, [events, weekDateLabels]);

  return (
    <>
    <div className="w-full overflow-hidden">
      <h2 className="font-serif text-stone-800 text-lg mb-6">Weekly Terrain</h2>
      <div className="grid grid-cols-7 gap-2 md:gap-4 overflow-hidden min-w-0">
        {dayData.map((day) => {
          const WeatherIcon =
            day.weather === 'storm' ? StormIcon : day.weather === 'leaf' ? LeafIcon : SunIcon;
          const isHovered = hoveredDay === day.dayIndex;
          const isSelected = selectedDate === day.dayIndex;
          return (
            <button
              key={day.dayIndex}
              type="button"
              onClick={() => {
                onSelectDate?.(day.dayIndex);
                setSelectedDay({ date: day.date, events: day.dayEvents });
              }}
              className={`flex flex-col items-center relative cursor-pointer rounded-lg py-2 px-1 min-w-0 w-full h-[140px] transition-colors transition-transform duration-200 hover:scale-105 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                isSelected ? 'ring-2 ring-moss-500 border-2 border-moss-500/60' : ''
              }`}
              onMouseEnter={() => setHoveredDay(day.dayIndex)}
              onMouseLeave={() => setHoveredDay(null)}
              title={
                day.dayEvents.length === 0
                  ? 'No events'
                  : `${day.dayEvents.length} Event(s): 1. ${(day.dayEvents[0].title || 'Event').slice(0, 40)}${(day.dayEvents[0].title || '').length > 40 ? '...' : ''}`
              }
              aria-pressed={isSelected}
              aria-label={`${day.label}, ${day.dayEvents.length} events`}
            >
              {/* Icon: fixed height so it doesn't shift */}
              <div className="w-8 aspect-square flex-shrink-0 flex items-center justify-center mb-2">
                <WeatherIcon />
              </div>
              {/* Bar: grows from bottom so label stays fixed */}
              <div className="flex-1 flex flex-col justify-end items-center w-full min-h-0">
                <div
                  className={`w-full max-w-[48px] min-h-[4px] rounded-t transition-all duration-300 ${day.barHeight} ${day.barColor}`}
                  aria-hidden
                />
              </div>
              {/* Day label fixed at bottom */}
              <span className={`flex-shrink-0 mt-2 font-sans text-xs uppercase tracking-wider ${isSelected ? 'text-moss-600 font-medium' : 'text-stone-500'}`}>
                {day.label}
              </span>
              {/* Tooltip */}
              {isHovered && (
                <div
                  className="absolute z-10 top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 rounded-lg bg-stone-800 text-stone-100 font-sans text-sm shadow-lg whitespace-nowrap pointer-events-none"
                  role="tooltip"
                >
                  {day.dayEvents.length === 0 ? (
                    <span className="text-stone-400">No events</span>
                  ) : (
                    <ul className="space-y-1">
                      {day.dayEvents.map((ev) => (
                        <li key={ev.id ?? ev.title}>{ev.title}</li>
                      ))}
                    </ul>
                  )}
                </div>
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
    </>
  );
}
