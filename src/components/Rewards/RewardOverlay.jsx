import { useEffect } from 'react';
import { useReward } from '../../context/RewardContext';

const TONE_CLASSES = {
  moss: 'bg-moss-100 border-moss-300 text-moss-900',
  slate: 'bg-slate-100 border-slate-300 text-slate-800',
  amber: 'bg-amber-100 border-amber-300 text-amber-900',
};

export default function RewardOverlay() {
  const { queue, removeTop } = useReward();
  const top = queue[0];

  useEffect(() => {
    if (!top) return;
    const ms = typeof top.durationMs === 'number' ? top.durationMs : 2800;
    const t = setTimeout(() => removeTop(), ms);
    return () => clearTimeout(t);
  }, [top?.id, top?.durationMs, removeTop]);

  if (!top) return null;

  const toneClass = TONE_CLASSES[top.tone] ?? TONE_CLASSES.moss;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-sm w-full mx-4"
      role="status"
      aria-live="polite"
    >
      <div className={`px-4 py-3 rounded-xl border shadow-lg font-sans text-sm ${toneClass}`}>
        <span className="mr-2" aria-hidden>{top.icon}</span>
        <span>{top.message}</span>
      </div>
    </div>
  );
}
