import { useState, useEffect } from 'react';
import { EnergyProvider } from './context/EnergyContext';
import { useGarden, todayString } from './context/GardenContext';
import { useTheme } from './context/ThemeContext';
import SundayRitualController from './components/Rituals/SundayRitualController';
import GardenDashboard from './components/Dashboard/GardenDashboard';
import MorningCheckIn from './components/Dashboard/MorningCheckIn';
import WelcomeGarden from './components/Onboarding/WelcomeGarden';
import SeasonParticles from './components/SeasonParticles';

/** YYYY-MM-DD for this week's Sunday (same week as today). */
function getThisWeekSundayString() {
  const d = new Date();
  const day = d.getDay();
  const sundayOffset = day === 0 ? 0 : -day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + sundayOffset);
  return sunday.toISOString().slice(0, 10);
}

/** YYYY-MM-DD for yesterday. */
function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function App() {
  const [view, setView] = useState('loading');
  const {
    hydrated,
    lastCheckInDate,
    lastSundayRitualDate,
    dailyEnergyModifier,
    goals,
    userSettings,
    googleUser,
    logMetric,
    updateWeeklyEvents,
    completeMorningCheckIn,
    markSundayRitualComplete,
  } = useGarden();

  const isAuthed = !!googleUser?.uid;
  const hasOnboarded = userSettings?.hasOnboarded === true;
  const needsWelcome = isAuthed && !hasOnboarded;
  const yesterdayPlan =
    lastCheckInDate === yesterdayString()
      ? { modifier: dailyEnergyModifier }
      : null;
  const { theme } = useTheme();

  useEffect(() => {
    if (!hydrated) return;
    const today = todayString();
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const thisWeekSunday = getThisWeekSundayString();
    const lastSundayRitualCompleted = lastSundayRitualDate === thisWeekSunday;

    if (currentDay === 'Sunday' && !lastSundayRitualCompleted) {
      setView('sunday_ritual');
    } else if (lastCheckInDate !== today) {
      setView('intro');
    } else {
      setView('dashboard');
    }
  }, [hydrated, lastCheckInDate, lastSundayRitualDate]);

  const handleRitualComplete = (plan) => {
    updateWeeklyEvents(Array.isArray(plan) ? plan : plan?.events ?? []);
    markSundayRitualComplete();
    setView(lastCheckInDate !== todayString() ? 'intro' : 'dashboard');
  };

  const handleIntroComplete = (modifier) => {
    completeMorningCheckIn(modifier);
    setView('dashboard');
  };

  return (
    <EnergyProvider>
      <div className={`min-h-screen font-sans relative ${theme.containerClass}`}>
        <SeasonParticles particleType={theme.particleType} />
        <div className="relative z-10">
          {view === 'loading' && (
            <div className="flex min-h-screen items-center justify-center text-stone-500">
              <span className="animate-pulse">Loading…</span>
            </div>
          )}
          {view === 'sunday_ritual' && (
            <SundayRitualController onComplete={handleRitualComplete} />
          )}
          {view === 'intro' && (
            <MorningCheckIn
              goals={goals}
              logMetric={logMetric}
              onComplete={handleIntroComplete}
              yesterdayPlan={yesterdayPlan}
            />
          )}
          {view === 'dashboard' && (
            <GardenDashboard />
          )}

          {/* Onboarding overlay (blocks interaction until finished) */}
          {hydrated && needsWelcome && (
            <WelcomeGarden />
          )}
        </div>
      </div>
    </EnergyProvider>
  );
}

export default App;
