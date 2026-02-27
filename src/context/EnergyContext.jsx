import { createContext, useContext, useState, useCallback } from 'react';
import { addEnergyRecord as saveEnergyRecord } from '../firebase/services';

const EnergyContext = createContext(null);

/** Sparks (Energy Units) 1–10. Used as daily capacity and friction filter. Stored in GardenContext.dailySpoonCount. */
const SPARKS_MIN = 1;
const SPARKS_MAX = 10;
const DEFAULT_SPARKS = 5;

export function EnergyProvider({ children }) {
  const [dailyEnergy, setDailyEnergy] = useState(DEFAULT_SPARKS);
  const [currentEnergy, setCurrentEnergy] = useState(DEFAULT_SPARKS);

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

  const value = {
    dailyEnergy,
    currentEnergy,
    setCurrentEnergy,
    setEnergyLevel,
    recordEnergy,
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
