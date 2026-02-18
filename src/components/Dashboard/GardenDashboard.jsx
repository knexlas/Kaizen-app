import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import GoalCreator from '../Goals/GoalCreator';
import GoalEditor from '../Goals/GoalEditor';
import TimeSlicer, { HOURS, MAX_SLOTS_BY_WEATHER } from './TimeSlicer';
import CompassWidget from './CompassWidget';
import CommandPalette from './CommandPalette';
import MochiSpiritWithDialogue, { MochiSpirit, getSpiritGreeting, getPlanReaction } from './MochiSpirit';
import SpiritChat from './SpiritChat';
import CompostHeap from './CompostHeap';
import { generateSpiritInsight } from '../../services/geminiService';
import { getStoredBriefing, setStoredBriefing } from '../../services/spiritBriefingStorage';
import MorningCheckIn from './MorningCheckIn';
import EveningWindDown from './EveningWindDown';
import FocusSession from '../Focus/FocusSession';
import TeaCeremony from '../Focus/TeaCeremony';
import WeeklyMap from './WeeklyMap';
import MonthlyTerrain from './MonthlyTerrain';
import GardenWalk from '../Garden/GardenWalk';
import JournalView from './JournalView';
import AnalyticsView from './AnalyticsView';
import SettingsView from './SettingsView';
import SpiritBuilder from '../Onboarding/SpiritBuilder';
import { fetchGoogleEvents } from '../../services/googleCalendarService';
import { findAvailableSlots, generateLiquidSchedule, generateSolidSchedule, getDefaultWeekStart, getStormWarnings, timeToMinutes, minutesToTime, generateDailyPlan } from '../../services/schedulerService';

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

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TODAY_MVP = 'Monday';
const TODAY_INDEX = DAY_NAMES.indexOf(TODAY_MVP);

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

/** Projected hours at end of month based on current pace. Returns { projectedHours, onTrack }. */
function getMonthlyProjection(minutesLogged, monthlyTargetHours) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysElapsed = Math.max(1, dayOfMonth);
  const hoursLogged = minutesLogged / 60;
  const pace = hoursLogged / daysElapsed;
  const projectedHours = Math.round(pace * daysInMonth * 10) / 10;
  const onTrack = projectedHours >= monthlyTargetHours;
  return { projectedHours, onTrack };
}

function getWeather(events) {
  if (!events?.length) return { weather: 'sun', forecast: 'Sunny' };
  const types = events.map((e) => e.type);
  if (types.includes('storm')) return { weather: 'storm', forecast: 'High Winds Forecast' };
  if (types.includes('leaf')) return { weather: 'breeze', forecast: 'Breeze Forecast' };
  return { weather: 'sun', forecast: 'Sunny' };
}

/** dayIndex: 0 = Sunday, 1 = Monday, ... 6 = Saturday (matches Date.getDay()) */
function getRitualForToday(goal, dayIndex) {
  return goal?.rituals?.find((r) => Array.isArray(r.days) && r.days.includes(dayIndex));
}

function GardenDashboard() {
  const { goals, weeklyEvents, logs, addGoal, updateGoalProgress, updateGoalMilestone, editGoal, deleteGoal, addSubtask, updateSubtask, deleteSubtask, updateSubtaskProgress, lastCheckInDate, completeMorningCheckIn, dailyEnergyModifier, addLog, logMetric, googleUser, connectCalendar, disconnectCalendar, googleToken, updateWeeklyEvents, cloudSaveStatus, spiritConfig, compost, addToCompost, removeFromCompost, assignments, setAssignments, eveningMode, setEveningMode } = useGarden();
  const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10));
  const needsMorningCheckIn = lastCheckInDate !== today;

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
  const [activeTab, setActiveTab] = useState('focus'); // 'focus' | 'map'
  const [mapViewMode, setMapViewMode] = useState('week'); // 'week' | 'month'
  const [selectedDate, setSelectedDate] = useState(TODAY_INDEX); // dayIndex 0=Mon .. 6=Sun
  const [isPlanting, setIsPlanting] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionConfigTarget, setSessionConfigTarget] = useState(null); // { goal, hour } when "Configure Session" is open
  const [configDurationMinutes, setConfigDurationMinutes] = useState(25);
  const [configDurationCustom, setConfigDurationCustom] = useState(false);
  const [showTeaCeremony, setShowTeaCeremony] = useState(false);
  const [completedTask, setCompletedTask] = useState(null);
  const [seedForMilestones, setSeedForMilestones] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [fertilizerToast, setFertilizerToast] = useState(false);
  const [growthToast, setGrowthToast] = useState(null);
  const [calendarConnectedToast, setCalendarConnectedToast] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showSpiritMirror, setShowSpiritMirror] = useState(false);
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

  /** Auto-Fill Week: clear auto-generated routine blocks, fetch Google events, run scheduler, fill today's slots. */
  const handleAutoFillWeek = useCallback(async () => {
    if (!googleToken) {
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

      const [fetchedEvents] = await Promise.all([
        fetchGoogleEvents(googleToken, weekStart, weekEnd),
      ]);
      const eventsForScheduler = Array.isArray(fetchedEvents) ? fetchedEvents : [];
      updateWeeklyEvents(eventsForScheduler);

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
  const selectedDayEvents = events.filter((e) => e.dayIndex === selectedDate);
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
  const maxSlots = Math.max(1, (MAX_SLOTS_BY_WEATHER[weather] ?? 6) + dailyEnergyModifier);
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
  const handleLoadLightened = useCallback(() => {
    if (loadLightenedTimeoutRef.current) clearTimeout(loadLightenedTimeoutRef.current);
    if (loadLightenedToastRef.current) clearTimeout(loadLightenedToastRef.current);
    setLoadLightenedMessage("Good decision. The garden will wait.");
    setShowSpiritDialogue(true);
    setLoadLightenedToast(true);
    loadLightenedToastRef.current = setTimeout(() => {
      loadLightenedToastRef.current = null;
      setLoadLightenedToast(false);
    }, 3000);
    loadLightenedTimeoutRef.current = setTimeout(() => {
      loadLightenedTimeoutRef.current = null;
      setLoadLightenedMessage(null);
      setShowSpiritDialogue(false);
    }, 5000);
  }, []);

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
          }
          setSpiritThinking(false);
        })
        .catch(() => setSpiritThinking(false));
    },
    [logs, goals, events, spiritInsight]
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

  const handleSaveSeed = (goal) => {
    addGoal(goal);
    setIsPlanting(false);
  };

  const handleStartSession = (goalId, hour, ritualTitle, subtaskId) => {
    const goal = goals.find((g) => g.id === goalId);
    if (goal) setSessionConfigTarget({ goal: { ...goal }, hour, ritualTitle: ritualTitle ?? null, subtaskId: subtaskId ?? null });
  };

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
    if (taskId) {
      updateGoalProgress(taskId, durationMinutes);
      const subtaskId = completedTask?.subtaskId ?? log?.subtaskId;
      if (subtaskId) {
        updateSubtaskProgress(taskId, subtaskId, durationMinutes / 60);
      }
      const goalName = completedTask?.title ?? goals.find((g) => g.id === taskId)?.title ?? 'Goal';
      setGrowthToast(`Your ${goalName} has grown.`);
    }
    addLog({
      taskId: completedTask?.id ?? log?.taskId,
      taskTitle: completedTask?.title ?? goals.find((g) => g.id === (completedTask?.id ?? log?.taskId))?.title ?? 'Goal',
      rating: log?.rating ?? null,
      note: log?.note ?? '',
      date: new Date(),
      minutes: durationMinutes,
    });
    setShowTeaCeremony(false);
    setJustFinishedSession(true);
    setShowSpiritDialogue(true);
    setTimeout(() => {
      setShowSpiritDialogue(false);
      setJustFinishedSession(false);
    }, 5000);
  };

  const handleSelectDate = (dayIndex) => {
    setSelectedDate(dayIndex);
  };

  const weekDateLabels = useMemo(() => {
    const base = new Date(today + 'T12:00:00');
    const dayOfWeek = base.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(base);
    monday.setDate(base.getDate() - daysUntilMonday);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    });
  }, [today]);

  const handleMilestoneCheck = (goalId, milestoneId, completed) => {
    updateGoalMilestone(goalId, milestoneId, completed);
    if (completed) setFertilizerToast(true);
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
        {needsMorningCheckIn && (
          <MorningCheckIn
            goals={goals}
            logMetric={logMetric}
            onComplete={(modifier) => {
              completeMorningCheckIn(modifier);
              requestSpiritWisdom(false);
              const hasAnyAssignment = HOURS.some((h) => assignments[h]);
              let planSummary = null;
              if (!hasAnyAssignment) {
                const plan = generateDailyPlan(goals, modifier);
                setAssignments(plan);
                planSummary = { slotCount: Object.keys(plan).length };
              }
              const reaction = getPlanReaction(modifier, planSummary);
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
        className={`min-h-screen flex flex-col transition-colors ${eveningMode === 'night-owl' ? 'bg-slate-900 text-slate-100' : 'bg-stone-50'}`}
      >
      <header
        className={`border-b transition-colors ${
          eveningMode === 'night-owl' ? 'border-slate-700 bg-slate-800/80' : `border-stone-200 ${skyBg}`
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <p className={`font-serif text-xl md:text-2xl ${eveningMode === 'night-owl' ? 'text-slate-100' : 'text-stone-900'}`}>
            {new Date(today + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          <div className={`flex items-center gap-3 font-sans text-sm ${eveningMode === 'night-owl' ? 'text-slate-300' : 'text-stone-700'}`}>
            <button
              type="button"
              onClick={() => setShowChat(true)}
              className={`flex items-center gap-2 py-1.5 pl-1 pr-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                eveningMode === 'night-owl' ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
              aria-label="Chat with Mochi"
              title="Chat with Mochi"
            >
              <span className="inline-block w-7 h-8 flex items-center justify-center [&_svg]:w-7 [&_svg]:h-8" aria-hidden>
                <MochiSpirit />
              </span>
              <span className="hidden sm:inline text-xs font-medium">Wisdom</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCompost(true)}
              className={`flex items-center gap-2 py-1.5 pl-1 pr-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                eveningMode === 'night-owl' ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
              aria-label="Compost Heap (Inbox)"
              title="Compost Heap (Inbox)"
            >
              <span className="text-lg leading-none" aria-hidden>🍂</span>
              <span className="hidden sm:inline text-xs font-medium">Inbox</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSpiritMirror(true)}
              className={`p-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                eveningMode === 'night-owl' ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/60'
              }`}
              aria-label="Customize Spirit"
              title="Spirit Mirror"
            >
              <MirrorIcon />
            </button>
            <button
              type="button"
              onClick={() => setShowEveningModal(true)}
              className="p-1.5 rounded-lg text-stone-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              aria-label="Evening Ritual"
              title="Evening Ritual"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </button>
            {eveningMode !== 'night-owl' && (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
              aria-label="Settings"
              title="Settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            )}
            {/* Connection / Offline: when offline show only grey Offline Mode badge */}
            {!isOnline ? (
              <span
                className="flex items-center gap-1 font-sans text-xs text-stone-500 bg-stone-200/80 px-2 py-1 rounded-full"
                title="Offline"
                aria-label="Offline mode"
              >
                Offline Mode
              </span>
            ) : (
              <>
                {googleUser ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Disconnect Google Calendar? Your events will no longer sync.')) {
                        disconnectCalendar();
                      }
                    }}
                    className="flex items-center gap-2 py-1.5 px-2.5 rounded-full text-moss-700 font-sans text-sm hover:bg-moss-100/60 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                    title={`Logged in as ${googleUser.email ?? 'Google'}`}
                    aria-label="Calendar synced; click to disconnect"
                  >
                    ✅ Synced
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await connectCalendar();
                      if (ok) setCalendarConnectedToast(true);
                    }}
                    className="flex items-center gap-2 py-1.5 px-2.5 rounded-full text-stone-500 font-sans text-sm hover:text-stone-800 hover:underline focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                    aria-label="Sync Google Calendar"
                  >
                    🔗 Sync Google Cal
                  </button>
                )}
              </>
            )}
            <div className="flex items-center gap-2">
              <WeatherIcon />
              <span>{forecast}</span>
            </div>
            {isOnline && googleUser && cloudSaveStatus === 'saved' && (
              <span
                className="flex items-center gap-1 font-sans text-xs text-moss-600"
                title="Saved to cloud"
                aria-label="Saved to cloud"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <span className="hidden sm:inline">Saved</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {!isMobileNav && (
        <nav className={`border-b ${eveningMode === 'night-owl' ? 'border-slate-700 bg-slate-800/60' : 'border-stone-200 bg-stone-50'}`}>
          <div className="max-w-4xl mx-auto px-4 flex gap-8">
            {[
              { id: 'focus', label: 'Daily Focus' },
              { id: 'map', label: 'Weekly Map' },
              { id: 'garden', label: 'My Garden' },
              { id: 'journal', label: 'Journal' },
              { id: 'wisdom', label: 'Wisdom' },
              { id: 'settings', label: 'Settings' },
            ]
              .filter(({ id }) => eveningMode !== 'night-owl' || (id !== 'garden' && id !== 'settings'))
              .map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`relative py-4 font-sans font-medium focus:outline-none focus:ring-2 focus:ring-moss-500/30 rounded ${
                    eveningMode === 'night-owl'
                      ? activeTab === id ? 'text-slate-100' : 'text-slate-400 hover:text-slate-200'
                      : activeTab === id ? 'text-stone-900' : 'text-stone-600 hover:text-stone-800'
                  }`}
                >
                  {label}
                  {activeTab === id && (
                    <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${eveningMode === 'night-owl' ? 'bg-slate-400' : 'bg-stone-400'}`} />
                  )}
                </button>
              ))}
          </div>
        </nav>
      )}

      {isMobileNav && (
        <nav className={`fixed bottom-0 left-0 right-0 z-50 border-t safe-area-pb ${eveningMode === 'night-owl' ? 'border-slate-700 bg-slate-800/95' : 'border-stone-200 bg-stone-50'}`}>
          <div className="max-w-4xl mx-auto px-2 flex justify-around py-2">
            {[
              { id: 'focus', label: 'Focus', icon: '🎯' },
              { id: 'map', label: 'Map', icon: '🗺️' },
              { id: 'garden', label: 'Garden', icon: '🌱' },
              { id: 'journal', label: 'Journal', icon: '📔' },
              { id: 'wisdom', label: 'Wisdom', icon: '📊' },
              { id: 'settings', label: 'Settings', icon: '⚙️' },
            ]
              .filter(({ id }) => eveningMode !== 'night-owl' || (id !== 'garden' && id !== 'settings'))
              .map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg font-sans text-xs focus:outline-none focus:ring-2 focus:ring-moss-500/30 ${
                    eveningMode === 'night-owl'
                      ? activeTab === id ? 'text-indigo-200 bg-slate-700' : 'text-slate-400'
                      : activeTab === id ? 'text-moss-700 bg-moss-100' : 'text-stone-600'
                  }`}
                  aria-label={label}
                >
                  <span className="text-lg leading-none" aria-hidden>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
          </div>
        </nav>
      )}

      <main className={`flex-1 w-full px-4 py-8 max-w-5xl mx-auto relative ${isMobileNav ? 'pb-20' : ''}`}>
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
            {isMobileNav && (
              <div className="mb-4">
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
                  <span aria-hidden>⛈️</span> Storm Warning
                </p>
                <ul className="mt-2 list-disc list-inside space-y-1 text-amber-800">
                  {stormWarnings.map((w, i) => (
                    <li key={w.subtaskId ?? i}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <TimeSlicer
              weather={weather}
              goals={goals}
              todayRitualItems={todayRitualItems}
              goalBank={goalBank}
              dailyEnergyModifier={dailyEnergyModifier}
              assignments={assignments}
              onAssignmentsChange={setAssignments}
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
            />
            <button
              type="button"
              onClick={() => setIsPlanting(true)}
              className="mt-6 py-2.5 px-4 rounded-lg border-2 border-dashed border-stone-200 text-stone-500 font-sans text-sm hover:border-moss-500 hover:text-moss-600 transition-colors"
            >
              + Plant a Seed
            </button>

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
                <div className="mt-8">
                  <h3 className="font-serif text-stone-800 text-base mb-3">Ponds</h3>
                  <div className="space-y-4">
                    {domainOrder.filter((d) => byDomain[d]).map((domainId) => {
                      const { vitality, tributaryIds } = byDomain[domainId];
                      const tributaryRocks = (goals ?? []).filter((g) => g.type === 'routine' && tributaryIds.has(g.id));
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
                              const name = goal.metricSettings?.metricName || goal.title;
                              return (
                                <div key={goal.id} className="flex items-center gap-2 font-sans text-sm">
                                  <span className="text-stone-500 shrink-0">💧</span>
                                  <span className="text-stone-800 font-medium">{goal.title}:</span>
                                  <span className="text-stone-600">
                                    {latest != null ? `${latest}` : '—'}
                                    {goal.metricSettings?.targetValue != null && (
                                      <span className="text-stone-400"> → {goal.metricSettings.targetValue}</span>
                                    )}
                                  </span>
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
                      const { projectedHours, onTrack } = getMonthlyProjection(minutesLogged, targetHours);
                      return (
                        <div
                          key={goal.id}
                          className="flex items-center gap-4 p-4 rounded-xl border border-stone-200 bg-white shadow-sm"
                        >
                          <div className="shrink-0 relative w-16 h-16" aria-hidden>
                            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                              <circle cx="18" cy="18" r="14" fill="none" stroke="#e7e5e4" strokeWidth="3" />
                              <circle
                                cx="18"
                                cy="18"
                                r="14"
                                fill="none"
                                stroke="#4A5D23"
                                strokeWidth="3"
                                strokeDasharray={`${(fillPercent / 100) * 88} 88`}
                                strokeLinecap="round"
                                className="transition-all duration-500"
                              />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="font-sans font-medium text-stone-800 truncate">{goal.title}</p>
                            <p className="font-sans text-sm text-stone-500 mt-0.5">
                              {hoursLogged}h logged / {targetHours}h target
                            </p>
                            <p className={`font-sans text-xs mt-1 ${onTrack ? 'text-moss-600' : 'text-red-600'}`}>
                              {onTrack
                                ? `At this pace, you will hit ${projectedHours} hours.`
                                : 'You are falling behind.'}
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
        {activeTab === 'map' && (
          <div className="w-full">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-sans text-sm text-stone-500">View:</span>
              <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setMapViewMode('week')}
                  className={`px-3 py-1.5 rounded-md font-sans text-sm transition-colors ${
                    mapViewMode === 'week' ? 'bg-stone-800 text-stone-50' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Week View
                </button>
                <button
                  type="button"
                  onClick={() => setMapViewMode('month')}
                  className={`px-3 py-1.5 rounded-md font-sans text-sm transition-colors ${
                    mapViewMode === 'month' ? 'bg-stone-800 text-stone-50' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Month View
                </button>
              </div>
            </div>
            {mapViewMode === 'week' ? (
              <WeeklyMap
                weeklyPlan={events}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                weekDateLabels={weekDateLabels}
              />
            ) : (
              <MonthlyTerrain googleToken={googleToken} />
            )}
          </div>
        )}
        {activeTab === 'garden' && (
          <div className="w-full">
            <GardenWalk goals={goals} onCompost={handleCompostGoal} onGoalClick={handleGardenGoalClick} />
          </div>
        )}
        {activeTab === 'journal' && (
          <div className="w-full">
            <JournalView />
          </div>
        )}
        {activeTab === 'wisdom' && (
          <div className="w-full">
            <AnalyticsView />
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="w-full pb-24 sm:pb-0">
            <SettingsView />
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
              className="bg-stone-50 rounded-2xl border border-stone-200 shadow-xl max-w-sm w-full p-6"
            >
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
                className="w-full py-3 font-serif text-stone-800 bg-moss-500 text-stone-50 rounded-xl hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
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
                className="bg-stone-50 rounded-2xl border border-stone-200 shadow-xl max-w-sm w-full p-6"
              >
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
    </div>
    </>
  );
}

export default GardenDashboard;
