import { useState } from 'react';
import { getSettings } from '../../services/userSettings';

export default function GuidedEmptyState({
  variant,
  onSetSpoons,
  onPickSuggestion,
  onStartFiveMin,
  onPickGoal,
  goals = [],
  lowStim,
}) {
  const a11y = lowStim ?? getSettings().lowStim;
  const isPlain = a11y;

  if (variant === 'needEnergy') {
    return (
      <div
        className={
          isPlain
            ? 'rounded-xl border-2 p-6 border-stone-300 bg-stone-100 text-stone-800'
            : 'rounded-xl border-2 p-6 border-moss-300 bg-moss-50/80 text-moss-900 shadow-sm'
        }
      >
        <p className="font-serif text-xl text-center mb-4">
          Let&apos;s start gently. How&apos;s your energy today?
        </p>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onSetSpoons}
            className={
              isPlain
                ? 'px-6 py-3 rounded-full font-sans font-medium bg-stone-200 text-stone-800 hover:bg-stone-300 focus:ring-2 focus:ring-stone-400 focus:ring-offset-2'
                : 'px-6 py-3 rounded-full font-sans font-medium bg-moss-500 text-white hover:bg-moss-600 focus:ring-2 focus:ring-moss-500 focus:ring-offset-2'
            }
          >
            Set today&apos;s spoons
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'noTasks') {
    const suggestions = [
      { key: 'life-admin', label: 'One tiny life-admin thing' },
      { key: 'personal', label: 'One personal goal step' },
      { key: 'care', label: 'One care task' },
    ];
    return (
      <div
        className={
          isPlain
            ? 'rounded-xl border-2 p-6 border-stone-300 bg-stone-100 text-stone-800'
            : 'rounded-xl border-2 p-6 border-moss-300 bg-moss-50/80 text-moss-900 shadow-sm'
        }
      >
        <p className="font-serif text-lg text-center mb-4">Next step</p>
        <p className="font-sans text-sm text-center text-stone-600 mb-4">
          Start tiny — 5 minutes, 1 spoon. Tap one to add and start focus.
        </p>
        <div className="flex flex-col gap-2">
          {suggestions.map(({ key, label }) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2">
              <button
                type="button"
                onClick={() => onPickSuggestion?.(key)}
                className={
                  isPlain
                    ? 'flex-1 py-3 px-4 rounded-lg font-sans text-left text-sm font-medium bg-stone-200 text-stone-800 hover:bg-stone-300'
                    : 'flex-1 py-3 px-4 rounded-lg font-sans text-left text-sm font-medium bg-white border border-moss-200 text-moss-900 hover:border-moss-400'
                }
              >
                {label}
              </button>
              <button
                type="button"
                onClick={() => onStartFiveMin?.(key)}
                className="shrink-0 py-2 px-4 rounded-lg font-sans text-sm font-medium bg-moss-500 text-white hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-1"
              >
                Start 5 min
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'noCompost') {
    const [showHow, setShowHow] = useState(false);
    return (
      <div
        className={
          isPlain
            ? 'rounded-lg border p-3 border-stone-200 bg-stone-50 text-stone-700'
            : 'rounded-lg border p-3 border-amber-200/80 bg-amber-50/60 text-stone-800'
        }
      >
        <p className="font-sans text-sm">
          Compost is where &ldquo;not today&rdquo; goes—no shame.
        </p>
        <button
          type="button"
          onClick={() => setShowHow((v) => !v)}
          className="mt-1.5 font-sans text-xs font-medium text-moss-700 hover:text-moss-800 underline underline-offset-1"
        >
          How compost works
        </button>
        {showHow && (
          <div className="mt-2 p-2 rounded bg-white/80 border border-stone-200 font-sans text-xs text-stone-600">
            Dump ideas or tasks here when you don&apos;t want to do them today. You can plant them later or break them into steps.
          </div>
        )}
      </div>
    );
  }

  if (variant === 'noGoals') {
    const showGoals = (goals || []).filter((g) => (g.type === 'kaizen' || g.type === 'project') && !g.completed).slice(0, 3);
    return (
      <div
        className={
          isPlain
            ? 'rounded-xl border-2 p-6 border-stone-300 bg-stone-100 text-stone-800'
            : 'rounded-xl border-2 p-6 border-moss-300 bg-moss-50/80 text-moss-900 shadow-sm'
        }
      >
        <p className="font-serif text-lg text-center mb-4">
          Pick one thing to grow this week.
        </p>
        {showGoals.length === 0 ? (
          <p className="font-sans text-sm text-stone-600 text-center">
            Want to plant a seed? Use Horizons or the Seed Bag.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {showGoals.map((goal) => (
              <button
                key={goal.id}
                type="button"
                onClick={() => onPickGoal?.(goal)}
                className={
                  isPlain
                    ? 'w-full py-3 px-4 rounded-lg font-sans text-left text-sm font-medium bg-stone-200 text-stone-800 hover:bg-stone-300'
                    : 'w-full py-3 px-4 rounded-lg font-sans text-left text-sm font-medium bg-white border border-moss-200 text-moss-900 hover:border-moss-400'
                }
              >
                {goal.title || 'Untitled goal'}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}
