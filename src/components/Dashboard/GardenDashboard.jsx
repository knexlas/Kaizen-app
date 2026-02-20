import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { useTheme } from '../../context/ThemeContext';
import { useEnergy } from '../../context/EnergyContext';
import { useReward } from '../../context/RewardContext';
import { buildReward } from '../../services/dopamineEngine';
import { getSettings } from '../../services/userSettings';
import { pickStarterTask } from '../../services/startAssist';
import { localISODate, diffDays, weekdayIndexMon0, jsDayFromMon0 } from '../../services/dateUtils';
import StartAssistModal from '../StartAssist/StartAssistModal';
import StartNowModal from '../StartAssist/StartNowModal';
import GentleRestartModal from '../Onboarding/GentleRestartModal';
import GuidedEmptyState from '../EmptyStates/GuidedEmptyState';
import AccessibilitySettingsModal from '../Settings/AccessibilitySettingsModal';
import GoalCreator from '../Goals/GoalCreator';
import ProjectPlanner from '../Projects/ProjectPlanner';
import HorizonsGantt from '../Horizons/HorizonsGantt';
import HorizonsMetrics from '../Horizons/HorizonsMetrics';
import GoalEditor from '../Goals/GoalEditor';
import TimeSlicer, { HOURS, MAX_SLOTS_BY_WEATHER } from './TimeSlicer';
import CompassWidget from './CompassWidget';
import CommandPalette from './CommandPalette';
import MochiSpiritWithDialogue, { MochiSpirit, getSpiritGreeting, getPlanReaction } from './MochiSpirit';
import SpiritChat from './SpiritChat';
import CompostHeap from './CompostHeap';
import { generateSpiritInsight, generateWeeklyPlan, generateMonthlyPlan } from '../../services/geminiService';
import { importICSFile, downloadICS, CALENDAR_PROVIDERS } from '../../services/calendarSyncService';
import { fetchOutlookEvents } from '../../services/microsoftCalendarService';
import { getStoredBriefing, setStoredBriefing } from '../../services/spiritBriefingStorage';
import MorningCheckIn from './MorningCheckIn';
import EveningWindDown from './EveningWindDown';
import FocusSession from '../Focus/FocusSession';
import TeaCeremony from '../Focus/TeaCeremony';
import GardenWalk from '../Garden/GardenWalk';
import JournalView from './JournalView';
import AnalyticsView from './AnalyticsView';
import SettingsView from './SettingsView';
import SpiritBuilder from '../Onboarding/SpiritBuilder';
import SpiritGuideTour from '../Onboarding/SpiritGuideTour';
import SpiritOrigins from '../Onboarding/SpiritOrigins';
import { fetchGoogleEvents } from '../../services/googleCalendarService';
import { findAvailableSlots, generateLiquidSchedule, generateSolidSchedule, getDefaultWeekStart, getStormWarnings, timeToMinutes, minutesToTime, generateDailyPlan, materializeWeeklyPlan } from '../../services/schedulerService';

// --- Icons ---
const SunIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-500 shrink-0">
    <circle cx="12" cy="12" r="5" strokeWidth="2" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const LeafIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-moss-500 shrink-0">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const StormIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-600 shrink-0">
    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 11l-4 6h6l-4 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MirrorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M9 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    <path d="M15 6h5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const MoonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

/** Mon=0 .. Sun=6 (matches weekdayIndexMon0). */
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** All tabs available from day one. */
const TAB_LEVELS = { focus: 1, horizons: 1, garden: 1, settings: 1, journal: 1, insights: 1 };
const LOCKED_TAB_TOAST = 'Keep growing to unlock this area.';

/** Minutes logged this month for a goal (from logs). */
function getMinutesThisMonthForGoal(logs, goalId) {
  if (!Array.isArray(logs) || !goalId) return 0;
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  return logs.reduce((sum, log) => {
    if (log.taskId !== goalId || !log.date) return sum;
    const d = typeof log.date === 'string' ? new Date(log.date) : log.date;
    if (d.getFullYear() !== thisYear || d.getMonth() !== thisMonth) return sum;
    return sum + (Number(log.minutes) || 0);
  }, 0);
}

/** Minutes logged this week (Mon–Sun) for a goal (from logs). */
function getMinutesThisWeekForGoal(logs, goalId) {
  if (!Array.isArray(logs) || !goalId) return 0;
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return logs.reduce((sum, log) => {
    if (log.taskId !== goalId || !log.date) return sum;
    const d = typeof log.date === 'string' ? new Date(log.date) : log.date;
    if (d < monday || d >= nextMonday) return sum;
    return sum + (Number(log.minutes) || 0);
  }, 0);
}

/** Domain id -> Pond display name (for Vitality grouping). */
const POND_LABELS = {
  body: 'Physical Health',
  finance: 'Finance',
  mind: 'Mind',
  spirit: 'Spirit',
};

/** Latest metric value for a vitality goal (from goal.metrics). */
function getLatestMetricValue(goal) {
  const metrics = Array.isArray(goal?.metrics) ? goal.metrics : [];
  if (metrics.length === 0) return null;
  const sorted = [...metrics].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return sorted[0]?.value;
}

/** Projected hours at end of month. Returns { projectedHours, onTrack, daysRemaining, hoursPerDayNeeded, encouragement }. */
function getMonthlyProjection(minutesLogged, monthlyTargetHours) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysElapsed = Math.max(1, dayOfMonth);
  const daysRemaining = Math.max(1, daysInMonth - dayOfMonth);
  const hoursLogged = minutesLogged / 60;
  const pace = hoursLogged / daysElapsed;
  const projectedHours = Math.round(pace * daysInMonth * 10) / 10;
  const onTrack = projectedHours >= monthlyTargetHours;
  const hoursLeft = Math.max(0, monthlyTargetHours - hoursLogged);
  const hoursPerDayNeeded = Math.round((hoursLeft / daysRemaining) * 10) / 10;
  const pctComplete = monthlyTargetHours > 0 ? Math.round((hoursLogged / monthlyTargetHours) * 100) : 0;

  let encouragement;
  if (hoursLogged === 0 && dayOfMonth <= 3) {
    encouragement = 'The month is fresh. One small step today starts the path.';
  } else if (hoursLogged === 0) {
    encouragement = `Still time — ${hoursPerDayNeeded}h/day gets you there. Start with just 15 minutes.`;
  } else if (onTrack) {
    encouragement = `On pace for ${projectedHours}h. Steady wins.`;
  } else if (pctComplete >= 60) {
    encouragement = `Almost there — ${hoursPerDayNeeded}h/day to finish strong.`;
  } else if (daysRemaining > daysInMonth / 2) {
    encouragement = `Plenty of time. ${hoursPerDayNeeded}h/day is all it takes.`;
  } else {
    encouragement = `A little behind, but ${hoursPerDayNeeded}h/day closes the gap. You've got this.`;
  }

  return { projectedHours, onTrack, daysRemaining, hoursPerDayNeeded, encouragement };
}

function getWeather(events) {
  if (!events?.length) return { weather: 'sun', forecast: 'Sunny' };
  const types = events.map((e) => e.type);
  if (types.includes('storm')) return { weather: 'storm', forecast: 'High Winds Forecast' };
  if (types.includes('leaf')) return { weather: 'breeze', forecast: 'Breeze Forecast' };
  return { weather: 'sun', forecast: 'Sunny' };
}

/** dayIndex: JS getDay() convention (0=Sun..6=Sat). Goals store ritual.days in this convention. */
function getRitualForToday(goal, dayIndex) {
  return goal?.rituals?.find((r) => Array.isArray(r.days) && r.days.includes(dayIndex));
}

function GardenDashboard() {
  const { goals, weeklyEvents, logs, addGoal, updateGoalProgress, updateGoalMilestone, editGoal, deleteGoal, addSubtask, updateSubtask, deleteSubtask, updateSubtaskProgress, lastCheckInDate, completeMorningCheckIn, dailyEnergyModifier, dailySpoonCount, addLog, logMetric, googleUser, connectCalendar, disconnectCalendar, googleToken, updateWeeklyEvents, cloudSaveStatus, spiritConfig, setSpiritConfig, compost, addToCompost, removeFromCompost, soilNutrients, consumeSoilNutrients, earnEmbers, assignments, setAssignments, gentleResetToToday, archiveStalePlanItems, eveningMode, setEveningMode, userSettings, addRitualCategory, saveDayPlanForDate, msUser, msToken, connectOutlook, disconnectOutlook, refreshOutlookToken } = useGarden();
  const { pushReward } = useReward();
  const { darkMode: themeDarkMode, setDarkModeOverride } = useTheme();
  const isDark = themeDarkMode || eveningMode === 'night-owl';
  const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10));
  const needsMorningCheckIn = lastCheckInDate !== today;

  const yesterdayForPlan = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [today]);
  const yesterdayPlan = lastCheckInDate === yesterdayForPlan ? { modifier: dailyEnergyModifier, spoonCount: dailySpoonCount } : null;

  const { setDailySpoonCount } = useEnergy();
  useEffect(() => {
    if (typeof dailySpoonCount === 'number' && dailySpoonCount >= 1 && dailySpoonCount <= 12) {
      setDailySpoonCount(dailySpoonCount);
    }
  }, [dailySpoonCount, setDailySpoonCount]);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = new Date().toISOString().slice(0, 10);
      setToday((d) => (d !== next ? next : d));
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  const [activeTab, setActiveTab] = useState('focus');
  const [selectedDate, setSelectedDate] = useState(() => weekdayIndexMon0(new Date())); // mon0: 0=Mon..6=Sun
  const [isPlanting, setIsPlanting] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionConfigTarget, setSessionConfigTarget] = useState(null); // { goal, hour } when "Configure Session" is open
  const [configDurationMinutes, setConfigDurationMinutes] = useState(25);
  const [configDurationCustom, setConfigDurationCustom] = useState(false);
  const [showTeaCeremony, setShowTeaCeremony] = useState(false);
  const [completedTask, setCompletedTask] = useState(null);
  const [metricPrompt, setMetricPrompt] = useState(null); // { goalId, metricName, unit, vitalityGoalId? }
  const [metricPromptValue, setMetricPromptValue] = useState('');
  const [seedForMilestones, setSeedForMilestones] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [fertilizerToast, setFertilizerToast] = useState(false);
  const [growthToast, setGrowthToast] = useState(null);
  const [calendarConnectedToast, setCalendarConnectedToast] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  const [planningWeek, setPlanningWeek] = useState(false);
  const [weekPreview, setWeekPreview] = useState(null); // { [dateStr]: { [hour]: assignment } } for review before saving
  const [monthlyRoadmap, setMonthlyRoadmap] = useState(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showSpiritMirror, setShowSpiritMirror] = useState(false);
  const [showProjectPlanner, setShowProjectPlanner] = useState(false);
  const [horizonsView, setHorizonsView] = useState('planning'); // 'planning' | 'metrics'
  const [showStartAssistModal, setShowStartAssistModal] = useState(false);
  const [startAssistSuggestedTask, setStartAssistSuggestedTask] = useState(null);
  const [startAssistNoTasks, setStartAssistNoTasks] = useState(false);
  const [showStartNowModal, setShowStartNowModal] = useState(false);
  const [startNowCandidate, setStartNowCandidate] = useState(null);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [showGentleRestart, setShowGentleRestart] = useState(false);
  const gentleRestartGapDaysRef = useRef(0);
  const [staleArchivedCount, setStaleArchivedCount] = useState(0);
  const hasRunArchiveStaleRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [showAccessibilityModal, setShowAccessibilityModal] = useState(false);
  const [showMorningCheckInModal, setShowMorningCheckInModal] = useState(false);
  const [goalCreatorInitialTitle, setGoalCreatorInitialTitle] = useState('');
  const [goalCreatorInitialSubtasks, setGoalCreatorInitialSubtasks] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [showSpiritDialogue, setShowSpiritDialogue] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCompost, setShowCompost] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isMobileNav, setIsMobileNav] = useState(false);
  const [justFinishedSession, setJustFinishedSession] = useState(false);
  const [showEveningModal, setShowEveningModal] = useState(false);
  const [showEveningNudgeToast, setShowEveningNudgeToast] = useState(false);
  const eveningNudgeShownRef = useRef(null); // date string when nudge was shown
  const eveningModalAutoOpenedRef = useRef(null); // date string when evening modal was auto-opened
  const [lockedTabToast, setLockedTabToast] = useState(null);
  const [recordedToast, setRecordedToast] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showSpiritOrigins, setShowSpiritOrigins] = useState(false);
  // eveningMode and setEveningMode come from GardenContext (Gardener resets on new day)

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const onStartFocus = (e) => {
      const { goal, title, minutes = 5 } = e?.detail ?? {};
      if (goal?.id) {
        setActiveSession({
          ...goal,
          sessionDurationMinutes: Math.max(1, Math.min(120, Number(minutes) || 5)),
          subtaskId: null,
        });
        setShowChat(false);
      } else if (title) {
        const id = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const newGoal = {
          id,
          type: 'routine',
          title: String(title).trim() || 'Tiny next step',
          estimatedMinutes: 5,
          totalMinutes: 0,
          createdAt: new Date().toISOString(),
        };
        addGoal(newGoal);
        setActiveSession({
          ...newGoal,
          sessionDurationMinutes: Math.max(1, Math.min(120, Number(minutes) || 5)),
          subtaskId: null,
        });
        setShowChat(false);
      }
    };
    const onToast = (e) => {
      const message = e?.detail?.message;
      if (message && typeof pushReward === 'function') {
        pushReward({ message, tone: 'moss', icon: '🌱', sound: null });
      }
    };
    window.addEventListener('kaizen:startFocus', onStartFocus);
    window.addEventListener('kaizen:toast', onToast);
    return () => {
      window.removeEventListener('kaizen:startFocus', onStartFocus);
      window.removeEventListener('kaizen:toast', onToast);
    };
  }, [addGoal, pushReward]);

  /** Show Spirit Origins when user data is loaded but no spirit config saved yet. */
  useEffect(() => {
    if (cloudSaveStatus !== 'loading' && !spiritConfig) {
      setShowSpiritOrigins(true);
    }
  }, [cloudSaveStatus, spiritConfig]);

  /** Trigger tour if fresh account (0 goals, 0 logs) or user clicked Replay Tour in settings. */
  useEffect(() => {
    if ((goals?.length ?? 0) === 0 && (logs?.length ?? 0) === 0 && !localStorage.getItem('hasSeenTour')) {
      setShowTour(true);
    }
  }, [goals?.length, logs?.length]);

  useEffect(() => {
    const check = () => setIsMobileNav(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /** Auto-nudge: after 8 PM, if still in 'none', show gentle "Check in?" toast once per day. */
  useEffect(() => {
    if (now.getHours() < 20 || eveningMode !== 'none') return;
    if (eveningNudgeShownRef.current === today) return;
    eveningNudgeShownRef.current = today;
    setShowEveningNudgeToast(true);
  }, [now, today, eveningMode]);

  /** Auto-open evening modal once per day around 20:00 when still in 'none'. */
  useEffect(() => {
    if (now.getHours() < 20 || eveningMode !== 'none') return;
    if (eveningModalAutoOpenedRef.current === today) return;
    eveningModalAutoOpenedRef.current = today;
    setShowEveningModal(true);
  }, [now, today, eveningMode]);

  /** In night-owl mode, keep user on focus-friendly tabs (hide Garden/Settings). */
  useEffect(() => {
    if (eveningMode === 'night-owl' && (activeTab === 'garden' || activeTab === 'settings')) {
      setActiveTab('focus');
    }
  }, [eveningMode, activeTab]);
  const [spiritInsight, setSpiritInsight] = useState(() => {
    const { lastInsight, lastInsightDate } = getStoredBriefing();
    const today = new Date().toISOString().slice(0, 10);
    return lastInsightDate === today ? lastInsight : null;
  });
  const [spiritThinking, setSpiritThinking] = useState(false);
  const hasShownSpiritRef = useRef(false);
  const hasFetchedInsightRef = useRef(false);

  /** Remove any time-slot assignment referencing this goal (avoids orphaned refs after delete). */
  const clearAssignmentsForGoal = useCallback((goalId) => {
    setAssignments((prev) => {
      const next = { ...prev };
      let changed = false;
      HOURS.forEach((hour) => {
        const a = next[hour];
        const gid = a && typeof a === 'object' && 'goalId' in a ? a.goalId : a;
        if (gid === goalId) {
          delete next[hour];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const handleCompostGoal = useCallback(
    (goal) => {
      const id = goal?.id ?? goal;
      deleteGoal(typeof id === 'string' ? id : goal.id);
      clearAssignmentsForGoal(typeof id === 'string' ? id : goal.id);
    },
    [deleteGoal, clearAssignmentsForGoal]
  );

  /** Auto-Fill Week: clear auto-generated routine blocks, fetch calendar events, run scheduler, fill today's slots. */
  const handleAutoFillWeek = useCallback(async () => {
    if (!googleToken && !msToken) {
      return;
    }
    setAutoFillLoading(true);
    try {
      const weekStart = getDefaultWeekStart();
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      setAssignments((prev) => {
        const next = { ...prev };
        HOURS.forEach((h) => {
          const a = next[h];
          if (a && typeof a === 'object' && a.type === 'routine' && a._autoGenerated) delete next[h];
        });
        return next;
      });

      const fetches = [];
      if (googleToken) fetches.push(fetchGoogleEvents(googleToken, weekStart, weekEnd).catch(() => []));
      if (msToken) fetches.push(fetchOutlookEvents(msToken, weekStart, weekEnd).catch(() => []));
      const results = await Promise.all(fetches);
      const allEvents = results.flat();
      updateWeeklyEvents(allEvents);
      const eventsForScheduler = allEvents;

      setAssignments((prev) => {
        const todayDayIndex = new Date().getDay();
        const buildExistingPlans = (assigns) => {
          const plans = [];
          HOURS.forEach((hour) => {
            if (!assigns[hour]) return;
            plans.push({
              dayIndex: todayDayIndex,
              start: hour,
              end: minutesToTime(timeToMinutes(hour) + 60),
            });
          });
          return plans;
        };

        let next = { ...prev };
        let existingPlans = buildExistingPlans(next);
        const options = { weekStartDate: weekStart, startHour: 6, endHour: 23 };
        let availableSlots = findAvailableSlots(eventsForScheduler, existingPlans, options);

        const routineGoals = (goals ?? []).filter((g) => g.type === 'routine');
        for (const goal of routineGoals) {
          const settings = goal.schedulerSettings ?? {};
          const blocks = settings.mode === 'solid'
            ? generateSolidSchedule(goal)
            : generateLiquidSchedule(goal, availableSlots);
          const todayBlocks = blocks.filter((b) => b.dayIndex === todayDayIndex);

          for (const block of todayBlocks) {
            let cursor = timeToMinutes(block.start);
            const endMins = timeToMinutes(block.end);
            while (cursor < endMins) {
              const hourStr = minutesToTime(cursor);
              if (!next[hourStr]) {
                next = {
                  ...next,
                  [hourStr]: {
                    id: crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    parentGoalId: goal.id,
                    title: goal.title,
                    type: 'routine',
                    duration: 60,
                    _autoGenerated: true,
                    ...(block.subtaskId && { subtaskId: block.subtaskId, subtaskTitle: block.subtaskTitle }),
                  },
                };
              }
              cursor += 60;
            }
          }
          existingPlans = buildExistingPlans(next);
          availableSlots = findAvailableSlots(eventsForScheduler, existingPlans, options);
        }
        return next;
      });
    } catch (e) {
      console.warn('Auto-Fill Week failed', e);
    } finally {
      setAutoFillLoading(false);
    }
  }, [googleToken, goals, updateWeeklyEvents]);

  const handlePlanWeek = useCallback(async () => {
    setPlanningWeek(true);
    try {
      const evts = Array.isArray(weeklyEvents) ? weeklyEvents : [];
      const energyProfile = { spoonCount: dailySpoonCount ?? 8 };
      const weekPlan = await generateWeeklyPlan(goals, evts, energyProfile);
      if (!weekPlan) {
        if (typeof pushReward === 'function') {
          pushReward({ message: 'Planning failed. Check API key (VITE_GEMINI_API_KEY) or try again later.', tone: 'slate', icon: '🔌', sound: null });
        }
        setPlanningWeek(false);
        return;
      }
      const materialized = materializeWeeklyPlan(weekPlan, goals, evts);
      setWeekPreview(materialized);
    } catch (e) {
      console.warn('Plan My Week failed', e);
      if (typeof pushReward === 'function') {
        pushReward({ message: 'Planning failed. Check API key or try again later.', tone: 'slate', icon: '🔌', sound: null });
      }
    } finally {
      setPlanningWeek(false);
    }
  }, [goals, weeklyEvents, dailySpoonCount, pushReward]);

  const handleConfirmWeekPlan = useCallback(async () => {
    if (!weekPreview) return;
    const saves = Object.entries(weekPreview).map(([dateStr, dayAssigns]) =>
      saveDayPlanForDate(dateStr, dayAssigns)
    );
    await Promise.all(saves);
    setWeekPreview(null);
  }, [weekPreview, saveDayPlanForDate]);

  const handleDiscardWeekPlan = useCallback(() => {
    setWeekPreview(null);
  }, []);

  const handlePlanMonth = useCallback(async () => {
    const now = new Date();
    const roadmap = await generateMonthlyPlan(goals, now.getMonth(), now.getFullYear());
    if (roadmap) {
      setMonthlyRoadmap(roadmap);
    } else if (typeof pushReward === 'function') {
      pushReward({ message: 'Monthly planning failed. Check API key (VITE_GEMINI_API_KEY) or try again later.', tone: 'slate', icon: '🔌', sound: null });
    }
  }, [goals, pushReward]);

  const handleGardenGoalClick = useCallback((goal) => {
    setSeedForMilestones(goal);
  }, []);

  const handleOpenGoalCreatorFromPalette = useCallback((title) => {
    setGoalCreatorInitialTitle(title || '');
    setIsPlanting(true);
    setCommandPaletteOpen(false);
  }, []);

  const handlePlantFromPalette = useCallback((nextAssignments) => {
    setAssignments(nextAssignments);
    setActiveTab('focus');
  }, []);

  const handleAddRoutineTime = useCallback(
    (goalId, deltaMinutes) => {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return;
      const current = goal.totalMinutes ?? 0;
      const next = current + deltaMinutes;
      if (next <= 0) updateGoalProgress(goalId, -current);
      else updateGoalProgress(goalId, deltaMinutes);
    },
    [goals, updateGoalProgress]
  );

  useEffect(() => {
    if (!fertilizerToast) return;
    const t = setTimeout(() => setFertilizerToast(false), 2000);
    return () => clearTimeout(t);
  }, [fertilizerToast]);

  useEffect(() => {
    if (!growthToast) return;
    const t = setTimeout(() => setGrowthToast(null), 3000);
    return () => clearTimeout(t);
  }, [growthToast]);

  useEffect(() => {
    if (!calendarConnectedToast) return;
    const t = setTimeout(() => setCalendarConnectedToast(false), 3000);
    return () => clearTimeout(t);
  }, [calendarConnectedToast]);

  const events = Array.isArray(weeklyEvents) ? weeklyEvents : [];
  const selectedDayEvents = events.filter((e) => e.dayIndex === jsDayFromMon0(selectedDate));
  const { weather, forecast } = getWeather(selectedDayEvents);

  const filledCount = useMemo(() => {
    return HOURS.filter((h) => {
      const a = assignments[h];
      const gid = a && typeof a === 'object' && 'goalId' in a ? a.goalId : a;
      return gid && goals.some((g) => g.id === gid);
    }).length;
  }, [assignments, goals]);

  const stormWarnings = useMemo(() => {
    const options = { weekStartDate: getDefaultWeekStart(), startHour: 6, endHour: 23 };
    return getStormWarnings(goals, events, options);
  }, [goals, events]);
  const todaySpoonCount =
    lastCheckInDate === today && typeof dailySpoonCount === 'number' && dailySpoonCount >= 1 && dailySpoonCount <= 12
      ? dailySpoonCount
      : null;
  const maxSlots =
    todaySpoonCount != null
      ? todaySpoonCount
      : Math.max(1, (MAX_SLOTS_BY_WEATHER[weather] ?? 6) + dailyEnergyModifier);
  const isOverloaded = filledCount > maxSlots;

  const spiritFallbackMessage = useMemo(
    () => getSpiritGreeting({ weather, isOverloaded, justFinishedSession }),
    [weather, isOverloaded, justFinishedSession]
  );

  const spiritMessage = justFinishedSession ? spiritFallbackMessage : (spiritInsight ?? spiritFallbackMessage);
  const [loadLightenedMessage, setLoadLightenedMessage] = useState(null);
  const [loadLightenedToast, setLoadLightenedToast] = useState(false);
  const [autoPlanMessage, setAutoPlanMessage] = useState(null);
  const [checkInReactionMessage, setCheckInReactionMessage] = useState(null);
  const displaySpiritMessage = checkInReactionMessage ?? loadLightenedMessage ?? autoPlanMessage ?? spiritMessage;

  useEffect(() => {
    if (hasShownSpiritRef.current) return;
    hasShownSpiritRef.current = true;
    setShowSpiritDialogue(true);
    const durationMs = 7000;
    const t = setTimeout(() => setShowSpiritDialogue(false), durationMs);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isOverloaded && activeTab === 'focus') {
      setShowSpiritDialogue(true);
    }
  }, [isOverloaded, activeTab]);

  const loadLightenedTimeoutRef = useRef(null);
  const loadLightenedToastRef = useRef(null);
  const handleLoadLightened = useCallback((removedItems) => {
    if (loadLightenedTimeoutRef.current) clearTimeout(loadLightenedTimeoutRef.current);
    if (loadLightenedToastRef.current) clearTimeout(loadLightenedToastRef.current);
    setLoadLightenedMessage("Good decision. The garden will wait.");
    setShowSpiritDialogue(true);
    setLoadLightenedToast(true);
    const removedCount = removedItems?.length ?? 0;
    const reward = buildReward({ type: 'LOAD_LIGHTENED', payload: { removedCount } });
    if (reward) pushReward(reward);
    loadLightenedToastRef.current = setTimeout(() => {
      loadLightenedToastRef.current = null;
      setLoadLightenedToast(false);
    }, 3000);
    loadLightenedTimeoutRef.current = setTimeout(() => {
      loadLightenedTimeoutRef.current = null;
      setLoadLightenedMessage(null);
      setShowSpiritDialogue(false);
    }, 5000);
  }, [pushReward]);

  const requestSpiritWisdom = useCallback(
    (forceFetch = false) => {
      const { lastInsightDate } = getStoredBriefing();
      const today = new Date().toISOString().slice(0, 10);
      const hasToday = lastInsightDate === today;
      if (!forceFetch && hasToday && spiritInsight) {
        setShowSpiritDialogue(true);
        setTimeout(() => setShowSpiritDialogue(false), 7000);
        return;
      }
      setShowSpiritDialogue(true);
      setSpiritThinking(true);
      generateSpiritInsight(logs ?? [], goals ?? [], events)
        .then((insight) => {
          if (insight) {
            setSpiritInsight(insight);
            setStoredBriefing(insight);
          } else if (typeof pushReward === 'function') {
            pushReward({ message: "Mochi couldn't connect. Check your API key in .env (VITE_GEMINI_API_KEY) and restart the dev server.", tone: 'slate', icon: '🔌', sound: null });
          }
          setSpiritThinking(false);
        })
        .catch(() => {
          setSpiritThinking(false);
          if (typeof pushReward === 'function') {
            pushReward({ message: "Mochi couldn't connect. Check VITE_GEMINI_API_KEY or try again later.", tone: 'slate', icon: '🔌', sound: null });
          }
        });
    },
    [logs, goals, events, spiritInsight, pushReward]
  );

  const WeatherIcon = weather === 'storm' ? StormIcon : weather === 'breeze' ? LeafIcon : SunIcon;
  const skyBg =
    weather === 'storm' ? 'bg-slate-50' : weather === 'sun' ? 'bg-amber-50' : 'bg-moss-100/40';

  const todayDayIndex = useMemo(
    () => new Date(today + 'T12:00:00').getDay(),
    [today]
  );
  const todayRitualItems = useMemo(
    () =>
      goals
        .filter((g) => getRitualForToday(g, todayDayIndex))
        .map((g) => ({ goal: g, ritualTitle: getRitualForToday(g, todayDayIndex)?.title ?? '' })),
    [goals, todayDayIndex]
  );
  const goalBank = useMemo(
    () => goals.filter((g) => !getRitualForToday(g, todayDayIndex)),
    [goals, todayDayIndex]
  );

  /** Today's planned tasks from assignments (unique goals) for Start Assist. */
  const todayTaskEntries = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const hour of HOURS) {
      const a = assignments[hour];
      if (!a) continue;
      const goalId = typeof a === 'string' ? a : (a?.goalId ?? a?.parentGoalId);
      if (!goalId || seen.has(goalId)) continue;
      seen.add(goalId);
      const goal = goals?.find((g) => g.id === goalId);
      if (goal) out.push({ goalId, goal });
    }
    return out;
  }, [assignments, goals]);

  /** Today plan items with hour for starter picker (prefer easiest / smallest first). */
  const todayPlanItemsWithHour = useMemo(() => {
    const out = [];
    for (const hour of HOURS) {
      const a = assignments[hour];
      if (!a) continue;
      const goalId = typeof a === 'string' ? a : (a?.goalId ?? a?.parentGoalId);
      const goal = goals?.find((g) => g.id === goalId);
      if (!goal) continue;
      const ritualTitle = typeof a === 'object' && a.ritualTitle ? a.ritualTitle : null;
      const subtaskId = typeof a === 'object' && a.subtaskId ? a.subtaskId : null;
      out.push({ hour, goalId, goal, ritualTitle, subtaskId });
    }
    return out;
  }, [assignments, goals]);

  /** Next up to 3 planned items for today (by slot time >= now, then first 3). */
  const nextUpItems = useMemo(() => {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const withMins = todayPlanItemsWithHour.map((item) => {
      const [h, m] = (item.hour || '06:00').split(':').map(Number);
      const slotMins = h * 60 + (m || 0);
      return { ...item, slotMins };
    });
    const sorted = [...withMins].sort((a, b) => a.slotMins - b.slotMins);
    const upcoming = sorted.filter((i) => i.slotMins >= nowMins);
    const rest = sorted.filter((i) => i.slotMins < nowMins);
    const ordered = upcoming.length > 0 ? [...upcoming, ...rest] : sorted;
    return ordered.slice(0, 3).map(({ hour, goalId, goal, ritualTitle, subtaskId }) => ({
      hour,
      goalId,
      goal,
      title: ritualTitle || goal?.title,
      estimatedMinutes: goal?.estimatedMinutes ?? 60,
      spoonCost: goal?.spoonCost ?? 1,
      subtaskId,
    }));
  }, [todayPlanItemsWithHour, now]);

  /** Garden Level: 1 = Seedling, 2 = Sprout (first task or 1 log), 3 = Bloom (5 tasks). */
  const gardenLevel = useMemo(() => {
    const logList = Array.isArray(logs) ? logs : [];
    const completedTasks = logList.length;
    if (completedTasks >= 5) return 3;
    if (completedTasks >= 1) return 2;
    return 1;
  }, [logs]);

  const isTabLocked = useCallback((tabId) => (TAB_LEVELS[tabId] ?? 1) > gardenLevel, [gardenLevel]);

  useEffect(() => {
    if (isTabLocked(activeTab)) setActiveTab('focus');
  }, [activeTab, gardenLevel, isTabLocked]);

  const LAST_OPEN_DATE_KEY = 'kaizen_last_open_date';
  const GENTLE_RESTART_DISMISSED_KEY = 'kaizen_gentle_restart_dismissed_date';
  const GENTLE_RESTART_LAST_COMPLETED_KEY = 'kaizen_gentle_restart_last_completed';

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const today = localISODate();
    let lastOpen = null;
    try {
      lastOpen = localStorage.getItem(LAST_OPEN_DATE_KEY);
    } catch (_) {}
    if (!lastOpen) {
      try {
        localStorage.setItem(LAST_OPEN_DATE_KEY, today);
      } catch (_) {}
      return;
    }
    const dismissed = localStorage.getItem(GENTLE_RESTART_DISMISSED_KEY);
    const diff = diffDays(today, lastOpen);
    if (diff >= 3 && dismissed !== today) {
      gentleRestartGapDaysRef.current = diff;
      setShowGentleRestart(true);
    } else {
      try {
        localStorage.setItem(LAST_OPEN_DATE_KEY, today);
      } catch (_) {}
    }
  }, [hydrated]);

  const handleGentleRestartFreshStart = useCallback(() => {
    gentleResetToToday({ gapDays: gentleRestartGapDaysRef.current });
    try {
      localStorage.setItem(LAST_OPEN_DATE_KEY, localISODate());
      localStorage.setItem(GENTLE_RESTART_LAST_COMPLETED_KEY, localISODate());
    } catch (_) {}
    setShowGentleRestart(false);
  }, [gentleResetToToday]);

  const handleGentleRestartReviewCompost = useCallback(() => {
    try {
      localStorage.setItem(LAST_OPEN_DATE_KEY, localISODate());
    } catch (_) {}
    setShowGentleRestart(false);
    setShowCompost(true);
  }, []);

  const handleGentleRestartDismiss = useCallback(() => {
    try {
      localStorage.setItem(GENTLE_RESTART_DISMISSED_KEY, localISODate());
      localStorage.setItem(LAST_OPEN_DATE_KEY, localISODate());
    } catch (_) {}
    setShowGentleRestart(false);
  }, []);

  useEffect(() => {
    if (!hydrated || hasRunArchiveStaleRef.current) return;
    hasRunArchiveStaleRef.current = true;
    archiveStalePlanItems({ olderThanDays: 1 })
      .then((count) => {
        if (count > 0) {
          setStaleArchivedCount(count);
          pushReward({ message: `Kept today light — moved ${count} older item${count === 1 ? '' : 's'} to compost.`, tone: 'moss', icon: '♻️', sound: null });
        }
      })
      .catch(() => {});
  }, [hydrated, archiveStalePlanItems, pushReward]);

  const handleDismissStaleBanner = useCallback(() => setStaleArchivedCount(0), []);

  const handleSaveSeed = (goal) => {
    addGoal(goal);
    setIsPlanting(false);
  };

  const handleProjectGoals = useCallback((goalsToCreate) => {
    goalsToCreate.forEach((g) => addGoal(g));
  }, [addGoal]);

  const handleStartSession = (goalId, hour, ritualTitle, subtaskId) => {
    const goal = goals.find((g) => g.id === goalId);
    if (goal) setSessionConfigTarget({ goal: { ...goal }, hour, ritualTitle: ritualTitle ?? null, subtaskId: subtaskId ?? null });
  };

  /** Mochi picks a random low-effort task from the Seed Bag and opens Configure Session for 15 minutes. */
  const handleMochiPickForMe = useCallback(() => {
    const lowEffort = (g) => (g?.estimatedMinutes ?? 60) <= 30;
    const ritualCandidates = todayRitualItems.filter(({ goal }) => lowEffort(goal)).map(({ goal, ritualTitle }) => ({ goal, ritualTitle: ritualTitle ?? goal.title }));
    const bankCandidates = goalBank.filter(lowEffort).map((goal) => ({ goal, ritualTitle: null }));
    const all = [...ritualCandidates, ...bankCandidates];
    if (all.length === 0) return;
    const pick = all[Math.floor(Math.random() * all.length)];
    setConfigDurationMinutes(15);
    setConfigDurationCustom(false);
    setSessionConfigTarget({
      goal: { ...pick.goal },
      hour: null,
      ritualTitle: pick.ritualTitle ?? pick.goal.title,
      subtaskId: null,
    });
  }, [todayRitualItems, goalBank]);

  const handleOpenStartAssist = useCallback(() => {
    const candidate = pickStarterTask({ todayTasks: todayTaskEntries });
    if (candidate) {
      setStartAssistSuggestedTask(candidate);
      setStartAssistNoTasks(false);
    } else {
      setStartAssistSuggestedTask(null);
      setStartAssistNoTasks(true);
    }
    setShowStartAssistModal(true);
  }, [todayTaskEntries]);

  /** Primary CTA: "Help me start (5 min)". Opens StartNowModal with best task or 3 suggestions. */
  const handleHelpMeStart5Min = useCallback(() => {
    const candidate = pickStarterTask({ items: todayPlanItemsWithHour });
    if (candidate?.goal) {
      setStartNowCandidate(candidate);
      setShowStartNowModal(true);
    } else {
      setStartNowCandidate(null);
      setShowStartNowModal(true);
    }
  }, [todayPlanItemsWithHour]);

  const handleStartNowStart = useCallback((taskOrCandidate, durationMinutes) => {
    const mins = Math.max(1, Math.min(120, durationMinutes ?? 5));
    const goal = taskOrCandidate?.goal ?? taskOrCandidate;
    const subtaskId = taskOrCandidate?.subtaskId ?? goal?.subtaskId ?? null;
    if (!goal?.id) return;
    setActiveSession({
      ...goal,
      sessionDurationMinutes: mins,
      subtaskId,
    });
    setShowStartNowModal(false);
    setStartNowCandidate(null);
  }, []);

  const handleStartNowPickDifferent = useCallback(() => {
    setShowStartNowModal(false);
    setStartNowCandidate(null);
    setScheduleExpanded(true);
  }, []);

  const handleStartNowCreateSuggestion = useCallback((key) => {
    const STARTER_TITLES = { 'life-admin': 'One tiny life-admin thing', personal: 'One personal goal step', care: 'One care task' };
    const title = STARTER_TITLES[key] ?? 'One tiny step';
    const id = crypto.randomUUID?.() ?? `goal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newGoal = { id, type: 'routine', title, estimatedMinutes: 5, totalMinutes: 0, createdAt: new Date().toISOString() };
    addGoal(newGoal);
    const firstEmpty = HOURS.find((h) => !assignments[h]);
    if (firstEmpty) setAssignments((prev) => ({ ...prev, [firstEmpty]: id }));
    setActiveSession({ ...newGoal, sessionDurationMinutes: 5, subtaskId: null });
    setShowStartNowModal(false);
    setStartNowCandidate(null);
  }, [addGoal, assignments, setAssignments]);

  const handleStartAssistStart = useCallback((durationMinutes, task) => {
    if (!task) return;
    setActiveSession({
      ...task,
      sessionDurationMinutes: Math.max(1, Math.min(120, durationMinutes)),
      subtaskId: null,
    });
    setShowStartAssistModal(false);
    setStartAssistSuggestedTask(null);
    setStartAssistNoTasks(false);
  }, []);

  const handleStartAssistClose = useCallback(() => {
    setShowStartAssistModal(false);
    setStartAssistSuggestedTask(null);
    setStartAssistNoTasks(false);
    pushReward({ message: 'No worries — starting is the hard part.', tone: 'slate', icon: '🌿', sound: null });
  }, [pushReward]);

  const STARTER_TITLES = {
    'life-admin': 'One tiny life-admin thing',
    personal: 'One personal goal step',
    care: 'One care task',
  };

  const handleStartAssistChooseSuggestion = useCallback((key) => {
    const title = STARTER_TITLES[key] ?? 'One tiny step';
    const id = crypto.randomUUID?.() ?? `goal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newGoal = {
      id,
      type: 'routine',
      title,
      estimatedMinutes: 5,
      totalMinutes: 0,
      createdAt: new Date().toISOString(),
    };
    addGoal(newGoal);
    const firstEmpty = HOURS.find((h) => !assignments[h]);
    if (firstEmpty) setAssignments((prev) => ({ ...prev, [firstEmpty]: id }));
    setActiveSession({
      ...newGoal,
      sessionDurationMinutes: 5,
      subtaskId: null,
    });
    setShowStartAssistModal(false);
    setStartAssistSuggestedTask(null);
    setStartAssistNoTasks(false);
  }, [addGoal, assignments, setAssignments]);

  /** Guided empty state: add starter suggestion to plan and start 5 min focus. */
  const handleGuidedSuggestion = useCallback((key) => {
    handleStartAssistChooseSuggestion(key);
  }, [handleStartAssistChooseSuggestion]);

  /** Guided empty state: pick a goal for this week — assign to first slot and start 5 min. */
  const handleGuidedPickGoal = useCallback((goal) => {
    if (!goal?.id) return;
    const firstEmpty = HOURS.find((h) => !assignments[h]);
    if (firstEmpty) setAssignments((prev) => ({ ...prev, [firstEmpty]: goal.id }));
    setActiveSession({
      ...goal,
      sessionDurationMinutes: 5,
      subtaskId: null,
    });
  }, [assignments, setAssignments]);

  const handleEveningWindDownClose = useCallback(() => {
    setShowEveningModal(false);
  }, []);

  const SESSION_DURATIONS = [
    { minutes: 25, label: 'Pomodoro (25m)', emoji: '🍅' },
    { minutes: 50, label: 'Deep Focus (50m)', emoji: '🧠' },
    { minutes: 15, label: 'Blitz (15m)', emoji: '⚡' },
  ];

  const handleEnterMonkMode = (sessionDurationMinutes) => {
    if (!sessionConfigTarget?.goal) return;
    setActiveSession({
      ...sessionConfigTarget.goal,
      sessionDurationMinutes: Math.max(1, Math.min(120, sessionDurationMinutes)),
      subtaskId: sessionConfigTarget.subtaskId ?? null,
    });
    setSessionConfigTarget(null);
  };

  const handleSessionComplete = (payload) => {
    setCompletedTask({ ...activeSession, timeSpentMinutes: payload?.timeSpentMinutes });
    setShowTeaCeremony(true);
    setActiveSession(null);
  };

  const handleTeaComplete = (log) => {
    const durationMinutes = completedTask?.timeSpentMinutes ?? (log?.minutes != null ? Number(log.minutes) : 25);
    const taskId = completedTask?.id ?? log?.taskId;
    const goalTitle = completedTask?.title ?? goals.find((g) => g.id === taskId)?.title ?? 'Goal';
    if (taskId) {
      updateGoalProgress(taskId, durationMinutes);
      const subtaskId = completedTask?.subtaskId ?? log?.subtaskId;
      if (subtaskId) {
        updateSubtaskProgress(taskId, subtaskId, durationMinutes / 60);
      }
      setGrowthToast(`Your ${goalTitle} has grown.`);
    }
    addLog({
      taskId: completedTask?.id ?? log?.taskId,
      taskTitle: goalTitle,
      rating: log?.rating ?? null,
      note: log?.note ?? '',
      date: new Date(),
      minutes: durationMinutes,
    });
    // Compost redemption: consume 1 nutrient for +2 embers if available
    if (soilNutrients > 0 && consumeSoilNutrients(1)) {
      earnEmbers(2);
      pushReward({ message: 'Compost paid off: +2 Embers', tone: 'moss', icon: '♻️✨', durationMs: 2800 });
    }
    const focusReward = buildReward({
      type: 'FOCUS_COMPLETE',
      payload: { goalTitle, minutes: durationMinutes, spoonCount: todaySpoonCount ?? dailySpoonCount },
    });
    if (focusReward) {
      if (focusReward.variableBonus?.embers) earnEmbers(focusReward.variableBonus.embers);
      pushReward(focusReward);
    }
    // Embers are awarded in TeaCeremony (1 per minute) before onComplete
    setShowTeaCeremony(false);
    setJustFinishedSession(true);
    setShowSpiritDialogue(true);
    setTimeout(() => {
      setShowSpiritDialogue(false);
      setJustFinishedSession(false);
    }, 5000);

    // Post-session metric prompt
    const goal = goals.find((g) => g.id === taskId);
    if (goal) {
      if (goal.linkedVitalityGoalId) {
        const vg = goals.find((g2) => g2.id === goal.linkedVitalityGoalId);
        if (vg) {
          setMetricPrompt({ goalId: goal.id, metricName: vg.title, unit: vg.metricSettings?.unit ?? '', vitalityGoalId: vg.id });
          setMetricPromptValue('');
        }
      } else if (Array.isArray(goal.linkedMetrics) && goal.linkedMetrics.length > 0) {
        const first = goal.linkedMetrics[0];
        setMetricPrompt({ goalId: goal.id, metricName: first.name, unit: first.unit ?? '' });
        setMetricPromptValue('');
      }
    }
  };

  /** Chain: User finishes SpiritOrigins → close it → show Tour so Spirit explains the Compass. */
  const handleSpiritBorn = () => {
    setShowSpiritOrigins(false);
    setTimeout(() => setShowTour(true), 300);
  };

  const handleSpiritSkip = () => {
    setSpiritConfig({ name: 'Mochi', type: 'mochi' });
    setShowSpiritOrigins(false);
  };

  const handleMilestoneCheck = (goalId, milestoneId, completed) => {
    updateGoalMilestone(goalId, milestoneId, completed);
    if (completed) {
      setFertilizerToast(true);
      const goal = goals.find((g) => g.id === goalId);
      const milestoneTitle = goal?.milestones?.find((m) => m.id === milestoneId)?.title ?? '';
      const reward = buildReward({ type: 'MILESTONE_COMPLETE', payload: { milestoneTitle } });
      if (reward) pushReward(reward);
    }
  };

  if (showTeaCeremony) {
    const completedGoal = completedTask?.id ? goals?.find((g) => g.id === completedTask.id) : null;
    const vineOptions = completedGoal?.subtasks ?? [];
    return (
      <TeaCeremony
        task={completedTask}
        subtasks={vineOptions}
        onComplete={handleTeaComplete}
      />
    );
  }

  if (activeSession) {
    const durationSeconds = (activeSession.sessionDurationMinutes ?? 25) * 60;
    return (
      <FocusSession
        activeTask={activeSession}
        durationSeconds={durationSeconds}
        onComplete={handleSessionComplete}
        onExit={() => setActiveSession(null)}
      />
    );
  }

  return (
    <>
      <AnimatePresence>
        {showSpiritOrigins && (
          <div className="fixed inset-0 z-50 overflow-auto">
            <SpiritOrigins onComplete={handleSpiritBorn} onSkip={handleSpiritSkip} />
          </div>
        )}
      </AnimatePresence>

      {/* Sleep Mode Overlay */}
      {eveningMode === 'sleep' && (
        <div className="fixed inset-0 z-[60] bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="font-serif text-3xl text-slate-200 mb-4">The Garden is Resting</h2>
          <p className="text-slate-400 mb-8 max-w-md">You've done enough for today. Rest ensures growth tomorrow.</p>
          <button
            type="button"
            onClick={() => setEveningMode('none')}
            className="px-6 py-2 rounded-full border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors text-sm"
          >
            I need to wake up (Emergency)
          </button>
        </div>
      )}

      <AnimatePresence>
        {needsMorningCheckIn && showMorningCheckInModal && (
          <MorningCheckIn
            goals={goals}
            logMetric={logMetric}
            yesterdayPlan={yesterdayPlan}
            onDismiss={() => setShowMorningCheckInModal(false)}
            onComplete={(modifier, spoonCount) => {
              completeMorningCheckIn(spoonCount);
              requestSpiritWisdom(false);
              const hasAnyAssignment = HOURS.some((h) => assignments[h]);
              let planSummary = null;
              if (!hasAnyAssignment) {
                const plan = generateDailyPlan(goals, spoonCount);
                setAssignments(plan);
                planSummary = { slotCount: Object.keys(plan).length };
              }
              const reaction = getPlanReaction(spoonCount, planSummary);
              setCheckInReactionMessage(reaction);
              setShowSpiritDialogue(true);
              setTimeout(() => {
                setCheckInReactionMessage(null);
                setShowSpiritDialogue(false);
              }, 6000);
            }}
          />
        )}
      </AnimatePresence>
      <EveningWindDown
        open={showEveningModal}
        onClose={handleEveningWindDownClose}
        assignments={assignments}
        goals={goals}
        onUpdateAssignments={setAssignments}
        onAddLog={addLog}
        setEveningMode={setEveningMode}
      />
    <div
        className={`min-h-screen flex flex-col transition-colors ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-stone-50'}`}
      >
      <header
        className={`border-b transition-colors ${
          isDark ? 'border-slate-700 bg-slate-800/80' : `border-stone-200 ${skyBg}`
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Left: Date • Weather • Sync status */}
          <div className={`flex flex-wrap items-center gap-2 font-sans text-sm ${isDark ? 'text-slate-300' : 'text-stone-600'}`}>
            <p className={`font-serif text-xl md:text-2xl mr-1 ${isDark ? 'text-slate-100' : 'text-stone-900'}`}>
              {new Date(today + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <span className="hidden sm:inline opacity-50 select-none" aria-hidden>|</span>
            <div className="flex items-center gap-1.5">
              <WeatherIcon />
              <span>{forecast}</span>
            </div>
            <span className="hidden sm:inline opacity-50 select-none" aria-hidden>•</span>
            {!isOnline ? (
              <span className="flex items-center gap-1 font-sans text-xs text-stone-500 bg-stone-200/80 px-2 py-1 rounded-full" title="Offline">Offline</span>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCalendarMenu((v) => !v)}
                  className={`flex items-center gap-1.5 py-1 px-2.5 rounded-full font-sans text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                    googleUser || msUser
                      ? 'text-moss-700 hover:bg-moss-100/60'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                  }`}
                  aria-label="Calendar sync options"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                    {(googleUser || msUser) && <path d="M9 12l2 2 4-4" />}
                  </svg>
                  <span className="hidden md:inline">{googleUser || msUser ? 'Synced' : 'Sync'}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {showCalendarMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCalendarMenu(false)} />
                    <div className="absolute top-full mt-1 right-0 z-50 w-56 rounded-xl bg-white border border-stone-200 shadow-lg overflow-hidden">
                      <div className="px-3 py-2 bg-stone-50 border-b border-stone-100">
                        <p className="font-sans text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Calendar Sync</p>
                      </div>
                      <div className="py-1">
                        {/* Google Calendar */}
                        {googleUser ? (
                          <button type="button" onClick={() => { if (window.confirm('Disconnect Google Calendar?')) { disconnectCalendar(); setShowCalendarMenu(false); } }} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors">
                            <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[11px] font-bold text-red-600 shrink-0">G</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-sans text-sm text-stone-800 block">Google Calendar</span>
                              <span className="font-sans text-[10px] text-moss-600 truncate block">{googleUser.email || 'Connected'}</span>
                            </div>
                            <span className="shrink-0 w-2 h-2 rounded-full bg-moss-500" title="Connected" />
                          </button>
                        ) : (
                          <button type="button" onClick={async () => { const ok = await connectCalendar(); if (ok) { setCalendarConnectedToast(true); setShowCalendarMenu(false); } }} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors">
                            <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-[11px] font-bold text-stone-500 shrink-0">G</span>
                            <span className="font-sans text-sm text-stone-600">Connect Google</span>
                          </button>
                        )}
                        {/* Outlook */}
                        {msUser ? (
                          <button type="button" onClick={() => { if (window.confirm('Disconnect Outlook?')) { disconnectOutlook(); setShowCalendarMenu(false); } }} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors">
                            <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[11px] font-bold text-blue-600 shrink-0">O</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-sans text-sm text-stone-800 block">Outlook</span>
                              <span className="font-sans text-[10px] text-moss-600 truncate block">{msUser.username || 'Connected'}</span>
                            </div>
                            <span className="shrink-0 w-2 h-2 rounded-full bg-moss-500" title="Connected" />
                          </button>
                        ) : (
                          <>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const result = await connectOutlook();
                                if (result?.ok) {
                                  setCalendarConnectedToast(true);
                                  setShowCalendarMenu(false);
                                  return;
                                }
                                const err = result?.error || 'Connection failed';
                                const hint = typeof window !== 'undefined' && window.location?.origin
                                  ? '\n\nRedirect URI to add in Azure: ' + window.location.origin
                                  : '';
                                window.alert(err + hint);
                              } catch (e) {
                                const err = e?.message || String(e);
                                const hint = typeof window !== 'undefined' && window.location?.origin
                                  ? '\n\nRedirect URI to add in Azure: ' + window.location.origin
                                  : '';
                                window.alert(err + hint);
                              }
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors"
                          >
                            <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-[11px] font-bold text-stone-500 shrink-0">O</span>
                            <span className="font-sans text-sm text-stone-600">Connect Outlook</span>
                          </button>
                          <p className="px-3 py-1.5 font-sans text-[10px] text-stone-400 border-t border-stone-100">
                            Requires Azure app: add <code className="bg-stone-100 px-1 rounded">VITE_MS_CLIENT_ID</code> to .env and set SPA redirect URI to <span className="break-all">{typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'your app URL'}</span>
                          </p>
                          </>
                        )}
                        {/* .ics Import */}
                        <button type="button" onClick={async () => { try { const imported = await importICSFile(); if (imported.length > 0) { updateWeeklyEvents([...events, ...imported]); setCalendarConnectedToast(true); } } catch (e) { console.warn('ICS import failed', e); } setShowCalendarMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors">
                          <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-[11px] shrink-0">+</span>
                          <div className="flex-1 min-w-0">
                            <span className="font-sans text-sm text-stone-600 block">Import .ics file</span>
                            <span className="font-sans text-[10px] text-stone-400">Apple Calendar, Thunderbird, etc.</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {isOnline && (googleUser || msUser) && cloudSaveStatus === 'saved' && (
              <>
                <span className="hidden sm:inline opacity-50 select-none" aria-hidden>•</span>
                <span
                  className="flex items-center gap-1 font-sans text-xs text-moss-600"
                  title="Saved to cloud"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <span className="hidden md:inline">Saved</span>
                </span>
              </>
            )}
          </div>

          {/* Right: Toolbelt – Chat, Inbox, Mirror, Evening, Settings */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              id="tour-wisdom"
              type="button"
              onClick={() => setShowChat(true)}
              className={`flex items-center gap-2 min-h-[44px] min-w-[44px] py-2 pl-2 pr-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                isDark
                  ? 'bg-moss-900/40 text-moss-200 hover:bg-moss-800/50'
                  : 'bg-moss-100/80 text-moss-800 hover:bg-moss-200/80'
              }`}
              aria-label="Chat with Mochi"
              title="Chat"
            >
              <span className="inline-flex w-7 h-8 items-center justify-center [&_svg]:w-7 [&_svg]:h-8" aria-hidden>
                <MochiSpirit />
              </span>
              <span className="hidden lg:inline text-xs font-medium">Chat</span>
            </button>
            <div className="flex items-center gap-1">
              <button
                id="tour-compost"
                type="button"
                onClick={() => setShowCompost(true)}
                className={`flex items-center gap-2 min-h-[44px] min-w-[44px] py-2 pl-2 pr-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                  isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
                aria-label="Compost Heap"
                title="Compost Heap"
              >
                <span className="text-lg leading-none" aria-hidden>🍂</span>
                <span className="hidden lg:inline text-xs font-medium">Compost</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowSpiritMirror(true)}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/60'
              }`}
              aria-label="Customize Spirit (Mirror)"
              title="Mirror"
            >
              <MirrorIcon />
            </button>
            <button
              type="button"
              onClick={() => setDarkModeOverride(!isDark)}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                isDark ? 'text-indigo-300 hover:text-indigo-200 hover:bg-slate-700/60' : 'text-stone-500 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
              aria-label="Dark mode"
              title="Toggle dark mode"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
            {eveningMode !== 'night-owl' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAccessibilityModal(true)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                  aria-label="Accessibility & Comfort"
                  title="Accessibility & Comfort"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v4M12 14h.01M9 9l2 2-2 2" />
                  </svg>
                </button>
                <button
                  id="tour-settings"
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                  aria-label="Settings"
                  title="Settings"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowTour(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-200/60 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
              aria-label="Replay tour"
              title="Replay tour"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {!isMobileNav && (
        <nav className={`border-b ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-stone-200 bg-stone-50'}`}>
          <div className="max-w-4xl mx-auto px-4 flex gap-8">
            {[
              { id: 'focus', label: 'Today' },
              { id: 'horizons', label: 'Horizons' },
              { id: 'garden', label: 'My Garden' },
              { id: 'journal', label: 'Journal' },
              { id: 'insights', label: 'Insights' },
              { id: 'settings', label: 'Settings' },
            ]
              .filter(({ id }) => eveningMode !== 'night-owl' || (id !== 'garden' && id !== 'settings'))
              .map(({ id, label }) => {
                const locked = isTabLocked(id);
                return (
                  <button
                    key={id}
                    id={id === 'garden' ? 'tour-garden-tab' : id === 'journal' ? 'tour-journal-tab' : undefined}
                    type="button"
                    onClick={() => {
                      if (locked) {
                        setLockedTabToast(LOCKED_TAB_TOAST);
                        setTimeout(() => setLockedTabToast(null), 3000);
                      } else {
                        setActiveTab(id);
                      }
                    }}
                    className={`relative py-4 font-sans font-medium focus:outline-none focus:ring-2 focus:ring-moss-500/30 rounded flex items-center gap-1.5 ${
                      locked
                        ? isDark ? 'text-slate-500 cursor-default' : 'text-stone-400 cursor-default'
                        : isDark
                          ? activeTab === id ? 'text-slate-100' : 'text-slate-400 hover:text-slate-200'
                          : activeTab === id ? 'text-stone-900' : 'text-stone-600 hover:text-stone-800'
                    }`}
                  >
                    {locked && <span className="shrink-0 opacity-70" aria-hidden>🔒</span>}
                    {label}
                    {activeTab === id && !locked && (
                      <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${isDark ? 'bg-slate-400' : 'bg-stone-400'}`} />
                    )}
                  </button>
                );
              })}
          </div>
        </nav>
      )}

      {isMobileNav && (
        <nav className={`fixed bottom-0 left-0 right-0 z-50 border-t safe-area-pb ${isDark ? 'border-slate-700 bg-slate-800/95' : 'border-stone-200 bg-stone-50'}`}>
          <div className="max-w-4xl mx-auto px-2 flex justify-around py-2">
            {[
              { id: 'focus', label: 'Today', icon: '🎯' },
              { id: 'horizons', label: 'Horizons', icon: '🔭' },
              { id: 'garden', label: 'Garden', icon: '🌱' },
              { id: 'journal', label: 'Journal', icon: '📔' },
            ]
              .filter(({ id }) => eveningMode !== 'night-owl' || (id !== 'garden' && id !== 'settings'))
              .map(({ id, label, icon }) => {
                const locked = isTabLocked(id);
                return (
                  <button
                    key={id}
                    id={id === 'garden' ? 'tour-garden-tab' : id === 'journal' ? 'tour-journal-tab' : undefined}
                    type="button"
                    onClick={() => {
                      if (locked) {
                        setLockedTabToast(LOCKED_TAB_TOAST);
                        setTimeout(() => setLockedTabToast(null), 3000);
                      } else {
                        setActiveTab(id);
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-2 px-3 rounded-lg font-sans text-xs focus:outline-none focus:ring-2 focus:ring-moss-500/30 relative ${
                      locked
                        ? 'text-stone-400 opacity-70 cursor-default'
                        : isDark
                          ? activeTab === id ? 'text-indigo-200 bg-slate-700' : 'text-slate-400'
                          : activeTab === id ? 'text-moss-700 bg-moss-100' : 'text-stone-600'
                    }`}
                    aria-label={locked ? `${label} (locked)` : label}
                  >
                    {locked ? (
                      <span className="flex items-center justify-center w-6 h-6" aria-hidden>🔒</span>
                    ) : (
                      <span className="text-lg leading-none" aria-hidden>{icon}</span>
                    )}
                    <span>{label}</span>
                  </button>
                );
              })}
          </div>
        </nav>
      )}

      <main className={`flex-1 w-full min-w-0 px-4 py-8 max-w-5xl mx-auto relative ${isMobileNav ? 'pb-20' : ''}`}>
        {showSpiritDialogue && (
          <div className="flex justify-center py-4 mb-2">
            <MochiSpiritWithDialogue
              message={displaySpiritMessage}
              showBubble
              isThinking={spiritThinking}
            />
          </div>
        )}
        {activeTab === 'focus' && (
          <>
            <div className="mb-6 flex gap-3">
              <button
                type="button"
                onClick={() => setIsPlanting(true)}
                className="flex-1 py-3 px-4 rounded-xl bg-moss-600 text-white font-sans font-medium hover:bg-moss-700 transition-colors flex items-center justify-center gap-2 shadow-sm shadow-moss-900/20"
              >
                <span className="text-xl">🌱</span> Plant a New Seed
              </button>
              <button
                type="button"
                onClick={() => setShowProjectPlanner(true)}
                className="py-3 px-4 rounded-xl bg-stone-100 text-stone-700 font-sans font-medium hover:bg-stone-200 transition-colors flex items-center justify-center gap-2 border border-stone-200"
              >
                <span className="text-xl">📋</span> Plan Project
              </button>
            </div>
            {needsMorningCheckIn ? (
              <div className="mb-4">
                <GuidedEmptyState
                  variant="needEnergy"
                  onSetSpoons={() => setShowMorningCheckInModal(true)}
                  lowStim={getSettings().lowStim}
                />
              </div>
            ) : (
              <>
                {todayTaskEntries.length === 0 && (
                  <div className="mb-4 space-y-4">
                    <GuidedEmptyState
                      variant="noTasks"
                      onPickSuggestion={handleGuidedSuggestion}
                      onStartFiveMin={handleGuidedSuggestion}
                      lowStim={getSettings().lowStim}
                    />
                    {goals.length > 0 && (
                      <GuidedEmptyState
                        variant="noGoals"
                        goals={goals}
                        onPickGoal={handleGuidedPickGoal}
                        lowStim={getSettings().lowStim}
                      />
                    )}
                  </div>
                )}
                {(compost?.length ?? 0) === 0 && (
                  <div className="mb-4">
                    <GuidedEmptyState variant="noCompost" lowStim={getSettings().lowStim} />
                  </div>
                )}
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleHelpMeStart5Min}
                    className="w-full py-4 px-4 rounded-xl border-2 border-moss-500 bg-moss-600 text-stone-50 font-sans font-medium hover:border-moss-600 hover:bg-moss-700 transition-colors flex flex-col items-center gap-1 shadow-sm focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2"
                    aria-label="Help me start a 5 minute focus session"
                  >
                    <span className="text-base">Help me start (5 min)</span>
                    <span className="text-sm font-normal text-moss-100">One tiny step. That&apos;s enough.</span>
                  </button>
                </div>
                {staleArchivedCount > 0 && (
              <div className="mb-4 p-3 rounded-xl border border-moss-200 bg-moss-50/80 font-sans text-sm text-stone-700 flex flex-wrap items-center justify-between gap-2">
                <span>Some items were archived. Review them in compost if you like.</span>
                <span className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setShowCompost(true); handleDismissStaleBanner(); }}
                    className="text-moss-700 font-medium hover:text-moss-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-moss-500 rounded"
                  >
                    Review compost
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissStaleBanner}
                    className="text-stone-400 hover:text-stone-600 focus:outline-none focus:ring-2 focus:ring-moss-500 rounded"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
            {isMobileNav && (
              <div id="tour-compass" className="mb-4">
                <CompassWidget
                  assignments={assignments}
                  goals={goals}
                  now={now}
                  weather={weather}
                  onStartFocus={(assignment, slotKey) => {
                    const goalId = typeof assignment === 'object' ? (assignment.parentGoalId ?? assignment.goalId) : assignment;
                    const ritualTitle = typeof assignment === 'object' ? assignment.ritualTitle : null;
                    const subtaskId = typeof assignment === 'object' ? assignment.subtaskId : null;
                    if (goalId) handleStartSession(goalId, slotKey, ritualTitle ?? undefined, subtaskId ?? undefined);
                  }}
                  onPlantHere={() => {}}
                />
              </div>
            )}
            {stormWarnings.length > 0 && (
              <div className="mb-4 p-4 rounded-xl border-2 border-amber-300 bg-amber-50 font-sans text-sm text-amber-900" role="alert">
                <p className="font-medium flex items-center gap-2">
                  <span aria-hidden>⛈️</span>
                  {getSettings().gentleMode ? 'Heads up — a lot on today' : 'Storm Warning'}
                </p>
                <ul className="mt-2 list-disc list-inside space-y-1 text-amber-800">
                  {stormWarnings.map((w, i) => (
                    <li key={w.subtaskId ?? i}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mb-4">
              <button
                type="button"
                onClick={handleMochiPickForMe}
                className="w-full py-4 px-4 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-800 font-sans font-medium hover:border-amber-400 hover:bg-amber-100 transition-colors flex items-center justify-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                aria-label="Mochi picks a random low-effort task and opens a 15-minute session"
              >
                <span className="text-lg">✨</span>
                <span>Mochi, pick for me</span>
              </button>
            </div>
            {!scheduleExpanded ? (
              <div className="mb-4 space-y-3">
                <h3 className="font-serif text-stone-800 text-base">Next up</h3>
                {nextUpItems.length === 0 ? (
                  <p className="font-sans text-sm text-stone-500 py-2">Nothing planned yet. Expand the schedule to add tasks.</p>
                ) : (
                  <ul className="space-y-2" aria-label="Next up tasks">
                    {nextUpItems.map((item) => (
                      <li key={`${item.hour}-${item.goalId}`} className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-stone-200 bg-white/80">
                        <div className="min-w-0 flex-1">
                          <span className="font-sans text-sm font-medium text-stone-900 block truncate">{item.title}</span>
                          <span className="font-sans text-xs text-stone-500">
                            {item.estimatedMinutes}m{item.spoonCost != null && item.spoonCost > 0 ? ` · ${item.spoonCost} spoon${item.spoonCost !== 1 ? 's' : ''}` : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStartNowStart({ goal: item.goal, goalId: item.goalId, subtaskId: item.subtaskId }, 5)}
                          className="shrink-0 px-3 py-1.5 rounded-lg font-sans text-xs font-medium bg-moss-600 text-stone-50 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                        >
                          Start 5 min
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setScheduleExpanded(true)}
                    className="px-3 py-2 rounded-lg font-sans text-sm font-medium border-2 border-moss-400 bg-moss-50 text-moss-800 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                  >
                    Expand schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScheduleExpanded(true); setTimeout(() => document.getElementById('tour-timeline')?.scrollIntoView?.({ behavior: 'smooth' }), 100); }}
                    className="font-sans text-sm text-stone-500 hover:text-stone-700 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-moss-500/50 rounded"
                  >
                    Plan my day
                  </button>
                </div>
              </div>
            ) : (
              <div id="tour-timeline" className="mb-4 min-w-0">
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={() => setScheduleExpanded(false)}
                    className="px-3 py-1.5 rounded-lg font-sans text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                  >
                    Collapse schedule
                  </button>
                </div>
                <TimeSlicer
              weather={weather}
              goals={goals}
              todayRitualItems={todayRitualItems}
              goalBank={goalBank}
              dailyEnergyModifier={dailyEnergyModifier}
              dailySpoonCount={todaySpoonCount}
              assignments={assignments}
              onAssignmentsChange={setAssignments}
              calendarEvents={events}
              onStartFocus={handleStartSession}
              hideCapacityOnMobile={isMobileNav}
              onSeedClick={(goal) => setSeedForMilestones(goal)}
              onMilestoneCheck={handleMilestoneCheck}
              onEditGoal={(goal) => setEditingGoal(goal)}
              onCompostGoal={handleCompostGoal}
              onAddRoutineTime={handleAddRoutineTime}
              onAutoFillWeek={googleToken ? handleAutoFillWeek : undefined}
              onAddSubtask={addSubtask}
              onLoadLightened={handleLoadLightened}
              onOpenGoalCreator={() => setIsPlanting(true)}
              autoFillLoading={autoFillLoading}
              googleToken={googleToken}
              onPlanWeek={handlePlanWeek}
              onPlanMonth={handlePlanMonth}
              planningWeek={planningWeek}
              weekPreview={weekPreview}
              onConfirmWeekPlan={handleConfirmWeekPlan}
              onDiscardWeekPlan={handleDiscardWeekPlan}
              monthlyRoadmap={monthlyRoadmap}
            />
              </div>
            )}
              </>
            )}
          </>
        )}
        {activeTab === 'horizons' && (
          <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* View toggle: Project planning | Tracking metrics */}
            <div className="flex gap-1 p-1 rounded-xl bg-stone-100 border border-stone-200 w-full max-w-sm">
              <button
                type="button"
                onClick={() => setHorizonsView('planning')}
                className={`flex-1 py-2 px-4 rounded-lg font-sans text-sm font-medium transition-colors ${horizonsView === 'planning' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-800'}`}
              >
                Project planning
              </button>
              <button
                type="button"
                onClick={() => setHorizonsView('metrics')}
                className={`flex-1 py-2 px-4 rounded-lg font-sans text-sm font-medium transition-colors ${horizonsView === 'metrics' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-800'}`}
              >
                Tracking metrics
              </button>
            </div>

            {horizonsView === 'metrics' ? (
              <HorizonsMetrics
                goals={goals}
                logMetric={logMetric}
                onRecord={() => { setRecordedToast(true); setTimeout(() => setRecordedToast(false), 2500); }}
              />
            ) : (
              <>
            {/* 1. Planning Actions */}
            <div>
              <h2 className="font-serif text-2xl text-stone-800 mb-4">Planting Season</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlanting(true)}
                  className="flex-1 py-4 px-4 rounded-xl border-2 border-dashed border-moss-300 bg-moss-50 text-moss-700 font-sans font-medium hover:border-moss-500 hover:bg-moss-100 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <span className="text-xl">🌱</span> Plant a New Seed
                </button>
                <button
                  type="button"
                  onClick={() => setShowProjectPlanner(true)}
                  className="flex-1 py-4 px-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 text-amber-700 font-sans font-medium hover:border-amber-500 hover:bg-amber-100 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <span className="text-xl">📋</span> Plan a Project
                </button>
              </div>
            </div>

            {/* Gantt: project timeline */}
            <HorizonsGantt goals={goals} onGoalClick={(goal) => setEditingGoal(goal)} />

            {/* Ponds: Vitality goals grouped by domain + their tributary Rocks */}
            {(() => {
              const vitalityGoals = (goals ?? []).filter((g) => g.type === 'vitality');
              if (vitalityGoals.length === 0) return null;
              const byDomain = {};
              vitalityGoals.forEach((g) => {
                const d = g.domain || 'body';
                if (!byDomain[d]) byDomain[d] = { vitality: [], tributaryIds: new Set() };
                byDomain[d].vitality.push(g);
                (g.tributaryGoalIds || []).forEach((id) => byDomain[d].tributaryIds.add(id));
              });
              const domainOrder = ['body', 'finance', 'mind', 'spirit'];
              return (
                <div id="tour-ponds" className="mt-8">
                  <h3 className="font-serif text-stone-800 text-base mb-3">Ponds</h3>
                  <div className="space-y-4">
                    {domainOrder.filter((d) => byDomain[d]).map((domainId) => {
                      const { vitality, tributaryIds } = byDomain[domainId];
                      const tributaryRocks = (goals ?? []).filter((g) => (g.type === 'routine' && tributaryIds.has(g.id)) || vitality.some((v) => g.linkedVitalityGoalId === v.id));
                      const pondLabel = POND_LABELS[domainId] ?? domainId;
                      return (
                        <div
                          key={domainId}
                          className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden"
                        >
                          <div className="px-4 py-3 bg-stone-100 border-b border-stone-200 font-serif text-stone-900 font-medium">
                            {pondLabel}
                          </div>
                          <div className="p-4 space-y-3">
                            {vitality.map((goal) => {
                              const latest = getLatestMetricValue(goal);
                              const ms = goal.metricSettings ?? {};
                              const unit = ms.unit || '';
                              const target = ms.targetValue;
                              const current = latest ?? ms.currentValue ?? 0;
                              const direction = ms.direction ?? 'higher';
                              const entries = Array.isArray(goal.metrics) ? goal.metrics.slice(-7) : [];
                              const hasTarget = target != null && target !== 0;
                              let progressPct = 0;
                              if (hasTarget) {
                                const start = ms.currentValue ?? 0;
                                const range = Math.abs(target - start);
                                const moved = direction === 'lower' ? start - current : current - start;
                                progressPct = range > 0 ? Math.max(0, Math.min(100, (moved / range) * 100)) : 0;
                              }
                              return (
                                <div key={goal.id} className="rounded-lg border border-stone-100 bg-stone-50/50 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">💧</span>
                                    <span className="font-sans text-sm font-medium text-stone-800 flex-1">{goal.title}</span>
                                    <span className="font-sans text-lg font-bold text-stone-900 tabular-nums">
                                      {latest != null ? latest : '—'}
                                    </span>
                                    {unit && <span className="font-sans text-xs text-stone-500">{unit}</span>}
                                  </div>
                                  {hasTarget && (
                                    <div className="mb-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-sans text-[10px] text-stone-400">
                                          {direction === 'lower' ? 'Goal: lower to' : 'Goal: reach'} {target} {unit}
                                        </span>
                                        <span className="font-sans text-[10px] text-stone-500 font-medium">{Math.round(progressPct)}%</span>
                                      </div>
                                      <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${progressPct >= 100 ? 'bg-moss-500' : progressPct >= 50 ? 'bg-sky-400' : 'bg-amber-400'}`}
                                          style={{ width: Math.min(progressPct, 100) + '%' }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  {entries.length > 1 && (
                                    <div className="flex items-end gap-px h-8 mb-2">
                                      {(() => {
                                        const vals = entries.map((e) => e.value);
                                        const mn = Math.min(...vals);
                                        const mx = Math.max(...vals);
                                        const range = mx - mn || 1;
                                        return vals.map((v, idx) => (
                                          <div
                                            key={idx}
                                            className="flex-1 rounded-sm bg-sky-300/70"
                                            style={{ height: Math.max(4, ((v - mn) / range) * 28) + 'px' }}
                                            title={`${entries[idx].date}: ${v} ${unit}`}
                                          />
                                        ));
                                      })()}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      step="any"
                                      placeholder={latest != null ? String(latest) : '0'}
                                      className="flex-1 py-1.5 px-2 rounded-md border border-stone-200 bg-white font-sans text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 tabular-nums"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const num = parseFloat(e.target.value);
                                          if (!Number.isNaN(num)) {
                                            logMetric(goal.id, num);
                                            e.target.value = '';
                                            setRecordedToast(true);
                                            setTimeout(() => setRecordedToast(false), 2500);
                                          }
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        const input = e.currentTarget.previousElementSibling;
                                        const num = parseFloat(input.value);
                                        if (!Number.isNaN(num)) {
                                          logMetric(goal.id, num);
                                          input.value = '';
                                          setRecordedToast(true);
                                          setTimeout(() => setRecordedToast(false), 2500);
                                        }
                                      }}
                                      className="shrink-0 py-1.5 px-3 rounded-md bg-moss-600 text-white font-sans text-xs font-medium hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                                    >
                                      Log
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {tributaryRocks.map((rock) => {
                              const minsThisWeek = getMinutesThisWeekForGoal(logs ?? [], rock.id);
                              const filledHours = Math.round((minsThisWeek / 60) * 10) / 10;
                              const targetHours = rock.targetHours ?? 0;
                              return (
                                <div key={rock.id} className="flex items-center gap-2 font-sans text-sm">
                                  <span className="text-stone-500 shrink-0">🪨</span>
                                  <span className="text-stone-800 font-medium">{rock.title}:</span>
                                  <span className="text-stone-600">
                                    {filledHours}h / {targetHours}h
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Monthly Tracker (goals with monthlyTarget) */}
            {(() => {
              const monthlyGoals = (goals ?? []).filter((g) => g?.schedulerSettings?.monthlyTarget != null);
              if (monthlyGoals.length === 0) return null;
              return (
                <div className="mt-8">
                  <h3 className="font-serif text-stone-800 text-base mb-3">Monthly Tracker</h3>
                  <div className="flex flex-wrap gap-4">
                    {monthlyGoals.map((goal) => {
                      const targetHours = goal.schedulerSettings.monthlyTarget;
                      const minutesLogged = getMinutesThisMonthForGoal(logs ?? [], goal.id);
                      const hoursLogged = Math.round((minutesLogged / 60) * 10) / 10;
                      const fillPercent = targetHours > 0 ? Math.min(100, (hoursLogged / targetHours) * 100) : 0;
                      const { onTrack, encouragement, daysRemaining } = getMonthlyProjection(minutesLogged, targetHours);
                      const ringColor = onTrack ? '#4A5D23' : fillPercent > 0 ? '#d97706' : '#a8a29e';
                      return (
                        <div
                          key={goal.id}
                          className="flex items-center gap-4 p-4 rounded-xl border border-stone-200 bg-white shadow-sm max-w-md w-full"
                        >
                          <div className="shrink-0 relative w-16 h-16 flex items-center justify-center" aria-hidden>
                            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                              <circle cx="18" cy="18" r="14" fill="none" stroke="#e7e5e4" strokeWidth="3" />
                              <circle
                                cx="18"
                                cy="18"
                                r="14"
                                fill="none"
                                stroke={ringColor}
                                strokeWidth="3"
                                strokeDasharray={`${(fillPercent / 100) * 88} 88`}
                                strokeLinecap="round"
                                className="transition-all duration-500"
                              />
                            </svg>
                            <span className="absolute font-sans text-xs font-semibold text-stone-600 tabular-nums">
                              {Math.round(fillPercent)}%
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-sans font-medium text-stone-800 truncate">{goal.title}</p>
                            <p className="font-sans text-sm text-stone-500 mt-0.5">
                              {hoursLogged}h of {targetHours}h · {daysRemaining} days left
                            </p>
                            <p className={`font-sans text-xs mt-1 ${onTrack ? 'text-moss-600' : 'text-amber-700'}`}>
                              {encouragement}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
              </>
            )}
          </div>
        )}
        {activeTab === 'garden' && (
          <div className="w-full">
            <GardenWalk goals={goals} onCompost={handleCompostGoal} onGoalClick={handleGardenGoalClick} onOpenGoalCreator={() => setIsPlanting(true)} onEditGoal={editGoal} />
          </div>
        )}
        {activeTab === 'journal' && (
          <div className="w-full">
            <JournalView />
          </div>
        )}
        {activeTab === 'insights' && (
          <div className="w-full">
            <AnalyticsView />
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="w-full pb-24 sm:pb-0">
            <SettingsView onReplayTour={() => setShowTour(true)} />
          </div>
        )}
      </main>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpen={() => setCommandPaletteOpen(true)}
        goals={goals}
        assignments={assignments}
        onAssignmentsChange={handlePlantFromPalette}
        onOpenGoalCreator={handleOpenGoalCreatorFromPalette}
        onOpenSpiritBuilder={() => { setCommandPaletteOpen(false); setShowSpiritMirror(true); }}
      />

      <AnimatePresence>
        {showSpiritMirror && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
            onClick={() => setShowSpiritMirror(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Spirit Mirror"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setShowSpiritMirror(false)}
                aria-label="Close"
                className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                ×
              </button>
              <SpiritBuilder
                mode="edit"
                initialConfig={spiritConfig}
                onComplete={() => setShowSpiritMirror(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <GoalCreator
        open={isPlanting}
        onClose={() => { setIsPlanting(false); setGoalCreatorInitialTitle(''); setGoalCreatorInitialSubtasks([]); }}
        onSave={handleSaveSeed}
        initialTitle={goalCreatorInitialTitle}
        initialSubtasks={goalCreatorInitialSubtasks}
        existingRoutineGoals={(goals ?? []).filter((g) => g.type === 'routine')}
        existingVitalityGoals={(goals ?? []).filter((g) => g.type === 'vitality')}
        ritualCategories={userSettings?.ritualCategories ?? []}
        onAddRitualCategory={addRitualCategory}
      />

      <ProjectPlanner
        open={showProjectPlanner}
        onClose={() => setShowProjectPlanner(false)}
        onCreateGoals={handleProjectGoals}
      />

      <StartAssistModal
        open={showStartAssistModal}
        suggestedTask={startAssistSuggestedTask}
        noTasksMode={startAssistNoTasks}
        defaultDurationMinutes={todaySpoonCount != null && todaySpoonCount <= 4 ? 5 : 5}
        onStart={handleStartAssistStart}
        onPickDifferent={() => setShowStartAssistModal(false)}
        onClose={handleStartAssistClose}
        onChooseSuggestion={handleStartAssistChooseSuggestion}
      />

      <StartNowModal
        open={showStartNowModal}
        mode={startNowCandidate?.goal ? 'hasTasks' : 'noTasks'}
        candidateTask={startNowCandidate}
        onStart={handleStartNowStart}
        onPickDifferent={handleStartNowPickDifferent}
        onCreateSuggestion={handleStartNowCreateSuggestion}
        onClose={() => { setShowStartNowModal(false); setStartNowCandidate(null); }}
      />

      <GentleRestartModal
        open={showGentleRestart}
        onFreshStart={handleGentleRestartFreshStart}
        onReviewCompost={handleGentleRestartReviewCompost}
        onDismiss={handleGentleRestartDismiss}
      />

      <AccessibilitySettingsModal
        open={showAccessibilityModal}
        onClose={() => setShowAccessibilityModal(false)}
      />

      <GoalEditor
        open={!!editingGoal}
        goal={editingGoal}
        onClose={() => setEditingGoal(null)}
        onSave={(updates) => { if (editingGoal?.id) editGoal(editingGoal.id, updates); setEditingGoal(null); }}
        addSubtask={addSubtask}
        updateSubtask={updateSubtask}
        deleteSubtask={deleteSubtask}
      />

      <SpiritChat
        open={showChat}
        onClose={() => setShowChat(false)}
        context={{
          goals: goals ?? [],
          logs: logs ?? [],
          energy: dailyEnergyModifier ?? 0,
          weather: weather ?? 'sun',
        }}
      />

      <CompostHeap
        open={showCompost}
        onClose={() => setShowCompost(false)}
        onPlant={(text) => {
          setGoalCreatorInitialTitle(text ?? '');
          setGoalCreatorInitialSubtasks([]);
          setShowCompost(false);
          setIsPlanting(true);
        }}
        onPrism={(text, subtasks) => {
          setGoalCreatorInitialTitle(text ?? '');
          setGoalCreatorInitialSubtasks(Array.isArray(subtasks) ? subtasks : []);
          setShowCompost(false);
          setIsPlanting(true);
        }}
      />

      {/* Configure Session modal (pre-flight when clicking Play on a slot) */}
      <AnimatePresence>
        {sessionConfigTarget?.goal && (
          <motion.div
            key="configure-session"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
            onClick={() => setSessionConfigTarget(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="configure-session-title"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-stone-50 rounded-2xl border border-stone-200 shadow-xl max-w-sm w-full max-h-[90vh] overflow-y-auto p-6"
            >
              <button
                type="button"
                onClick={() => setSessionConfigTarget(null)}
                aria-label="Close"
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                ×
              </button>
              <h2 id="configure-session-title" className="font-serif text-stone-900 text-xl mb-1">
                Configure Session
              </h2>
              <p className="font-sans text-stone-600 text-sm mb-5">
                Focus on {sessionConfigTarget.ritualTitle || sessionConfigTarget.goal.title}
              </p>
              <p className="font-sans text-sm font-medium text-stone-600 mb-2">Duration</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {SESSION_DURATIONS.map((opt) => (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() => { setConfigDurationMinutes(opt.minutes); setConfigDurationCustom(false); }}
                    className={`px-3 py-2 rounded-xl font-sans text-sm transition-colors ${
                      !configDurationCustom && configDurationMinutes === opt.minutes
                        ? 'bg-moss-600 text-stone-50'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setConfigDurationCustom(true)}
                  className={`px-3 py-2 rounded-xl font-sans text-sm transition-colors ${
                    configDurationCustom
                      ? 'bg-moss-600 text-stone-50'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  ⚙️ Custom
                </button>
              </div>
              {configDurationCustom && (
                <div className="mb-4">
                  <label htmlFor="custom-minutes" className="sr-only">Minutes</label>
                  <input
                    id="custom-minutes"
                    type="number"
                    min={1}
                    max={120}
                    value={configDurationMinutes}
                    onChange={(e) => setConfigDurationMinutes(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
                    className="w-24 px-3 py-2 rounded-lg border border-stone-200 font-sans text-stone-900 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                  />
                  <span className="font-sans text-stone-500 text-sm ml-2">minutes</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => handleEnterMonkMode(configDurationMinutes)}
                className="w-full py-3 font-serif bg-moss-500 text-stone-50 rounded-xl hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
              >
                Enter Monk Mode
              </button>
              <button
                type="button"
                onClick={() => setSessionConfigTarget(null)}
                className="w-full mt-2 py-2 font-sans text-sm text-stone-500 hover:text-stone-700 focus:outline-none"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seed Milestones modal (click seed in Seed Bag) */}
      <AnimatePresence>
        {seedForMilestones && (() => {
          const goal = goals.find((g) => g.id === seedForMilestones.id) ?? seedForMilestones;
          const milestones = goal.milestones ?? [];
          return (
            <motion.div
              key="seed-milestones"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40"
              onClick={() => setSeedForMilestones(null)}
              role="dialog"
              aria-modal="true"
              aria-label="Goal milestones"
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-stone-50 rounded-2xl border border-stone-200 shadow-xl max-w-sm w-full max-h-[90vh] overflow-y-auto p-6"
              >
                <button
                  type="button"
                  onClick={() => setSeedForMilestones(null)}
                  aria-label="Close"
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                >
                  ×
                </button>
                <h3 className="font-serif text-stone-900 text-xl mb-4">{goal.title}</h3>
                <p className="font-sans text-sm text-stone-500 mb-4">Milestones (Break it down)</p>
                {milestones.length === 0 ? (
                  <p className="font-sans text-sm text-stone-400">No milestones yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {milestones.map((m) => (
                      <li key={m.id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!m.completed}
                          onChange={(e) => handleMilestoneCheck(goal.id, m.id, e.target.checked)}
                          disabled={m.completed}
                          className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50 disabled:opacity-70"
                        />
                        <span className={`font-sans text-sm ${m.completed ? 'text-stone-400 line-through' : 'text-stone-800'}`}>
                          {m.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setSeedForMilestones(null)}
                  className="mt-6 w-full py-2.5 font-sans text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {fertilizerToast && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-moss-500 text-stone-50 font-sans text-sm shadow-lg"
          role="status"
        >
          🌱 Fertilizer! +15 min growth
        </motion.div>
      )}

      {growthToast && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-moss-500 text-stone-50 font-sans text-sm shadow-lg"
          role="status"
        >
          🌿 {growthToast}
        </motion.div>
      )}

      {calendarConnectedToast && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-moss-500 text-stone-50 font-sans text-sm shadow-lg"
          role="status"
        >
          Roots connected to Google Calendar.
        </motion.div>
      )}

      {loadLightenedToast && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-stone-800 text-stone-50 font-sans text-sm shadow-lg"
          role="status"
        >
          Moved evening tasks to the Goal Bank. Rest is productive.
        </motion.div>
      )}

      {showEveningNudgeToast && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 text-slate-100 font-sans text-sm shadow-lg border border-slate-600/50"
          role="status"
        >
          <button
            type="button"
            onClick={() => {
              setShowEveningNudgeToast(false);
              setShowEveningModal(true);
            }}
            className="text-left hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-400/50 rounded"
          >
            The moon is up. Check in?
          </button>
          <button
            type="button"
            onClick={() => setShowEveningNudgeToast(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      )}

      {lockedTabToast && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl bg-stone-800 text-stone-100 font-sans text-sm shadow-lg border border-stone-600/50 max-w-xs text-center"
          role="status"
        >
          {lockedTabToast}
        </motion.div>
      )}

      {recordedToast && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-moss-600 text-stone-50 font-sans text-sm shadow-lg"
          role="status"
          aria-live="polite"
        >
          Recorded.
        </motion.div>
      )}

      {/* Post-session metric prompt */}
      <AnimatePresence>
        {metricPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setMetricPrompt(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 border border-stone-200"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-serif text-stone-900 text-lg mb-1">Log your progress</h3>
              <p className="font-sans text-sm text-stone-500 mb-4">
                How's your <span className="font-medium text-moss-700">{metricPrompt.metricName}</span> today?
              </p>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  step="any"
                  value={metricPromptValue}
                  onChange={(e) => setMetricPromptValue(e.target.value)}
                  placeholder="Enter value"
                  className="flex-1 py-2 px-3 rounded-lg border border-stone-200 bg-stone-50 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                  autoFocus
                />
                {metricPrompt.unit && (
                  <span className="font-sans text-sm text-stone-500">{metricPrompt.unit}</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMetricPrompt(null)}
                  className="flex-1 py-2 rounded-lg border border-stone-200 font-sans text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const val = parseFloat(metricPromptValue);
                    if (!isNaN(val)) {
                      if (metricPrompt.vitalityGoalId) {
                        logMetric(metricPrompt.vitalityGoalId, val);
                      }
                    }
                    setMetricPrompt(null);
                  }}
                  className="flex-1 py-2 rounded-lg bg-moss-600 font-sans text-sm text-white hover:bg-moss-700 transition-colors"
                >
                  Log it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SpiritGuideTour
        open={showTour}
        onComplete={() => {
          setShowTour(false);
          try {
            localStorage.setItem('hasSeenTour', 'true');
          } catch (_) {}
        }}
      />
    </div>
    </>
  );
}

export default GardenDashboard;
