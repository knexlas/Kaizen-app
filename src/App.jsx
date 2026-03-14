import { useState, useEffect } from 'react';
import { EnergyProvider } from './context/EnergyContext';
import { useGarden, todayString } from './context/GardenContext';
import { localISODate, getThisWeekSundayLocal } from './services/dateUtils';
import { getSettings } from './services/userSettings';
import { useReward } from './context/RewardContext';
import { buildReward } from './services/dopamineEngine';
import { completeCheckInCommand } from './services/coreCommands';
import { useTheme } from './context/ThemeContext';
import SundayRitualController from './components/Rituals/SundayRitualController';
import GardenDashboard from './components/Dashboard/GardenDashboard';
import MorningCheckIn from './components/Dashboard/MorningCheckIn';
import FirstRunFlow from './components/Onboarding/FirstRunFlow';
import PreferenceOnboarding from './components/Onboarding/PreferenceOnboarding';
import SeasonParticles from './components/SeasonParticles';
import { getGamificationConfig } from './constants/gamificationIntensity';
/** YYYY-MM-DD for yesterday, local timezone. */
function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localISODate(d);
}

function App() {
  const [view, setView] = useState('loading');
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

  const preferencesCompleted = userSettings?.onboardingPreferencesCompleted === true;
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

  const handleRitualComplete = (plan) => {
    updateWeeklyEvents(Array.isArray(plan) ? plan : plan?.events ?? []);
    markSundayRitualComplete();
    setView(lastCheckInDate !== todayString() ? 'intro' : 'dashboard');
  };

  const handleMissedDayChoose = (choice) => {
    const level = choice == null ? null : Math.max(1, Math.min(10, Number(choice) || 5));
    if (level == null) return;
    const today = localISODate(new Date());
    const missedDays = lastCheckInDate
      ? Math.max(1, Math.ceil((new Date(today) - new Date(lastCheckInDate)) / (24 * 60 * 60 * 1000)))
      : 1;
    archivePlanToCompost?.();
    completeMorningCheckIn(level);
    const { plan } = completeCheckInCommand({ choice: level, goals, weeklyEvents, userSettings });
    setAssignments(plan);
    const reward = buildReward({ type: 'MORNING_CHECKIN_DONE', payload: { spoonCount: level, missedDays } });
    if (reward) pushReward(reward);
    setView('dashboard');
  };

  const feedbackEmail =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FEEDBACK_EMAIL
      ? String(import.meta.env.VITE_FEEDBACK_EMAIL).trim()
      : '');

  return (
    <EnergyProvider>
      <div className={`min-h-screen font-sans relative ${theme.containerClass} ${a11yClasses}`}>
        {!a11y.lowStim && getGamificationConfig(userSettings ?? {}).showParticles && <SeasonParticles particleType={theme.particleType} />}
        <div className="relative z-10">
          {(!hydrated || (hasOnboarded && view === 'loading')) && (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-stone-500" role="status" aria-live="polite">
              <span className="text-4xl" aria-hidden>🌱</span>
              <span className="animate-pulse font-sans text-sm">Loading your garden…</span>
            </div>
          )}
          {hydrated && !preferencesCompleted && (
            <PreferenceOnboarding onComplete={() => {}} />
          )}
          {hydrated && preferencesCompleted && !hasOnboarded && (
            <FirstRunFlow onComplete={() => {}} />
          )}
          {hasOnboarded && view === 'sunday_ritual' && (
            <SundayRitualController onComplete={handleRitualComplete} />
          )}
          {hasOnboarded && view === 'intro' && (
            <MorningCheckIn
              goals={goals}
              logMetric={logMetric}
              yesterdayPlan={yesterdayPlan}
              onComplete={(modifier, energyLevel) => handleMissedDayChoose(energyLevel ?? modifier)}
            />
          )}
          {hasOnboarded && view === 'dashboard' && (
            <GardenDashboard />
          )}
        </div>

        {/* Feedback button appears only when configured. */}
        {feedbackEmail && (
          <a
            href={`mailto:${feedbackEmail}?subject=Kaizen%20Beta%20Feedback`}
            className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-40 bg-stone-800 text-white px-3 py-2 rounded-full shadow-lg text-xs sm:text-sm font-medium flex items-center gap-2 hover:bg-stone-700 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 safe-area-pb"
            aria-label="Send beta feedback by email"
          >
            🐞 Beta Feedback
          </a>
        )}
      </div>
    </EnergyProvider>
  );
}

export default App;
