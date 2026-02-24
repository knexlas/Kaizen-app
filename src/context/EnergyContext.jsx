import { createContext, useContext, useState, useCallback } from 'react';
import { addEnergyRecord as saveEnergyRecord } from '../firebase/services';

const EnergyContext = createContext(null);

const DEFAULT_DAILY = 3;

/** Energy level 1–5 is used as a "Friction Filter" (e.g. ≤2 → prioritize short tasks). Stored here and in GardenContext.dailySpoonCount. */

export function EnergyProvider({ children }) {
  const [dailyEnergy, setDailyEnergy] = useState(DEFAULT_DAILY);
  const [currentEnergy, setCurrentEnergy] = useState(DEFAULT_DAILY);

  const setEnergyLevel = useCallback((level) => {
    const n = Math.max(1, Math.min(5, Number(level) || DEFAULT_DAILY));
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

  const value = {
    dailyEnergy,
    currentEnergy,
    setCurrentEnergy,
    setEnergyLevel,
    recordEnergy,
    restMode: currentEnergy < 1,
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
