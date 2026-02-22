import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getLast7DaysLogs(logs) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  cutoff.setHours(0, 0, 0, 0);
  return (logs || []).filter((log) => {
    const d = log.date ? new Date(log.date) : null;
    return d && d >= cutoff;
  });
}

function getDayIndex(isoDate) {
  const d = new Date(isoDate);
  return (d.getDay() + 6) % 7;
}

function computeStats(weekLogs) {
  const totalMinutes = weekLogs.reduce((acc, log) => acc + (Number(log.minutes) || 0), 0);
  const totalHours = totalMinutes / 60;

  const minutesByDay = [0, 0, 0, 0, 0, 0, 0];
  weekLogs.forEach((log) => {
    const day = getDayIndex(log.date);
    minutesByDay[day] += Number(log.minutes) || 0;
  });
  const maxMinutes = Math.max(...minutesByDay, 1);
  const mostProductiveIndex = minutesByDay.indexOf(Math.max(...minutesByDay));
  const mostProductiveDay = DAY_LABELS[mostProductiveIndex];

  const ratingCounts = { withered: 0, sustained: 0, bloomed: 0 };
  weekLogs.forEach((log) => {
    if (log.rating && ratingCounts[log.rating] !== undefined) ratingCounts[log.rating]++;
  });
  const totalRated = ratingCounts.withered + ratingCounts.sustained + ratingCounts.bloomed;
  const mostly =
    totalRated === 0
      ? 'sustained'
      : ratingCounts.bloomed >= ratingCounts.withered && ratingCounts.bloomed >= ratingCounts.sustained
        ? 'bloomed'
        : ratingCounts.withered >= ratingCounts.sustained
          ? 'withered'
          : 'sustained';

  return {
    totalHours,
    totalMinutes,
    minutesByDay,
    maxMinutes,
    mostProductiveDay,
    ratingCounts,
    mostly,
  };
}

function getGoalsWithZeroProgressThisWeek(goals, weekLogs) {
  const minutesByTaskId = {};
  weekLogs.forEach((log) => {
    const id = log.taskId;
    if (!id) return;
    minutesByTaskId[id] = (minutesByTaskId[id] || 0) + (Number(log.minutes) || 0);
  });
  return (goals || []).filter((g) => (minutesByTaskId[g.id] || 0) === 0);
}

const RATING_LABEL = {
  withered: '🥀 Withered',
  sustained: '🍃 Sustained',
  bloomed: '🌸 Bloomed',
};

function uid() {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function WeeklyReview({ onComplete }) {
  const { logs, goals, deleteGoal, compost = [], addGoal, removeFromCompost } = useGarden();
  const [step, setStep] = useState(1);
  const [pruningChoices, setPruningChoices] = useState({});
  const [compostChoices, setCompostChoices] = useState({}); // id -> 'plant' | 'letGo' | 'leave'

  const weekLogs = useMemo(() => getLast7DaysLogs(logs), [logs]);
  const stats = useMemo(() => computeStats(weekLogs), [weekLogs]);
  const goalsToPrune = useMemo(() => getGoalsWithZeroProgressThisWeek(goals, weekLogs), [goals, weekLogs]);

  const handlePruningChoice = (goalId, action) => {
    setPruningChoices((prev) => ({ ...prev, [goalId]: action }));
    if (action === 'compost') deleteGoal(goalId);
  };

  const handleCompostAction = (item, action) => {
    setCompostChoices((prev) => ({ ...prev, [item.id]: action }));
    if (action === 'plant') {
      addGoal({
        id: uid(),
        type: 'kaizen',
        title: item.text?.trim() || 'Restored from compost',
        totalMinutes: 0,
        createdAt: new Date().toISOString(),
        subtasks: [{ id: uid(), title: 'First step', estimatedHours: 0.1, completedHours: 0 }],
        milestones: [],
      });
      removeFromCompost(item.id);
    } else if (action === 'letGo') {
      removeFromCompost(item.id);
    }
    // 'leave' = no state change
  };

  const handleFinish = () => {
    onComplete?.();
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <h2 className="font-serif text-stone-500 text-sm uppercase tracking-wider mb-2">The Yield</h2>
              <p className="font-serif text-4xl md:text-5xl text-stone-900 mb-2">
                {stats.totalHours.toFixed(1)} Hours Harvested
              </p>
              <p className="font-sans text-sm text-stone-500 mb-6">Focus time this week</p>

              <div className="flex items-end justify-between gap-1 h-24 mt-8 px-2">
                {DAY_LABELS.map((label, i) => (
                  <div key={label} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-stone-200 rounded-t flex-1 flex flex-col justify-end overflow-hidden min-h-[8px]">
                      <motion.div
                        className="w-full bg-moss-500 rounded-t"
                        initial={{ height: 0 }}
                        animate={{ height: `${(stats.minutesByDay[i] / stats.maxMinutes) * 100}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="font-sans text-xs text-stone-500">{label}</span>
                  </div>
                ))}
              </div>
              <p className="font-sans text-xs text-stone-400 mt-4">Most productive: {stats.mostProductiveDay}</p>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="mt-10 w-full py-3 font-sans text-stone-800 bg-moss-500 text-stone-50 rounded-xl hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
              >
                Next
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <h2 className="font-serif text-stone-500 text-sm uppercase tracking-wider mb-2">The Soil</h2>
              <p className="font-serif text-2xl md:text-3xl text-stone-900 mb-2">
                Your energy was mostly {RATING_LABEL[stats.mostly]}
              </p>
              <p className="font-sans text-sm text-stone-500 mb-6">Tea ceremony ratings this week</p>

              <div className="flex flex-col gap-2 max-w-xs mx-auto text-left">
                {(['withered', 'sustained', 'bloomed']).map((r) => {
                  const count = stats.ratingCounts[r] || 0;
                  const total = stats.ratingCounts.withered + stats.ratingCounts.sustained + stats.ratingCounts.bloomed;
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={r} className="flex items-center gap-3">
                      <span className="font-sans text-sm text-stone-700 w-28">{RATING_LABEL[r]}</span>
                      <div className="flex-1 h-3 bg-stone-200 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${
                            r === 'bloomed' ? 'bg-amber-400' : r === 'sustained' ? 'bg-moss-500' : 'bg-stone-400'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="font-sans text-xs text-stone-500 w-8">{count}</span>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="mt-10 w-full py-3 font-sans text-stone-800 bg-moss-500 text-stone-50 rounded-xl hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
              >
                Next
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="font-serif text-stone-500 text-sm uppercase tracking-wider mb-2 text-center">The Pruning</h2>
              <p className="font-sans text-stone-600 text-center mb-6">Goals with no progress this week</p>

              {goalsToPrune.length === 0 ? (
                <p className="font-sans text-stone-500 text-center py-6">Nothing to prune. Every seed saw growth.</p>
              ) : (
                <ul className="space-y-3 mb-8">
                  {goalsToPrune.map((goal) => (
                    <li
                      key={goal.id}
                      className="flex items-center justify-between gap-4 p-4 rounded-xl border border-stone-200 bg-white"
                    >
                      <span className="font-sans text-stone-800 truncate">{goal.title}</span>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handlePruningChoice(goal.id, 'keep')}
                          className={`px-3 py-1.5 font-sans text-sm rounded-lg transition-colors ${
                            pruningChoices[goal.id] === 'keep'
                              ? 'bg-moss-100 text-moss-800 border border-moss-500/50'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 border border-transparent'
                          }`}
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePruningChoice(goal.id, 'compost')}
                          className={`px-3 py-1.5 font-sans text-sm rounded-lg transition-colors ${
                            pruningChoices[goal.id] === 'compost'
                              ? 'bg-amber-100 text-amber-800 border border-amber-500/50'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 border border-transparent'
                          }`}
                        >
                          ♻️ Compost
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => setStep(4)}
                className="w-full py-3 font-sans text-stone-800 bg-moss-500 text-stone-50 rounded-xl hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
              >
                Next
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="font-serif text-stone-500 text-sm uppercase tracking-wider mb-2 text-center">
                Turn the Compost
              </h2>
              <p className="font-sans text-sm text-stone-600 text-center mb-6 max-w-md mx-auto">
                Out of sight, out of mind. Let&apos;s review what we put on pause. No shame in letting things go permanently.
              </p>

              {compost.length === 0 ? (
                <p className="font-sans text-stone-500 text-center py-6">Your compost is empty. Nothing to turn this week.</p>
              ) : (
                <ul className="space-y-3 mb-8">
                  {compost.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-stone-200 bg-white"
                    >
                      <span className="font-sans text-stone-800 flex-1 min-w-0 break-words">{item.text || 'Untitled'}</span>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCompostAction(item, 'plant')}
                          className={`px-3 py-1.5 font-sans text-sm rounded-lg transition-colors ${
                            compostChoices[item.id] === 'plant'
                              ? 'bg-moss-100 text-moss-800 border border-moss-500/50'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 border border-transparent'
                          }`}
                        >
                          🌱 Plant it
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompostAction(item, 'letGo')}
                          className={`px-3 py-1.5 font-sans text-sm rounded-lg transition-colors ${
                            compostChoices[item.id] === 'letGo'
                              ? 'bg-red-100 text-red-800 border border-red-500/50'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 border border-transparent'
                          }`}
                        >
                          🗑️ Let it go
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompostAction(item, 'leave')}
                          className={`px-3 py-1.5 font-sans text-sm rounded-lg transition-colors ${
                            compostChoices[item.id] === 'leave'
                              ? 'bg-sky-100 text-sky-800 border border-sky-500/50'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 border border-transparent'
                          }`}
                        >
                          💤 Leave it
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={handleFinish}
                className="w-full py-3 font-sans text-stone-800 bg-moss-500 text-stone-50 rounded-xl hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
              >
                Continue to Spirit Walk
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
