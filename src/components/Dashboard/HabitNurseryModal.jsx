import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { useReward } from '../../context/RewardContext';

const NURSERY_INTRO_KEY = 'kaizen_nursery_intro';

const SEED_ITEMS = [
  { id: 'seed_oak', name: 'Mighty Oak Seed', cost: 50, model: 'tree_oak.glb', icon: 'O' },
  { id: 'seed_pine', name: 'Ancient Pine Seed', cost: 40, model: 'tree_pineTallA.glb', icon: 'P' },
  { id: 'seed_palm', name: 'Tropical Palm Seed', cost: 60, model: 'tree_palm.glb', icon: 'T' },
  { id: 'seed_sunflower', name: 'Sunflower Seed', cost: 20, model: 'flower_yellowA.glb', icon: 'S' },
  { id: 'seed_mushroom', name: 'Giant Spore', cost: 75, model: 'mushroom_redGroup.glb', icon: 'M' },
];

const NURSERY_DAYS = 20;

function getSpiritEmoji(spiritConfig, userSettings) {
  const type = userSettings?.spirit?.form ?? spiritConfig?.type ?? 'mochi';
  const normalized = String(type).toLowerCase();
  if (normalized === 'custom' && spiritConfig?.head) {
    const heads = { bunny: 'B', cat: 'C', bear: 'B', fox: 'F', bot: 'R', owl: 'O' };
    return heads[spiritConfig.head] ?? '*';
  }
  if (normalized === 'guide' || normalized === 'owl') return 'O';
  if (normalized === 'cat') return 'C';
  if (normalized === 'ember' || normalized === 'flame') return 'F';
  if (normalized === 'nimbus' || normalized === 'cloud') return 'N';
  if (normalized === 'rabbit') return 'R';
  if (normalized === 'frog') return 'F';
  if (normalized === 'butterfly') return 'B';
  return spiritConfig?.emoji ?? '*';
}

function RoutineProgress({ goal }) {
  const totalRaw = Number(goal?.totalMinutes);
  const estimatedRaw = Number(goal?.estimatedMinutes);
  const total = Number.isFinite(totalRaw) ? totalRaw : 0;
  const estimated = Number.isFinite(estimatedRaw) ? estimatedRaw : 60;
  const pct = estimated > 0 ? Math.min(100, (total / estimated) * 100) : 0;
  const daysEquivalent = estimated > 0 ? Math.floor(total / estimated) : 0;
  const dayLabel = daysEquivalent <= NURSERY_DAYS ? `${daysEquivalent} / ${NURSERY_DAYS} days` : `${total} min`;

  return (
    <div className="flex flex-col gap-1">
      <div className="h-2 w-full rounded-full bg-stone-200 dark:bg-stone-600 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-moss-500 dark:bg-moss-400"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <span className="text-xs text-stone-500 dark:text-stone-400 font-sans">
        {total} / {estimated} min · {dayLabel}
      </span>
    </div>
  );
}

function getGraduationProgress(habit) {
  const totalRaw = Number(habit?.totalMinutes);
  const total = Number.isFinite(totalRaw) ? totalRaw : 0;
  return Math.min(100, (total / (NURSERY_DAYS * 5)) * 100);
}

export default function HabitNurseryModal({ open, onClose }) {
  const { goals = [], spiritConfig, userSettings, spendEmbers, editGoal, embers = 0, setActiveTool } = useGarden();
  const { pushReward } = useReward();

  const routines = useMemo(() => goals.filter((goal) => goal.type === 'routine'), [goals]);
  const routinesByCategory = useMemo(() => {
    const map = new Map();
    routines.forEach((routine) => {
      const category = String(routine.category || 'Other');
      const items = map.get(category) || [];
      items.push(routine);
      map.set(category, items);
    });
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [routines]);

  const [showIntro, setShowIntro] = useState(false);
  const [expandedRoutineId, setExpandedRoutineId] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [shopForRoutineId, setShopForRoutineId] = useState(null);

  useEffect(() => {
    if (!open) return;
    const seen = localStorage.getItem(NURSERY_INTRO_KEY);
    if (!seen) setShowIntro(true);
  }, [open]);

  const handleUnderstand = () => {
    localStorage.setItem(NURSERY_INTRO_KEY, '1');
    setShowIntro(false);
  };

  const handleAssignSeed = (habit, seed) => {
    if (typeof seed.cost !== 'number' || embers < seed.cost) return;
    const ok = spendEmbers(seed.cost);
    if (!ok) return;
    editGoal(habit.id, { seedModel: seed.model, seedName: seed.name });
    setShopForRoutineId(null);
    setExpandedRoutineId(null);
    pushReward?.({
      message: `${habit.title} is destined to become a ${seed.name}.`,
      tone: 'moss',
      icon: seed.icon ?? '*',
      durationMs: 2800,
    });
  };

  const handleGraduate = (habit) => {
    editGoal(habit.id, { isGraduated: true });
    setActiveTool?.({ type: 'place', item: habit, originalType: 'goal' });
    onClose?.();
    pushReward?.({ message: 'Your habit has taken root. Place it in your garden.', tone: 'moss', icon: '*', durationMs: 3200 });
  };

  const spiritEmoji = getSpiritEmoji(spiritConfig, userSettings);

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Habit Nursery"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-stone-50 border border-stone-200 shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-stone-200 bg-stone-50/95 backdrop-blur-sm">
              <div className="space-y-1">
                <h2 className="font-serif text-lg text-stone-900">Habit Nursery</h2>
                <p className="font-sans text-sm text-stone-500">Keep routines here while they build roots, then graduate them into the garden.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200"
              >
                x
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:py-6">
              <AnimatePresence mode="wait">
                {showIntro ? (
                  <motion.div key="intro" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="flex flex-col items-center text-center py-6 sm:py-8 space-y-6">
                    <span className="text-6xl sm:text-7xl" role="img" aria-hidden>{spiritEmoji}</span>
                    <div className="space-y-3">
                      <h3 className="font-serif text-xl sm:text-2xl text-stone-900">Welcome to the Greenhouse</h3>
                      <p className="font-sans text-sm sm:text-base text-stone-600 leading-relaxed max-w-md mx-auto">
                        Habits are fragile little sprouts. The first 20 days are about root-building. Missing one day will not derail growth.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleUnderstand}
                      className="inline-flex items-center justify-center rounded-xl bg-moss-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-moss-700"
                    >
                      I Understand
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="main" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="space-y-4">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm text-amber-900 font-sans">
                        Average habit automation takes time. Keep routines here while roots strengthen.
                      </p>
                    </div>

                    {routines.length === 0 ? (
                      <p className="text-stone-500 font-sans text-sm py-4">No routines yet. Add habits in Settings or from your Seed Bag to see them here.</p>
                    ) : (
                      <ul className="space-y-3">
                        {routinesByCategory.map(({ category, items }) => {
                          const categoryOpen = expandedCategory === category;
                          return (
                            <li key={category} className="rounded-2xl border border-stone-200 bg-white/60 overflow-hidden shadow-sm">
                              <button type="button" onClick={() => setExpandedCategory((current) => (current === category ? null : category))} className="w-full p-4 text-left flex items-center gap-3 border-b border-stone-200/70">
                                <span className="text-2xl shrink-0" aria-hidden>{[...String(category)][0] || 'R'}</span>
                                <h3 className="font-sans font-semibold text-stone-900 truncate flex-1">{category} ({items.length})</h3>
                                <span className="text-stone-400 text-sm" aria-hidden>{categoryOpen ? 'v' : '>'}</span>
                              </button>

                              <AnimatePresence>
                                {categoryOpen && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                    <ul className="space-y-3 p-3">
                                      {items.map((goal) => {
                                        const isExpanded = expandedRoutineId === goal.id;
                                        const showShop = shopForRoutineId === goal.id;
                                        const hasSeed = !!goal.seedModel;
                                        const seedIcon = hasSeed ? (SEED_ITEMS.find((seed) => seed.model === goal.seedModel)?.icon ?? '*') : null;
                                        const graduationProgress = getGraduationProgress(goal);
                                        const canGraduate = graduationProgress >= 100 && !goal.isGraduated;

                                        return (
                                          <li key={goal.id} className="rounded-xl border border-stone-200 bg-white/70 overflow-hidden">
                                            <button type="button" onClick={() => setExpandedRoutineId((id) => (id === goal.id ? null : goal.id))} className="w-full p-3 text-left flex items-center gap-3">
                                              <h4 className="font-sans font-semibold text-stone-900 truncate flex-1">{goal.title || 'Untitled routine'}</h4>
                                              <span className="text-stone-400 text-xs" aria-hidden>{isExpanded ? 'v' : '>'}</span>
                                            </button>

                                            <div className="px-3 pb-2"><RoutineProgress goal={goal} /></div>

                                            <AnimatePresence>
                                              {isExpanded && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-stone-200">
                                                  <div className="p-3 pt-2 space-y-3">
                                                    {canGraduate && (
                                                      <button
                                                        type="button"
                                                        onClick={(event) => { event.stopPropagation(); handleGraduate(goal); }}
                                                        className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-600"
                                                      >
                                                        Graduate to Garden
                                                      </button>
                                                    )}

                                                    {hasSeed ? (
                                                      <div className="rounded-2xl border border-moss-200 bg-moss-50 px-4 py-3 text-center">
                                                        <p className="font-sans text-sm text-moss-800">
                                                          Destined to become: <strong>{goal.seedName ?? goal.seedModel}</strong> <span className="text-lg" aria-hidden>{seedIcon}</span>
                                                        </p>
                                                      </div>
                                                    ) : showShop ? (
                                                      <div className="space-y-2">
                                                        <p className="font-sans text-xs font-medium text-stone-500">Choose a seed for this habit</p>
                                                        <ul className="space-y-2">
                                                          {SEED_ITEMS.map((seed) => {
                                                            const canAfford = embers >= (seed.cost ?? 0);
                                                            return (
                                                              <li key={seed.id} className="flex items-center justify-between gap-3 rounded-lg bg-stone-100 px-3 py-2">
                                                                <span className="text-lg" aria-hidden>{seed.icon}</span>
                                                                <span className="font-sans text-sm text-stone-800 flex-1 truncate">{seed.name}</span>
                                                                <span className="font-sans text-xs text-amber-700 tabular-nums">{seed.cost} E</span>
                                                                <button
                                                                  type="button"
                                                                  onClick={(event) => { event.stopPropagation(); handleAssignSeed(goal, seed); }}
                                                                  disabled={!canAfford}
                                                                  className="shrink-0 rounded-lg bg-moss-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-moss-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                  Assign
                                                                </button>
                                                              </li>
                                                            );
                                                          })}
                                                        </ul>
                                                        <button
                                                          type="button"
                                                          onClick={(event) => { event.stopPropagation(); setShopForRoutineId(null); }}
                                                          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
                                                        >
                                                          Cancel
                                                        </button>
                                                      </div>
                                                    ) : (
                                                      <div className="rounded-2xl border border-stone-200 bg-stone-100 px-4 py-3 text-center space-y-2">
                                                        <p className="font-sans text-sm text-stone-600">Seed Potential</p>
                                                        <button
                                                          type="button"
                                                          onClick={(event) => { event.stopPropagation(); setShopForRoutineId(goal.id); }}
                                                          className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-600"
                                                        >
                                                          Buy a seed for this habit
                                                        </button>
                                                      </div>
                                                    )}
                                                  </div>
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
