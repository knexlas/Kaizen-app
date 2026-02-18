import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEnergy } from '../../context/EnergyContext';

const SPOON_COUNT = 12;

/** Wooden spoon SVG – cozy, wooden style (amber). */
function WoodenSpoonIcon({ className = 'w-8 h-8 text-amber-700' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M7 2C9.76 2 12 4.24 12 7C12 8.64 11.21 10.11 10 11.09V22H4V11.09C2.79 10.11 2 8.64 2 7C2 4.24 4.24 2 7 2Z" />
    </svg>
  );
}

/** Dynamic label by spoon range (1–12). */
function getSpoonLabel(count) {
  if (count == null || count < 1) return null;
  if (count <= 4) return 'Survival Mode. We will go gently.';
  if (count <= 8) return 'Nourishing Day. Good for growth.';
  return 'Abundance. Ready for the harvest.';
}

/** Spoon count (1–12) → energy modifier for plan logic. */
function spoonCountToModifier(count) {
  if (count == null || count < 1) return 0;
  if (count <= 4) return -2;
  if (count <= 8) return 0;
  return 2;
}

/** Map legacy modifier to spoon count for "Repeat Yesterday". */
function modifierToSpoonCount(modifier) {
  if (modifier == null || typeof modifier !== 'number') return 6;
  if (modifier <= -2) return 4;
  if (modifier >= 1) return 9;
  return 6;
}

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
  const { setDailySpoonCount } = useEnergy();
  const [step, setStep] = useState('energy');
  const [selectedSpoonCount, setSelectedSpoonCount] = useState(null);
  const [hoverSpoonCount, setHoverSpoonCount] = useState(null);
  const [measurementValues, setMeasurementValues] = useState({});

  const vitalityGoals = useMemo(
    () => (Array.isArray(goals) ? goals.filter((g) => g.type === 'vitality') : []),
    [goals]
  );

  const yesterdaySpoonCount = useMemo(() => {
    if (!yesterdayPlan) return null;
    if (typeof yesterdayPlan.spoonCount === 'number' && yesterdayPlan.spoonCount >= 1 && yesterdayPlan.spoonCount <= 12) return yesterdayPlan.spoonCount;
    return modifierToSpoonCount(yesterdayPlan.modifier);
  }, [yesterdayPlan]);

  const handleSpoonSelect = (spoonCount) => {
    setSelectedSpoonCount(spoonCount);
    setDailySpoonCount(spoonCount);
    const modifier = spoonCountToModifier(spoonCount);
    if (vitalityGoals.length === 0) {
      onComplete?.(modifier, spoonCount);
      return;
    }
    const initial = {};
    vitalityGoals.forEach((g) => {
      initial[g.id] = measurementValues[g.id] ?? getPrefillValue(g);
    });
    setMeasurementValues((prev) => ({ ...prev, ...initial }));
    setStep('measurements');
  };

  const finishWithMeasurements = () => {
    const count = selectedSpoonCount ?? 6;
    setDailySpoonCount(count);
    onComplete?.(spoonCountToModifier(count), count);
  };

  const handleMeasurementsDone = () => {
    const today = new Date();
    vitalityGoals.forEach((g) => {
      const raw = measurementValues[g.id];
      if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))) {
        logMetric?.(g.id, Number(raw), today);
      }
    });
    finishWithMeasurements();
  };

  const handleSkipMeasurements = () => {
    finishWithMeasurements();
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
              <h2 id="morning-checkin-title" className="font-serif text-stone-900 text-xl text-center mb-2">
                Good Morning.
              </h2>
              <p className="font-sans text-stone-600 text-center mb-4">
                How many spoons did you wake up with?
              </p>
              {yesterdayPlan && yesterdaySpoonCount != null && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => handleSpoonSelect(yesterdaySpoonCount)}
                    className="w-full py-3 px-4 rounded-xl border-2 border-moss-300 bg-moss-50/80 font-sans text-sm text-moss-800 hover:bg-moss-100 hover:border-moss-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                  >
                    🔄 Repeat Yesterday&apos;s Flow ({yesterdaySpoonCount} spoons)
                  </button>
                </div>
              )}
              <div
                className="flex flex-wrap justify-center gap-0.5 sm:gap-1 mb-4"
                role="group"
                aria-label="Select number of spoons"
                onMouseLeave={() => setHoverSpoonCount(null)}
              >
                {Array.from({ length: SPOON_COUNT }, (_, i) => {
                  const count = i + 1;
                  const selected = selectedSpoonCount === count;
                  const highlightUpTo = hoverSpoonCount ?? selectedSpoonCount;
                  const highlighted = highlightUpTo != null && count <= highlightUpTo;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handleSpoonSelect(count)}
                      onMouseEnter={() => setHoverSpoonCount(count)}
                      className={`rounded-lg border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:ring-offset-1 ${
                        highlighted
                          ? 'border-amber-600 bg-amber-50 text-amber-800'
                          : 'border-stone-200 bg-white text-stone-400'
                      } ${selected ? 'ring-2 ring-amber-400/60 ring-offset-1' : ''}`}
                      style={{ width: 36, height: 36 }}
                      aria-pressed={selected}
                      aria-label={`${count} spoons`}
                      title={`${count} spoons`}
                    >
                      <WoodenSpoonIcon className="w-6 h-6 sm:w-7 sm:h-7 text-amber-700" />
                    </button>
                  );
                })}
              </div>
              {selectedSpoonCount != null && (
                <p className="font-sans text-sm text-stone-600 text-center">
                  {getSpoonLabel(selectedSpoonCount)}
                </p>
              )}
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
