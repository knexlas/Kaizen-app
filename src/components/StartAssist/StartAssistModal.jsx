import { useEffect, useState } from 'react';

const SUGGESTION_KEYS = ['life-admin', 'personal', 'care'];

/**
 * "Help me start" modal: suggest a task to start or offer 3 one-tap suggestions when no tasks.
 */
export default function StartAssistModal({
  open,
  suggestedTask,
  noTasksMode,
  defaultDurationMinutes = 5,
  onStart,
  onPickDifferent,
  onClose,
  onChooseSuggestion,
}) {
  const [adminTask] = useState(() => {
    const tasks = ['Wipe down one counter', 'Reply to one email', 'Put 5 items away', 'Sort the mail', 'Clear your downloads folder'];
    return tasks[Math.floor(Math.random() * tasks.length)] + ' (5 min)';
  });
  const [careTask] = useState(() => {
    const tasks = ['Drink a glass of water', 'Stretch your shoulders', 'Wash your face', 'Take 10 deep breaths', 'Step outside for air'];
    return tasks[Math.floor(Math.random() * tasks.length)] + ' (5 min)';
  });

  const getLabel = (key) => {
    if (key === 'life-admin') return `Admin: ${adminTask}`;
    if (key === 'care') return `Care: ${careTask}`;
    if (key === 'personal') return 'Goal: Take the next 5-min step';
    return key;
  };

  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-assist-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border-2 border-stone-200 bg-stone-50 shadow-xl p-6 text-stone-900">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
        >
          ×
        </button>
        <h2 id="start-assist-title" className="font-serif text-xl mb-2">
          Help me start
        </h2>

        {noTasksMode ? (
          <>
            <p className="font-sans text-stone-600 text-sm mb-4">
              No tasks on today&apos;s plan. Pick one tiny step to create and start:
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTION_KEYS.map((key) => {
                const label = getLabel(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChooseSuggestion?.(key, label)}
                    className="w-full py-3 px-4 rounded-xl font-sans text-sm font-medium border-2 border-moss-300 bg-moss-50 text-moss-800 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </>
        ) : suggestedTask ? (
          <>
            <p className="font-sans text-stone-600 text-sm mb-4">
              Start with: <strong>{suggestedTask.title || 'This task'}</strong>
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onStart?.(defaultDurationMinutes ?? 5, suggestedTask)}
                className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2"
              >
                Start 5 min
              </button>
              <button
                type="button"
                onClick={onPickDifferent}
                className="w-full py-2 font-sans text-sm text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500 rounded-lg"
              >
                Pick something else
              </button>
            </div>
          </>
        ) : (
          <p className="font-sans text-stone-600 text-sm mb-4">
            Add a task to today or pick one from your Seed Bag.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2 font-sans text-sm text-stone-400 hover:text-stone-600 focus:outline-none focus:ring-2 focus:ring-moss-500 rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  );
}
