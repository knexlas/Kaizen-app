import { useState, useEffect, useMemo, useCallback, useRef, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { useTheme } from '../../context/ThemeContext';
import { useReward } from '../../context/RewardContext';
import { useEnergy } from '../../context/EnergyContext';
import WoodenSpoon from '../WoodenSpoon';
import { buildReward } from '../../services/dopamineEngine';
import { getSettings } from '../../services/userSettings';
import { pickStarterTask } from '../../services/startAssist';
import { localISODate, diffDays, weekdayIndexMon0, jsDayFromMon0 } from '../../services/dateUtils';
import StartNowModal from '../StartAssist/StartNowModal';
import GentleRestartModal from '../Onboarding/GentleRestartModal';
import GuidedEmptyState from '../EmptyStates/GuidedEmptyState';
import AccessibilitySettingsModal from '../Settings/AccessibilitySettingsModal';
import GoalCreator from '../Goals/GoalCreator';
import ProjectPlanner from '../Projects/ProjectPlanner';
import HorizonsGantt from '../Horizons/HorizonsGantt';
import GoalEditor from '../Goals/GoalEditor';
import TimeSlicer, { HOURS, MAX_SLOTS_BY_WEATHER, getAssignmentsForHour } from './TimeSlicer';
import CompassWidget from './CompassWidget';
import CommandPalette from './CommandPalette';
import OmniAdd from './OmniAdd';
import WeeklyMap from './WeeklyMap';
import MochiSpiritWithDialogue, { DefaultSpiritSvg, getSpiritGreeting, getPlanReaction } from './MochiSpirit';
import SpiritChat from './SpiritChat';
import CompostHeap from './CompostHeap';
import NextTinyStep from './NextTinyStep';
import { generateSpiritInsight, generateMorningBriefing, generateWeeklyPlan, generateMonthlyPlan, generateMonthlyPlanTasks, rebalanceMonthQuota, generateHabitSynergy } from '../../services/geminiService';
import { importICSFile, downloadICS, CALENDAR_PROVIDERS } from '../../services/calendarSyncService';
import { fetchOutlookEvents } from '../../services/microsoftCalendarService';
import { getStoredBriefing, setStoredBriefing } from '../../services/spiritBriefingStorage';
import { getNextTaskInSequence } from '../../services/nextStepService';
import NextStepPrompt from './NextStepPrompt';
import HabitStackHandoffPrompt from './HabitStackHandoffPrompt';
import MorningCheckIn from './MorningCheckIn';
import EveningWindDown from './EveningWindDown';
import FocusSession from '../Focus/FocusSession';
import TeaCeremony from '../Focus/TeaCeremony';
import GardenWalk from '../Garden/GardenWalk';
import JournalView from './JournalView';
import AnalyticsView from './AnalyticsView';
import SettingsView from './SettingsView';
import RoutinesManager from './RoutinesManager';
import CalendarView from './CalendarView';
import SpiritBuilder from '../Onboarding/SpiritBuilder';
import SpiritGuideTour from '../Onboarding/SpiritGuideTour';
import SpiritOrigins from '../Onboarding/SpiritOrigins';
import TourHighlight from '../Onboarding/TourHighlight';
import FeatureTooltip from '../Onboarding/FeatureTooltip';
import { fetchGoogleEvents, createGoogleEvent } from '../../services/googleCalendarService';
import { getTourSeen, setTourSeen, consumeTriggerTourFlag } from '../../services/onboardingStateService';
import { findAvailableSlots, generateLiquidSchedule, generateSolidSchedule, getDefaultWeekStart, getStormWarnings, getStormImpactForDay, timeToMinutes, minutesToTime, generateDailyPlan, materializeWeeklyPlan, getSpoonCost, hourFromTimeStr } from '../../services/schedulerService';
import { autoFillWeek } from '../../services/plannerEngine';

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

/** Catches errors in the expanded schedule so the app doesn't crash; shows fallback + logs error. */
class ScheduleErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ScheduleErrorBoundary]', error, errorInfo?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mb-4 p-4 rounded-xl border-2 border-amber-200 bg-amber-50">
          <p className="font-sans text-sm font-medium text-amber-900 mb-1">Schedule couldn&apos;t load</p>
          <p className="font-mono text-xs text-amber-800 mb-3 break-all" title={this.state.error?.stack}>
            {this.state.error?.message ?? String(this.state.error)}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              this.props.onCollapse?.();
            }}
            className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-amber-200 text-amber-900 hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            Collapse schedule
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function GardenDashboard({ firstDayStep, onFirstDayStepChange } = {}) {
  const { goals, weeklyEvents, logs, addGoal, updateGoalProgress, updateUserSettings, updateGoalMilestone, editGoal, deleteGoal, addSubtask, updateSubtask, deleteSubtask, updateSubtaskProgress, toggleMilestone, updateMilestone, addMilestone, deleteMilestone, promoteTaskToThisWeek, lastCheckInDate, completeMorningCheckIn, dailyEnergyModifier, dailySpoonCount, addLog, logMetric, googleUser, connectCalendar, disconnectCalendar, googleToken, updateWeeklyEvents, weeklyNorthStarId, cloudSaveStatus, spiritConfig, setSpiritConfig, compost, addToCompost, removeFromCompost, soilNutrients, consumeSoilNutrients, earnEmbers, addWater, today, assignments, setAssignments, gentleResetToToday, archiveStalePlanItems, runCriticalMassCheck, eveningMode, setEveningMode, userSettings, addRitualCategory, saveDayPlanForDate, loadDayPlan, weekAssignments, monthlyQuotas, addMonthlyQuota, updateMonthlyQuota, msUser, msToken, connectOutlook, disconnectOutlook, refreshOutlookToken, tourStep, setTourStep } = useGarden();
  const { pushReward } = useReward();
  const { darkMode: themeDarkMode, setDarkModeOverride } = useTheme();
  const { dailyEnergy, setEnergyLevel } = useEnergy();
  const [showEnergyMenu, setShowEnergyMenu] = useState(false);
  const isDark = themeDarkMode || eveningMode === 'night-owl';

  const renderSpiritAvatar = () => {
    if (!spiritConfig) return <span className="text-4xl">✨</span>;
    if (spiritConfig.type === 'mochi') return <DefaultSpiritSvg className="w-10 h-10 drop-shadow-sm" />;
    if (spiritConfig.type === 'custom') {
      const HEADS = { bunny: '🐰', cat: '🐱', bear: '🐻', fox: '🦊', bot: '🤖', owl: '🦉' };
      return <span className="text-4xl">{HEADS[spiritConfig.head] || '✨'}</span>;
    }
    const ARCHETYPES = { cat: '🐱', ember: '🔥', nimbus: '☁️', owl: '🦉' };
    return <span className="text-4xl">{ARCHETYPES[spiritConfig.type] || '✨'}</span>;
  };
  const needsMorningCheckIn = lastCheckInDate !== today;
  const appGuideStep = userSettings?.appGuideStep ?? 0;
  const showAppGuide = appGuideStep >= 0 && appGuideStep < 6;
  const GUIDE_STEPS = [
    { targetId: 'guide-morning-checkin', message: 'Start here by logging your energy.' },
    { targetId: 'guide-omni-add', message: 'Quickly add tasks or ideas here.' },
    { targetId: 'tour-timeline', message: 'Click a task to view notes, generate an AI guide, or set up a Habit Stack.' },
    { targetId: 'tour-insights', message: 'Check here weekly for AI-generated summaries of your progress.' },
    { targetId: 'tour-horizons', message: 'Open Plan to schedule your week, manage projects, and set monthly quotas.' },
    { targetId: 'guide-garden-tab', message: 'Open the Garden to see your goals as plants and interact with your spirit.' },
  ];

  const yesterdayForPlan = useMemo(() => {
    if (!today) return localISODate(new Date(Date.now() - 864e5));
    const d = new Date(today + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return localISODate(d);
  }, [today]);
  const yesterdayPlan = lastCheckInDate === yesterdayForPlan ? { modifier: dailyEnergyModifier, spoonCount: dailySpoonCount } : null;

  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'planner' | 'garden' | 'settings'
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [planSelectedDayIndex, setPlanSelectedDayIndex] = useState(0);
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
  const [nextStepPrompt, setNextStepPrompt] = useState(null); // { completedTitle, nextStep } after task complete
  const [habitStackHandoff, setHabitStackHandoff] = useState(null); // { routineName, linkedGoal, linkedSubtaskId?, linkedTitle } when routine completes and a linked Kaizen task exists
  const [fertilizerToast, setFertilizerToast] = useState(false);
  const [growthToast, setGrowthToast] = useState(null);
  const [calendarConnectedToast, setCalendarConnectedToast] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  const [planningWeek, setPlanningWeek] = useState(false);
  const [weekPreview, setWeekPreview] = useState(null); // { [dateStr]: { [hour]: assignment } } for review before saving
  const [monthlyRoadmap, setMonthlyRoadmap] = useState(null);
  const [isGeneratingMonthPlan, setIsGeneratingMonthPlan] = useState(false);
  const [pendingMonthPlan, setPendingMonthPlan] = useState(null); // array of { title, date, durationMinutes } for review before applying
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showSpiritMirror, setShowSpiritMirror] = useState(false);
  const [showProjectPlanner, setShowProjectPlanner] = useState(false);
  const [projectPlannerPrefill, setProjectPlannerPrefill] = useState({ prefillTitle: '', prefillParentGoalId: '' });
  const [horizonsView, setHorizonsView] = useState('planning'); // 'planning' | 'metrics'
  const [planView, setPlanView] = useState('calendar'); // 'calendar' | 'projects' | 'routines'
  const [rebalanceQuotaId, setRebalanceQuotaId] = useState(null); // id of quota being rebalanced
  const [pendingPlan, setPendingPlan] = useState(null); // { quota, blocks } for Monthly Rebalance review
  const [newQuotaName, setNewQuotaName] = useState('');
  const [newQuotaHours, setNewQuotaHours] = useState(60);
  const [showStartNowModal, setShowStartNowModal] = useState(false);
  const [startNowCandidate, setStartNowCandidate] = useState(null);
  const [showGentleRestart, setShowGentleRestart] = useState(false);
  const gentleRestartGapDaysRef = useRef(0);
  const [staleArchivedCount, setStaleArchivedCount] = useState(0);
  const hasRunArchiveStaleRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [showAccessibilityModal, setShowAccessibilityModal] = useState(false);
  const [showMorningCheckInModal, setShowMorningCheckInModal] = useState(false);
  const [morningBriefing, setMorningBriefing] = useState([]);
  const [goalCreatorInitialTitle, setGoalCreatorInitialTitle] = useState('');
  const [goalCreatorInitialSubtasks, setGoalCreatorInitialSubtasks] = useState([]);
  const [goalCreatorInitialIsFixed, setGoalCreatorInitialIsFixed] = useState(undefined);
  const [goalCreatorInitialContext, setGoalCreatorInitialContext] = useState(undefined);
  const [goalCreatorInitialRecurrence, setGoalCreatorInitialRecurrence] = useState(undefined);
  const [goalCreatorInitialEnergyCost, setGoalCreatorInitialEnergyCost] = useState(undefined);
  const [synergySuggestion, setSynergySuggestion] = useState(null); // { goalId, suggestedHabitTitle, pitchText } after creating a goal
  const [now, setNow] = useState(() => new Date());
  const [showSpiritDialogue, setShowSpiritDialogue] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCompost, setShowCompost] = useState(false);
  const [showScheduleEventModal, setShowScheduleEventModal] = useState(false);
  const [scheduleEventPrefill, setScheduleEventPrefill] = useState(null); // { title?, startTime?, endTime? }
  const [scheduleEventTitle, setScheduleEventTitle] = useState('');
  const [scheduleEventDate, setScheduleEventDate] = useState(() => localISODate());
  const [scheduleEventTime, setScheduleEventTime] = useState('09:00');
  const [scheduleEventSaving, setScheduleEventSaving] = useState(false);
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
  const isFirstDayFlow = firstDayStep && firstDayStep !== 'none' && firstDayStep !== 'done';

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
      if (!isFirstDayFlow) {
        setShowSpiritOrigins(true);
      } else if (firstDayStep === 'spirit_origins') {
        setShowSpiritOrigins(true);
      }
    }
  }, [cloudSaveStatus, spiritConfig, isFirstDayFlow, firstDayStep]);

  /** Trigger tour if fresh account (0 goals, 0 logs) or user clicked Replay Tour in settings. */
  useEffect(() => {
    if (isFirstDayFlow) return;
    if ((goals?.length ?? 0) === 0 && (logs?.length ?? 0) === 0 && !getTourSeen()) {
      setShowTour(true);
    }
  }, [goals?.length, logs?.length, isFirstDayFlow]);

  /** Auto-trigger tour when user just finished onboarding (legacy triggerTour flag). */
  useEffect(() => {
    if (isFirstDayFlow) return;
    if (!consumeTriggerTourFlag()) return;
    const t = setTimeout(() => {
      setShowTour(true);
    }, 1000);
    return () => clearTimeout(t);
  }, [isFirstDayFlow]);

  /** In first-day flow, start the Spirit tour when orchestrator reaches 'spirit_tour'. */
  useEffect(() => {
    if (!isFirstDayFlow) return;
    if (firstDayStep === 'spirit_tour') {
      const t = setTimeout(() => setShowTour(true), 600);
      return () => clearTimeout(t);
    }
  }, [firstDayStep, isFirstDayFlow]);

  /** If tour is on step 1 but user already did morning check-in, skip to step 2. */
  useEffect(() => {
    if (tourStep === 1 && !needsMorningCheckIn) setTourStep(2);
  }, [tourStep, needsMorningCheckIn, setTourStep]);

  useEffect(() => {
    const check = () => setIsMobileNav(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /** Auto-nudge: after 8 PM, if still in 'none', show gentle "Check in?" toast once per day (persisted so it doesn't re-show after navigation). */
  useEffect(() => {
    if (now.getHours() < 20 || eveningMode !== 'none') return;
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('kaizen:eveningNudgeDate') === today) return;
    } catch (_) {}
    if (eveningNudgeShownRef.current === today) return;
    eveningNudgeShownRef.current = today;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('kaizen:eveningNudgeDate', today);
    } catch (_) {}
    setShowEveningNudgeToast(true);
  }, [now, today, eveningMode]);

  /** Auto-open evening modal once per day around 20:00 when still in 'none' (persisted so it doesn't re-show after navigation). */
  useEffect(() => {
    if (now.getHours() < 20 || eveningMode !== 'none') return;
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('kaizen:eveningModalDate') === today) return;
    } catch (_) {}
    if (eveningModalAutoOpenedRef.current === today) return;
    eveningModalAutoOpenedRef.current = today;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('kaizen:eveningModalDate', today);
    } catch (_) {}
    setShowEveningModal(true);
  }, [now, today, eveningMode]);

  /** In night-owl mode, keep user on Now (hide Garden tab). */
  useEffect(() => {
    if (eveningMode === 'night-owl' && activeTab === 'garden') {
      setActiveTab('today');
    }
  }, [eveningMode, activeTab]);

  /** When opening dashboard from Command Center with #/garden, switch to Garden tab and clear hash. */
  useEffect(() => {
    if (window.location.hash === '#/garden') {
      setActiveTab('garden');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  /** When navigating from Plan with a modal to open, open it and clear the flag. */
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    const modal = sessionStorage.getItem('kaizen:openModal');
    if (!modal) return;
    sessionStorage.removeItem('kaizen:openModal');
    if (modal === 'chat') setShowChat(true);
    else if (modal === 'compost') setShowCompost(true);
    else if (modal === 'mirror') setShowSpiritMirror(true);
    else if (modal === 'accessibility') setShowAccessibilityModal(true);
    else if (modal === 'tour') setShowTour(true);
  }, []);

  const [spiritInsight, setSpiritInsight] = useState(() => {
    const { lastInsight, lastInsightDate } = getStoredBriefing();
    const today = localISODate();
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
        const gid = a && typeof a === 'object' ? (a.goalId ?? a.parentGoalId) : a;
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

  /** Auto-Plan Week: fill week from goals + calendar, save to plan, then toast. Used by WeeklyMap in Plan tab. */
  const handleAutoPlanWeek = useCallback(async () => {
    setAutoFillLoading(true);
    try {
      const weekStart = getDefaultWeekStart();
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      let allEvents = [];
      if (googleToken || msToken) {
        const fetches = [];
        if (googleToken) fetches.push(fetchGoogleEvents(googleToken, weekStart, weekEnd).catch(() => []));
        if (msToken) fetches.push(fetchOutlookEvents(msToken, weekStart, weekEnd).catch(() => []));
        const results = await Promise.all(fetches);
        allEvents = results.flat();
        updateWeeklyEvents(allEvents);
      }

      const filled = autoFillWeek(goals ?? [], allEvents, weekStart);
      const saves = Object.entries(filled).map(([dateStr, dayAssigns]) =>
        saveDayPlanForDate(dateStr, dayAssigns)
      );
      await Promise.all(saves);
      if (typeof pushReward === 'function') {
        pushReward({ message: '✨ Week successfully planned!', tone: 'moss', icon: '✨', durationMs: 2800 });
      }
    } catch (e) {
      console.warn('Auto-Plan Week failed', e);
      if (typeof pushReward === 'function') {
        pushReward({ message: 'Planning failed. Try again or check your calendar connection.', tone: 'slate', icon: '⚠️', sound: null });
      }
    } finally {
      setAutoFillLoading(false);
    }
  }, [goals, googleToken, msToken, updateWeeklyEvents, saveDayPlanForDate, pushReward]);

  const handlePlanWeek = useCallback(async () => {
    setPlanningWeek(true);
    try {
      const evts = Array.isArray(weeklyEvents) ? weeklyEvents : [];
      const energyProfile = { spoonCount: dailySpoonCount ?? 8 };
      const northStarTitle = weeklyNorthStarId ? goals?.find((g) => g.id === weeklyNorthStarId)?.title : null;
      const weekPlan = await generateWeeklyPlan(goals, evts, energyProfile, { northStarTitle, userSettings });
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
  }, [goals, weeklyEvents, dailySpoonCount, weeklyNorthStarId, userSettings, pushReward]);

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
    setIsGeneratingMonthPlan(true);
    setPendingMonthPlan(null);
    try {
      const now = new Date();
      const northStarTitle = weeklyNorthStarId ? goals?.find((g) => g.id === weeklyNorthStarId)?.title : null;
      const tasks = await generateMonthlyPlanTasks(goals, now.getMonth(), now.getFullYear(), { userSettings, northStarTitle });
      if (Array.isArray(tasks) && tasks.length > 0) {
        setPendingMonthPlan(tasks);
      } else if (typeof pushReward === 'function') {
        pushReward({ message: 'Monthly planning failed or returned no tasks. Check API key (VITE_GEMINI_API_KEY) or try again later.', tone: 'slate', icon: '🔌', sound: null });
      }
    } catch (e) {
      console.warn('Plan month failed', e);
      if (typeof pushReward === 'function') {
        pushReward({ message: 'Monthly planning failed. Try again later.', tone: 'slate', icon: '⚠️', sound: null });
      }
    } finally {
      setIsGeneratingMonthPlan(false);
    }
  }, [goals, userSettings, weeklyNorthStarId, pushReward]);

  const handleApplyMonthPlan = useCallback(() => {
    if (!Array.isArray(pendingMonthPlan) || pendingMonthPlan.length === 0 || typeof updateWeeklyEvents !== 'function') {
      setPendingMonthPlan(null);
      return;
    }
    const dayStart = userSettings?.dayStart ?? '09:00';
    const existing = Array.isArray(weeklyEvents) ? weeklyEvents : [];
    const cursorByDate = {};
    const newEvents = pendingMonthPlan.map((item) => {
      const base = new Date(`${item.date}T${dayStart}:00`);
      const cursor = cursorByDate[item.date];
      const start = cursor ? new Date(cursor.getTime()) : base;
      const end = new Date(start.getTime() + item.durationMinutes * 60 * 1000);
      cursorByDate[item.date] = end;
      return {
        title: item.title,
        start: start.toISOString(),
        end: end.toISOString(),
        ...(item.priority === true && { priority: true }),
      };
    });
    updateWeeklyEvents([...existing, ...newEvents]);
    setPendingMonthPlan(null);
    if (typeof pushReward === 'function') {
      pushReward({ message: '✨ Month plan applied to calendar!', tone: 'moss', icon: '✨', durationMs: 2000 });
    }
  }, [pendingMonthPlan, userSettings?.dayStart, weeklyEvents, updateWeeklyEvents, pushReward]);

  const handleDiscardMonthPlan = useCallback(() => {
    setPendingMonthPlan(null);
  }, []);

  const handleRebalance = useCallback(async (quota) => {
    if (!quota?.id || typeof saveDayPlanForDate !== 'function' || typeof loadDayPlan !== 'function') return;
    const remainingHours = Math.max(0, (quota.targetHours ?? 0) - (quota.loggedHours ?? 0));
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const availableDates = [];
    for (let d = today; d <= lastDay; d++) {
      const date = new Date(year, month, d);
      if (date.getDay() !== 0) availableDates.push(localISODate(date));
    }
    if (availableDates.length === 0 || remainingHours <= 0) {
      if (typeof pushReward === 'function') pushReward({ message: 'No days left or no hours to distribute.', tone: 'slate', icon: '⚠️', sound: null });
      return;
    }
    setRebalanceQuotaId(quota.id);
    const userEvents = (Array.isArray(weeklyEvents) ? weeklyEvents : []).slice(0, 50).map((e) => {
      const start = e.start ? new Date(e.start) : null;
      const end = e.end ? new Date(e.end) : null;
      if (!start) return null;
      return {
        date: localISODate(start),
        start: start.toTimeString().slice(0, 5),
        end: end ? end.toTimeString().slice(0, 5) : start.toTimeString().slice(0, 5),
      };
    }).filter(Boolean);
    try {
      const blocks = await rebalanceMonthQuota(remainingHours, availableDates, userEvents, { userSettings });
      setPendingPlan({ quota, blocks });
    } catch (e) {
      console.warn('Rebalance failed', e);
      if (typeof pushReward === 'function') pushReward({ message: 'Rebalance failed. Check API key or try again.', tone: 'slate', icon: '⚠️', sound: null });
    } finally {
      setRebalanceQuotaId(null);
    }
  }, [weeklyEvents, userSettings, saveDayPlanForDate, loadDayPlan, pushReward]);

  const handleApproveRebalance = useCallback(async () => {
    if (!pendingPlan?.quota || !Array.isArray(pendingPlan.blocks) || pendingPlan.blocks.length === 0) {
      setPendingPlan(null);
      return;
    }
    const { quota, blocks } = pendingPlan;
    if (typeof saveDayPlanForDate !== 'function' || typeof loadDayPlan !== 'function') {
      setPendingPlan(null);
      return;
    }
    const byDate = {};
    blocks.forEach((b) => {
      if (!byDate[b.date]) byDate[b.date] = [];
      byDate[b.date].push(b);
    });
    const quotaAssignment = { type: 'quota', quotaId: quota.id, title: quota.name ?? 'Quota' };
    try {
      for (const dateStr of Object.keys(byDate)) {
        const dayBlocks = byDate[dateStr];
        const current = await loadDayPlan(dateStr);
        const next = { ...current };
        Object.keys(next).forEach((h) => {
          const a = next[h];
          if (a && typeof a === 'object' && a.type === 'quota' && a.quotaId === quota.id) delete next[h];
        });
        dayBlocks.forEach((block) => {
          const startH = parseInt(String(block.startTime).slice(0, 2), 10);
          const endH = parseInt(String(block.endTime).slice(0, 2), 10);
          for (let h = startH; h < endH; h++) next[String(h)] = quotaAssignment;
        });
        await saveDayPlanForDate(dateStr, next);
      }
      if (typeof pushReward === 'function') pushReward({ message: 'Month rebalanced.', tone: 'moss', icon: '⚖️', durationMs: 2200 });
    } catch (e) {
      console.warn('Apply rebalance failed', e);
      if (typeof pushReward === 'function') pushReward({ message: 'Failed to apply plan. Try again.', tone: 'slate', icon: '⚠️', sound: null });
    }
    setPendingPlan(null);
  }, [pendingPlan, saveDayPlanForDate, loadDayPlan, pushReward]);

  const handleGardenGoalClick = useCallback((goal) => {
    setSeedForMilestones(goal);
  }, []);

  const handleOpenGoalCreatorFromPalette = useCallback((title) => {
    setGoalCreatorInitialTitle(title || '');
    setIsPlanting(true);
    setCommandPaletteOpen(false);
  }, []);

  const handleOmniAddParsedRoute = useCallback((result) => {
    if (!result || !result.title) return;
    if (result.type === 'calendar_event') {
      setScheduleEventPrefill({ title: result.title, startTime: result.startTime, endTime: result.endTime });
      setShowScheduleEventModal(true);
    } else {
      setGoalCreatorInitialTitle(result.title);
      setGoalCreatorInitialSubtasks([]);
      setGoalCreatorInitialIsFixed(result.isFixed);
      setGoalCreatorInitialContext(result.context);
      setGoalCreatorInitialRecurrence(result.recurrence);
      setGoalCreatorInitialEnergyCost(result.energyCost);
      setIsPlanting(true);
    }
  }, []);

  useEffect(() => {
    if (showScheduleEventModal) {
      if (scheduleEventPrefill?.title) {
        setScheduleEventTitle(scheduleEventPrefill.title);
        if (scheduleEventPrefill.startTime) {
          try {
            const d = new Date(scheduleEventPrefill.startTime);
            setScheduleEventDate(localISODate(d));
            setScheduleEventTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
          } catch (_) {}
        } else {
          setScheduleEventDate(localISODate());
          setScheduleEventTime('09:00');
        }
      } else {
        setScheduleEventTitle('');
        setScheduleEventDate(localISODate());
        setScheduleEventTime('09:00');
      }
    }
  }, [showScheduleEventModal, scheduleEventPrefill]);

  const handleScheduleEventSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      const title = scheduleEventTitle.trim();
      if (!title) return;
      setScheduleEventSaving(true);
      try {
        const [h, m] = scheduleEventTime.split(':').map((x) => parseInt(x, 10) || 0);
        const start = new Date(scheduleEventDate + 'T12:00:00');
        start.setHours(h, m, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const startTime = start.toISOString();
        const endTime = end.toISOString();
        if (googleToken) {
          const created = await createGoogleEvent(googleToken, { title, startTime, endTime });
          const evt = {
            id: created?.id ?? 'local-' + Date.now(),
            title,
            start: created?.start?.dateTime ?? startTime,
            end: created?.end?.dateTime ?? endTime,
            type: 'leaf',
            source: 'google',
          };
          updateWeeklyEvents([...(Array.isArray(weeklyEvents) ? weeklyEvents : []), evt]);
          pushReward?.({ message: 'Added to calendar', tone: 'moss', icon: '📅' });
        } else {
          pushReward?.({ message: 'Connect Google Calendar in Settings to add events.', tone: 'slate', icon: '📅' });
        }
        setShowScheduleEventModal(false);
        setScheduleEventPrefill(null);
      } catch (err) {
        console.warn('Schedule event failed', err);
        pushReward?.({ message: 'Could not add event. Try again.', tone: 'slate', icon: '⚠️' });
      } finally {
        setScheduleEventSaving(false);
      }
    },
    [scheduleEventTitle, scheduleEventDate, scheduleEventTime, googleToken, weeklyEvents, updateWeeklyEvents, pushReward]
  );

  const handlePlantFromPalette = useCallback((nextAssignments) => {
    setAssignments(nextAssignments);
    setActiveTab('today');
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

  /** Week date labels (Mon–Sun) for Plan view WeeklyMap. */
  const planWeekDateLabels = useMemo(() => {
    const weekStart = getDefaultWeekStart();
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return localISODate(d);
    });
  }, []);

  /** Events in shape WeeklyMap expects (date field for normalizeEvents). */
  const planWeeklyPlanForMap = useMemo(
    () =>
      (events || []).map((e) => ({
        ...e,
        date: e.start || e.end,
        type: e.type || 'leaf',
        title: e.title ?? 'Event',
      })),
    [events]
  );

  const filledSpoonTotal = useMemo(() => {
    let total = 0;
    for (const h of HOURS) {
      for (const a of getAssignmentsForHour(assignments, h)) {
        if (a && typeof a === 'object' && (a.type === 'recovery' || a.spoonCost === 0)) continue;
        const gid = typeof a === 'object' && 'goalId' in a ? a.goalId : (typeof a === 'string' ? a : a?.parentGoalId);
        const goal = gid ? goals.find((g) => g.id === gid) : null;
        total += getSpoonCost(goal ?? a);
      }
    }
    return total;
  }, [assignments, goals]);

  const stormWarnings = useMemo(() => {
    const options = { weekStartDate: getDefaultWeekStart(), startHour: 6, endHour: 23 };
    return getStormWarnings(goals, events, options);
  }, [goals, events]);

  const stormImpactToday = useMemo(() => {
    const todayDayIndex = new Date().getDay();
    const options = { weekStartDate: getDefaultWeekStart(), startHour: 6, endHour: 23, stormBufferMinutes: 30 };
    return getStormImpactForDay(events, todayDayIndex, options);
  }, [events]);
  const todaySpoonCount =
    lastCheckInDate === today && typeof dailySpoonCount === 'number' && dailySpoonCount >= 0 && dailySpoonCount <= 12
      ? dailySpoonCount
      : null;
  const maxSlots =
    todaySpoonCount != null
      ? todaySpoonCount
      : Math.max(1, (MAX_SLOTS_BY_WEATHER[weather] ?? 6) + dailyEnergyModifier);
  const isCompostOnlyDay = todaySpoonCount === 0;
  const isOverloaded = filledSpoonTotal > maxSlots;

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
    if (isOverloaded && activeTab === 'today') {
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
      const today = localISODate();
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
      for (const a of getAssignmentsForHour(assignments, hour)) {
        const goalId = typeof a === 'string' ? a : (a?.goalId ?? a?.parentGoalId);
        if (!goalId || seen.has(goalId)) continue;
        seen.add(goalId);
        const goal = goals?.find((g) => g.id === goalId);
        if (goal) out.push({ goalId, goal });
      }
    }
    return out;
  }, [assignments, goals]);

  /** Today plan items with hour for starter picker (prefer easiest / smallest first). */
  const todayPlanItemsWithHour = useMemo(() => {
    const out = [];
    for (const hour of HOURS) {
      for (const a of getAssignmentsForHour(assignments, hour)) {
        const goalId = typeof a === 'string' ? a : (a?.goalId ?? a?.parentGoalId);
        const goal = goals?.find((g) => g.id === goalId);
        if (!goal) continue;
        const ritualTitle = typeof a === 'object' && a.ritualTitle ? a.ritualTitle : null;
        const subtaskId = typeof a === 'object' && a.subtaskId ? a.subtaskId : null;
        out.push({ hour, goalId, goal, ritualTitle, subtaskId });
      }
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

  const LAST_OPEN_DATE_KEY = 'kaizen_last_open_date';
  const GENTLE_RESTART_DISMISSED_KEY = 'kaizen_gentle_restart_dismissed_date';
  const GENTLE_RESTART_LAST_COMPLETED_KEY = 'kaizen_gentle_restart_last_completed';

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !today) return;
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
  }, [hydrated, today]);

  const handleGentleRestartFreshStart = useCallback(() => {
    gentleResetToToday({ gapDays: gentleRestartGapDaysRef.current });
    try {
      if (today) {
        localStorage.setItem(LAST_OPEN_DATE_KEY, today);
        localStorage.setItem(GENTLE_RESTART_LAST_COMPLETED_KEY, today);
      }
    } catch (_) {}
    setShowGentleRestart(false);
  }, [gentleResetToToday, today]);

  const handleGentleRestartReviewCompost = useCallback(() => {
    try {
      if (today) localStorage.setItem(LAST_OPEN_DATE_KEY, today);
    } catch (_) {}
    setShowGentleRestart(false);
    setShowCompost(true);
  }, [today]);

  const handleGentleRestartDismiss = useCallback(() => {
    try {
      if (today) {
        localStorage.setItem(GENTLE_RESTART_DISMISSED_KEY, today);
        localStorage.setItem(LAST_OPEN_DATE_KEY, today);
      }
    } catch (_) {}
    setShowGentleRestart(false);
  }, [today]);

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
      .then(() => runCriticalMassCheck())
      .then(({ composted }) => {
        if (composted > 0) {
          pushReward({ message: 'Moved a dusty task to the Compost Heap to keep your view clean.', tone: 'moss', icon: '♻️', sound: null });
        }
      })
      .catch(() => {});
  }, [hydrated, archiveStalePlanItems, runCriticalMassCheck, pushReward]);

  const handleDismissStaleBanner = useCallback(() => setStaleArchivedCount(0), []);

  const handleSaveSeed = (goal) => {
    addGoal(goal);
    if (tourStep === 2) setTourStep(3);
    setIsPlanting(false);
    generateHabitSynergy(goal.title).then((result) => {
      if (result?.hasSynergy && result.suggestedHabitTitle) {
        setSynergySuggestion({
          goalId: goal.id,
          suggestedHabitTitle: result.suggestedHabitTitle,
          pitchText: result.pitchText || 'Pairs well with your new goal!',
        });
      }
    }).catch(() => {});
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
      setStartNowCandidate(candidate?.goal != null ? candidate : { goal: candidate });
    } else {
      setStartNowCandidate(null);
    }
    setShowStartNowModal(true);
  }, [todayTaskEntries]);

  /** Single frictionless "Help Me Start" for ADHD: pick first uncompleted goal (and first uncompleted subtask if any), set 5 min, launch focus overlay. */
  const handleHelpMeStart = useCallback(() => {
    const isGoalComplete = (g) => {
      const est = Number(g.estimatedMinutes) || 0;
      if (est <= 0) return false;
      return (Number(g.totalMinutes) || 0) >= est;
    };
    const goal = (goals ?? []).find((g) => !isGoalComplete(g));
    if (!goal) {
      setStartNowCandidate(null);
      setShowStartNowModal(true);
      return;
    }
    const subs = Array.isArray(goal.subtasks) ? goal.subtasks : [];
    const firstUncompletedSub = subs.find(
      (s) => (Number(s.completedHours) || 0) < (Number(s.estimatedHours) || 0.01)
    );
    setActiveSession({
      ...goal,
      sessionDurationMinutes: 5,
      subtaskId: firstUncompletedSub?.id ?? null,
    });
  }, [goals]);

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
  }, []);

  const handleTinyStepStartSession = useCallback(
    (goalId, _hour, _ritualTitle, subtaskId) => {
      const goal = goals?.find((g) => g.id === goalId);
      if (goal) handleStartNowStart({ goal, goalId, subtaskId }, 5);
    },
    [goals, handleStartNowStart]
  );

  const handleTinyStepMoveToCompost = useCallback(
    (suggestion) => {
      if (!suggestion?.title) return;
      addToCompost(suggestion.title);
      if (suggestion.goalId) clearAssignmentsForGoal(suggestion.goalId);
    },
    [addToCompost, clearAssignmentsForGoal]
  );

  const handleCompostStart5Min = useCallback(
    (compostItem) => {
      const text = (compostItem?.text ?? '').trim() || 'Tiny step';
      const id = crypto.randomUUID?.() ?? `goal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newGoal = { id, type: 'routine', title: text, estimatedMinutes: 5, totalMinutes: 0, createdAt: new Date().toISOString() };
      addGoal(newGoal);
      setActiveSession({ ...newGoal, sessionDurationMinutes: 5, subtaskId: null });
    },
    [addGoal]
  );

  const handleStartNowCreateSuggestion = useCallback((key) => {
    const STARTER_TITLES = { 'life-admin': 'One tiny life-admin thing', personal: 'One personal goal step', care: 'One care task' };
    const title = STARTER_TITLES[key] ?? 'One tiny step';
    const id = crypto.randomUUID?.() ?? `goal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newGoal = { id, type: 'routine', title, estimatedMinutes: 5, totalMinutes: 0, createdAt: new Date().toISOString() };
    addGoal(newGoal);
    const firstEmpty = HOURS.find((h) => getAssignmentsForHour(assignments, h).length === 0);
    if (firstEmpty) setAssignments((prev) => ({ ...prev, [firstEmpty]: [...getAssignmentsForHour(prev, firstEmpty), id] }));
    setActiveSession({ ...newGoal, sessionDurationMinutes: 5, subtaskId: null });
    setShowStartNowModal(false);
    setStartNowCandidate(null);
  }, [addGoal, assignments, setAssignments]);

  /** Guided empty state: add starter suggestion to plan and start 5 min focus. */
  const handleGuidedSuggestion = useCallback((key) => {
    handleStartNowCreateSuggestion(key);
  }, [handleStartNowCreateSuggestion]);

  /** Guided empty state: pick a goal for this week — assign to first slot and start 5 min. */
  const handleGuidedPickGoal = useCallback((goal) => {
    if (!goal?.id) return;
    const firstEmpty = HOURS.find((h) => getAssignmentsForHour(assignments, h).length === 0);
    if (firstEmpty) setAssignments((prev) => ({ ...prev, [firstEmpty]: [...getAssignmentsForHour(prev, firstEmpty), goal.id] }));
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
    const timeSpentMinutes = payload?.timeSpentMinutes ?? Math.max(1, activeSession?.sessionDurationMinutes ?? 25);
    const rating = payload?.rating;

    if (rating) {
      // Tea Ceremony completed inside FocusSession: rewards + close overlay
      addWater(1);
      earnEmbers(5);
      pushReward({ message: 'Ritual complete. Energy restored.', tone: 'moss', icon: '🍵', durationMs: 2800 });
      setCompletedTask({ ...activeSession, timeSpentMinutes });
      const taskId = activeSession?.id;
      const goalTitle = activeSession?.title ?? goals?.find((g) => g.id === taskId)?.title ?? 'Goal';
      if (taskId) {
        updateGoalProgress(taskId, timeSpentMinutes);
        if (activeSession?.subtaskId) {
          updateSubtaskProgress(taskId, activeSession.subtaskId, timeSpentMinutes / 60);
        }
        setGrowthToast(`Your ${goalTitle} has grown.`);
      }
      addLog({
        taskId,
        taskTitle: goalTitle,
        rating,
        note: '',
        date: new Date(),
        minutes: timeSpentMinutes,
      });
      if (soilNutrients > 0 && consumeSoilNutrients(1)) {
        earnEmbers(2);
        pushReward({ message: 'Compost paid off: +2 Embers', tone: 'moss', icon: '♻️✨', durationMs: 2800 });
      }
      const focusReward = buildReward({
        type: 'FOCUS_COMPLETE',
        payload: { goalTitle, minutes: timeSpentMinutes, spoonCount: todaySpoonCount ?? dailySpoonCount },
      });
      if (focusReward) {
        if (focusReward.variableBonus?.embers) earnEmbers(focusReward.variableBonus.embers);
        pushReward(focusReward);
      }
      setShowTeaCeremony(false);
      setJustFinishedSession(true);
      setShowSpiritDialogue(true);
      setTimeout(() => {
        setShowSpiritDialogue(false);
        setJustFinishedSession(false);
      }, 5000);
      setActiveSession(null);
      setCompletedTask(null);
      const goal = goals?.find((g) => g.id === taskId);
      if (goal) {
        if (goal.linkedVitalityGoalId) {
          const vg = goals?.find((g2) => g2.id === goal.linkedVitalityGoalId);
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
      return;
    }

    setCompletedTask({ ...activeSession, timeSpentMinutes });
    setShowTeaCeremony(true);
    setActiveSession(null);
  };

  /** Momentum chain: complete current session and start next subtask with 5m timer. */
  const handleStartNextStep = useCallback(
    (nextStep, payload) => {
      const timeSpentMinutes =
        payload?.timeSpentMinutes ?? Math.max(1, activeSession?.sessionDurationMinutes ?? 25);
      const taskId = activeSession?.id;
      const goalTitle = activeSession?.title ?? goals?.find((g) => g.id === taskId)?.title ?? 'Goal';

      addWater(1);
      earnEmbers(5);
      pushReward({ message: 'Ritual complete. Energy restored.', tone: 'moss', icon: '🍵', durationMs: 2800 });
      if (taskId) {
        updateGoalProgress(taskId, timeSpentMinutes);
        if (activeSession?.subtaskId) {
          updateSubtaskProgress(taskId, activeSession.subtaskId, timeSpentMinutes / 60);
        }
        setGrowthToast(`Your ${goalTitle} has grown.`);
      }
      addLog({
        taskId,
        taskTitle: goalTitle,
        rating: null,
        note: '',
        date: new Date(),
        minutes: timeSpentMinutes,
      });
      if (soilNutrients > 0 && consumeSoilNutrients(1)) {
        earnEmbers(2);
        pushReward({ message: 'Compost paid off: +2 Embers', tone: 'moss', icon: '♻️✨', durationMs: 2800 });
      }
      const focusReward = buildReward({
        type: 'FOCUS_COMPLETE',
        payload: { goalTitle, minutes: timeSpentMinutes, spoonCount: todaySpoonCount ?? dailySpoonCount },
      });
      if (focusReward) {
        if (focusReward.variableBonus?.embers) earnEmbers(focusReward.variableBonus.embers);
        pushReward(focusReward);
      }

      const parentGoal = goals?.find((g) => g.id === nextStep.goalId);
      if (parentGoal) {
        setActiveSession({
          ...parentGoal,
          title: nextStep.title,
          subtaskId: nextStep.id,
          sessionDurationMinutes: 5,
        });
      }
    },
    [
      activeSession,
      goals,
      addWater,
      earnEmbers,
      pushReward,
      updateGoalProgress,
      updateSubtaskProgress,
      setGrowthToast,
      addLog,
      soilNutrients,
      consumeSoilNutrients,
      buildReward,
      todaySpoonCount,
      dailySpoonCount,
    ]
  );

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

    // Habit Stack: if the completed task was a routine, check for a linked Kaizen goal/subtask and offer to start it
    const completedGoalForStack = taskId ? goals?.find((g) => g.id === taskId) : null;
    const wasRoutine = completedGoalForStack?.type === 'routine';
    let didSetHabitStack = false;
    if (wasRoutine && taskId) {
      let linkedGoal = (goals || []).find((g) => g.linkedRoutineId === taskId);
      let linkedSubtaskId = null;
      let linkedTitle = linkedGoal?.title ?? null;
      if (!linkedGoal) {
        for (const g of goals || []) {
          const st = (g.subtasks || []).find((s) => s.linkedRoutineId === taskId);
          if (st) {
            linkedGoal = g;
            linkedSubtaskId = st.id;
            linkedTitle = st.title ?? g.title;
            break;
          }
        }
      }
      if (linkedGoal) {
        const routineName = completedTask?.title ?? completedGoalForStack?.title ?? 'Routine';
        setHabitStackHandoff({ routineName, linkedGoal, linkedSubtaskId, linkedTitle });
        didSetHabitStack = true;
      }
    }

    // Next Step Prompter: if this task is part of a milestone sequence and we didn't show habit stack, suggest the next uncompleted task
    if (!didSetHabitStack) {
      const completedSubtaskId = completedTask?.subtaskId ?? log?.subtaskId;
      if (taskId && completedSubtaskId) {
        const nextStep = getNextTaskInSequence(goals, taskId, completedSubtaskId);
        if (nextStep) {
          const completedTitle = completedTask?.title ?? goal?.subtasks?.find((s) => s.id === completedSubtaskId)?.title ?? 'Task';
          setNextStepPrompt({ completedTitle, nextStep });
        }
      }
    }
  };

  /** Chain: User finishes SpiritOrigins → close it → (optionally) show Tour so Spirit explains the Compass. */
  const handleSpiritBorn = () => {
    setShowSpiritOrigins(false);
    if (isFirstDayFlow) {
      onFirstDayStepChange?.('spirit_tour');
    } else {
      setTimeout(() => setShowTour(true), 300);
    }
  };

  const handleSpiritSkip = () => {
    setSpiritConfig({ name: 'Mochi', type: 'mochi' });
    setShowSpiritOrigins(false);
  };

  const handleMilestoneCheck = (goalId, milestoneId, completed) => {
    updateGoalMilestone(goalId, milestoneId, completed);
    if (completed) {
      if (tourStep === 3) setTourStep(4);
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
        key={`focus-${activeSession.id ?? ''}-${activeSession.subtaskId ?? 'g'}`}
        activeTask={activeSession}
        durationSeconds={durationSeconds}
        goals={goals}
        onComplete={handleSessionComplete}
        onExit={() => setActiveSession(null)}
        onStartNextStep={handleStartNextStep}
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
            onComplete={(modifier, energyLevel) => {
              const level = energyLevel ?? modifier ?? 3;
              completeMorningCheckIn(level);
              if (tourStep === 1) setTourStep(2);
              setShowMorningCheckInModal(false);
              generateMorningBriefing(goals, today).then((items) => {
                if (Array.isArray(items) && items.length > 0) setMorningBriefing(items);
              });
              requestSpiritWisdom(false);
              const hasAnyAssignment = HOURS.some((h) => getAssignmentsForHour(assignments, h).length > 0);
              let planSummary = null;
              if (!hasAnyAssignment) {
                const eventsForPlan = Array.isArray(weeklyEvents) ? weeklyEvents : [];
                const slotCount = level >= 1 && level <= 10 ? level : (level >= 1 && level <= 5 ? (level <= 2 ? 2 + (level - 1) * 2 : level === 3 ? 6 : level === 4 ? 8 : 10) : 6);
                const startHour = hourFromTimeStr(userSettings?.dayStart, 8);
                const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
                const plan = generateDailyPlan(goals, slotCount, eventsForPlan, { stormBufferMinutes: 30, startHour, endHour });
                setAssignments(plan);
                planSummary = { slotCount: Object.keys(plan).length };
              }
              const reaction = getPlanReaction(level, planSummary);
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
      {activeTab !== 'garden' && activeTab !== 'settings' && (
      <header
        className={`border-b transition-colors ${
          isDark ? 'border-slate-700 bg-slate-800/80' : `border-stone-200 ${skyBg}`
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between gap-3 h-12">
          {/* Left: Date, Weather, Sync status */}
          <div className={`flex flex-wrap items-center gap-2 font-sans text-sm min-w-0 ${isDark ? 'text-slate-300' : 'text-stone-600'}`}>
            <p className={`font-serif text-xl md:text-2xl mr-1 ${isDark ? 'text-slate-100' : 'text-stone-900'}`}>
              {new Date(today + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <div className="flex items-center gap-1.5">
              <WeatherIcon />
              <span>{forecast}</span>
            </div>
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEnergyMenu((v) => !v)}
                className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg font-sans text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                  isDark ? 'text-slate-300 hover:bg-slate-700/60' : 'text-stone-700 hover:bg-stone-200/60'
                }`}
                aria-label="Energy level"
                aria-expanded={showEnergyMenu}
                aria-haspopup="true"
              >
                <motion.span
                  key={todaySpoonCount ?? dailyEnergy}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  className="flex items-center gap-0.5"
                >
                  <WoodenSpoon size={16} className="shrink-0" />
                  <span className="font-medium tabular-nums">{todaySpoonCount ?? dailyEnergy ?? 5}</span>
                </motion.span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-70"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              <AnimatePresence>
                {showEnergyMenu && (
                  <>
                    <div className="fixed inset-0 z-40" aria-hidden onClick={() => setShowEnergyMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-1 z-50 py-1.5 min-w-[7rem] rounded-xl bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-600 shadow-lg"
                    >
                      <p className="px-3 py-1 font-sans text-[10px] font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider">Sparks</p>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setEnergyLevel(n);
                            completeMorningCheckIn(n);
                            generateMorningBriefing(goals, today).then((items) => {
                              if (Array.isArray(items) && items.length > 0) setMorningBriefing(items);
                            });
                            setShowEnergyMenu(false);
                          }}
                          className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 font-sans text-sm transition-colors focus:outline-none focus:bg-stone-100 dark:focus:bg-slate-700 ${
                            (todaySpoonCount ?? dailyEnergy) === n
                              ? 'bg-moss-100 dark:bg-moss-900/30 text-moss-800 dark:text-moss-200 font-medium'
                              : 'text-stone-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          {n} <span aria-hidden>⚡</span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Toolbelt — Chat, Compost, Mirror, Dark mode, Accessibility, Tour (Settings is fixed top-right) */}
          <div className="flex items-center justify-end gap-3 h-12 shrink-0">
            <button
              id="mochi-chat-btn"
              type="button"
              onClick={() => setShowChat(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:scale-105 transition-transform cursor-pointer drop-shadow-sm"
              title="Talk to Mochi"
            >
              <span className="text-xl leading-none">{renderSpiritAvatar()}</span>
            </button>
            <button
              id="tour-compost"
              type="button"
              onClick={() => setShowCompost(true)}
              className={`w-10 h-10 flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
              }`}
              aria-label="Compost Heap"
              title="Compost Heap"
            >
              <span className="text-xl leading-none" aria-hidden>🍂</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSpiritMirror(true)}
              className={`w-10 h-10 flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200'
              }`}
              aria-label="Customize Spirit (Mirror)"
              title="Mirror"
            >
              <MirrorIcon />
            </button>
            <button
              type="button"
              onClick={() => setDarkModeOverride(!isDark)}
              className={`w-10 h-10 flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                isDark ? 'text-indigo-300 hover:text-indigo-200 hover:bg-slate-700/60' : 'text-stone-500 hover:text-indigo-600 hover:bg-stone-200'
              }`}
              aria-label="Dark mode"
              title="Toggle dark mode"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
            {eveningMode !== 'night-owl' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAccessibilityModal(true)}
                  className={`w-10 h-10 flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                    isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200'
                  }`}
                  aria-label="Accessibility & Comfort"
                  title="Accessibility & Comfort"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v4M12 14h.01M9 9l2 2-2 2" />
                  </svg>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowTour(true)}
              className={`w-10 h-10 flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-200'
              }`}
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
      )}

      {/* Persistent top header: Settings (fixed top-right) */}
      <div className="fixed top-4 right-4 z-50 pointer-events-auto">
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'settings' ? 'today' : 'settings')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-900/80 backdrop-blur-md border border-white/10 shadow-lg text-stone-200 hover:text-white hover:bg-stone-800/90 transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/50"
          aria-label={activeTab === 'settings' ? 'Back' : 'Settings'}
          title={activeTab === 'settings' ? 'Back' : 'Settings'}
        >
          <span className="text-xl leading-none" aria-hidden>{activeTab === 'settings' ? '←' : '⚙️'}</span>
        </button>
      </div>

      {activeTab === 'garden' ? (
        <div className="flex-1 min-h-0 relative pt-0 pb-20">
          <GardenWalk goals={goals} onCompost={handleCompostGoal} onGoalClick={handleGardenGoalClick} onOpenGoalCreator={() => setIsPlanting(true)} onEditGoal={editGoal} />
        </div>
      ) : activeTab === 'settings' ? (
        <main className="flex-1 w-full min-w-0 px-3 sm:px-4 py-6 sm:py-8 max-w-2xl mx-auto relative pb-28 sm:pb-24 pt-14 safe-area-pb">
          <SettingsView onReplayTour={() => { setShowTour(true); setActiveTab('today'); }} />
        </main>
      ) : (
      <main className={`flex-1 w-full min-w-0 px-3 sm:px-4 py-6 sm:py-8 max-w-5xl mx-auto relative pb-28 sm:pb-24 safe-area-pb`}>
        {activeTab === 'today' && (
          <>
            {needsMorningCheckIn ? (
              <div id="guide-morning-checkin" className="flex flex-col items-center justify-center min-h-[50vh] px-4">
                <TourHighlight step={1} tooltip="Start here! Tell me how much energy you have today.">
                  <GuidedEmptyState
                    variant="needEnergy"
                    onSetSpoons={() => setShowMorningCheckInModal(true)}
                    lowStim={getSettings().lowStim}
                  />
                </TourHighlight>
              </div>
            ) : (
              <div className="flex flex-col gap-6 h-full">
                {/* Spirit's Briefing (Radar) — shown after morning check-in when AI returns items */}
                {morningBriefing.length > 0 && (
                  <div className={`rounded-2xl border-2 p-4 shadow-lg ${isDark ? 'border-indigo-500/50 bg-slate-800/90' : 'border-indigo-300 bg-indigo-50/80'}`}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h2 className="font-sans text-lg font-bold text-indigo-800 dark:text-indigo-200 flex items-center gap-2">
                        <span aria-hidden>📡</span> Spirit&apos;s Briefing
                      </h2>
                      <button
                        type="button"
                        onClick={() => setMorningBriefing([])}
                        className="font-sans text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded px-2 py-1"
                        aria-label="Dismiss briefing"
                      >
                        ✕ Dismiss
                      </button>
                    </div>
                    <ul className="space-y-2">
                      {morningBriefing.map((item, i) => (
                        <li key={i} className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ${isDark ? 'bg-slate-700/50' : 'bg-white/80'}`}>
                          <span className="font-sans text-sm font-medium text-stone-800 dark:text-stone-200 flex-1 min-w-0">{item.title}</span>
                          {item.category && (
                            <span className="font-sans text-xs text-stone-500 dark:text-stone-400 shrink-0">{item.category}</span>
                          )}
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(item.searchQuery)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-sans text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                          >
                            🔍 Verify
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Left: Focus area — Help Me Start + current/next task */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <button
                    type="button"
                    onClick={handleHelpMeStart}
                    className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-lg font-bold rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex justify-center items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2"
                    aria-label="Help me start — 5 minute focus on one task"
                  >
                    <span aria-hidden>✨</span>
                    <span>Help Me Start</span>
                  </button>
                  {(nextUpItems ?? []).length > 0 && (
                    <div className="relative w-full p-5 rounded-2xl border-2 border-moss-400 bg-moss-50/80 shadow-lg before:absolute before:-inset-1 before:bg-indigo-400/30 before:rounded-3xl before:animate-pulse before:-z-10">
                      <p className="font-sans text-xs font-semibold text-moss-700 uppercase tracking-wider mb-2">Current / Next</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="font-sans text-lg font-semibold text-stone-900 block truncate">{(nextUpItems[0]?.title ?? nextUpItems[0]?.goal?.title) ?? 'Task'}</span>
                          <span className="font-sans text-sm text-stone-500">
                            {(nextUpItems[0]?.estimatedMinutes ?? nextUpItems[0]?.goal?.estimatedMinutes) ?? 0}m
                            {(nextUpItems[0]?.spoonCost ?? nextUpItems[0]?.goal?.spoonCost) != null && (nextUpItems[0]?.spoonCost ?? nextUpItems[0]?.goal?.spoonCost) > 0
                              ? ` · ${nextUpItems[0]?.spoonCost ?? nextUpItems[0]?.goal?.spoonCost} spoon${(nextUpItems[0]?.spoonCost ?? nextUpItems[0]?.goal?.spoonCost) !== 1 ? 's' : ''}`
                              : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStartNowStart({ goal: nextUpItems[0]?.goal, goalId: nextUpItems[0]?.goalId, subtaskId: nextUpItems[0]?.subtaskId }, 5)}
                          className="shrink-0 px-5 py-2.5 rounded-xl font-sans text-sm font-medium bg-moss-600 text-stone-50 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                        >
                          Start 5 min
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {/* Right: Day Planner — always visible, scrollable */}
                <div className="lg:col-span-7">
                  <TourHighlight step={3} tooltip="Click the checkbox to complete it and earn your first Ember.">
                    <div
                      id="tour-timeline"
                      className="overflow-y-auto max-h-[80vh] rounded-2xl border border-white/20 bg-white/90 backdrop-blur-md shadow-xl p-4"
                      style={{ boxShadow: '0 8px 32px -8px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.5)' }}
                    >
                      <ScheduleErrorBoundary onCollapse={() => {}}>
                        <TimeSlicer
                        zenMode
                        weather={weather ?? 'sun'}
                        goals={Array.isArray(goals) ? goals : []}
                        todayRitualItems={Array.isArray(todayRitualItems) ? todayRitualItems : []}
                        goalBank={Array.isArray(goalBank) ? goalBank : []}
                        dailyEnergyModifier={dailyEnergyModifier ?? 0}
                        dailySpoonCount={todaySpoonCount}
                        assignments={assignments && typeof assignments === 'object' ? assignments : {}}
                        onAssignmentsChange={setAssignments}
                        calendarEvents={Array.isArray(events) ? events : []}
                        onStartFocus={handleStartSession}
                        hideCapacityOnMobile={isMobileNav}
                        onSeedClick={(goal) => setSeedForMilestones(goal)}
                        onMilestoneCheck={handleMilestoneCheck}
                        onEditGoal={(goal) => setEditingGoal(goal)}
                        onCompostGoal={handleCompostGoal}
                        onAddRoutineTime={handleAddRoutineTime}
                        onAddSubtask={addSubtask}
                        onLoadLightened={handleLoadLightened}
                        onOpenGoalCreator={() => setIsPlanting(true)}
                        googleToken={googleToken}
                        onPlanWeek={handlePlanWeek}
                        onPlanMonth={handlePlanMonth}
                        planningMonth={isGeneratingMonthPlan}
                        planningWeek={planningWeek}
                        weekPreview={weekPreview}
                        onConfirmWeekPlan={handleConfirmWeekPlan}
                        onDiscardWeekPlan={handleDiscardWeekPlan}
                        monthlyRoadmap={monthlyRoadmap}
                      />
                      </ScheduleErrorBoundary>
                    </div>
                  </TourHighlight>
                </div>
                </div>
              </div>
            )}
          </>
        )}
        {activeTab === 'planner' && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex justify-center p-2 mb-6">
              <div className="flex gap-2 bg-stone-200/50 backdrop-blur-md p-1 rounded-full border border-white/50">
                <button
                  type="button"
                  onClick={() => setPlanView('calendar')}
                  className={`px-4 py-2 rounded-full font-medium transition-all ${planView === 'calendar' ? 'bg-white shadow-md text-indigo-600' : 'text-stone-600 hover:text-stone-800'}`}
                >
                  📅 Calendar
                </button>
                <button
                  type="button"
                  onClick={() => setPlanView('projects')}
                  className={`px-4 py-2 rounded-full font-medium transition-all ${planView === 'projects' ? 'bg-white shadow-md text-indigo-600' : 'text-stone-600 hover:text-stone-800'}`}
                >
                  🗂️ Projects
                </button>
                <button
                  type="button"
                  onClick={() => setPlanView('routines')}
                  className={`px-4 py-2 rounded-full font-medium transition-all ${planView === 'routines' ? 'bg-white shadow-md text-indigo-600' : 'text-stone-600 hover:text-stone-800'}`}
                >
                  🔁 Routines
                </button>
              </div>
            </div>

            {planView === 'calendar' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <CalendarView
                    goals={goals}
                    weeklyEvents={Array.isArray(weeklyEvents) ? weeklyEvents : []}
                    weekAssignments={weekAssignments ?? {}}
                    loadDayPlan={loadDayPlan}
                    saveDayPlanForDate={saveDayPlanForDate}
                    onAutoPlanWeek={handleAutoPlanWeek}
                    onRebalance={handleRebalance}
                    monthlyQuotas={monthlyQuotas ?? []}
                    rebalanceLoading={rebalanceQuotaId != null}
                    autoPlanLoading={autoFillLoading}
                  />
                </div>
                <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <h2 className="font-serif text-stone-800 text-lg mb-2">Monthly Quotas</h2>
                  <p className="font-sans text-sm text-stone-500 mb-4">Set a target (e.g. 60 hours for a client). Track logged hours. Rebalance from the Calendar header spreads remaining hours.</p>
                  <div className="space-y-4">
                    {(Array.isArray(monthlyQuotas) ? monthlyQuotas : []).map((quota) => (
                      <div
                        key={quota.id}
                        className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-stone-200 bg-stone-50/80"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-sans font-medium text-stone-800 truncate">{quota.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={quota.loggedHours ?? 0}
                              onChange={(e) => updateMonthlyQuota(quota.id, { loggedHours: Number(e.target.value) || 0 })}
                              className="w-14 py-1 px-2 rounded border border-stone-200 bg-white font-sans text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                            />
                            <span className="font-sans text-sm text-stone-500">h logged / {quota.targetHours ?? 0}h target</span>
                            <span className="font-sans text-sm text-moss-600 font-medium">{Math.max(0, (quota.targetHours ?? 0) - (quota.loggedHours ?? 0))}h left</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRebalance(quota)}
                          disabled={rebalanceQuotaId != null}
                          className="shrink-0 px-4 py-2 rounded-xl font-sans text-sm font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                        >
                          {rebalanceQuotaId === quota.id ? '…' : '⚖️ Rebalance Month'}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-stone-200">
                    <p className="font-sans text-sm font-medium text-stone-600 mb-2">Add quota</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={newQuotaName}
                        onChange={(e) => setNewQuotaName(e.target.value)}
                        placeholder="e.g. Freelance Client"
                        className="flex-1 min-w-[140px] py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                      />
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={newQuotaHours}
                        onChange={(e) => setNewQuotaHours(Number(e.target.value) || 60)}
                        className="w-20 py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-stone-800 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                      />
                      <span className="font-sans text-sm text-stone-500">hours</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (newQuotaName.trim()) {
                            addMonthlyQuota({ name: newQuotaName.trim(), targetHours: newQuotaHours, loggedHours: 0, blocks: [] });
                            setNewQuotaName('');
                            setNewQuotaHours(60);
                          }
                        }}
                        className="px-4 py-2 rounded-xl font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {planView === 'projects' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 shadow-sm">
                  <p className="font-sans text-sm text-stone-600 text-center mb-4">Project planner opens above. Use Horizons below to see your roadmap.</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <HorizonsGantt
                    goals={goals}
                    onGoalClick={(goal) => setEditingGoal(goal)}
                    onDeleteGoal={deleteGoal}
                    onToggleMilestone={toggleMilestone}
                    onUpdateSubtask={updateSubtask}
                    onEditGoal={editGoal}
                    onAddMilestone={addMilestone}
                    onUpdateMilestone={updateMilestone}
                    onDeleteMilestone={deleteMilestone}
                    onAddSubtask={addSubtask}
                    onDeleteSubtask={deleteSubtask}
                  />
                </div>
              </div>
            )}

            {planView === 'routines' && (
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <RoutinesManager />
              </div>
            )}

            <AnimatePresence>
              {pendingPlan && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/50 backdrop-blur-sm"
                  onClick={() => setPendingPlan(null)}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="review-plan-heading"
                >
                  <motion.div
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 24, opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden"
                  >
                    <h2 id="review-plan-heading" className="font-serif text-stone-900 text-xl font-bold p-4 pb-2 shrink-0">
                      ✨ AI Plan Generated. Do you agree?
                    </h2>
                    <p className="font-sans text-sm text-stone-500 px-4 pb-4 shrink-0">
                      {pendingPlan.quota?.name ?? 'Quota'} — {pendingPlan.blocks?.length ?? 0} blocks
                    </p>
                    <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-4">
                      <ul className="space-y-2" role="list">
                        {(pendingPlan.blocks ?? []).map((block, idx) => {
                          const startH = parseInt(String(block.startTime).slice(0, 2), 10);
                          const endH = parseInt(String(block.endTime).slice(0, 2), 10);
                          const hours = Math.max(0, (endH - startH) || 1);
                          const dateLabel = block.date
                            ? new Date(block.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                            : block.date;
                          return (
                            <li
                              key={idx}
                              className="flex justify-between items-center py-3 px-3 rounded-xl bg-stone-50 border border-stone-100"
                            >
                              <div>
                                <span className="font-sans font-medium text-stone-800 block">{dateLabel}</span>
                                <span className="font-sans text-sm text-stone-500">
                                  {block.startTime} – {block.endTime} · {hours}h
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div className="flex gap-3 p-4 pt-2 border-t border-stone-200 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPendingPlan(null)}
                        className="flex-1 py-3.5 px-4 rounded-xl font-sans text-base font-semibold bg-stone-200 text-stone-800 hover:bg-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 transition-colors"
                      >
                        ❌ Discard
                      </button>
                      <button
                        type="button"
                        onClick={handleApproveRebalance}
                        className="flex-1 py-3.5 px-4 rounded-xl font-sans text-base font-semibold bg-moss-600 text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 transition-colors"
                      >
                        ✅ Approve & Apply
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
              {pendingMonthPlan && Array.isArray(pendingMonthPlan) && pendingMonthPlan.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/50 backdrop-blur-sm"
                  onClick={() => setPendingMonthPlan(null)}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="review-month-plan-heading"
                >
                  <motion.div
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 24, opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden"
                  >
                    <h2 id="review-month-plan-heading" className="font-serif text-stone-900 text-xl font-bold p-4 pb-2 shrink-0">
                      ✨ Monthly plan generated
                    </h2>
                    <p className="font-sans text-sm text-stone-500 px-4 pb-4 shrink-0">
                      Review the tasks below. Apply to add them to your calendar.
                    </p>
                    <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-4">
                      <ul className="space-y-2" role="list">
                        {pendingMonthPlan.map((item, idx) => {
                          const dateLabel = item.date
                            ? new Date(item.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                            : item.date;
                          return (
                            <li
                              key={idx}
                              className="flex justify-between items-center py-3 px-3 rounded-xl bg-stone-50 border border-stone-100"
                            >
                              <div>
                                <span className="font-sans font-medium text-stone-800 block">{item.title}</span>
                                <span className="font-sans text-sm text-stone-500">
                                  {dateLabel} · {item.durationMinutes} min
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div className="flex gap-3 p-4 pt-2 border-t border-stone-200 shrink-0">
                      <button
                        type="button"
                        onClick={handleDiscardMonthPlan}
                        className="flex-1 py-3.5 px-4 rounded-xl font-sans text-base font-semibold bg-stone-200 text-stone-800 hover:bg-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 transition-colors"
                      >
                        ❌ Discard
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyMonthPlan}
                        className="flex-1 py-3.5 px-4 rounded-xl font-sans text-base font-semibold bg-moss-600 text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 transition-colors"
                      >
                        ✅ Apply to Calendar
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {activeTab === 'today' && (
          <div className="mt-4 flex flex-wrap gap-4 font-sans text-sm">
            <button type="button" onClick={() => setShowJournalModal(true)} className="text-stone-500 hover:text-stone-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded">
              📔 Journal
            </button>
            <button type="button" id="tour-insights" onClick={() => setShowInsightsModal(true)} className="text-stone-500 hover:text-stone-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded">
              📊 Insights
            </button>
          </div>
        )}
      </main>
      )}

      {/* Floating glassmorphic bottom nav: Now / Plan / Garden */}
      <nav
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-stone-900/80 backdrop-blur-md px-4 sm:px-6 py-3 rounded-full flex gap-4 sm:gap-8 shadow-2xl border border-white/10 safe-area-pb"
        aria-label="Main navigation"
      >
        <button
          type="button"
          onClick={() => setActiveTab('today')}
          className={`flex items-center gap-2 min-w-[44px] min-h-[44px] justify-center rounded-full px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${activeTab === 'today' ? 'bg-white/20 text-amber-300' : 'text-stone-400 hover:text-stone-200'}`}
          aria-current={activeTab === 'today' ? 'page' : undefined}
          aria-label="Now"
        >
          <span className="text-2xl sm:text-xl" aria-hidden>⚡</span>
          <span className="hidden sm:inline text-sm font-medium">Now</span>
        </button>
        <button
          type="button"
          id="tour-horizons"
          onClick={() => { window.location.hash = '#/plan'; }}
          className="flex items-center gap-2 min-w-[44px] min-h-[44px] justify-center rounded-full px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 text-stone-400 hover:text-stone-200"
          aria-label="Open Command Center (Plan)"
        >
          <span className="text-2xl sm:text-xl" aria-hidden>🗺️</span>
          <span className="hidden sm:inline text-sm font-medium">Plan</span>
        </button>
        {eveningMode !== 'night-owl' && (
          <button
            type="button"
            id="guide-garden-tab"
            onClick={() => setActiveTab('garden')}
            className={`flex items-center gap-2 min-w-[44px] min-h-[44px] justify-center rounded-full px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${activeTab === 'garden' ? 'bg-white/20 text-moss-400' : 'text-stone-400 hover:text-stone-200'}`}
            aria-current={activeTab === 'garden' ? 'page' : undefined}
            aria-label="Garden"
          >
            <span className="text-2xl sm:text-xl" aria-hidden>🌱</span>
            <span className="hidden sm:inline text-sm font-medium">Garden</span>
          </button>
        )}
      </nav>

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

      <div id="guide-omni-add" className="relative">
        <TourHighlight step={2} tooltip="Great. Now add one tiny micro-habit to your list.">
        <OmniAdd
          onOpenGoalCreator={(title) => {
            setGoalCreatorInitialTitle(title ?? '');
            setGoalCreatorInitialSubtasks([]);
            setIsPlanting(true);
          }}
          onOpenScheduleEvent={() => setShowScheduleEventModal(true)}
          onOpenBrainDump={() => setShowCompost(true)}
          onParsedRoute={handleOmniAddParsedRoute}
        />
      </TourHighlight>
      </div>

      <AnimatePresence>
        {showSpiritMirror && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/40 backdrop-blur-sm overflow-y-auto safe-area-pb"
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
              className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#FDFCF5] border border-stone-200 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setShowSpiritMirror(false)}
                aria-label="Close"
                className="absolute top-3 right-3 z-10 w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
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
        onClose={() => { setIsPlanting(false); setGoalCreatorInitialTitle(''); setGoalCreatorInitialSubtasks([]); setGoalCreatorInitialIsFixed(undefined); setGoalCreatorInitialContext(undefined); setGoalCreatorInitialRecurrence(undefined); setGoalCreatorInitialEnergyCost(undefined); }}
        onSave={handleSaveSeed}
        initialTitle={goalCreatorInitialTitle}
        initialSubtasks={goalCreatorInitialSubtasks}
        initialIsFixed={goalCreatorInitialIsFixed}
        initialContext={goalCreatorInitialContext}
        initialRecurrence={goalCreatorInitialRecurrence}
        initialEnergyCost={goalCreatorInitialEnergyCost}
        existingRoutineGoals={(goals ?? []).filter((g) => g.type === 'routine')}
        existingVitalityGoals={(goals ?? []).filter((g) => g.type === 'vitality')}
        ritualCategories={userSettings?.ritualCategories ?? []}
        onAddRitualCategory={addRitualCategory}
        onOpenProjectPlanner={() => setShowProjectPlanner(true)}
      />

      <ProjectPlanner
        open={showProjectPlanner || (activeTab === 'planner' && planView === 'projects')}
        onClose={() => {
          setShowProjectPlanner(false);
          setProjectPlannerPrefill({ prefillTitle: '', prefillParentGoalId: '' });
          if (activeTab === 'planner') setPlanView('calendar');
        }}
        onCreateGoals={handleProjectGoals}
        prefillTitle={projectPlannerPrefill.prefillTitle}
        prefillParentGoalId={projectPlannerPrefill.prefillParentGoalId}
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

      {/* Journal & Insights full-screen modals */}
      {showJournalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Journal"
          onClick={() => setShowJournalModal(false)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-stone-50 border border-stone-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-200 bg-stone-50/95 backdrop-blur-sm">
              <h2 className="font-serif text-lg text-stone-900">Journal</h2>
              <button
                type="button"
                onClick={() => setShowJournalModal(false)}
                aria-label="Close"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200"
              >
                ×
              </button>
            </div>
            <div className="flex-1 px-4 py-4 sm:py-6 overflow-y-auto">
              <div className="max-w-2xl mx-auto w-full">
                <JournalView />
              </div>
            </div>
          </div>
        </div>
      )}

      {showInsightsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Insights"
          onClick={() => setShowInsightsModal(false)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-stone-50 border border-stone-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-200 bg-stone-50/95 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg text-stone-900">Insights</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1 rounded-full bg-stone-100 border border-stone-200 px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => { setShowInsightsModal(false); setActiveTab('today'); }}
                    className="px-2 py-1 rounded-full text-xs font-sans text-stone-600 hover:text-amber-500 hover:bg-white"
                  >
                    Now
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowInsightsModal(false); window.location.hash = '#/plan'; }}
                    className="px-2 py-1 rounded-full text-xs font-sans text-stone-600 hover:text-moss-600 hover:bg-white"
                  >
                    Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowInsightsModal(false); setActiveTab('garden'); }}
                    className="px-2 py-1 rounded-full text-xs font-sans text-stone-600 hover:text-moss-600 hover:bg-white"
                  >
                    Garden
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInsightsModal(false)}
                  aria-label="Close"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 px-4 py-4 sm:py-6 overflow-y-auto">
              <div className="max-w-2xl mx-auto w-full">
                <AnalyticsView />
              </div>
            </div>
          </div>
        </div>
      )}

      <GoalEditor
        open={!!editingGoal}
        goal={editingGoal}
        onClose={() => setEditingGoal(null)}
        onSave={(updates) => { if (editingGoal?.id) editGoal(editingGoal.id, updates); setEditingGoal(null); }}
        addSubtask={addSubtask}
        updateSubtask={updateSubtask}
        deleteSubtask={deleteSubtask}
        onOpenProjectPlanner={(opts) => {
          setProjectPlannerPrefill({ prefillTitle: opts?.prefillTitle ?? '', prefillParentGoalId: opts?.prefillParentGoalId ?? '' });
          setEditingGoal(null);
          setShowProjectPlanner(true);
        }}
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

      <AnimatePresence>
        {showScheduleEventModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
            onClick={() => { setShowScheduleEventModal(false); setScheduleEventPrefill(null); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-event-title"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-2xl bg-stone-50 border border-stone-200 shadow-xl p-5"
            >
              <h2 id="schedule-event-title" className="font-serif text-stone-900 text-lg mb-4">📅 Schedule Event</h2>
              <form onSubmit={handleScheduleEventSubmit} className="space-y-4">
                <div>
                  <label htmlFor="schedule-event-name" className="block font-sans text-sm font-medium text-stone-600 mb-1">Title</label>
                  <input
                    id="schedule-event-name"
                    type="text"
                    value={scheduleEventTitle}
                    onChange={(e) => setScheduleEventTitle(e.target.value)}
                    placeholder="e.g. Team standup"
                    className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="schedule-event-date" className="block font-sans text-sm font-medium text-stone-600 mb-1">Date</label>
                    <input
                      id="schedule-event-date"
                      type="date"
                      value={scheduleEventDate}
                      onChange={(e) => setScheduleEventDate(e.target.value)}
                      className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="schedule-event-time" className="block font-sans text-sm font-medium text-stone-600 mb-1">Time</label>
                    <input
                      id="schedule-event-time"
                      type="time"
                      value={scheduleEventTime}
                      onChange={(e) => setScheduleEventTime(e.target.value)}
                      className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowScheduleEventModal(false); setScheduleEventPrefill(null); }}
                    className="flex-1 py-2.5 font-sans text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!scheduleEventTitle.trim() || scheduleEventSaving}
                    className="flex-1 py-2.5 font-sans text-sm font-medium text-white bg-moss-600 rounded-lg hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {scheduleEventSaving ? 'Adding…' : 'Add to Calendar'}
                  </button>
                </div>
              </form>
              <button
                type="button"
                onClick={() => { setShowScheduleEventModal(false); setScheduleEventPrefill(null); }}
                aria-label="Close"
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100"
              >
                ×
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      <NextStepPrompt
        open={!!nextStepPrompt}
        completedTitle={nextStepPrompt?.completedTitle}
        nextStep={nextStepPrompt?.nextStep}
        onAddToThisWeek={promoteTaskToThisWeek}
        onLeaveInVault={() => setNextStepPrompt(null)}
      />

      <HabitStackHandoffPrompt
        open={!!habitStackHandoff}
        routineName={habitStackHandoff?.routineName}
        linkedTaskTitle={habitStackHandoff?.linkedTitle}
        onStart={() => {
          if (habitStackHandoff?.linkedGoal) {
            handleStartNowStart(
              { goal: habitStackHandoff.linkedGoal, goalId: habitStackHandoff.linkedGoal.id, subtaskId: habitStackHandoff.linkedSubtaskId ?? null },
              5
            );
          }
          setHabitStackHandoff(null);
        }}
        onLater={() => setHabitStackHandoff(null)}
      />

      {synergySuggestion && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="synergy-modal-title"
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white border-2 border-stone-200 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="synergy-modal-title" className="font-serif text-lg text-stone-900 mb-2">
              💡 Mochi has a suggestion!
            </h2>
            <p className="font-sans text-sm text-stone-600 mb-5">{synergySuggestion.pitchText}</p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSynergySuggestion(null)}
                className="px-3 py-2 rounded-xl font-sans text-sm font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                No Thanks
              </button>
              <button
                type="button"
                onClick={() => {
                  if (synergySuggestion.goalId && synergySuggestion.suggestedHabitTitle) {
                    addSubtask(synergySuggestion.goalId, {
                      title: synergySuggestion.suggestedHabitTitle,
                      estimatedHours: 0.1,
                      completedHours: 0,
                    });
                    pushReward({ message: 'Added to stack! 🌱', tone: 'moss', icon: '🌱', sound: null });
                  }
                  setSynergySuggestion(null);
                }}
                className="px-4 py-2 rounded-xl font-sans text-sm font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                Add to Stack
              </button>
            </div>
          </div>
        </div>
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
          setTourSeen(true);
          if (isFirstDayFlow && firstDayStep === 'spirit_tour') {
            onFirstDayStepChange?.('done');
          }
        }}
      />

      {showAppGuide && (
        <FeatureTooltip
          targetId={GUIDE_STEPS[appGuideStep]?.targetId}
          message={GUIDE_STEPS[appGuideStep]?.message}
          onNext={() => updateUserSettings({ appGuideStep: appGuideStep === 5 ? -1 : appGuideStep + 1 })}
          onDismiss={() => updateUserSettings({ appGuideStep: -1 })}
          isLastStep={appGuideStep === 5}
        />
      )}
    </div>
    </>
  );
}

export default GardenDashboard;
