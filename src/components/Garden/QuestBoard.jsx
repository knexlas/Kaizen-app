import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** Deterministic daily quest generator — same quests for the same date. */
function hashDate(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

const QUEST_POOL = [
  { id: 'water', icon: '💧', text: 'Water a plant', embers: 5, check: (s) => s.wateredToday },
  { id: 'focus', icon: '🍵', text: 'Complete a focus session', embers: 10, check: (s) => s.focusedToday },
  { id: 'compost', icon: '♻️', text: 'Add an idea to compost', embers: 3, check: (s) => s.compostedToday },
  { id: 'energy', icon: '⚡', text: 'Check your energy level', embers: 3, check: (s) => s.energyChecked },
  { id: 'visit', icon: '🌱', text: 'Visit your garden', embers: 2, check: () => true },
  { id: 'subtask', icon: '✅', text: 'Complete a subtask', embers: 5, check: (s) => s.subtaskCompleted },
  { id: 'streak', icon: '🔥', text: 'Keep your streak going', embers: 8, check: (s) => s.streakActive },
  { id: 'plan', icon: '🗺️', text: 'Plan tomorrow\'s schedule', embers: 5, check: (s) => s.plannedTomorrow },
];

function getDailyQuests(dateStr) {
  const shuffled = [...QUEST_POOL].sort((a, b) => {
    const ha = hashDate(dateStr + a.id);
    const hb = hashDate(dateStr + b.id);
    return ha - hb;
  });
  return shuffled.slice(0, 3);
}

export default function QuestBoard({ dateStr, gardenState = {}, onClaimReward, className = '' }) {
  const [claimed, setClaimed] = useState({});
  const [collapsed, setCollapsed] = useState(false);

  const quests = useMemo(() => getDailyQuests(dateStr), [dateStr]);
  const questStatus = useMemo(
    () => quests.map((q) => ({ ...q, done: q.check(gardenState) })),
    [quests, gardenState]
  );
  const allDone = questStatus.every((q) => q.done);
  const completedCount = questStatus.filter((q) => q.done).length;
  const totalEmbers = questStatus.reduce((sum, q) => sum + q.embers, 0);

  const handleClaim = (quest) => {
    if (claimed[quest.id] || !quest.done) return;
    setClaimed((prev) => ({ ...prev, [quest.id]: true }));
    onClaimReward?.(quest.embers, `Quest: ${quest.text}`);
  };

  return (
    <div className={`pointer-events-auto ${className}`}>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-md border border-stone-200/60 dark:border-slate-600/40 hover:bg-white dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/40"
      >
        <span className="text-sm" aria-hidden>📜</span>
        <span className="font-sans text-xs font-semibold text-stone-700 dark:text-stone-300">
          Daily Quests
        </span>
        <span className="font-sans text-xs text-amber-600 dark:text-amber-400 font-bold">
          {completedCount}/{quests.length}
        </span>
        <span className={`text-xs transition-transform ${collapsed ? '' : 'rotate-180'}`} aria-hidden>▾</span>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 w-64 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-lg border border-stone-200/60 dark:border-slate-600/40 overflow-hidden"
          >
            <div className="p-3 space-y-2">
              {questStatus.map((quest) => (
                <div
                  key={quest.id}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${
                    quest.done
                      ? claimed[quest.id]
                        ? 'bg-amber-50/60 dark:bg-amber-900/20'
                        : 'bg-moss-50/60 dark:bg-moss-900/20'
                      : 'bg-stone-50/60 dark:bg-slate-700/40'
                  }`}
                >
                  <span className="text-base shrink-0" aria-hidden>{quest.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-sans text-xs font-medium ${quest.done ? 'text-stone-500 line-through' : 'text-stone-700 dark:text-stone-300'}`}>
                      {quest.text}
                    </p>
                    <p className="font-sans text-[10px] text-amber-600 dark:text-amber-400">+{quest.embers} 🔥</p>
                  </div>
                  {quest.done && !claimed[quest.id] ? (
                    <button
                      type="button"
                      onClick={() => handleClaim(quest)}
                      className="px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-sans text-[10px] font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    >
                      Claim
                    </button>
                  ) : quest.done ? (
                    <span className="font-sans text-[10px] text-moss-600 dark:text-moss-400 font-semibold">✓</span>
                  ) : (
                    <span className="w-4 h-4 rounded border border-stone-300 dark:border-slate-500 shrink-0" />
                  )}
                </div>
              ))}

              {allDone && Object.keys(claimed).length === quests.length && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-2 rounded-lg bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 border border-amber-200/60 dark:border-amber-700/40"
                >
                  <p className="font-sans text-xs font-bold text-amber-800 dark:text-amber-300">🎉 All quests complete!</p>
                  <p className="font-sans text-[10px] text-amber-600 dark:text-amber-400">+{totalEmbers} Embers earned today</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
