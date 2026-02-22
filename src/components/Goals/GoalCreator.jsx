import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { suggestGoalStructure } from '../../services/geminiService';

// --- Wisdom Engine: RITUAL_PATTERNS + MILESTONE_PATTERNS (keywords -> rituals + milestones) ---
const RITUAL_PATTERNS = [
  {
    keywords: ['trade', 'trading', 'market', 'stock', 'finance', 'money'],
    rituals: [
      { title: 'Weekly Chart Review', days: [0] },
      { title: 'Pre-Market Prep', days: [1, 2, 3, 4, 5] },
      { title: 'Journal Review', days: [6] },
    ],
    milestones: [
      'Set up TradingView charts',
      'Define Risk-to-Reward ratio',
      'Backtest 50 trades',
      'Start Journaling',
    ],
  },
  {
    keywords: ['run', 'gym', 'workout', 'health', 'body'],
    rituals: [
      { title: 'Meal Prep', days: [0] },
      { title: 'Training Session', days: [1, 3, 5] },
      { title: 'Active Recovery', days: [6] },
    ],
    milestones: ['Buy Shoes', 'Run 5k', 'Run 10k', 'Half Marathon'],
  },
  {
    keywords: ['code', 'write', 'build', 'dev', 'create'],
    rituals: [
      { title: 'Deep Work Block', days: [1, 2, 3, 4, 5] },
      { title: 'Review Backlog', days: [5] },
    ],
    milestones: [],
  },
];

const DEFAULT_RITUAL = { title: 'Daily Focus', days: [1, 2, 3, 4, 5] };

function getSuggestionsForTitle(title) {
  if (!title?.trim()) return { rituals: null, milestones: null };
  const lower = title.toLowerCase();
  for (const pattern of RITUAL_PATTERNS) {
    if (pattern.keywords.some((k) => lower.includes(k))) {
      return { rituals: pattern.rituals, milestones: pattern.milestones ?? [] };
    }
  }
  return { rituals: null, milestones: null };
}

const DOMAINS = [
  { id: 'finance', label: 'Finance', emoji: '📈' },
  { id: 'body', label: 'Body', emoji: '🌿' },
  { id: 'mind', label: 'Mind', emoji: '🧠' },
  { id: 'spirit', label: 'Spirit', emoji: '✨' },
];

const DURATION_OPTIONS = [
  { minutes: 15, label: 'Quick (15m)', emoji: '🌱' },
  { minutes: 30, label: 'Standard (30m)', emoji: '🌿' },
  { minutes: 60, label: 'Deep Work (60m)', emoji: '🌳' },
  { minutes: 90, label: 'Marathon (90m)', emoji: '🏔️' },
];

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Built-in ritual names for the creatable select. Custom ones live in userSettings.ritualCategories. */
const DEFAULT_RITUAL_OPTIONS = ['Morning Heavy', 'Afternoon Heavy', 'Balanced', 'Evening Wind Down', 'Sunday Reset'];

function ritualNameToPreference(ritualName) {
  const n = (ritualName || '').trim();
  if (n === 'Morning Heavy') return 'morning';
  if (n === 'Afternoon Heavy') return 'afternoon';
  if (n === 'Balanced' || n === 'Evening Wind Down' || n === 'Sunday Reset') return 'balanced';
  return 'balanced';
}

function newRitual(overrides = {}) {
  return {
    id: crypto.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: '',
    days: [],
    frequency: 'weekly',
    monthDay: null,
    ...overrides,
  };
}

function newMilestone(title = '', overrides = {}) {
  return {
    id: crypto.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: typeof title === 'string' ? title : '',
    completed: false,
    ...overrides,
  };
}

function newVine(overrides = {}) {
  return {
    id: crypto.randomUUID?.() ?? `v-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: '',
    estimatedHours: 0,
    completedHours: 0,
    deadline: null,
    color: null,
    ...overrides,
  };
}

function GoalCreator({ open, onClose, onSave, initialTitle = '', initialSubtasks = [], existingRoutineGoals = [], existingVitalityGoals = [], ritualCategories = [], onAddRitualCategory }) {
  const [goalType, setGoalType] = useState(null); // null | 'kaizen' | 'routine' | 'vitality'
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [targetHours, setTargetHours] = useState(5);
  const [energyImpact, setEnergyImpact] = useState('drain'); // 'drain' | 'boost'
  const [spoonCost, setSpoonCost] = useState(1); // 1–4, per slot
  const [activationEnergy, setActivationEnergy] = useState(1); // 1–4, optional
  const [rituals, setRituals] = useState(() => [newRitual()]);
  const [milestones, setMilestones] = useState(() => []);
  const [milestoneInput, setMilestoneInput] = useState('');
  const [notes, setNotes] = useState('');
  const [linkedVitalityId, setLinkedVitalityId] = useState('');
  const [toast, setToast] = useState(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedMetrics, setSuggestedMetrics] = useState([]);
  const [linkedMetrics, setLinkedMetrics] = useState([]); // selected metric names
  // Routine: Schedule mode (Solid vs Liquid) and settings
  const [scheduleMode, setScheduleMode] = useState('liquid');
  const [solidStart, setSolidStart] = useState('09:00');
  const [solidEnd, setSolidEnd] = useState('17:00');
  const [solidDays, setSolidDays] = useState([1, 2, 3, 4, 5]);
  const [liquidTarget, setLiquidTarget] = useState(15);
  const [liquidPeriod, setLiquidPeriod] = useState('week');
  const [ritualName, setRitualName] = useState('Balanced');
  // Vitality: Tracking (existing or create new)
  const [trackingChoice, setTrackingChoice] = useState(''); // '' | 'create_new' | existing metric name
  const [metricName, setMetricName] = useState('');
  const [metricUnit, setMetricUnit] = useState('');
  const [metricCurrentValue, setMetricCurrentValue] = useState('');
  const [metricTargetValue, setMetricTargetValue] = useState('');
  const [metricDirection, setMetricDirection] = useState('lower'); // 'lower' | 'higher'
  const [tributaryGoalIds, setTributaryGoalIds] = useState([]); // Routine Rocks that feed this Vitality goal
  // Vines (subtasks) for routine / kaizen
  const [vines, setVines] = useState([]);
  const [suggestedVines, setSuggestedVines] = useState([]);
  const [vineTitle, setVineTitle] = useState('');
  const [vineHours, setVineHours] = useState('');
  const [vineDeadline, setVineDeadline] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2800);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (open && initialTitle) setTitle(initialTitle);
  }, [open, initialTitle]);

  useEffect(() => {
    if (!open) {
      setGoalType(null);
      setShowAdvanced(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && goalType === 'vitality' && trackingChoice === '') setTrackingChoice('create_new');
  }, [open, goalType]);

  // Prism flow: open as Kaizen with pre-filled subtasks
  useEffect(() => {
    if (!open) return;
    const subtasks = Array.isArray(initialSubtasks) ? initialSubtasks.filter((s) => typeof s === 'string' && s.trim()) : [];
    if (subtasks.length > 0) {
      setGoalType('kaizen');
      setVines(subtasks.map((t) => newVine({ title: t.trim(), estimatedHours: 0 })));
    }
  }, [open, initialSubtasks]);

  // Kaizen Metric Steps: when Vitality has Start + Target, auto-fill milestones
  useEffect(() => {
    if (goalType === 'vitality' && metricCurrentValue && metricTargetValue) {
      const start = parseFloat(metricCurrentValue);
      const end = parseFloat(metricTargetValue);
      if (!isNaN(start) && !isNaN(end) && start !== end && milestones.length === 0) {
        const diff = start - end;
        const step = diff / 4;
        const newMs = [
          newMilestone(`Reach ${Math.round((start - step) * 10) / 10}`),
          newMilestone(`Reach ${Math.round((start - step * 2) * 10) / 10}`),
          newMilestone(`Reach ${Math.round((start - step * 3) * 10) / 10}`),
          newMilestone(`Reach ${end}`),
        ];
        setMilestones(newMs);
      }
    }
  }, [metricCurrentValue, metricTargetValue, goalType, milestones.length]);

  const toggleSolidDay = (dayIndex) => {
    setSolidDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex).sort((a, b) => a - b)
        : [...prev, dayIndex].sort((a, b) => a - b)
    );
  };

  const toggleDay = (ritualId, dayIndex) => {
    setRituals((prev) =>
      prev.map((r) =>
        r.id === ritualId
          ? {
              ...r,
              days: r.days.includes(dayIndex)
                ? r.days.filter((d) => d !== dayIndex)
                : [...r.days, dayIndex].sort((a, b) => a - b),
            }
          : r
      )
    );
  };

  const addRitual = (suggestion = null) => {
    if (suggestion) {
      setRituals((prev) => [...prev, newRitual({ title: suggestion.title, days: [...suggestion.days] })]);
    } else {
      setRituals((prev) => [...prev, newRitual()]);
    }
  };

  const updateRitualTitle = (ritualId, value) => {
    setRituals((prev) => prev.map((r) => (r.id === ritualId ? { ...r, title: value } : r)));
  };
  const updateRitualFrequency = (ritualId, value) => {
    setRituals((prev) => prev.map((r) => (r.id === ritualId ? { ...r, frequency: value, ...(value === 'monthly' ? { monthDay: r.monthDay ?? 1 } : {}) } : r)));
  };
  const updateRitualMonthDay = (ritualId, value) => {
    const num = Math.max(1, Math.min(31, parseInt(value, 10) || 1));
    setRituals((prev) => prev.map((r) => (r.id === ritualId ? { ...r, monthDay: num } : r)));
  };

  const removeRitual = (ritualId) => {
    setRituals((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== ritualId)));
  };

  const addMilestone = (titleOrSuggestion = '') => {
    const title = typeof titleOrSuggestion === 'string' ? titleOrSuggestion : titleOrSuggestion?.title ?? '';
    if (!title.trim()) return;
    setMilestones((prev) => [...prev, newMilestone(title.trim())]);
  };

  const handleMilestoneInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addMilestone(milestoneInput);
      setMilestoneInput('');
    }
  };

  const removeMilestone = (milestoneId) => {
    setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
  };

  const updateMilestoneTitle = (milestoneId, value) => {
    setMilestones((prev) => prev.map((m) => (m.id === milestoneId ? { ...m, title: value } : m)));
  };

  const addVine = (e) => {
    e?.preventDefault?.();
    const t = vineTitle.trim();
    if (!t) return;
    const hours = parseFloat(vineHours) || 0;
    setVines((prev) => [...prev, newVine({ title: t, estimatedHours: hours, deadline: vineDeadline.trim() || null })]);
    setVineTitle('');
    setVineHours('');
    setVineDeadline('');
  };

  const removeVine = (vineId) => {
    setVines((prev) => prev.filter((v) => v.id !== vineId));
  };

  const handleSuggest = async () => {
    if (!title.trim()) return;
    setIsSuggesting(true);
    setToast('Mochi is dreaming up a plan...');

    try {
      const suggestion = await suggestGoalStructure(
        title,
        goalType,
        metricCurrentValue,
        metricTargetValue
      );

      if (suggestion) {
        const isFallback = suggestion._fallback === true;
        const fallbackReason = suggestion._reason;
        if (isFallback) { delete suggestion._fallback; delete suggestion._reason; }

        // Only update structure from AI — never overwrite the user's title
        if (suggestion.estimatedMinutes) setEstimatedMinutes(suggestion.estimatedMinutes);
        if (suggestion.targetHours) setTargetHours(suggestion.targetHours);

        if (goalType === 'routine' && Array.isArray(suggestion.rituals) && suggestion.rituals[0]?.title) {
          setRitualName(suggestion.rituals[0].title);
        }
        if (Array.isArray(suggestion.rituals) && goalType === 'kaizen') {
          const newRituals = suggestion.rituals.map((r) => newRitual({ title: r.title, days: r.days }));
          setRituals(newRituals.length ? newRituals : [newRitual()]);
        }

        if (Array.isArray(suggestion.vines)) {
          setSuggestedVines(suggestion.vines);
        }
        if (Array.isArray(suggestion.milestones)) {
          setMilestones(suggestion.milestones.map((t) => newMilestone(t)));
        }
        if (Array.isArray(suggestion.suggestedMetrics) && suggestion.suggestedMetrics.length > 0) {
          setSuggestedMetrics(suggestion.suggestedMetrics);
        }
        if (suggestion.strategy && goalType === 'kaizen') setNotes(suggestion.strategy);

        setToast(
          isFallback
            ? fallbackReason === 'quota'
              ? 'Free-tier quota reached for today. Default plan applied — try again tomorrow.'
              : "Default plan applied (Mochi couldn't connect). Try again for a custom plan."
            : 'Plan sprouted!'
        );
      } else {
        setToast('Mochi is meditating... try again?');
      }
    } catch (e) {
      console.error(e);
      setToast('Connection to the spirit realm failed.');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const isRoutine = goalType === 'routine';
    const isVitality = goalType === 'vitality';
    const schedulerSettings = isRoutine
      ? scheduleMode === 'solid'
        ? { mode: 'solid', days: [...solidDays], start: solidStart, end: solidEnd }
        : (() => {
            const rName = (ritualName || 'Balanced').trim();
            const allRituals = [...DEFAULT_RITUAL_OPTIONS, ...(ritualCategories || [])];
            if (rName && typeof onAddRitualCategory === 'function' && !allRituals.some((n) => String(n).trim().toLowerCase() === rName.toLowerCase())) {
              onAddRitualCategory(rName);
            }
            return {
              mode: 'liquid',
              monthlyTarget: liquidPeriod === 'month' ? liquidTarget : liquidTarget * 4,
              weeklyTarget: liquidPeriod === 'week' ? liquidTarget : Math.round((liquidTarget / 4) * 10) / 10,
              ritualName: rName || 'Balanced',
              preference: ritualNameToPreference(rName),
            };
          })()
      : undefined;
    const metricSettings = isVitality
      ? {
          metricName: trackingChoice === 'create_new' ? trimmedTitle : (metricName.trim() || trimmedTitle),
          unit: metricUnit.trim() || undefined,
          currentValue: Number(metricCurrentValue) ?? 0,
          targetValue: metricTargetValue !== '' && !Number.isNaN(Number(metricTargetValue)) ? Number(metricTargetValue) : undefined,
          direction: metricDirection,
        }
      : undefined;
    const goal = {
      id: crypto.randomUUID?.() ?? `goal-${Date.now()}`,
      type: isVitality ? 'vitality' : isRoutine ? 'routine' : 'kaizen',
      title: trimmedTitle,
      domain: domain || DOMAINS[0].id,
      estimatedMinutes: isVitality ? undefined : (estimatedMinutes ?? 60),
      targetHours: isVitality ? undefined : (targetHours ?? 5),
      energyImpact: isVitality ? undefined : (energyImpact || 'drain'),
      spoonCost: isVitality ? undefined : (spoonCost >= 1 && spoonCost <= 4 ? spoonCost : 1),
      activationEnergy: isVitality ? undefined : (activationEnergy >= 1 && activationEnergy <= 4 ? activationEnergy : 1),
      ...(isRoutine && schedulerSettings && { schedulerSettings }),
      ...(isVitality && { metricSettings, metrics: [], tributaryGoalIds: tributaryGoalIds.length ? [...tributaryGoalIds] : [] }),
      rituals: isRoutine || isVitality ? [] : rituals
        .filter((r) => r.title.trim())
        .map((r) => ({ id: r.id, title: r.title.trim(), days: r.days || [], frequency: r.frequency || 'weekly', monthDay: r.monthDay ?? null })),
      milestones: isRoutine || isVitality ? [] : milestones.map((m) => ({ id: m.id, title: m.title.trim() || m.title, completed: m.completed ?? false })),
      notes: isRoutine || isVitality ? '' : notes.trim(),
      ...((isRoutine || goalType === 'kaizen') && { subtasks: vines.map((v) => ({ id: v.id, title: v.title, estimatedHours: Number(v.estimatedHours) || 0, completedHours: 0, deadline: v.deadline || null, color: null })) }),
      ...(goalType === 'kaizen' && linkedVitalityId && { linkedVitalityGoalId: linkedVitalityId }),
      ...(linkedMetrics.length > 0 && { linkedMetrics: linkedMetrics.map((name) => {
        const found = suggestedMetrics.find((m) => m.name === name);
        return found ? { name: found.name, unit: found.unit, direction: found.direction } : { name, unit: '', direction: 'higher' };
      }) }),
    };

    // Auto-create vitality goals for linked metrics that don't have an existing tracker
    if (linkedMetrics.length > 0 && onSave) {
      linkedMetrics.forEach((metricName) => {
        const hasExisting = (existingVitalityGoals || []).some(
          (vg) => vg.title.toLowerCase().includes(metricName.toLowerCase()) || metricName.toLowerCase().includes(vg.title.toLowerCase())
        );
        if (!hasExisting) {
          const metricDef = suggestedMetrics.find((m) => m.name === metricName);
          const vitalityGoal = {
            id: crypto.randomUUID?.() ?? `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'vitality',
            title: metricName,
            domain: domain || 'body',
            metricSettings: {
              metricName: metricName,
              unit: metricDef?.unit ?? '',
              direction: metricDef?.direction ?? 'higher',
            },
            metrics: [],
            tributaryGoalIds: [goal.id],
          };
          onSave(vitalityGoal);
          if (!goal.linkedVitalityGoalId) {
            goal.linkedVitalityGoalId = vitalityGoal.id;
          }
        }
      });
    }

    onSave?.(goal);
    onClose?.();
    setGoalType(null);
    setTitle('');
    setDomain('');
    setEstimatedMinutes(60);
    setTargetHours(5);
    setEnergyImpact('drain');
    setSpoonCost(1);
    setActivationEnergy(1);
    setRituals([newRitual()]);
    setMilestones([]);
    setMilestoneInput('');
    setNotes('');
    setScheduleMode('liquid');
    setSolidStart('09:00');
    setSolidEnd('17:00');
    setSolidDays([1, 2, 3, 4, 5]);
    setLiquidTarget(15);
    setLiquidPeriod('week');
    setRitualName('Balanced');
    setTrackingChoice('');
    setSuggestedMetrics([]);
    setLinkedMetrics([]);
    setMetricName('');
    setMetricUnit('');
    setMetricCurrentValue('');
    setMetricTargetValue('');
    setMetricDirection('lower');
    setTributaryGoalIds([]);
    setVines([]);
    setSuggestedVines([]);
    setVineTitle('');
    setVineHours('');
    setVineDeadline('');
    setLinkedVitalityId('');
  };

  const showTypeChoice = open && goalType == null;
  const showForm = open && goalType != null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 50, opacity: 0.95 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-stone-50 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step 0: Choose type — two large cards */}
            {showTypeChoice && (
              <div className="p-6 pb-8">
                <h2 className="font-serif text-stone-900 text-xl mb-2">What are you adding?</h2>
                <p className="font-sans text-stone-500 text-sm mb-4">Choose how you want to grow.</p>
                <div className="mb-4 p-3 rounded-xl bg-stone-100/80 border border-stone-200">
                  <p className="font-sans text-xs text-stone-600">
                    <strong className="text-stone-700">Seed</strong> = goal + steps + optional practice days (rituals). &middot; <strong className="text-stone-700">Rock</strong> = recurring habit, weekly target. &middot; <strong className="text-stone-700">Vitality</strong> = one number to track.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setGoalType('kaizen')}
                    className="flex flex-col items-start p-5 rounded-2xl border-2 border-stone-200 bg-white hover:border-moss-500 hover:bg-moss-50/30 transition-all text-left focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                  >
                    <span className="text-2xl mb-2" aria-hidden>🌱</span>
                    <span className="font-serif text-stone-900 text-base">Plant a Seed</span>
                    <span className="font-sans text-stone-600 text-xs mt-0.5">(Kaizen)</span>
                    <p className="font-sans text-stone-500 text-xs mt-2">Something new. Needs steps. Grows over time.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoalType('routine')}
                    className="flex flex-col items-start p-5 rounded-2xl border-2 border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50/50 transition-all text-left focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                  >
                    <span className="text-2xl mb-2" aria-hidden>🪨</span>
                    <span className="font-serif text-stone-900 text-base">Place a Rock</span>
                    <span className="font-sans text-stone-600 text-xs mt-0.5">(Routine)</span>
                    <p className="font-sans text-stone-500 text-xs mt-2">Recurring work. Needs consistency. Fills a bucket.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoalType('vitality')}
                    className="flex flex-col items-start p-5 rounded-2xl border-2 border-stone-200 bg-white hover:border-sky-400 hover:bg-sky-50/50 transition-all text-left focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                  >
                    <span className="text-2xl mb-2" aria-hidden>💧</span>
                    <span className="font-serif text-stone-900 text-base">Vitality</span>
                    <span className="font-sans text-stone-600 text-xs mt-0.5">(Health / Metric)</span>
                    <p className="font-sans text-stone-500 text-xs mt-2">Track a number. Weight, sleep, body fat. Lower or higher.</p>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 w-full py-2.5 font-sans text-sm text-stone-500 hover:text-stone-700 border border-stone-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Step 1: Form — Kaizen or Routine */}
            {showForm && (
            <form onSubmit={handleSubmit} className="p-6 pb-8" noValidate>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="font-serif text-stone-900 text-xl flex-1">
                  {goalType === 'routine' ? 'Place a Rock' : goalType === 'vitality' ? 'Track a Metric' : 'Plant a Seed'}
                </h2>
                <div className="flex items-center gap-1.5">
                  {['Type', 'Details', 'Save'].map((label, i) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-sans font-bold ${
                        i === 0 ? 'bg-moss-500 text-white' : i === 1 ? 'bg-moss-500 text-white' : 'bg-stone-200 text-stone-500'
                      }`}>
                        {i === 0 ? '✓' : i + 1}
                      </div>
                      {i < 2 && <div className={`w-3 h-0.5 ${i === 0 ? 'bg-moss-400' : 'bg-stone-200'}`} />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6 p-4 bg-gradient-to-br from-moss-50 to-stone-50 border border-moss-200/60 rounded-xl flex gap-4 items-start shadow-sm">
                <div className="text-3xl animate-bounce-slow">✨</div>
                <div>
                  <p className="font-serif text-moss-900 text-lg mb-1">Let's plant a new seed.</p>
                  <p className="font-sans text-sm text-moss-700 leading-relaxed">
                    Don't worry about the details yet. Just type what you want to achieve below, and click <strong className="bg-moss-100 px-1 rounded">✨ Suggest</strong>. I will help you break it down into tiny, Kaizen-sized steps!
                  </p>
                </div>
              </div>

              {/* Name */}
              <label className="block font-sans text-sm font-medium text-stone-600 mb-1">Name</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Learn to play piano, Drink more water, or Read a book..."
                className="w-full py-2 bg-transparent border-0 border-b-2 border-stone-200 text-stone-900 font-sans placeholder-stone-400 focus:outline-none focus:border-moss-500 focus:ring-0 mb-4"
              />

              {/* Suggest based on Title — always visible for low-friction start */}
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSuggest}
                  disabled={isSuggesting}
                  className="px-4 py-2 rounded-xl font-sans text-sm font-medium bg-moss-100 text-moss-800 hover:bg-moss-200 border border-moss-300 focus:outline-none focus:ring-2 focus:ring-moss-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSuggesting ? '…' : '✨ Suggest based on Title'}
                </button>
                <span className="font-sans text-xs text-stone-400">Session length, steps, and more from Mochi.</span>
              </div>

              {/* Advanced: Color, Energy, Spoons, Activation, Tracking, Schedule, Target Hours, Notes */}
              {showAdvanced && (
              <div className="space-y-6 border-t border-stone-200 pt-6">
              {/* Color (domain) */}
              <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Color</label>
              <div className="flex flex-wrap gap-2 mb-6">
                {DOMAINS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDomain(d.id)}
                    className={`px-4 py-2 rounded-full font-sans text-sm transition-colors ${
                      domain === d.id ? 'bg-moss-600 text-stone-50' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {d.label} {d.emoji}
                  </button>
                ))}
              </div>

              {/* Energy Impact (kaizen + routine only) */}
              {(goalType === 'kaizen' || goalType === 'routine') && (
                <>
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Energy impact</label>
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setEnergyImpact('drain')}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-sans text-sm font-medium transition-colors border-2 ${
                        energyImpact === 'drain' ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300'
                      }`}
                    >
                      🔋 Takes energy
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnergyImpact('boost')}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-sans text-sm font-medium transition-colors border-2 ${
                        energyImpact === 'boost' ? 'border-moss-400 bg-moss-50 text-moss-800' : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300'
                      }`}
                    >
                      ⚡ Gives energy
                    </button>
                  </div>
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-1.5">Spoon cost per slot (1–4)</label>
                  <p className="font-sans text-xs text-stone-500 mb-2">How many spoons this task uses. Rest blocks are added after high-cost tasks.</p>
                  <div className="flex gap-2 mb-6">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSpoonCost(n)}
                        className={`w-10 h-10 rounded-lg font-sans text-sm font-medium transition-colors border-2 ${
                          spoonCost === n ? 'border-moss-500 bg-moss-100 text-moss-800' : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300'
                        }`}
                        title={`${n} spoon${n > 1 ? 's' : ''}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Vitality: Tracking (existing metric or create new) */}
              {goalType === 'vitality' && (() => {
                const existingMetrics = [];
                const seen = new Set();
                (existingVitalityGoals || []).forEach((g) => {
                  const name = g.metricSettings?.metricName?.trim();
                  if (name && !seen.has(name)) {
                    seen.add(name);
                    existingMetrics.push({
                      name,
                      unit: g.metricSettings?.unit?.trim() || '',
                      targetValue: g.metricSettings?.targetValue,
                    });
                  }
                });
                return (
                  <div className="space-y-4 p-4 rounded-xl bg-sky-50/80 border border-sky-200 mb-6">
                    <div>
                      <label className="block font-sans text-sm font-medium text-stone-600 mb-1">Tracking</label>
                      <select
                        value={trackingChoice === 'create_new' ? '__create_new__' : trackingChoice}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__create_new__') {
                            setTrackingChoice('create_new');
                            setMetricName('');
                            setMetricUnit('');
                            setMetricCurrentValue('');
                            setMetricTargetValue('');
                          } else if (v) {
                            setTrackingChoice(v);
                            const existing = existingMetrics.find((m) => m.name === v);
                            if (existing) {
                              setMetricName(existing.name);
                              setMetricUnit(existing.unit || '');
                              setMetricTargetValue(existing.targetValue != null ? String(existing.targetValue) : '');
                            }
                          } else {
                            setTrackingChoice('');
                          }
                        }}
                        className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                      >
                        <option value="">Choose or create a metric…</option>
                        {existingMetrics.map((m) => (
                          <option key={m.name} value={m.name}>
                            {m.name}{m.unit ? ` (${m.unit})` : ''}
                          </option>
                        ))}
                        <option value="__create_new__">+ Create New Metric</option>
                      </select>
                    </div>

                    {(trackingChoice === 'create_new' || trackingChoice !== '') && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {trackingChoice !== 'create_new' && (
                            <div>
                              <label className="block font-sans text-sm font-medium text-stone-600 mb-1">Metric Name</label>
                              <input
                                type="text"
                                value={metricName}
                                onChange={(e) => setMetricName(e.target.value)}
                                placeholder="e.g. Weight, Sleep Score"
                                className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                              />
                            </div>
                          )}
                          <div>
                            <label className="block font-sans text-sm font-medium text-stone-600 mb-1">Unit</label>
                            <input
                              type="text"
                              value={metricUnit}
                              onChange={(e) => setMetricUnit(e.target.value)}
                              placeholder="e.g. kg, hrs, steps"
                              className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block font-sans text-sm font-medium text-stone-600 mb-1">Current Value</label>
                            <input
                              type="number"
                              step="any"
                              value={metricCurrentValue}
                              onChange={(e) => setMetricCurrentValue(e.target.value)}
                              placeholder="e.g. 90"
                              className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                            />
                          </div>
                          <div>
                            <label className="block font-sans text-sm font-medium text-stone-600 mb-1">Target Value (optional)</label>
                            <input
                              type="number"
                              step="any"
                              value={metricTargetValue}
                              onChange={(e) => setMetricTargetValue(e.target.value)}
                              placeholder="e.g. 80"
                              className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Direction</label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setMetricDirection('lower')}
                              className={`px-4 py-2 rounded-lg font-sans text-sm transition-colors ${
                                metricDirection === 'lower' ? 'bg-moss-600 text-stone-50' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                              }`}
                            >
                              Lower is better
                            </button>
                            <button
                              type="button"
                              onClick={() => setMetricDirection('higher')}
                              className={`px-4 py-2 rounded-lg font-sans text-sm transition-colors ${
                                metricDirection === 'higher' ? 'bg-moss-600 text-stone-50' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                              }`}
                            >
                              Higher is better
                            </button>
                          </div>
                          <p className="font-sans text-xs text-stone-500 mt-1">
                            {metricDirection === 'lower' ? 'e.g. Weight, Body Fat' : 'e.g. Sleep Score, Steps'}
                          </p>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block font-sans text-sm font-medium text-stone-600 mb-2">What habits feed this goal?</label>
                      <p className="font-sans text-xs text-stone-500 mb-2">Select Routine Rocks (Tributaries) that feed this Pond.</p>
                      {existingRoutineGoals.length === 0 ? (
                        <p className="font-sans text-xs text-stone-400 py-2">No Routine Rocks yet. Add Rocks from the dashboard, then link them here when editing.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {existingRoutineGoals.map((rock) => {
                            const isSelected = tributaryGoalIds.includes(rock.id);
                            return (
                              <button
                                key={rock.id}
                                type="button"
                                onClick={() => {
                                  setTributaryGoalIds((prev) =>
                                    isSelected ? prev.filter((id) => id !== rock.id) : [...prev, rock.id]
                                  );
                                }}
                                className={`px-3 py-2 rounded-lg font-sans text-sm transition-colors border ${
                                  isSelected
                                    ? 'bg-moss-100 border-moss-400 text-moss-800'
                                    : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
                                }`}
                              >
                                🪨 {rock.title}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Routine: Schedule Mode (Solid vs Liquid) + settings */}
              {goalType === 'routine' && (
                <>
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Schedule Mode</label>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => setScheduleMode('solid')}
                      className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 ${
                        scheduleMode === 'solid'
                          ? 'border-moss-500 bg-moss-50'
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      <span className="text-xl mb-1" aria-hidden>🧊</span>
                      <span className="font-sans font-medium text-stone-800">Solid Structure</span>
                      <span className="font-sans text-xs text-stone-500 mt-0.5">Fixed times & days</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode('liquid')}
                      className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 ${
                        scheduleMode === 'liquid'
                          ? 'border-moss-500 bg-moss-50'
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      <span className="text-xl mb-1" aria-hidden>💧</span>
                      <span className="font-sans font-medium text-stone-800">Liquid Flow</span>
                      <span className="font-sans text-xs text-stone-500 mt-0.5">Flexible target hours</span>
                    </button>
                  </div>

                  {scheduleMode === 'solid' && (
                    <div className="space-y-4 p-4 rounded-xl bg-stone-100/80 border border-stone-200 mb-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block font-sans text-xs font-medium text-stone-600 mb-1">Start Time</label>
                          <input
                            type="time"
                            value={solidStart}
                            onChange={(e) => setSolidStart(e.target.value)}
                            className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                          />
                        </div>
                        <div>
                          <label className="block font-sans text-xs font-medium text-stone-600 mb-1">End Time</label>
                          <input
                            type="time"
                            value={solidEnd}
                            onChange={(e) => setSolidEnd(e.target.value)}
                            className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-sans text-xs font-medium text-stone-600 mb-2">Days</label>
                        <div className="flex items-center gap-1">
                          {DAY_LETTERS.map((letter, j) => (
                            <button
                              key={j}
                              type="button"
                              onClick={() => toggleSolidDay(j)}
                              className={`w-8 h-8 rounded font-sans text-xs font-medium transition-colors ${
                                solidDays.includes(j) ? 'bg-moss-600 text-stone-50' : 'bg-stone-200 text-stone-500 hover:bg-stone-300'
                              }`}
                            >
                              {letter}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {scheduleMode === 'liquid' && (
                    <div className="space-y-4 p-4 rounded-xl bg-stone-100/80 border border-stone-200 mb-6">
                      <div>
                        <label className="block font-sans text-xs font-medium text-stone-600 mb-2">Target Hours</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={liquidTarget}
                            onChange={(e) => setLiquidTarget(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                            className="w-20 py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                          />
                          <span className="font-sans text-sm text-stone-600">h /</span>
                          <select
                            value={liquidPeriod}
                            onChange={(e) => setLiquidPeriod(e.target.value)}
                            className="py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                          >
                            <option value="week">Week</option>
                            <option value="month">Month</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block font-sans text-xs font-medium text-stone-600 mb-1">Ritual</label>
                        <p className="font-sans text-xs text-stone-500 mb-2">When this block tends to happen (e.g. Morning, Evening, Sunday Reset). Type to create a new one.</p>
                        <input
                          type="text"
                          list="ritual-options"
                          value={ritualName}
                          onChange={(e) => setRitualName(e.target.value)}
                          onBlur={(e) => { const v = e.target.value.trim(); if (v) setRitualName(v); }}
                          placeholder="e.g. Morning Heavy, Sunday Reset"
                          className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                          aria-label="Ritual name"
                        />
                        <datalist id="ritual-options">
                          {[...DEFAULT_RITUAL_OPTIONS, ...(ritualCategories || [])]
                            .filter((n, i, a) => a.findIndex((x) => String(x).trim().toLowerCase() === String(n).trim().toLowerCase()) === i)
                            .map((name) => (
                              <option key={name} value={name} />
                            ))}
                        </datalist>
                      </div>
                    </div>
                  )}

                  <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Weekly Target Hours</label>
                  <div className="flex items-center gap-3 mb-6">
                    <input
                      type="range"
                      min={1}
                      max={40}
                      value={targetHours}
                      onChange={(e) => setTargetHours(Number(e.target.value))}
                      className="flex-1 h-2 rounded-full appearance-none bg-stone-200 accent-moss-600"
                    />
                    <span className="font-sans text-sm font-medium text-stone-700 w-10">{targetHours}h</span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center mb-4">
                    <button
                      type="button"
                      onClick={handleSuggest}
                      disabled={isSuggesting}
                      className="font-sans text-sm text-moss-600 font-medium hover:text-moss-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✨ Suggest based on Title
                    </button>
                    <span className="font-sans text-xs text-stone-400">Session length, target hours, and subtasks from Mochi.</span>
                  </div>
                </>
              )}

              {/* Kaizen: Duration, Rituals, Milestones, Notes */}
              {goalType === 'kaizen' && (
                <>
              {/* Duration Estimate */}
              <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Duration Estimate</label>
              <div className="flex flex-wrap gap-2 mb-6">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() => setEstimatedMinutes(opt.minutes)}
                    className={`px-4 py-2 rounded-full font-sans text-sm transition-colors ${
                      estimatedMinutes === opt.minutes
                        ? 'bg-moss-600 text-stone-50'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>

              {/* Weekly Target Hours (Kaizen: optional bucket) */}
              <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Weekly Target Hours</label>
              <div className="flex items-center gap-3 mb-6">
                <input
                  type="range"
                  min={1}
                  max={40}
                  value={targetHours}
                  onChange={(e) => setTargetHours(Number(e.target.value))}
                  className="flex-1 h-2 rounded-full appearance-none bg-stone-200 accent-moss-600"
                />
                <span className="font-sans text-sm font-medium text-stone-700 w-10">{targetHours}h</span>
              </div>

              {/* Rituals = when you practice this Seed (Kaizen only) */}
              <div className="mb-2 mt-4 pt-4 border-t border-stone-200">
                <label className="font-sans text-sm font-medium text-stone-700 block">Practice schedule (rituals)</label>
                <p className="font-sans text-xs text-stone-500 mt-0.5">Which days do you want to work on this? Rituals show up in your schedule as recurring blocks.</p>
              </div>
              <div className="space-y-3 mb-4">
                {rituals.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={r.title}
                      onChange={(e) => updateRitualTitle(r.id, e.target.value)}
                      placeholder="Ritual name"
                      className="flex-1 min-w-[120px] py-2 px-2 border-b border-stone-200 bg-transparent font-sans text-sm placeholder-stone-400 focus:outline-none focus:border-moss-500"
                    />
                    <select
                      value={r.frequency || 'weekly'}
                      onChange={(e) => updateRitualFrequency(r.id, e.target.value)}
                      className="py-1.5 px-2 rounded-lg border border-stone-200 bg-white font-sans text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    {(r.frequency || 'weekly') === 'monthly' ? (
                      <label className="flex items-center gap-1 font-sans text-xs text-stone-600">
                        Day of month
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={r.monthDay ?? 1}
                          onChange={(e) => updateRitualMonthDay(r.id, e.target.value)}
                          className="w-12 py-1 px-1.5 rounded border border-stone-200 font-sans text-sm"
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-0.5">
                        {DAY_LETTERS.map((letter, j) => (
                          <button
                            key={j}
                            type="button"
                            onClick={() => toggleDay(r.id, j)}
                            className={`w-7 h-7 rounded font-sans text-xs font-medium transition-colors ${
                              (r.days || []).includes(j) ? 'bg-moss-600 text-stone-50' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                            }`}
                          >
                            {letter}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRitual(r.id)}
                      className="w-7 h-7 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200 font-sans text-sm"
                      aria-label="Delete"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => addRitual()}
                  className="font-sans text-sm text-stone-600 hover:text-stone-900"
                >
                  + Add Custom
                </button>
                <button
                  type="button"
                  onClick={handleSuggest}
                  disabled={isSuggesting}
                  className="font-sans text-sm text-moss-600 font-medium hover:text-moss-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✨ Suggest based on Title
                </button>
                <p className="font-sans text-xs text-stone-400 w-full mt-1">Change the title and run again for a new plan.</p>
              </div>

              {/* Milestones (Break it down) */}
              <div className="mb-4">
                <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Milestones (Break it down)</label>
                <input
                  type="text"
                  value={milestoneInput}
                  onChange={(e) => setMilestoneInput(e.target.value)}
                  onKeyDown={handleMilestoneInputKeyDown}
                  placeholder="+ Add Milestone (press Enter)"
                  className="w-full py-2 px-3 mb-2 border border-stone-200 rounded-lg bg-white font-sans text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                />
                <div className="space-y-2">
                  {milestones.map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={m.completed ?? false}
                        onChange={() => setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, completed: !x.completed } : x)))}
                        className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50"
                      />
                      <input
                        type="text"
                        value={m.title}
                        onChange={(e) => updateMilestoneTitle(m.id, e.target.value)}
                        placeholder="Milestone"
                        className="flex-1 min-w-0 py-1.5 px-2 border-b border-stone-200 bg-transparent font-sans text-sm placeholder-stone-400 focus:outline-none focus:border-moss-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeMilestone(m.id)}
                        className="text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded p-1 font-sans"
                        aria-label="Remove milestone"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addMilestone()}
                  className="mt-2 font-sans text-sm text-stone-600 hover:text-stone-900"
                >
                  + Add Milestone
                </button>
              </div>

              {/* AI-Suggested Metrics */}
              {suggestedMetrics.length > 0 && (goalType === 'kaizen' || goalType === 'routine') && (
                <div className="mb-4">
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Track a Metric</label>
                  <p className="font-sans text-xs text-stone-400 mb-2">AI-suggested metrics for this goal. Tap to link. If no matching tracker exists, one will be created for you.</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedMetrics.map((m, idx) => {
                      const isLinked = linkedMetrics.includes(m.name);
                      const hasExistingVitality = (existingVitalityGoals || []).some(
                        (vg) => vg.title.toLowerCase().includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(vg.title.toLowerCase())
                      );
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setLinkedMetrics((prev) =>
                              isLinked ? prev.filter((n) => n !== m.name) : [...prev, m.name]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-full font-sans text-sm border transition-colors ${
                            isLinked
                              ? 'bg-moss-100 border-moss-500 text-moss-800 ring-1 ring-moss-500/30'
                              : 'bg-white border-stone-200 text-stone-600 hover:border-moss-300 hover:text-moss-700'
                          }`}
                        >
                          {m.direction === 'higher' ? '↑' : '↓'} {m.name} ({m.unit})
                          {isLinked && !hasExistingVitality && (
                            <span className="ml-1 text-[10px] text-moss-600">+ new tracker</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Strategy &amp; Constraints</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remember: Don't fight the trend..."
                rows={3}
                className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white text-stone-900 font-sans text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 resize-none"
              />

              {/* Link to Vitality Metric (optional) */}
              <div className="mt-4 p-4 bg-sky-50 rounded-xl border border-sky-100">
                <label className="block font-sans text-sm font-medium text-stone-600 mb-2">
                  Link to Vitality Metric (Optional)
                </label>
                <select
                  value={linkedVitalityId}
                  onChange={(e) => setLinkedVitalityId(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                >
                  <option value="">No linked metric</option>
                  {existingVitalityGoals.map((vg) => (
                    <option key={vg.id} value={vg.id}>{vg.title}</option>
                  ))}
                </select>
                <p className="font-sans text-xs text-stone-500 mt-2">
                  Link this growth goal to a health metric (e.g., &quot;Get Fit&quot; linked to &quot;Weight&quot;).
                </p>
              </div>
                </>
              )}

              {/* Vines (optional) for routine & kaizen */}
              {(goalType === 'routine' || goalType === 'kaizen') && (
                <div className="border-t border-stone-200 pt-5 mt-6">
                  <h3 className="font-sans text-sm font-medium text-stone-700 mb-3">🍃 Vines (optional)</h3>
                  <p className="font-sans text-xs text-stone-500 mb-3">Add subtasks now or later from the goal edit.</p>
                  {suggestedVines.length > 0 && (
                    <div className="mb-4 p-3 bg-moss-50 border border-moss-200 rounded-lg">
                      <p className="text-xs font-sans font-medium text-moss-800 mb-2">✨ Mochi suggests these steps (Click to add):</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestedVines.map((sv, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setVines((prev) => [...prev, newVine({ title: typeof sv === 'string' ? sv : sv.title, estimatedHours: 0.5 })]);
                              setSuggestedVines((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-[10px] py-1 px-2 rounded-full bg-white border border-moss-300 text-moss-700 hover:bg-moss-100 transition-colors font-sans"
                          >
                            + {typeof sv === 'string' ? sv : sv.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <input
                      type="text"
                      value={vineTitle}
                      onChange={(e) => setVineTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addVine(e)}
                      placeholder="Title"
                      className="flex-1 min-w-0 py-1.5 px-2 rounded-lg border border-stone-200 text-stone-900 font-sans text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={vineHours}
                      onChange={(e) => setVineHours(e.target.value)}
                      placeholder="Hours"
                      className="w-16 py-1.5 px-2 rounded-lg border border-stone-200 text-stone-900 font-sans text-sm"
                    />
                    <input
                      type="date"
                      value={vineDeadline}
                      onChange={(e) => setVineDeadline(e.target.value)}
                      className="py-1.5 px-2 rounded-lg border border-stone-200 text-stone-900 font-sans text-sm"
                      title="Deadline (optional)"
                    />
                    <button
                      type="button"
                      onClick={addVine}
                      disabled={!vineTitle.trim()}
                      className="py-1.5 px-3 rounded-lg bg-moss-100 text-moss-800 font-sans text-sm hover:bg-moss-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {vines.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center gap-2 py-2 px-3 rounded-lg bg-stone-100/80 border border-stone-200/60"
                      >
                        <span className="flex-1 font-sans text-sm text-stone-800 truncate">{v.title}</span>
                        <span className="font-sans text-xs text-stone-500 shrink-0">{Number(v.estimatedHours) || 0}h</span>
                        {v.deadline && <span className="font-sans text-xs text-stone-400 shrink-0">{v.deadline}</span>}
                        <button
                          type="button"
                          onClick={() => removeVine(v.id)}
                          className="text-stone-400 hover:text-red-600 p-0.5 focus:outline-none"
                          aria-label={`Remove ${v.title}`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              </div>
              )}

              {/* Advanced Settings toggle — above footer */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-sans text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
              >
                <span>{showAdvanced ? '▼' : '▶'}</span>
                <span>⚙️ Advanced Settings</span>
              </button>

              {/* Footer */}
              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => goalType != null ? setGoalType(null) : onClose?.()}
                  className="flex-1 py-3 font-sans text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  {goalType != null ? '← Change Type' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 font-sans text-stone-50 bg-moss-600 rounded-lg hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                >
                  {goalType === 'routine' ? 'Place Rock' : goalType === 'vitality' ? 'Track Metric' : 'Plant Seed'}
                </button>
              </div>
            </form>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg bg-stone-800 text-stone-50 font-sans text-sm shadow-lg"
          role="status"
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GoalCreator;
