import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { fetchGoogleEvents } from '../../services/googleCalendarService';
import WeeklyReview from './WeeklyReview';
import GardenIntro from './GardenIntro';
import EventPruner from './EventPruner';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Find the coming Monday (or today if Monday), then return 7 day templates (Mon–Sun) with real dates. */
function generateCurrentWeek() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return {
      id: `day-${i}`,
      day: DAY_LABELS[i],
      date: dateStr,
      dayIndex: i,
      events: [],
    };
  });
}

// Helper to determine the "Dominant" weather for the animation
const getDominantWeather = (events) => {
  if (!events || events.length === 0) return 'sun'; // Default to sun if empty
  
  const types = events.map(e => e.type);
  if (types.includes('storm')) return 'storm'; // Storm overrides everything
  if (types.includes('leaf')) return 'leaf';   // Work overrides rest
  return 'sun'; // Only sun remains
};

/** Monday 00:00 of the current ritual week (same as generateCurrentWeek). */
function getWeekMonday() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default function SundayRitualController({ onComplete }) {
  const { weeklyEvents, updateWeeklyEvents, googleToken } = useGarden();
  const [step, setStep] = useState('harvest');
  const [googleEvents, setGoogleEvents] = useState([]);
  const [importingFromCloud, setImportingFromCloud] = useState(false);

  const weekDays = useMemo(() => generateCurrentWeek(), []);
  const monday = useMemo(() => getWeekMonday(), []);

  useEffect(() => {
    if (!googleToken) return;
    const start = new Date(monday);
    const end = new Date(monday);
    end.setDate(end.getDate() + 7);
    fetchGoogleEvents(googleToken, start, end)
      .then((events) => {
        console.log('Fetching Events...', events);
        setGoogleEvents(events);
      })
      .catch((e) => console.warn('SundayRitual: fetch Google events failed', e));
  }, [googleToken, monday]);

  const initialEvents = useMemo(() => {
    const fromContext = Array.isArray(weeklyEvents) ? weeklyEvents : [];
    if (googleEvents.length === 0) return fromContext;
    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 7);
    const mapped = googleEvents
      .filter((e) => {
        const d = new Date(e.start);
        return d >= monday && d < weekEnd;
      })
      .map((e) => {
        const d = new Date(e.start);
        return {
          id: e.id,
          title: e.title,
          type: e.type ?? 'leaf',
          dayIndex: (d.getDay() + 6) % 7,
        };
      });
    return [...fromContext, ...mapped];
  }, [weeklyEvents, googleEvents, monday]);

  const eventsByDay = useMemo(
    () => Array.from({ length: 7 }, (_, i) => initialEvents.filter((e) => e.dayIndex === i)),
    [initialEvents]
  );
  const weeklyWeather = useMemo(
    () => eventsByDay.map((dayEvents) => getDominantWeather(dayEvents)),
    [eventsByDay]
  );

  const handleCommit = (events) => {
    updateWeeklyEvents(events);
    const committedWeather = Array.from({ length: 7 }, (_, i) =>
      getDominantWeather(events.filter((e) => e.dayIndex === i))
    );
    onComplete?.({ events, weeklyWeather: committedWeather });
  };

  const handleImportFromCloud = useCallback(
    async (currentEvents) => {
      if (!googleToken) return null;
      setImportingFromCloud(true);
      try {
        const nextMonday = getWeekMonday();
        const nextSunday = new Date(nextMonday);
        nextSunday.setDate(nextMonday.getDate() + 7);
        const raw = await fetchGoogleEvents(googleToken, nextMonday, nextSunday);
        const mapped = raw.map((e) => ({
          id: e.id,
          title: e.title,
          type: e.type ?? 'leaf',
          dayIndex: (new Date(e.start).getDay() + 6) % 7,
        }));
        const fetchedIds = new Set(mapped.map((x) => x.id));
        const merged = [
          ...(currentEvents || []).filter((ev) => !fetchedIds.has(ev.id)),
          ...mapped,
        ];
        return merged;
      } catch (e) {
        console.warn('Import from cloud failed', e);
        return null;
      } finally {
        setImportingFromCloud(false);
      }
    },
    [googleToken]
  );

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {step === 'harvest' && (
          <motion.div key="harvest" exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl">
            <WeeklyReview onComplete={() => setStep('intro')} />
          </motion.div>
        )}

        {step === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl">
            <GardenIntro
              weeklyWeather={weeklyWeather}
              onComplete={() => setStep('pruning')}
            />
          </motion.div>
        )}

        {step === 'pruning' && (
          <motion.div key="pruner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
            <EventPruner
              weekDays={weekDays}
              initialEvents={initialEvents}
              onCommit={handleCommit}
              googleToken={googleToken}
              onImportFromCloud={handleImportFromCloud}
              importingFromCloud={importingFromCloud}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}