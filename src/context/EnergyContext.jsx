import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { addEnergyRecord as saveEnergyRecord } from '../firebase/services';

const EnergyContext = createContext(null);
const BEHAVIOR_HISTORY_KEY = 'kaizen:energy-behavior-history';
const MAX_BEHAVIOR_EVENTS = 400;

/** Sparks (Energy Units) 1–10. Used as daily capacity and friction filter. Stored in GardenContext.dailySpoonCount. */
const SPARKS_MIN = 1;
const SPARKS_MAX = 10;
const DEFAULT_SPARKS = 5;

function loadBehaviorHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BEHAVIOR_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendBehaviorEvent(history, event) {
  const next = [...(Array.isArray(history) ? history : []), event];
  return next.slice(-MAX_BEHAVIOR_EVENTS);
}

export function EnergyProvider({ children }) {
  const [dailyEnergy, setDailyEnergy] = useState(DEFAULT_SPARKS);
  const [currentEnergy, setCurrentEnergy] = useState(DEFAULT_SPARKS);
  const [behaviorHistory, setBehaviorHistory] = useState(() => loadBehaviorHistory());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(BEHAVIOR_HISTORY_KEY, JSON.stringify(behaviorHistory));
    } catch {
      // Ignore localStorage failures; energy history is a progressive enhancement.
    }
  }, [behaviorHistory]);

  const setEnergyLevel = useCallback((level) => {
    const n = Math.max(SPARKS_MIN, Math.min(SPARKS_MAX, Number(level) || DEFAULT_SPARKS));
    setDailyEnergy(n);
    setCurrentEnergy(n);
  }, []);

  const recordEnergy = useCallback(async (stones, valence, journal) => {
    const record = { stones, valence, journal };
    await saveEnergyRecord(record);
    setCurrentEnergy((prev) => {
      const next = valence === 'charge' ? prev + stones : prev - stones;
      return Math.max(0, Math.min(dailyEnergy, next));
    });
  }, [dailyEnergy]);

  const recordFocusBehavior = useCallback((phase, payload = {}) => {
    const normalizedPhase = phase === 'complete' || phase === 'abandon' || phase === 'start' ? phase : 'start';
    const stamp = payload?.date ? new Date(payload.date) : new Date();
    const hour = Number.isFinite(Number(payload?.hour)) ? Number(payload.hour) : stamp.getHours();
    const event = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `behavior-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: `focus_${normalizedPhase}`,
      date: stamp.toISOString(),
      hour: Math.max(0, Math.min(23, hour)),
      goalId: payload?.goalId ?? null,
      title: payload?.title ?? '',
      taskType: payload?.taskType ?? null,
      planned: payload?.planned === true,
      minutes: Number.isFinite(Number(payload?.minutes)) ? Number(payload.minutes) : null,
      spoonCount: Number.isFinite(Number(payload?.spoonCount)) ? Number(payload.spoonCount) : null,
    };
    setBehaviorHistory((prev) => appendBehaviorEvent(prev, event));
  }, []);

  const recordCheckInBehavior = useCallback((payload = {}) => {
    const stamp = payload?.date ? new Date(payload.date) : new Date();
    const event = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `behavior-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: 'checkin',
      date: stamp.toISOString(),
      hour: stamp.getHours(),
      spoonCount: Number.isFinite(Number(payload?.spoonCount)) ? Number(payload.spoonCount) : null,
      energyLevel: Number.isFinite(Number(payload?.energyLevel)) ? Number(payload.energyLevel) : null,
    };
    setBehaviorHistory((prev) => appendBehaviorEvent(prev, event));
  }, []);

  const value = {
    dailyEnergy,
    currentEnergy,
    setCurrentEnergy,
    setEnergyLevel,
    recordEnergy,
    behaviorHistory,
    recordFocusBehavior,
    recordCheckInBehavior,
    restMode: currentEnergy < 1,
    sparksMin: SPARKS_MIN,
    sparksMax: SPARKS_MAX,
  };

  return (
    <EnergyContext.Provider value={value}>
      {children}
    </EnergyContext.Provider>
  );
}

export function useEnergy() {
  const ctx = useContext(EnergyContext);
  if (!ctx) throw new Error('useEnergy must be used within EnergyProvider');
  return ctx;
}
