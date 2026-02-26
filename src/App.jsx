import { useState, useEffect } from 'react';
import { EnergyProvider } from './context/EnergyContext';
import { useGarden, todayString } from './context/GardenContext';
import { localISODate, getThisWeekSundayLocal } from './services/dateUtils';
import { getSettings } from './services/userSettings';
import { useReward } from './context/RewardContext';
import { generateDailyPlan, hourFromTimeStr } from './services/schedulerService';
import { buildReward } from './services/dopamineEngine';
import { useTheme } from './context/ThemeContext';
import SundayRitualController from './components/Rituals/SundayRitualController';
import GardenDashboard from './components/Dashboard/GardenDashboard';
import MissedDayModal from './components/Onboarding/MissedDayModal';
import WelcomeGarden from './components/Onboarding/WelcomeGarden';
import WelcomeOnboarding from './components/Onboarding/WelcomeOnboarding';
import SeasonParticles from './components/SeasonParticles';
import GlobalToast from './components/GlobalToast';

const ONBOARDING_COMPLETE_KEY = 'kaizen_onboarding_complete';

/** YYYY-MM-DD for yesterday, local timezone. */
function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localISODate(d);
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
    archivePlanToCompost,
    weeklyEvents,
  } = useGarden();
  const { pushReward } = useReward();

  const hasOnboarded = userSettings?.hasOnboarded === true;
  const needsWelcome = !hasOnboarded;
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
    const thisWeekSunday = getThisWeekSundayLocal();
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

  const handleMissedDayChoose = (choice) => {
    if (choice == null) return;
    archivePlanToCompost?.();
    completeMorningCheckIn(choice);
    const eventsForPlan = Array.isArray(weeklyEvents) ? weeklyEvents : [];
    const startHour = hourFromTimeStr(userSettings?.dayStart, 8);
    const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
    const plan = choice === 0 ? {} : generateDailyPlan(goals, choice, eventsForPlan, { stormBufferMinutes: 30, startHour, endHour });
    setAssignments(plan);
    const reward = buildReward({ type: 'MORNING_CHECKIN_DONE', payload: { spoonCount: choice } });
    if (reward) pushReward(reward);
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
            <MissedDayModal open={true} onChoose={handleMissedDayChoose} />
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

          {/* Full onboarding wizard (name, spirit, first seed) — after simple welcome so all users see it */}
          {hydrated && needsWelcome && onboardingComplete && (
            <WelcomeGarden />
          )}

          <GlobalToast />
        </div>

        {/* Beta feedback — always visible */}
        <a
          href="mailto:youremail@example.com?subject=Kaizen%20Beta%20Feedback"
          className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-40 bg-stone-800 text-white px-3 py-2 rounded-full shadow-lg text-xs sm:text-sm font-medium flex items-center gap-2 hover:bg-stone-700 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 safe-area-pb"
          aria-label="Send beta feedback by email"
        >
          🐞 Beta Feedback
        </a>
      </div>
    </EnergyProvider>
  );
}

export default App;
