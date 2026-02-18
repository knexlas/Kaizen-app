import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const OPTIONS = [
  { modifier: -2, emoji: '🔋', label: 'Low', sublabel: 'Operating on reserves.', description: 'Bad Sleep', className: 'border-red-200 hover:bg-red-50' },
  { modifier: 0, emoji: '🔋', label: 'Normal', sublabel: 'Ready for the day.', description: 'Standard Capacity', className: 'border-moss-200 hover:bg-moss-50' },
  { modifier: 1, emoji: '🔋', label: 'High', sublabel: 'Full power.', description: 'Well Rested', className: 'border-amber-200 hover:bg-amber-50' },
];

/** Get yesterday as YYYY-MM-DD */
function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Latest metric value for pre-fill (prefer yesterday, else most recent). */
function getPrefillValue(goal) {
  const metrics = Array.isArray(goal?.metrics) ? goal.metrics : [];
  if (metrics.length === 0) return '';
  const yesterday = yesterdayString();
  const yesterdayEntry = metrics.find((m) => m.date === yesterday);
  if (yesterdayEntry != null) return String(yesterdayEntry.value);
  const sorted = [...metrics].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return sorted[0]?.value != null ? String(sorted[0].value) : '';
}

/** Last 7 data points (by date desc, then reversed for left-to-right chart). */
function getLast7(goal) {
  const metrics = Array.isArray(goal?.metrics) ? goal.metrics : [];
  const sorted = [...metrics].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return sorted.slice(0, 7).reverse();
}

const SPARKLINE_WIDTH = 64;
const SPARKLINE_HEIGHT = 24;

function Sparkline({ data }) {
  const path = useMemo(() => {
    if (!data?.length) return '';
    const values = data.map((d) => Number(d.value));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = data.length > 1 ? (SPARKLINE_WIDTH - 1) / (data.length - 1) : 0;
    const points = data.map((d, i) => {
      const x = data.length === 1 ? SPARKLINE_WIDTH / 2 : i * step;
      const y = SPARKLINE_HEIGHT - ((Number(d.value) - min) / range) * (SPARKLINE_HEIGHT - 2);
      return { x, y };
    });
    if (points.length === 1) {
      const y = points[0].y;
      return `M 0,${y} L ${SPARKLINE_WIDTH},${y}`;
    }
    return `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;
  }, [data]);

  if (!data?.length) return null;

  return (
    <svg
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      className="shrink-0 rounded overflow-hidden bg-stone-100"
      aria-hidden
    >
      <motion.path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-moss-600"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4 }}
      />
    </svg>
  );
}

export default function MorningCheckIn({ onComplete, goals = [], logMetric, yesterdayPlan = null }) {
  const [step, setStep] = useState('energy');
  const [selectedModifier, setSelectedModifier] = useState(null);
  const [measurementValues, setMeasurementValues] = useState({});

  const vitalityGoals = useMemo(
    () => (Array.isArray(goals) ? goals.filter((g) => g.type === 'vitality') : []),
    [goals]
  );

  const handleEnergySelect = (modifier) => {
    setSelectedModifier(modifier);
    if (vitalityGoals.length === 0) {
      onComplete?.(modifier);
      return;
    }
    const initial = {};
    vitalityGoals.forEach((g) => {
      initial[g.id] = measurementValues[g.id] ?? getPrefillValue(g);
    });
    setMeasurementValues((prev) => ({ ...prev, ...initial }));
    setStep('measurements');
  };

  const handleMeasurementsDone = () => {
    const today = new Date();
    vitalityGoals.forEach((g) => {
      const raw = measurementValues[g.id];
      if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))) {
        logMetric?.(g.id, Number(raw), today);
      }
    });
    onComplete?.(selectedModifier ?? 0);
  };

  const handleSkipMeasurements = () => {
    onComplete?.(selectedModifier ?? 0);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="morning-checkin-title"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-stone-50 rounded-2xl border border-stone-200 shadow-xl max-w-md w-full p-6"
      >
        <AnimatePresence mode="wait">
          {step === 'energy' && (
            <motion.div
              key="energy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="contents"
            >
              <h2 id="morning-checkin-title" className="font-serif text-stone-900 text-xl text-center mb-6">
                Good Morning. Calibrate your energy.
              </h2>
              {yesterdayPlan && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => handleEnergySelect(yesterdayPlan.modifier)}
                    className="w-full py-3 px-4 rounded-xl border-2 border-moss-300 bg-moss-50/80 font-sans text-sm text-moss-800 hover:bg-moss-100 hover:border-moss-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                  >
                    🔄 Repeat Yesterday&apos;s Flow
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.modifier}
                    type="button"
                    onClick={() => handleEnergySelect(opt.modifier)}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 bg-white text-left transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${opt.className}`}
                  >
                    <span className="text-3xl shrink-0" aria-hidden>
                      {opt.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="font-serif text-stone-900 font-medium">{opt.label}</p>
                      <p className="font-sans text-sm text-stone-600">{opt.sublabel}</p>
                      <p className="font-sans text-xs text-stone-400 mt-0.5">{opt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'measurements' && (
            <motion.div
              key="measurements"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <h2 id="morning-checkin-title" className="font-serif text-stone-900 text-xl text-center mb-2">
                Measurements
              </h2>
              <p className="font-sans text-sm text-stone-500 text-center mb-4">
                Quick log for your Vitality goals. Pre-filled from last time.
              </p>

              {vitalityGoals.length === 0 ? (
                <p className="font-sans text-sm text-stone-400 text-center py-4">No Vitality goals to log.</p>
              ) : (
                <div className="space-y-4">
                  {vitalityGoals.map((goal) => {
                    const metricName = goal.metricSettings?.metricName || goal.title;
                    const label = `Current ${metricName}?`;
                    const last7 = getLast7(goal);
                    return (
                      <div key={goal.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <label className="block font-sans text-sm font-medium text-stone-700 mb-1">{label}</label>
                          <input
                            type="number"
                            step="any"
                            value={measurementValues[goal.id] ?? getPrefillValue(goal)}
                            onChange={(e) =>
                              setMeasurementValues((prev) => ({ ...prev, [goal.id]: e.target.value }))
                            }
                            placeholder="—"
                            className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                            aria-label={label}
                          />
                        </div>
                        <div className="shrink-0 flex flex-col items-end">
                          <span className="font-sans text-xs text-stone-400 mb-0.5">7d</span>
                          <Sparkline data={last7} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                {vitalityGoals.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSkipMeasurements}
                    className="flex-1 py-3 font-sans text-stone-500 hover:text-stone-700 border border-stone-200 rounded-lg transition-colors"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleMeasurementsDone}
                  className="flex-1 py-3 font-sans text-stone-50 bg-moss-600 rounded-lg hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
