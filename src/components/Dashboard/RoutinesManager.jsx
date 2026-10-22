import { useMemo, useState } from 'react';
import { useGarden } from '../../context/GardenContext';
import { useDialog } from '../../context/DialogContext';
import { motion, AnimatePresence } from 'framer-motion';
import RoutinePlayer from '../Focus/RoutinePlayer';
import { localISODate } from '../../services/dateUtils';
import { RECURRING_SUPPORT_STATUSES, getRecentStatusCounts } from '../../domains/recovery/services/antiShameRecurrenceService';

const FORM_CATEGORIES = ['🧼 Care & Hygiene', '🧹 Household', '📁 Life Admin', '💪 Wellness'];

export default function RoutinesManager() {
  const {
    routines,
    addRoutine,
    deleteRoutine,
    markRoutineSupportState,
    pauseRoutineTemporarily,
    softenRoutineIntensity,
    recurringSupportState,
    updateRoutine,
  } = useGarden();
  const { showConfirm } = useDialog();
  const [newRoutine, setNewRoutine] = useState({ title: '', category: '🧼 Care & Hygiene', duration: 15 });
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [routineForPlayer, setRoutineForPlayer] = useState(null);

  const byCategory = useMemo(() => {
    const map = {};
    (routines ?? []).forEach((routine) => {
      const category = routine.category || '📋 Other';
      if (!map[category]) map[category] = [];
      map[category].push(routine);
    });
    FORM_CATEGORIES.forEach((category) => {
      if (!map[category]) map[category] = [];
    });
    return map;
  }, [routines]);

  const sortedCategories = useMemo(() => {
    const categories = Object.keys(byCategory);
    return [
      ...FORM_CATEGORIES.filter((category) => categories.includes(category)),
      ...categories.filter((category) => !FORM_CATEGORIES.includes(category)),
    ];
  }, [byCategory]);

  const handleAddRoutine = () => {
    const title = (newRoutine.title || '').trim();
    if (!title) return;
    addRoutine({ ...newRoutine, title, duration: Math.max(1, Math.min(120, Number(newRoutine.duration) || 15)) });
    setNewRoutine((prev) => ({ ...prev, title: '' }));
  };

  const handleDelete = (id) => {
    showConfirm({
      message: 'Remove this routine from your list?',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      destructive: true,
      onConfirm: () => deleteRoutine(id),
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="mb-2 font-serif text-lg text-stone-800">Routines</h2>
      <p className="mb-4 font-sans text-sm text-stone-500">
        Manage recurring supports here. Use the weekly support view when you want quick planning, and come here when you want to edit the routine itself.
      </p>

      <div className="mb-6 flex flex-col items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:flex-row">
        <div className="w-full flex-1">
          <label className="mb-1 block text-xs font-bold text-stone-500">Routine name</label>
          <input
            type="text"
            placeholder="e.g. Feed the cat..."
            value={newRoutine.title}
            onChange={(e) => setNewRoutine({ ...newRoutine, title: e.target.value })}
            className="w-full rounded-lg border border-stone-200 bg-stone-50 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="w-full md:w-48">
          <label className="mb-1 block text-xs font-bold text-stone-500">Category</label>
          <select
            value={newRoutine.category}
            onChange={(e) => setNewRoutine({ ...newRoutine, category: e.target.value })}
            className="w-full rounded-lg border border-stone-200 bg-stone-50 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {FORM_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <div className="w-full md:w-32">
          <label className="mb-1 block text-xs font-bold text-stone-500">Duration (min)</label>
          <input
            type="number"
            min={1}
            max={120}
            value={newRoutine.duration}
            onChange={(e) => setNewRoutine({ ...newRoutine, duration: parseInt(e.target.value, 10) || 15 })}
            className="w-full rounded-lg border border-stone-200 bg-stone-50 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <button
          type="button"
          onClick={handleAddRoutine}
          className="w-full rounded-lg bg-indigo-500 px-5 py-2 font-sans text-sm font-bold text-white transition-colors hover:bg-indigo-600 md:w-auto"
        >
          Add routine
        </button>
      </div>

      <div className="space-y-2" role="region" aria-label="Routine categories">
        {sortedCategories.map((category) => {
          const items = byCategory[category] ?? [];
          if (items.length === 0) return null;
          const isOpen = expandedCategory === category;
          const safeId = category.replace(/\s/g, '-').replace(/[^\w-]/g, '');

          return (
            <div key={category} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedCategory(isOpen ? null : category)}
                className="w-full text-left font-sans text-sm font-bold uppercase tracking-wide text-stone-700 transition-colors hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-inset"
                aria-expanded={isOpen}
                aria-controls={`routines-cat-${safeId}`}
                id={`routines-header-${safeId}`}
              >
                <span className="flex items-center justify-between gap-2 px-4 py-3">
                  <span>{category}</span>
                  <span className="shrink-0 text-stone-400" aria-hidden>{isOpen ? 'v' : '>'}</span>
                </span>
              </button>

              {isOpen && (
                <ul id={`routines-cat-${safeId}`} className="space-y-2 p-4 pt-0" role="list" aria-labelledby={`routines-header-${safeId}`}>
                  <AnimatePresence mode="popLayout">
                    {items.map((routine) => (
                      <motion.li
                        key={routine.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-3"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-sans text-sm font-medium text-stone-800">{routine.title}</span>
                              <span className="font-sans text-xs text-stone-500">[{routine.duration} min]</span>
                              {routine.pausedUntil && (
                                <span className="rounded-full bg-stone-200 px-2 py-0.5 font-sans text-[11px] text-stone-600">
                                  Paused until {routine.pausedUntil}
                                </span>
                              )}
                            </div>
                            {(() => {
                              const counts = getRecentStatusCounts(recurringSupportState, {
                                itemType: 'routine',
                                itemId: routine.id,
                                lookbackDays: 14,
                              });
                              if ((counts.skipped + counts.light + counts.deferred + counts.resumed) <= 0) return null;
                              return (
                                <span className="mt-1 block font-sans text-[11px] text-stone-500">
                                  Recent support history: skipped {counts.skipped}, light {counts.light}, deferred {counts.deferred}, resumed {counts.resumed}
                                </span>
                              );
                            })()}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setRoutineForPlayer(routine)}
                              className="rounded-lg border border-moss-300 px-2.5 py-1.5 font-sans text-xs font-medium text-moss-800 transition-colors hover:bg-moss-50 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-moss-800 dark:text-moss-200 dark:hover:bg-moss-900/30"
                              aria-label="Play routine"
                              title="Play routine"
                            >
                              Play
                            </button>
                            <button
                              type="button"
                              onClick={() => markRoutineSupportState?.(routine.id, RECURRING_SUPPORT_STATUSES.SKIPPED_COMPASSIONATELY, { date: localISODate(), note: 'Skipped without guilt.' })}
                              className="rounded-lg px-2.5 py-1.5 font-sans text-xs text-stone-600 hover:bg-stone-100"
                              title="Skip for today"
                            >
                              Skip today
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                markRoutineSupportState?.(routine.id, RECURRING_SUPPORT_STATUSES.LIGHT_VERSION_COMPLETED, { date: localISODate(), note: 'Light version done.' });
                                const nextDuration = Math.max(5, Math.round((Number(routine.duration) || 15) * 0.6));
                                updateRoutine?.(routine.id, { duration: nextDuration });
                              }}
                              className="rounded-lg px-2.5 py-1.5 font-sans text-xs text-stone-600 hover:bg-stone-100"
                              title="Do the light version"
                            >
                              Do light version
                            </button>
                            <button
                              type="button"
                              onClick={() => pauseRoutineTemporarily?.(routine.id, 7)}
                              className="rounded-lg px-2.5 py-1.5 font-sans text-xs text-stone-600 hover:bg-stone-100"
                              title="Pause this for a week"
                            >
                              Pause 1 week
                            </button>
                            <button
                              type="button"
                              onClick={() => softenRoutineIntensity?.(routine.id)}
                              className="rounded-lg px-2.5 py-1.5 font-sans text-xs text-stone-600 hover:bg-stone-100"
                              title="Make this smaller for now"
                            >
                              Make smaller
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(routine.id)}
                              className="shrink-0 rounded-lg px-2 py-1.5 font-sans text-xs text-stone-500 hover:bg-stone-100"
                              aria-label="Delete"
                              title="Delete"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {routineForPlayer && (
          <RoutinePlayer
            routine={routineForPlayer}
            onClose={() => setRoutineForPlayer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
