import { createContext, useContext, useMemo } from 'react';

/** Month 0-11 → season key */
export function getSeason(month) {
  if (month === 11 || month <= 1) return 'winter';
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  return 'autumn';
}

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

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const theme = useMemo(() => {
    const month = new Date().getMonth();
    return THEMES[getSeason(month)] ?? THEMES.spring;
  }, []);

  const value = useMemo(() => ({ theme, season: theme.season }), [theme]);

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
