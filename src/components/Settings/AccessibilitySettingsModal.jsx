import { useState, useEffect } from 'react';
import { getSettings, setSettings } from '../../services/userSettings';

const TEXT_SIZES = [
  { id: 'sm', label: 'Small' },
  { id: 'md', label: 'Medium' },
  { id: 'lg', label: 'Large' },
];

const MOTION_OPTIONS = [
  { id: 'auto', label: 'Follow system' },
  { id: 'reduce', label: 'Reduce motion' },
  { id: 'full', label: 'Full motion' },
];

export default function AccessibilitySettingsModal({ open, onClose }) {
  const [settings, setSettingsState] = useState(getSettings);

  useEffect(() => {
    if (open) setSettingsState(getSettings());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  if (!open) return null;

  const update = (patch) => {
    const next = setSettings(patch);
    if (next) setSettingsState(next);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-modal-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border-2 border-stone-200 bg-stone-50 shadow-xl text-stone-900 overflow-hidden max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
        >
          ×
        </button>
        <div className="p-6">
          <h2 id="a11y-modal-title" className="font-serif text-xl text-stone-900 mb-1">
            Accessibility & Comfort
          </h2>
          <p className="font-sans text-sm text-stone-600 mb-6">
            Adjust how the app looks and feels.
          </p>

          <div className="space-y-6">
            <div>
              <p className="font-sans text-sm font-medium text-stone-800 mb-2">Text size</p>
              <div className="flex gap-2" role="group" aria-label="Text size">
                {TEXT_SIZES.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update({ textSize: opt.id })}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 font-sans text-sm font-medium transition-colors ${
                      settings.textSize === opt.id
                        ? 'border-moss-600 bg-moss-100 text-moss-800'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-sans text-sm font-medium text-stone-800 mb-2">Reduce motion</p>
              <p className="font-sans text-xs text-stone-500 mb-2">
                Respects system preference when set to Follow system.
              </p>
              <div className="flex flex-wrap gap-2">
                {MOTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update({ motionPref: opt.id })}
                    className={`py-2 px-3 rounded-lg border-2 font-sans text-sm font-medium transition-colors ${
                      settings.motionPref === opt.id
                        ? 'border-moss-600 bg-moss-100 text-moss-800'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-stone-200 bg-white">
              <div>
                <p className="font-sans text-sm font-medium text-stone-800">High contrast</p>
                <p className="font-sans text-xs text-stone-500">Stronger borders and text.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.highContrast}
                onClick={() => update({ highContrast: !settings.highContrast })}
                className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 ${
                  settings.highContrast ? 'border-moss-600 bg-moss-600' : 'border-stone-300 bg-stone-200'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${settings.highContrast ? 'translate-x-5' : 'translate-x-0.5'}`}
                  style={{ marginTop: 2 }}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-stone-200 bg-white">
              <div>
                <p className="font-sans text-sm font-medium text-stone-800">Sounds</p>
                <p className="font-sans text-xs text-stone-500">Reward chimes and cues.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.sounds}
                onClick={() => update({ sounds: !settings.sounds })}
                className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 ${
                  settings.sounds ? 'border-moss-600 bg-moss-600' : 'border-stone-300 bg-stone-200'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${settings.sounds ? 'translate-x-5' : 'translate-x-0.5'}`}
                  style={{ marginTop: 2 }}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-stone-200 bg-white">
              <div>
                <p className="font-sans text-sm font-medium text-stone-800">Low stimulation</p>
                <p className="font-sans text-xs text-stone-500">
                  Reduces visual noise, particles, and celebratory motion.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.lowStim}
                onClick={() => update({ lowStim: !settings.lowStim })}
                className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 ${
                  settings.lowStim ? 'border-moss-600 bg-moss-600' : 'border-stone-300 bg-stone-200'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${settings.lowStim ? 'translate-x-5' : 'translate-x-0.5'}`}
                  style={{ marginTop: 2 }}
                />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full py-3 rounded-xl font-sans font-medium border-2 border-stone-300 bg-white text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
