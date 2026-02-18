import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { timeToMinutes, minutesToTime } from '../../services/schedulerService';

const HOUR_START = 6;
const HOUR_END = 23;

function getCurrentSlotKey(now) {
  if (!now || !(now instanceof Date)) return null;
  const h = now.getHours();
  if (h < HOUR_START || h > HOUR_END) return null;
  return `${String(h).padStart(2, '0')}:00`;
}

function getGoalIdFromAssignment(a) {
  if (a == null) return null;
  if (typeof a === 'string') return a;
  if (typeof a === 'object' && a.parentGoalId) return a.parentGoalId;
  if (typeof a === 'object' && a.goalId) return a.goalId;
  return null;
}

function getAssignmentTitle(assignment, goals) {
  if (!assignment) return null;
  if (typeof assignment === 'object' && assignment.title) return assignment.title;
  const gid = getGoalIdFromAssignment(assignment);
  const goal = (goals ?? []).find((g) => g.id === gid);
  return goal?.title ?? 'Focus';
}

/**
 * Compact "compass" card showing current hour's status: assigned task with Play, free time, or storm rest.
 * Uses glassmorphism and slides in from the top.
 */
export default function CompassWidget({
  assignments = {},
  goals = [],
  now = new Date(),
  weather = 'sun',
  onStartFocus,
  onPlantHere,
}) {
  const slotKey = useMemo(() => getCurrentSlotKey(now), [now]);
  const assignment = slotKey ? assignments[slotKey] : null;
  const goalId = getGoalIdFromAssignment(assignment);
  const title = getAssignmentTitle(assignment, goals);
  const isStorm = weather === 'storm';

  const minutesNow = useMemo(() => {
    if (!now || !(now instanceof Date)) return 0;
    return now.getHours() * 60 + now.getMinutes();
  }, [now]);

  const slotStartMinutes = slotKey ? timeToMinutes(slotKey) : 0;
  const slotEndMinutes = slotStartMinutes + 60;
  const minutesRemaining = Math.max(0, slotEndMinutes - minutesNow);

  const status = useMemo(() => {
    if (isStorm) return 'storm';
    if (assignment && goalId && goals.some((g) => g.id === goalId)) return 'assigned';
    return 'free';
  }, [isStorm, assignment, goalId, goals]);

  if (!slotKey) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 24, stiffness: 300 }}
      className="rounded-2xl border border-white/40 bg-white/60 shadow-lg backdrop-blur-md overflow-hidden"
    >
      <div className="p-4">
        {status === 'storm' && (
          <>
            <p className="font-serif text-stone-800 text-xl md:text-2xl font-medium">
              Take Shelter / Rest
            </p>
            <p className="font-sans text-sm text-stone-500 mt-1">
              Stormy weather. Be gentle with yourself.
            </p>
          </>
        )}

        {status === 'assigned' && (
          <>
            <p className="font-sans text-xs uppercase tracking-wider text-stone-500 mb-1">
              Now · {slotKey}
            </p>
            <p className="font-serif text-stone-900 text-xl md:text-2xl font-medium leading-tight">
              {title}
            </p>
            <p className="font-sans text-sm text-stone-600 mt-2">
              {minutesRemaining > 0 ? `${minutesRemaining} min left` : 'Slot ending'}
            </p>
            {onStartFocus && (
              <button
                type="button"
                onClick={() => onStartFocus(assignment, slotKey)}
                className="mt-4 w-full py-3 rounded-xl bg-moss-500 text-white font-sans font-medium text-base hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 focus:ring-offset-white/80 transition-colors flex items-center justify-center gap-2"
                aria-label={`Start focus: ${title}`}
              >
                <span aria-hidden>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                Play
              </button>
            )}
          </>
        )}

        {status === 'free' && (
          <>
            <p className="font-sans text-xs uppercase tracking-wider text-stone-500 mb-1">
              Now · {slotKey}
            </p>
            <p className="font-serif text-stone-800 text-xl md:text-2xl font-medium">
              Free Time
            </p>
            <p className="font-sans text-sm text-stone-500 mt-1">
              No block scheduled this hour.
            </p>
            {onPlantHere && (
              <button
                type="button"
                onClick={() => onPlantHere(slotKey)}
                className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-stone-300 text-stone-600 font-sans font-medium text-sm hover:border-moss-400 hover:text-moss-700 hover:bg-moss-50/50 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                aria-label="Plant a seed here"
              >
                Plant a seed here
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
