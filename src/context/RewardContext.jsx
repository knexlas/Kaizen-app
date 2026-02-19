import { createContext, useContext, useState, useCallback } from 'react';
import { getSettings } from '../services/userSettings';

const MAX_QUEUE = 3;

const RewardContext = createContext(null);

export function RewardProvider({ children }) {
  const [queue, setQueue] = useState([]);

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
    };
    setQueue((prev) => {
      const next = [...prev, entry].slice(-MAX_QUEUE);
      return next;
    });
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
  };

  return (
    <RewardContext.Provider value={value}>
      {children}
    </RewardContext.Provider>
  );
}

export function useReward() {
  const ctx = useContext(RewardContext);
  if (!ctx) return { queue: [], pushReward: () => {}, clearRewards: () => {}, removeTop: () => {} };
  return ctx;
}
