import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import RoutinePlayer from '../Focus/RoutinePlayer';
import { localISODate } from '../../services/dateUtils';
import { RECURRING_SUPPORT_STATUSES, getRecentStatusCounts } from '../../domains/recovery/services/antiShameRecurrenceService';
import {
  getRoutineSupportPlacementForWeek,
  getRoutineSupportWeekId,
} from '../../domains/recovery/services/routineSupportPlacementService';

function normalizeFrequency(routine) {
  const perWeek = Math.max(0, Number(routine?.perWeek) || 0);
  return perWeek > 0 ? `${perWeek}x/week` : 'Recurring support';
}

function formatPlacementDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getRoutineStateMeta(routine, counts) {
  if (routine?.pausedUntil) {
    return {
      label: `Paused until ${routine.pausedUntil}`,
      tone: 'stone',
      recommendation: `Keep it paused by default, or place one lighter version for ${Math.max(5, Math.round((Number(routine?.duration) || 15) * 0.6))} min this week.`,
      secondaryAction: { type: 'place-light', label: `Do ${Math.max(5, Math.round((Number(routine?.duration) || 15) * 0.6))} min version this week` },
    };
  }
  if ((counts?.deferred || 0) >= 2) {
    return {
      label: 'Needs a gentler week',
      tone: 'amber',
      recommendation: `This has been deferred recently. Keep it, but make it lighter at ${Math.max(5, Math.round((Number(routine?.duration) || 15) * 0.6))} min this week.`,
      secondaryAction: { type: 'place-light', label: `Do ${Math.max(5, Math.round((Number(routine?.duration) || 15) * 0.6))} min version this week` },
    };
  }
  if ((counts?.skipped || 0) >= 2) {
    return {
      label: 'Needs a gentler week',
      tone: 'amber',
      recommendation: `This has been skipped recently. Keep it, but make it lighter at ${Math.max(5, Math.round((Number(routine?.duration) || 15) * 0.6))} min this week.`,
      secondaryAction: { type: 'place-light', label: `Do ${Math.max(5, Math.round((Number(routine?.duration) || 15) * 0.6))} min version this week` },
    };
  }
  if ((counts?.light || 0) >= 2) {
    return {
      label: 'Already running lighter',
      tone: 'moss',
      recommendation: 'This is already being handled more gently. Place one support block only if this week needs it.',
      secondaryAction: { type: 'skip-today', label: 'Skip for today' },
    };
  }
  return {
    label: 'Steady',
    tone: 'moss',
    recommendation: 'This looks steady. Place one support block only if it would help this week.',
    secondaryAction: { type: 'skip-today', label: 'Skip for today' },
  };
}

function getPriorityScore(routine, counts) {
  let score = 0;
  if (routine?.pausedUntil) score += 50;
  score += (counts?.deferred || 0) * 12;
  score += (counts?.skipped || 0) * 9;
  score += (counts?.light || 0) * 4;
  score += Math.min(7, Number(routine?.perWeek) || 0) * 2;
  return score;
}

function getStateToneClasses(tone) {
  if (tone === 'amber') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
  }
  if (tone === 'moss') {
    return 'bg-moss-100 text-moss-800 dark:bg-moss-900/30 dark:text-moss-200';
  }
  return 'bg-stone-100 text-stone-700 dark:bg-slate-700 dark:text-stone-200';
}

function RoutineSupportDayPicker({ intent, today, onClose, onPickDay }) {
  const weekDays = useMemo(() => {
    const start = new Date(`${today}T12:00:00`);
    return Array.from({ length: 7 }, (_, offset) => {
      const next = new Date(start);
      next.setDate(start.getDate() + offset);
      const dateStr = localISODate(next);
      const label = offset === 0
        ? 'Today'
        : offset === 1
          ? 'Tomorrow'
          : next.toLocaleDateString(undefined, { weekday: 'short' });
      const detail = next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return { dateStr, label, detail };
    });
  }, [today]);

  if (!intent) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[82] flex items-center justify-center bg-stone-950/40 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-md rounded-[28px] border border-stone-200/90 bg-white/96 p-4 shadow-2xl dark:border-slate-600/80 dark:bg-slate-900/96"
        >
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">Place support</p>
          <h3 className="mt-1 font-serif text-lg text-stone-900 dark:text-stone-100">{intent.routine.title}</h3>
          <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">
            {intent.mode === 'light'
              ? `Choose a day for the lighter ${intent.durationMinutes} minute version this week.`
              : 'Choose one day to keep this support visible in the week plan.'}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {weekDays.map(({ dateStr, label, detail }) => (
              <button
                key={dateStr}
                type="button"
                onClick={() => onPickDay(dateStr)}
                className="rounded-2xl border border-moss-200 bg-moss-50 px-3 py-3 text-center font-sans text-sm font-medium text-moss-900 transition hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-moss-800 dark:bg-moss-900/25 dark:text-moss-100 dark:hover:bg-moss-900/40"
              >
                <span className="block">{label}</span>
                <span className="mt-0.5 block text-xs font-normal text-moss-700 dark:text-moss-300">{detail}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-xl px-3 py-2 font-sans text-sm text-stone-500 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:text-stone-300 dark:hover:bg-slate-800/80"
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function RoutineSupportOptionsSheet({ item, onClose, onPlaceInWeek, onPlaceLightInWeek, onSkipToday, onPauseWeek, onRemovePlacement, onStartNow, onManageRoutines }) {
  if (!item) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[83] flex items-end justify-center bg-stone-950/45 p-4 md:items-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-md rounded-[30px] border border-stone-200/90 bg-white/96 p-4 shadow-2xl dark:border-slate-600/80 dark:bg-slate-900/96"
        >
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">Routine options</p>
          <h3 className="mt-1 font-serif text-lg text-stone-900 dark:text-stone-100">{item.routine.title}</h3>
          <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">{item.recommendation}</p>

          <div className="mt-4 space-y-2">
            <button type="button" onClick={onPlaceInWeek} className="w-full rounded-2xl bg-moss-600 px-4 py-3 text-left font-sans text-sm font-semibold text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40">
              Place in week
            </button>
            <button type="button" onClick={onPlaceLightInWeek} className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-left font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-800/70">
              Do {Math.max(5, Math.round((Number(item.routine.duration) || 15) * 0.6))} min version this week
            </button>
            <button type="button" onClick={onSkipToday} className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-left font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-800/70">
              Skip for today
            </button>
            <button type="button" onClick={onPauseWeek} className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-left font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-800/70">
              Pause until next week
            </button>
            {item.currentPlacement && (
              <button type="button" onClick={onRemovePlacement} className="w-full rounded-2xl border border-rose-200 px-4 py-3 text-left font-sans text-sm text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300/40 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950/30">
                Remove from this week
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={onStartNow} className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-800/70">
              Start now
            </button>
            <button type="button" onClick={onManageRoutines} className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-800/70">
              Manage routine
            </button>
            <button type="button" onClick={onClose} className="ml-auto rounded-xl px-3 py-2 font-sans text-sm text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:text-stone-400 dark:hover:text-stone-200">
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function PlannerRoutineSupportList({ onManageRoutines }) {
  const {
    routines = [],
    recurringSupportState = {},
    routineSupportPlacements = [],
    today,
    placeRoutineSupportInWeek,
    removeRoutineSupportPlacement,
    pauseRoutineTemporarily,
    markRoutineSupportState,
  } = useGarden();

  const [showAll, setShowAll] = useState(false);
  const [routineForPlayer, setRoutineForPlayer] = useState(null);
  const [placementIntent, setPlacementIntent] = useState(null);
  const [optionsItem, setOptionsItem] = useState(null);

  const currentWeekId = useMemo(() => getRoutineSupportWeekId(today), [today]);

  const prioritizedRoutines = useMemo(() => (
    (Array.isArray(routines) ? routines : [])
      .map((routine) => {
        const counts = getRecentStatusCounts(recurringSupportState, {
          itemType: 'routine',
          itemId: routine?.id,
          lookbackDays: 14,
        });
        const stateMeta = getRoutineStateMeta(routine, counts);
        const currentPlacement = getRoutineSupportPlacementForWeek(routineSupportPlacements, routine?.id, currentWeekId);
        return {
          routine,
          counts,
          currentPlacement,
          summary: `${normalizeFrequency(routine)} / ${Math.max(1, Number(routine?.duration) || 15)} min`,
          priorityScore: getPriorityScore(routine, counts),
          ...stateMeta,
        };
      })
      .sort((a, b) => (
        b.priorityScore - a.priorityScore
        || Number(Boolean(b.currentPlacement)) - Number(Boolean(a.currentPlacement))
        || (Number(b.routine?.perWeek) || 0) - (Number(a.routine?.perWeek) || 0)
        || String(a.routine?.title || '').localeCompare(String(b.routine?.title || ''))
      ))
      .slice(0, 6)
  ), [currentWeekId, recurringSupportState, routineSupportPlacements, routines]);

  const shouldCollapse = prioritizedRoutines.length > 4;
  const visibleRoutines = shouldCollapse && !showAll ? prioritizedRoutines.slice(0, 4) : prioritizedRoutines;

  const handlePickPlacementDay = (dateStr) => {
    if (!placementIntent?.routine?.id) return;
    placeRoutineSupportInWeek?.(placementIntent.routine.id, {
      dateStr,
      mode: placementIntent.mode,
      source: 'systems',
    });
    setPlacementIntent(null);
    setOptionsItem(null);
  };

  const handleSkipToday = (routine) => {
    if (!routine?.id) return;
    markRoutineSupportState?.(routine.id, RECURRING_SUPPORT_STATUSES.SKIPPED_COMPASSIONATELY, {
      date: localISODate(),
      note: 'Skipped for today.',
    });
    setOptionsItem(null);
  };

  const handlePauseUntilNextWeek = (routine) => {
    if (!routine?.id) return;
    pauseRoutineTemporarily?.(routine.id, 7);
    setOptionsItem(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans text-sm font-semibold text-stone-800 dark:text-stone-200">Routine supports for this week</p>
          <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">
            Place one support at a time, and only adjust what would make this week easier to hold.
          </p>
        </div>
        <button
          type="button"
          onClick={onManageRoutines}
          className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 font-sans text-xs font-medium text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/70"
        >
          Manage routines
        </button>
      </div>

      {prioritizedRoutines.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50/70 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/55">
          <p className="font-sans text-sm text-stone-700 dark:text-stone-200">No routines yet.</p>
          <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">
            Add a few lightweight supports first, then come back here to place them into the week.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleRoutines.map((item) => (
            <div
              key={item.routine.id}
              className="rounded-[22px] border border-stone-200/90 bg-white/92 px-4 py-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/74"
            >
              <div className="flex flex-col gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-sans text-sm font-semibold text-stone-900 dark:text-stone-100">{item.routine.title}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-sans text-[11px] font-medium ${getStateToneClasses(item.tone)}`}>
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">{item.summary}</p>
                  <p className="mt-2 font-sans text-sm text-stone-700 dark:text-stone-200">{item.recommendation}</p>
                  {item.currentPlacement && (
                    <p className="mt-2 font-sans text-xs text-moss-700 dark:text-moss-300">
                      Placed for {formatPlacementDate(item.currentPlacement.dateStr)}
                      {item.currentPlacement.mode === 'light' ? ` · ${item.currentPlacement.durationMinutes} min lighter version` : ` · ${item.currentPlacement.durationMinutes} min support block`}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPlacementIntent({
                      routine: item.routine,
                      mode: 'normal',
                      durationMinutes: Math.max(5, Number(item.routine.duration) || 15),
                    })}
                    className="rounded-xl bg-moss-600 px-3 py-2 font-sans text-sm font-semibold text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                  >
                    {item.currentPlacement ? 'Move in week' : 'Place in week'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (item.secondaryAction.type === 'place-light') {
                        setPlacementIntent({
                          routine: item.routine,
                          mode: 'light',
                          durationMinutes: Math.max(5, Math.round((Number(item.routine.duration) || 15) * 0.6)),
                        });
                        return;
                      }
                      handleSkipToday(item.routine);
                    }}
                    className="rounded-xl border border-stone-300 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/70"
                  >
                    {item.secondaryAction.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptionsItem(item)}
                    className="rounded-xl px-2.5 py-2 font-sans text-xs font-medium text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:text-stone-400 dark:hover:text-stone-200"
                  >
                    More options
                  </button>
                </div>
              </div>
            </div>
          ))}

          {shouldCollapse && (
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="rounded-lg px-2 py-1 font-sans text-xs font-medium text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:text-stone-400 dark:hover:text-stone-200"
            >
              {showAll ? 'Show fewer routines' : `Show ${prioritizedRoutines.length - visibleRoutines.length} more`}
            </button>
          )}
        </div>
      )}

      {routineForPlayer && (
        <RoutinePlayer
          routine={routineForPlayer}
          onClose={() => setRoutineForPlayer(null)}
        />
      )}

      <RoutineSupportDayPicker
        intent={placementIntent}
        today={today || localISODate()}
        onClose={() => setPlacementIntent(null)}
        onPickDay={handlePickPlacementDay}
      />

      <RoutineSupportOptionsSheet
        item={optionsItem}
        onClose={() => setOptionsItem(null)}
        onPlaceInWeek={() => setPlacementIntent({
          routine: optionsItem.routine,
          mode: 'normal',
          durationMinutes: Math.max(5, Number(optionsItem.routine.duration) || 15),
        })}
        onPlaceLightInWeek={() => setPlacementIntent({
          routine: optionsItem.routine,
          mode: 'light',
          durationMinutes: Math.max(5, Math.round((Number(optionsItem.routine.duration) || 15) * 0.6)),
        })}
        onSkipToday={() => handleSkipToday(optionsItem?.routine)}
        onPauseWeek={() => handlePauseUntilNextWeek(optionsItem?.routine)}
        onRemovePlacement={() => {
          if (optionsItem?.currentPlacement?.id) removeRoutineSupportPlacement?.(optionsItem.currentPlacement.id);
          setOptionsItem(null);
        }}
        onStartNow={() => {
          setRoutineForPlayer(optionsItem?.routine ?? null);
          setOptionsItem(null);
        }}
        onManageRoutines={() => {
          setOptionsItem(null);
          onManageRoutines?.();
        }}
      />
    </div>
  );
}
