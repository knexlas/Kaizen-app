import { useState, useEffect, useRef } from 'react';
import { useGarden } from '../../context/GardenContext';
import { useDialog } from '../../context/DialogContext';
import { localISODate } from '../../services/dateUtils';
import SpiritProgression from './SpiritProgression';
import { testMochiConnection } from '../../services/geminiService';
import { setTourSeen } from '../../services/onboardingStateService';
import {
  ONBOARDING_USE_CASE_OPTIONS,
  ONBOARDING_ROLE_OPTIONS,
  ONBOARDING_PRIORITY_OPTIONS,
  MAX_PRIORITIES,
} from '../../constants/onboardingPreferences';
import { getPlannerPreset, PLANNER_PRESET_OPTIONS } from '../../constants/plannerPresets';
import { getGamificationIntensity, GAMIFICATION_INTENSITY_OPTIONS, GAMIFICATION_INTENSITY_LEVELS } from '../../constants/gamificationIntensity';

const SCHEDULING_DEFAULTS = {
  dayStart: '08:00',
  dayEnd: '22:00',
  dayStartsAt: '00:00',
  isWorkScheduler: true,
  workHours: { start: '09:00', end: '17:00' },
};

const GARDEN_GRAPHICS_OPTIONS = [
  { value: 'auto', label: 'Auto', description: 'Adapt visuals based on device capability and motion preference.' },
  { value: 'smooth', label: 'Smooth', description: 'Prefer richer visuals and animation when possible.' },
  { value: 'saver', label: 'Saver', description: 'Prefer lower animation cost and better battery life.' },
];

/** Options for "My Day Starts At" (when the calendar day flips for today/check-in). */
const DAY_STARTS_AT_OPTIONS = [
  { value: '00:00', label: '12:00 AM (midnight)' },
  { value: '01:00', label: '1:00 AM' },
  { value: '02:00', label: '2:00 AM' },
  { value: '03:00', label: '3:00 AM' },
  { value: '04:00', label: '4:00 AM' },
  { value: '05:00', label: '5:00 AM' },
];

export default function SettingsView({ onReplayTour }) {
  const { showConfirm } = useDialog();
  const {
    userSettings = {},
    setUserSettings,
    updateUserSettings,
    goals,
    weeklyEvents,
    logs,
    spiritConfig,
    compost,
    spiritPoints,
    decorations,
    dailyEnergyModifier,
    lastCheckInDate,
    lastSundayRitualDate,
    importGardenData,
    deleteAllData,
  } = useGarden();
  const [userName, setUserName] = useState(userSettings.userName ?? '');
  const [defaultWeekStart, setDefaultWeekStart] = useState(userSettings.defaultWeekStart ?? 1); // 0 = Sun, 1 = Mon
  const [dayStart, setDayStart] = useState(userSettings.dayStart ?? SCHEDULING_DEFAULTS.dayStart);
  const [dayEnd, setDayEnd] = useState(userSettings.dayEnd ?? SCHEDULING_DEFAULTS.dayEnd);
  const [dayStartsAt, setDayStartsAt] = useState(userSettings.dayStartsAt ?? SCHEDULING_DEFAULTS.dayStartsAt);
  const [isWorkScheduler, setIsWorkScheduler] = useState(userSettings.isWorkScheduler ?? SCHEDULING_DEFAULTS.isWorkScheduler);
  const [workHoursStart, setWorkHoursStart] = useState(userSettings.workHours?.start ?? SCHEDULING_DEFAULTS.workHours.start);
  const [workHoursEnd, setWorkHoursEnd] = useState(userSettings.workHours?.end ?? SCHEDULING_DEFAULTS.workHours.end);
  const [gardenGraphicsMode, setGardenGraphicsMode] = useState(userSettings.gardenGraphicsMode ?? 'auto');
  const [saved, setSaved] = useState(false);
  const [importError, setImportError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [testingMochi, setTestingMochi] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [onboardingUseCase, setOnboardingUseCase] = useState(userSettings.onboardingUseCase ?? '');
  const [onboardingRole, setOnboardingRole] = useState(userSettings.onboardingRole ?? '');
  const [onboardingPriorities, setOnboardingPriorities] = useState(Array.isArray(userSettings.onboardingPriorities) ? userSettings.onboardingPriorities : []);
  const [plannerPreset, setPlannerPreset] = useState(userSettings.plannerPreset ?? '');
  const [gamificationIntensity, setGamificationIntensity] = useState(userSettings.gamificationIntensity ?? '');
  const fileInputRef = useRef(null);

  const effectivePlannerPreset = plannerPreset || getPlannerPreset(userSettings);
  const effectiveGamificationIntensity = gamificationIntensity || getGamificationIntensity(userSettings);

  const handleTestMochi = async () => {
    setTestingMochi(true);
    try {
      const result = await testMochiConnection();
      const message = result?.message || (result?.ok ? 'Mochi is connected.' : "Mochi couldn't connect.");
      window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message } }));
    } finally {
      setTestingMochi(false);
    }
  };

  useEffect(() => {
    setUserName(userSettings.userName ?? '');
    setDefaultWeekStart(userSettings.defaultWeekStart ?? 1);
    setDayStart(userSettings.dayStart ?? SCHEDULING_DEFAULTS.dayStart);
    setDayEnd(userSettings.dayEnd ?? SCHEDULING_DEFAULTS.dayEnd);
    setDayStartsAt(userSettings.dayStartsAt ?? SCHEDULING_DEFAULTS.dayStartsAt);
    setIsWorkScheduler(userSettings.isWorkScheduler ?? SCHEDULING_DEFAULTS.isWorkScheduler);
    setWorkHoursStart(userSettings.workHours?.start ?? SCHEDULING_DEFAULTS.workHours.start);
    setWorkHoursEnd(userSettings.workHours?.end ?? SCHEDULING_DEFAULTS.workHours.end);
    setGardenGraphicsMode(userSettings.gardenGraphicsMode ?? 'auto');
  }, [userSettings.userName, userSettings.defaultWeekStart, userSettings.dayStart, userSettings.dayEnd, userSettings.dayStartsAt, userSettings.isWorkScheduler, userSettings.workHours, userSettings.gardenGraphicsMode]);

  useEffect(() => {
    setOnboardingUseCase(userSettings.onboardingUseCase ?? '');
    setOnboardingRole(userSettings.onboardingRole ?? '');
    setOnboardingPriorities(Array.isArray(userSettings.onboardingPriorities) ? userSettings.onboardingPriorities : []);
    setPlannerPreset(userSettings.plannerPreset ?? '');
    setGamificationIntensity(userSettings.gamificationIntensity ?? '');
  }, [userSettings.onboardingUseCase, userSettings.onboardingRole, userSettings.onboardingPriorities, userSettings.plannerPreset, userSettings.gamificationIntensity]);

  const togglePriority = (id) => {
    setOnboardingPriorities((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_PRIORITIES) return prev;
      return [...prev, id];
    });
  };

  const handleSavePreferences = () => {
    updateUserSettings({
      onboardingUseCase: onboardingUseCase || undefined,
      onboardingRole: onboardingRole || undefined,
      onboardingPriorities: onboardingPriorities.length > 0 ? onboardingPriorities : undefined,
      plannerPreset: plannerPreset || undefined,
      gamificationIntensity: gamificationIntensity || undefined,
    });
    setPrefsSaved(true);
    const t = setTimeout(() => setPrefsSaved(false), 2000);
    return () => clearTimeout(t);
  };

  const handleSave = () => {
    setUserSettings?.({
      ...userSettings,
      userName: userName.trim() || undefined,
      defaultWeekStart,
      dayStart,
      dayEnd,
      dayStartsAt,
      isWorkScheduler,
      workHours: { start: workHoursStart, end: workHoursEnd },
      gardenGraphicsMode,
    });
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  };

  const gardenData = {
    goals: goals ?? [],
    weeklyEvents: weeklyEvents ?? [],
    userSettings: userSettings ?? {},
    dailyEnergyModifier: typeof dailyEnergyModifier === 'number' ? dailyEnergyModifier : 0,
    lastCheckInDate: lastCheckInDate ?? null,
    lastSundayRitualDate: lastSundayRitualDate ?? null,
    logs: logs ?? [],
    spiritConfig: spiritConfig ?? null,
    compost: compost ?? [],
    spiritPoints: typeof spiritPoints === 'number' ? spiritPoints : 0,
    decorations: decorations ?? [],
  };

  const handleExport = () => {
    try {
      const blob = new Blob([JSON.stringify(gardenData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kaizen-garden-${localISODate()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Export failed', e);
    }
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleImportFile = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object') {
          setImportError('Invalid file format.');
          return;
        }
        const message = 'Import will replace your current goals, logs, and settings with the file contents. Continue?';
        showConfirm({ message, confirmLabel: 'Import', onConfirm: () => importGardenData(data) });
        return;
      } catch (err) {
        setImportError('Could not parse JSON. Please choose a valid backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeleteAll = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    showConfirm({
      message: 'Permanently delete all garden data (goals, logs, settings, decorations)? This cannot be undone.',
      confirmLabel: 'Delete all',
      cancelLabel: 'Cancel',
      destructive: true,
      onConfirm: () => {
        deleteAllData();
        setDeleteConfirm(false);
      },
    });
  };

  return (
    <div className="space-y-8">
      <h2 className="font-serif text-stone-900 text-xl">Settings</h2>

      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <h3 className="font-sans text-sm font-medium text-stone-700 mb-2">Mochi (AI)</h3>
        <p className="font-sans text-sm text-stone-500 mb-3">
          Mochi needs an API key to work. Add your key in your environment or config, then use Test connection below.
        </p>
        <button
          type="button"
          onClick={handleTestMochi}
          disabled={testingMochi}
          className="px-4 py-2 rounded-lg font-sans text-sm font-medium border border-moss-300 bg-moss-50 text-moss-800 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 disabled:opacity-50"
        >
          {testingMochi ? 'Testing…' : 'Test connection'}
        </button>
      </div>

      <div className="rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 p-6">
        <h3 className="font-sans text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">App profile</h3>
        <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mb-2">
          Change how the app is set up for you—what appears first on your home screen and in the planner. Your projects, tasks, and history stay exactly as they are. Nothing is deleted or reset.
        </p>
        <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mb-4 italic">
          Updates apply to defaults and layout only. You can change these anytime.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block font-sans text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Primary use case</label>
            <p className="font-sans text-[11px] text-stone-500 dark:text-stone-400 mb-1">What you mainly use the app for</p>
            <select
              value={onboardingUseCase}
              onChange={(e) => setOnboardingUseCase(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 font-sans text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
            >
              <option value="">—</option>
              {ONBOARDING_USE_CASE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-sans text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Role type</label>
            <p className="font-sans text-[11px] text-stone-500 dark:text-stone-400 mb-1">Which best describes you</p>
            <select
              value={onboardingRole}
              onChange={(e) => setOnboardingRole(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 font-sans text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
            >
              <option value="">—</option>
              {ONBOARDING_ROLE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-sans text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Top goals</label>
            <p className="font-sans text-[11px] text-stone-500 dark:text-stone-400 mb-2">What you want the app to help with most (pick up to {MAX_PRIORITIES})</p>
            <ul className="space-y-1.5">
              {ONBOARDING_PRIORITY_OPTIONS.map((opt) => {
                const selected = onboardingPriorities.includes(opt.id);
                const disabled = !selected && onboardingPriorities.length >= MAX_PRIORITIES;
                return (
                  <li key={opt.id}>
                    <label className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer border transition-colors ${
                      selected ? 'border-moss-400 dark:border-moss-600 bg-moss-50 dark:bg-moss-900/20' : disabled ? 'border-stone-100 dark:border-stone-700 opacity-60' : 'border-stone-200 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                    }`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => !disabled && togglePriority(opt.id)}
                        disabled={disabled}
                        className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50"
                      />
                      <span className="font-sans text-sm text-stone-700 dark:text-stone-300">{opt.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <label className="block font-sans text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Planner &amp; dashboard preset</label>
            <p className="font-sans text-[11px] text-stone-500 dark:text-stone-400 mb-1">How your home screen and Projects view are arranged</p>
            <select
              value={plannerPreset}
              onChange={(e) => setPlannerPreset(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 font-sans text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
            >
              <option value="">Auto (from use case &amp; role above)</option>
              {PLANNER_PRESET_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-1">
              Current: {(PLANNER_PRESET_OPTIONS.find((o) => o.id === effectivePlannerPreset)?.label ?? effectivePlannerPreset) || 'Auto'}
            </p>
          </div>
          <div>
            <label className="block font-sans text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">App tone</label>
            <p className="font-sans text-[11px] text-stone-500 dark:text-stone-400 mb-1">How much celebration and guidance you see (minimal to playful)</p>
            <select
              value={gamificationIntensity || GAMIFICATION_INTENSITY_LEVELS.BALANCED}
              onChange={(e) => setGamificationIntensity(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 font-sans text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
            >
              {GAMIFICATION_INTENSITY_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-1">
              {GAMIFICATION_INTENSITY_OPTIONS.find((o) => o.id === (effectiveGamificationIntensity || GAMIFICATION_INTENSITY_LEVELS.BALANCED))?.description}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSavePreferences}
            className="px-4 py-2 rounded-lg font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
          >
            {prefsSaved ? 'Saved' : 'Save profile'}
          </button>
          {prefsSaved && (
            <p className="font-sans text-xs text-moss-600 dark:text-moss-400 mt-2">Your profile is updated. Home and planner will reflect this next time you open them—no data has been changed.</p>
          )}
        </div>
      </div>

      {typeof onReplayTour === 'function' && (
        <div className="rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 p-6">
          <h3 className="font-sans text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">Tour</h3>
          <p className="font-sans text-sm text-stone-500 dark:text-stone-400 mb-3">See the Spirit guide tour again.</p>
          <button
            type="button"
            onClick={onReplayTour}
            className="px-4 py-2 rounded-lg font-sans text-sm font-medium border border-stone-200 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
          >
            Replay Tour
          </button>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 p-6 space-y-6">
        <div>
          <label htmlFor="settings-username" className="block font-sans text-sm font-medium text-stone-600 mb-1">
            Name
          </label>
          <input
            id="settings-username"
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
          />
        </div>

        <div>
          <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Week starts on</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 font-sans text-stone-700 cursor-pointer">
              <input
                type="radio"
                name="weekStart"
                checked={defaultWeekStart === 0}
                onChange={() => setDefaultWeekStart(0)}
                className="text-moss-600 focus:ring-moss-500"
              />
              Sunday
            </label>
            <label className="flex items-center gap-2 font-sans text-stone-700 cursor-pointer">
              <input
                type="radio"
                name="weekStart"
                checked={defaultWeekStart === 1}
                onChange={() => setDefaultWeekStart(1)}
                className="text-moss-600 focus:ring-moss-500"
              />
              Monday
            </label>
          </div>
        </div>

        <div className="border-t border-stone-100 pt-6">
          <h3 className="font-sans text-sm font-semibold text-stone-800 mb-1">Scheduling</h3>
          <p className="font-sans text-xs text-stone-500 mb-4">Day range and work-hour blocking for the planner and Time Slicer.</p>
          <div className="mb-4">
            <label htmlFor="settings-day-starts-at" className="block font-sans text-xs font-medium text-stone-600 mb-1">My day starts at</label>
            <select
              id="settings-day-starts-at"
              value={dayStartsAt}
              onChange={(e) => setDayStartsAt(e.target.value)}
              className="w-full max-w-xs py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-stone-900 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
            >
              {DAY_STARTS_AT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="font-sans text-xs text-stone-500 mt-1">When &quot;today&quot; flips (e.g. 3 AM means 1:30 AM Tuesday is still Monday).</p>
          </div>
          <p className="font-sans text-xs font-medium text-stone-600 mb-2">Day Schedule (timeline range)</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="settings-day-start" className="block font-sans text-xs font-medium text-stone-600 mb-1">First hour shown</label>
              <input
                id="settings-day-start"
                type="time"
                value={dayStart}
                onChange={(e) => setDayStart(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-stone-900 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
              />
            </div>
            <div>
              <label htmlFor="settings-day-end" className="block font-sans text-xs font-medium text-stone-600 mb-1">Day ends at</label>
              <input
                id="settings-day-end"
                type="time"
                value={dayEnd}
                onChange={(e) => setDayEnd(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-stone-900 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isWorkScheduler}
                onChange={(e) => setIsWorkScheduler(e.target.checked)}
                className="sr-only peer"
              />
              <span className="relative inline-flex h-6 w-10 shrink-0 rounded-full bg-stone-200 transition-colors peer-checked:bg-moss-500 focus-within:ring-2 focus-within:ring-moss-500/40 focus-within:ring-offset-2">
                <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </span>
              <span className="font-sans text-sm font-medium text-stone-700">Use Kaizen for work tasks?</span>
            </label>
            <p className="font-sans text-xs text-stone-500 mt-1 ml-12">When off, work hours are blocked and not suggested for tasks.</p>
          </div>
          {!isWorkScheduler && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-stone-50 border border-stone-100">
              <div>
                <label htmlFor="settings-work-start" className="block font-sans text-xs font-medium text-stone-600 mb-1">Work hours (blocked off) — start</label>
                <input
                  id="settings-work-start"
                  type="time"
                  value={workHoursStart}
                  onChange={(e) => setWorkHoursStart(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-stone-900 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                />
              </div>
              <div>
                <label htmlFor="settings-work-end" className="block font-sans text-xs font-medium text-stone-600 mb-1">Work hours (blocked off) — end</label>
                <input
                  id="settings-work-end"
                  type="time"
                  value={workHoursEnd}
                  onChange={(e) => setWorkHoursEnd(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-stone-900 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-stone-100 pt-6">
          <h3 className="font-sans text-sm font-semibold text-stone-800 mb-1">Garden Graphics</h3>
          <p className="font-sans text-xs text-stone-500 mb-4">Controls visual quality and animation intensity in the 3D garden.</p>
          <div className="grid gap-3">
            {GARDEN_GRAPHICS_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                  gardenGraphicsMode === option.value ? 'border-moss-300 bg-moss-50' : 'border-stone-200 bg-white hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="gardenGraphicsMode"
                  checked={gardenGraphicsMode === option.value}
                  onChange={() => setGardenGraphicsMode(option.value)}
                  className="mt-1 text-moss-600 focus:ring-moss-500"
                />
                <span>
                  <span className="block font-sans text-sm font-medium text-stone-700">{option.label}</span>
                  <span className="block font-sans text-xs text-stone-500 mt-0.5">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg font-sans text-sm font-medium bg-moss-600 text-stone-50 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
          >
            Save
          </button>
          {saved && <span className="font-sans text-sm text-moss-600">Saved.</span>}
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <h3 className="font-sans text-sm font-medium text-stone-700 mb-2">Export Data</h3>
        <p className="font-sans text-sm text-stone-500 mb-2">Download your garden data as a JSON file (backup or transfer).</p>
        <div className="mb-4">
          <SpiritProgression compact />
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="px-4 py-2 rounded-lg font-sans text-sm font-medium border border-stone-200 text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
        >
          Export Data
        </button>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <h3 className="font-sans text-sm font-medium text-stone-700 mb-2">Import Data</h3>
        <p className="font-sans text-sm text-stone-500 mb-4">Restore from a previously exported JSON file. This will replace your current data after confirmation.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
          aria-label="Choose backup file"
        />
        <button
          type="button"
          onClick={handleImportClick}
          className="px-4 py-2 rounded-lg font-sans text-sm font-medium border border-stone-200 text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
        >
          Import Data
        </button>
        {importError && <p className="mt-2 font-sans text-sm text-red-600" role="alert">{importError}</p>}
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50/50 p-6">
        <h3 className="font-sans text-sm font-medium text-red-800 mb-2">Delete Data</h3>
        <p className="font-sans text-sm text-stone-600 mb-4">Clear all garden data from this device and from the cloud (if synced). This cannot be undone.</p>
        <button
          type="button"
          onClick={handleDeleteAll}
          className={`px-4 py-2 rounded-lg font-sans text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
            deleteConfirm ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-red-300 text-red-700 hover:bg-red-100'
          }`}
        >
          {deleteConfirm ? 'Confirm: Delete everything' : 'Delete Data'}
        </button>
        {deleteConfirm && (
          <button type="button" onClick={() => setDeleteConfirm(false)} className="ml-3 font-sans text-sm text-stone-600 hover:text-stone-800">
            Cancel
          </button>
        )}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <h3 className="font-sans text-sm font-medium text-stone-700 mb-2">Account</h3>
        <p className="font-sans text-sm text-stone-500 mb-3">Reset the onboarding tutorial so it shows again on next load.</p>
        <button
          type="button"
          onClick={() => {
            setTourSeen(false);
            window.location.reload();
          }}
          className="px-4 py-2 rounded-lg font-sans text-sm font-medium border border-stone-200 text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
        >
          Replay Tutorial
        </button>
      </div>
    </div>
  );
}
