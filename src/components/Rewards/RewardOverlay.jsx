import { useEffect } from 'react';
import { useReward } from '../../context/RewardContext';
import { useGarden } from '../../context/GardenContext';
import { getGamificationConfig } from '../../constants/gamificationIntensity';

const TONE_CLASSES = {
  moss: 'bg-moss-100 border-moss-300 text-moss-900',
  slate: 'bg-slate-100 border-slate-300 text-slate-800',
  amber: 'bg-amber-100 border-amber-300 text-amber-900',
};

const VIBE_DURATION_MS = 4000;

export default function RewardOverlay() {
  const { queue, removeTop } = useReward();
  const { userSettings } = useGarden();
  const gamificationConfig = getGamificationConfig(userSettings ?? {});
  const top = queue[0];

  useEffect(() => {
    if (!top) return;
    const ms = top.vibePayload ? VIBE_DURATION_MS : (top.durationMs ?? gamificationConfig.rewardDurationMs);
    const t = setTimeout(() => removeTop(), ms);
    return () => clearTimeout(t);
  }, [top?.id, top?.vibePayload, top?.durationMs, gamificationConfig.rewardDurationMs, removeTop]);

  if (!top) return null;

  const toneClass = TONE_CLASSES[top.tone] ?? TONE_CLASSES.moss;
  const hasVibe = top.vibePayload && typeof top.onVibe === 'function';
  const shouldShowBonusDetails = Boolean(
    top.variableBonus
    && (top.variableBonus.embers > 0 || top.variableBonus.waterDrops > 0)
    && (top.showVariableBonus ?? (top.surface === 'delight' || gamificationConfig.showRewardBonusDetails))
  );
  const shouldShowGrowthLine = Boolean(
    top.growthLine
    && (top.showGrowthLine ?? (top.surface === 'delight' || gamificationConfig.showRewardGrowthLine))
  );

  const handleVibe = (vibe) => {
    top.onVibe?.(vibe);
    removeTop();
  };

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-sm w-full mx-4 pointer-events-auto"
      role="status"
      aria-live="polite"
    >
      <div className={`px-4 py-3 rounded-xl border shadow-lg font-sans text-sm ${toneClass}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 shrink-0" aria-hidden>{top.icon}</span>
          <span className="flex-1 min-w-0">{top.message}</span>
        </div>
        {shouldShowBonusDetails && (
          <p className="mt-1.5 text-xs opacity-90" aria-hidden>
            {top.variableBonus.embers > 0 && `+${top.variableBonus.embers} Ember${top.variableBonus.embers !== 1 ? 's' : ''}`}
            {top.variableBonus.embers > 0 && top.variableBonus.waterDrops > 0 && ' · '}
            {top.variableBonus.waterDrops > 0 && `+${top.variableBonus.waterDrops} Water`}
          </p>
        )}
        {shouldShowGrowthLine && (
          <p className="mt-1 text-xs opacity-90" aria-hidden>{top.growthLine}</p>
        )}
        {hasVibe && (
          <div className="flex gap-2 mt-3 pt-2 border-t border-current/10">
            <button
              type="button"
              onClick={() => handleVibe('energizer')}
              className="flex-1 py-1.5 px-2 rounded-lg font-sans text-xs font-medium bg-white/60 hover:bg-white/90 border border-current/20 transition-colors"
              aria-label="Energized"
            >
              Energized
            </button>
            <button
              type="button"
              onClick={() => handleVibe('drainer')}
              className="flex-1 py-1.5 px-2 rounded-lg font-sans text-xs font-medium bg-white/60 hover:bg-white/90 border border-current/20 transition-colors"
              aria-label="Drained"
            >
              Drained
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
