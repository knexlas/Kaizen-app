import { useGarden } from '../../context/GardenContext';
import { getSpiritProgression } from '../../services/spiritProgressionService';

/**
 * Visible Spirit progression: tier name, points, and progress toward next level.
 * Uses existing spiritPoints from GardenContext (1 per minute of focus). No save changes.
 */
export default function SpiritProgression({ compact = false, className = '' }) {
  const { spiritPoints = 0 } = useGarden();
  const prog = getSpiritProgression(spiritPoints);
  const { tier, nextTier, pointsInLevel, pointsNeededForNext, progressFraction, totalPoints } = prog;
  const isMaxLevel = !nextTier;

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${className}`}
        style={{
          borderColor: 'rgba(94, 114, 52, 0.35)',
          backgroundColor: 'rgba(94, 114, 52, 0.08)',
        }}
        role="status"
        aria-label={`Spirit level: ${tier.name}. ${totalPoints} points.${nextTier ? ` ${Math.round(progressFraction * 100)}% to ${nextTier.name}.` : ''}`}
      >
        <span className="text-lg leading-none" aria-hidden>{tier.icon}</span>
        <span className="font-sans text-sm font-medium text-stone-700 dark:text-stone-300">
          {tier.name}
        </span>
        <span className="font-sans text-xs text-stone-500 dark:text-stone-400 tabular-nums">
          {totalPoints} pts
        </span>
        {!isMaxLevel && (
          <div className="flex-1 min-w-[60px] h-1.5 rounded-full bg-stone-200 dark:bg-slate-600 overflow-hidden">
            <div
              className="h-full rounded-full bg-moss-500 dark:bg-moss-400 transition-all duration-300"
              style={{ width: `${Math.round(progressFraction * 100)}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-3 ${className}`}
      style={{
        borderColor: 'rgba(94, 114, 52, 0.4)',
        backgroundColor: 'rgba(94, 114, 52, 0.06)',
      }}
      role="status"
      aria-label={`Spirit progression: ${tier.name}. ${totalPoints} Spirit Points.${nextTier ? ` Progress to ${nextTier.name}: ${Math.round(progressFraction * 100)}%.` : ' Maximum level.'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl leading-none" aria-hidden>{tier.icon}</span>
        <div>
          <p className="font-sans text-sm font-semibold text-stone-800 dark:text-stone-200">
            {tier.name}
          </p>
          <p className="font-sans text-xs text-stone-500 dark:text-stone-400">
            {tier.description} · {totalPoints} Spirit Points
          </p>
        </div>
      </div>
      <p className="font-sans text-[11px] text-stone-500 dark:text-stone-400 mb-2">
        Spirit Points = 1 per minute of focus. They show how much you&apos;ve grown.
      </p>
      {isMaxLevel ? (
        <p className="font-sans text-xs text-stone-500 dark:text-stone-400">
          You&apos;ve reached the top. Keep growing.
        </p>
      ) : (
        <>
          <div className="flex justify-between font-sans text-xs text-stone-500 dark:text-stone-400 mb-1">
            <span>{pointsInLevel} / {pointsNeededForNext} in this tier</span>
            <span>{Math.round(progressFraction * 100)}% to {nextTier.name}</span>
          </div>
          <div className="h-2 rounded-full bg-stone-200 dark:bg-slate-600 overflow-hidden">
            <div
              className="h-full rounded-full bg-moss-500 dark:bg-moss-400 transition-all duration-300"
              style={{ width: `${Math.round(progressFraction * 100)}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
