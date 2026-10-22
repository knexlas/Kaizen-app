import { useState, useEffect, useMemo, useCallback, useRef, Component, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { useTheme } from '../../context/ThemeContext';
import { useReward } from '../../context/RewardContext';
import { useDialog } from '../../context/DialogContext';
import { useEnergy } from '../../context/EnergyContext';
import WoodenSpoon from '../WoodenSpoon';
import { buildReward } from '../../services/dopamineEngine';
import { pickStarterTask } from '../../services/startAssist';
import { localISODate, diffDays, weekdayIndexMon0, jsDayFromMon0, getWeekId, daysUntilDeadline } from '../../services/dateUtils';
import TimeSlicer, { HOURS, MAX_SLOTS_BY_WEATHER, getAssignmentsForHour } from './TimeSlicer';
import { getCurrentSlotKey } from './CompassWidget';
import CommandPalette from './CommandPalette';
import OmniAdd from './OmniAdd';
import WeeklyMap from './WeeklyMap';
import MochiSpiritWithDialogue, { DefaultSpiritSvg, getSpiritGreeting, getPlanReaction } from './MochiSpirit';
import { draftPlanFromNote, generateNextThreeSteps, rewriteTaskAsExecutable } from '../../domains/planning/services/planningAiService';
import { generateSpiritInsight, generateMorningBriefing, generateHabitSynergy } from '../../domains/assistant/services/spiritAssistantService';
import { generateWeeklyPlan, generateMonthlyPlan, generateMonthlyPlanTasks, rebalanceMonthQuota } from '../../domains/planning/services/planningGenerationService';
import { parseOmniAddInput } from '../../domains/capture/services/captureAiService';
import { importICSFile, downloadICS, CALENDAR_PROVIDERS } from '../../services/calendarSyncService';
import { fetchOutlookEvents } from '../../services/microsoftCalendarService';
import { getStoredBriefing, setStoredBriefing } from '../../services/spiritBriefingStorage';
import { getNextTaskInSequence } from '../../services/nextStepService';
import { inferTaskTimingType } from '../../services/energyDictionaryService';
import { getRecommendationForTaskType } from '../../services/insightsReflectionService';
import { toCanonicalSlotKey, minutesToCanonicalSlotKey } from '../../services/schedulingConflictService';
import { createIntervention, getCurrentIntervention, removeFromQueue, HELPER_INTERVENTION_TYPES, shouldShowIntervention, recordHelperShown } from '../../services/helperInterventionService';
import { RECOVERY_COPY, NEGLECTED_PROJECT_COPY } from '../../services/recoveryCopyService';
import { getActiveProjects, getProjectHealthState, getNeglectedProjects } from '../../services/projectSupportService';
import {
  getAssistantOperatorSignals,
} from '../../services/projectCockpitService';
import { getPlannedHoursByScope } from '../../utils/plannedHoursAggregation';
import NextStepPrompt from './NextStepPrompt';
import { useTinyStepSuggestions, isAssignmentFixed } from './NextTinyStep';
import HabitStackHandoffPrompt from './HabitStackHandoffPrompt';
import EveningWindDown from './EveningWindDown';
import FocusScaffoldCard from '../Focus/FocusScaffoldCard';
import PlannerRoutineSupportList from './PlannerRoutineSupportList';
import { PlanDayDrawer, buildBacklogTasks, getPlanItemsForDate, formatHourKey } from '../CommandCenter/StagingArea';
import SpiritGuideTour, { SHORT_TOUR_STEPS } from '../Onboarding/SpiritGuideTour';
import TourHighlight from '../Onboarding/TourHighlight';
import FeatureTooltip from '../Onboarding/FeatureTooltip';
import SupportSuggestionCard from './SupportSuggestionCard';
import { PremiumPlannerShell, PremiumSection, PremiumSectionHeader, PremiumActionRow } from './PremiumPlannerPrimitives';
import AiActionChips from '../Spirit/AiActionChips';
import { getGoalSupportDomain, resolveSupportSuggestions, getActiveSupportDomainForWeek, getWeeklyPrompt, getSuggestionTemplate, createFromSupportSuggestion } from '../../services/domainSupportService';
import { fetchGoogleEvents, createGoogleEvent } from '../../services/googleCalendarService';
import { getTourSeen, setTourSeen, consumeTriggerTourFlag } from '../../services/onboardingStateService';
import { findAvailableSlots, generateLiquidSchedule, generateSolidSchedule, getDefaultWeekStart, getStormWarnings, getStormImpactForDay, timeToMinutes, minutesToTime, generateDailyPlan, materializeWeeklyPlan, getSpoonCost, hourFromTimeStr, suggestLoadLightening, autoFillWeek } from '../../services/schedulerService';
import { normalizeTaskCapture, toPlanAssignmentFromTask } from '../../services/taskCaptureService';
import { buildGoalFromCapture, buildGoalFromDraftPlan, minimumViableDayCommand, moveLowEnergyTasksLaterCommand, planReliefCommand, protectFocusBlockCommand, pullTaskForwardCommand, startFocusCommand } from '../../services/coreCommands';
import { getPlannerTabPresetConfig } from '../../constants/plannerPresets';
import { getGamificationIntensity, getGamificationConfig, shouldShowHelperForIntensity } from '../../constants/gamificationIntensity';
import { getRitualForToday } from './GardenDashboard.shared';
import { usePlanningSnapshot } from '../../domains/planning/hooks/usePlanningSnapshot';
import { useLearnedEnergyProfile } from '../../domains/vitality/hooks/useLearnedEnergyProfile';
import { buildTodayAssistantActions } from '../../domains/assistant/services/todayAssistantActions';
import { MAINTENANCE_BLOCK_TEMPLATES, suggestMaintenanceTemplates } from '../../domains/recovery/services/maintenanceBlockService';
import { buildRoutinePatternSuggestions } from '../../domains/recovery/services/routinePatternSuggestionService';
import { buildRestartResumeModel } from '../../domains/recovery/services/restartResumeService';
import {
  loadInterruptionMemory,
  saveInterruptionMemory,
  recordInterruptionSnapshot,
  buildInterruptionResumeSummary,
} from '../../domains/recovery/services/interruptionMemoryService';
import { buildTaskInitiationSupport, shouldShowTaskInitiationSupport } from '../../domains/assistant/services/taskInitiationSupportService';
import { getWaitingItemsDue, WAITING_TYPES } from '../../domains/recovery/services/waitingSupportService';
import { LIFE_DOMAIN_TEMPLATES, buildLifeDomainFromIntent, buildDomainSupportPlan, computeLifeDomainHealth } from '../../domains/recovery/services/lifeDomainService';
import { getProtectedTimeSignals } from '../../domains/recovery/services/protectedTimeService';

const GardenWalk = lazy(() => import('../Garden/GardenWalk'));
const JournalView = lazy(() => import('./JournalView'));
const AnalyticsView = lazy(() => import('./AnalyticsView'));
const StartNowModal = lazy(() => import('../StartAssist/StartNowModal'));
const GentleRestartModal = lazy(() => import('../Onboarding/GentleRestartModal'));
const AccessibilitySettingsModal = lazy(() => import('../Settings/AccessibilitySettingsModal'));
const GoalCreator = lazy(() => import('../Goals/GoalCreator'));
const ProjectPlanner = lazy(() => import('../Projects/ProjectPlanner'));
const HorizonsGantt = lazy(() => import('../Horizons/HorizonsGantt'));
const GoalEditor = lazy(() => import('../Goals/GoalEditor'));
const SpiritChat = lazy(() => import('./SpiritChat'));
const CompostHeap = lazy(() => import('./CompostHeap'));
const MorningCheckIn = lazy(() => import('./MorningCheckIn'));
const HabitNurseryModal = lazy(() => import('./HabitNurseryModal'));
const FocusSession = lazy(() => import('../Focus/FocusSession'));
const TeaCeremony = lazy(() => import('../Focus/TeaCeremony'));
const SettingsView = lazy(() => import('./SettingsView'));
const RoutinesManager = lazy(() => import('./RoutinesManager'));
const SpiritBuilder = lazy(() => import('../Onboarding/SpiritBuilder'));
const SpiritOrigins = lazy(() => import('../Onboarding/SpiritOrigins'));
const PlanDayPanel = lazy(() => import('./PlanDayPanel'));
const PlanMonthPanel = lazy(() => import('./PlanMonthPanel'));
const PlanWeekPanel = lazy(() => import('./PlanWeekPanel'));
const PlannerManageHub = lazy(() => import('./PlannerManageHub'));
const DailyPlanRitual = lazy(() => import('./DailyPlanRitual'));

const TASK_START_PREFS_KEY = 'kaizen:task-start-support-prefs';
const LOW_FRICTION_MODE_KEY = 'kaizen:low-friction-mode';
const PLANNER_SUPPORT_EXPLAINERS = {
  review: 'Review load, confidence, deadlines, and weekly risk before you change the plan.',
  projects: 'Use Projects for milestones, structure, and project decomposition.',
  systems: 'Use Systems for routines, maintenance, and recurring support.',
};

function LoadingSurface({ label = 'Loading surface...', fullscreen = false }) {
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/10 backdrop-blur-sm">
        <div className="rounded-[28px] border border-stone-200/80 bg-white/92 px-5 py-4 shadow-xl dark:border-slate-600/80 dark:bg-slate-900/92">
          <p className="font-sans text-sm text-stone-600 dark:text-stone-300">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-stone-200/80 bg-white/82 p-6 shadow-sm dark:border-slate-600/80 dark:bg-slate-800/78">
      <p className="font-sans text-sm text-stone-500 dark:text-stone-300">{label}</p>
    </div>
  );
}

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
  const { goals, weeklyEvents, logs, spiritPoints, addGoal, updateGoalProgress, updateUserSettings, updateGoalMilestone, editGoal, deleteGoal, addSubtask, updateSubtask, deleteSubtask, updateSubtaskProgress, toggleMilestone, updateMilestone, addMilestone, deleteMilestone, promoteTaskToThisWeek, lastCheckInDate, lastSundayRitualDate, completeMorningCheckIn, dailyEnergyModifier, dailySpoonCount, addLog, logMetric, googleUser, connectCalendar, disconnectCalendar, googleToken, updateWeeklyEvents, weeklyNorthStarId, cloudSaveStatus, spiritConfig, setSpiritConfig, compost, addToCompost, removeFromCompost, soilNutrients, consumeSoilNutrients, earnEmbers, addWater, today, assignments, setAssignments, gentleResetToToday, archiveStalePlanItems, compostStaleSeeds, runCriticalMassCheck, eveningMode, setEveningMode, userSettings, addRitualCategory, saveDayPlanForDate, loadDayPlan, weekAssignments, monthlyQuotas, addMonthlyQuota, updateMonthlyQuota, msUser, msToken, connectOutlook, disconnectOutlook, refreshOutlookToken, tourStep, setTourStep, pausedDays, needsRescheduling, rescheduleNeedsReschedulingItem, clearDaySchedule, spawnedVolumeBlocks, removeSpawnedVolumeBlock, stagingTaskStatus, setStagingTaskStatus, maintenanceBlocks = [], addMaintenanceBlock, updateMaintenanceBlock, deleteMaintenanceBlock, socialFollowUps = [], addSocialFollowUp, updateSocialFollowUp, routines = [], recurringSupportState = {}, pauseRoutineTemporarily, softenRoutineIntensity, markRoutineSupportState, waitingSupportState = {}, setGoalWaitingSupport, resolveGoalWaitingSupport, lifeDomains = [], addLifeDomain, deleteLifeDomain, routineSupportPlacements = [], removeRoutineSupportPlacement } = useGarden();
  const { pushReward, lastGardenImpact, clearLastGardenImpact } = useReward();
  const { showConfirm } = useDialog();
  const { darkMode: themeDarkMode, setDarkModeOverride } = useTheme();
  const { dailyEnergy, setEnergyLevel, behaviorHistory, recordFocusBehavior, recordCheckInBehavior } = useEnergy();
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
  const [projectPlannerImportedPlan, setProjectPlannerImportedPlan] = useState(null);
  const [projectPlannerFocusGoalId, setProjectPlannerFocusGoalId] = useState(null);
  const [horizonsView, setHorizonsView] = useState('planning'); // 'planning' | 'metrics'
  const [plannerPlanDayDateStr, setPlannerPlanDayDateStr] = useState(null); // day chosen in Planner to open PlanDayDrawer
  const [plannerScheduleDrawerPreSelect, setPlannerScheduleDrawerPreSelect] = useState(null); // pre-select task when opening schedule drawer from Horizons
  const [plannerViewMode, setPlannerViewMode] = useState('week'); // 'day' | 'week' | 'month'
  const [plannerDayExpanded, setPlannerDayExpanded] = useState(false); // Day lens starts collapsed
  const [plannerProjectsOpen, setPlannerProjectsOpen] = useState(false); // collapsible Projects & milestones
  const [plannerRoutinesOpen, setPlannerRoutinesOpen] = useState(false); // collapsible Routines
  const [plannerMaintenanceOpen, setPlannerMaintenanceOpen] = useState(false); // collapsible maintenance blocks
  const [taskStartPrefs, setTaskStartPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem(TASK_START_PREFS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [taskStartPanelOpen, setTaskStartPanelOpen] = useState(false);
  const [showFocusScaffold, setShowFocusScaffold] = useState(false);
  const [lowFrictionModeEnabled, setLowFrictionModeEnabled] = useState(false);
  const [lowFrictionStayDate, setLowFrictionStayDate] = useState(null);
  const [lowFrictionDismissedDate, setLowFrictionDismissedDate] = useState(null);
  const [interruptionMemory, setInterruptionMemory] = useState(() => loadInterruptionMemory());
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
  const [omniAddPrefillText, setOmniAddPrefillText] = useState('');
  const [omniAddRequestOpenSignal, setOmniAddRequestOpenSignal] = useState(0);
  const [scheduleEventPrefill, setScheduleEventPrefill] = useState(null); // { title?, startTime?, endTime?, location?, participants?, originalText? }
  const [showDailyPlanRitual, setShowDailyPlanRitual] = useState(false);
  const [showTodaySupportSheet, setShowTodaySupportSheet] = useState(false);
  const [plannerSupportDrawer, setPlannerSupportDrawer] = useState(null); // 'review' | 'projects' | 'systems' | 'manage' | null
  const [plannerSystemsMode, setPlannerSystemsMode] = useState('overview'); // 'overview' | 'routines'
  const [showPlannerRoutineSuggestions, setShowPlannerRoutineSuggestions] = useState(false);
  const [ritualDayPlan, setRitualDayPlan] = useState({});
  const [scheduleEventTitle, setScheduleEventTitle] = useState('');
  const [scheduleEventDate, setScheduleEventDate] = useState(() => localISODate());
  const [scheduleEventTime, setScheduleEventTime] = useState('09:00');
  const [scheduleEventDurationMinutes, setScheduleEventDurationMinutes] = useState(60);
  const [scheduleEventDurationCustom, setScheduleEventDurationCustom] = useState(false);
  const [scheduleEventEndTime, setScheduleEventEndTime] = useState('10:00');
  const [scheduleEventSaving, setScheduleEventSaving] = useState(false);
  const [scheduleEventLocation, setScheduleEventLocation] = useState('');
  const [scheduleEventParticipants, setScheduleEventParticipants] = useState('');
  const [scheduleEventSourceText, setScheduleEventSourceText] = useState('');
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
  const plannerShowSecondary = false;
  const [dismissedCurrentTaskStripKey, setDismissedCurrentTaskStripKey] = useState(null);
  const plannerPresetDefaultsAppliedRef = useRef(false);
  const isLegacyTourActive = showTour || (typeof tourStep === 'number' && tourStep > 0 && tourStep < 5);
  const showAppGuide = hasSeenTour && !isLegacyTourActive && !showSpiritOrigins && appGuideStep >= 0 && appGuideStep < GUIDE_STEPS.length;

  const gamificationIntensity = getGamificationIntensity(userSettings);
  const gamificationConfig = getGamificationConfig(userSettings ?? {});
  const currentHelperIntervention = useMemo(() => getCurrentIntervention(helperQueue), [helperQueue]);

  useEffect(() => {
    if (!hydrated || !userSettings || plannerPresetDefaultsAppliedRef.current) return;
    const tabConfig = getPlannerTabPresetConfig(userSettings);
    setPlannerViewMode((prev) => ((tabConfig.defaultView === 'day' || tabConfig.defaultView === 'month' || tabConfig.defaultView === 'week') ? tabConfig.defaultView : prev));
    setPlannerProjectsOpen((prev) => (tabConfig.expandProjectsDefault ?? prev));
    setPlannerRoutinesOpen((prev) => (tabConfig.expandRoutinesDefault ?? prev));
    plannerPresetDefaultsAppliedRef.current = true;
  }, [hydrated, userSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(TASK_START_PREFS_KEY, JSON.stringify(taskStartPrefs ?? {}));
    } catch {
      // ignore preference persistence failures
    }
  }, [taskStartPrefs]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOW_FRICTION_MODE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setLowFrictionModeEnabled(parsed.enabled === true);
        setLowFrictionStayDate(typeof parsed.stayDate === 'string' ? parsed.stayDate : null);
        setLowFrictionDismissedDate(typeof parsed.dismissedDate === 'string' ? parsed.dismissedDate : null);
      }
    } catch {
      // ignore read errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOW_FRICTION_MODE_KEY, JSON.stringify({
        enabled: lowFrictionModeEnabled,
        stayDate: lowFrictionStayDate,
        dismissedDate: lowFrictionDismissedDate,
      }));
    } catch {
      // ignore write errors
    }
  }, [lowFrictionModeEnabled, lowFrictionStayDate, lowFrictionDismissedDate]);

  useEffect(() => {
    saveInterruptionMemory(interruptionMemory);
  }, [interruptionMemory]);

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
      const weekReward = buildReward({ type: 'WEEK_REVIEWED' });
      if (weekReward) pushReward(weekReward);
      addWater?.(1);
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
          pushReward({ message: 'Planning failed. Try again or check Settings.', tone: 'slate', icon: '🔌', sound: null });
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
        pushReward({ message: 'Monthly planning failed or returned no tasks. Try again or check Settings.', tone: 'slate', icon: '🔌', sound: null });
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
  const [assistantActionBusy, setAssistantActionBusy] = useState(null);
  const {
    planningEntry,
    weekDateStrings,
    loggedByGoalThisWeek,
    weekCapacityHours,
    plannedTotalMinutes,
    recommendedToday,
    needsAttention,
    weekCapacity,
  } = usePlanningSnapshot({
    userSettings,
    logs,
    goals,
    weekAssignments,
    today,
  });
  const {
    learnedEnergyProfile,
    learnedFocusRecommendation,
    learnedAdminRecommendation,
    learnedLowEnergyRecommendation,
  } = useLearnedEnergyProfile({
    logs,
    goals,
    weekAssignments,
    behaviorHistory,
    userSettings,
  });
  const plannerViewMeta = useMemo(() => {
    if (plannerViewMode === 'day') {
      return {
        title: 'Build today',
        description: 'Choose what fits today, then open the day planner only when you need to place or adjust specific blocks.',
        primaryActionLabel: plannerActionBusy === 'day' ? 'Shaping...' : 'Shape today',
      };
    }
    if (plannerViewMode === 'month') {
      return {
        title: 'Shape this month',
        description: 'Keep month planning broad: decide what belongs this month before you assign specific days.',
        primaryActionLabel: isGeneratingMonthPlan || plannerActionBusy === 'month' ? 'Shaping...' : 'Shape month (AI)',
      };
    }
    return {
      title: 'Plan your week',
      description: 'Place work into days first, then open a day only when you need more detail.',
      primaryActionLabel: autoFillLoading || plannerActionBusy === 'week' ? 'Planning...' : 'Plan this week',
    };
  }, [plannerViewMode, plannerActionBusy, autoFillLoading, isGeneratingMonthPlan]);

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

  useEffect(() => {
    if (activeTab !== 'planner' && plannerSupportDrawer) {
      setPlannerSupportDrawer(null);
    }
  }, [activeTab, plannerSupportDrawer]);

  useEffect(() => {
    if (plannerSupportDrawer !== 'systems' && plannerSystemsMode !== 'overview') {
      setPlannerSystemsMode('overview');
    }
  }, [plannerSupportDrawer, plannerSystemsMode]);

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
      const reward = buildReward({ type: 'LOAD_LIGHTENED', payload: { removedCount } });
      if (reward) pushReward(reward);
      addWater?.(1);
      const relief = planReliefCommand({ removedItems: result.removedItems ?? [] });
      setLoadLightenedMessage(relief?.message ?? null);
    } catch (e) {
      console.warn('Lighten today failed', e);
      pushReward?.({ message: 'Could not lighten today. Try again.', tone: 'slate', icon: '!', sound: null });
    } finally {
      setPlannerActionBusy(null);
    }
  }, [today, loadDayPlan, saveDayPlanForDate, goals, dailyEnergyModifier, pushReward, addWater, userSettings?.dayStart, userSettings?.dayEnd]);

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
      const plan = generateDailyPlan(goals ?? [], slotCount, eventsForPlan, { stormBufferMinutes: 30, startHour, endHour, learnedEnergyProfile });
      await saveDayPlanForDate(today, plan ?? {});
      setPlannerDayExpanded(true);
      pushReward?.({ message: learnedFocusRecommendation?.explanation ? `Suggested a day plan. ${learnedFocusRecommendation.explanation}` : 'Suggested a day plan.', tone: 'moss', icon: 'S', durationMs: 2600 });
    } catch (e) {
      console.warn('Suggest today plan failed', e);
      pushReward?.({ message: 'Could not suggest a day plan. Try again.', tone: 'slate', icon: '!', sound: null });
    } finally {
      setPlannerActionBusy(null);
    }
  }, [today, saveDayPlanForDate, userSettings?.dayStart, userSettings?.dayEnd, dailySpoonCount, weeklyEvents, goals, pushReward, learnedEnergyProfile, learnedFocusRecommendation]);

  const handleOpenDailyPlanRitual = useCallback(async () => {
    if (!today || typeof loadDayPlan !== 'function') return;
    const plan = (await loadDayPlan(today)) ?? {};
    setRitualDayPlan(plan);
    setShowDailyPlanRitual(true);
  }, [today, loadDayPlan]);

  const handleDailyPlanRitualConfirm = useCallback(
    async (selectedTasks) => {
      if (!today || !Array.isArray(selectedTasks) || selectedTasks.length === 0) return;
      if (typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return;
      const startHour = hourFromTimeStr(userSettings?.dayStart, 8);
      const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
      let day = { ...ritualDayPlan };
      for (const task of selectedTasks) {
        const goal = (goals ?? []).find((g) => g.id === task.goalId);
        const assignment = toPlanAssignmentFromTask(
          { goalId: task.goalId, title: task.title, subtaskId: task.subtaskId },
          goal
        );
        if (!assignment) continue;
        const slot = findFirstFreeHourKey(day, startHour, endHour);
        if (slot) {
          day[slot] = assignment;
        } else {
          day.anytime = Array.isArray(day.anytime) ? [...day.anytime, assignment] : [assignment];
        }
      }
      await saveDayPlanForDate(today, day);
      setRitualDayPlan(day);
      pushReward?.({ message: 'Today\'s plan updated.', tone: 'moss', icon: '✓', durationMs: 2200 });
    },
    [today, ritualDayPlan, loadDayPlan, saveDayPlanForDate, goals, userSettings?.dayStart, userSettings?.dayEnd, findFirstFreeHourKey, pushReward]
  );

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
      const startHour = learnedEnergyProfile?.focusWindow?.startHour ?? hourFromTimeStr(userSettings?.dayStart, 9);
      const endHour = learnedEnergyProfile?.focusWindow?.endHour ?? hourFromTimeStr(userSettings?.dayEnd, 22);
      const dates = plannerWeekDates;
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
        const why = learnedEnergyProfile?.focusWindow?.explanation;
        pushReward?.({ message: why ? `Protected focus at ${slot}. ${why}` : `Protected focus at ${slot}.`, tone: 'moss', icon: 'S', durationMs: 2600 });
        return;
      }
      pushReward?.({ message: 'No free slot available in this horizon.', tone: 'slate', icon: '!', sound: null });
    } catch (e) {
      console.warn('Planner chip protect focus failed', e);
      pushReward?.({ message: 'Could not protect focus block. Try again.', tone: 'slate', icon: '!', sound: null });
    } finally {
      setPlannerChipBusy(null);
    }
  }, [loadDayPlan, saveDayPlanForDate, userSettings?.dayStart, userSettings?.dayEnd, plannerWeekDates, weeklyNorthStarId, goals, findFirstFreeHourKey, pushReward, offerPlannerUndo, learnedEnergyProfile]);

  const handlePlannerChipRescheduleOne = useCallback(async () => {
    if (typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return;
    setPlannerChipBusy('reschedule');
    setPlannerUndoOffer(null);
    try {
      const startHour = hourFromTimeStr(userSettings?.dayStart, 9);
      const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
      const dateOrder = plannerWeekDates;
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
      const rescheduleReward = buildReward({ type: 'RESCHEDULED' });
      if (rescheduleReward) pushReward?.(rescheduleReward);
      addWater?.(1);
    } catch (e) {
      console.warn('Planner chip reschedule failed', e);
      pushReward?.({ message: 'Could not reschedule block. Try again.', tone: 'slate', icon: '!', sound: null });
    } finally {
      setPlannerChipBusy(null);
    }
  }, [loadDayPlan, saveDayPlanForDate, userSettings?.dayStart, userSettings?.dayEnd, plannerWeekDates, findFirstFreeHourKey, pushReward, offerPlannerUndo]);

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

  const addCaptureAssignmentToDayPlan = useCallback(
    async (capture, assignment) => {
      if (!capture?.scheduledDate || !assignment || typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') {
        return false;
      }
      const current = (await loadDayPlan(capture.scheduledDate)) ?? {};
      const next = { ...(typeof current === 'object' && current ? current : {}) };
      if (capture.scheduledTime) {
        const slotKey = toCanonicalSlotKey(capture.scheduledTime);
        const existing = next[slotKey];
        if (existing == null) next[slotKey] = assignment;
        else next[slotKey] = [...(Array.isArray(existing) ? existing : [existing]), assignment];
      } else {
        next.anytime = Array.isArray(next.anytime) ? [...next.anytime, assignment] : [assignment];
      }
      await saveDayPlanForDate(capture.scheduledDate, next);
      return true;
    },
    [loadDayPlan, saveDayPlanForDate]
  );

  const routeNormalizedCapture = useCallback(
    async (result) => {
      if (!result || !result.title) return;
      const capture = normalizeTaskCapture(result, result?.rawText ?? result?.title);

      if (capture.route === 'inbox' || capture.route === 'compost') {
        await addToCompost(capture.rawText || capture.title);
        pushReward?.({ message: 'Captured to inbox for triage.', tone: 'moss', icon: '📥', durationMs: 2200 });
        return;
      }

      if (capture.route === 'social_bucket' || capture.captureKind === 'social_followup') {
        addSocialFollowUp?.({ text: capture.rawText || capture.title, source: 'omniadd' });
        pushReward?.({ message: 'Added to social follow-up bucket.', tone: 'moss', icon: '💬', durationMs: 2200 });
        return;
      }

      if (capture.route === 'life_domains' || capture.captureKind === 'life_domain') {
        const domain = buildLifeDomainFromIntent(capture.rawText || capture.title);
        const created = addLifeDomain?.(domain);
        const support = buildDomainSupportPlan(created ?? domain);
        if (Array.isArray(support.maintenanceTemplates) && support.maintenanceTemplates.length > 0 && typeof addMaintenanceBlock === 'function') {
          support.maintenanceTemplates.slice(0, 2).forEach((template) => {
            addMaintenanceBlock({ templateId: template.id, ...template });
          });
        }
        if (support.followUpBucket === 'social_followups' && typeof addSocialFollowUp === 'function') {
          addSocialFollowUp({ text: `${(created ?? domain).title}: follow-up check-in`, source: 'life_domain', status: 'pending' });
        }
        pushReward?.({ message: `Domain support created for ${(created ?? domain).title}.`, tone: 'moss', icon: '🧭', durationMs: 2400 });
        return;
      }

      if (capture.route === 'project_planner') {
        setProjectPlannerPrefill({ prefillTitle: capture.title, prefillParentGoalId: '' });
        setProjectPlannerImportedPlan(null);
        setProjectPlannerFocusGoalId(null);
        setShowProjectPlanner(true);
        return;
      }

      if (capture.route === 'schedule_event') {
        const durationMinutes = (() => {
          if (!capture.startTime || !capture.endTime) return 60;
          const start = new Date(capture.startTime).getTime();
          const end = new Date(capture.endTime).getTime();
          if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 60;
          return Math.max(15, Math.min(480, Math.round((end - start) / (60 * 1000))));
        })();

        if (capture.scheduledDate && capture.scheduledTime) {
          const saved = await addCaptureAssignmentToDayPlan(capture, {
            type: 'event',
            title: capture.title,
            duration: durationMinutes,
            fixed: true,
            isFixed: true,
            source: 'local',
            ...(capture.startTime ? { startTime: capture.startTime } : {}),
            ...(capture.endTime ? { endTime: capture.endTime } : {}),
          });
          if (saved) {
            pushReward?.({ message: 'Event captured and placed on your day.', tone: 'moss', icon: '📅', durationMs: 2600 });
            return;
          }
        }

        setScheduleEventPrefill({
          title: capture.title,
          startTime: capture.startTime,
          endTime: capture.endTime,
          location: capture.location,
          participants: capture.participants,
          originalText: capture.rawText,
        });
        if (capture.scheduledDate) setScheduleEventDate(capture.scheduledDate);
        if (capture.scheduledTime) setScheduleEventTime(capture.scheduledTime);
        setShowScheduleEventModal(true);
        return;
      }

      const goal = buildGoalFromCapture({
        title: capture.title,
        captureKind: capture.captureKind,
        energyCost: capture.energyCost,
        isFixed: capture.isFixed,
        context: capture.context,
        recurrence: capture.recurrence,
        waitingSupport: capture.waitingSupport,
      });
      addGoal(goal);
      if (capture.waitingSupport && goal?.id && typeof setGoalWaitingSupport === 'function') {
        setGoalWaitingSupport(goal.id, capture.waitingSupport);
      }

      const firstSubtaskId = Array.isArray(goal.subtasks) ? goal.subtasks[0]?.id : null;
      if (firstSubtaskId && capture.captureKind !== 'habit' && !(capture.captureKind === 'scheduled_item' && capture.scheduledDate)) {
        setStagingTaskStatus((prev) => ({ ...prev, [firstSubtaskId]: 'active' }));
      }

      let placedInPlan = false;
      if (capture.scheduledDate) {
        placedInPlan = await addCaptureAssignmentToDayPlan(capture, {
          goalId: goal.id,
          title: capture.title,
          type: goal.type,
          duration: goal.estimatedMinutes ?? 30,
          ...(firstSubtaskId ? { subtaskId: firstSubtaskId } : {}),
          ...(capture.isFixed || capture.scheduledTime ? { fixed: true } : {}),
        });
      }

      pushReward?.({
        message: capture.captureKind === 'habit'
          ? 'Habit captured.'
          : capture.captureKind === 'scheduled_item'
            ? (placedInPlan ? 'Task captured and placed in your plan.' : 'Task captured.')
            : 'Task captured.',
        tone: 'moss',
        icon: capture.captureKind === 'habit' ? '🌱' : '✓',
        durationMs: 2400,
      });
    },
    [addCaptureAssignmentToDayPlan, addGoal, addToCompost, addSocialFollowUp, pushReward, setStagingTaskStatus, addLifeDomain, addMaintenanceBlock]
  );

  const handleOmniAddParsedRoute = useCallback(
    async (result) => {
      await routeNormalizedCapture(result);
    },
    [routeNormalizedCapture]
  );

  const requestOmniAddOpen = useCallback((text = '') => {
    setOmniAddPrefillText(String(text || '').trim());
    setOmniAddRequestOpenSignal((v) => v + 1);
  }, []);

  const handleCaptureFromPalette = useCallback(
    async (rawText) => {
      const trimmed = String(rawText || '').trim();
      if (!trimmed) return;
      try {
        const parsed = await parseOmniAddInput(trimmed);
        await routeNormalizedCapture({ ...(parsed || {}), title: parsed?.title ?? trimmed, rawText: trimmed });
      } catch {
        await routeNormalizedCapture({ title: trimmed, rawText: trimmed });
      }
      setCommandPaletteOpen(false);
    },
    [routeNormalizedCapture]
  );

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
        setScheduleEventLocation(scheduleEventPrefill.location ?? '');
        setScheduleEventParticipants(Array.isArray(scheduleEventPrefill.participants) ? scheduleEventPrefill.participants.join(', ') : '');
        setScheduleEventSourceText(scheduleEventPrefill.originalText ?? '');

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
        setScheduleEventLocation('');
        setScheduleEventParticipants('');
        setScheduleEventSourceText('');
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
        const participants = scheduleEventParticipants
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

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
            ...(scheduleEventLocation ? { location: scheduleEventLocation } : {}),
            ...(participants.length > 0 ? { participants } : {}),
            ...(scheduleEventSourceText ? { originalText: scheduleEventSourceText } : {}),
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
          ...(scheduleEventLocation ? { location: scheduleEventLocation } : {}),
          ...(participants.length > 0 ? { participants } : {}),
          ...(scheduleEventSourceText ? { originalText: scheduleEventSourceText } : {}),
        };
        if (googleToken) {
          try {
            const created = await createGoogleEvent(googleToken, {
              title,
              startTime,
              endTime,
              location: scheduleEventLocation,
              participants,
              originalText: scheduleEventSourceText,
            });
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
      scheduleEventLocation,
      scheduleEventParticipants,
      scheduleEventSourceText,
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

  /** Planned hours summary for Plan tab (by scope: week / month). */
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
    const rows = [];
    (goals ?? []).forEach((goal) => {
      if (goal?._projectDeadline) {
        const d = new Date(`${goal._projectDeadline}T00:00:00`);
        if (Number.isFinite(d.getTime()) && d >= base && d <= horizon) {
          rows.push({ id: `${goal.id}-project`, goalId: goal.id, title: goal.title || 'Project', label: 'Project due', date: goal._projectDeadline, daysLeft: daysUntilDeadline(goal._projectDeadline) });
        }
      }
      (goal?.subtasks ?? []).forEach((sub) => {
        if (!sub?.deadline) return;
        const d = new Date(`${sub.deadline}T00:00:00`);
        if (!Number.isFinite(d.getTime()) || d < base || d > horizon) return;
        rows.push({ id: sub.id || `${goal.id}-${sub.title}`, goalId: goal.id, title: sub.title || 'Task', label: goal.title || 'Goal', date: sub.deadline, daysLeft: daysUntilDeadline(sub.deadline) });
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

  const prevPlannerTabRef = useRef(activeTab);
  useEffect(() => {
    if (activeTab === 'planner' && prevPlannerTabRef.current !== 'planner' && plannerLoad.ratio >= 1 && shouldShowIntervention(HELPER_INTERVENTION_TYPES.OVERLOADED) && shouldShowHelperForIntensity(HELPER_INTERVENTION_TYPES.OVERLOADED, gamificationIntensity)) {
      recordHelperShown(HELPER_INTERVENTION_TYPES.OVERLOADED);
      setHelperQueue((prev) => [...prev, createIntervention(HELPER_INTERVENTION_TYPES.OVERLOADED, { source: 'planner_open', ratio: plannerLoad.ratio })]);
    }
    prevPlannerTabRef.current = activeTab;
  }, [activeTab, plannerLoad.ratio, gamificationIntensity]);

  const prevProjectPlannerOpenRef = useRef(showProjectPlanner);
  useEffect(() => {
    if (showProjectPlanner && !prevProjectPlannerOpenRef.current) {
      const active = getActiveProjects(goals);
      const context = { logs: logs ?? [], weekAssignments: weekAssignments ?? {}, goals: goals ?? [] };
      const blocked = active.filter((g) => getProjectHealthState(g, context) === 'stuck');
      const neglected = getNeglectedProjects(goals, logs ?? [], 7);
      if (blocked.length > 0 && shouldShowIntervention(HELPER_INTERVENTION_TYPES.NO_NEXT_STEP) && shouldShowHelperForIntensity(HELPER_INTERVENTION_TYPES.NO_NEXT_STEP, gamificationIntensity)) {
        recordHelperShown(HELPER_INTERVENTION_TYPES.NO_NEXT_STEP);
        setHelperQueue((prev) => [...prev, createIntervention(HELPER_INTERVENTION_TYPES.NO_NEXT_STEP, { source: 'project_planner_open', blockedCount: blocked.length })]);
      }
      if (neglected.length > 0 && shouldShowIntervention(HELPER_INTERVENTION_TYPES.NEGLECTED_PROJECT_REVIVAL) && shouldShowHelperForIntensity(HELPER_INTERVENTION_TYPES.NEGLECTED_PROJECT_REVIVAL, gamificationIntensity)) {
        recordHelperShown(HELPER_INTERVENTION_TYPES.NEGLECTED_PROJECT_REVIVAL);
        setHelperQueue((prev) => [...prev, createIntervention(HELPER_INTERVENTION_TYPES.NEGLECTED_PROJECT_REVIVAL, { source: 'project_planner_open', neglectedCount: neglected.length })]);
      }
    }
    prevProjectPlannerOpenRef.current = showProjectPlanner;
  }, [showProjectPlanner, goals, logs, gamificationIntensity]);

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
    if (!gamificationConfig.autoShowSpiritDialogue || hasShownSpiritRef.current) return;
    hasShownSpiritRef.current = true;
    setShowSpiritDialogue(true);
    const durationMs = 7000;
    const t = setTimeout(() => setShowSpiritDialogue(false), durationMs);
    return () => clearTimeout(t);
  }, [gamificationConfig.autoShowSpiritDialogue]);

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
            pushReward({ message: "Mochi couldn't connect. Check Settings or try again later.", tone: 'slate', icon: '🔌', sound: null });
          }
          setSpiritThinking(false);
        })
        .catch(() => {
          setSpiritThinking(false);
          if (typeof pushReward === 'function') {
            pushReward({ message: "Mochi couldn't connect. Check Settings or try again later.", tone: 'slate', icon: '🔌', sound: null });
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
    setInterruptionMemory((prev) => recordInterruptionSnapshot(prev, {
      lastIntent: `Continue ${goal?.title ?? 'task'}`,
      lastTaskTitle: goal?.title ?? null,
      lastGoalId: goal?.id ?? null,
      lastSubtaskId: subtaskId ?? null,
      lastFocusState: 'starting',
      lastContextNote: null,
    }));
    setShowStartNowModal(false);
    setStartNowCandidate(null);
  }, [pushReward, runStartFocus]);

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

  const currentTaskStripKey = useMemo(() => {
    if (!currentTaskStrip) return null;
    return `${currentTaskStrip.context}::${currentTaskStrip.label}`;
  }, [currentTaskStrip]);

  const todayPathSummary = useMemo(() => {
    if (currentFocusItem?.title) {
      const thenTitles = nextUpItems
        .filter((item) => item.title && item.title !== currentFocusItem.title)
        .slice(0, 2)
        .map((item) => item.title);
      return {
        lead: `Now: ${currentFocusItem.title}`,
        follow: thenTitles.length > 0 ? `Then ${thenTitles.join(' • ')}` : 'Keep the next step small and visible.',
      };
    }
    if (nextUpItems.length > 0) {
      const [first, ...rest] = nextUpItems;
      return {
        lead: `Next: ${first.title}`,
        follow: rest.length > 0 ? `Then ${rest.slice(0, 2).map((item) => item.title).join(' • ')}` : 'Shape the rest only when you need it.',
      };
    }
    return {
      lead: 'No tasks lined up yet.',
      follow: 'Use Plan today to place one clear next step.',
    };
  }, [currentFocusItem, nextUpItems]);

  const todayEnergyStatus = useMemo(() => {
    if (needsMorningCheckIn) {
      return {
        label: 'Check in first',
        detail: 'Set your energy before you shape the rest of the day.',
      };
    }
    const spoons = typeof todaySpoonCount === 'number' ? todaySpoonCount : null;
    let label = 'Medium capacity today';
    if (spoons === 0) label = 'Recovery day';
    else if (spoons != null && spoons <= 2) label = 'Low capacity today';
    else if (spoons != null && spoons <= 4) label = 'Light capacity today';
    else if (spoons != null && spoons >= 8) label = 'High capacity today';

    const detailParts = [];
    if (typeof dailyEnergy === 'number' && Number.isFinite(dailyEnergy)) {
      detailParts.push(`Energy ${dailyEnergy}/10`);
    }
    if (spoons != null) {
      detailParts.push(`${spoons} spoon${spoons === 1 ? '' : 's'}`);
    }
    if (isOverloaded) {
      detailParts.push('The plan is asking for too much');
    } else if (typeof maxSlots === 'number') {
      detailParts.push(`Realistic load ${maxSlots}`);
    }
    if (weather === 'storm') {
      detailParts.push('Protect margin');
    }

    return {
      label,
      detail: detailParts.join(' | '),
    };
  }, [needsMorningCheckIn, todaySpoonCount, dailyEnergy, isOverloaded, maxSlots, weather]);

  const todayPrimaryTask = useMemo(() => {
    if (currentFocusItem?.source === 'calendar') {
      return {
        title: currentFocusItem.title,
        detail: 'A calendar block is already live now.',
        context: 'Current block',
        ctaLabel: 'See day map',
        onClick: () => document.getElementById('tour-timeline')?.scrollIntoView({ behavior: 'smooth' }),
      };
    }
    if (currentFocusItem?.goal) {
      return {
        title: currentFocusItem.title ?? currentFocusItem.goal?.title ?? 'First task',
        detail: currentFocusItem.hour ? `Planned for ${formatHourKey(currentFocusItem.hour)}` : 'Best first move right now.',
        context: currentFocusItem.hour ? 'Primary task' : 'Start here',
        ctaLabel: 'Start first task',
        onClick: () => handleStartNowStart(
          { goal: currentFocusItem.goal, goalId: currentFocusItem.goalId, subtaskId: currentFocusItem.subtaskId },
          5
        ),
        goalId: currentFocusItem.goalId,
        subtaskId: currentFocusItem.subtaskId,
        estimatedMinutes: currentFocusItem.goal?.estimatedMinutes ?? 30,
      };
    }
    if (recommendedToday?.goal && recommendedToday?.nextStep) {
      return {
        title: recommendedToday.nextStep.title ?? recommendedToday.goal.title ?? 'First task',
        detail: recommendedToday.reason ?? 'Best first move right now.',
        context: 'Recommended',
        ctaLabel: 'Start first task',
        onClick: () => runStartFocus({
          goal: recommendedToday.goal,
          minutes: recommendedToday.nextStep.suggestedMinutes ?? 15,
          subtaskId: recommendedToday.nextStep.subtaskId ?? null,
        }),
        goalId: recommendedToday.goal.id,
        subtaskId: recommendedToday.nextStep.subtaskId ?? null,
        estimatedMinutes: recommendedToday.nextStep.suggestedMinutes ?? recommendedToday.goal?.estimatedMinutes ?? 30,
      };
    }
    if (nextUpItems[0]?.goal) {
      return {
        title: nextUpItems[0].title ?? nextUpItems[0].goal?.title ?? 'First task',
        detail: nextUpItems[0].hour ? `Planned for ${formatHourKey(nextUpItems[0].hour)}` : 'Best first move right now.',
        context: 'Next up',
        ctaLabel: 'Start first task',
        onClick: () => handleStartNowStart(nextUpItems[0], 5),
        goalId: nextUpItems[0].goalId,
        subtaskId: nextUpItems[0].subtaskId ?? null,
        estimatedMinutes: nextUpItems[0].estimatedMinutes ?? 30,
      };
    }
    return null;
  }, [currentFocusItem, recommendedToday, nextUpItems, handleStartNowStart, runStartFocus]);

  const todayTimingGuidance = useMemo(() => {
    if (needsMorningCheckIn) return null;
    const primaryType = inferTaskTimingType(todayPrimaryTask ?? currentFocusItem ?? {});
    const primaryRecommendation = getRecommendationForTaskType(learnedEnergyProfile, primaryType);
    return {
      primaryLine: primaryRecommendation?.explanation ?? learnedFocusRecommendation?.explanation ?? null,
      avoidLine: learnedEnergyProfile?.weakWindow?.explanation ?? null,
      recoveryLine: (todaySpoonCount ?? 0) <= 3
        ? (learnedLowEnergyRecommendation?.explanation ?? learnedAdminRecommendation?.explanation ?? null)
        : null,
    };
  }, [
    needsMorningCheckIn,
    todayPrimaryTask,
    currentFocusItem,
    learnedEnergyProfile,
    learnedFocusRecommendation,
    learnedAdminRecommendation,
    learnedLowEnergyRecommendation,
    todaySpoonCount,
  ]);

  const taskStartPreferenceStyle = useMemo(() => {
    if (!todayPrimaryTask?.goalId) return taskStartPrefs?.globalStyle ?? 'tiny_step';
    return taskStartPrefs?.styleByGoalId?.[todayPrimaryTask.goalId] ?? taskStartPrefs?.globalStyle ?? 'tiny_step';
  }, [todayPrimaryTask?.goalId, taskStartPrefs]);

  const taskStartDismissedForGoal = useMemo(() => {
    if (!todayPrimaryTask?.goalId) return false;
    return Boolean(taskStartPrefs?.dismissedByGoalId?.[todayPrimaryTask.goalId]);
  }, [todayPrimaryTask?.goalId, taskStartPrefs]);

  const taskStartHelp = useMemo(() => {
    if (!todayPrimaryTask?.title) return null;
    const shouldShow = shouldShowTaskInitiationSupport({
      taskTitle: todayPrimaryTask.title,
      isLowEnergy: typeof dailyEnergy === 'number' && dailyEnergy <= 4,
      noNextStep: (needsAttention?.noNextStep?.length ?? 0) > 0,
      reopenCount: 0,
      postponeCount: Array.isArray(needsRescheduling) ? needsRescheduling.length : 0,
      dismissed: taskStartDismissedForGoal,
    });
    if (!shouldShow) return null;
    return buildTaskInitiationSupport({
      taskTitle: todayPrimaryTask.title,
      preferredStyle: taskStartPreferenceStyle,
    });
  }, [
    todayPrimaryTask?.title,
    dailyEnergy,
    needsAttention?.noNextStep,
    needsRescheduling,
    taskStartDismissedForGoal,
    taskStartPreferenceStyle,
  ]);

  const todayMustDoLane = useMemo(() => {
    const primary = todayPrimaryTask
      ? {
          ...todayPrimaryTask,
          laneLabel: 'Primary',
        }
      : null;
    const usedTitles = new Set(primary?.title ? [primary.title] : []);
    const support = [];

    const addSupportItem = (candidate, laneLabel = 'Support') => {
      const title = candidate?.title ?? candidate?.goal?.title ?? candidate?.ritualTitle ?? null;
      if (!title || usedTitles.has(title) || support.length >= 2) return;
      usedTitles.add(title);
      support.push({
        title,
        detail: candidate?.hour
          ? `Planned for ${formatHourKey(candidate.hour)}`
          : candidate?.detail ?? 'Keep this small and defined.',
        estimatedMinutes: candidate?.estimatedMinutes ?? candidate?.goal?.estimatedMinutes ?? 20,
        laneLabel,
      });
    };

    nextUpItems.forEach((item) => addSupportItem(item));
    todayRitualItems.forEach(({ goal, ritualTitle }) => addSupportItem({ goal, title: ritualTitle || goal?.title, detail: 'Keep this light.' }, 'Support'));

    const quickWinCandidate = [
      ...todayRitualItems.map(({ goal, ritualTitle }) => ({
        goal,
        goalId: goal?.id,
        subtaskId: null,
        title: ritualTitle || goal?.title,
        estimatedMinutes: goal?.estimatedMinutes ?? 15,
      })),
      ...goalBank.map((goal) => ({
        goal,
        goalId: goal?.id,
        subtaskId: null,
        title: goal?.title,
        estimatedMinutes: goal?.estimatedMinutes ?? 15,
      })),
    ].find((item) => item.title && !usedTitles.has(item.title) && (item.estimatedMinutes ?? 15) <= 20);

    const quickWin = quickWinCandidate
      ? {
          ...quickWinCandidate,
          laneLabel: 'Quick win',
          detail: 'Use this if you need an easy reset or a fast win.',
          onClick: () => handleStartNowStart(quickWinCandidate, 5),
        }
      : null;

    return {
      primary,
      support: support.slice(0, 2),
      quickWin,
    };
  }, [todayPrimaryTask, nextUpItems, todayRitualItems, goalBank, handleStartNowStart]);

  const todayMapBlocks = useMemo(() => {
    const personalCandidate = todayRitualItems.find(({ ritualTitle, goal }) => {
      const title = ritualTitle || goal?.title;
      return title && title !== todayMustDoLane.primary?.title;
    });

    const blocks = [
      {
        label: 'Focus block',
        detail: todayMustDoLane.primary?.title ?? 'One defined task before you widen the day.',
      },
      {
        label: 'Admin block',
        detail: todayMustDoLane.support[0]?.title ?? todayMustDoLane.quickWin?.title ?? 'Keep small tasks contained in one short block.',
      },
      {
        label: 'Reset block',
        detail:
          isOverloaded || (todaySpoonCount ?? 0) <= 2 || weather === 'storm'
            ? 'Protect recovery time and leave slack between blocks.'
            : 'Keep one short reset block open so the day stays usable.',
      },
    ];

    if (personalCandidate) {
      blocks.push({
        label: 'Personal block',
        detail: personalCandidate.ritualTitle || personalCandidate.goal?.title,
      });
    }

    return blocks;
  }, [todayMustDoLane, todayRitualItems, isOverloaded, todaySpoonCount, weather]);

  const handleOpenStartAssist = useCallback(() => {
    const candidate = pickStarterTask({ todayTasks: todayTaskEntries, learnedEnergyProfile, now });
    if (candidate) {
      setStartNowCandidate(candidate?.goal != null ? candidate : { goal: candidate });
    } else {
      setStartNowCandidate(null);
    }
    setShowStartNowModal(true);
  }, [todayTaskEntries, learnedEnergyProfile, now]);

  const todayRecoveryItems = useMemo(() => {
    const items = [];

    if (isOverloaded) {
      items.push({
        key: 'overloaded',
        title: 'Today is overloaded',
        body: 'Reduce the plan before you add anything else.',
        actionLabel: plannerActionBusy === 'day' ? 'Lightening...' : 'Lighten today',
        onClick: handleLightenTodayPlan,
        tone: 'amber',
      });
    }

    if (!needsMorningCheckIn && !todayPrimaryTask && nextUpItems.length === 0) {
      items.push({
        key: 'no-next-step',
        title: 'No clear next step',
        body: 'Pick one realistic first move before you try to do more.',
        actionLabel: 'Plan today',
        onClick: handleOpenDailyPlanRitual,
        tone: 'stone',
      });
    }

    if ((needsAttention?.noNextStep?.length ?? 0) > 0) {
      items.push({
        key: 'project-next-step',
        title: 'Some projects still need a next step',
        body: `${needsAttention.noNextStep.length} item${needsAttention.noNextStep.length === 1 ? '' : 's'} in Plan still need to be clarified.`,
        actionLabel: 'Open Plan',
        onClick: () => setActiveTab('planner'),
        tone: 'stone',
      });
    }

    if (!activeSession && continuitySummary.todaySessions === 0 && now.getHours() >= 11 && (todayPrimaryTask || nextUpItems.length > 0)) {
      items.push({
        key: 'delayed-start',
        title: 'Start smaller than you think',
        body: 'You do not need to catch up. A five minute start counts.',
        actionLabel: todayPrimaryTask?.ctaLabel ?? 'Help me start',
        onClick: todayPrimaryTask?.onClick ?? handleOpenStartAssist,
        tone: 'stone',
      });
    }

    if ((compost?.length ?? 0) >= 6) {
      items.push({
        key: 'uncategorized',
        title: 'Loose capture is piling up',
        body: `${compost.length} captured item${compost.length === 1 ? '' : 's'} still need sorting.`,
        actionLabel: 'Review inbox',
        onClick: () => openModal('compost'),
        tone: 'stone',
      });
    }

    if (currentHelperIntervention?.type === HELPER_INTERVENTION_TYPES.FOCUS_ABANDONED) {
      items.push({
        key: 'focus-abandoned',
        title: 'Momentum dropped',
        body: 'Restart with a smaller block instead of trying to make up lost time.',
        actionLabel: 'Help me start',
        onClick: handleOpenStartAssist,
        tone: 'stone',
      });
    }

    return items.slice(0, 3);
  }, [
    isOverloaded,
    plannerActionBusy,
    handleLightenTodayPlan,
    needsMorningCheckIn,
    todayPrimaryTask,
    nextUpItems,
    handleOpenDailyPlanRitual,
    needsAttention,
    activeSession,
    continuitySummary.todaySessions,
    now,
    handleOpenStartAssist,
    compost,
    openModal,
    currentHelperIntervention,
  ]);

  const todayHero = useMemo(() => {
    const tasksVisible = [
      todayMustDoLane.primary?.title,
      ...todayMustDoLane.support.map((item) => item.title),
    ].filter(Boolean).length;

    const loadLabel = needsMorningCheckIn
      ? 'Check in first'
      : isOverloaded
        ? 'Load needs relief'
        : (todaySpoonCount ?? 0) <= 2
          ? 'Gentle pace'
          : 'Load fits today';

    let recommendation = todayPrimaryTask?.title
      ? `Start with ${todayPrimaryTask.title}.`
      : 'Nothing is placed yet. Start with one task that would make today feel steadier.';
    let reasonLine = todayTimingGuidance?.primaryLine ?? 'One clear task makes the day easier to hold.';
    let primaryAction = todayPrimaryTask
      ? { label: todayPrimaryTask.ctaLabel ?? 'Start first task', onClick: todayPrimaryTask.onClick, disabled: false }
      : { label: 'Plan today', onClick: handleOpenDailyPlanRitual, disabled: false };

    if (needsMorningCheckIn) {
      recommendation = 'Set energy first, then choose the first small step.';
      reasonLine = 'Set energy first. Then choose one small task.';
      primaryAction = { label: "Set today's energy", onClick: () => setShowMorningCheckInModal(true), disabled: false };
    } else if (isOverloaded) {
      recommendation = todayPrimaryTask?.title
        ? `Keep ${todayPrimaryTask.title} as the anchor. Move the rest if needed.`
        : 'Too much is placed for today. Keep one anchor task and move the rest.';
      reasonLine = 'A lighter plan can still move the day forward.';
      primaryAction = { label: plannerActionBusy === 'day' ? 'Lightening...' : 'Lighten today', onClick: handleLightenTodayPlan, disabled: plannerActionBusy === 'day' };
    }

    return {
      statusLabel: todayEnergyStatus.label,
      statusDetail: todayEnergyStatus.detail,
      loadLabel,
      recommendation,
      reasonLine,
      primaryAction,
      secondaryAction: {
        label: showTodaySupportSheet ? 'Close review' : 'Review day',
        onClick: () => setShowTodaySupportSheet((prev) => !prev),
        disabled: false,
      },
      reviewSections: [
        todayTimingGuidance?.primaryLine ? { key: 'why', title: 'Why this', body: todayTimingGuidance.primaryLine } : null,
        {
          key: 'tight',
          title: 'If today feels tight',
          body: needsMorningCheckIn
            ? 'Set energy first, then choose one small task.'
            : isOverloaded
              ? 'Keep one anchor task and move or defer the rest.'
              : tasksVisible > 0
                ? `Keep it to ${tasksVisible} clear task${tasksVisible === 1 ? '' : 's'} and let the rest wait.`
                : 'Choose one task first and let the rest wait.',
        },
        todayTimingGuidance?.recoveryLine ? { key: 'lower-energy', title: 'Lower-energy option', body: todayTimingGuidance.recoveryLine } : null,
        todayTimingGuidance?.avoidLine ? { key: 'timing', title: 'Timing note', body: todayTimingGuidance.avoidLine } : null,
      ].filter(Boolean),
      supportActions: [
        {
          label: plannerActionBusy === 'day' ? 'Lightening...' : 'Lighten today',
          onClick: handleLightenTodayPlan,
          disabled: plannerActionBusy === 'day',
        },
        {
          label: plannerActionBusy === 'day' ? 'Rebuilding...' : 'Rebuild today with AI',
          onClick: handleSuggestTodayPlan,
          disabled: plannerActionBusy === 'day',
        },
      ],
    };
  }, [
    todayMustDoLane,
    needsMorningCheckIn,
    todayPrimaryTask,
    handleOpenDailyPlanRitual,
    isOverloaded,
    plannerActionBusy,
    handleLightenTodayPlan,
    todaySpoonCount,
    todayEnergyStatus,
    handleSuggestTodayPlan,
    todayTimingGuidance,
    showTodaySupportSheet,
  ]);

  const todayHeroMetaChips = useMemo(() => {
    if (needsMorningCheckIn) return ['Check in first'];

    const chips = [];
    if (typeof todaySpoonCount === 'number') {
      chips.push(`${todaySpoonCount} spoon${todaySpoonCount === 1 ? '' : 's'}`);
    }

    const slotKey = getCurrentSlotKey(now);
    if (weather === 'storm') {
      chips.push('Protect margin');
    } else if (slotKey) {
      const assignment = getAssignmentsForHour(assignments, slotKey)[0] ?? null;
      const goalId = assignment == null ? null : typeof assignment === 'string' ? assignment : assignment?.goalId ?? assignment?.parentGoalId;
      chips.push(goalId ? `${slotKey} scheduled` : `${slotKey} free`);
    }

    if (todayHero.loadLabel) {
      chips.push(todayHero.loadLabel);
    }

    return chips
      .filter((value, index, array) => value && array.indexOf(value) === index)
      .slice(0, 3);
  }, [needsMorningCheckIn, todaySpoonCount, now, weather, assignments, todayHero.loadLabel]);

  const todayProgressFooter = useMemo(() => {
    const progressLine =
      continuitySummary.todaySessions === 0
        ? 'No focus logged yet today.'
        : `${continuitySummary.todaySessions} focus block${continuitySummary.todaySessions === 1 ? '' : 's'} completed, ${continuitySummary.todayMinutes} minutes logged.`;

    let supportLine = 'One finished task is enough to make today useful.';
    if (needsMorningCheckIn) {
      supportLine = 'Check in, choose one task, and let the rest wait.';
    } else if (continuitySummary.todaySessions > 0) {
      supportLine = 'You already have momentum. Protect it by keeping the next step small.';
    } else if (isOverloaded) {
      supportLine = 'A lighter plan is still a productive plan.';
    } else if (todayPrimaryTask?.title) {
      supportLine = `If you finish ${todayPrimaryTask.title}, today is on track.`;
    }

    return {
      progressLine,
      supportLine,
      gardenLine: lastGardenImpact?.text ? `Garden update: ${lastGardenImpact.text}` : null,
    };
  }, [continuitySummary, needsMorningCheckIn, isOverloaded, todayPrimaryTask, lastGardenImpact]);

  const todayChiefStart = useMemo(() => {
    return {
      metaChips: todayHeroMetaChips,
      recommendation: todayHero.recommendation,
      reasonLine: todayHero.reasonLine,
      dominantAction: todayHero.primaryAction,
      supportingAction: todayHero.secondaryAction,
    };
  }, [
    todayHero,
    todayHeroMetaChips,
  ]);

  const handleAssistantProtectFocusBlock = useCallback(async () => {
    if (!today || typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return false;
    setAssistantActionBusy('PROTECT_FOCUS_BLOCK');
    try {
      const focusGoal = (todayPrimaryTask?.goalId && (goals ?? []).find((goal) => goal.id === todayPrimaryTask.goalId))
        || (weeklyNorthStarId && (goals ?? []).find((goal) => goal.id === weeklyNorthStarId))
        || (goals ?? []).find((goal) => goal?.id && goal.type !== 'routine')
        || null;
      if (!focusGoal) {
        pushReward?.({ message: 'Add a goal first so I can protect a focus block.', tone: 'slate', icon: '!', sound: null });
        return true;
      }
      const day = (await loadDayPlan(today)) ?? {};
      const result = protectFocusBlockCommand({
        dayPlan: day,
        goal: focusGoal,
        preferredStartHour: learnedEnergyProfile?.focusWindow?.startHour ?? Math.max(hourFromTimeStr(userSettings?.dayStart, 8), 9),
        preferredEndHour: learnedEnergyProfile?.focusWindow?.endHour ?? 12,
        dayEndHour: hourFromTimeStr(userSettings?.dayEnd, 22),
      });
      if (!result.changed) {
        pushReward?.({ message: 'No free focus slot is available today.', tone: 'slate', icon: '!', sound: null });
        return true;
      }
      offerPlannerUndo('Protected focus block', [{ dateStr: today, previous: day }]);
      await saveDayPlanForDate(today, result.nextPlan);
      const why = learnedEnergyProfile?.focusWindow?.explanation;
      pushReward?.({ message: why ? `Protected focus at ${result.slotKey}. ${why}` : `Protected focus at ${result.slotKey}.`, tone: 'moss', icon: 'S', durationMs: 2600 });
      return true;
    } catch (error) {
      console.warn('Assistant protect focus failed', error);
      pushReward?.({ message: 'Could not protect focus time. Try again.', tone: 'slate', icon: '!', sound: null });
      return true;
    } finally {
      setAssistantActionBusy(null);
    }
  }, [today, loadDayPlan, saveDayPlanForDate, todayPrimaryTask, goals, weeklyNorthStarId, userSettings?.dayStart, userSettings?.dayEnd, offerPlannerUndo, pushReward, learnedEnergyProfile]);

  const handleAssistantMoveLowEnergyLater = useCallback(async () => {
    if (!today || typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return false;
    setAssistantActionBusy('MOVE_LOW_ENERGY_LATER');
    try {
      const day = (await loadDayPlan(today)) ?? {};
      const result = moveLowEnergyTasksLaterCommand({
        dayPlan: day,
        goals: goals ?? [],
        lateStartHour: 14,
        dayEndHour: hourFromTimeStr(userSettings?.dayEnd, 22),
      });
      if (!result.changed) {
        pushReward?.({ message: 'Nothing low-energy needs moving right now.', tone: 'slate', icon: '!', sound: null });
        return true;
      }
      offerPlannerUndo('Moved low-energy task later', [{ dateStr: today, previous: day }]);
      await saveDayPlanForDate(today, result.nextPlan);
      pushReward?.({ message: `${result.movedTitle} moved to ${result.destination}.`, tone: 'moss', icon: 'S', durationMs: 2200 });
      return true;
    } catch (error) {
      console.warn('Assistant move low-energy later failed', error);
      pushReward?.({ message: 'Could not move that task. Try again.', tone: 'slate', icon: '!', sound: null });
      return true;
    } finally {
      setAssistantActionBusy(null);
    }
  }, [today, loadDayPlan, saveDayPlanForDate, goals, userSettings?.dayEnd, offerPlannerUndo, pushReward]);

  const handleAssistantPullForward = useCallback(async (payload = {}) => {
    if (!today || typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return false;
    setAssistantActionBusy('PULL_FORWARD_TASK');
    try {
      const day = (await loadDayPlan(today)) ?? {};
      const result = pullTaskForwardCommand({
        dayPlan: day,
        goalId: payload?.goalId ?? todayPrimaryTask?.goalId ?? null,
        targetStartHour: Math.max(hourFromTimeStr(userSettings?.dayStart, 8), 8),
        targetEndHour: 12,
      });
      if (!result.changed) {
        pushReward?.({ message: 'Nothing useful can be pulled forward right now.', tone: 'slate', icon: '!', sound: null });
        return true;
      }
      offerPlannerUndo('Pulled one task forward', [{ dateStr: today, previous: day }]);
      await saveDayPlanForDate(today, result.nextPlan);
      pushReward?.({ message: `${result.movedTitle} moved to ${result.slotKey}.`, tone: 'moss', icon: 'S', durationMs: 2200 });
      return true;
    } catch (error) {
      console.warn('Assistant pull forward failed', error);
      pushReward?.({ message: 'Could not pull a task forward. Try again.', tone: 'slate', icon: '!', sound: null });
      return true;
    } finally {
      setAssistantActionBusy(null);
    }
  }, [today, loadDayPlan, saveDayPlanForDate, todayPrimaryTask, userSettings?.dayStart, offerPlannerUndo, pushReward]);

  const handleAssistantMinimumViableDay = useCallback(async (payload = {}) => {
    if (!today || typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return false;
    setAssistantActionBusy('MINIMUM_VIABLE_DAY');
    try {
      const day = (await loadDayPlan(today)) ?? {};
      const result = minimumViableDayCommand({
        dayPlan: day,
        keepGoalId: payload?.goalId ?? todayPrimaryTask?.goalId ?? null,
        keepCount: 2,
      });
      if (!result.changed) {
        pushReward?.({ message: 'Today is already quite small.', tone: 'moss', icon: 'OK', durationMs: 2200 });
        return true;
      }
      offerPlannerUndo('Minimum viable day', [{ dateStr: today, previous: day }]);
      await saveDayPlanForDate(today, result.nextPlan);
      pushReward?.({
        message: `Minimum viable day ready. Moved ${result.removedItems.length} item${result.removedItems.length === 1 ? '' : 's'} out of the main path.`,
        tone: 'moss',
        icon: 'S',
        durationMs: 2400,
      });
      return true;
    } catch (error) {
      console.warn('Assistant minimum viable day failed', error);
      pushReward?.({ message: 'Could not reduce today right now.', tone: 'slate', icon: '!', sound: null });
      return true;
    } finally {
      setAssistantActionBusy(null);
    }
  }, [today, loadDayPlan, saveDayPlanForDate, todayPrimaryTask, offerPlannerUndo, pushReward]);

  const handleAssistantRebalanceWeek = useCallback(async () => {
    if (typeof loadDayPlan !== 'function' || typeof saveDayPlanForDate !== 'function') return false;
    setAssistantActionBusy('REBALANCE_WEEK');
    try {
      const weekStart = getDefaultWeekStart();
      const previousPlans = await Promise.all(
        plannerWeekDates.map(async (dateStr) => ({ dateStr, previous: (await loadDayPlan(dateStr)) ?? {} }))
      );
      const filled = autoFillWeek(goals ?? [], Array.isArray(weeklyEvents) ? weeklyEvents : [], weekStart);
      if (!filled || Object.keys(filled).length === 0) {
        pushReward?.({ message: 'Could not rebalance this week yet.', tone: 'slate', icon: '!', sound: null });
        return true;
      }
      offerPlannerUndo('Rebalanced week', previousPlans);
      await Promise.all(Object.entries(filled).map(([dateStr, dayAssigns]) => saveDayPlanForDate(dateStr, dayAssigns)));
      pushReward?.({ message: 'Rebalanced this week around your current work.', tone: 'moss', icon: 'S', durationMs: 2400 });
      return true;
    } catch (error) {
      console.warn('Assistant rebalance week failed', error);
      pushReward?.({ message: 'Could not rebalance the week. Try again.', tone: 'slate', icon: '!', sound: null });
      return true;
    } finally {
      setAssistantActionBusy(null);
    }
  }, [loadDayPlan, saveDayPlanForDate, plannerWeekDates, goals, weeklyEvents, offerPlannerUndo, pushReward]);

  const handleAssistantBreakIntoSteps = useCallback(async (payload = {}) => {
    setAssistantActionBusy('BREAK_NEXT_3_STEPS');
    try {
      const targetGoalId = payload?.goalId
        ?? todayPrimaryTask?.goalId
        ?? needsAttention?.noNextStep?.[0]?.goal?.id
        ?? null;
      const targetGoal = targetGoalId ? (goals ?? []).find((goal) => goal.id === targetGoalId) : null;
      const title = targetGoal?.title ?? payload?.title ?? null;
      if (!title) {
        pushReward?.({ message: 'Pick a goal first so I can break it into steps.', tone: 'slate', icon: '!', sound: null });
        return true;
      }
      const existing = (targetGoal?.subtasks ?? []).map((subtask) => subtask.title).filter(Boolean);
      const steps = await generateNextThreeSteps(title, existing);
      if (!Array.isArray(steps) || steps.length === 0) {
        pushReward?.({ message: 'I could not generate next steps right now.', tone: 'slate', icon: '!', sound: null });
        return true;
      }
      if (targetGoal?.id) {
        const existingTitles = new Set(existing.map((step) => step.trim().toLowerCase()));
        steps.forEach((step) => {
          if (!existingTitles.has(step.trim().toLowerCase())) {
            addSubtask(targetGoal.id, { title: step, estimatedHours: 0.25 });
          }
        });
        pushReward?.({ message: `Added the next steps to ${targetGoal.title}.`, tone: 'moss', icon: 'S', durationMs: 2200 });
      } else {
        addGoal(buildGoalFromDraftPlan({ title, steps, estimatedMinutes: 45 }));
        pushReward?.({ message: 'Turned that into a 3-step draft plan.', tone: 'moss', icon: 'S', durationMs: 2200 });
      }
      return true;
    } catch (error) {
      console.warn('Assistant break into steps failed', error);
      pushReward?.({ message: 'Could not break that into steps. Try again.', tone: 'slate', icon: '!', sound: null });
      return true;
    } finally {
      setAssistantActionBusy(null);
    }
  }, [todayPrimaryTask, needsAttention, goals, generateNextThreeSteps, addSubtask, addGoal, pushReward]);

  const handleAssistantNoteToPlan = useCallback(async (payload = {}) => {
    setAssistantActionBusy('NOTE_TO_PLAN');
    try {
      const noteText = payload?.title ?? compost?.[0]?.text ?? '';
      if (!noteText) {
        pushReward?.({ message: 'Capture something first so I can turn it into a plan.', tone: 'slate', icon: '!', sound: null });
        return true;
      }
      const draft = await draftPlanFromNote(noteText);
      if (!draft?.title) {
        pushReward?.({ message: 'Could not turn that note into a plan yet.', tone: 'slate', icon: '!', sound: null });
        return true;
      }
      const projectPlan = {
        title: draft.title,
        summary: `Drafted from note: ${noteText.slice(0, 120)}`,
        phases: [
          {
            title: 'Phase 1',
            weekRange: 'Week 1',
            tasks: (Array.isArray(draft.steps) ? draft.steps : []).map((step) => ({
              title: step,
              type: 'task',
              estimatedHours: 0.5,
            })),
            milestone: 'Initial decomposition complete',
          },
        ],
      };
      setProjectPlannerPrefill({ prefillTitle: draft.title, prefillParentGoalId: '' });
      setProjectPlannerImportedPlan({ plan: projectPlan, description: noteText, deadline: '' });
      setProjectPlannerFocusGoalId(null);
      setShowProjectPlanner(true);
      pushReward?.({ message: `Drafted "${draft.title}" in Project Planner.`, tone: 'moss', icon: 'S', durationMs: 2400 });
      return true;
    } catch (error) {
      console.warn('Assistant note to plan failed', error);
      pushReward?.({ message: 'Could not build a plan from that note. Try again.', tone: 'slate', icon: '!', sound: null });
      return true;
    } finally {
      setAssistantActionBusy(null);
    }
  }, [compost, pushReward]);

  const handleAssistantMakeExecutable = useCallback(async (payload = {}) => {
    setAssistantActionBusy('MAKE_EXECUTABLE');
    try {
      const sourceTitle = payload?.title ?? todayPrimaryTask?.title ?? compost?.[0]?.text ?? '';
      if (!sourceTitle) {
        pushReward?.({ message: 'Give me a task title first so I can sharpen it.', tone: 'slate', icon: '!', sound: null });
        return true;
      }
      const executableTitle = await rewriteTaskAsExecutable(sourceTitle);
      if (!executableTitle) {
        pushReward?.({ message: 'Could not turn that into a clearer action yet.', tone: 'slate', icon: '!', sound: null });
        return true;
      }
      const targetGoalId = payload?.goalId ?? todayPrimaryTask?.goalId ?? null;
      if (targetGoalId) {
        addSubtask(targetGoalId, { title: executableTitle, estimatedHours: 0.25 });
      } else {
        addGoal(buildGoalFromDraftPlan({ title: executableTitle, steps: [executableTitle], estimatedMinutes: 15, type: 'routine' }));
      }
      pushReward?.({ message: `Saved "${executableTitle}" as a concrete next step.`, tone: 'moss', icon: 'S', durationMs: 2200 });
      return true;
    } catch (error) {
      console.warn('Assistant make executable failed', error);
      pushReward?.({ message: 'Could not sharpen that task right now.', tone: 'slate', icon: '!', sound: null });
      return true;
    } finally {
      setAssistantActionBusy(null);
    }
  }, [todayPrimaryTask, compost, addSubtask, addGoal, pushReward]);

  const handleAssistantOperatorAction = useCallback(async (actionId, payload = {}) => {
    switch (actionId) {
      case 'LIGHTEN_TODAY':
        setAssistantActionBusy('LIGHTEN_TODAY');
        try {
          await handleLightenTodayPlan();
          return true;
        } finally {
          setAssistantActionBusy(null);
        }
      case 'PROTECT_FOCUS_BLOCK':
        return handleAssistantProtectFocusBlock();
      case 'REBALANCE_WEEK':
        return handleAssistantRebalanceWeek();
      case 'MOVE_LOW_ENERGY_LATER':
        return handleAssistantMoveLowEnergyLater();
      case 'PULL_FORWARD_TASK':
        return handleAssistantPullForward(payload);
      case 'BREAK_NEXT_3_STEPS':
        return handleAssistantBreakIntoSteps(payload);
      case 'NOTE_TO_PLAN':
        return handleAssistantNoteToPlan(payload);
      case 'ADD_MAINTENANCE_BLOCK': {
        const templateId = payload?.templateId;
        const template = MAINTENANCE_BLOCK_TEMPLATES.find((item) => item.id === templateId) ?? null;
        if (!template || typeof addMaintenanceBlock !== 'function') return false;
        addMaintenanceBlock({ templateId: template.id, ...template });
        pushReward?.({
          message: `${template.title} added as recurring support.`,
          tone: 'moss',
          icon: '🧩',
          durationMs: 2200,
        });
        return true;
      }
      case 'ADD_SOCIAL_CATCHUP_BLOCK': {
        const template = MAINTENANCE_BLOCK_TEMPLATES.find((item) => item.id === 'social_catchup');
        if (!template || typeof addMaintenanceBlock !== 'function') return false;
        addMaintenanceBlock({ templateId: template.id, ...template });
        pushReward?.({
          message: 'Social catch-up block added.',
          tone: 'moss',
          icon: '💬',
          durationMs: 2200,
        });
        return true;
      }
      case 'ENTER_LOW_FRICTION_MODE':
        setLowFrictionModeEnabled(true);
        setLowFrictionStayDate(today ?? null);
        setLowFrictionDismissedDate(null);
        pushReward?.({ message: 'Low-friction mode is on for today.', tone: 'moss', icon: '✓', durationMs: 2000 });
        return true;
      case 'ADD_ROUTINE_STRUCTURE': {
        const suggestion = payload?.suggestion;
        if (!suggestion?.actionPayload) return false;
        const actionPayload = suggestion.actionPayload;
        if (actionPayload.type === 'maintenance_template') {
          const template = MAINTENANCE_BLOCK_TEMPLATES.find((item) => item.id === actionPayload.templateId);
          if (!template || typeof addMaintenanceBlock !== 'function') return false;
          addMaintenanceBlock({ templateId: template.id, ...template });
          pushReward?.({ message: `${template.title} added.`, tone: 'moss', icon: '🧩', durationMs: 2200 });
          return true;
        }
        if (actionPayload.type === 'custom_block' && actionPayload.block && typeof addMaintenanceBlock === 'function') {
          addMaintenanceBlock(actionPayload.block);
          pushReward?.({ message: 'Support block added.', tone: 'moss', icon: '🧩', durationMs: 2200 });
          return true;
        }
        if (actionPayload.type === 'soften_routine' && actionPayload.routineId && typeof softenRoutineIntensity === 'function') {
          softenRoutineIntensity(actionPayload.routineId);
          pushReward?.({ message: 'Routine softened for now.', tone: 'moss', icon: '🍃', durationMs: 2200 });
          return true;
        }
        if (actionPayload.type === 'pause_routine' && actionPayload.routineId && typeof pauseRoutineTemporarily === 'function') {
          pauseRoutineTemporarily(actionPayload.routineId, actionPayload.days ?? 7);
          pushReward?.({ message: 'Routine paused for a week.', tone: 'moss', icon: '⏸', durationMs: 2200 });
          return true;
        }
        return false;
      }
      case 'MAKE_EXECUTABLE':
        return handleAssistantMakeExecutable(payload);
      case 'MINIMUM_VIABLE_DAY':
        return handleAssistantMinimumViableDay(payload);
      case 'START_FOCUS_5':
        if (todayPrimaryTask?.goalId) {
          handleStartNowStart({ goal: (goals ?? []).find((goal) => goal.id === todayPrimaryTask.goalId), goalId: todayPrimaryTask.goalId, subtaskId: todayPrimaryTask.subtaskId }, 5);
          return true;
        }
        handleHelpMeStart();
        return true;
      case 'WAITING_REVIEW':
        document.getElementById('today-waiting-open-loops')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      case 'REVIEW_LIFE_DOMAINS':
        document.getElementById('planner-life-domains')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      case 'DEFEND_PROTECTED_TIME':
        document.getElementById('planner-protected-time')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pushReward?.({
          message: 'Keeping protected time. Move work/admin before replacing recovery.',
          tone: 'moss',
          icon: '🛡',
          durationMs: 2200,
        });
        return true;
      default:
        return false;
    }
  }, [
    handleLightenTodayPlan,
    handleAssistantProtectFocusBlock,
    handleAssistantRebalanceWeek,
    handleAssistantMoveLowEnergyLater,
    handleAssistantPullForward,
    handleAssistantBreakIntoSteps,
    handleAssistantNoteToPlan,
    addMaintenanceBlock,
    softenRoutineIntensity,
    pauseRoutineTemporarily,
    today,
    setLowFrictionModeEnabled,
    setLowFrictionStayDate,
    setLowFrictionDismissedDate,
    pushReward,
    handleAssistantMakeExecutable,
    handleAssistantMinimumViableDay,
    todayPrimaryTask,
    handleStartNowStart,
    goals,
    handleHelpMeStart,
  ]);

  const handleRestartResumeAction = useCallback(async (action) => {
    if (action === 'resume_gently') {
      handleHelpMeStart();
      return;
    }
    if (action === 'shrink_plan') {
      await handleAssistantMinimumViableDay({ goalId: todayPrimaryTask?.goalId ?? null });
      return;
    }
    if (action === 'start_focus_5') {
      if (todayPrimaryTask?.goalId) {
        handleStartNowStart(
          { goal: (goals ?? []).find((goal) => goal.id === todayPrimaryTask.goalId), goalId: todayPrimaryTask.goalId, subtaskId: todayPrimaryTask.subtaskId },
          5
        );
      } else {
        handleHelpMeStart();
      }
      return;
    }
    if (action === 'move_rest') {
      await handleLightenTodayPlan();
    }
  }, [
    handleHelpMeStart,
    handleAssistantMinimumViableDay,
    todayPrimaryTask,
    handleStartNowStart,
    goals,
    handleLightenTodayPlan,
  ]);

  const applyTaskStartSuggestion = useCallback((text) => {
    const suggestionText = String(text ?? '').trim();
    if (!suggestionText) return;
    if (todayPrimaryTask?.goalId) {
      addSubtask(todayPrimaryTask.goalId, { title: suggestionText, estimatedHours: 0.1 });
    } else {
      addGoal(buildGoalFromDraftPlan({ title: suggestionText, steps: [suggestionText], estimatedMinutes: 10, type: 'routine' }));
    }
    pushReward?.({ message: 'Starter step saved.', tone: 'moss', icon: '✓', durationMs: 1800 });
  }, [todayPrimaryTask?.goalId, addSubtask, addGoal, pushReward]);

  const setTaskStartStyle = useCallback((style) => {
    const nextStyle = ['tiny_step', 'script', 'prepare', 'timer_start', 'low_energy', 'body_double'].includes(style) ? style : 'tiny_step';
    setTaskStartPrefs((prev) => ({
      ...(prev ?? {}),
      globalStyle: nextStyle,
      styleByGoalId: {
        ...((prev ?? {}).styleByGoalId ?? {}),
        ...(todayPrimaryTask?.goalId ? { [todayPrimaryTask.goalId]: nextStyle } : {}),
      },
    }));
  }, [todayPrimaryTask?.goalId]);

  const dismissTaskStartHelp = useCallback((dontShowForGoal = false) => {
    setTaskStartPanelOpen(false);
    setShowFocusScaffold(false);
    if (!dontShowForGoal || !todayPrimaryTask?.goalId) return;
    setTaskStartPrefs((prev) => ({
      ...(prev ?? {}),
      dismissedByGoalId: {
        ...((prev ?? {}).dismissedByGoalId ?? {}),
        [todayPrimaryTask.goalId]: true,
      },
    }));
  }, [todayPrimaryTask?.goalId]);

  const markTaskStartFeedback = useCallback((helpful) => {
    setTaskStartPrefs((prev) => ({
      ...(prev ?? {}),
      feedback: [
        ...(((prev ?? {}).feedback ?? []).slice(-40)),
        {
          goalId: todayPrimaryTask?.goalId ?? null,
          helpful: Boolean(helpful),
          at: new Date().toISOString(),
        },
      ],
    }));
    pushReward?.({
      message: helpful ? 'Thanks, I will use this style more.' : 'Got it. I will keep this quieter.',
      tone: 'moss',
      icon: '✓',
      durationMs: 1600,
    });
  }, [todayPrimaryTask?.goalId, pushReward]);

  const parkPrimaryTaskAsWaiting = useCallback(() => {
    if (!todayPrimaryTask?.goalId || typeof setGoalWaitingSupport !== 'function') return;
    const holdUntil = new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
    setGoalWaitingSupport(todayPrimaryTask.goalId, {
      waitingType: WAITING_TYPES.PERSON,
      waitingOn: 'reply or decision',
      holdUntil,
      followUpDate: holdUntil,
      note: 'Parked from Today assistant surface.',
    });
    pushReward?.({ message: 'Parked safely. I will resurface it later.', tone: 'moss', icon: '🕊', durationMs: 2200 });
  }, [todayPrimaryTask?.goalId, setGoalWaitingSupport, pushReward]);

  const nudgeWaitingLater = useCallback((item, days = 2) => {
    if (!item?.itemId || typeof setGoalWaitingSupport !== 'function') return;
    const nextDate = new Date(Date.now() + (Math.max(1, days) * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
    setGoalWaitingSupport(item.itemId, {
      waitingType: item.waitingType,
      waitingOn: item.waitingOn,
      holdUntil: nextDate,
      followUpDate: nextDate,
      note: item.note,
    });
  }, [setGoalWaitingSupport]);

  const handleOpenFocusScaffold = useCallback(() => {
    if (!taskStartHelp) return;
    setTaskStartPanelOpen(true);
    setShowFocusScaffold(true);
  }, [taskStartHelp]);

  const handleStartFromScaffold = useCallback((minutes = 3) => {
    if (todayPrimaryTask?.goalId) {
      handleStartNowStart(
        { goal: (goals ?? []).find((goal) => goal.id === todayPrimaryTask.goalId), goalId: todayPrimaryTask.goalId, subtaskId: todayPrimaryTask.subtaskId },
        minutes
      );
    } else {
      handleHelpMeStart();
    }
    setShowFocusScaffold(false);
  }, [todayPrimaryTask, goals, handleStartNowStart, handleHelpMeStart]);

  const todayAssistantSignals = useMemo(() => getAssistantOperatorSignals({
    dayPlan: assignments ?? {},
    goals: goals ?? [],
    logs: logs ?? [],
    weekAssignments: weekAssignments ?? {},
    userSettings,
    dailyEnergy: dailyEnergy,
    compostCount: compost?.length ?? 0,
    calendarEvents: Array.isArray(events) ? events : [],
    learnedEnergyProfile,
  }), [assignments, goals, logs, weekAssignments, userSettings, dailyEnergy, compost, events, learnedEnergyProfile]);

  const maintenanceTemplateSuggestions = useMemo(
    () => suggestMaintenanceTemplates({ compost, logs, maintenanceBlocks }),
    [compost, logs, maintenanceBlocks]
  );
  const activeProjectCount = useMemo(
    () => getActiveProjects(goals ?? []).length,
    [goals]
  );
  const socialBacklog = useMemo(
    () => (Array.isArray(socialFollowUps)
      ? socialFollowUps.filter((item) => {
          if (item?.status === 'done') return false;
          if (!item?.snoozedUntil) return true;
          const until = new Date(item.snoozedUntil).getTime();
          return Number.isFinite(until) ? until <= Date.now() : true;
        })
      : []),
    [socialFollowUps]
  );
  const waitingItemsDue = useMemo(() => {
    const fromState = getWaitingItemsDue(waitingSupportState, { today });
    const known = new Set(fromState.map((item) => `${item.itemType}:${item.itemId}`));
    const fromGoals = (goals ?? [])
      .filter((goal) => goal?._waitingSupport && goal?._waitingSupport !== null)
      .map((goal) => ({
        itemType: 'goal',
        itemId: goal.id,
        waitingType: goal._waitingSupport.waitingType ?? WAITING_TYPES.OTHER,
        waitingOn: goal._waitingSupport.waitingOn ?? '',
        holdUntil: goal._waitingSupport.holdUntil ?? null,
        followUpDate: goal._waitingSupport.followUpDate ?? null,
        note: goal._waitingSupport.note ?? '',
        status: 'active',
      }))
      .filter((item) => !known.has(`${item.itemType}:${item.itemId}`))
      .filter((item) => !item.holdUntil || item.holdUntil <= today);
    return [...fromState, ...fromGoals].slice(0, 8);
  }, [waitingSupportState, today, goals]);
  const lifeDomainCards = useMemo(() => {
    return (lifeDomains ?? []).map((domain) => ({
      domain,
      support: buildDomainSupportPlan(domain),
      health: computeLifeDomainHealth(domain, { maintenanceBlocks, socialFollowUps }),
    }));
  }, [lifeDomains, maintenanceBlocks, socialFollowUps]);
  const protectedTimeSignals = useMemo(
    () => getProtectedTimeSignals({ weekAssignments, goals }),
    [weekAssignments, goals]
  );
  const plannerReviewCount = useMemo(
    () => plannerUpcomingDeadlines.length + (plannerLoad.ratio >= 0.85 ? 1 : 0),
    [plannerUpcomingDeadlines.length, plannerLoad.ratio]
  );
  const plannerSystemsCount = useMemo(
    () => (Array.isArray(routines) ? routines.length : 0) + (Array.isArray(maintenanceBlocks) ? maintenanceBlocks.length : 0) + (Array.isArray(lifeDomains) ? lifeDomains.length : 0),
    [routines, maintenanceBlocks, lifeDomains]
  );
  const routinePatternSuggestions = useMemo(
    () => buildRoutinePatternSuggestions({
      socialFollowUps,
      compost,
      maintenanceBlocks,
      needsRescheduling,
      stagingTaskStatus,
      weekAssignments,
      lastSundayRitualDate,
      routines,
      recurringSupportState,
    }),
    [socialFollowUps, compost, maintenanceBlocks, needsRescheduling, stagingTaskStatus, weekAssignments, lastSundayRitualDate, routines, recurringSupportState]
  );
  const todayContextCounters = useMemo(() => ([
    {
      key: 'inbox',
      label: 'Inbox',
      count: Array.isArray(compost) ? compost.length : 0,
      onClick: () => openModal('compost'),
    },
    {
      key: 'waiting',
      label: 'Waiting',
      count: waitingItemsDue.length,
      onClick: () => setShowTodaySupportSheet(true),
    },
    {
      key: 'routines',
      label: 'Routines',
      count: Array.isArray(routines) ? routines.length : 0,
      onClick: () => setShowTodaySupportSheet(true),
    },
    {
      key: 'projects',
      label: 'Projects',
      count: activeProjectCount,
      onClick: () => setShowProjectPlanner(true),
    },
  ]), [compost, waitingItemsDue.length, routines, activeProjectCount, openModal]);
  const restartResume = useMemo(
    () => buildRestartResumeModel({
      today,
      assignments,
      logs,
      goals,
      compost,
      needsRescheduling,
      todayPrimaryTask,
      dailyEnergy,
      now: new Date(),
    }),
    [today, assignments, logs, goals, compost, needsRescheduling, todayPrimaryTask, dailyEnergy]
  );
  const interruptionSummary = useMemo(
    () => buildInterruptionResumeSummary(interruptionMemory, (goalId) => (goals ?? []).find((g) => g.id === goalId)?.title ?? null),
    [interruptionMemory, goals]
  );
  const lowFrictionTriggered = useMemo(() => {
    const lowEnergy = typeof dailyEnergy === 'number' && dailyEnergy <= 4;
    const repeatedPostpone = Array.isArray(needsRescheduling) && needsRescheduling.length >= 3;
    const drifted = Boolean(restartResume?.relevant);
    const overloaded = isOverloaded;
    const backlogHeavy = (compost?.length ?? 0) >= 8;
    return lowEnergy || repeatedPostpone || drifted || overloaded || backlogHeavy;
  }, [dailyEnergy, needsRescheduling, restartResume?.relevant, isOverloaded, compost?.length]);
  const lowFrictionModeActive = useMemo(() => {
    if (!lowFrictionModeEnabled) return false;
    if (lowFrictionStayDate && today && lowFrictionStayDate !== today) return false;
    return true;
  }, [lowFrictionModeEnabled, lowFrictionStayDate, today]);
  const shouldSuggestLowFriction = useMemo(() => {
    if (!today) return false;
    if (!lowFrictionTriggered) return false;
    if (lowFrictionModeActive) return false;
    return lowFrictionDismissedDate !== today;
  }, [today, lowFrictionTriggered, lowFrictionModeActive, lowFrictionDismissedDate]);

  const todayAssistantActions = useMemo(() => buildTodayAssistantActions({
    isOverloaded,
    todayPrimaryTask,
    needsAttention,
    compost,
    maintenanceSuggestion: maintenanceTemplateSuggestions[0] ?? null,
    socialBacklogCount: socialBacklog.length,
    routinePatternSuggestions,
    waitingCount: waitingItemsDue.length,
    lifeDomainCount: lifeDomainCards.length,
    protectedTimeRisk: protectedTimeSignals.creepRisk,
  }), [isOverloaded, todayPrimaryTask, needsAttention, compost, maintenanceTemplateSuggestions, socialBacklog.length, routinePatternSuggestions, waitingItemsDue.length, lifeDomainCards.length, protectedTimeSignals.creepRisk]);

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
      if (!shouldShowIntervention(HELPER_INTERVENTION_TYPES.SUPPORT_SUGGESTION) || !shouldShowHelperForIntensity(HELPER_INTERVENTION_TYPES.SUPPORT_SUGGESTION, gamificationIntensity)) return;
      const suggestions = resolveSupportSuggestions(goal, 3);
      if (suggestions.length > 0) {
        const domainId = getGoalSupportDomain(goal);
        recordHelperShown(HELPER_INTERVENTION_TYPES.SUPPORT_SUGGESTION);
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
    const planContext =
      today && sessionConfigTarget.hour
        ? { dateStr: today, slotKey: sessionConfigTarget.hour }
        : null;
    runStartFocus({
      goal: sessionConfigTarget.goal,
      minutes: sessionDurationMinutes,
      subtaskId: sessionConfigTarget.subtaskId ?? null,
      planContext,
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
                if (perseveranceReward) pushReward(perseveranceReward);
              }
            }
          }
        }
      }
      recordFocusBehavior('complete', {
        goalId: taskId,
        title: goalTitle,
        taskType: inferTaskTimingType(goals?.find((g) => g.id === taskId) ?? activeSession),
        planned: Boolean(activeSession?.planContext),
        minutes: timeSpentMinutes,
        spoonCount: todaySpoonCount ?? dailySpoonCount,
      });
      addLog({
        taskId,
        taskTitle: goalTitle,
        rating,
        note: '',
        date: new Date(),
        minutes: timeSpentMinutes,
      });
      setInterruptionMemory((prev) => recordInterruptionSnapshot(prev, {
        lastTaskTitle: goalTitle,
        lastGoalId: taskId ?? null,
        lastSubtaskId: activeSession?.subtaskId ?? null,
        lastFocusState: 'complete',
        lastSessionMinutes: timeSpentMinutes,
        lastContextNote: activeSession?.subtaskId ? 'Completed the latest focus step.' : 'Completed a focus block.',
      }));
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
        payload: {
          goalTitle,
          minutes: timeSpentMinutes,
          spoonCount: todaySpoonCount ?? dailySpoonCount,
          fromPlanned: !!completedTask?.planContext,
        },
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
                if (perseveranceReward) pushReward(perseveranceReward);
              }
            }
          }
        }
      }
      recordFocusBehavior('complete', {
        goalId: taskId,
        title: goalTitle,
        taskType: inferTaskTimingType(goals?.find((g) => g.id === taskId) ?? activeSession),
        planned: Boolean(activeSession?.planContext),
        minutes: timeSpentMinutes,
        spoonCount: todaySpoonCount ?? dailySpoonCount,
      });
      addLog({
        taskId,
        taskTitle: goalTitle,
        rating: null,
        note: '',
        date: new Date(),
        minutes: timeSpentMinutes,
      });
      setInterruptionMemory((prev) => recordInterruptionSnapshot(prev, {
        lastTaskTitle: goalTitle,
        lastGoalId: taskId ?? null,
        lastSubtaskId: activeSession?.subtaskId ?? null,
        lastFocusState: 'complete',
        lastSessionMinutes: timeSpentMinutes,
        lastContextNote: 'Finished a focus block and chained to next step.',
      }));
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
        payload: {
          goalTitle,
          minutes: timeSpentMinutes,
          spoonCount: todaySpoonCount ?? dailySpoonCount,
          fromPlanned: !!activeSession?.planContext,
        },
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
          minutes: nextStep.suggestedMinutes ?? 5,
          subtaskId: nextStep.subtaskId ?? nextStep.id,
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
      recordFocusBehavior,
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
              if (perseveranceReward) pushReward(perseveranceReward);
            }
          }
        }
      }
    }
    recordFocusBehavior('complete', {
      goalId: taskId,
      title: goalTitle,
      taskType: inferTaskTimingType(goals.find((g) => g.id === taskId) ?? completedTask),
      planned: Boolean(completedTask?.planContext),
      minutes: durationMinutes,
      spoonCount: todaySpoonCount ?? dailySpoonCount,
    });
    addLog({
      taskId: completedTask?.id ?? log?.taskId,
      taskTitle: goalTitle,
      rating: log?.rating ?? null,
      note: log?.note ?? '',
      date: new Date(),
      minutes: durationMinutes,
    });
    setInterruptionMemory((prev) => recordInterruptionSnapshot(prev, {
      lastTaskTitle: goalTitle,
      lastGoalId: taskId ?? null,
      lastSubtaskId: completedTask?.subtaskId ?? log?.subtaskId ?? null,
      lastFocusState: 'complete',
      lastSessionMinutes: durationMinutes,
      lastContextNote: log?.note ? `Last note: ${String(log.note).slice(0, 180)}` : 'Focus session logged.',
      lastNote: log?.note ? String(log.note).slice(0, 400) : (prev?.lastNote ?? null),
    }));
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
      payload: {
        goalTitle,
        minutes: durationMinutes,
        spoonCount: todaySpoonCount ?? dailySpoonCount,
        fromPlanned: !!completedTask?.planContext,
      },
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
      if (linkedGoal && shouldShowIntervention(HELPER_INTERVENTION_TYPES.HABIT_STACK_HANDOFF) && shouldShowHelperForIntensity(HELPER_INTERVENTION_TYPES.HABIT_STACK_HANDOFF, gamificationIntensity)) {
        const routineName = completedTask?.title ?? completedGoalForStack?.title ?? 'Routine';
        recordHelperShown(HELPER_INTERVENTION_TYPES.HABIT_STACK_HANDOFF);
        setHelperQueue((prev) => [...prev, createIntervention(HELPER_INTERVENTION_TYPES.HABIT_STACK_HANDOFF, { source: 'routine_complete', routineName, linkedGoal, linkedSubtaskId, linkedTitle })]);
        didSetHabitStack = true;
      }
    }

    // Next Step: only if no habit stack and cooldown elapsed
    if (!didSetHabitStack && shouldShowIntervention(HELPER_INTERVENTION_TYPES.NEXT_STEP) && shouldShowHelperForIntensity(HELPER_INTERVENTION_TYPES.NEXT_STEP, gamificationIntensity)) {
      const completedSubtaskId = completedTask?.subtaskId ?? log?.subtaskId;
      if (taskId && completedSubtaskId) {
        const nextStep = getNextTaskInSequence(goals, taskId, completedSubtaskId);
        if (nextStep) {
          const completedTitle = completedTask?.title ?? goal?.subtasks?.find((s) => s.id === completedSubtaskId)?.title ?? 'Task';
          recordHelperShown(HELPER_INTERVENTION_TYPES.NEXT_STEP);
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

  const handleFocusSessionStart = useCallback(() => {
    const reward = buildReward({ type: 'ACTIVATION_START' });
    if (reward && typeof pushReward === 'function') pushReward(reward);
    if (activeSession) {
      recordFocusBehavior('start', {
        goalId: activeSession.id,
        title: activeSession.title,
        taskType: inferTaskTimingType(activeSession),
        planned: Boolean(activeSession.planContext),
        spoonCount: todaySpoonCount ?? dailySpoonCount,
      });
      setInterruptionMemory((prev) => recordInterruptionSnapshot(prev, {
        lastIntent: `Focus on ${activeSession.title}`,
        lastTaskTitle: activeSession.title,
        lastGoalId: activeSession.id ?? null,
        lastSubtaskId: activeSession.subtaskId ?? null,
        lastFocusState: 'active',
        lastSessionStartedAt: new Date().toISOString(),
        lastContextNote: activeSession?.planContext?.slotKey ? `Planned slot ${activeSession.planContext.slotKey}` : null,
      }));
    }
  }, [pushReward, activeSession, recordFocusBehavior, todaySpoonCount, dailySpoonCount]);

  const handleFocusExit = useCallback(
    async (outcome) => {
      const taskTitle = activeSession?.title;
      const planContext = activeSession?.planContext;
      const goalId = activeSession?.id;
      if (activeSession && outcome?.action === 'reschedule') {
        setInterruptionMemory((prev) => recordInterruptionSnapshot(prev, {
          lastTaskTitle: activeSession.title,
          lastGoalId: activeSession.id ?? null,
          lastSubtaskId: activeSession.subtaskId ?? null,
          lastFocusState: 'paused',
          lastContextNote: 'Paused and moved to later today.',
        }));
      }
      if (activeSession && !outcome?.action) {
        recordFocusBehavior('abandon', {
          goalId: activeSession.id,
          title: activeSession.title,
          taskType: inferTaskTimingType(activeSession),
          planned: Boolean(activeSession.planContext),
          spoonCount: todaySpoonCount ?? dailySpoonCount,
        });
        setInterruptionMemory((prev) => recordInterruptionSnapshot(prev, {
          lastTaskTitle: activeSession.title,
          lastGoalId: activeSession.id ?? null,
          lastSubtaskId: activeSession.subtaskId ?? null,
          lastFocusState: 'abandoned',
          lastContextNote: outcome?.action === 'reschedule'
            ? 'Paused and rescheduled.'
            : 'Paused before completion.',
        }));
      }
      setActiveSession(null);

      if (outcome?.action === 'reschedule' && planContext?.dateStr && planContext?.slotKey && goalId && typeof loadDayPlan === 'function' && typeof saveDayPlanForDate === 'function') {
        try {
          const day = (await loadDayPlan(planContext.dateStr)) ?? {};
          const slotKey = planContext.slotKey;
          const current = day[slotKey];
          const removeGoalFromSlot = (val) => {
            if (val == null) return undefined;
            if (Array.isArray(val)) {
              const filtered = val.filter((a) => a && (a.goalId !== goalId && a.id !== goalId));
              return filtered.length === 0 ? undefined : filtered.length < val.length ? filtered : val;
            }
            return val && (val.goalId === goalId || val.id === goalId) ? undefined : val;
          };
          const next = { ...day };
          next[slotKey] = removeGoalFromSlot(current);
          if (next[slotKey] === undefined) delete next[slotKey];
          next.anytime = Array.isArray(next.anytime) ? [...next.anytime] : [];
          next.anytime.push({ goalId, title: taskTitle ?? '', type: 'kaizen' });
          await saveDayPlanForDate(planContext.dateStr, next);
          const rescheduleReward = buildReward({ type: 'RESCHEDULED' });
          if (rescheduleReward) pushReward?.(rescheduleReward);
          addWater?.(1);
        } catch (e) {
          console.warn('Focus exit reschedule failed', e);
        }
        return;
      }

      if (taskTitle && !outcome?.action && shouldShowIntervention(HELPER_INTERVENTION_TYPES.FOCUS_ABANDONED) && shouldShowHelperForIntensity(HELPER_INTERVENTION_TYPES.FOCUS_ABANDONED, gamificationIntensity)) {
        recordHelperShown(HELPER_INTERVENTION_TYPES.FOCUS_ABANDONED);
        setHelperQueue((prev) => [...prev, createIntervention(HELPER_INTERVENTION_TYPES.FOCUS_ABANDONED, { source: 'focus_exit', taskTitle })]);
      }
    },
    [activeSession, loadDayPlan, saveDayPlanForDate, pushReward, recordFocusBehavior, todaySpoonCount, dailySpoonCount]
  );

  if (showTeaCeremony) {
    const completedGoal = completedTask?.id ? goals?.find((g) => g.id === completedTask.id) : null;
    const vineOptions = completedGoal?.subtasks ?? [];
    return (
      <Suspense fallback={<LoadingSurface label="Preparing tea ceremony..." fullscreen />}>
        <TeaCeremony
          task={completedTask}
          subtasks={vineOptions}
          onComplete={handleTeaComplete}
        />
      </Suspense>
    );
  }

  if (activeSession) {
    const durationSeconds = (activeSession.sessionDurationMinutes ?? 25) * 60;
    return (
      <Suspense fallback={<LoadingSurface label="Preparing focus session..." fullscreen />}>
        <FocusSession
          key={`focus-${activeSession.id ?? ''}-${activeSession.subtaskId ?? 'g'}`}
          activeTask={activeSession}
          durationSeconds={durationSeconds}
          goals={goals}
          onComplete={handleSessionComplete}
          onExit={handleFocusExit}
          onStart={handleFocusSessionStart}
          onStartNextStep={handleStartNextStep}
        />
      </Suspense>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showSpiritOrigins && (
          <div className="fixed inset-0 z-50 overflow-auto">
            <Suspense fallback={<LoadingSurface label="Opening spirit studio..." fullscreen />}>
              <SpiritOrigins onComplete={handleSpiritBorn} onSkip={handleSpiritSkip} />
            </Suspense>
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
        {showMorningCheckInModal && (
          <Suspense fallback={<LoadingSurface label="Loading morning check-in..." fullscreen />}>
            <MorningCheckIn
              goals={goals}
              logMetric={logMetric}
              yesterdayPlan={yesterdayPlan}
              initialEnergyLevel={todaySpoonCount ?? dailyEnergy ?? 5}
              mode={needsMorningCheckIn ? 'checkin' : 'adjust'}
              onDismiss={() => setShowMorningCheckInModal(false)}
              onComplete={(modifier, energyLevel) => {
                const level = energyLevel ?? modifier ?? 3;
                completeMorningCheckIn(level);
                recordCheckInBehavior({ spoonCount: level, energyLevel: dailyEnergy, date: new Date() });
                if (typeof compostStaleSeeds === 'function') compostStaleSeeds();
                setShowMorningCheckInModal(false);
                generateMorningBriefing(goals, today).then((items) => {
                  if (Array.isArray(items) && items.length > 0) setMorningBriefing(items);
                });
                if (needsMorningCheckIn) {
                  if (tourStep === 1) setTourStep(2);
                  requestSpiritWisdom(false);
                  const hasAnyAssignment = HOURS.some((h) => getAssignmentsForHour(assignments, h).length > 0);
                  let planSummary = null;
                  if (!hasAnyAssignment) {
                    const eventsForPlan = Array.isArray(weeklyEvents) ? weeklyEvents : [];
                    const slotCount = level >= 1 && level <= 10 ? level : (level >= 1 && level <= 5 ? (level <= 2 ? 2 + (level - 1) * 2 : level === 3 ? 6 : level === 4 ? 8 : 10) : 6);
                    const startHour = hourFromTimeStr(userSettings?.dayStart, 8);
                    const endHour = hourFromTimeStr(userSettings?.dayEnd, 22);
                    const plan = generateDailyPlan(goals, slotCount, eventsForPlan, { stormBufferMinutes: 30, startHour, endHour, learnedEnergyProfile });
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
                }
              }}
            />
          </Suspense>
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
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,34rem)_auto]">
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
                          <button type="button" onClick={() => { showConfirm({ message: 'Disconnect Google Calendar? Your events will no longer sync here.', confirmLabel: 'Disconnect', cancelLabel: 'Keep', destructive: true, onConfirm: () => { disconnectCalendar(); setShowCalendarMenu(false); } }); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors">
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
                          <button type="button" onClick={() => { showConfirm({ message: 'Disconnect Outlook? Your events will no longer sync here.', confirmLabel: 'Disconnect', cancelLabel: 'Keep', destructive: true, onConfirm: () => { disconnectOutlook(); setShowCalendarMenu(false); } }); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors">
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
                                window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Couldn\'t connect to Outlook. Check your calendar settings or try again later.' } }));
                              } catch (e) {
                                window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Couldn\'t connect to Outlook. Check your calendar settings or try again later.' } }));
                              }
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-stone-50 transition-colors"
                          >
                            <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-[11px] font-bold text-stone-500 shrink-0">O</span>
                            <span className="font-sans text-sm text-stone-600">Connect Outlook</span>
                          </button>
                          <p className="px-3 py-1.5 font-sans text-[10px] text-stone-400 border-t border-stone-100">
                            Outlook requires one-time setup. Ask your admin if you don’t see events.
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
                onClick={() => setShowMorningCheckInModal(true)}
                className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg font-sans text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                  isDark ? 'text-slate-300 hover:bg-slate-700/60' : 'text-stone-700 hover:bg-stone-200/60'
                }`}
                aria-label="Adjust energy level"
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

          <div className="min-w-0">
            <button
              type="button"
              onClick={() => requestOmniAddOpen()}
              className={`group w-full rounded-[26px] border px-4 py-3.5 text-left shadow-[0_18px_48px_-28px_rgba(15,23,42,0.28)] transition focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                isDark
                  ? 'border-slate-600/50 bg-gradient-to-r from-slate-900/70 via-slate-900/55 to-slate-900/70 hover:from-slate-900/85 hover:via-slate-900/70 hover:to-slate-900/85'
                  : 'border-stone-200/80 bg-gradient-to-r from-white via-stone-50/92 to-white hover:from-white hover:via-white hover:to-white'
              }`}
              aria-label="Open capture"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg shadow-inner ${
                    isDark ? 'bg-moss-900/55 text-moss-200 ring-1 ring-moss-700/40' : 'bg-moss-100 text-moss-800 ring-1 ring-moss-200'
                  }`}
                  aria-hidden
                >
                  +
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`font-sans text-sm font-semibold tracking-[0.01em] ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                    Type, paste, or share anything
                  </p>
                  <p className="mt-0.5 font-sans text-xs text-stone-500 dark:text-stone-400">
                    One quick guess, one confirmation.
                  </p>
                </div>
                <span className="hidden shrink-0 rounded-full border border-stone-200/70 bg-white/70 px-2.5 py-1 font-sans text-[11px] font-medium text-stone-500 dark:border-slate-600 dark:bg-slate-800/60 dark:text-stone-400 md:inline">
                  Ctrl/Cmd+Shift+O
                </span>
              </div>
            </button>
          </div>

          {/* Right: top-nav toolbelt (quick actions). */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              id="mochi-chat-btn"
              type="button"
              onClick={() => openModal('chat')}
              className={`flex items-center justify-center rounded-full transition-transform cursor-pointer drop-shadow-sm ${gamificationConfig.spiritPresence === 'minimal' ? 'w-8 h-8 hover:scale-105' : 'w-10 h-10 hover:scale-105'}`}
              title={gamificationConfig.metaphorWording ? 'Talk to Mochi' : 'Chat'}
            >
              <span className={gamificationConfig.spiritPresence === 'minimal' ? 'text-base leading-none' : 'text-xl leading-none'}>{renderSpiritAvatar()}</span>
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

      {activeTab !== 'settings' && activeTab !== 'today' && currentTaskStrip && dismissedCurrentTaskStripKey !== currentTaskStripKey && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,720px)] pointer-events-none">
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
                Open Today
              </button>
            )}
            <button
              type="button"
              onClick={() => setDismissedCurrentTaskStripKey(currentTaskStripKey)}
              className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100/80 dark:hover:bg-slate-700/80 dark:hover:text-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              aria-label="Dismiss next up message"
              title="Dismiss"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'garden' ? (
        <div className="flex-1 min-h-0 relative pt-0 pb-20">
          {gardenCommentMessage && gamificationConfig.gardenWorldVisibility !== 'reduced' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-moss-100 dark:bg-moss-900/50 border border-moss-300 dark:border-moss-700 text-moss-800 dark:text-moss-200 font-sans text-sm shadow-lg max-w-[90vw]" role="status">
              {gamificationConfig.metaphorWording ? `Mochi: ${gardenCommentMessage}` : gardenCommentMessage}
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
          <Suspense fallback={<LoadingSurface label="Loading settings..." />}>
            <SettingsView onReplayTour={() => { setShowTour(true); setActiveTab('today'); }} />
          </Suspense>
        </main>
      ) : (
      <main className={`flex-1 w-full min-w-0 px-3 sm:px-4 py-6 sm:py-8 ${activeTab === 'planner' ? 'max-w-[1400px]' : 'max-w-5xl'} mx-auto relative pb-28 sm:pb-24 safe-area-pb`}>
        {activeTab === 'today' && (
          <>
            {shouldSuggestLowFriction && (
              <section className={`mb-4 rounded-2xl border px-4 py-4 ${isDark ? 'border-slate-600/50 bg-slate-800/70' : 'border-stone-200 bg-white/90'}`}>
                <p className="font-sans text-xs uppercase tracking-wide text-stone-500">Suggestion</p>
                <p className="mt-1 font-sans text-sm text-stone-700 dark:text-stone-200">
                  You look overloaded. Low-friction mode can reduce choices and keep one clear next move.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setLowFrictionModeEnabled(true); setLowFrictionStayDate(today ?? null); setLowFrictionDismissedDate(null); }}
                    className="rounded-lg bg-moss-600 px-3 py-2 font-sans text-sm font-medium text-white hover:bg-moss-700"
                  >
                    Turn on low-friction mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setLowFrictionDismissedDate(today ?? null)}
                    className="rounded-lg border border-stone-200 px-3 py-2 font-sans text-sm text-stone-600 hover:bg-stone-100 dark:border-slate-600 dark:text-stone-300 dark:hover:bg-slate-700/60"
                  >
                    Dismiss for now
                  </button>
                </div>
              </section>
            )}

            {lowFrictionModeActive && (
              <section className={`mb-5 rounded-3xl border px-5 py-5 ${isDark ? 'border-slate-600/50 bg-slate-800/70' : 'border-stone-200/80 bg-white/95'}`}>
                <p className="font-sans text-xs uppercase tracking-[0.14em] text-stone-500">Don’t-make-me-think mode</p>
                <h1 className="mt-2 font-serif text-2xl text-stone-900 dark:text-stone-100">Here’s the next thing.</h1>
                <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">
                  One task, one support move, one low-pressure option.
                </p>

                <div className={`mt-4 rounded-2xl border px-4 py-4 ${isDark ? 'border-slate-600/50 bg-slate-900/30' : 'border-stone-200 bg-stone-50/80'}`}>
                  <p className="font-sans text-[11px] uppercase tracking-wide text-stone-500">Main task</p>
                  <p className="mt-1 font-sans text-base font-semibold text-stone-900 dark:text-stone-100">
                    {todayMustDoLane?.primary?.title ?? 'Pick one small task'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (todayMustDoLane?.primary?.onClick) todayMustDoLane.primary.onClick();
                      else handleHelpMeStart();
                    }}
                    className="mt-3 rounded-xl bg-moss-600 px-3 py-2 font-sans text-sm font-medium text-white hover:bg-moss-700"
                  >
                    {todayMustDoLane?.primary?.ctaLabel ?? 'Start this'}
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleRestartResumeAction('shrink_plan')}
                    className="rounded-xl border border-stone-200 px-3 py-2 text-left font-sans text-sm text-stone-700 hover:bg-stone-100 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                  >
                    <span className="block text-[11px] uppercase tracking-wide text-stone-500">Support action</span>
                    Shrink the plan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRestartResumeAction('start_focus_5')}
                    className="rounded-xl border border-stone-200 px-3 py-2 text-left font-sans text-sm text-stone-700 hover:bg-stone-100 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                  >
                    <span className="block text-[11px] uppercase tracking-wide text-stone-500">Low-pressure alternative</span>
                    3-5 minute version
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setLowFrictionModeEnabled(false); setLowFrictionStayDate(null); }}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 font-sans text-xs text-stone-600 hover:bg-stone-100 dark:border-slate-600 dark:text-stone-300 dark:hover:bg-slate-700/60"
                  >
                    Exit mode
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLowFrictionModeEnabled(true); setLowFrictionStayDate(today ?? null); }}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 font-sans text-xs text-stone-600 hover:bg-stone-100 dark:border-slate-600 dark:text-stone-300 dark:hover:bg-slate-700/60"
                  >
                    Stay in this mode for today
                  </button>
                </div>
              </section>
            )}

            {!lowFrictionModeActive && <div className="flex flex-col gap-5 h-full">
              <TourHighlight step={1} tooltip="Start here. In one glance you should know what today can hold and what to do first.">
                <section
                  id="guide-morning-checkin"
                  className={`rounded-[28px] border px-5 py-5 sm:px-6 sm:py-6 shadow-lg ${
                    isDark
                      ? 'border-slate-600/50 bg-slate-800/85'
                      : 'border-stone-200/80 bg-white/95'
                  }`}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">Best next move</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {todayChiefStart.metaChips.map((chip) => {
                            const isAlertChip = chip === 'Load needs relief' || chip === 'Check in first' || chip === 'Protect margin';
                            return (
                              <span
                                key={chip}
                                className={`rounded-full px-3 py-1.5 font-sans text-xs font-medium ${
                                  isAlertChip
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                                    : isDark
                                      ? 'bg-slate-800/80 text-stone-200'
                                      : 'bg-stone-100 text-stone-700'
                                }`}
                              >
                                {chip}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className={`rounded-2xl border px-4 py-4 ${
                      isDark
                        ? 'border-slate-600/50 bg-slate-900/40'
                        : 'border-stone-200 bg-stone-50/80'
                    }`}>
                      <p className="font-sans text-base sm:text-lg font-semibold text-stone-900 dark:text-stone-100">{todayChiefStart.recommendation}</p>
                      {todayChiefStart.reasonLine && (
                        <p className="mt-2 font-sans text-sm text-stone-600 dark:text-stone-300">{todayChiefStart.reasonLine}</p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={todayChiefStart.dominantAction.onClick}
                        disabled={todayChiefStart.dominantAction.disabled}
                        className="flex-1 rounded-2xl bg-moss-600 px-4 py-3 font-sans text-sm font-semibold text-white shadow-sm transition hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {todayChiefStart.dominantAction.label}
                      </button>
                      <button
                        type="button"
                        onClick={todayChiefStart.supportingAction.onClick}
                        disabled={todayChiefStart.supportingAction.disabled}
                        className={`rounded-2xl px-4 py-3 font-sans text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-moss-500/40 disabled:cursor-not-allowed disabled:opacity-70 ${
                          isDark
                            ? 'border border-slate-600/60 bg-slate-800/60 text-stone-200 hover:bg-slate-700/70'
                            : 'border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {todayChiefStart.supportingAction.label}
                      </button>
                    </div>
                  </div>
                </section>
              </TourHighlight>

              <section className={`rounded-3xl border px-5 py-4 ${isDark ? 'border-slate-600/50 bg-slate-800/60' : 'border-stone-200/80 bg-white/88'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-stone-400 dark:text-stone-500">Context rail</p>
                    <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">Keep the day clean. Open extra context only when you need it.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {todayContextCounters.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={item.onClick}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                          isDark
                            ? 'border-slate-600/60 bg-slate-900/35 text-stone-200 hover:bg-slate-800/80'
                            : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] ${
                          isDark ? 'bg-slate-700 text-stone-100' : 'bg-white text-stone-600'
                        }`}>
                          {item.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {showTodaySupportSheet && (
                <>
                <button
                  type="button"
                  aria-label="Close support sheet"
                  className="fixed inset-0 z-[70] bg-stone-950/35 backdrop-blur-[3px]"
                  onClick={() => setShowTodaySupportSheet(false)}
                />
                <div
                  className={`fixed inset-x-0 bottom-0 z-[71] max-h-[84vh] overflow-y-auto rounded-t-[30px] border shadow-[0_24px_80px_-28px_rgba(15,23,42,0.55)] md:inset-y-6 md:right-6 md:left-auto md:w-[min(31rem,calc(100vw-3rem))] md:rounded-[30px] ${
                    isDark
                      ? 'border-slate-600/50 bg-gradient-to-b from-slate-900/98 via-slate-900/96 to-slate-950/98'
                      : 'border-stone-200/80 bg-gradient-to-b from-white via-stone-50/96 to-stone-100/96'
                  }`}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Today support"
                >
                <div className={`sticky top-0 z-10 mb-4 border-b px-4 pb-4 pt-3 backdrop-blur-xl ${
                  isDark ? 'border-slate-700/70 bg-slate-950/75' : 'border-stone-200/80 bg-stone-50/88'
                }`}>
                  <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-300 dark:bg-slate-700 md:hidden" aria-hidden />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">Review day</p>
                      <h2 className="mt-1 font-serif text-lg text-stone-900 dark:text-stone-100">Why this, and what to adjust if needed</h2>
                      <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">Open this when you want a little more context or you need to reshape the day.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTodaySupportSheet(false)}
                      className="rounded-full border border-stone-200 px-3 py-1.5 font-sans text-xs text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-800/70"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div className="space-y-5 px-4 pb-4">
              {todayHero.reviewSections.length > 0 && (
                <section className={`rounded-3xl border px-5 py-5 ${isDark ? 'border-stone-600/50 bg-stone-800/70' : 'border-stone-200/80 bg-white/90'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-stone-400 dark:text-stone-500">Briefing notes</p>
                      <h2 className="mt-2 font-serif text-xl text-stone-900 dark:text-stone-100">Support for today&apos;s recommendation</h2>
                      <p className="mt-1 font-sans text-sm text-stone-500 dark:text-stone-400">Short context only, so it is easy to adjust the day without adding noise.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {todayHero.reviewSections.map((section) => (
                      <div key={section.key} className={`rounded-2xl border px-4 py-4 ${isDark ? 'border-slate-600/50 bg-slate-900/35' : 'border-stone-200 bg-stone-50/80'}`}>
                        <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">{section.title}</p>
                        <p className="mt-1 font-sans text-sm text-stone-700 dark:text-stone-200">{section.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {todayHero.supportActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 disabled:opacity-70 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className={`rounded-3xl border px-5 py-5 ${isDark ? 'border-slate-600/50 bg-slate-800/70' : 'border-stone-200/80 bg-white/90'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-stone-400 dark:text-stone-500">Assistant operator</p>
                    <h2 className="mt-2 font-serif text-xl text-stone-900 dark:text-stone-100">
                      {todayAssistantSignals[0]?.message ?? 'One tap actions to update your plan right now.'}
                    </h2>
                    <p className="mt-1 font-sans text-sm text-stone-500 dark:text-stone-400">
                      Each action performs a concrete plan change. Chat is available for edge cases.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal('chat')}
                    className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                  >
                    Open chat
                  </button>
                </div>
                <div className="mt-4">
                  <AiActionChips
                    actions={todayAssistantActions}
                    onAction={handleAssistantOperatorAction}
                    loadingAction={assistantActionBusy}
                    variant="operator"
                  />
                </div>
              </section>

              {taskStartHelp && (
                <section className={`rounded-3xl border px-5 py-5 ${isDark ? 'border-stone-600/50 bg-stone-800/70' : 'border-stone-200/80 bg-stone-50/80'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-stone-400 dark:text-stone-500">Start help</p>
                      <h2 className="mt-2 font-serif text-lg text-stone-900 dark:text-stone-100">Make this easier to begin</h2>
                      <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">
                        Optional support when starting feels sticky.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTaskStartPanelOpen((v) => !v)}
                        className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                      >
                        {taskStartPanelOpen ? 'Hide this' : 'Show me how to start'}
                      </button>
                      <button
                        type="button"
                        onClick={() => dismissTaskStartHelp(true)}
                        className="rounded-xl px-3 py-2 font-sans text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
                      >
                        Don’t show for this task
                      </button>
                    </div>
                  </div>

                  {taskStartPanelOpen && (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button type="button" onClick={() => applyTaskStartSuggestion(taskStartHelp.tinyFirstStep)} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-left dark:border-slate-600 dark:bg-slate-800/70">
                          <p className="font-sans text-xs uppercase tracking-wide text-stone-500">Tiny first step</p>
                          <p className="mt-1 font-sans text-sm text-stone-800 dark:text-stone-200">{taskStartHelp.tinyFirstStep}</p>
                        </button>
                        <button type="button" onClick={() => applyTaskStartSuggestion(taskStartHelp.prepStep)} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-left dark:border-slate-600 dark:bg-slate-800/70">
                          <p className="font-sans text-xs uppercase tracking-wide text-stone-500">What to prepare</p>
                          <p className="mt-1 font-sans text-sm text-stone-800 dark:text-stone-200">{taskStartHelp.prepStep}</p>
                        </button>
                        <button type="button" onClick={() => applyTaskStartSuggestion(taskStartHelp.easierVersion)} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-left dark:border-slate-600 dark:bg-slate-800/70">
                          <p className="font-sans text-xs uppercase tracking-wide text-stone-500">Easier version</p>
                          <p className="mt-1 font-sans text-sm text-stone-800 dark:text-stone-200">{taskStartHelp.easierVersion}</p>
                        </button>
                        <button type="button" onClick={() => applyTaskStartSuggestion(taskStartHelp.goodEnoughTarget)} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-left dark:border-slate-600 dark:bg-slate-800/70">
                          <p className="font-sans text-xs uppercase tracking-wide text-stone-500">Good enough for now</p>
                          <p className="mt-1 font-sans text-sm text-stone-800 dark:text-stone-200">{taskStartHelp.goodEnoughTarget}</p>
                        </button>
                      </div>

                      <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800/70">
                        <p className="font-sans text-xs uppercase tracking-wide text-stone-500">Starter script</p>
                        <p className="mt-1 font-sans text-sm text-stone-800 dark:text-stone-200">{taskStartHelp.starterScript}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleOpenFocusScaffold}
                          className="rounded-lg bg-moss-600 px-3 py-1.5 font-sans text-xs font-medium text-white hover:bg-moss-700"
                        >
                          Guided 3-5 minute starter
                        </button>
                        <button type="button" onClick={() => setTaskStartStyle('tiny_step')} className="rounded-lg border border-stone-200 px-2.5 py-1.5 font-sans text-xs text-stone-700 dark:border-slate-600 dark:text-stone-200">Tiny steps</button>
                        <button type="button" onClick={() => setTaskStartStyle('script')} className="rounded-lg border border-stone-200 px-2.5 py-1.5 font-sans text-xs text-stone-700 dark:border-slate-600 dark:text-stone-200">Script</button>
                        <button type="button" onClick={() => setTaskStartStyle('prepare')} className="rounded-lg border border-stone-200 px-2.5 py-1.5 font-sans text-xs text-stone-700 dark:border-slate-600 dark:text-stone-200">Prepare</button>
                        <button type="button" onClick={() => setTaskStartStyle('low_energy')} className="rounded-lg border border-stone-200 px-2.5 py-1.5 font-sans text-xs text-stone-700 dark:border-slate-600 dark:text-stone-200">Low-energy</button>
                        <button type="button" onClick={() => setTaskStartStyle('body_double')} className="rounded-lg border border-stone-200 px-2.5 py-1.5 font-sans text-xs text-stone-700 dark:border-slate-600 dark:text-stone-200">Body double</button>
                      </div>

                      {showFocusScaffold && (
                        <FocusScaffoldCard
                          open={showFocusScaffold}
                          taskTitle={todayPrimaryTask?.title ?? 'Start this task'}
                          tinyStep={taskStartHelp.tinyFirstStep}
                          prepStep={taskStartHelp.prepStep}
                          encouragement={taskStartHelp.bodyDoubleLine}
                          preferredMinutes={taskStartHelp.preferredStyle === 'timer_start' ? 5 : 3}
                          onApplyTinyStep={() => applyTaskStartSuggestion(taskStartHelp.tinyFirstStep)}
                          onApplyPrepStep={() => applyTaskStartSuggestion(taskStartHelp.prepStep)}
                          onStart={handleStartFromScaffold}
                          onDismiss={() => setShowFocusScaffold(false)}
                        />
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => markTaskStartFeedback(true)} className="rounded-lg border border-stone-200 px-2.5 py-1.5 font-sans text-xs text-stone-700 dark:border-slate-600 dark:text-stone-200">This helps</button>
                        <button type="button" onClick={() => markTaskStartFeedback(false)} className="rounded-lg border border-stone-200 px-2.5 py-1.5 font-sans text-xs text-stone-700 dark:border-slate-600 dark:text-stone-200">Not helpful</button>
                        <button type="button" onClick={() => dismissTaskStartHelp(false)} className="rounded-lg px-2.5 py-1.5 font-sans text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200">Hide this</button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {waitingItemsDue.length > 0 && (
                <section id="today-waiting-open-loops" className={`rounded-3xl border px-5 py-5 ${isDark ? 'border-stone-600/50 bg-stone-800/70' : 'border-stone-200/80 bg-stone-50/80'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-stone-400 dark:text-stone-500">Waiting / open loops</p>
                      <h2 className="mt-2 font-serif text-lg text-stone-900 dark:text-stone-100">Parked items</h2>
                      <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">
                        Parked is a valid state. These will resurface when they are actionable.
                      </p>
                    </div>
                    {todayPrimaryTask?.goalId && (
                      <button
                        type="button"
                        onClick={parkPrimaryTaskAsWaiting}
                        className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                      >
                        Park primary as waiting-for
                      </button>
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    {waitingItemsDue.map((item) => {
                      const goal = (goals ?? []).find((g) => g.id === item.itemId);
                      if (!goal) return null;
                      return (
                        <div key={`${item.itemType}:${item.itemId}`} className="rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800/70">
                          <p className="font-sans text-sm font-medium text-stone-800 dark:text-stone-200">{goal.title}</p>
                          <p className="mt-0.5 font-sans text-xs text-stone-500 dark:text-stone-400">
                            Waiting on {item.waitingOn || item.waitingType || 'dependency'}
                            {item.followUpDate ? ` · follow up ${item.followUpDate}` : ''}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => nudgeWaitingLater(item, 2)} className="rounded-lg border border-stone-200 px-2.5 py-1.5 font-sans text-xs text-stone-700 dark:border-slate-600 dark:text-stone-200">Nudge later (+2d)</button>
                            <button type="button" onClick={() => resolveGoalWaitingSupport?.(item.itemId)} className="rounded-lg border border-stone-200 px-2.5 py-1.5 font-sans text-xs text-stone-700 dark:border-slate-600 dark:text-stone-200">Mark resolved</button>
                            <button type="button" onClick={() => handleStartNowStart({ goal, goalId: goal.id, subtaskId: null }, 5)} className="rounded-lg bg-moss-600 px-2.5 py-1.5 font-sans text-xs font-medium text-white hover:bg-moss-700">Resume now</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {restartResume?.relevant && (
                <section className={`rounded-3xl border px-5 py-5 ${isDark ? 'border-moss-700/40 bg-moss-900/20' : 'border-moss-200 bg-moss-50/70'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-moss-700 dark:text-moss-300">Resume from here</p>
                      <h2 className="mt-2 font-serif text-xl text-stone-900 dark:text-stone-100">{restartResume.headline}</h2>
                      <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">{restartResume.reasonLine}</p>
                      {interruptionSummary && (
                        <p className="mt-1 font-sans text-sm text-stone-700 dark:text-stone-200">{interruptionSummary}</p>
                      )}
                      {restartResume.contextLine && (
                        <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">{restartResume.contextLine}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleRestartResumeAction('resume_gently')}
                      className="rounded-xl bg-moss-600 px-3 py-2 font-sans text-sm font-medium text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                    >
                      Resume gently
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestartResumeAction('shrink_plan')}
                      className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                    >
                      Shrink the plan
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestartResumeAction('start_focus_5')}
                      className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                    >
                      Start for 5 minutes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestartResumeAction('move_rest')}
                      className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                    >
                      Move the rest
                    </button>
                    {interruptionMemory?.lastNote && (
                      <button
                        type="button"
                        onClick={() => pushReward?.({ message: interruptionMemory.lastNote, tone: 'slate', icon: '📝', durationMs: 3200 })}
                        className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                      >
                        Show last note
                      </button>
                    )}
                  </div>
                </section>
              )}

              {socialBacklog.length > 0 && (
                <section className={`rounded-3xl border px-5 py-5 ${isDark ? 'border-slate-600/50 bg-slate-800/70' : 'border-stone-200/80 bg-white/90'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100">Social upkeep</h2>
                      <p className="mt-1 font-sans text-sm text-stone-500 dark:text-stone-400">
                        Keep relationships warm in batches, not constant interruptions.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAssistantOperatorAction('ADD_SOCIAL_CATCHUP_BLOCK', { templateId: 'social_catchup' })}
                      className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                    >
                      Add catch-up block
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {socialBacklog.slice(0, 4).map((item) => (
                      <div key={item.id} className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-3 ${isDark ? 'border-slate-600/50 bg-slate-900/30' : 'border-stone-200 bg-stone-50/80'}`}>
                        <div className="min-w-0">
                          <p className="font-sans text-sm text-stone-800 dark:text-stone-200 truncate">{item.text}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateSocialFollowUp?.(item.id, { snoozedUntil: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString() })}
                            className="text-xs font-sans text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
                          >
                            Snooze
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSocialFollowUp?.(item.id, { status: 'done' })}
                            className="text-xs font-sans text-moss-700 hover:text-moss-800 dark:text-moss-300"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {routinePatternSuggestions.length > 0 && (
                <section className={`rounded-3xl border px-5 py-5 ${isDark ? 'border-slate-600/50 bg-slate-800/70' : 'border-stone-200/80 bg-white/90'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100">Support structure suggestions</h2>
                      <p className="mt-1 font-sans text-sm text-stone-500 dark:text-stone-400">
                        Based on repeated friction patterns. Optional and adjustable.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {routinePatternSuggestions.map((suggestion) => (
                      <div key={suggestion.id} className={`rounded-xl border px-3 py-3 ${isDark ? 'border-slate-600/50 bg-slate-900/30' : 'border-stone-200 bg-stone-50/80'}`}>
                        <p className="font-sans text-sm font-medium text-stone-900 dark:text-stone-100">{suggestion.title}</p>
                        <p className="mt-1 font-sans text-xs text-stone-600 dark:text-stone-300">{suggestion.body}</p>
                        <button
                          type="button"
                          onClick={() => handleAssistantOperatorAction('ADD_ROUTINE_STRUCTURE', { suggestion })}
                          className="mt-2 rounded-lg border border-stone-200 px-2.5 py-1.5 font-sans text-xs text-stone-700 hover:bg-stone-100 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                        >
                          {suggestion.actionLabel}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className={`rounded-3xl border px-5 py-5 ${isDark ? 'border-slate-600/50 bg-slate-800/70' : 'border-stone-200/80 bg-white/90'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100">Must-do lane</h2>
                    <p className="mt-1 font-sans text-sm text-stone-500 dark:text-stone-400">Keep today narrow: one main task, two support moves, and one optional easy win.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenDailyPlanRitual}
                    className="rounded-xl border border-moss-300 px-3 py-2 font-sans text-sm text-moss-700 hover:bg-moss-50 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-moss-700 dark:text-moss-300 dark:hover:bg-moss-900/30"
                  >
                    Plan today
                  </button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
                  <div className={`rounded-2xl border px-4 py-4 ${isDark ? 'border-moss-700/40 bg-moss-900/20' : 'border-moss-200 bg-moss-50/80'}`}>
                    <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-moss-700 dark:text-moss-300">Primary</p>
                    {todayMustDoLane.primary ? (
                      <>
                        <p className="mt-2 font-sans text-base font-semibold text-stone-900 dark:text-stone-100">{todayMustDoLane.primary.title}</p>
                        <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">{todayMustDoLane.primary.detail}</p>
                        <button
                          type="button"
                          onClick={todayMustDoLane.primary.onClick}
                          className="mt-3 rounded-xl bg-moss-600 px-3 py-2 font-sans text-sm font-medium text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                        >
                          {todayMustDoLane.primary.ctaLabel ?? 'Start first task'}
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="mt-2 font-sans text-base font-semibold text-stone-900 dark:text-stone-100">No first task picked yet</p>
                        <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">Use Plan today or AI rebuild to narrow the day to one clear starting point.</p>
                      </>
                    )}
                  </div>

                  {todayMustDoLane.support.map((item, index) => (
                    <div key={`${item.title}-${index}`} className={`rounded-2xl border px-4 py-4 ${isDark ? 'border-slate-600/50 bg-slate-900/30' : 'border-stone-200 bg-stone-50/80'}`}>
                      <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Support {index + 1}</p>
                      <p className="mt-2 font-sans text-base font-semibold text-stone-900 dark:text-stone-100">{item.title}</p>
                      <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">{item.detail}</p>
                    </div>
                  ))}

                  <div className={`rounded-2xl border px-4 py-4 ${isDark ? 'border-slate-600/50 bg-slate-900/30' : 'border-stone-200 bg-stone-50/80'}`}>
                    <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Quick win</p>
                    {todayMustDoLane.quickWin ? (
                      <>
                        <p className="mt-2 font-sans text-base font-semibold text-stone-900 dark:text-stone-100">{todayMustDoLane.quickWin.title}</p>
                        <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">{todayMustDoLane.quickWin.detail}</p>
                        <button
                          type="button"
                          onClick={todayMustDoLane.quickWin.onClick}
                          className="mt-3 rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm font-medium text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                        >
                          Start in 5 min
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="mt-2 font-sans text-base font-semibold text-stone-900 dark:text-stone-100">No quick win needed</p>
                        <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">Leave this empty unless you need an easy restart later.</p>
                      </>
                    )}
                  </div>
                </div>
              </section>
                </div>
                </div>
              </>
              )}

              <section className={`rounded-3xl border px-5 py-5 ${isDark ? 'border-slate-600/50 bg-slate-800/70' : 'border-stone-200/80 bg-white/90'}`}>
                <div>
                  <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100">Day map</h2>
                  <p className="mt-1 font-sans text-sm text-stone-500 dark:text-stone-400">{todayPathSummary.follow}</p>
                </div>

                <TourHighlight step={3} tooltip="This is the full day map. Use it after the briefing, not before.">
                  <div
                    id="tour-timeline"
                    className="mt-4 overflow-y-auto max-h-[78vh] rounded-2xl border border-stone-200/80 bg-white/85 p-4 shadow-sm dark:border-slate-600/50 dark:bg-slate-900/35"
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
                        primaryWeekPlanning={planningEntry.primaryWeekPlanning}
                      />
                    </ScheduleErrorBoundary>
                  </div>
                </TourHighlight>
              </section>

              {showTodaySupportSheet && todayRecoveryItems.length > 0 && (
                <section className={`rounded-3xl border px-5 py-5 ${
                  isDark ? 'border-amber-800/60 bg-amber-900/15' : 'border-amber-200 bg-amber-50/80'
                }`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100">Recovery and risks</h2>
                      <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">Only what needs attention right now.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openModal('chat')}
                      className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                    >
                      Ask assistant
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {todayRecoveryItems.map((item) => (
                      <div
                        key={item.key}
                        className={`rounded-2xl border px-4 py-4 ${
                          item.tone === 'amber'
                            ? isDark
                              ? 'border-amber-700/60 bg-amber-900/20'
                              : 'border-amber-200 bg-white/80'
                            : isDark
                              ? 'border-slate-600/50 bg-slate-900/30'
                              : 'border-stone-200 bg-white/80'
                        }`}
                      >
                        <p className="font-sans text-base font-semibold text-stone-900 dark:text-stone-100">{item.title}</p>
                        <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">{item.body}</p>
                        <button
                          type="button"
                          onClick={item.onClick}
                          className={`mt-3 rounded-xl px-3 py-2 font-sans text-sm font-medium focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                            item.tone === 'amber'
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'border border-stone-200 text-stone-700 hover:bg-stone-100 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60'
                          }`}
                        >
                          {item.actionLabel}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {showTodaySupportSheet && (
              <section className={`rounded-3xl border px-5 py-4 ${isDark ? 'border-slate-600/50 bg-slate-800/55' : 'border-stone-200/80 bg-stone-50/90'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg text-stone-900 dark:text-stone-100">Progress today</h2>
                    <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">{todayProgressFooter.progressLine}</p>
                    <p className="mt-1 font-sans text-sm text-stone-500 dark:text-stone-400">{todayProgressFooter.supportLine}</p>
                    {todayProgressFooter.gardenLine && (
                      <p className="mt-2 font-sans text-xs text-moss-700 dark:text-moss-300">{todayProgressFooter.gardenLine}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openModal('insights')}
                      className="rounded-xl border border-stone-200 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                    >
                      Reflect
                    </button>
                    {lastGardenImpact?.text && (
                      <button
                        type="button"
                        onClick={clearLastGardenImpact}
                        className="rounded-xl px-3 py-2 font-sans text-sm text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:text-stone-400 dark:hover:text-stone-200"
                      >
                        Dismiss garden note
                      </button>
                    )}
                  </div>
                </div>
              </section>
              )}
            </div>}
          </>
        )}
        {activeTab === 'planner' && (
          <PremiumPlannerShell id="guide-planner-overview" className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-4">
            <div className={`rounded-[30px] border px-4 py-4 shadow-[0_20px_60px_-34px_rgba(15,23,42,0.35)] ${
              isDark
                ? 'border-slate-700/60 bg-gradient-to-br from-slate-900/88 via-slate-900/76 to-slate-800/72'
                : 'border-stone-200/80 bg-gradient-to-br from-white via-stone-50/92 to-stone-100/75'
            }`}>
              <p className="premium-kicker mb-2">Planner studio</p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-2xl font-semibold text-stone-900 dark:text-stone-100">{plannerViewMeta.title}</h2>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  isDark ? 'bg-slate-800/90 text-stone-300 ring-1 ring-slate-700/80' : 'bg-white/80 text-stone-500 ring-1 ring-stone-200/90'
                }`}>
                  {plannerViewMode}
                </span>
              </div>
              <p className="font-sans text-sm text-stone-500 dark:text-stone-400" title="Unscheduled → Assign to a day → Open Day Planner">
                {plannerViewMeta.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlannerSupportDrawer('review')}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                    plannerSupportDrawer === 'review'
                      ? 'border-moss-500 bg-moss-600 text-white shadow-sm hover:bg-moss-700 dark:border-moss-500 dark:bg-moss-500 dark:text-slate-950 dark:hover:bg-moss-400'
                      : 'border-stone-200 bg-white/75 text-stone-700 hover:bg-white dark:border-slate-600 dark:bg-slate-800/70 dark:text-stone-200 dark:hover:bg-slate-700/70'
                  }`}
                >
                  <span>Review</span>
                  <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] ${
                    plannerSupportDrawer === 'review'
                      ? 'bg-white/20 text-current dark:bg-slate-950/20'
                      : 'bg-stone-100 text-stone-600 dark:bg-slate-700 dark:text-stone-100'
                  }`}>
                    {plannerReviewCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlannerSupportDrawer('projects')}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                    plannerSupportDrawer === 'projects'
                      ? 'border-moss-500 bg-moss-600 text-white shadow-sm hover:bg-moss-700 dark:border-moss-500 dark:bg-moss-500 dark:text-slate-950 dark:hover:bg-moss-400'
                      : 'border-stone-200 bg-white/75 text-stone-700 hover:bg-white dark:border-slate-600 dark:bg-slate-800/70 dark:text-stone-200 dark:hover:bg-slate-700/70'
                  }`}
                >
                  <span>Projects</span>
                  <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] ${
                    plannerSupportDrawer === 'projects'
                      ? 'bg-white/20 text-current dark:bg-slate-950/20'
                      : 'bg-stone-100 text-stone-600 dark:bg-slate-700 dark:text-stone-100'
                  }`}>
                    {activeProjectCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlannerSystemsMode('overview');
                    setPlannerSupportDrawer('systems');
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                    plannerSupportDrawer === 'systems'
                      ? 'border-moss-500 bg-moss-600 text-white shadow-sm hover:bg-moss-700 dark:border-moss-500 dark:bg-moss-500 dark:text-slate-950 dark:hover:bg-moss-400'
                      : 'border-stone-200 bg-white/75 text-stone-700 hover:bg-white dark:border-slate-600 dark:bg-slate-800/70 dark:text-stone-200 dark:hover:bg-slate-700/70'
                  }`}
                >
                  <span>Systems</span>
                  <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] ${
                    plannerSupportDrawer === 'systems'
                      ? 'bg-white/20 text-current dark:bg-slate-950/20'
                      : 'bg-stone-100 text-stone-600 dark:bg-slate-700 dark:text-stone-100'
                  }`}>
                    {plannerSystemsCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlannerSupportDrawer('manage')}
                  className={`ml-auto inline-flex items-center rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                    plannerSupportDrawer === 'manage'
                      ? 'border-stone-900 bg-stone-900 text-white shadow-sm hover:bg-stone-800 dark:border-stone-100 dark:bg-stone-100 dark:text-slate-950 dark:hover:bg-stone-200'
                      : 'border-stone-200 bg-white/75 text-stone-700 hover:bg-white dark:border-slate-600 dark:bg-slate-800/70 dark:text-stone-200 dark:hover:bg-slate-700/70'
                  }`}
                >
                  Manage
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  ['review', 'Review'],
                  ['projects', 'Projects'],
                  ['systems', 'Systems'],
                ].map(([key, label]) => {
                  const active = plannerSupportDrawer === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === 'systems') setPlannerSystemsMode('overview');
                        setPlannerSupportDrawer(key);
                      }}
                      className={`rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-moss-500/30 ${
                        active
                          ? 'border-moss-400 bg-moss-50/90 text-moss-900 dark:border-moss-500/80 dark:bg-moss-500/10 dark:text-moss-100'
                          : 'border-stone-200/90 bg-white/70 text-stone-600 hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/35 dark:text-stone-300 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em]">{label}</p>
                      <p className={`mt-1 font-sans text-xs leading-relaxed ${active ? 'text-current' : 'text-stone-500 dark:text-stone-400'}`}>
                        {PLANNER_SUPPORT_EXPLAINERS[key]}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Projects card: secondary link to cockpit (primary cockpit CTA is header "Open planner") */}
            {plannerShowSecondary && (
            <div className="rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50/50 dark:bg-stone-800/50 p-3 px-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-sans text-sm font-medium text-stone-800 dark:text-stone-200">Projects</p>
                  <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-0.5">Break a project into steps, milestones, and deadlines.</p>
                </div>
                <span className="shrink-0 font-sans text-xs text-stone-500 dark:text-stone-400">
                  Use Project Planner for decomposition.
                </span>
              </div>
            </div>

            )}
            {/* Day | Week | Month planning lens — Week default */}
            <PremiumActionRow className="mb-4">
              <div className={`inline-flex rounded-full border p-1 ${
                isDark ? 'border-slate-700/80 bg-slate-950/55' : 'border-stone-200/90 bg-white/80'
              }`}>
                {['day', 'week', 'month'].map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPlannerViewMode(id)}
                    className={`px-3.5 py-1.5 rounded-full font-sans text-sm transition-colors capitalize ${
                      plannerViewMode === id
                        ? 'bg-stone-900 text-white shadow-sm font-medium dark:bg-stone-100 dark:text-slate-950'
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
                <button
                  type="button"
                  onClick={handleSuggestTodayPlan}
                  disabled={plannerActionBusy === 'day'}
                  className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-sans text-sm font-semibold bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 transition-colors"
                >
                  {plannerViewMeta.primaryActionLabel}
                </button>
              )}
              {plannerViewMode === 'week' && (
                <button
                  type="button"
                  onClick={handleAutoPlanWeek}
                  disabled={autoFillLoading || plannerActionBusy === 'week'}
                  className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-sans text-sm font-semibold bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 transition-colors"
                >
                  {plannerViewMeta.primaryActionLabel}
                </button>
              )}
              {plannerViewMode === 'month' && (
                <button
                  type="button"
                  onClick={handleShapeMonthWithAI}
                  disabled={isGeneratingMonthPlan || plannerActionBusy === 'month'}
                  className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-sans text-sm font-semibold bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2 transition-colors"
                  title="Advanced: distribute tasks across the month with AI"
                >
                  {plannerViewMeta.primaryActionLabel}
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
            {plannerShowSecondary && plannerViewMode === 'week' && (
            <div className="rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800/50 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium text-stone-800 dark:text-stone-200">Week capacity</p>
                  <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">
                    Available {weekCapacity.availableHours.toFixed(1)}h · Planned {weekCapacity.plannedHours.toFixed(1)}h · Remaining {weekCapacity.remainingHours.toFixed(1)}h
                  </p>
                  {weekCapacity.overload && (
                    <p className="mt-1 font-sans text-xs text-amber-600 dark:text-amber-400">Week is overplanned</p>
                  )}
                  {(learnedFocusRecommendation?.explanation || learnedAdminRecommendation?.explanation || learnedEnergyProfile?.overloadWeekday?.explanation) && (
                    <div className="mt-2 space-y-1">
                      {learnedFocusRecommendation?.explanation && (
                        <p className="font-sans text-xs text-moss-700 dark:text-moss-300">{learnedFocusRecommendation.explanation}</p>
                      )}
                      {learnedAdminRecommendation?.explanation && (
                        <p className="font-sans text-xs text-stone-500 dark:text-stone-400">{learnedAdminRecommendation.explanation}</p>
                      )}
                      {learnedEnergyProfile?.overloadWeekday?.explanation && (
                        <p className="font-sans text-xs text-amber-600 dark:text-amber-400">{learnedEnergyProfile.overloadWeekday.explanation}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="min-w-[220px] flex-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-stone-800/70 px-3 py-2">
                  <p className="font-sans text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">Billable mix</p>
                  <p className="mt-1 font-sans text-sm text-stone-800 dark:text-stone-200">
                    {weekCapacity.billablePlanned.toFixed(1)}h billable
                  </p>
                  <p className="font-sans text-xs text-stone-500 dark:text-stone-400">
                    {weekCapacity.nonBillablePlanned.toFixed(1)}h non-billable planned
                  </p>
                </div>
              </div>
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
              <Suspense fallback={<LoadingSurface label="Loading day planner..." />}>
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
                  onPlanTodayRitual={handleOpenDailyPlanRitual}
                />
              </Suspense>
            )}

            {plannerViewMode === 'month' && (
              <Suspense fallback={<LoadingSurface label="Loading month planner..." />}>
                <PlanMonthPanel
                  unscheduledMonthTasks={unscheduledMonthTasks}
                  setStagingTaskStatus={setStagingTaskStatus}
                  setPlannerViewMode={setPlannerViewMode}
                  vaultTasks={vaultTasks}
                  goals={goals}
                  routines={routines}
                  recurringSupportState={recurringSupportState}
                  routineSupportPlacements={routineSupportPlacements}
                  logs={logs}
                  weekAssignments={weekAssignments}
                  weeklyEvents={weeklyEvents}
                  loadDayPlan={loadDayPlan}
                  setPlannerPlanDayDateStr={setPlannerPlanDayDateStr}
                  onOpenPlannerSystems={() => {
                    setPlannerSystemsMode('overview');
                    setPlannerSupportDrawer('systems');
                  }}
                  monthlyRoadmap={monthlyRoadmap}
                  handlePlanMonth={handlePlanMonth}
                  isGeneratingMonthPlan={isGeneratingMonthPlan}
                />
              </Suspense>
            )}

            {/* Week lens: Today strip + Unscheduled + This week */}
            {plannerViewMode === 'week' && (
              <Suspense fallback={<LoadingSurface label="Loading week planner..." />}>
                <PlanWeekPanel
                  plannerTodayPlanItems={plannerTodayPlanItems}
                  today={today}
                  setPlannerPlanDayDateStr={setPlannerPlanDayDateStr}
                  goals={goals}
                  weeklyEvents={weeklyEvents}
                  routineSupportPlacements={routineSupportPlacements}
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
                  removeRoutineSupportPlacement={removeRoutineSupportPlacement}
                  isPlanningWeek={autoFillLoading || planningWeek || plannerActionBusy === 'week'}
                />
              </Suspense>
            )}
            </PremiumSection>

            <AnimatePresence>
              {plannerSupportDrawer && (
                <>
                  <motion.button
                    type="button"
                    aria-label="Close planner drawer"
                    className="fixed inset-0 z-[70] bg-stone-950/35 backdrop-blur-[3px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setPlannerSupportDrawer(null)}
                  />
                  <motion.aside
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className={`fixed inset-x-0 bottom-0 z-[71] max-h-[86vh] overflow-y-auto rounded-t-[30px] border shadow-[0_24px_80px_-28px_rgba(15,23,42,0.55)] md:inset-y-6 md:right-6 md:left-auto md:w-[min(34rem,calc(100vw-3rem))] md:rounded-[30px] ${
                      isDark
                        ? 'border-slate-600/50 bg-gradient-to-b from-slate-900/98 via-slate-900/96 to-slate-950/98'
                        : 'border-stone-200/80 bg-gradient-to-b from-white via-stone-50/96 to-stone-100/96'
                    }`}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Planner ${plannerSupportDrawer}`}
                  >
                    <div className={`sticky top-0 z-10 mb-4 border-b px-4 pb-4 pt-3 backdrop-blur-xl ${
                      isDark ? 'border-slate-700/70 bg-slate-950/75' : 'border-stone-200/80 bg-stone-50/88'
                    }`}>
                      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-300 dark:bg-slate-700 md:hidden" aria-hidden />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
                          {plannerSupportDrawer === 'review' ? 'Review' : plannerSupportDrawer === 'projects' ? 'Projects' : plannerSupportDrawer === 'manage' ? 'Manage' : plannerSystemsMode === 'routines' ? 'Routine manager' : 'Systems'}
                          </p>
                          <h3 className="mt-1 font-serif text-lg text-stone-900 dark:text-stone-100">
                            {plannerSupportDrawer === 'review' ? 'Check load and timing' : plannerSupportDrawer === 'projects' ? 'Inspect project structure' : plannerSupportDrawer === 'manage' ? 'Manage goals and routines' : plannerSystemsMode === 'routines' ? 'Manage routines' : 'Support this week'}
                          </h3>
                          <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">
                            {plannerSupportDrawer === 'review'
                              ? 'Review load, confidence, deadlines, and weekly risk without crowding the planner canvas.'
                              : plannerSupportDrawer === 'projects'
                                ? 'Open project structure only when you want milestones, decomposition, or deeper context.'
                                : plannerSupportDrawer === 'manage'
                                  ? 'Edit, archive, restore, or permanently remove items without leaving the planner.'
                                : plannerSystemsMode === 'routines'
                                  ? 'Edit titles, categories, and recurring settings here, then return to Systems when you want the lighter weekly support view.'
                                  : 'Place one support at a time, and only adjust what would make this week easier to hold.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPlannerSupportDrawer(null)}
                          className="rounded-full border border-stone-200 px-3 py-1.5 font-sans text-xs text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-800/70"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {plannerSupportDrawer === 'review' && (
                      <div className="space-y-4 px-4 pb-4">
                        <div className="rounded-[24px] border border-stone-200/80 dark:border-stone-700/80 bg-white/80 dark:bg-stone-800/72 px-4 py-3 shadow-sm">
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
                            <p className="mt-1.5 font-sans text-xs text-stone-500 dark:text-stone-400">
                              By task: {plannedHoursSummary.byGoal.slice(0, 6).map((g) => `${g.title} ${Math.round((g.minutes / 60) * 10) / 10}h`).join(' · ')}
                            </p>
                          )}
                        </div>

                        {plannerViewMode === 'week' && (
                          <div className="rounded-[24px] border border-stone-200/80 dark:border-stone-700/80 bg-white/80 dark:bg-stone-800/72 px-4 py-3 shadow-sm">
                            <p className="font-sans text-sm font-medium text-stone-800 dark:text-stone-200">Week capacity</p>
                            <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">
                              Available {weekCapacity.availableHours.toFixed(1)}h · Planned {weekCapacity.plannedHours.toFixed(1)}h · Remaining {weekCapacity.remainingHours.toFixed(1)}h
                            </p>
                            {weekCapacity.overload && (
                              <p className="mt-1 font-sans text-xs text-amber-600 dark:text-amber-400">Week is overplanned</p>
                            )}
                          </div>
                        )}

                        <div className="rounded-[24px] border border-stone-200/80 dark:border-stone-700/80 bg-white/80 dark:bg-stone-800/72 px-4 py-3 shadow-sm">
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
                          <div className="flex flex-wrap gap-2">
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
                        </div>

                        {plannerUpcomingDeadlines.length > 0 && (
                          <div className="rounded-[24px] border border-stone-200/80 dark:border-stone-700/80 bg-white/80 dark:bg-stone-800/72 px-4 py-3 shadow-sm">
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

                    {plannerSupportDrawer === 'projects' && (
                      <div className="space-y-4 px-4 pb-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => { setPlannerSupportDrawer(null); setShowProjectPlanner(true); }}
                            className="rounded-lg bg-moss-600 px-3 py-2 font-sans text-sm font-medium text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                          >
                            Open project planner
                          </button>
                        </div>
                        <div className="overflow-hidden rounded-[24px] border border-stone-200/80 dark:border-slate-600/80 bg-white/82 dark:bg-slate-800/78 shadow-sm">
                          <div className="border-t-0 p-4">
                            <Suspense fallback={<LoadingSurface label="Loading project map..." />}>
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
                                    setPlannerSupportDrawer(null);
                                  }
                                }}
                              />
                            </Suspense>
                          </div>
                        </div>
                      </div>
                    )}

                    {plannerSupportDrawer === 'manage' && (
                      <div className="space-y-4 px-4 pb-4">
                        <Suspense fallback={<LoadingSurface label="Loading management hub..." />}>
                          <PlannerManageHub
                            onClose={() => setPlannerSupportDrawer(null)}
                            onEditGoal={(goal) => {
                              setEditingGoal(goal);
                              setPlannerSupportDrawer(null);
                            }}
                            onEditRoutines={() => {
                              setPlannerSystemsMode('routines');
                              setPlannerSupportDrawer('systems');
                            }}
                          />
                        </Suspense>
                      </div>
                    )}

                    {plannerSupportDrawer === 'systems' && (
                      <div className="space-y-4 px-4 pb-4">
                        <div className="overflow-hidden rounded-[24px] border border-stone-200/80 dark:border-slate-600/80 bg-white/82 dark:bg-slate-800/78 shadow-sm">
                          {plannerSystemsMode === 'overview' ? (
                            <div className="p-4">
                              <PlannerRoutineSupportList onManageRoutines={() => setPlannerSystemsMode('routines')} />
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 dark:border-slate-600">
                                <div>
                                  <p className="font-sans text-sm font-semibold text-stone-800 dark:text-stone-200">Manage routines</p>
                                  <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">
                                    Edit recurring titles, categories, and durations here, then return when you want the lighter weekly support view.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setPlannerSystemsMode('overview')}
                                  className="rounded-lg border border-stone-300 px-3 py-1.5 font-sans text-xs font-medium text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/70"
                                >
                                  Back to support view
                                </button>
                              </div>
                              <div className="p-4">
                                <Suspense fallback={<LoadingSurface label="Loading routine manager..." />}>
                                  <RoutinesManager />
                                </Suspense>
                              </div>
                            </>
                          )}
                        </div>

                        {routinePatternSuggestions.length > 0 && (
                          <div className="rounded-[24px] border border-stone-200/80 dark:border-slate-600/80 bg-white/82 dark:bg-slate-800/78 shadow-sm p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-sans text-sm font-semibold text-stone-800 dark:text-stone-200">Suggestions</p>
                                <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">Optional ideas when the current support pattern still feels too heavy.</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowPlannerRoutineSuggestions((prev) => !prev)}
                                className="rounded-lg border border-stone-300 px-3 py-1.5 font-sans text-xs font-medium text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/70"
                              >
                                {showPlannerRoutineSuggestions ? 'Hide suggestions' : `Show ${routinePatternSuggestions.length} suggestions`}
                              </button>
                            </div>
                            {showPlannerRoutineSuggestions && routinePatternSuggestions.map((suggestion) => (
                              <div key={`drawer-${suggestion.id}`} className="mt-3 rounded-lg border border-stone-200 dark:border-slate-700 px-3 py-2">
                                <p className="font-sans text-sm text-stone-800 dark:text-stone-200">{suggestion.title}</p>
                                <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">{suggestion.body}</p>
                                <button
                                  type="button"
                                  onClick={() => handleAssistantOperatorAction('ADD_ROUTINE_STRUCTURE', { suggestion })}
                                  className="mt-2 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-sans text-stone-700 hover:bg-stone-100 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/60"
                                >
                                  {suggestion.actionLabel}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="rounded-[24px] border border-stone-200/80 dark:border-slate-600/80 bg-white/82 dark:bg-slate-800/78 shadow-sm p-4 space-y-3">
                          <p className="font-sans text-sm font-semibold text-stone-800 dark:text-stone-200">Support blocks</p>
                          <p className="font-sans text-xs text-stone-500 dark:text-stone-400">Use these for recurring admin, reset, or recovery support without filling the main planner canvas.</p>
                          <div className="flex flex-wrap gap-2">
                            {MAINTENANCE_BLOCK_TEMPLATES.slice(0, 4).map((template) => (
                              <button
                                key={template.id}
                                type="button"
                                onClick={() => {
                                  addMaintenanceBlock?.({ templateId: template.id, ...template });
                                  pushReward?.({ message: `${template.title} added.`, tone: 'moss', icon: '🧩', durationMs: 1800 });
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-sans border border-stone-300 dark:border-slate-600 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-700/60"
                              >
                                Add {template.title}
                              </button>
                            ))}
                          </div>
                          {maintenanceBlocks.length > 0 ? (
                            <ul className="space-y-2">
                              {maintenanceBlocks.slice(0, 6).map((block) => (
                                <li key={block.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 dark:border-slate-700 px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="font-sans text-sm text-stone-800 dark:text-stone-200 truncate">{block.title}</p>
                                    <p className="font-sans text-xs text-stone-500 dark:text-stone-400">
                                      {block.durationMinutes}m / {block.flexibility}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => deleteMaintenanceBlock?.(block.id)}
                                    className="text-xs font-sans text-stone-500 hover:text-rose-600"
                                  >
                                    Remove
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="font-sans text-xs text-stone-500 dark:text-stone-400">No support blocks yet.</p>
                          )}
                        </div>

                        <div className="rounded-[24px] border border-stone-200/80 dark:border-slate-600/80 bg-white/82 dark:bg-slate-800/78 shadow-sm p-4 space-y-3">
                          <p className="font-sans text-sm font-semibold text-stone-800 dark:text-stone-200">Support areas</p>
                          <p className="font-sans text-xs text-stone-500 dark:text-stone-400">Add light support around the parts of life that need steadier attention.</p>
                          <div className="flex flex-wrap gap-2">
                            {LIFE_DOMAIN_TEMPLATES.slice(0, 4).map((template) => (
                              <button
                                key={template.id}
                                type="button"
                                onClick={() => {
                                  const domain = addLifeDomain?.({ templateId: template.id, title: template.title, supportGoal: `Support ${template.title.toLowerCase()}` });
                                  const support = buildDomainSupportPlan(domain ?? { templateId: template.id, title: template.title });
                                  support.maintenanceTemplates.slice(0, 1).forEach((mt) => addMaintenanceBlock?.({ templateId: mt.id, ...mt }));
                                  pushReward?.({ message: `${template.title} support added.`, tone: 'moss', icon: '🧭', durationMs: 1800 });
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-sans border border-stone-300 dark:border-slate-600 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-700/60"
                              >
                                Add support for {template.title}
                              </button>
                            ))}
                          </div>
                          {lifeDomainCards.length > 0 ? (
                            <ul className="space-y-2">
                              {lifeDomainCards.slice(0, 6).map(({ domain, health }) => (
                                <li key={domain.id} className="rounded-lg border border-stone-200 dark:border-slate-700 px-3 py-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-sans text-sm text-stone-800 dark:text-stone-200">{domain.title}</p>
                                    <span className={`text-[11px] font-sans px-2 py-0.5 rounded-full ${health.tone === 'moss' ? 'bg-moss-100 text-moss-800' : health.tone === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-700'}`}>
                                      {health.label}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="font-sans text-xs text-stone-500 dark:text-stone-400">No support areas yet.</p>
                          )}
                        </div>

                        <div className="rounded-[24px] border border-stone-200/80 dark:border-slate-600/80 bg-white/82 dark:bg-slate-800/78 shadow-sm p-4 space-y-3">
                          <p className="font-sans text-sm font-semibold text-stone-800 dark:text-stone-200">Keep steady</p>
                          <p className="font-sans text-xs text-stone-500 dark:text-stone-400">Keep recovery, recurring care, and protected time visible while you plan the week.</p>
                          <div className={`rounded-lg border px-3 py-2 ${protectedTimeSignals.creepRisk ? 'border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-900/20' : 'border-stone-200 bg-stone-50/50 dark:border-slate-700 dark:bg-slate-800/50'}`}>
                            <p className="font-sans text-sm text-stone-800 dark:text-stone-200">{protectedTimeSignals.message}</p>
                          </div>
                        </div>

                      </div>
                    )}
                  </motion.aside>
                </>
              )}
            </AnimatePresence>

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
                      <Suspense fallback={<LoadingSurface label="Loading project map..." />}>
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
                      </Suspense>
                    </div>
                  )}
                </section>

                {plannerShowSecondary && routinePatternSuggestions.length > 0 && (
                  <section className="rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 shadow-sm mb-6 overflow-hidden">
                    <div className="px-4 py-3 border-b border-stone-200 dark:border-slate-600">
                      <p className="font-sans text-sm font-semibold text-stone-800 dark:text-stone-200">Planner support suggestions</p>
                      <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">Calm structure suggestions based on repeated friction.</p>
                    </div>
                    <div className="p-4 space-y-3">
                      {routinePatternSuggestions.map((suggestion) => (
                        <div key={`planner-${suggestion.id}`} className="rounded-lg border border-stone-200 dark:border-slate-700 px-3 py-2">
                          <p className="font-sans text-sm text-stone-800 dark:text-stone-200">{suggestion.title}</p>
                          <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">{suggestion.body}</p>
                          <button
                            type="button"
                            onClick={() => handleAssistantOperatorAction('ADD_ROUTINE_STRUCTURE', { suggestion })}
                            className="mt-2 text-xs font-sans text-moss-700 hover:text-moss-800 dark:text-moss-300"
                          >
                            {suggestion.actionLabel}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 shadow-sm mb-6 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPlannerMaintenanceOpen((o) => !o)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left font-sans text-sm font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                    aria-expanded={plannerMaintenanceOpen}
                  >
                    <span>Maintenance blocks</span>
                    <span className="text-stone-400 shrink-0" aria-hidden>{plannerMaintenanceOpen ? '▼' : '▶'}</span>
                  </button>
                  {plannerMaintenanceOpen && (
                    <div className="border-t border-stone-200 dark:border-slate-600 p-4">
                      <p className="font-sans text-xs text-stone-500 dark:text-stone-400 mb-2">
                        Recurring support blocks are flexible upkeep time. Skips can be rescheduled later.
                      </p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {MAINTENANCE_BLOCK_TEMPLATES.slice(0, 4).map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => {
                              addMaintenanceBlock?.({ templateId: template.id, ...template });
                              pushReward?.({ message: `${template.title} added.`, tone: 'moss', icon: '🧩', durationMs: 1800 });
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-sans border border-stone-300 dark:border-slate-600 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-700/60"
                          >
                            + {template.title}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const title = window.prompt('Name this maintenance block', 'Maintenance block');
                            if (!title || !title.trim()) return;
                            addMaintenanceBlock?.({ title: title.trim(), category: 'Custom', durationMinutes: 45, preferredDays: [2], preferredTimeBand: 'early_afternoon', flexibility: 'flexible', importance: 'medium' });
                            pushReward?.({ message: 'Custom maintenance block added.', tone: 'moss', icon: '🧩', durationMs: 1800 });
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-sans border border-dashed border-stone-300 dark:border-slate-600 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-700/60"
                        >
                          + Custom block
                        </button>
                      </div>
                      {maintenanceBlocks.length > 0 ? (
                        <ul className="space-y-2">
                          {maintenanceBlocks.slice(0, 6).map((block) => (
                            <li key={block.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 dark:border-slate-700 px-3 py-2">
                              <div className="min-w-0">
                                <p className="font-sans text-sm text-stone-800 dark:text-stone-200 truncate">{block.title}</p>
                                <p className="font-sans text-xs text-stone-500 dark:text-stone-400">
                                  {block.durationMinutes}m / {block.flexibility} / {block.preferredTimeBand?.replace('_', ' ')}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteMaintenanceBlock?.(block.id)}
                                className="text-xs font-sans text-stone-500 hover:text-rose-600"
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="font-sans text-xs text-stone-500 dark:text-stone-400">No maintenance blocks yet.</p>
                      )}
                    </div>
                  )}
                </section>

                <section id="planner-life-domains" className="rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 shadow-sm mb-6 overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-200 dark:border-slate-600">
                    <p className="font-sans text-sm font-semibold text-stone-800 dark:text-stone-200">Life domains</p>
                    <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">Support areas, not projects. Keep structure light and steady.</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {LIFE_DOMAIN_TEMPLATES.slice(0, 6).map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => {
                            const domain = addLifeDomain?.({ templateId: template.id, title: template.title, supportGoal: `Support ${template.title.toLowerCase()}` });
                            const support = buildDomainSupportPlan(domain ?? { templateId: template.id, title: template.title });
                            support.maintenanceTemplates.slice(0, 2).forEach((mt) => addMaintenanceBlock?.({ templateId: mt.id, ...mt }));
                            pushReward?.({ message: `${template.title} support added.`, tone: 'moss', icon: '🧭', durationMs: 1800 });
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-sans border border-stone-300 dark:border-slate-600 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-700/60"
                        >
                          + {template.title}
                        </button>
                      ))}
                    </div>
                    {lifeDomainCards.length > 0 ? (
                      <ul className="space-y-2">
                        {lifeDomainCards.slice(0, 8).map(({ domain, support, health }) => (
                          <li key={domain.id} className="rounded-lg border border-stone-200 dark:border-slate-700 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-sans text-sm text-stone-800 dark:text-stone-200">{domain.title}</p>
                              <span className={`text-[11px] font-sans px-2 py-0.5 rounded-full ${health.tone === 'moss' ? 'bg-moss-100 text-moss-800' : health.tone === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-700'}`}>
                                {health.label}
                              </span>
                            </div>
                            <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">
                              {(support.maintenanceTemplates || []).slice(0, 2).map((t) => t.title).join(' · ') || 'No structure yet'}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  (support.maintenanceTemplates || []).slice(0, 1).forEach((mt) => addMaintenanceBlock?.({ templateId: mt.id, ...mt }));
                                  pushReward?.({ message: 'Added one support block.', tone: 'moss', icon: '🧩', durationMs: 1600 });
                                }}
                                className="text-xs font-sans text-moss-700 hover:text-moss-800 dark:text-moss-300"
                              >
                                Add support block
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteLifeDomain?.(domain.id)}
                                className="text-xs font-sans text-stone-500 hover:text-stone-700"
                              >
                                Remove domain
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="font-sans text-xs text-stone-500 dark:text-stone-400">No life domains yet. Add one template to create lightweight support structure.</p>
                    )}
                  </div>
                </section>

                <section id="planner-protected-time" className="rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 shadow-sm mb-6 overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-200 dark:border-slate-600">
                    <p className="font-sans text-sm font-semibold text-stone-800 dark:text-stone-200">Protected time</p>
                    <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">Defend recovery, social, decompression, and transition blocks.</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className={`rounded-lg border px-3 py-2 ${protectedTimeSignals.creepRisk ? 'border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-900/20' : 'border-stone-200 bg-stone-50/50 dark:border-slate-700 dark:bg-slate-800/50'}`}>
                      <p className="font-sans text-sm text-stone-800 dark:text-stone-200">{protectedTimeSignals.message}</p>
                      {protectedTimeSignals.creepRisk && (
                        <p className="mt-1 font-sans text-xs text-stone-600 dark:text-stone-300">Tradeoff: keep one protected block and shorten tomorrow&apos;s admin/work block instead.</p>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {(maintenanceBlocks || []).slice(0, 8).map((block) => (
                        <li key={block.id} className="rounded-lg border border-stone-200 dark:border-slate-700 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-sans text-sm text-stone-800 dark:text-stone-200">{block.title}</p>
                            <span className="font-sans text-[11px] text-stone-500 dark:text-stone-400">{block.protectionStrength ?? 'normal'}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {['soft', 'normal', 'strong'].map((strength) => (
                              <button
                                key={`${block.id}-${strength}`}
                                type="button"
                                onClick={() => updateMaintenanceBlock?.(block.id, { protectionStrength: strength })}
                                className={`px-2 py-1 rounded text-xs font-sans border ${block.protectionStrength === strength ? 'border-moss-500 text-moss-700 bg-moss-50' : 'border-stone-200 text-stone-600 dark:border-slate-600 dark:text-stone-300'}`}
                              >
                                {strength}
                              </button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
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
                      <Suspense fallback={<LoadingSurface label="Loading routine manager..." />}>
                        <RoutinesManager />
                      </Suspense>
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
              dayCapacityHours={Math.max(1, (hourFromTimeStr(userSettings?.dayEnd, 22) - hourFromTimeStr(userSettings?.dayStart, 8)))}
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

      {/* Floating glassmorphic bottom nav: Today / Plan / Garden */}
      <nav
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-stone-900/80 backdrop-blur-md px-4 sm:px-6 py-3 rounded-full flex gap-4 sm:gap-8 shadow-2xl border border-white/10 safe-area-pb"
        aria-label="Main navigation"
      >
        <button
          type="button"
          onClick={() => setActiveTab('today')}
          className={`flex items-center gap-2 min-w-[44px] min-h-[44px] justify-center rounded-full px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 ${activeTab === 'today' ? 'bg-white/20 text-amber-300' : 'text-stone-400 hover:text-stone-200'}`}
          aria-current={activeTab === 'today' ? 'page' : undefined}
          aria-label="Today"
        >
          <span className="text-2xl sm:text-xl" aria-hidden>⚡</span>
          <span className="hidden sm:inline text-sm font-medium">Today</span>
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
        onOpenSpiritBuilder={() => { setCommandPaletteOpen(false); openModal('mirror'); }}
        onCapture={handleCaptureFromPalette}
        onOpenOmniAdd={(text) => {
          setCommandPaletteOpen(false);
          requestOmniAddOpen(text);
        }}
      />

      {activeTab !== 'settings' && (
      <div id="guide-omni-add" className="relative">
        <TourHighlight step={2} tooltip="Great. Now add one tiny micro-habit to your list.">
        <OmniAdd
          onOpenGoalCreator={(title) => {
            setGoalCreatorInitialTitle(title ?? '');
            setGoalCreatorInitialSubtasks([]);
            setIsPlanting(true);
          }}
          onOpenScheduleEvent={(title) => {
            setScheduleEventPrefill(title ? { title } : null);
            if (!title) {
              setScheduleEventLocation('');
              setScheduleEventParticipants('');
              setScheduleEventSourceText('');
            }
            setShowScheduleEventModal(true);
          }}
          onOpenBrainDump={() => openModal('compost')}
          onParsedRoute={handleOmniAddParsedRoute}
          requestOpenSignal={omniAddRequestOpenSignal}
          prefillText={omniAddPrefillText}
          showFloatingTrigger={false}
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
              <Suspense fallback={<LoadingSurface label="Opening spirit studio..." fullscreen />}>
                <SpiritBuilder
                  mode="edit"
                  initialConfig={spiritConfig}
                  onComplete={() => closeModal('mirror')}
                />
              </Suspense>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isPlanting && (
        <Suspense fallback={<LoadingSurface label="Opening seed creator..." fullscreen />}>
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
          />
        </Suspense>
      )}

      {showProjectPlanner && (
        <Suspense fallback={<LoadingSurface label="Opening project planner..." fullscreen />}>
          <ProjectPlanner
            open={showProjectPlanner}
            onClose={() => {
              setShowProjectPlanner(false);
              setProjectPlannerPrefill({ prefillTitle: '', prefillParentGoalId: '' });
              setProjectPlannerImportedPlan(null);
              setProjectPlannerFocusGoalId(null);
            }}
            onCreateGoals={handleProjectGoals}
            prefillTitle={projectPlannerPrefill.prefillTitle}
            prefillParentGoalId={projectPlannerPrefill.prefillParentGoalId}
            prefillPlan={projectPlannerImportedPlan?.plan ?? null}
            prefillDescription={projectPlannerImportedPlan?.description ?? ''}
            prefillDeadline={projectPlannerImportedPlan?.deadline ?? ''}
            focusGoalId={projectPlannerFocusGoalId}
            onStartFocus={(payload) => { runStartFocus(payload); setShowProjectPlanner(false); }}
            onReschedule={() => { setActiveTab('planner'); setShowProjectPlanner(false); }}
            onViewTodayPlan={() => { setActiveTab('today'); setShowProjectPlanner(false); }}
            onEditGoal={(goal) => { setEditingGoal(goal); setShowProjectPlanner(false); }}
          />
        </Suspense>
      )}

      {showStartNowModal && (
        <Suspense fallback={<LoadingSurface label="Opening next-step assist..." fullscreen />}>
          <StartNowModal
            open={showStartNowModal}
            mode={startNowCandidate?.goal ? 'hasTasks' : 'noTasks'}
            candidateTask={startNowCandidate}
            onStart={handleStartNowStart}
            onPickDifferent={handleStartNowPickDifferent}
            onCreateSuggestion={handleStartNowCreateSuggestion}
            onClose={() => { setShowStartNowModal(false); setStartNowCandidate(null); }}
          />
        </Suspense>
      )}

      {showGentleRestart && (
        <Suspense fallback={<LoadingSurface label="Opening restart support..." fullscreen />}>
          <GentleRestartModal
            open={showGentleRestart}
            onFreshStart={handleGentleRestartFreshStart}
            onReviewCompost={handleGentleRestartReviewCompost}
            onDismiss={handleGentleRestartDismiss}
          />
        </Suspense>
      )}

      {showAccessibilityModal && (
        <Suspense fallback={<LoadingSurface label="Loading accessibility settings..." fullscreen />}>
          <AccessibilitySettingsModal
            open={showAccessibilityModal}
            onClose={() => closeModal('accessibility')}
          />
        </Suspense>
      )}

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

      {isNurseryOpen && (
        <Suspense fallback={<LoadingSurface label="Opening routine nursery..." fullscreen />}>
          <HabitNurseryModal open={isNurseryOpen} onClose={() => setIsNurseryOpen(false)} />
        </Suspense>
      )}

      {showDailyPlanRitual && (
        <Suspense fallback={<LoadingSurface label="Opening daily planning ritual..." fullscreen />}>
          <DailyPlanRitual
            open={showDailyPlanRitual}
            onClose={() => setShowDailyPlanRitual(false)}
            today={today}
            goals={goals ?? []}
            weeklyEvents={weeklyEvents ?? []}
            dayPlan={ritualDayPlan}
            dayCapacityHours={Math.max(1, (hourFromTimeStr(userSettings?.dayEnd, 22) - hourFromTimeStr(userSettings?.dayStart, 8)))}
            onConfirm={handleDailyPlanRitualConfirm}
          />
        </Suspense>
      )}

      {editingGoal && (
        <Suspense fallback={<LoadingSurface label="Opening goal editor..." fullscreen />}>
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
              setProjectPlannerPrefill({
                prefillTitle: opts?.prefillTitle ?? '',
                prefillParentGoalId: opts?.prefillParentGoalId ?? opts?.parentGoalId ?? '',
              });
              setProjectPlannerImportedPlan(null);
              setEditingGoal(null);
              setShowProjectPlanner(true);
            }}
            onStartFocus={(payload) => { runStartFocus(payload); setEditingGoal(null); }}
            onReschedule={() => { setActiveTab('planner'); setEditingGoal(null); }}
          />
        </Suspense>
      )}

      {showChat && (
        <Suspense fallback={<LoadingSurface label="Opening spirit chat..." fullscreen />}>
          <SpiritChat
            open={showChat}
            onClose={() => closeModal('chat')}
            context={{
              goals: goals ?? [],
              logs: logs ?? [],
              energy: dailyEnergyModifier ?? 0,
              weather: weather ?? 'sun',
            }}
            onOperatorAction={handleAssistantOperatorAction}
            operatorLoadingAction={assistantActionBusy}
          />
        </Suspense>
      )}

      {showCompost && (
        <Suspense fallback={<LoadingSurface label="Opening compost..." fullscreen />}>
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
            onViewInPlanner={(project) => {
              if (project?.id) setProjectPlannerFocusGoalId(project.id);
              setProjectPlannerImportedPlan(null);
              closeModal('compost');
              setShowProjectPlanner(true);
            }}
            onOpenProjectPlannerForDocumentPlan={(payload) => {
              setProjectPlannerPrefill({
                prefillTitle: payload?.title ?? '',
                prefillParentGoalId: '',
              });
              setProjectPlannerImportedPlan({
                plan: payload?.plan ?? null,
                description: payload?.description ?? '',
                deadline: payload?.deadline ?? '',
              });
              closeModal('compost');
              setShowProjectPlanner(true);
            }}
          />
        </Suspense>
      )}

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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="schedule-event-location" className="block font-sans text-sm font-medium text-stone-600 mb-1">Location</label>
                    <input
                      id="schedule-event-location"
                      type="text"
                      value={scheduleEventLocation}
                      onChange={(e) => setScheduleEventLocation(e.target.value)}
                      placeholder="Optional"
                      className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="schedule-event-participants" className="block font-sans text-sm font-medium text-stone-600 mb-1">Participants</label>
                    <input
                      id="schedule-event-participants"
                      type="text"
                      value={scheduleEventParticipants}
                      onChange={(e) => setScheduleEventParticipants(e.target.value)}
                      placeholder="Optional, comma separated"
                      className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                    />
                  </div>
                </div>
                {scheduleEventSourceText && (
                  <div className="rounded-lg border border-stone-200 bg-stone-100/70 px-3 py-2">
                    <p className="font-sans text-[11px] uppercase tracking-wide text-stone-500">Original shared text</p>
                    <p className="mt-1 font-sans text-xs text-stone-600 line-clamp-2">{scheduleEventSourceText}</p>
                  </div>
                )}

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
            const nextStepReward = buildReward({ type: 'NEXT_STEP_ADDED' });
            if (nextStepReward) pushReward(nextStepReward);
            addWater?.(1);
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

      {currentHelperIntervention?.type === HELPER_INTERVENTION_TYPES.FOCUS_ABANDONED && (() => {
        const copy = RECOVERY_COPY[HELPER_INTERVENTION_TYPES.FOCUS_ABANDONED];
        return (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[101] w-[90vw] max-w-md px-4 py-3 rounded-xl border border-stone-200 bg-white shadow-xl" role="dialog" aria-live="polite">
            <p className="font-sans text-sm font-medium text-stone-800">{copy?.title ?? 'Session stopped'}</p>
            <p className="font-sans text-sm text-stone-600 mt-0.5">{copy?.message ?? "No problem. Start again when you're ready."}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => dismissHelper(currentHelperIntervention.id)} className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium text-stone-600 hover:bg-stone-100">Later</button>
              <button type="button" onClick={() => { setActiveTab('now'); dismissHelper(currentHelperIntervention.id); }} className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700">{copy?.actionLabel ?? 'View my day'}</button>
            </div>
          </div>
        );
      })()}

      {currentHelperIntervention?.type === HELPER_INTERVENTION_TYPES.OVERLOADED && (() => {
        const copy = RECOVERY_COPY[HELPER_INTERVENTION_TYPES.OVERLOADED];
        return (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[101] w-[90vw] max-w-md px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/90 shadow-xl" role="dialog" aria-live="polite">
            <p className="font-sans text-sm font-medium text-stone-800">{copy?.title ?? 'Today looks full'}</p>
            <p className="font-sans text-sm text-stone-600 mt-0.5">{copy?.message ?? 'You can lighten the plan so it fits your energy.'}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => dismissHelper(currentHelperIntervention.id)} className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium text-stone-600 hover:bg-stone-100">Later</button>
              <button type="button" onClick={() => { handleLightenTodayPlan(); dismissHelper(currentHelperIntervention.id); }} className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700">{copy?.actionLabel ?? 'Lighten today'}</button>
            </div>
          </div>
        );
      })()}

      {currentHelperIntervention?.type === HELPER_INTERVENTION_TYPES.NO_NEXT_STEP && (() => {
        const copy = RECOVERY_COPY[HELPER_INTERVENTION_TYPES.NO_NEXT_STEP];
        return (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[101] w-[90vw] max-w-md px-4 py-3 rounded-xl border border-stone-200 bg-white shadow-xl" role="dialog" aria-live="polite">
            <p className="font-sans text-sm font-medium text-stone-800">{copy?.title ?? 'Project could use one step'}</p>
            <p className="font-sans text-sm text-stone-600 mt-0.5">{copy?.message ?? "Add one small next step to unblock it."}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => dismissHelper(currentHelperIntervention.id)} className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium text-stone-600 hover:bg-stone-100">Later</button>
              <button type="button" onClick={() => dismissHelper(currentHelperIntervention.id)} className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700">{copy?.actionLabel ?? 'Add next step'}</button>
            </div>
          </div>
        );
      })()}

      {currentHelperIntervention?.type === HELPER_INTERVENTION_TYPES.NEGLECTED_PROJECT_REVIVAL && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[101] w-[90vw] max-w-md px-4 py-3 rounded-xl border border-moss-200 bg-moss-50/90 shadow-xl" role="dialog" aria-live="polite">
          <p className="font-sans text-sm font-medium text-stone-800">{NEGLECTED_PROJECT_COPY.title}</p>
          <p className="font-sans text-sm text-stone-600 mt-0.5">{NEGLECTED_PROJECT_COPY.message}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => dismissHelper(currentHelperIntervention.id)} className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium text-stone-600 hover:bg-stone-100">Later</button>
            <button type="button" onClick={() => dismissHelper(currentHelperIntervention.id)} className="px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700">{NEGLECTED_PROJECT_COPY.actionLabel}</button>
          </div>
        </div>
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
              Optional: pair with a habit
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
