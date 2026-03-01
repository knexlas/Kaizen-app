import { useState, useEffect, useCallback } from 'react';
import { EnergyProvider } from './context/EnergyContext';
import { useGarden, todayString } from './context/GardenContext';
import { localISODate, getThisWeekSundayLocal } from './services/dateUtils';
import { getSettings } from './services/userSettings';
import { useReward } from './context/RewardContext';
import { generateDailyPlan, hourFromTimeStr } from './services/schedulerService';
import { buildReward } from './services/dopamineEngine';
import { useTheme } from './context/ThemeContext';
import { getOnboardingCompleted } from './services/onboardingStateService';
import SundayRitualController from './components/Rituals/SundayRitualController';
import GardenDashboard from './components/Dashboard/GardenDashboard';
import MissedDayModal from './components/Onboarding/MissedDayModal';
import FirstRunFlow from './components/Onboarding/FirstRunFlow';
import SeasonParticles from './components/SeasonParticles';
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

  /** Single feedback path for kaizen:toast: route to RewardOverlay only. */
  useEffect(() => {
    const handler = (e) => {
      const message = e?.detail?.message;
      if (message != null && String(message).trim() !== '' && typeof pushReward === 'function') {
        pushReward({ message: String(message).trim(), tone: 'moss', icon: '✨', sound: null });
      }
    };
    window.addEventListener('kaizen:toast', handler);
    return () => window.removeEventListener('kaizen:toast', handler);
  }, [pushReward]);

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

  const [initialTabFromHash, setInitialTabFromHash] = useState(null); // 'planner' when navigated via #/plan
  useEffect(() => {
    if (!hydrated) return;
    const syncFromHash = () => {
      if (window.location.hash === '#/plan') {
        setView('dashboard');
        setInitialTabFromHash('planner');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    setOnboardingComplete(getOnboardingCompleted());
  }, [hydrated]);

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
          {(!hydrated || (hasOnboarded && view === 'loading')) && (
            <div className="flex min-h-screen items-center justify-center text-stone-500">
              <span className="animate-pulse">Loading…</span>
            </div>
          )}
          {hydrated && !hasOnboarded && (
            <FirstRunFlow onComplete={() => setOnboardingComplete(true)} />
          )}
          {hasOnboarded && view === 'sunday_ritual' && (
            <SundayRitualController onComplete={handleRitualComplete} />
          )}
          {hasOnboarded && view === 'intro' && (
            <MissedDayModal open={true} onChoose={handleMissedDayChoose} />
          )}
          {hasOnboarded && view === 'dashboard' && (
            <GardenDashboard
              initialTab={initialTabFromHash}
              onConsumeInitialTab={() => setInitialTabFromHash(null)}
            />
          )}
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
