import { useState, useEffect } from 'react';
import { EnergyProvider } from './context/EnergyContext';
import { useGarden, todayString } from './context/GardenContext';
import { getSettings } from './services/userSettings';
import { useReward } from './context/RewardContext';
import { generateDailyPlan } from './services/schedulerService';
import { buildReward } from './services/dopamineEngine';
import { useTheme } from './context/ThemeContext';
import SundayRitualController from './components/Rituals/SundayRitualController';
import GardenDashboard from './components/Dashboard/GardenDashboard';
import MorningCheckIn from './components/Dashboard/MorningCheckIn';
import WelcomeGarden from './components/Onboarding/WelcomeGarden';
import WelcomeOnboarding from './components/Onboarding/WelcomeOnboarding';
import SeasonParticles from './components/SeasonParticles';

const ONBOARDING_COMPLETE_KEY = 'kaizen_onboarding_complete';

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
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const {
    hydrated,
    lastCheckInDate,
    lastSundayRitualDate,
    dailyEnergyModifier,
    dailySpoonCount,
    goals,
    userSettings,
    googleUser,
    logMetric,
    updateWeeklyEvents,
    completeMorningCheckIn,
    markSundayRitualComplete,
    assignments,
    setAssignments,
    addGoal,
  } = useGarden();
  const { pushReward } = useReward();

  const isAuthed = !!googleUser?.uid;
  const hasOnboarded = userSettings?.hasOnboarded === true;
  const needsWelcome = isAuthed && !hasOnboarded;
  const yesterdayPlan =
    lastCheckInDate === yesterdayString()
      ? { modifier: dailyEnergyModifier, spoonCount: dailySpoonCount }
      : null;
  const { theme } = useTheme();
  const [a11y, setA11y] = useState(() => getSettings());

  useEffect(() => {
    const fn = () => setA11y(getSettings());
    window.addEventListener('accessibility-settings-changed', fn);
    return () => window.removeEventListener('accessibility-settings-changed', fn);
  }, []);

  const textSizeClass = a11y.textSize === 'sm' ? 'text-sm' : a11y.textSize === 'lg' ? 'text-lg' : 'text-base';
  const a11yClasses = [textSizeClass, a11y.highContrast ? 'hc' : '', a11y.lowStim ? 'lowstim' : ''].filter(Boolean).join(' ');

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

  useEffect(() => {
    if (!hydrated) return;
    try {
      setOnboardingComplete(localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true');
    } catch (_) {}
  }, [hydrated]);

  const handleOnboardingComplete = (action) => {
    try {
      localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    } catch (_) {}
    setOnboardingComplete(true);
    if (action === 'set_spoons') setView('intro');
  };

  const handleRitualComplete = (plan) => {
    updateWeeklyEvents(Array.isArray(plan) ? plan : plan?.events ?? []);
    markSundayRitualComplete();
    setView(lastCheckInDate !== todayString() ? 'intro' : 'dashboard');
  };

  const handleIntroComplete = (modifier, spoonCount) => {
    completeMorningCheckIn(spoonCount);
    const reward = buildReward({ type: 'MORNING_CHECKIN_DONE', payload: { spoonCount } });
    if (reward) pushReward(reward);
    const hasAnyAssignment = Object.keys(assignments || {}).length > 0;
    if (!hasAnyAssignment) {
      const plan = generateDailyPlan(goals, spoonCount);
      setAssignments(plan);
    }
    setView('dashboard');
  };

  return (
    <EnergyProvider>
      <div className={`min-h-screen font-sans relative ${theme.containerClass} ${a11yClasses}`}>
        {!a11y.lowStim && <SeasonParticles particleType={theme.particleType} />}
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

          {/* Validation-first onboarding (ADHD/disability); show before morning check-in on first launch */}
          {hydrated && !onboardingComplete && (
            <WelcomeOnboarding
              open={!onboardingComplete}
              onClose={() => {}}
              onComplete={handleOnboardingComplete}
              addGoal={addGoal}
            />
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
