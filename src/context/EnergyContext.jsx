import { createContext, useContext, useState, useCallback } from 'react';
import { addEnergyRecord as saveEnergyRecord } from '../firebase/services';

const EnergyContext = createContext(null);

const DEFAULT_DAILY = 5;

/** Spoon count (1–12) is owned by GardenContext.dailySpoonCount; read via useGarden(). */

export function EnergyProvider({ children }) {
  const [dailyEnergy] = useState(DEFAULT_DAILY);
  const [currentEnergy, setCurrentEnergy] = useState(DEFAULT_DAILY);

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
