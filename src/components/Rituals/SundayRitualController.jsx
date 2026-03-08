import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { fetchGoogleEvents } from '../../services/googleCalendarService';
import { getVolumePacing } from '../../services/plannerEngine';
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

/** Goals that are overarching projects or high-level (have subtasks or are project-type). */
function northStarCandidates(goals) {
  if (!Array.isArray(goals)) return [];
  return goals.filter(
    (g) =>
      (Array.isArray(g.subtasks) && g.subtasks.length > 0) ||
      g._projectGoal === true
  );
}

/** Build blocks for spawning: e.g. 10 hrs -> five 2-hr blocks. */
function buildSpawnBlocks(goal, totalValue, blockSize = 2) {
  const blocks = [];
  let remaining = totalValue;
  const metric = goal.targetMetric ?? 'Hours';
  const uid = () => `spawned-${goal.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  while (remaining > 0) {
    const value = Math.min(blockSize, remaining);
    blocks.push({
      id: uid(),
      goalId: goal.id,
      goalTitle: goal.title,
      blockValue: value,
      targetMetric: metric,
    });
    remaining -= value;
  }
  return blocks;
}

function PacingStep({ goals, addSpawnedVolumeBlocks, onContinue }) {
  const pacing = useMemo(() => getVolumePacing(goals), [goals]);
  const handleSpawn = useCallback(
    (pacingItem) => {
      const { goal, valuePerWeek } = pacingItem;
      const total = Math.max(0.5, Math.round(valuePerWeek * 10) / 10);
      const blocks = buildSpawnBlocks(goal, total);
      if (blocks.length > 0) addSpawnedVolumeBlocks(blocks);
      window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: `Added ${blocks.length} block(s) to your Staging Area. Drag them onto days in the Command Center.` } }));
    },
    [addSpawnedVolumeBlocks]
  );

  return (
    <div className="w-full max-w-2xl rounded-xl border-2 border-moss-500 bg-stone-50 shadow-sm overflow-hidden">
      <header className="p-6 pb-4 border-b border-stone-200">
        <h1 className="font-serif text-stone-900 text-2xl md:text-3xl">Pacing Guide</h1>
        <p className="font-sans text-stone-600 text-sm mt-1">
          Volume goals: how much to aim for this week to stay on track.
        </p>
      </header>
      <div className="p-6">
        {pacing.length === 0 ? (
          <p className="font-sans text-stone-500 text-sm mb-6">No active volume goals. Add a Quota/Volume goal to see pacing here.</p>
        ) : (
          <ul className="space-y-4 mb-6">
            {pacing.map(({ goal, remaining, remainingWeeks, valuePerWeek, deadlineStr }) => (
              <li key={goal.id} className="p-4 rounded-xl border border-stone-200 bg-white">
                <p className="font-sans text-stone-800 font-medium mb-1">{goal.title}</p>
                <p className="font-sans text-sm text-stone-600 mb-3">
                  To hit your {goal.targetValue} { (goal.targetMetric || 'Hours').toLowerCase() } goal{deadlineStr ? ` by the ${deadlineStr}` : ''}, you need to average <strong>{valuePerWeek}</strong> {(goal.targetMetric || 'Hours').toLowerCase()} this week.
                </p>
                <button
                  type="button"
                  onClick={() => handleSpawn({ goal, remaining, remainingWeeks, valuePerWeek, deadlineStr })}
                  className="py-2 px-4 rounded-lg font-sans text-sm font-medium bg-moss-500 text-white hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                >
                  Spawn {valuePerWeek} {(goal.targetMetric || 'Hours').toLowerCase()} into Staging Area
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onContinue}
            className="py-3 px-6 font-sans font-medium rounded-lg bg-moss-500 text-stone-50 hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function NorthStarStep({ goals, weeklyNorthStarId, onSelect, onContinue }) {
  const candidates = northStarCandidates(goals);
  const selected = weeklyNorthStarId != null;

  return (
    <div className="w-full max-w-2xl rounded-xl border-2 border-moss-500 bg-stone-50 shadow-sm overflow-hidden">
      <header className="p-6 pb-4 border-b border-stone-200">
        <h1 className="font-serif text-stone-900 text-2xl md:text-3xl">
          The North Star
        </h1>
        <p className="font-sans text-stone-600 text-sm mt-1">
          What is your absolute #1 focus for this week?
        </p>
      </header>

      <div className="p-6">
        {!selected ? (
          <>
            {candidates.length === 0 ? (
              <p className="font-sans text-stone-500 text-sm mb-4">
                Add a project or goal with steps to choose one as your North Star.
              </p>
            ) : (
              <ul className="space-y-3">
                {candidates.map((goal) => (
                  <li key={goal.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(goal.id)}
                      className="w-full text-left p-4 rounded-xl border-2 border-stone-200 bg-white hover:border-moss-400 hover:bg-moss-50/50 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors font-sans text-stone-900"
                    >
                      <span className="font-medium">{goal.title}</span>
                      {Array.isArray(goal.subtasks) && goal.subtasks.length > 0 && (
                        <span className="block text-xs text-stone-500 mt-1">
                          {goal.subtasks.length} step{goal.subtasks.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="font-sans text-moss-700 text-base mb-6">
              Got it. Mochi will ensure tasks related to this get VIP treatment.
            </p>
          </>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {candidates.length > 0 && !selected && (
            <button
              type="button"
              onClick={onContinue}
              className="py-3 px-6 font-sans font-medium rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
            >
              Skip for now
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            disabled={candidates.length > 0 && !selected}
            className="py-3 px-6 font-sans font-medium rounded-lg bg-moss-500 text-stone-50 hover:bg-moss-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
          >
            {selected ? 'Continue' : candidates.length === 0 ? 'Skip' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SundayRitualController({ onComplete }) {
  const { goals, weeklyEvents, updateWeeklyEvents, weeklyNorthStarId, setWeeklyNorthStarId, googleToken, addSpawnedVolumeBlocks } = useGarden();
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
              onComplete={() => setStep('northStar')}
            />
          </motion.div>
        )}

        {step === 'northStar' && (
          <motion.div key="northStar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl">
            <NorthStarStep
              goals={goals}
              weeklyNorthStarId={weeklyNorthStarId}
              onSelect={setWeeklyNorthStarId}
              onContinue={() => setStep('pacing')}
            />
          </motion.div>
        )}

        {step === 'pacing' && (
          <motion.div key="pacing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl">
            <PacingStep goals={goals} addSpawnedVolumeBlocks={addSpawnedVolumeBlocks} onContinue={() => setStep('pruning')} />
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
