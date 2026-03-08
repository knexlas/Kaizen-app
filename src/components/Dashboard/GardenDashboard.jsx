import { useState, useEffect, useMemo, useCallback, useRef, Component, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { useTheme } from '../../context/ThemeContext';
import { useReward } from '../../context/RewardContext';
import { useEnergy } from '../../context/EnergyContext';
import WoodenSpoon from '../WoodenSpoon';
import { buildReward } from '../../services/dopamineEngine';
import { getSettings } from '../../services/userSettings';
import { pickStarterTask } from '../../services/startAssist';
import { localISODate, diffDays, weekdayIndexMon0, jsDayFromMon0, getWeekId } from '../../services/dateUtils';
import StartNowModal from '../StartAssist/StartNowModal';
import GentleRestartModal from '../Onboarding/GentleRestartModal';
import GuidedEmptyState from '../EmptyStates/GuidedEmptyState';
import AccessibilitySettingsModal from '../Settings/AccessibilitySettingsModal';
import GoalCreator from '../Goals/GoalCreator';
import ProjectPlanner from '../Projects/ProjectPlanner';
import HorizonsGantt from '../Horizons/HorizonsGantt';
import GoalEditor from '../Goals/GoalEditor';
import TimeSlicer, { HOURS, MAX_SLOTS_BY_WEATHER, getAssignmentsForHour } from './TimeSlicer';
import CompassWidget, { getCurrentSlotKey } from './CompassWidget';
import CommandPalette from './CommandPalette';
import OmniAdd from './OmniAdd';
import WeeklyMap from './WeeklyMap';
import MochiSpiritWithDialogue, { DefaultSpiritSvg, getSpiritGreeting, getPlanReaction } from './MochiSpirit';
import SpiritChat from './SpiritChat';
import CompostHeap from './CompostHeap';
import NextTinyStep, { isAssignmentFixed, useTinyStepSuggestions } from './NextTinyStep';
import { generateSpiritInsight, generateMorningBriefing, generateWeeklyPlan, generateMonthlyPlan, generateMonthlyPlanTasks, rebalanceMonthQuota, generateHabitSynergy } from '../../services/geminiService';
import { importICSFile, downloadICS, CALENDAR_PROVIDERS } from '../../services/calendarSyncService';
import { fetchOutlookEvents } from '../../services/microsoftCalendarService';
import { getStoredBriefing, setStoredBriefing } from '../../services/spiritBriefingStorage';
import { getNextTaskInSequence } from '../../services/nextStepService';
import { toCanonicalSlotKey, minutesToCanonicalSlotKey } from '../../services/schedulingConflictService';
import { createIntervention, getCurrentIntervention, removeFromQueue, HELPER_INTERVENTION_TYPES } from '../../services/helperInterventionService';
import NextStepPrompt from './NextStepPrompt';
import HabitStackHandoffPrompt from './HabitStackHandoffPrompt';
import SpiritProgression from './SpiritProgression';
import MorningCheckIn from './MorningCheckIn';
import EveningWindDown from './EveningWindDown';
import HabitNurseryModal from './HabitNurseryModal';
import FocusSession from '../Focus/FocusSession';
import TeaCeremony from '../Focus/TeaCeremony';
import SettingsView from './SettingsView';
import RoutinesManager from './RoutinesManager';
import { PlanDayDrawer, buildBacklogTasks, getPlanItemsForDate, formatHourKey } from '../CommandCenter/StagingArea';
import SpiritBuilder from '../Onboarding/SpiritBuilder';
import SpiritGuideTour, { SHORT_TOUR_STEPS } from '../Onboarding/SpiritGuideTour';
import SpiritOrigins from '../Onboarding/SpiritOrigins';
import TourHighlight from '../Onboarding/TourHighlight';
import FeatureTooltip from '../Onboarding/FeatureTooltip';
import SupportSuggestionCard from './SupportSuggestionCard';
import { PremiumPlannerShell, PremiumSection, PremiumSectionHeader, PremiumActionRow } from './PremiumPlannerPrimitives';
import PlanDayPanel from './PlanDayPanel';
import PlanMonthPanel from './PlanMonthPanel';
import PlanWeekPanel from './PlanWeekPanel';
import { getGoalSupportDomain, resolveSupportSuggestions, getActiveSupportDomainForWeek, getWeeklyPrompt, getSuggestionTemplate, createFromSupportSuggestion } from '../../services/domainSupportService';
import { fetchGoogleEvents, createGoogleEvent } from '../../services/googleCalendarService';
import { getTourSeen, setTourSeen, consumeTriggerTourFlag } from '../../services/onboardingStateService';
import { findAvailableSlots, generateLiquidSchedule, generateSolidSchedule, getDefaultWeekStart, getStormWarnings, getStormImpactForDay, timeToMinutes, minutesToTime, generateDailyPlan, materializeWeeklyPlan, getSpoonCost, hourFromTimeStr, suggestLoadLightening, autoFillWeek } from '../../services/schedulerService';
import { normalizeTaskCapture, toPlanAssignmentFromTask } from '../../services/taskCaptureService';
import { getPlannedHoursByScope } from '../../utils/plannedHoursAggregation';
import { startFocusCommand, planReliefCommand } from '../../services/coreCommands';

const GardenWalk = lazy(() => import('../Garden/GardenWalk'));
const JournalView = lazy(() => import('./JournalView'));
const AnalyticsView = lazy(() => import('./AnalyticsView'));

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

/** Returns weather key matching MAX_SLOTS_BY_WEATHER: 'storm' | 'leaf' | 'sun'. */
function getWeather(events) {
  if (!events?.length) return { weather: 'sun', forecast: 'Sunny' };
  const types = events.map((e) => e.type);
  if (types.includes('storm')) return { weather: 'storm', forecast: 'High Winds Forecast' };
  if (types.includes('leaf')) return { weather: 'leaf', forecast: 'Breeze Forecast' };
  return { weather: 'sun', forecast: 'Sunny' };
}

/** dayIndex: JS getDay() convention (0=Sun..6=Sat). Goals store ritual.days in this convention. */
function getRitualForToday(goal, dayIndex) {
  return goal?.rituals?.find((r) => Array.isArray(r.days) && r.days.includes(dayIndex));
}

/** Catches errors in expanded schedule so the app doesn't crash. */
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

function GardenDashboard() {
  const { goals, weeklyEvents, logs, spiritPoints, addGoal, updateGoalProgress, updateUserSettings, updateGoalMilestone, editGoal, deleteGoal, addSubtask, updateSubtask, deleteSubtask, updateSubtaskProgress, toggleMilestone, updateMilestone, addMilestone, deleteMilestone, promoteTaskToThisWeek, lastCheckInDate, completeMorningCheckIn, dailyEnergyModifier, dailySpoonCount, addLog, logMetric, googleUser, connectCalendar, disconnectCalendar, googleToken, updateWeeklyEvents, weeklyNorthStarId, cloudSaveStatus, spiritConfig, setSpiritConfig, compost, addToCompost, removeFromCompost, soilNutrients, consumeSoilNutrients, earnEmbers, addWater, today, assignments, setAssignments, gentleResetToToday, archiveStalePlanItems, compostStaleSeeds, runCriticalMassCheck, eveningMode, setEveningMode, userSettings, addRitualCategory, saveDayPlanForDate, loadDayPlan, weekAssignments, monthlyQuotas, addMonthlyQuota, updateMonthlyQuota, msUser, msToken, connectOutlook, disconnectOutlook, refreshOutlookToken, tourStep, setTourStep, pausedDays, needsRescheduling, rescheduleNeedsReschedulingItem, clearDaySchedule, spawnedVolumeBlocks, removeSpawnedVolumeBlock, stagingTaskStatus, setStagingTaskStatus } = useGarden();
  const { pushReward, lastGardenImpact, clearLastGardenImpact } = useReward();
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
  const GUIDE_STEPS = [
    { tab: 'today', targetId: 'guide-morning-checkin', message: ({ spiritName }) => `I’m ${spiritName}. Let’s start by checking your energy for today.` },
    { tab: 'today', targetId: 'guide-omni-add', message: () => 'Drop any task or thought here first. We can organize it together in seconds.' },
    { tab: 'today', targetId: 'tour-horizons', message: () => 'Open Plan next. I’ll help you shape this week without overloading it.' },
    { tab: 'planner', targetId: 'guide-planner-overview', message: () => 'This is your planning space: Day, Week, and Month. Keep it simple and realistic.' },
    { tab: 'planner', targetId: 'guide-planner-week', message: () => 'In Week view, move items from Unscheduled into days, then set times only when needed.' },
    { tab: 'planner', targetId: 'guide-garden-tab', message: () => 'Ready? Let’s go to the Garden so I can show you where growth happens.' },
    { tab: 'garden', targetId: 'guide-garden-canvas', message: () => 'This is your living garden. Every small step you complete is reflected here.' },
    { tab: 'garden', targetId: 'guide-garden-tools', message: ({ spiritName }) => `${spiritName} tip: use these tools to plant, water, and shape your space. Tap your spirit anytime if you want help deciding your next step.` },
  ];

  const yesterdayForPlan = useMemo(() => {
    if (!today) return localISODate(new Date(Date.now() - 864e5));
    const d = new Date(today + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return localISODate(d);
  }, [today]);
  const yesterdayPlan = lastCheckInDate === yesterdayForPlan ? { modifier: dailyEnergyModifier, spoonCount: dailySpoonCount } : null;

  /** Continuity: today and this week (Mon–Sun) from logs. weekTendingDays = distinct days with at least one log (rhythm, not streak). */
  const continuitySummary = useMemo(() => {
    const todayStr = today || localISODate();
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    const weekStart = localISODate(monday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekEnd = localISODate(sunday);
    let todaySessions = 0;
    let todayMinutes = 0;
    let weekSessions = 0;
    let weekMinutes = 0;
    const weekDates = new Set();
    (logs ?? []).forEach((log) => {
      const logDate = typeof log.date === 'string' ? log.date.slice(0, 10) : (log.date ? localISODate(new Date(log.date)) : '');
      if (!logDate) return;
      const mins = Number(log.minutes) || 0;
      if (logDate === todayStr) {
        todaySessions += 1;
        todayMinutes += mins;
      }
      if (logDate >= weekStart && logDate <= weekEnd) {
        weekSessions += 1;
        weekMinutes += mins;
        weekDates.add(logDate);
      }
    });
    return { todayStr, todaySessions, todayMinutes, weekSessions, weekMinutes, weekTendingDays: weekDates.size };
  }, [logs, today]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'planner' | 'garden' | 'settings'
  const [activeModal, setActiveModal] = useState(null); // 'journal' | 'insights' | 'chat' | 'compost' | 'mirror' | 'accessibility' | null
  const showJournalModal = activeModal === 'journal';
  const showInsightsModal = activeModal === 'insights';
  const [isNurseryOpen, setIsNurseryOpen] = useState(false);
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
  const [helperQueue, setHelperQueue] = useState([]); // unified Mochi interventions: next_step, habit_stack_handoff, support_suggestion
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  const [planningWeek, setPlanningWeek] = useState(false);
  const [weekPreview, setWeekPreview] = useState(null); // { [dateStr]: { [hour]: assignment } } for review before saving
  const [monthlyRoadmap, setMonthlyRoadmap] = useState(null);
  const [isGeneratingMonthPlan, setIsGeneratingMonthPlan] = useState(false);
  const [pendingMonthPlan, setPendingMonthPlan] = useState(null); // array of { title, date, durationMinutes } for review before applying
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const showSpiritMirror = activeModal === 'mirror';
  const [showProjectPlanner, setShowProjectPlanner] = useState(false);
  const [projectPlannerPrefill, setProjectPlannerPrefill] = useState({ prefillTitle: '', prefillParentGoalId: '' });
  const [horizonsView, setHorizonsView] = useState('planning'); // 'planning' | 'metrics'
  const [plannerPlanDayDateStr, setPlannerPlanDayDateStr] = useState(null); // day chosen in Planner to open PlanDayDrawer
  const [plannerScheduleDrawerPreSelect, setPlannerScheduleDrawerPreSelect] = useState(null); // pre-select task when opening schedule drawer from Horizons
  const [plannerViewMode, setPlannerViewMode] = useState('week'); // 'day' | 'week' | 'month' — Week default
  const [plannerDayExpanded, setPlannerDayExpanded] = useState(false); // Day lens starts collapsed
  const [plannerProjectsOpen, setPlannerProjectsOpen] = useState(false); // collapsible Projects & milestones
  const [plannerRoutinesOpen, setPlannerRoutinesOpen] = useState(false); // collapsible Routines
  const [rebalanceQuotaId, setRebalanceQuotaId] = useState(null);
  const [pendingPlan, setPendingPlan] = useState(null); // { quota, blocks } for Monthly Rebalance review
  const [pendingWeekPlan, setPendingWeekPlan] = useState(null); // { [dateStr]: dayAssigns } for Suggest my week review
  const [newQuotaName, setNewQuotaName] = useState('');
  const [newQuotaHours, setNewQuotaHours] = useState(60);
  const [showStartNowModal, setShowStartNowModal] = useState(false);
  const [startNowCandidate, setStartNowCandidate] = useState(null);
  const [showGentleRestart, setShowGentleRestart] = useState(false);
  const gentleRestartGapDaysRef = useRef(0);
  const [staleArchivedCount, setStaleArchivedCount] = useState(0);
  const hasRunArchiveStaleRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const showAccessibilityModal = activeModal === 'accessibility';
  const [showMorningCheckInModal, setShowMorningCheckInModal] = useState(false);
  const [morningBriefing, setMorningBriefing] = useState([]);
  const [goalCreatorInitialTitle, setGoalCreatorInitialTitle] = useState('');
  const [goalCreatorInitialSubtasks, setGoalCreatorInitialSubtasks] = useState([]);
  const [goalCreatorInitialIsFixed, setGoalCreatorInitialIsFixed] = useState(undefined);
  const [goalCreatorInitialContext, setGoalCreatorInitialContext] = useState(undefined);
  const [goalCreatorInitialRecurrence, setGoalCreatorInitialRecurrence] = useState(undefined);
  const [goalCreatorInitialEnergyCost, setGoalCreatorInitialEnergyCost] = useState(undefined);
  const [synergySuggestion, setSynergySuggestion] = useState(null); // { goalId, suggestedHabitTitle, pitchText } after creating a goal
  const [dismissedWeeklyDomainCardWeekId, setDismissedWeeklyDomainCardWeekId] = useState(null); // hide domain planning card for this week once dismissed
  const [now, setNow] = useState(() => new Date());
  const [showSpiritDialogue, setShowSpiritDialogue] = useState(false);
  const showChat = activeModal === 'chat';
  const showCompost = activeModal === 'compost';
  const [showScheduleEventModal, setShowScheduleEventModal] = useState(false);
  const [scheduleEventPrefill, setScheduleEventPrefill] = useState(null); // { title?, startTime?, endTime? }
  const [scheduleEventTitle, setScheduleEventTitle] = useState('');
  const [scheduleEventDate, setScheduleEventDate] = useState(() => localISODate());
  const [scheduleEventTime, setScheduleEventTime] = useState('09:00');
  const [scheduleEventDurationMinutes, setScheduleEventDurationMinutes] = useState(60);
  const [scheduleEventDurationCustom, setScheduleEventDurationCustom] = useState(false);
  const [scheduleEventEndTime, setScheduleEventEndTime] = useState('10:00');
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
  const [hasSeenTour, setHasSeenTour] = useState(() => getTourSeen());
  const [useShortTourSteps, setUseShortTourSteps] = useState(false);
  const [showSpiritOrigins, setShowSpiritOrigins] = useState(false);
  const [nowShowDetails, setNowShowDetails] = useState(false);
  const [plannerShowSecondary, setPlannerShowSecondary] = useState(false);
  const isLegacyTourActive = showTour || (typeof tourStep === 'number' && tourStep > 0 && tourStep < 5);
  const showAppGuide = hasSeenTour && !isLegacyTourActive && !showSpiritOrigins && appGuideStep >= 0 && appGuideStep < GUIDE_STEPS.length;

  const currentHelperIntervention = useMemo(() => getCurrentIntervention(helperQueue), [helperQueue]);
  const openModal = useCallback((modalKey) => setActiveModal(modalKey), []);
  const closeModal = useCallback((modalKey = null) => {
    setActiveModal((current) => {
      if (!modalKey) return null;
      return current === modalKey ? null : current;
    });
  }, []);

  const runStartFocus = useCallback((payload) => {
    const { goalToCreate, session } = startFocusCommand(payload);
    if (goalToCreate) addGoal(goalToCreate);
    if (session) setActiveSession(session);
    return session;
  }, [addGoal]);

  const dismissHelper = useCallback((id) => {
    setHelperQueue((prev) => removeFromQueue(prev, id));
  }, []);

  /** Route normalized capture into Goal Creator so quick-add and OmniAdd share one flow. */
  const openGoalCreatorFromCapture = useCallback((capture) => {
    if (!capture?.title) return;
    setGoalCreatorInitialTitle(capture.title);
    setGoalCreatorInitialSubtasks([]);
    setGoalCreatorInitialIsFixed(capture.isFixed);
    setGoalCreatorInitialContext(capture.context);
    setGoalCreatorInitialRecurrence(capture.recurrence);
    setGoalCreatorInitialEnergyCost(capture.energyCost);
    setIsPlanting(true);
  }, []);

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
      if (goal?.id || title) runStartFocus({ goal, title, minutes, subtaskId: null });
      closeModal('chat');
    };
    window.addEventListener('kaizen:startFocus', onStartFocus);
    return () => window.removeEventListener('kaizen:startFocus', onStartFocus);
  }, [runStartFocus, closeModal]);

  /** Show Spirit Origins when user data is loaded but no spirit config saved yet (e.g. returning user, migrated). */
  useEffect(() => {
    if (cloudSaveStatus !== 'loading' && !spiritConfig) {
      setShowSpiritOrigins(true);
    }
  }, [cloudSaveStatus, spiritConfig]);

  /** First-run "Show me around": open short tour only after spirit exists, then clear flag. */
  useEffect(() => {
    if (userSettings?.pendingShortTour === true && spiritConfig) {
      setUseShortTourSteps(true);
      setShowTour(true);
      updateUserSettings({ pendingShortTour: false });
    }
  }, [userSettings?.pendingShortTour, spiritConfig, updateUserSettings]);

  /** First-run "Start 5 min focus": open focus session for the micro-win goal and clear flag. */
  useEffect(() => {
    const pending = userSettings?.pendingStartFocus;
    if (!pending?.goalId || !goals?.length) return;
    const goal = goals.find((g) => g.id === pending.goalId);
    if (goal) {
      runStartFocus({ goal, minutes: 5, subtaskId: null });
      updateUserSettings({ pendingStartFocus: undefined });
    }
  }, [userSettings?.pendingStartFocus, goals, updateUserSettings, runStartFocus]);

  /** Trigger tour if fresh account (0 goals, 0 logs) and tour not seen — only after spirit is set so guide runs after spirit creation. */
  useEffect(() => {
    if ((goals?.length ?? 0) === 0 && (logs?.length ?? 0) === 0 && !hasSeenTour && spiritConfig) {
      setShowTour(true);
    }
  }, [goals?.length, logs?.length, spiritConfig, hasSeenTour]);

  /** Auto-trigger tour when user clicked Replay tour in Settings (legacy triggerTour flag). */
  useEffect(() => {
    if (!consumeTriggerTourFlag()) return;
    const t = setTimeout(() => setShowTour(true), 1000);
    return () => clearTimeout(t);
  }, []);

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

  /** Mochi comment when entering Garden tab after a recent garden impact (connects helper and garden). */
  useEffect(() => {
    if (activeTab !== 'garden' || !lastGardenImpact?.text) return;
    const age = Date.now() - (lastGardenImpact.at || 0);
    if (age > 120000) return; // older than 2 minutes
    if (lastGardenCommentAtRef.current === lastGardenImpact.at) return;
    lastGardenCommentAtRef.current = lastGardenImpact.at;
    setGardenCommentMessage('You just gave the garden a little love.');
    setShowSpiritDialogue(true); // show on Now tab if user switches back
    const t = setTimeout(() => {
      setGardenCommentMessage(null);
      setShowSpiritDialogue(false);
    }, 5000);
    return () => clearTimeout(t);
  }, [activeTab, lastGardenImpact?.text, lastGardenImpact?.at]);

  /** When navigating from Plan with a modal to open, open it and clear the flag. */
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    const modal = sessionStorage.getItem('kaizen:openModal');
    if (!modal) return;
    sessionStorage.removeItem('kaizen:openModal');
    if (modal === 'chat') openModal('chat');
    else if (modal === 'compost') openModal('compost');
    else if (modal === 'mirror') openModal('mirror');
    else if (modal === 'accessibility') openModal('accessibility');
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
  const lastGardenCommentAtRef = useRef(null);

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

  /** Suggest my week: fill week from goals + calendar, show review modal; user can Apply / Adjust / Discard. */
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
      setPendingWeekPlan(filled);
    } catch (e) {
      console.warn('Suggest my week failed', e);
      if (typeof pushReward === 'function') {
        pushReward({ message: 'Planning failed. Try again or check your calendar connection.', tone: 'slate', icon: '⚠️', sound: null });
      }
    } finally {
      setAutoFillLoading(false);
    }
  }, [goals, googleToken, msToken, updateWeeklyEvents, pushReward]);

  const handleApplyPendingWeekPlan = useCallback(async () => {
    if (!pendingWeekPlan || typeof saveDayPlanForDate !== 'function') return;
    try {
      const saves = Object.entries(pendingWeekPlan).map(([dateStr, dayAssigns]) =>
        saveDayPlanForDate(dateStr, dayAssigns)
      );
      await Promise.all(saves);
      setPendingWeekPlan(null);
      if (typeof pushReward === 'function') {
        pushReward({ message: '✨ Week applied!', tone: 'moss', icon: '✨', durationMs: 2800 });
      }
    } catch (e) {
      console.warn('Apply week plan failed', e);
      if (typeof pushReward === 'function') {
        pushReward({ message: 'Failed to apply. Try again.', tone: 'slate', icon: '⚠️', sound: null });
      }
    }
  }, [pendingWeekPlan, saveDayPlanForDate, pushReward]);

  const handleDiscardPendingWeekPlan = useCallback(() => {
    setPendingWeekPlan(null);
  }, []);

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

  const [plannerActionBusy, setPlannerActionBusy] = useState(null); // 'day' | 'week' | 'month' | null
  const [plannerChipBusy, setPlannerChipBusy] = useState(null); // 'protect' | 'reschedule' | 'split' | null
  const [plannerUndoOffer, setPlannerUndoOffer] = useState(null); // { label, changes: [{ dateStr, previous }] }

  const cloneDayPlan = useCallback((plan) => JSON.parse(JSON.stringify(plan ?? {})), []);
  const offerPlannerUndo = useCallback((label, changes) => {
    const normalized = (changes ?? []).map((c) => ({ dateStr: c.dateStr, previous: cloneDayPlan(c.previous) }));
    if (normalized.length === 0) return;
    setPlannerUndoOffer({ label, changes: normalized });
  }, [cloneDayPlan]);

  useEffect(() => {
    if (!plannerUndoOffer) return;
    const t = setTimeout(() => setPlannerUndoOffer(null), 9000);
    return () => clearTimeout(t);
  }, [plannerUndoOffer]);

  const handleUndoPlannerChip = useCallback(async () => {
    if (!plannerUndoOffer || typeof saveDayPlanForDate !== 'function') return;
    try {
      await Promise.all(
        plannerUndoOffer.changes.map((c) => saveDayPlanForDate(c.dateStr, c.previous ?? {}))
      );
      pushReward?.({ message: 'Planner action undone.', tone: 'moss', icon: 'S', durationMs: 2200 });
    } catch (e) {
      console.warn('Planner undo failed', e);
      pushReward?.({ message: 'Could not undo action.', tone: 'slate', icon: '!', sound: null });
    } finally {
      setPlannerUndoOffer(null);
    }
  }, [plannerUndoOffer, saveDayPlanForDate, pushReward]);

  const handleLightenTodayPlan = useCallback(async () => {
    if (!today || typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return;
    setPlannerActionBusy('day');
    try {
      const startHour = hourFromTimeStr(userSettings?.dayStart, 8);
      const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
      const dayCapacity = Math.max(1, endHour - startHour);
      const current = (await loadDayPlan(today)) ?? {};
      const result = suggestLoadLightening(
        current,
        goals ?? [],
        dayCapacity,
        dailyEnergyModifier ?? 0
      );
      if (!result) {
        pushReward?.({ message: 'Today already fits your capacity.', tone: 'moss', icon: 'OK', durationMs: 2200 });
        return;
      }
      await saveDayPlanForDate(today, result.assignments);
      const removedCount = result.removedItems?.length ?? 0;
      pushReward?.({
        message: removedCount > 0 ? `Lightened today: removed ${removedCount} item${removedCount === 1 ? '' : 's'}.` : 'Today lightened.',
        tone: 'moss',
        icon: 'S',
        durationMs: 2400,
      });
    } catch (e) {
      console.warn('Lighten today failed', e);
      pushReward?.({ message: 'Could not lighten today. Try again.', tone: 'slate', icon: '!', sound: null });
    } finally {
      setPlannerActionBusy(null);
    }
  }, [today, loadDayPlan, saveDayPlanForDate, goals, dailyEnergyModifier, pushReward, userSettings?.dayStart, userSettings?.dayEnd]);

  const findFirstFreeHourKey = useCallback((dayAssigns, startHour, endHour) => {
    const startMins = Math.floor(startHour * 60);
    const endMins = Math.min(Math.ceil(endHour * 60), 24 * 60);
    for (let m = startMins; m < endMins; m += 1) {
      const key = minutesToCanonicalSlotKey(m);
      if (key && !dayAssigns?.[key]) return key;
    }
    return null;
  }, []);

  const handleSuggestTodayPlan = useCallback(async () => {
    if (!today || typeof saveDayPlanForDate !== 'function') return;
    setPlannerActionBusy('day');
    try {
      const startHour = hourFromTimeStr(userSettings?.dayStart, 8);
      const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
      const slotCount =
        typeof dailySpoonCount === 'number' && dailySpoonCount >= 0 && dailySpoonCount <= 12
          ? Math.max(1, dailySpoonCount)
          : 6;
      const eventsForPlan = Array.isArray(weeklyEvents) ? weeklyEvents : [];
      const plan = generateDailyPlan(goals ?? [], slotCount, eventsForPlan, { stormBufferMinutes: 30, startHour, endHour });
      await saveDayPlanForDate(today, plan ?? {});
      setPlannerDayExpanded(true);
      pushReward?.({ message: 'Suggested a day plan.', tone: 'moss', icon: 'S', durationMs: 2200 });
    } catch (e) {
      console.warn('Suggest today plan failed', e);
      pushReward?.({ message: 'Could not suggest a day plan. Try again.', tone: 'slate', icon: '!', sound: null });
    } finally {
      setPlannerActionBusy(null);
    }
  }, [today, saveDayPlanForDate, userSettings?.dayStart, userSettings?.dayEnd, dailySpoonCount, weeklyEvents, goals, pushReward]);

  const handleQuickScheduleTodayTask = useCallback(async (task) => {
    if (!today || !task || typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return;
    try {
      const startHour = hourFromTimeStr(userSettings?.dayStart, 8);
      const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
      const day = (await loadDayPlan(today)) ?? {};
      const slot = findFirstFreeHourKey(day, startHour, endHour);
      const next = { ...day };
      if (!slot) {
        next.anytime = Array.isArray(next.anytime) ? [...next.anytime] : [];
        const anytimeAssignment = toPlanAssignmentFromTask(task, (goals ?? []).find((g) => g?.id === task.goalId));
        if (anytimeAssignment) next.anytime.push(anytimeAssignment);
        await saveDayPlanForDate(today, next);
        pushReward?.({ message: 'Added to today anytime list.', tone: 'moss', icon: 'S', durationMs: 2000 });
      } else {
        const goal = (goals ?? []).find((g) => g?.id === task.goalId);
        const scheduledAssignment = toPlanAssignmentFromTask(task, goal);
        if (!scheduledAssignment) return;
        next[slot] = scheduledAssignment;
        await saveDayPlanForDate(today, next);
        pushReward?.({ message: `Scheduled at ${slot}.`, tone: 'moss', icon: 'S', durationMs: 2000 });
      }
      setPlannerDayExpanded(true);
      setStagingTaskStatus?.((prev) => ({ ...(prev ?? {}), [task.id]: 'unscheduled_month' }));
    } catch (e) {
      console.warn('Quick schedule task failed', e);
      pushReward?.({ message: 'Could not add task to today.', tone: 'slate', icon: '!', sound: null });
    }
  }, [today, loadDayPlan, saveDayPlanForDate, userSettings?.dayStart, userSettings?.dayEnd, findFirstFreeHourKey, goals, pushReward, setStagingTaskStatus]);

  const handleShapeMonthWithAI = useCallback(async () => {
    setPlannerActionBusy('month');
    try {
      await handlePlanMonth();
    } finally {
      setPlannerActionBusy(null);
    }
  }, [handlePlanMonth]);

  const plannerWeekDates = useMemo(() => {
    const start = getDefaultWeekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return localISODate(d);
    });
  }, [today]);

  const handlePlannerChipProtectFocus = useCallback(async () => {
    if (typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return;
    setPlannerChipBusy('protect');
    setPlannerUndoOffer(null);
    try {
      const startHour = hourFromTimeStr(userSettings?.dayStart, 9);
      const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
      const dates = plannerViewMode === 'day' && today ? [today] : plannerWeekDates;
      const focusGoal = (weeklyNorthStarId && (goals ?? []).find((g) => g.id === weeklyNorthStarId))
        || (goals ?? []).find((g) => g?.id && g.type !== 'routine')
        || null;
      if (!focusGoal) {
        pushReward?.({ message: 'Add a goal first so I can protect focus time.', tone: 'slate', icon: '!', sound: null });
        return;
      }
      for (const dateStr of dates) {
        const day = (await loadDayPlan(dateStr)) ?? {};
        const slot = findFirstFreeHourKey(day, startHour, endHour);
        if (!slot) continue;
        const next = { ...day };
        next[slot] = {
          goalId: focusGoal.id,
          title: `Focus: ${focusGoal.title}`,
          type: focusGoal.type || 'kaizen',
          spoonCost: getSpoonCost(focusGoal),
          fixed: true,
        };
        offerPlannerUndo('Protected focus block', [{ dateStr, previous: day }]);
        await saveDayPlanForDate(dateStr, next);
        pushReward?.({ message: `Protected focus at ${slot}.`, tone: 'moss', icon: 'S', durationMs: 2200 });
        return;
      }
      pushReward?.({ message: 'No free slot available in this horizon.', tone: 'slate', icon: '!', sound: null });
    } catch (e) {
      console.warn('Planner chip protect focus failed', e);
      pushReward?.({ message: 'Could not protect focus block. Try again.', tone: 'slate', icon: '!', sound: null });
    } finally {
      setPlannerChipBusy(null);
    }
  }, [loadDayPlan, saveDayPlanForDate, userSettings?.dayStart, userSettings?.dayEnd, plannerViewMode, today, plannerWeekDates, weeklyNorthStarId, goals, findFirstFreeHourKey, pushReward, offerPlannerUndo]);

  const handlePlannerChipRescheduleOne = useCallback(async () => {
    if (typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return;
    setPlannerChipBusy('reschedule');
    setPlannerUndoOffer(null);
    try {
      const startHour = hourFromTimeStr(userSettings?.dayStart, 9);
      const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
      const dateOrder = plannerViewMode === 'day' && today ? [today] : plannerWeekDates;
      const dayPlans = await Promise.all(dateOrder.map(async (dateStr) => ({ dateStr, assigns: (await loadDayPlan(dateStr)) ?? {} })));
      const busiest = dayPlans
        .map((d) => ({ ...d, keys: Object.keys(d.assigns || {}).filter((k) => !!d.assigns[k]) }))
        .sort((a, b) => b.keys.length - a.keys.length)[0];
      if (!busiest || busiest.keys.length === 0) {
        pushReward?.({ message: 'Nothing to reschedule yet.', tone: 'slate', icon: '!', sound: null });
        return;
      }
      const fromKey = busiest.keys.sort((a, b) => timeToMinutes(b) - timeToMinutes(a))[0];
      const item = busiest.assigns[fromKey];
      const destination = dayPlans
        .filter((d) => d.dateStr !== busiest.dateStr)
        .map((d) => ({ ...d, freeKey: findFirstFreeHourKey(d.assigns, startHour, endHour) }))
        .find((d) => !!d.freeKey);
      if (!destination) {
        pushReward?.({ message: 'No destination slot found to reschedule.', tone: 'slate', icon: '!', sound: null });
        return;
      }
      const fromNext = { ...busiest.assigns };
      delete fromNext[fromKey];
      const toNext = { ...destination.assigns, [destination.freeKey]: item };
      offerPlannerUndo('Rescheduled one block', [
        { dateStr: busiest.dateStr, previous: busiest.assigns },
        { dateStr: destination.dateStr, previous: destination.assigns },
      ]);
      await saveDayPlanForDate(busiest.dateStr, fromNext);
      await saveDayPlanForDate(destination.dateStr, toNext);
      pushReward?.({ message: `Moved one block to ${destination.freeKey}.`, tone: 'moss', icon: 'S', durationMs: 2300 });
    } catch (e) {
      console.warn('Planner chip reschedule failed', e);
      pushReward?.({ message: 'Could not reschedule block. Try again.', tone: 'slate', icon: '!', sound: null });
    } finally {
      setPlannerChipBusy(null);
    }
  }, [loadDayPlan, saveDayPlanForDate, userSettings?.dayStart, userSettings?.dayEnd, plannerViewMode, today, plannerWeekDates, findFirstFreeHourKey, pushReward, offerPlannerUndo]);

  const handlePlannerChipSplitUrgent = useCallback(async () => {
    if (typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return;
    setPlannerChipBusy('split');
    setPlannerUndoOffer(null);
    try {
      const startHour = hourFromTimeStr(userSettings?.dayStart, 9);
      const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
      const base = today ? new Date(`${today}T00:00:00`) : new Date();
      const urgent = [];
      (goals ?? []).forEach((goal) => {
        (goal?.subtasks ?? []).forEach((st) => {
          if (!st?.deadline || !st?.title) return;
          const d = new Date(`${st.deadline}T00:00:00`);
          if (!Number.isFinite(d.getTime())) return;
          const days = Math.ceil((d.getTime() - base.getTime()) / 86400000);
          if (days < 0 || days > 7) return;
          const remainingHours = Math.max(0, (Number(st.estimatedHours) || 0) - (Number(st.completedHours) || 0));
          if (remainingHours < 1.5) return;
          urgent.push({ goal, st, days });
        });
      });
      urgent.sort((a, b) => a.days - b.days);
      const top = urgent[0];
      if (!top) {
        pushReward?.({ message: 'No urgent heavy task found to split.', tone: 'slate', icon: '!', sound: null });
        return;
      }
      const freeSlots = [];
      for (const dateStr of plannerWeekDates) {
        const day = (await loadDayPlan(dateStr)) ?? {};
        const key = findFirstFreeHourKey(day, startHour, endHour);
        if (key) freeSlots.push({ dateStr, key, day });
        if (freeSlots.length >= 2) break;
      }
      if (freeSlots.length < 2) {
        pushReward?.({ message: 'Need two free slots this week to split that task.', tone: 'slate', icon: '!', sound: null });
        return;
      }
      const a = freeSlots[0];
      const b = freeSlots[1];
      const partA = {
        goalId: top.goal.id,
        subtaskId: top.st.id,
        title: `${top.st.title} (Part 1/2)`,
        type: top.goal.type || 'kaizen',
        spoonCost: getSpoonCost(top.goal),
        fixed: false,
      };
      const partB = { ...partA, title: `${top.st.title} (Part 2/2)` };
      offerPlannerUndo('Split urgent task', [
        { dateStr: a.dateStr, previous: a.day },
        { dateStr: b.dateStr, previous: b.day },
      ]);
      await saveDayPlanForDate(a.dateStr, { ...a.day, [a.key]: partA });
      await saveDayPlanForDate(b.dateStr, { ...b.day, [b.key]: partB });
      pushReward?.({ message: 'Split one urgent task into two focus blocks.', tone: 'moss', icon: 'S', durationMs: 2400 });
    } catch (e) {
      console.warn('Planner chip split urgent failed', e);
      pushReward?.({ message: 'Could not split urgent task. Try again.', tone: 'slate', icon: '!', sound: null });
    } finally {
      setPlannerChipBusy(null);
    }
  }, [loadDayPlan, saveDayPlanForDate, userSettings?.dayStart, userSettings?.dayEnd, today, goals, plannerWeekDates, findFirstFreeHourKey, pushReward, offerPlannerUndo]);

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
          for (let h = startH; h < endH; h++) next[toCanonicalSlotKey(h)] = quotaAssignment;
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
    const capture = normalizeTaskCapture(result);
    if (capture.type === 'calendar_event') {
      setScheduleEventPrefill({ title: capture.title, startTime: capture.startTime, endTime: capture.endTime });
      setShowScheduleEventModal(true);
    } else {
      openGoalCreatorFromCapture(capture);
    }
  }, [openGoalCreatorFromCapture]);

  const EVENT_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
  const clampEventMinutes = useCallback((n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return 60;
    return Math.max(1, Math.min(480, Math.round(v)));
  }, []);
  const formatHHMM = useCallback((d) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }, []);
  const buildLocalDateTime = useCallback((dateStr, hhmm) => {
    const [h, m] = String(hhmm || '00:00').split(':').map((x) => parseInt(x, 10) || 0);
    const start = new Date(dateStr + 'T12:00:00');
    start.setHours(h, m, 0, 0);
    return start;
  }, []);
  const computeEndFromStartAndDuration = useCallback(
    ({ dateStr, startHHMM, durationMinutes }) => {
      const start = buildLocalDateTime(dateStr, startHHMM);
      const dur = clampEventMinutes(durationMinutes);
      const end = new Date(start.getTime() + dur * 60 * 1000);
      return { start, end, endTimeHHMM: formatHHMM(end), endsNextDay: localISODate(end) !== localISODate(start) };
    },
    [buildLocalDateTime, clampEventMinutes, formatHHMM]
  );
  const computeDurationFromStartAndEnd = useCallback(
    ({ dateStr, startHHMM, endHHMM }) => {
      const start = buildLocalDateTime(dateStr, startHHMM);
      let end = buildLocalDateTime(dateStr, endHHMM);
      if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      const dur = clampEventMinutes((end.getTime() - start.getTime()) / (60 * 1000));
      return { start, end, durationMinutes: dur, endsNextDay: localISODate(end) !== localISODate(start) };
    },
    [buildLocalDateTime, clampEventMinutes]
  );
  const isScheduleEventEndNextDay = useMemo(() => {
    if (!showScheduleEventModal) return false;
    try {
      const { endsNextDay } = computeDurationFromStartAndEnd({
        dateStr: scheduleEventDate,
        startHHMM: scheduleEventTime,
        endHHMM: scheduleEventEndTime,
      });
      return endsNextDay;
    } catch {
      return false;
    }
  }, [showScheduleEventModal, computeDurationFromStartAndEnd, scheduleEventDate, scheduleEventTime, scheduleEventEndTime]);

  const handleScheduleEventDateChange = useCallback(
    (nextDateStr) => {
      setScheduleEventDate(nextDateStr);
      const { endTimeHHMM } = computeEndFromStartAndDuration({
        dateStr: nextDateStr,
        startHHMM: scheduleEventTime,
        durationMinutes: scheduleEventDurationMinutes,
      });
      setScheduleEventEndTime(endTimeHHMM);
    },
    [computeEndFromStartAndDuration, scheduleEventTime, scheduleEventDurationMinutes]
  );
  const handleScheduleEventTimeChange = useCallback(
    (nextStartHHMM) => {
      setScheduleEventTime(nextStartHHMM);
      const { endTimeHHMM } = computeEndFromStartAndDuration({
        dateStr: scheduleEventDate,
        startHHMM: nextStartHHMM,
        durationMinutes: scheduleEventDurationMinutes,
      });
      setScheduleEventEndTime(endTimeHHMM);
    },
    [computeEndFromStartAndDuration, scheduleEventDate, scheduleEventDurationMinutes]
  );
  const handleScheduleEventDurationChange = useCallback(
    (nextMinutes) => {
      const mins = clampEventMinutes(nextMinutes);
      setScheduleEventDurationMinutes(mins);
      setScheduleEventDurationCustom(!EVENT_DURATION_OPTIONS.includes(mins));
      const { endTimeHHMM } = computeEndFromStartAndDuration({
        dateStr: scheduleEventDate,
        startHHMM: scheduleEventTime,
        durationMinutes: mins,
      });
      setScheduleEventEndTime(endTimeHHMM);
    },
    [clampEventMinutes, computeEndFromStartAndDuration, scheduleEventDate, scheduleEventTime]
  );
  const handleScheduleEventEndTimeChange = useCallback(
    (nextEndHHMM) => {
      setScheduleEventEndTime(nextEndHHMM);
      const { durationMinutes } = computeDurationFromStartAndEnd({
        dateStr: scheduleEventDate,
        startHHMM: scheduleEventTime,
        endHHMM: nextEndHHMM,
      });
      setScheduleEventDurationMinutes(durationMinutes);
      setScheduleEventDurationCustom(!EVENT_DURATION_OPTIONS.includes(durationMinutes));
    },
    [computeDurationFromStartAndEnd, scheduleEventDate, scheduleEventTime]
  );

  useEffect(() => {
    if (showScheduleEventModal) {
      if (scheduleEventPrefill?.title) {
        setScheduleEventTitle(scheduleEventPrefill.title);

        let dateStr = localISODate();
        let startHHMM = '09:00';
        if (scheduleEventPrefill.startTime) {
          try {
            const d = new Date(scheduleEventPrefill.startTime);
            dateStr = localISODate(d);
            startHHMM = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          } catch (_) {}
        }
        setScheduleEventDate(dateStr);
        setScheduleEventTime(startHHMM);

        if (scheduleEventPrefill.startTime && scheduleEventPrefill.endTime) {
          try {
            const start = new Date(scheduleEventPrefill.startTime);
            const end = new Date(scheduleEventPrefill.endTime);
            const minutes = clampEventMinutes((end.getTime() - start.getTime()) / (60 * 1000));
            setScheduleEventDurationMinutes(minutes);
            setScheduleEventDurationCustom(!EVENT_DURATION_OPTIONS.includes(minutes));
            setScheduleEventEndTime(formatHHMM(end));
          } catch (_) {
            setScheduleEventDurationMinutes(60);
            setScheduleEventDurationCustom(false);
            setScheduleEventEndTime(computeEndFromStartAndDuration({ dateStr, startHHMM, durationMinutes: 60 }).endTimeHHMM);
          }
        } else {
          setScheduleEventDurationMinutes(60);
          setScheduleEventDurationCustom(false);
          setScheduleEventEndTime(computeEndFromStartAndDuration({ dateStr, startHHMM, durationMinutes: 60 }).endTimeHHMM);
        }
      } else {
        setScheduleEventTitle('');
        setScheduleEventDate(localISODate());
        setScheduleEventTime('09:00');
        setScheduleEventDurationMinutes(60);
        setScheduleEventDurationCustom(false);
        setScheduleEventEndTime('10:00');
      }
    }
  }, [
    showScheduleEventModal,
    scheduleEventPrefill,
    clampEventMinutes,
    formatHHMM,
    computeEndFromStartAndDuration,
  ]);

  const handleScheduleEventSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      const title = scheduleEventTitle.trim();
      if (!title) return;
      setScheduleEventSaving(true);
      try {
        const { start, end, durationMinutes } = computeDurationFromStartAndEnd({
          dateStr: scheduleEventDate,
          startHHMM: scheduleEventTime,
          endHHMM: scheduleEventEndTime,
        });
        const startTime = start.toISOString();
        const endTime = end.toISOString();

        // 1) Always save a local blocking event into the day plan (duration-aware)
        if (typeof loadDayPlan === 'function' && typeof saveDayPlanForDate === 'function') {
          const current = (await loadDayPlan(scheduleEventDate)) ?? {};
          const next = { ...(current && typeof current === 'object' ? current : {}) };
          const startSlotDecimal = start.getHours() + start.getMinutes() / 60;
          const slotKey = toCanonicalSlotKey(startSlotDecimal) ?? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
          const localAssignment = {
            type: 'event',
            title,
            startTime,
            endTime,
            duration: durationMinutes,
            fixed: true,
            isFixed: true,
            source: googleToken ? 'google' : 'local',
          };
          if (next[slotKey] == null) next[slotKey] = localAssignment;
          else next[slotKey] = [...(Array.isArray(next[slotKey]) ? next[slotKey] : [next[slotKey]]), localAssignment];
          await saveDayPlanForDate(scheduleEventDate, next);
        }

        // 2) Create in Google Calendar if connected (but local block already saved above)
        let weeklyEvent = {
          id: 'local-' + Date.now(),
          title,
          start: startTime,
          end: endTime,
          type: 'leaf',
          source: googleToken ? 'google' : 'local',
        };
        if (googleToken) {
          try {
            const created = await createGoogleEvent(googleToken, { title, startTime, endTime });
            weeklyEvent = {
              id: created?.id ?? weeklyEvent.id,
              title,
              start: created?.start?.dateTime ?? startTime,
              end: created?.end?.dateTime ?? endTime,
              type: 'leaf',
              source: 'google',
            };
          } catch (googleErr) {
            console.warn('Google calendar create failed; saved locally only', googleErr);
            weeklyEvent.source = 'local';
          }
        }
        updateWeeklyEvents?.([...(Array.isArray(weeklyEvents) ? weeklyEvents : []), weeklyEvent]);

        if (googleToken) pushReward?.({ message: 'Event saved.', tone: 'moss', icon: '📅' });
        else pushReward?.({ message: 'Saved locally (connect Google to sync).', tone: 'moss', icon: '📅' });
        setShowScheduleEventModal(false);
        setScheduleEventPrefill(null);
      } catch (err) {
        console.warn('Schedule event failed', err);
        pushReward?.({ message: 'Could not add event. Try again.', tone: 'slate', icon: '⚠️' });
      } finally {
        setScheduleEventSaving(false);
      }
    },
    [
      scheduleEventTitle,
      scheduleEventDate,
      scheduleEventTime,
      scheduleEventEndTime,
      computeDurationFromStartAndEnd,
      googleToken,
      loadDayPlan,
      saveDayPlanForDate,
      weeklyEvents,
      updateWeeklyEvents,
      pushReward,
    ]
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

  /** Today's plan items for Planner "Today" strip (from weekAssignments). */
  const plannerTodayPlanItems = useMemo(
    () => (today ? getPlanItemsForDate(weekAssignments ?? {}, goals ?? [], today) : []),
    [today, weekAssignments, goals]
  );

  /** Backlog tasks for the selected plan day drawer in Planner. */
  const plannerDayBacklogTasks = useMemo(
    () => (plannerPlanDayDateStr ? buildBacklogTasks(goals ?? [], plannerPlanDayDateStr.slice(0, 7)) : []),
    [goals, plannerPlanDayDateStr]
  );

  /** Planned hours summary for Plan tab (by scope: day / week / month). */
  const plannedHoursSummary = useMemo(
    () => getPlannedHoursByScope(weekAssignments ?? {}, goals ?? [], plannerViewMode),
    [weekAssignments, goals, plannerViewMode]
  );
  const plannerLoad = useMemo(() => {
    const startHour = hourFromTimeStr(userSettings?.dayStart, 8);
    const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
    const dayCapacity = Math.max(1, endHour - startHour);
    const now = today ? new Date(today + 'T12:00:00') : new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const capacityHours =
      plannerViewMode === 'day'
        ? dayCapacity
        : plannerViewMode === 'week'
          ? dayCapacity * 7
          : dayCapacity * daysInMonth;
    const plannedHours = (Number(plannedHoursSummary?.totalMinutes) || 0) / 60;
    const ratio = capacityHours > 0 ? plannedHours / capacityHours : 0;
    const ratioPct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    const scopeLabel = plannerViewMode === 'day' ? 'today' : plannerViewMode === 'week' ? 'this week' : 'this month';
    let status = `Load is balanced for ${scopeLabel}.`;
    let tone = 'text-moss-700 dark:text-moss-300';
    if (ratio >= 1) {
      status = `You are over capacity for ${scopeLabel}. Move or trim lower-priority work.`;
      tone = 'text-rose-700 dark:text-rose-300';
    } else if (ratio >= 0.85) {
      status = `You are close to full for ${scopeLabel}. Keep some recovery space.`;
      tone = 'text-amber-700 dark:text-amber-300';
    } else if (ratio < 0.4) {
      status = `You still have room ${scopeLabel}. Add one meaningful block.`;
    }
    return { dayCapacity, capacityHours, plannedHours, ratio, ratioPct, status, tone };
  }, [plannerViewMode, plannedHoursSummary, userSettings?.dayStart, userSettings?.dayEnd, today]);
  const plannerUpcomingDeadlines = useMemo(() => {
    const base = today ? new Date(today + 'T00:00:00') : new Date();
    const horizon = new Date(base);
    horizon.setDate(base.getDate() + 21);
    const daysUntil = (dateStr) => {
      const d = new Date(`${dateStr}T00:00:00`);
      if (!Number.isFinite(d.getTime())) return null;
      return Math.ceil((d.getTime() - base.getTime()) / 86400000);
    };
    const rows = [];
    (goals ?? []).forEach((goal) => {
      if (goal?._projectDeadline) {
        const d = new Date(`${goal._projectDeadline}T00:00:00`);
        if (Number.isFinite(d.getTime()) && d >= base && d <= horizon) {
          rows.push({ id: `${goal.id}-project`, goalId: goal.id, title: goal.title || 'Project', label: 'Project due', date: goal._projectDeadline, daysLeft: daysUntil(goal._projectDeadline) });
        }
      }
      (goal?.subtasks ?? []).forEach((sub) => {
        if (!sub?.deadline) return;
        const d = new Date(`${sub.deadline}T00:00:00`);
        if (!Number.isFinite(d.getTime()) || d < base || d > horizon) return;
        rows.push({ id: sub.id || `${goal.id}-${sub.title}`, goalId: goal.id, title: sub.title || 'Task', label: goal.title || 'Goal', date: sub.deadline, daysLeft: daysUntil(sub.deadline) });
      });
    });
    return rows.sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 4);
  }, [goals, today]);

  /** Month-level backlog for Plan tab Month view: all tasks for current month, split by status. */
  const currentMonthStr = useMemo(() => (today || '').slice(0, 7), [today]);
  const plannerMonthBacklogTasks = useMemo(
    () => buildBacklogTasks(goals ?? [], currentMonthStr),
    [goals, currentMonthStr]
  );
  const effectiveStagingStatus = useCallback(
    (task) => (stagingTaskStatus ?? {})[task.id] ?? task.defaultStatus ?? 'someday',
    [stagingTaskStatus]
  );
  const unscheduledMonthTasks = useMemo(
    () => plannerMonthBacklogTasks.filter((t) => effectiveStagingStatus(t) === 'unscheduled_month'),
    [plannerMonthBacklogTasks, effectiveStagingStatus]
  );
  const vaultTasks = useMemo(
    () => plannerMonthBacklogTasks.filter((t) => effectiveStagingStatus(t) === 'someday'),
    [plannerMonthBacklogTasks, effectiveStagingStatus]
  );
  const plannerTodayBacklogTasks = useMemo(
    () => [...unscheduledMonthTasks, ...vaultTasks].slice(0, 6),
    [unscheduledMonthTasks, vaultTasks]
  );
  const plannerConfidence = useMemo(() => {
    const urgentDeadlines = (plannerUpcomingDeadlines ?? []).filter((d) => typeof d.daysLeft === 'number' && d.daysLeft >= 0 && d.daysLeft <= 3).length;
    let penalty = 0;
    const badges = [];
    if (plannerLoad.ratio >= 1) {
      penalty += 35;
      badges.push({ label: 'Over capacity', tone: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800' });
    } else if (plannerLoad.ratio >= 0.85) {
      penalty += 18;
      badges.push({ label: 'Near full load', tone: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800' });
    } else {
      badges.push({ label: 'Capacity healthy', tone: 'text-moss-700 dark:text-moss-300 bg-moss-50 dark:bg-moss-900/20 border-moss-200 dark:border-moss-800' });
    }
    if (urgentDeadlines > 0) {
      penalty += Math.min(30, urgentDeadlines * 10);
      badges.push({ label: `${urgentDeadlines} urgent deadline${urgentDeadlines === 1 ? '' : 's'}`, tone: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800' });
    }
    if (plannerViewMode === 'month' && unscheduledMonthTasks.length > 6) {
      penalty += 12;
      badges.push({ label: 'Month backlog heavy', tone: 'text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700' });
    }
    const score = Math.max(0, Math.min(100, 100 - penalty));
    return { score, badges: badges.slice(0, 3) };
  }, [plannerLoad.ratio, plannerUpcomingDeadlines, plannerViewMode, unscheduledMonthTasks.length]);

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
  const [autoPlanMessage, setAutoPlanMessage] = useState(null);
  const [checkInReactionMessage, setCheckInReactionMessage] = useState(null);
  const [gardenCommentMessage, setGardenCommentMessage] = useState(null);
  const displaySpiritMessage = gardenCommentMessage ?? checkInReactionMessage ?? loadLightenedMessage ?? autoPlanMessage ?? spiritMessage;

  useEffect(() => {
    if (hasShownSpiritRef.current) return;
    hasShownSpiritRef.current = true;
    setShowSpiritDialogue(true);
    const durationMs = 7000;
    const t = setTimeout(() => setShowSpiritDialogue(false), durationMs);
    return () => clearTimeout(t);
  }, []);

  /* Overload: no longer auto-open spirit dialogue; hero shows "Lighten my plan" and user can tap to open spirit. */

  const handleLoadLightened = useCallback((removedItems) => {
    const removedCount = removedItems?.length ?? 0;
    const reward = buildReward({ type: 'LOAD_LIGHTENED', payload: { removedCount } });
    if (reward) pushReward(reward);
    const relief = planReliefCommand({ removedItems });
    setLoadLightenedMessage(relief.message);
    /* Single channel: only RewardOverlay; no separate spirit dialogue or toast for load-lightening. */
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

  const WeatherIcon = weather === 'storm' ? StormIcon : weather === 'leaf' ? LeafIcon : SunIcon;
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

  /** Today plan items with isFixed for single-decision recommendation (Compass + NextTinyStep logic). */
  const todayPlanItemsWithIsFixed = useMemo(() => {
    return todayPlanItemsWithHour.map((item) => {
      const hourAssignments = getAssignmentsForHour(assignments, item.hour);
      const a = hourAssignments.find((a) => (typeof a === 'string' ? a : a?.goalId ?? a?.parentGoalId) === item.goalId);
      return { ...item, isFixed: isAssignmentFixed(a) || item.goal?.isFixed === true };
    });
  }, [todayPlanItemsWithHour, assignments]);

  const nowSuggestions = useTinyStepSuggestions({
    todayPlanItems: todayPlanItemsWithIsFixed,
    compost: compost ?? [],
    logs: logs ?? [],
    goals: goals ?? [],
    snoozedUntil: {},
    lowEnergy: (todaySpoonCount ?? 0) <= 2,
  });

  /** Single "right now" focus: fixed calendar event now > fixed plan item at current hour > first suggestion. */
  const currentFocusItem = useMemo(() => {
    const todayStr = localISODate(now);
    const currentHour = `${String(now.getHours()).padStart(2, '0')}:00`;
    const eventsToday = (Array.isArray(weeklyEvents) ? weeklyEvents : []).filter((e) => {
      const d = e.start ? new Date(e.start) : null;
      return d && localISODate(d) === todayStr;
    });
    const fixedEventNow = eventsToday.find((e) => {
      const start = e.start ? new Date(e.start) : null;
      const end = e.end ? new Date(e.end) : null;
      if (!start) return false;
      const endTime = end && end.getTime() > start.getTime() ? end : new Date(start.getTime() + 60 * 60 * 1000);
      return now.getTime() >= start.getTime() && now.getTime() <= endTime.getTime();
    });
    if (fixedEventNow) {
      return {
        id: `calendar-${fixedEventNow.id ?? fixedEventNow.start ?? 'now'}`,
        source: 'calendar',
        title: fixedEventNow.title || 'Calendar event',
        event: fixedEventNow,
        isFixed: true,
      };
    }
    const planItemNow = todayPlanItemsWithIsFixed.find((item) => item.hour === currentHour && item.isFixed);
    if (planItemNow) {
      return {
        id: `plan-${planItemNow.goalId}-${planItemNow.hour}`,
        source: 'plan',
        title: planItemNow.ritualTitle || planItemNow.goal?.title || 'Task',
        goalId: planItemNow.goalId,
        goal: planItemNow.goal,
        hour: planItemNow.hour,
        subtaskId: planItemNow.subtaskId,
        isFixed: true,
      };
    }
    if (nowSuggestions.length > 0) return nowSuggestions[0];
    return null;
  }, [weeklyEvents, todayPlanItemsWithIsFixed, nowSuggestions, now]);

  /** Single frictionless "Help Me Start" for ADHD: pick first uncompleted goal, set 5 min, launch focus overlay. */
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
    runStartFocus({ goal, minutes: 5, subtaskId: firstUncompletedSub?.id ?? null });
  }, [goals, runStartFocus]);

  const handleStartNowStart = useCallback((taskOrCandidate, durationMinutes) => {
    const mins = Math.max(1, Math.min(120, durationMinutes ?? 5));
    const goal = taskOrCandidate?.goal ?? taskOrCandidate;
    const subtaskId = taskOrCandidate?.subtaskId ?? goal?.subtaskId ?? null;
    if (!goal?.id) return;
    if (mins <= 10) {
      const reward = buildReward({ type: 'ACTIVATION_TINY_STEP' });
      if (reward && typeof pushReward === 'function') pushReward(reward);
    }
    runStartFocus({ goal, minutes: mins, subtaskId });
    setShowStartNowModal(false);
    setStartNowCandidate(null);
  }, [pushReward, runStartFocus]);

  /** Single-decision hero: state line + primary CTA + fallback. Reuses Compass (slot, storm) and NextTinyStep (current focus). */
  const nowRecommendation = useMemo(() => {
    const slotKey = getCurrentSlotKey(now);
    const isStorm = weather === 'storm';
    const assignment = slotKey ? getAssignmentsForHour(assignments, slotKey)[0] ?? null : null;
    const goalId = assignment == null ? null : typeof assignment === 'string' ? assignment : assignment?.goalId ?? assignment?.parentGoalId;
    const slotStatus = isStorm ? 'storm' : goalId && (goals ?? []).some((g) => g.id === goalId) ? 'assigned' : 'free';

    if (needsMorningCheckIn) {
      return {
        stateLine: 'Set your energy for today',
        recommendedPrimary: { type: 'set_energy', label: "Set today's energy", onClick: () => setShowMorningCheckInModal(true) },
        recommendedFallback: { label: 'View my day', onClick: () => document.getElementById('tour-timeline')?.scrollIntoView({ behavior: 'smooth' }) },
      };
    }
    if (isStorm) {
      return {
        stateLine: `${slotKey ?? 'Now'} · Storm`,
        recommendedPrimary: { type: 'rest', label: 'Rest / Take shelter', onClick: () => {} },
        recommendedFallback: { label: 'View my day', onClick: () => document.getElementById('tour-timeline')?.scrollIntoView({ behavior: 'smooth' }) },
      };
    }
    if (isOverloaded) {
      return {
        stateLine: 'Today looks full',
        recommendedPrimary: {
          type: 'lighten',
          label: 'Lighten my plan',
          onClick: () => {
            document.getElementById('tour-timeline')?.scrollIntoView({ behavior: 'smooth' });
            setLoadLightenedMessage('Today looks full. You can move items to compost or drag to another day.');
            setShowSpiritDialogue(true);
          },
        },
        recommendedFallback: { label: 'View my day', onClick: () => document.getElementById('tour-timeline')?.scrollIntoView({ behavior: 'smooth' }) },
      };
    }
    const spoons = todaySpoonCount ?? 0;
    const stateLine = slotKey
      ? `${spoons} spoon${spoons !== 1 ? 's' : ''} · ${slotKey} ${slotStatus === 'assigned' ? '— scheduled' : slotStatus === 'free' ? 'free' : ''}`
      : 'No plan yet';
    const primaryTask = currentFocusItem?.goal ? { goal: currentFocusItem.goal, goalId: currentFocusItem.goalId, subtaskId: currentFocusItem.subtaskId } : null;
    return {
      stateLine: stateLine.trim() || `${spoons} spoon${spoons !== 1 ? 's' : ''}`,
      recommendedPrimary: primaryTask
        ? { type: 'start', label: `Start ${currentFocusItem?.title ?? 'task'}`, task: currentFocusItem, onClick: () => handleStartNowStart(primaryTask, 5) }
        : { type: 'start', label: 'Start now', onClick: handleHelpMeStart },
      recommendedFallback: { label: 'Low energy? Set spoons', onClick: () => setShowMorningCheckInModal(true) },
    };
  }, [
    now,
    weather,
    assignments,
    goals,
    needsMorningCheckIn,
    isOverloaded,
    todaySpoonCount,
    currentFocusItem,
    handleStartNowStart,
    handleHelpMeStart,
  ]);

  const currentTaskStrip = useMemo(() => {
    if (needsMorningCheckIn) return null;
    if (activeSession?.title) {
      return {
        label: activeSession.title,
        context: `In focus · ${activeSession.sessionDurationMinutes ?? 25} min`,
      };
    }
    if (currentFocusItem?.title) {
      return {
        label: currentFocusItem.title,
        context: 'Next up',
      };
    }
    return null;
  }, [needsMorningCheckIn, activeSession, currentFocusItem]);

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
    openModal('compost');
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
    const maybeShowDomainSupport = () => {
      const suggestions = resolveSupportSuggestions(goal, 3);
      if (suggestions.length > 0) {
        const domainId = getGoalSupportDomain(goal);
        setHelperQueue((prev) => [...prev, createIntervention(HELPER_INTERVENTION_TYPES.SUPPORT_SUGGESTION, { source: 'goal_create', parentGoal: goal, domainId: domainId ?? undefined, suggestions })]);
      }
    };
    generateHabitSynergy(goal.title).then((result) => {
      if (result?.hasSynergy && result.suggestedHabitTitle) {
        setSynergySuggestion({
          goalId: goal.id,
          suggestedHabitTitle: result.suggestedHabitTitle,
          pitchText: result.pitchText || 'Pairs well with your new goal!',
        });
      } else {
        maybeShowDomainSupport();
      }
    }).catch(() => { maybeShowDomainSupport(); });
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
      runStartFocus({ goal: newGoal, minutes: 5, subtaskId: null });
    },
    [addGoal, runStartFocus]
  );

  const handleStartNowCreateSuggestion = useCallback((key) => {
    const STARTER_TITLES = { 'life-admin': 'One tiny life-admin thing', personal: 'One personal goal step', care: 'One care task' };
    const title = STARTER_TITLES[key] ?? 'One tiny step';
    const id = crypto.randomUUID?.() ?? `goal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newGoal = { id, type: 'routine', title, estimatedMinutes: 5, totalMinutes: 0, createdAt: new Date().toISOString() };
    addGoal(newGoal);
    const firstEmpty = HOURS.find((h) => getAssignmentsForHour(assignments, h).length === 0);
    if (firstEmpty) setAssignments((prev) => ({ ...prev, [firstEmpty]: [...getAssignmentsForHour(prev, firstEmpty), id] }));
    runStartFocus({ goal: newGoal, minutes: 5, subtaskId: null });
    setShowStartNowModal(false);
    setStartNowCandidate(null);
  }, [addGoal, assignments, setAssignments, runStartFocus]);

  /** Guided empty state: add starter suggestion to plan and start 5 min focus. */
  const handleGuidedSuggestion = useCallback((key) => {
    handleStartNowCreateSuggestion(key);
  }, [handleStartNowCreateSuggestion]);

  /** Guided empty state: pick a goal for this week — assign to first slot and start 5 min. */
  const handleGuidedPickGoal = useCallback((goal) => {
    if (!goal?.id) return;
    const firstEmpty = HOURS.find((h) => getAssignmentsForHour(assignments, h).length === 0);
    if (firstEmpty) setAssignments((prev) => ({ ...prev, [firstEmpty]: [...getAssignmentsForHour(prev, firstEmpty), goal.id] }));
    runStartFocus({ goal, minutes: 5, subtaskId: null });
  }, [assignments, setAssignments, runStartFocus]);

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
    runStartFocus({
      goal: sessionConfigTarget.goal,
      minutes: sessionDurationMinutes,
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
          const addHours = timeSpentMinutes / 60;
          updateSubtaskProgress(taskId, activeSession.subtaskId, addHours);
          const goal = goals?.find((g) => g.id === taskId);
          const subtask = goal?.subtasks?.find((s) => s.id === activeSession.subtaskId);
          if (subtask) {
            const estimated = Number(subtask.estimatedHours) || 0;
            if (estimated > 0) {
              const current = Number(subtask.completedHours) || 0;
              if (current + addHours > estimated) {
                const perseveranceReward = buildReward({ type: 'FOCUS_PERSEVERANCE' });
                if (perseveranceReward?.variableBonus?.embers) earnEmbers(perseveranceReward.variableBonus.embers);
                if (perseveranceReward) pushReward(perseveranceReward);
              }
            }
          }
        }
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
        pushReward({ message: 'Compost paid off.', tone: 'moss', icon: '♻️✨', durationMs: 2800, variableBonus: { embers: 2 } });
      }
      const isShortSession = timeSpentMinutes <= 10;
      const isResume = (continuitySummary.todaySessions ?? 0) >= 1;
      const growthParts = [];
      if (goalTitle) growthParts.push(`Your ${goalTitle} has grown a little.`);
      if (isShortSession) growthParts.push('Short sessions count.');
      if (isResume) growthParts.push("You came back — that's the rhythm.");
      const focusReward = buildReward({
        type: 'FOCUS_COMPLETE',
        payload: { goalTitle, minutes: timeSpentMinutes, spoonCount: todaySpoonCount ?? dailySpoonCount },
      });
      if (focusReward) {
        if (focusReward.variableBonus?.embers) earnEmbers(focusReward.variableBonus.embers);
        pushReward({
          ...focusReward,
          growthLine: growthParts.length > 0 ? growthParts.join(' ') : undefined,
        });
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
          const addHours = timeSpentMinutes / 60;
          updateSubtaskProgress(taskId, activeSession.subtaskId, addHours);
          const goal = goals?.find((g) => g.id === taskId);
          const subtask = goal?.subtasks?.find((s) => s.id === activeSession.subtaskId);
          if (subtask) {
            const estimated = Number(subtask.estimatedHours) || 0;
            if (estimated > 0) {
              const current = Number(subtask.completedHours) || 0;
              if (current + addHours > estimated) {
                const perseveranceReward = buildReward({ type: 'FOCUS_PERSEVERANCE' });
                if (perseveranceReward?.variableBonus?.embers) earnEmbers(perseveranceReward.variableBonus.embers);
                if (perseveranceReward) pushReward(perseveranceReward);
              }
            }
          }
        }
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
        pushReward({ message: 'Compost paid off.', tone: 'moss', icon: '♻️✨', durationMs: 2800, variableBonus: { embers: 2 } });
      }
      const isShortSession = timeSpentMinutes <= 10;
      const isResume = (continuitySummary.todaySessions ?? 0) >= 1;
      const growthParts = [];
      if (goalTitle) growthParts.push(`Your ${goalTitle} has grown a little.`);
      if (isShortSession) growthParts.push('Short sessions count.');
      if (isResume) growthParts.push("You came back — that's the rhythm.");
      const focusReward = buildReward({
        type: 'FOCUS_COMPLETE',
        payload: { goalTitle, minutes: timeSpentMinutes, spoonCount: todaySpoonCount ?? dailySpoonCount },
      });
      if (focusReward) {
        if (focusReward.variableBonus?.embers) earnEmbers(focusReward.variableBonus.embers);
        pushReward({
          ...focusReward,
          growthLine: growthParts.length > 0 ? growthParts.join(' ') : undefined,
        });
      }

      const parentGoal = goals?.find((g) => g.id === nextStep.goalId);
      if (parentGoal) {
        runStartFocus({
          goal: { ...parentGoal, title: nextStep.title },
          minutes: 5,
          subtaskId: nextStep.id,
        });
      }
    },
    [
      activeSession,
      goals,
      continuitySummary.todaySessions,
      addWater,
      earnEmbers,
      pushReward,
      updateGoalProgress,
      updateSubtaskProgress,
      addLog,
      soilNutrients,
      consumeSoilNutrients,
      buildReward,
      todaySpoonCount,
      dailySpoonCount,
      runStartFocus,
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
        const addHours = durationMinutes / 60;
        updateSubtaskProgress(taskId, subtaskId, addHours);
        const goal = goals?.find((g) => g.id === taskId);
        const subtask = goal?.subtasks?.find((s) => s.id === subtaskId);
        if (subtask) {
          const estimated = Number(subtask.estimatedHours) || 0;
          if (estimated > 0) {
            const current = Number(subtask.completedHours) || 0;
            if (current + addHours > estimated) {
              const perseveranceReward = buildReward({ type: 'FOCUS_PERSEVERANCE' });
              if (perseveranceReward?.variableBonus?.embers) earnEmbers(perseveranceReward.variableBonus.embers);
              if (perseveranceReward) pushReward(perseveranceReward);
            }
          }
        }
      }
    }
    addLog({
      taskId: completedTask?.id ?? log?.taskId,
      taskTitle: goalTitle,
      rating: log?.rating ?? null,
      note: log?.note ?? '',
      date: new Date(),
      minutes: durationMinutes,
    });
    if (soilNutrients > 0 && consumeSoilNutrients(1)) {
      earnEmbers(2);
      pushReward({ message: 'Compost paid off.', tone: 'moss', icon: '♻️✨', durationMs: 2800, variableBonus: { embers: 2 } });
    }
    const isShortSession = durationMinutes <= 10;
    const isResume = (continuitySummary.todaySessions ?? 0) >= 1;
    const growthParts = [];
    if (goalTitle) growthParts.push(`Your ${goalTitle} has grown a little.`);
    if (isShortSession) growthParts.push('Short sessions count.');
    if (isResume) growthParts.push("You came back — that's the rhythm.");
    const focusReward = buildReward({
      type: 'FOCUS_COMPLETE',
      payload: { goalTitle, minutes: durationMinutes, spoonCount: todaySpoonCount ?? dailySpoonCount },
    });
    if (focusReward) {
      if (focusReward.variableBonus?.embers) earnEmbers(focusReward.variableBonus.embers);
      pushReward({
        ...focusReward,
        growthLine: growthParts.length > 0 ? growthParts.join(' ') : undefined,
      });
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
        setHelperQueue((prev) => [...prev, createIntervention(HELPER_INTERVENTION_TYPES.HABIT_STACK_HANDOFF, { source: 'routine_complete', routineName, linkedGoal, linkedSubtaskId, linkedTitle })]);
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
          setHelperQueue((prev) => [...prev, createIntervention(HELPER_INTERVENTION_TYPES.NEXT_STEP, { source: 'task_complete', completedTitle, nextStep })]);
        }
      }
    }
  };

  /** User finishes SpiritOrigins → close it and optionally show tour. */
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
      if (tourStep === 3) setTourStep(4);
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

  const handleFocusSessionStart = () => {
    const reward = buildReward({ type: 'ACTIVATION_START' });
    if (reward && typeof pushReward === 'function') pushReward(reward);
  };

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
        onStart={handleFocusSessionStart}
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
              if (typeof compostStaleSeeds === 'function') compostStaleSeeds();
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
                          <button type="button" onClick={async () => { const ok = await connectCalendar(); if (ok) { if (typeof pushReward === 'function') pushReward({ message: 'Roots connected to Google Calendar.', tone: 'moss', icon: '📅', durationMs: 3000 }); setShowCalendarMenu(false); } }} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors">
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
                                  if (typeof pushReward === 'function') pushReward({ message: 'Roots connected to Outlook.', tone: 'moss', icon: '📅', durationMs: 3000 });
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
                        <button type="button" onClick={async () => { try { const imported = await importICSFile(); if (imported.length > 0) { updateWeeklyEvents([...events, ...imported]); if (typeof pushReward === 'function') pushReward({ message: 'Events imported.', tone: 'moss', icon: '📅', durationMs: 3000 }); } } catch (e) { console.warn('ICS import failed', e); } setShowCalendarMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors">
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
                            if (typeof compostStaleSeeds === 'function') compostStaleSeeds();
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

          {/* Right: top-nav toolbelt (quick actions). */}
          <div className="flex items-center justify-end gap-2 h-12 shrink-0">
            <button
              id="mochi-chat-btn"
              type="button"
              onClick={() => openModal('chat')}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:scale-105 transition-transform cursor-pointer drop-shadow-sm"
              title="Talk to Mochi"
            >
              <span className="text-xl leading-none">{renderSpiritAvatar()}</span>
            </button>
            <div className="flex items-center gap-1.5" id="guide-garden-tools" aria-label="Quick tools">
              <button
                type="button"
                onClick={() => openModal('compost')}
                className={`w-9 h-9 inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                  isDark ? 'text-slate-200 hover:bg-slate-700/60 bg-slate-800/40' : 'text-stone-700 hover:bg-stone-200 bg-stone-100'
                }`}
                aria-label="Open compost heap"
                title="Compost Heap"
              >
                <span aria-hidden>🍂</span>
              </button>
              <button
                type="button"
                onClick={() => openModal('mirror')}
                className={`w-9 h-9 inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                  isDark ? 'text-slate-200 hover:bg-slate-700/60 bg-slate-800/40' : 'text-stone-700 hover:bg-stone-200 bg-stone-100'
                }`}
                aria-label="Open spirit mirror"
                title="Spirit Mirror"
              >
                <MirrorIcon />
              </button>
              <button
                type="button"
                onClick={() => setDarkModeOverride(!isDark)}
                className={`w-9 h-9 inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                  isDark ? 'text-slate-200 hover:bg-slate-700/60 bg-slate-800/40' : 'text-stone-700 hover:bg-stone-200 bg-stone-100'
                }`}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDark ? 'Light mode' : 'Dark mode'}
              >
                <span aria-hidden>{isDark ? '☀️' : '🌙'}</span>
              </button>
              {eveningMode !== 'night-owl' && (
                <button
                  type="button"
                  onClick={() => openModal('accessibility')}
                  className={`w-9 h-9 inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                    isDark ? 'text-slate-200 hover:bg-slate-700/60 bg-slate-800/40' : 'text-stone-700 hover:bg-stone-200 bg-stone-100'
                  }`}
                  aria-label="Open accessibility settings"
                  title="Accessibility"
                >
                  <span aria-hidden>🧩</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowTour(true)}
                className={`w-9 h-9 inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                  isDark ? 'text-slate-200 hover:bg-slate-700/60 bg-slate-800/40' : 'text-stone-700 hover:bg-stone-200 bg-stone-100'
                }`}
                aria-label="Replay tour"
                title="Replay tour"
              >
                <span aria-hidden>❔</span>
              </button>
            </div>
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

      {activeTab !== 'settings' && currentTaskStrip && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,720px)] pointer-events-none">
          <div className={`pointer-events-auto rounded-2xl border px-4 py-2.5 shadow-lg backdrop-blur-md flex items-center gap-3 ${
            isDark ? 'bg-slate-800/85 border-slate-600/70' : 'bg-white/90 border-stone-200/90'
          }`}>
            <div className="min-w-0 flex-1">
              <p className="font-sans text-[11px] uppercase tracking-wide text-stone-500 dark:text-stone-400">{currentTaskStrip.context}</p>
              <p className="font-sans text-sm font-medium text-stone-900 dark:text-stone-100 truncate">{currentTaskStrip.label}</p>
            </div>
            {activeTab !== 'today' && (
              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className="shrink-0 px-3 py-1.5 rounded-lg font-sans text-xs font-medium border border-moss-300 text-moss-700 dark:text-moss-300 dark:border-moss-600 hover:bg-moss-50 dark:hover:bg-moss-900/30 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                Open Now
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'garden' ? (
        <div className="flex-1 min-h-0 relative pt-0 pb-20">
          {gardenCommentMessage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-moss-100 dark:bg-moss-900/50 border border-moss-300 dark:border-moss-700 text-moss-800 dark:text-moss-200 font-sans text-sm shadow-lg max-w-[90vw]" role="status">
              Mochi: {gardenCommentMessage}
            </div>
          )}
          <Suspense fallback={<div className="h-full min-h-[50vh] rounded-3xl bg-stone-100 animate-pulse" aria-hidden="true" />}>
            <GardenWalk
              goals={goals}
              onCompost={handleCompostGoal}
              onGoalClick={handleGardenGoalClick}
              onOpenGoalCreator={() => setIsPlanting(true)}
              onEditGoal={editGoal}
              onOpenNursery={() => setIsNurseryOpen(true)}
              ecoMode={!!editingGoal || showJournalModal || showInsightsModal || isNurseryOpen}
            />
          </Suspense>
        </div>
      ) : activeTab === 'settings' ? (
        <main className="flex-1 w-full min-w-0 px-3 sm:px-4 py-6 sm:py-8 max-w-2xl mx-auto relative pb-28 sm:pb-24 pt-14 safe-area-pb">
          <SettingsView onReplayTour={() => { setShowTour(true); setActiveTab('today'); }} />
        </main>
      ) : (
      <main className={`flex-1 w-full min-w-0 px-3 sm:px-4 py-6 sm:py-8 ${activeTab === 'planner' ? 'max-w-[1400px]' : 'max-w-5xl'} mx-auto relative pb-28 sm:pb-24 safe-area-pb`}>
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
                {/* Now tab: one primary recommendation surface (hero only). No NextTinyStep/CompassWidget at top; their logic feeds the hero. StartNowModal is invoked by the hero CTA, not a competing CTA. Timeline and briefing are supporting/secondary below. */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Primary: single "what should I do now?" — state line, one CTA, one fallback */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  {nowRecommendation && (
                    <section aria-labelledby="now-primary-heading" className="w-full rounded-2xl border border-stone-200/80 bg-white/90 dark:bg-slate-800/90 dark:border-slate-600/50 shadow-lg p-5 flex flex-col gap-4">
                      <h2 id="now-primary-heading" className="font-sans text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                        What to do now
                      </h2>
                      <p className="font-sans text-sm text-stone-500 dark:text-stone-400 -mt-1" aria-live="polite">
                        {nowRecommendation.stateLine}
                      </p>
                      <button
                        type="button"
                        onClick={nowRecommendation.recommendedPrimary?.onClick}
                        className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-lg font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 disabled:opacity-70"
                        aria-label={nowRecommendation.recommendedPrimary?.label}
                      >
                        <span aria-hidden>✨</span>
                        <span>{nowRecommendation.recommendedPrimary?.label}</span>
                      </button>
                      {nowRecommendation.recommendedFallback && (
                        <button
                          type="button"
                          onClick={nowRecommendation.recommendedFallback.onClick}
                          className="font-sans text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 rounded px-2 py-1 self-center"
                        >
                          {nowRecommendation.recommendedFallback.label}
                        </button>
                      )}
                    </section>
                  )}
                  {/* Spirit's Briefing — secondary, below primary recommendation */}
                  {morningBriefing.length > 0 && (
                    <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-600/50 bg-slate-800/50' : 'border-stone-200 bg-stone-50/80'}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-sans text-xs font-medium text-stone-500 dark:text-stone-400">Mochi left a note</span>
                        <button
                          type="button"
                          onClick={() => setMorningBriefing([])}
                          className="font-sans text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 rounded px-1.5 py-0.5"
                          aria-label="Dismiss briefing"
                        >
                          Dismiss
                        </button>
                      </div>
                      <ul className="space-y-1.5">
                        {morningBriefing.map((item, i) => (
                          <li key={i} className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 ${isDark ? 'bg-slate-700/40' : 'bg-white/60'}`}>
                            <span className="font-sans text-sm text-stone-700 dark:text-stone-300 flex-1 min-w-0">{item.title}</span>
                            {item.category && (
                              <span className="font-sans text-xs text-stone-500 dark:text-stone-400 shrink-0">{item.category}</span>
                            )}
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(item.searchQuery)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-sans text-xs text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                            >
                              Verify
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {/* Right: Supporting — full-day timeline (planning detail, not the primary recommendation) */}
                <div className="lg:col-span-7 flex flex-col gap-2 min-h-0">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="font-sans text-sm font-medium text-stone-500 dark:text-stone-400">Your day</h2>
                    <button
                      type="button"
                      onClick={() => setNowShowDetails((v) => !v)}
                      className="font-sans text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded px-2 py-1"
                    >
                      {nowShowDetails ? 'Hide details' : 'Show details'}
                    </button>
                  </div>
                  {nowShowDetails && (
                  <>
                  <div className={`rounded-xl border px-2 py-2 text-sm ${isDark ? 'border-slate-600/50 bg-slate-800/30' : 'border-stone-200 bg-stone-50/80'}`}>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-sans text-stone-600 dark:text-stone-400">
                        Today: {continuitySummary.todaySessions === 0 ? 'no focus yet' : `${continuitySummary.todaySessions} session${continuitySummary.todaySessions !== 1 ? 's' : ''}, ${continuitySummary.todayMinutes} min`}
                      </span>
                      <span className="font-sans text-stone-500 dark:text-stone-500" aria-hidden>·</span>
                      <span className="font-sans text-stone-600 dark:text-stone-400">
                        This week: {continuitySummary.weekSessions === 0 ? 'no focus yet' : `${continuitySummary.weekSessions} session${continuitySummary.weekSessions !== 1 ? 's' : ''}, ${continuitySummary.weekMinutes} min`}
                      </span>
                      <button
                        type="button"
                        onClick={() => openModal('insights')}
                        className="font-sans text-moss-600 dark:text-moss-400 hover:underline focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded ml-auto"
                      >
                        Reflect
                      </button>
                    </div>
                    <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-1.5 px-0.5" aria-live="polite">
                      {continuitySummary.weekTendingDays === 0
                        ? 'Your rhythm builds when you show up — even for a few minutes.'
                        : continuitySummary.weekTendingDays === 1
                          ? 'You showed up one day this week. Small starts matter.'
                          : `You've tended the garden ${continuitySummary.weekTendingDays} days this week.`}
                    </p>
                    {lastGardenImpact?.text && (
                      <p className="font-sans text-xs text-moss-600 dark:text-moss-400 mt-1.5 px-0.5 flex items-center justify-between gap-2" aria-live="polite">
                        <span>Garden: {lastGardenImpact.text}</span>
                        <button type="button" onClick={clearLastGardenImpact} className="shrink-0 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded px-1" aria-label="Dismiss">×</button>
                      </p>
                    )}
                  </div>
                  <SpiritProgression className="shrink-0" />
                  </>
                  )}
                  <TourHighlight step={3} tooltip="Click the checkbox to complete it and earn your first Ember.">
                    <div
                      id="tour-timeline"
                      className="overflow-y-auto max-h-[80vh] rounded-2xl border border-stone-200/80 dark:border-slate-600/50 bg-white/90 dark:bg-slate-800/60 backdrop-blur-md shadow-lg p-4"
                      style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)' }}
                    >
                      <ScheduleErrorBoundary onCollapse={() => {}}>
                        <TimeSlicer
                        zenMode
                        suppressPrimaryActionsInZen
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
                        onOpenPlanner={() => setActiveTab('planner')}
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
          <PremiumPlannerShell id="guide-planner-overview" className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-4">
            <div className="px-1">
              <p className="premium-kicker mb-1">Planner Workspace</p>
              <h2 className="font-serif text-stone-900 dark:text-stone-100 text-xl font-semibold mb-1">Plan your week</h2>
              <p className="font-sans text-sm text-stone-500 dark:text-stone-400" title="Unscheduled → Assign to a day → Open Day Planner">
                Move tasks from <strong className="text-stone-700 dark:text-stone-300">Unscheduled</strong> into a day, then open the day planner.
              </p>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setPlannerShowSecondary((v) => !v)}
                  className="font-sans text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded px-2 py-1 -ml-2"
                >
                  {plannerShowSecondary ? 'Hide planner details' : 'Show planner details'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProjectPlanner(true)}
                  className="ml-2 py-1 px-2.5 rounded-lg font-sans text-xs font-medium border border-moss-400 dark:border-moss-500 text-moss-700 dark:text-moss-300 hover:bg-moss-50 dark:hover:bg-moss-900/30 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                >
                  Plan a Project
                </button>
              </div>
            </div>

            {/* Projects card: secondary entry for Plan a Project */}
            {plannerShowSecondary && (
            <div className="rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50/50 dark:bg-stone-800/50 p-3 px-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-sans text-sm font-medium text-stone-800 dark:text-stone-200">Projects</p>
                  <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-0.5">Break a project into steps, milestones, and deadlines.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProjectPlanner(true)}
                  className="shrink-0 py-2 px-3 rounded-lg font-sans text-sm font-medium border border-moss-400 dark:border-moss-500 text-moss-700 dark:text-moss-300 hover:bg-moss-50 dark:hover:bg-moss-900/30 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                >
                  Plan a Project
                </button>
              </div>
            </div>

            )}
            {/* Day | Week | Month planning lens — Week default */}
            <PremiumActionRow className="mb-4">
              <div className="inline-flex rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-100 dark:bg-stone-800/50 p-0.5">
                {['day', 'week', 'month'].map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPlannerViewMode(id)}
                    className={`px-3 py-1.5 rounded-md font-sans text-sm transition-colors capitalize ${
                      plannerViewMode === id
                        ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm font-medium'
                        : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                    }`}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </PremiumActionRow>
            <PremiumActionRow>
              {plannerViewMode === 'day' && (
                <>
                  <button
                    type="button"
                    onClick={handleSuggestTodayPlan}
                    disabled={plannerActionBusy === 'day'}
                    className="inline-flex items-center gap-2 py-2 px-3 rounded-xl font-sans text-sm font-semibold bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                  >
                    {plannerActionBusy === 'day' ? 'Planning...' : 'Suggest day plan'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLightenTodayPlan}
                    disabled={plannerActionBusy === 'day'}
                    className="inline-flex items-center gap-2 py-2 px-3 rounded-xl font-sans text-sm font-medium border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/70 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400/30 transition-colors"
                  >
                    {plannerActionBusy === 'day' ? 'Lightening...' : 'AI lighten today'}
                  </button>
                </>
              )}
              {plannerViewMode === 'week' && (
                <button
                  type="button"
                  onClick={handleAutoPlanWeek}
                  disabled={autoFillLoading || plannerActionBusy === 'week'}
                  className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-sans text-sm font-semibold bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 transition-colors"
                >
                  {autoFillLoading ? '...' : 'Suggest my week'}
                </button>
              )}
              {plannerViewMode === 'month' && (
                <button
                  type="button"
                  onClick={handleShapeMonthWithAI}
                  disabled={isGeneratingMonthPlan || plannerActionBusy === 'month'}
                  className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-sans text-sm font-semibold bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 transition-colors"
                >
                  {isGeneratingMonthPlan || plannerActionBusy === 'month' ? 'Shaping month...' : 'Shape month with AI'}
                  </button>
              )}
            </PremiumActionRow>

            {/* Planned hours summary: total + by task for current scope */}
            {plannerShowSecondary && (
            <div className="rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800/50 px-4 py-3">
              <p className="font-sans text-sm text-stone-800 dark:text-stone-200">
                {plannerViewMode === 'day' && (
                  <>Today: <span className="font-semibold tabular-nums">{plannedHoursSummary.totalMinutes ? (Math.round((plannedHoursSummary.totalMinutes / 60) * 10) / 10) : 0}h</span> planned</>
                )}
                {plannerViewMode === 'week' && (
                  <>This week: <span className="font-semibold tabular-nums">{plannedHoursSummary.totalMinutes ? (Math.round((plannedHoursSummary.totalMinutes / 60) * 10) / 10) : 0}h</span> planned</>
                )}
                {plannerViewMode === 'month' && (
                  <>This month: <span className="font-semibold tabular-nums">{plannedHoursSummary.totalMinutes ? (Math.round((plannedHoursSummary.totalMinutes / 60) * 10) / 10) : 0}h</span> planned</>
                )}
              </p>
              {plannedHoursSummary.byGoal.length > 0 && (
                <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-1.5">
                  By task: {plannedHoursSummary.byGoal.slice(0, 8).map((g) => `${g.title} ${Math.round((g.minutes / 60) * 10) / 10}h`).join(' · ')}
                  {plannedHoursSummary.byGoal.length > 8 && ' · …'}
                </p>
              )}
            </div>
            )}
            {plannerShowSecondary && (
            <div className="rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="font-sans text-sm font-medium text-stone-800 dark:text-stone-200">Planner Coach</p>
                <p className="font-sans text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                  {Math.round(plannerLoad.plannedHours * 10) / 10}h / {Math.round(plannerLoad.capacityHours * 10) / 10}h
                </p>
              </div>
              <div className="h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden mb-2">
                <div
                  className={`h-full transition-all ${plannerLoad.ratio >= 1 ? 'bg-rose-500' : plannerLoad.ratio >= 0.85 ? 'bg-amber-500' : 'bg-moss-500'}`}
                  style={{ width: `${plannerLoad.ratioPct}%` }}
                />
              </div>
              <p className={`font-sans text-xs mb-3 ${plannerLoad.tone}`}>{plannerLoad.status}</p>
              <div className="mb-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans text-xs text-stone-600 dark:text-stone-300">Confidence to hit plan</span>
                  <span className="font-sans text-xs font-semibold tabular-nums text-stone-800 dark:text-stone-100">{plannerConfidence.score}/100</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {plannerConfidence.badges.map((b) => (
                    <span key={b.label} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${b.tone}`}>
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePlannerChipProtectFocus}
                  disabled={plannerChipBusy != null}
                  className="inline-flex items-center gap-2 py-1.5 px-3 rounded-lg font-sans text-xs font-semibold bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                >
                  {plannerChipBusy === 'protect' ? 'Working...' : 'Protect focus block'}
                </button>
                <button
                  type="button"
                  onClick={handlePlannerChipRescheduleOne}
                  disabled={plannerChipBusy != null}
                  className="inline-flex items-center gap-2 py-1.5 px-3 rounded-lg font-sans text-xs font-medium border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/70 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400/30"
                >
                  {plannerChipBusy === 'reschedule' ? 'Working...' : 'Reschedule one block'}
                </button>
                <button
                  type="button"
                  onClick={handlePlannerChipSplitUrgent}
                  disabled={plannerChipBusy != null}
                  className="inline-flex items-center gap-2 py-1.5 px-3 rounded-lg font-sans text-xs font-medium border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                >
                  {plannerChipBusy === 'split' ? 'Working...' : 'Split urgent task'}
                </button>
              </div>
              {plannerLoad.ratio >= 1 && plannerViewMode === 'week' && (
                <button
                  type="button"
                  onClick={handleAutoPlanWeek}
                  disabled={autoFillLoading}
                  className="mb-3 inline-flex items-center gap-2 py-1.5 px-3 rounded-lg font-sans text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-rose-400/40"
                >
                  {autoFillLoading ? 'Rebalancing…' : 'Auto-rebalance week'}
                </button>
              )}
              {plannerUpcomingDeadlines.length > 0 && (
                <div className="pt-2 border-t border-stone-200 dark:border-stone-700">
                  <p className="font-sans text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">Upcoming deadlines</p>
                  <ul className="space-y-1.5">
                    {plannerUpcomingDeadlines.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2">
                        <span className="font-sans text-xs text-stone-700 dark:text-stone-300 truncate">{item.title}</span>
                        <span className={`font-sans text-[11px] shrink-0 ${item.daysLeft <= 3 ? 'text-rose-600 dark:text-rose-300 font-semibold' : 'text-stone-500 dark:text-stone-400'}`}>
                          {item.daysLeft === 0 ? 'today' : `${item.daysLeft}d`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            )}

            {/* Domain-aware weekly planning helper — one card per week when relevant; gentle, optional tone */}
            {plannerShowSecondary && (() => {
              const activeDomain = getActiveSupportDomainForWeek(goals ?? []);
              const prompt = activeDomain ? getWeeklyPrompt(activeDomain) : null;
              const weekId = getWeekId();
              const showCard = activeDomain && prompt && weekId !== dismissedWeeklyDomainCardWeekId;
              if (!showCard) return null;
              const template = prompt?.suggestionId ? getSuggestionTemplate(activeDomain, prompt.suggestionId) : null;
              return (
                <div className="mb-4 px-1">
                  <div className="rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50/50 dark:bg-stone-800/50 p-4">
                    <p className="font-sans text-sm font-medium text-stone-800 dark:text-stone-200 mb-1">{prompt.title}</p>
                    <p className="font-sans text-sm text-stone-600 dark:text-stone-400 mb-3">{prompt.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (template) {
                            const result = createFromSupportSuggestion(template, null);
                            if (result?.kind === 'goal' && result.goal) {
                              addGoal(result.goal);
                              if (typeof pushReward === 'function') pushReward({ message: 'Support step added.', tone: 'moss', icon: '🌱', durationMs: 2200 });
                            } else if (result?.kind === 'weekly_event' && result.event) {
                              updateWeeklyEvents([...(Array.isArray(weeklyEvents) ? weeklyEvents : []), result.event]);
                              if (typeof pushReward === 'function') pushReward({ message: 'Review block added.', tone: 'moss', icon: '📅', durationMs: 2200 });
                            }
                          }
                          setDismissedWeeklyDomainCardWeekId(weekId);
                        }}
                        className="px-3 py-2 rounded-lg font-sans text-sm font-medium bg-moss-500/90 text-white hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                      >
                        {prompt.cta}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissedWeeklyDomainCardWeekId(weekId)}
                        className="px-3 py-2 rounded-lg font-sans text-sm font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700/50 focus:outline-none focus:ring-2 focus:ring-stone-400/30"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            <PremiumSection>
              <PremiumSectionHeader
                className="mb-3 px-1"
                title="Planner Workspace"
                right={<span className="font-sans text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">{plannerViewMode}</span>}
              />

            {plannerViewMode === 'day' && (
              <PlanDayPanel
                plannerTodayPlanItems={plannerTodayPlanItems}
                plannerDayExpanded={plannerDayExpanded}
                setPlannerDayExpanded={setPlannerDayExpanded}
                setPlannerPlanDayDateStr={setPlannerPlanDayDateStr}
                today={today}
                setActiveTab={setActiveTab}
                plannerTodayBacklogTasks={plannerTodayBacklogTasks}
                handleQuickScheduleTodayTask={handleQuickScheduleTodayTask}
                isPlanningDay={plannerActionBusy === 'day'}
              />
            )}

            {plannerViewMode === 'month' && (
              <PlanMonthPanel
                unscheduledMonthTasks={unscheduledMonthTasks}
                setStagingTaskStatus={setStagingTaskStatus}
                setPlannerViewMode={setPlannerViewMode}
                vaultTasks={vaultTasks}
                goals={goals}
                logs={logs}
                weekAssignments={weekAssignments}
                weeklyEvents={weeklyEvents}
                loadDayPlan={loadDayPlan}
                setPlannerPlanDayDateStr={setPlannerPlanDayDateStr}
                monthlyRoadmap={monthlyRoadmap}
                handlePlanMonth={handlePlanMonth}
                isGeneratingMonthPlan={isGeneratingMonthPlan}
              />
            )}

            {/* Week lens: Today strip + Unscheduled + This week */}
            {plannerViewMode === 'week' && (
              <PlanWeekPanel
                plannerTodayPlanItems={plannerTodayPlanItems}
                today={today}
                setPlannerPlanDayDateStr={setPlannerPlanDayDateStr}
                goals={goals}
                weeklyEvents={weeklyEvents}
                weekAssignments={weekAssignments}
                loadDayPlan={loadDayPlan}
                saveDayPlanForDate={saveDayPlanForDate}
                pausedDays={pausedDays}
                needsRescheduling={needsRescheduling}
                rescheduleNeedsReschedulingItem={rescheduleNeedsReschedulingItem}
                clearDaySchedule={clearDaySchedule}
                editGoal={editGoal}
                spawnedVolumeBlocks={spawnedVolumeBlocks}
                removeSpawnedVolumeBlock={removeSpawnedVolumeBlock}
                setEditingGoal={setEditingGoal}
                stagingTaskStatus={stagingTaskStatus}
                setStagingTaskStatus={setStagingTaskStatus}
                plannerScheduleDrawerPreSelect={plannerScheduleDrawerPreSelect}
                setPlannerScheduleDrawerPreSelect={setPlannerScheduleDrawerPreSelect}
                isPlanningWeek={autoFillLoading || planningWeek || plannerActionBusy === 'week'}
              />
            )}
            </PremiumSection>

            {plannerShowSecondary && (
              <>
                <section className="rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 shadow-sm mb-6 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPlannerProjectsOpen((o) => !o)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left font-sans text-sm font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                    aria-expanded={plannerProjectsOpen}
                  >
                    <span>Projects & milestones</span>
                    <span className="text-stone-400 shrink-0" aria-hidden>{plannerProjectsOpen ? '▼' : '▶'}</span>
                  </button>
                  {plannerProjectsOpen && (
                    <div className="border-t border-stone-200 dark:border-slate-600 p-4">
                      <HorizonsGantt
                        goals={goals ?? []}
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
                        onScheduleTask={(taskPayload) => {
                          if (taskPayload?.type === 'staging-task' && taskPayload?.task) {
                            setPlannerScheduleDrawerPreSelect(taskPayload);
                          }
                        }}
                      />
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 shadow-sm mb-6 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPlannerRoutinesOpen((o) => !o)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left font-sans text-sm font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                    aria-expanded={plannerRoutinesOpen}
                  >
                    <span>Routines</span>
                    <span className="text-stone-400 shrink-0" aria-hidden>{plannerRoutinesOpen ? '▼' : '▶'}</span>
                  </button>
                  {plannerRoutinesOpen && (
                    <div className="border-t border-stone-200 dark:border-slate-600 p-4">
                      <RoutinesManager />
                    </div>
                  )}
                </section>
              </>
            )}

            <PlanDayDrawer
              dateStr={plannerPlanDayDateStr}
              open={!!plannerPlanDayDateStr}
              onClose={() => setPlannerPlanDayDateStr(null)}
              backlogTasks={plannerDayBacklogTasks}
              loadDayPlan={loadDayPlan}
              saveDayPlanForDate={saveDayPlanForDate}
              goals={goals ?? []}
              weeklyEvents={weeklyEvents ?? []}
            />

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
                      Review suggestion
                    </h2>
                    <p className="font-sans text-sm text-stone-500 px-4 pb-4 shrink-0">
                      Mochi suggested this distribution for {pendingPlan.quota?.name ?? 'Quota'} — {pendingPlan.blocks?.length ?? 0} blocks
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
                        Apply
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
              {pendingWeekPlan && Object.keys(pendingWeekPlan).length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/50 backdrop-blur-sm"
                  onClick={() => setPendingWeekPlan(null)}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="review-week-heading"
                >
                  <motion.div
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 24, opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-600 shadow-xl overflow-hidden"
                  >
                    <h2 id="review-week-heading" className="font-serif text-stone-900 dark:text-stone-100 text-xl font-bold p-4 pb-2 shrink-0">
                      Mochi suggested this week
                    </h2>
                    <p className="font-sans text-sm text-stone-500 dark:text-stone-400 px-4 pb-4 shrink-0">
                      Review the suggested distribution below. Apply to save, or Adjust to edit in the planner.
                    </p>
                    <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-4">
                      <ul className="space-y-2" role="list">
                        {Object.entries(pendingWeekPlan)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([dateStr, dayAssigns]) => {
                            const count = typeof dayAssigns === 'object' && dayAssigns !== null ? Object.keys(dayAssigns).length : 0;
                            const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                            return (
                              <li
                                key={dateStr}
                                className="flex justify-between items-center py-3 px-3 rounded-xl bg-stone-50 dark:bg-slate-700/50 border border-stone-100 dark:border-slate-600"
                              >
                                <span className="font-sans font-medium text-stone-800 dark:text-stone-200">{dateLabel}</span>
                                <span className="font-sans text-sm text-stone-500 dark:text-stone-400">{count} item{count !== 1 ? 's' : ''}</span>
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                    <div className="flex gap-3 p-4 pt-2 border-t border-stone-200 dark:border-slate-600 shrink-0">
                      <button
                        type="button"
                        onClick={handleDiscardPendingWeekPlan}
                        className="flex-1 py-3.5 px-4 rounded-xl font-sans text-base font-semibold bg-stone-200 dark:bg-slate-600 text-stone-800 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 transition-colors"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingWeekPlan(null)}
                        className="flex-1 py-3.5 px-4 rounded-xl font-sans text-base font-semibold bg-stone-200 dark:bg-slate-600 text-stone-800 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 transition-colors"
                      >
                        Adjust
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyPendingWeekPlan}
                        className="flex-1 py-3.5 px-4 rounded-xl font-sans text-base font-semibold bg-moss-600 text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 transition-colors"
                      >
                        Apply
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
          </PremiumPlannerShell>
        )}
        {activeTab === 'today' && (
          <div className="mt-4 flex flex-wrap gap-4 font-sans text-sm">
            <button type="button" onClick={() => openModal('journal')} className="text-stone-500 hover:text-stone-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded">
              📔 Journal
            </button>
            <button type="button" id="tour-insights" onClick={() => openModal('insights')} className="text-stone-500 hover:text-stone-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded">
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
          onClick={() => setActiveTab('planner')}
          className={`flex items-center gap-2 min-w-[44px] min-h-[44px] justify-center rounded-full px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${activeTab === 'planner' ? 'bg-white/20 text-moss-300' : 'text-stone-400 hover:text-stone-200'}`}
          aria-current={activeTab === 'planner' ? 'page' : undefined}
          aria-label="Plan"
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
        onOpenSpiritBuilder={() => { setCommandPaletteOpen(false); openModal('mirror'); }}
      />

      {activeTab !== 'garden' && (
      <div id="guide-omni-add" className="relative">
        <TourHighlight step={2} tooltip="Great. Now add one tiny micro-habit to your list.">
        <OmniAdd
          onOpenGoalCreator={(title) => {
            setGoalCreatorInitialTitle(title ?? '');
            setGoalCreatorInitialSubtasks([]);
            setIsPlanting(true);
          }}
          onOpenScheduleEvent={() => setShowScheduleEventModal(true)}
          onOpenBrainDump={() => openModal('compost')}
          onParsedRoute={handleOmniAddParsedRoute}
        />
      </TourHighlight>
      </div>
      )}

      <AnimatePresence>
        {showSpiritMirror && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/40 backdrop-blur-sm overflow-y-auto safe-area-pb"
            onClick={() => closeModal('mirror')}
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
                onClick={() => closeModal('mirror')}
                aria-label="Close"
                className="absolute top-3 right-3 z-10 w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                ×
              </button>
              <SpiritBuilder
                mode="edit"
                initialConfig={spiritConfig}
                onComplete={() => closeModal('mirror')}
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
        open={showProjectPlanner}
        onClose={() => {
          setShowProjectPlanner(false);
          setProjectPlannerPrefill({ prefillTitle: '', prefillParentGoalId: '' });
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
        onClose={() => closeModal('accessibility')}
      />

      {showJournalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Journal"
          onClick={() => closeModal('journal')}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-stone-50 border border-stone-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-200 bg-stone-50/95 backdrop-blur-sm">
              <h2 className="font-serif text-lg text-stone-900">Journal</h2>
              <button
                type="button"
                onClick={() => closeModal('journal')}
                aria-label="Close"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200"
              >
                x
              </button>
            </div>
            <div className="flex-1 px-4 py-4 sm:py-6 overflow-y-auto">
              <div className="max-w-2xl mx-auto w-full">
                <Suspense fallback={<div className="p-6 text-sm text-stone-500">Loading journal...</div>}>
                  <JournalView />
                </Suspense>
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
          onClick={() => closeModal('insights')}
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
                    onClick={() => { closeModal('insights'); setActiveTab('today'); }}
                    className="px-2 py-1 rounded-full text-xs font-sans text-stone-600 hover:text-amber-500 hover:bg-white"
                  >
                    Now
                  </button>
                  <button
                    type="button"
                    onClick={() => { closeModal('insights'); setActiveTab('planner'); }}
                    className="px-2 py-1 rounded-full text-xs font-sans text-stone-600 hover:text-moss-600 hover:bg-white"
                  >
                    Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => { closeModal('insights'); setActiveTab('garden'); }}
                    className="px-2 py-1 rounded-full text-xs font-sans text-stone-600 hover:text-moss-600 hover:bg-white"
                  >
                    Garden
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => closeModal('insights')}
                  aria-label="Close"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200"
                >
                  x
                </button>
              </div>
            </div>
            <div className="flex-1 px-4 py-4 sm:py-6 overflow-y-auto">
              <div className="max-w-2xl mx-auto w-full">
                <Suspense fallback={<div className="p-6 text-sm text-stone-500">Loading insights...</div>}>
                  <AnalyticsView />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      )}

      <HabitNurseryModal open={isNurseryOpen} onClose={() => setIsNurseryOpen(false)} />

      <GoalEditor
        open={!!editingGoal}
        goal={editingGoal}
        onClose={() => setEditingGoal(null)}
        onSave={(updates) => { if (editingGoal?.id) editGoal(editingGoal.id, updates); setEditingGoal(null); }}
        addGoal={addGoal}
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
        onClose={() => closeModal('chat')}
        context={{
          goals: goals ?? [],
          logs: logs ?? [],
          energy: dailyEnergyModifier ?? 0,
          weather: weather ?? 'sun',
        }}
      />

      <CompostHeap
        open={showCompost}
        onClose={() => closeModal('compost')}
        onPlant={(text) => {
          setGoalCreatorInitialTitle(text ?? '');
          setGoalCreatorInitialSubtasks([]);
          closeModal('compost');
          setIsPlanting(true);
        }}
        onPrism={(text, subtasks) => {
          setGoalCreatorInitialTitle(text ?? '');
          setGoalCreatorInitialSubtasks(Array.isArray(subtasks) ? subtasks : []);
          closeModal('compost');
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
                      onChange={(e) => handleScheduleEventDateChange(e.target.value)}
                      className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="schedule-event-time" className="block font-sans text-sm font-medium text-stone-600 mb-1">Time</label>
                    <input
                      id="schedule-event-time"
                      type="time"
                      value={scheduleEventTime}
                      onChange={(e) => handleScheduleEventTimeChange(e.target.value)}
                      className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-sans text-sm font-medium text-stone-600 mb-1">Duration</label>
                    <div className="flex flex-wrap gap-2">
                      {EVENT_DURATION_OPTIONS.map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => handleScheduleEventDurationChange(mins)}
                          className={`px-3 py-2 rounded-xl font-sans text-sm transition-colors ${
                            !scheduleEventDurationCustom && scheduleEventDurationMinutes === mins
                              ? 'bg-moss-600 text-stone-50'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setScheduleEventDurationCustom(true)}
                        className={`px-3 py-2 rounded-xl font-sans text-sm transition-colors ${
                          scheduleEventDurationCustom
                            ? 'bg-moss-600 text-stone-50'
                            : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    {scheduleEventDurationCustom && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={480}
                          value={scheduleEventDurationMinutes}
                          onChange={(e) => handleScheduleEventDurationChange(e.target.value)}
                          className="w-24 py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                        />
                        <span className="font-sans text-sm text-stone-500">min</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="schedule-event-endtime" className="block font-sans text-sm font-medium text-stone-600 mb-1">Ends</label>
                    <input
                      id="schedule-event-endtime"
                      type="time"
                      value={scheduleEventEndTime}
                      onChange={(e) => handleScheduleEventEndTimeChange(e.target.value)}
                      className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                    />
                    {isScheduleEventEndNextDay && (
                      <p className="mt-1 font-sans text-xs text-stone-500">Ends next day</p>
                    )}
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

      {currentHelperIntervention?.type === HELPER_INTERVENTION_TYPES.NEXT_STEP && (
        <NextStepPrompt
          open
          completedTitle={currentHelperIntervention.payload?.completedTitle}
          nextStep={currentHelperIntervention.payload?.nextStep}
          onAddToThisWeek={(taskId) => {
            promoteTaskToThisWeek(taskId);
            dismissHelper(currentHelperIntervention.id);
          }}
          onLeaveInVault={() => dismissHelper(currentHelperIntervention.id)}
        />
      )}

      {currentHelperIntervention?.type === HELPER_INTERVENTION_TYPES.HABIT_STACK_HANDOFF && (
        <HabitStackHandoffPrompt
          open
          routineName={currentHelperIntervention.payload?.routineName}
          linkedTaskTitle={currentHelperIntervention.payload?.linkedTitle}
          onStart={() => {
            if (currentHelperIntervention.payload?.linkedGoal) {
              handleStartNowStart(
                { goal: currentHelperIntervention.payload.linkedGoal, goalId: currentHelperIntervention.payload.linkedGoal.id, subtaskId: currentHelperIntervention.payload.linkedSubtaskId ?? null },
                5
              );
            }
            dismissHelper(currentHelperIntervention.id);
          }}
          onLater={() => dismissHelper(currentHelperIntervention.id)}
        />
      )}

      {currentHelperIntervention?.type === HELPER_INTERVENTION_TYPES.SUPPORT_SUGGESTION && (
        <SupportSuggestionCard
          open
          parentGoal={currentHelperIntervention.payload?.parentGoal}
          domainId={currentHelperIntervention.payload?.domainId}
          suggestions={currentHelperIntervention.payload?.suggestions ?? []}
          onAccept={(result) => {
            if (result?.kind === 'goal' && result.goal) {
              addGoal(result.goal);
              addWater(1);
              const supportReward = buildReward({ type: 'SUPPORT_ACCEPTED' });
              if (supportReward && typeof pushReward === 'function') pushReward(supportReward);
              else if (typeof pushReward === 'function') pushReward({ message: 'Support step added.', tone: 'moss', icon: '🌱', durationMs: 2200, variableBonus: { waterDrops: 1 } });
            } else if (result?.kind === 'weekly_event' && result.event) {
              updateWeeklyEvents([...(Array.isArray(weeklyEvents) ? weeklyEvents : []), result.event]);
              addWater(1);
              const supportReward = buildReward({ type: 'SUPPORT_ACCEPTED' });
              if (supportReward && typeof pushReward === 'function') pushReward(supportReward);
              else if (typeof pushReward === 'function') pushReward({ message: 'Review block added to your week.', tone: 'moss', icon: '📅', durationMs: 2200, variableBonus: { waterDrops: 1 } });
            }
            dismissHelper(currentHelperIntervention.id);
          }}
          onDismiss={() => dismissHelper(currentHelperIntervention.id)}
        />
      )}

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

      {plannerUndoOffer && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 px-3 py-2 rounded-xl bg-stone-900 text-stone-100 font-sans text-xs shadow-lg border border-stone-600/50 w-[min(92vw,420px)]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="truncate">{plannerUndoOffer.label} applied.</span>
            <button
              type="button"
              onClick={handleUndoPlannerChip}
              className="shrink-0 px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 text-stone-50 font-medium focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              Undo
            </button>
          </div>
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
        steps={useShortTourSteps ? SHORT_TOUR_STEPS : undefined}
        onComplete={() => {
          setShowTour(false);
          setHasSeenTour(true);
          setUseShortTourSteps(false);
          setTourSeen(true);
        }}
      />

      {showAppGuide && (
        <FeatureTooltip
          targetId={GUIDE_STEPS[appGuideStep]?.targetId}
          message={GUIDE_STEPS[appGuideStep]?.message}
          onNext={() => {
            const isLast = appGuideStep >= GUIDE_STEPS.length - 1;
            const nextStep = isLast ? null : GUIDE_STEPS[appGuideStep + 1];
            if (nextStep?.tab === 'today') setActiveTab('today');
            if (nextStep?.tab === 'planner') setActiveTab('planner');
            if (nextStep?.tab === 'garden') setActiveTab('garden');
            updateUserSettings({ appGuideStep: isLast ? -1 : appGuideStep + 1 });
          }}
          onDismiss={() => updateUserSettings({ appGuideStep: -1 })}
          isLastStep={appGuideStep >= GUIDE_STEPS.length - 1}
        />
      )}
    </div>
    </>
  );
}

export default GardenDashboard;




