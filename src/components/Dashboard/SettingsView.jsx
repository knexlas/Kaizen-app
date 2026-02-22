import { useState, useEffect, useRef } from 'react';
import { useGarden } from '../../context/GardenContext';
import { localISODate } from '../../services/dateUtils';
import { testMochiConnection } from '../../services/geminiService';

export default function SettingsView({ onReplayTour }) {
  const {
    userSettings = {},
    setUserSettings,
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
  const [saved, setSaved] = useState(false);
  const [importError, setImportError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [testingMochi, setTestingMochi] = useState(false);
  const fileInputRef = useRef(null);

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
  }, [userSettings.userName, userSettings.defaultWeekStart]);

  const handleSave = () => {
    setUserSettings?.({ ...userSettings, userName: userName.trim() || undefined, defaultWeekStart });
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
        if (!window.confirm(message)) return;
        importGardenData(data);
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
    if (!window.confirm('Permanently delete all garden data (goals, logs, settings, decorations)? This cannot be undone.')) {
      setDeleteConfirm(false);
      return;
    }
    deleteAllData();
    setDeleteConfirm(false);
  };

  return (
    <div className="space-y-8">
      <h2 className="font-serif text-stone-900 text-xl">Settings</h2>

      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <h3 className="font-sans text-sm font-medium text-stone-700 mb-2">Mochi (AI)</h3>
        <p className="font-sans text-sm text-stone-500 mb-3">
          Mochi uses VITE_GEMINI_API_KEY from .env. Restart the dev server after changing .env.
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

      {typeof onReplayTour === 'function' && (
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <h3 className="font-sans text-sm font-medium text-stone-700 mb-2">Tour</h3>
          <p className="font-sans text-sm text-stone-500 mb-3">See the Spirit guide tour again.</p>
          <button
            type="button"
            onClick={onReplayTour}
            className="px-4 py-2 rounded-lg font-sans text-sm font-medium border border-stone-200 text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
          >
            Replay Tour
          </button>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-6">
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
        <p className="font-sans text-sm text-stone-500 mb-4">Download your garden data as a JSON file (backup or transfer).</p>
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
            try {
              localStorage.removeItem('hasSeenTour');
            } catch (_) {}
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
