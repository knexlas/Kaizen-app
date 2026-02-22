import { useEffect, useState } from 'react';
import { getSettings } from '../../services/userSettings';

/**
 * "Start tiny" modal: one primary path to a 5-min session.
 * mode 'hasTasks': suggest one task. 'noTasks': offer 3 one-tap suggestions.
 * Respects lowStim / reduce-motion; no shame language.
 */
export default function StartNowModal({
  open,
  mode = 'hasTasks',
  candidateTask = null,
  suggestions: suggestionsProp,
  onStart,
  onPickDifferent,
  onCreateSuggestion,
  onClose,
}) {
  const [dynamicSuggestions] = useState(() => {
    const adminTasks = ['Wipe down one counter', 'Reply to one email', 'Put 5 items away', 'Clear your downloads folder'];
    const careTasks = ['Drink a glass of water', 'Stretch your shoulders', 'Wash your face', 'Take 10 deep breaths'];
    return [
      { key: 'life-admin', label: `Admin: ${adminTasks[Math.floor(Math.random() * adminTasks.length)]}` },
      { key: 'personal', label: 'Goal: Do 5-mins of a Seed Bag project' },
      { key: 'care', label: `Care: ${careTasks[Math.floor(Math.random() * careTasks.length)]}` },
    ];
  });

  const suggestions = suggestionsProp ?? dynamicSuggestions;

  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  if (!open) return null;

  const lowStim = getSettings().lowStim ?? false;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-now-title"
    >
      <div className={`relative w-full max-w-md rounded-2xl border-2 border-stone-200 bg-stone-50 shadow-xl p-6 text-stone-900 ${lowStim ? '' : ''}`}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
        >
          ×
        </button>

        {mode === 'hasTasks' && candidateTask ? (
          <>
            <h2 id="start-now-title" className="font-serif text-xl mb-1">
              Start tiny?
            </h2>
            <p className="font-sans text-stone-600 text-sm mb-5">
              We&apos;ll do 5 minutes on: <strong>{candidateTask.ritualTitle || candidateTask.goal?.title || candidateTask.title || 'This task'}</strong>
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onStart?.(candidateTask, 5)}
                className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2"
              >
                Start 5 min
              </button>
              <button
                type="button"
                onClick={onPickDifferent}
                className="w-full py-2 font-sans text-sm text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500 rounded-lg"
              >
                Pick a different task
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="start-now-title" className="font-serif text-xl mb-1">
              One tiny step
            </h2>
            <p className="font-sans text-stone-600 text-sm mb-4">
              No tasks on today&apos;s plan. Choose one to create and start:
            </p>
            <div className="flex flex-col gap-2">
              {suggestions.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onCreateSuggestion?.(key)}
                  className="w-full py-3 px-4 rounded-xl font-sans text-sm font-medium border-2 border-moss-300 bg-moss-50 text-moss-800 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2"
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2 font-sans text-sm text-stone-400 hover:text-stone-600 focus:outline-none focus:ring-2 focus:ring-moss-500 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
