import { createContext, useContext, useState, useCallback } from 'react';
import { getSettings } from '../services/userSettings';

/**
 * Single reward presentation: all immediate feedback (action confirmation, reward gained,
 * milestone/unlock) goes through pushReward → RewardOverlay. Use this instead of local toasts
 * or GlobalToast so users get one consistent, calm feedback pattern.
 *
 * Reward shape: { message, tone?, icon?, durationMs?, variableBonus?, growthLine?, vibePayload?, onVibe? }
 * - message: primary text (action confirmation or reward description).
 * - tone: 'moss' (success), 'slate' (neutral/error), 'amber' (celebration).
 * - variableBonus: { embers?, waterDrops? } shown as "+N Embers · +N Water".
 * - growthLine: optional second line (e.g. "Your goal has grown a little.").
 */
const MAX_QUEUE = 3;

const RewardContext = createContext(null);

export function RewardProvider({ children }) {
  const [queue, setQueue] = useState([]);
  /** Last garden-relevant impact (for Now tab compact line). { text, at } or null. */
  const [lastGardenImpact, setLastGardenImpact] = useState(null);

  const pushReward = useCallback((reward) => {
    if (!reward || !reward.message) return;
    const id = reward.id ?? `rw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const soundsOn = getSettings().sounds;
    const entry = {
      id,
      message: reward.message,
      tone: reward.tone ?? 'moss',
      icon: reward.icon ?? '✨',
      sound: soundsOn ? (reward.sound ?? null) : null,
      durationMs: typeof reward.durationMs === 'number' ? reward.durationMs : 2800,
      vibePayload: reward.vibePayload ?? null,
      onVibe: typeof reward.onVibe === 'function' ? reward.onVibe : null,
      variableBonus: reward.variableBonus ?? null,
      growthLine: reward.growthLine ?? null,
    };
    setQueue((prev) => {
      const next = [...prev, entry].slice(-MAX_QUEUE);
      return next;
    });
    if (reward.variableBonus?.waterDrops || reward.growthLine) {
      const text = reward.growthLine || (reward.variableBonus?.waterDrops ? `+${reward.variableBonus.waterDrops} Water` : null);
      if (text) setLastGardenImpact({ text, at: Date.now() });
    }
  }, []);

  const clearRewards = useCallback(() => setQueue([]), []);

  const removeTop = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const value = {
    queue,
    pushReward,
    clearRewards,
    removeTop,
    lastGardenImpact,
    clearLastGardenImpact: useCallback(() => setLastGardenImpact(null), []),
  };

  return (
    <RewardContext.Provider value={value}>
      {children}
    </RewardContext.Provider>
  );
}

export function useReward() {
  const ctx = useContext(RewardContext);
  if (!ctx) return { queue: [], pushReward: () => {}, clearRewards: () => {}, removeTop: () => {}, lastGardenImpact: null, clearLastGardenImpact: () => {} };
  return ctx;
}
