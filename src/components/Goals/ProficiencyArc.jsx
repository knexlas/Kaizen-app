import { useMemo } from 'react';

function formatHours(h) {
  if (h >= 1000) return `${(h / 1000).toFixed(0)}k`;
  return `${Math.round(h)}h`;
}

/**
 * RPG-style proficiency arc: shows current rank and a segmented progress bar
 * from 0 → Beginner → Intermediate → Mastery based on goal.totalMinutes (or
 * effectiveTotalMinutes when provided) and goal.proficiencyEstimates.
 */
export default function ProficiencyArc({ goal, effectiveTotalMinutes }) {
  const estimates = goal?.proficiencyEstimates;
  if (!estimates || typeof estimates !== 'object') return null;

  const beginner = Math.max(0, Number(estimates.beginner) || 20);
  const intermediate = Math.max(beginner, Number(estimates.intermediate) || 100);
  const mastery = Math.max(intermediate, Number(estimates.mastery) || 10000);

  const totalMins = typeof effectiveTotalMinutes === 'number' ? effectiveTotalMinutes : (Number(goal?.totalMinutes) || 0);
  const currentHours = totalMins / 60;

  const rank = useMemo(() => {
    if (currentHours >= mastery) return { label: 'Mastery', sub: null };
    if (currentHours >= intermediate) return { label: 'Intermediate', sub: null };
    if (currentHours >= beginner) return { label: 'Beginner', sub: null };
    return { label: 'Novice', sub: null };
  }, [currentHours, beginner, intermediate, mastery]);

  const hoursToNext = useMemo(() => {
    if (currentHours >= mastery) return null;
    if (currentHours >= intermediate) return Math.max(0, mastery - currentHours);
    if (currentHours >= beginner) return Math.max(0, intermediate - currentHours);
    return Math.max(0, beginner - currentHours);
  }, [currentHours, beginner, intermediate, mastery]);

  const nextRankLabel = currentHours >= mastery ? null : currentHours >= intermediate ? 'Mastery' : currentHours >= beginner ? 'Intermediate' : 'Beginner';

  const fillPercent = mastery > 0 ? Math.min(100, (currentHours / mastery) * 100) : 0;
  const beginnerPercent = mastery > 0 ? (beginner / mastery) * 100 : 0;
  const intermediatePercent = mastery > 0 ? (intermediate / mastery) * 100 : 0;

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 space-y-3">
      <p className="font-sans text-sm font-semibold text-stone-800">
        Current Rank: <span className="text-moss-700">{rank.label}</span>
      </p>
      {hoursToNext != null && nextRankLabel && (
        <p className="font-sans text-xs text-stone-500">
          {formatHours(hoursToNext)} to {nextRankLabel}
        </p>
      )}
      <div className="relative h-6 rounded-full bg-stone-200 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-moss-400 to-moss-600 transition-all duration-500"
          style={{ width: `${fillPercent}%` }}
        />
        {beginnerPercent > 0 && beginnerPercent < 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-stone-400/80"
            style={{ left: `${beginnerPercent}%` }}
            title={`Beginner: ${formatHours(beginner)}`}
          />
        )}
        {intermediatePercent > 0 && intermediatePercent < 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-stone-500/80"
            style={{ left: `${intermediatePercent}%` }}
            title={`Intermediate: ${formatHours(intermediate)}`}
          />
        )}
      </div>
      <div className="flex justify-between font-sans text-[10px] text-stone-500">
        <span>0h</span>
        <span>[Beginner: {formatHours(beginner)}]</span>
        <span>[Intermediate: {formatHours(intermediate)}]</span>
        <span>[Mastery: {formatHours(mastery)}]</span>
      </div>
    </div>
  );
}
