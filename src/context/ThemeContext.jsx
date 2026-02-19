import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';

/** Month 0-11 → season key */
export function getSeason(month) {
  if (month === 11 || month <= 1) return 'winter';
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  return 'autumn';
}

/** Time-based dark mode: on at 21:00, off at 07:00 (Reddit-style). */
export function isNightModeHour(hour) {
  return hour >= 21 || hour < 7;
}

export const DARK_CONTAINER_CLASS = 'bg-slate-900 text-slate-100';

export const THEMES = {
  winter: {
    season: 'winter',
    containerClass: 'bg-gradient-to-b from-slate-50 to-slate-200 text-stone-900',
    accentClass: 'text-sky-400',
    particleType: 'snow',
  },
  spring: {
    season: 'spring',
    containerClass: 'bg-gradient-to-b from-amber-50 via-rose-50/80 to-stone-100 text-stone-900',
    accentClass: 'text-pink-300',
    particleType: 'petals',
  },
  summer: {
    season: 'summer',
    containerClass: 'bg-gradient-to-b from-emerald-50 via-teal-50/70 to-stone-100 text-stone-900',
    accentClass: 'text-amber-400',
    particleType: 'fireflies',
  },
  autumn: {
    season: 'autumn',
    containerClass: 'bg-gradient-to-b from-orange-50/90 via-amber-100/80 to-stone-200 text-stone-900',
    accentClass: 'text-orange-600',
    particleType: 'leaves',
  },
};

const DARK_OVERRIDE_KEY = 'kaizen_dark_override';

function getStoredDarkOverride() {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(DARK_OVERRIDE_KEY) : null;
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  } catch (_) {
    return null;
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [now, setNow] = useState(() => new Date());
  const [darkModeOverride, setDarkModeOverrideState] = useState(getStoredDarkOverride);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const setDarkModeOverride = useCallback((value) => {
    const next = value === true || value === false ? value : null;
    setDarkModeOverrideState(next);
    try {
      if (typeof localStorage !== 'undefined') {
        if (next === null) localStorage.removeItem(DARK_OVERRIDE_KEY);
        else localStorage.setItem(DARK_OVERRIDE_KEY, String(next));
      }
    } catch (_) {}
  }, []);

  const value = useMemo(() => {
    const month = now.getMonth();
    const hour = now.getHours();
    const seasonTheme = THEMES[getSeason(month)] ?? THEMES.spring;
    const timeBasedDark = isNightModeHour(hour);
    const darkMode = darkModeOverride !== null ? darkModeOverride : timeBasedDark;
    const containerClass = darkMode ? DARK_CONTAINER_CLASS : seasonTheme.containerClass;
    return {
      theme: { ...seasonTheme, containerClass },
      season: seasonTheme.season,
      darkMode,
      setDarkModeOverride,
    };
  }, [now, darkModeOverride, setDarkModeOverride]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
