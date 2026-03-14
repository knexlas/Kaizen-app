import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { useEnergy } from '../../context/EnergyContext';
import { useDialog } from '../../context/DialogContext';
import { getGoalSupportDomain, SUPPORT_DOMAINS } from '../../services/domainSupportService';
import { startFocusCommand } from '../../services/coreCommands';
import { getGoalProgressPercent, getPlantStage, STAGE_EMOJI, PROJECT_STAGE_EMOJI, FLORA, PONDS, ROCKS, getHash } from './gardenProgress';
import { getGoalGardenState, getGardenSummary, getGardenStateLabel, GOAL_GARDEN_STATE } from '../../services/gardenStateService';
import { getProjectHealthState } from '../../services/projectSupportService';
import VirtualJoystick from './VirtualJoystick';

const SpiritShop = lazy(() => import('./SpiritShop'));
const Garden3D = lazy(() => import('./Garden3D'));
const JournalView = lazy(() => import('../Dashboard/JournalView'));
const AnalyticsView = lazy(() => import('../Dashboard/AnalyticsView'));

/** Seed catalog for Transplant UI — must match SpiritShop SEED_ITEMS (id, model, name, icon). */
const SEED_CATALOG = [
  { id: 'seed_oak', name: 'Mighty Oak', model: 'tree_oak.glb', icon: '🌳' },
  { id: 'seed_pine', name: 'Ancient Pine', model: 'tree_pineTallA.glb', icon: '🌲' },
  { id: 'seed_palm', name: 'Tropical Palm', model: 'tree_palm.glb', icon: '🌴' },
  { id: 'seed_sunflower', name: 'Sunflower', model: 'flower_yellowA.glb', icon: '🌻' },
  { id: 'seed_mushroom', name: 'Giant Spore', model: 'mushroom_redGroup.glb', icon: '🍄' },
];

function isProjectDone(goal) {
  const ms = Array.isArray(goal?.milestones) ? goal.milestones : [];
  if (ms.length > 0 && ms.every((m) => m.completed)) return true;
  if (goal?._projectDeadline) {
    const dl = new Date(goal._projectDeadline + 'T23:59:59');
    if (dl < new Date()) return true;
  }
  return false;
}

/** Energy tier from spoons: high >= 8, low <= 4, else medium */
function getEnergyTier(spoons) {
  const n = typeof spoons === 'number' ? spoons : null;
  if (n == null) return 'medium';
  if (n >= 8) return 'high';
  if (n <= 4) return 'low';
  return 'medium';
}

const GARDEN_GRADIENTS = {
  high: {
    background: 'linear-gradient(165deg, #fffef5 0%, #fef9e7 25%, #f5e6b8 50%, #e8d88a 75%, #d4c45e 100%)',
    boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.8), 0 20px 40px -12px rgba(212,196,94,0.35), 0 4px 12px -4px rgba(0,0,0,0.06)',
  },
  medium: {
    background: 'linear-gradient(165deg, #f5f7f0 0%, #e8edd8 28%, #d4e4c4 55%, #c5d9b0 85%, #b8cf9e 100%)',
    boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.6), 0 20px 40px -12px rgba(94,114,52,0.25), 0 4px 12px -4px rgba(0,0,0,0.08)',
  },
  low: {
    background: 'linear-gradient(165deg, #475569 0%, #334155 22%, #3d4f3d 50%, #4a5d4a 78%, #556b55 100%)',
    boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.08), 0 20px 40px -12px rgba(15,23,42,0.4), 0 4px 12px -4px rgba(0,0,0,0.12)',
  },
};

function getChecklistItemTitle(item) {
  if (typeof item === 'object' && item !== null) return item.title ?? item.name ?? '';
  return String(item ?? '');
}

function isChecklistItemCompleted(item) {
  return typeof item === 'object' && item !== null && (item.completed === true || item.status === 'completed');
}

function getGoalChecklist(goal) {
  const items = goal?.subtasks || goal?.phases || goal?.milestones || [];
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: item?.id ?? index,
    title: getChecklistItemTitle(item),
    completed: isChecklistItemCompleted(item),
  }));
}

export default function GardenWalk({ goals: goalsProp, onGoalClick, onOpenGoalCreator, onEditGoal, onOpenNursery, ecoMode: ecoModeProp = false }) {
  const {
    goals: contextGoals,
    logs = [],
    lastCheckInDate,
    weekAssignments = {},
    decorations = [],
    fertilizerCount = 0,
    fertilizeGoal,
    waterGoal,
    waterDrops = 0,
    addWater = () => {},
    dailySpoonCount,
    activeTool,
    setActiveTool,
    ownedSeeds = [],
    editGoal,
    tourStep,
    userSettings = {},
    updateUserSettings,
    isArchitectMode,
    setIsArchitectMode,
    setSelectedObjectId,
  } = useGarden();
  const { dailyEnergy } = useEnergy();
  const { showPrompt } = useDialog();
  const spoons = typeof dailySpoonCount === 'number' ? dailySpoonCount : dailyEnergy;
  const energyTier = getEnergyTier(spoons);
  const gradientStyle = GARDEN_GRADIENTS[energyTier];
  const allGoals = goalsProp ?? contextGoals ?? [];

  /** Last log entry for a goal (for "last tended" in goal viewer). */
  const lastTendedForGoal = useCallback((goalId) => {
    if (!goalId || !Array.isArray(logs)) return null;
    const entries = logs.filter((l) => l.taskId === goalId && (l.date != null || l.minutes != null));
    if (entries.length === 0) return null;
    const sorted = [...entries].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
    return sorted[0];
  }, [logs]);

  const [viewMode, setViewMode] = useState('garden'); // 'garden' | 'greenhouse'
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [viewingGoal, setViewingGoal] = useState(null);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [activeAlmanac, setActiveAlmanac] = useState(null); // 'journal' | 'insights' | null
  const [gardenMode, setGardenMode] = useState('explore'); // 'explore' | 'manage'
  const canvasInvalidateRef = useRef(null);
  const ecoMode = ecoModeProp || isShopOpen;
  const [showPlantingModal, setShowPlantingModal] = useState(false);
  const [isTransplanting, setIsTransplanting] = useState(false);
  const [toolboxFaded, setToolboxFaded] = useState(false);
  const [showGraphicsMenu, setShowGraphicsMenu] = useState(false);
  const graphicsMode = userSettings?.gardenGraphicsMode ?? 'auto';

  const onToolUsed = useCallback(() => setToolboxFaded(true), []);

  useEffect(() => {
    if (!viewingGoal) setIsTransplanting(false);
  }, [viewingGoal]);

  useEffect(() => {
    if (!isShopOpen) return;
    setShowGraphicsMenu(false);
  }, [isShopOpen]);

  useEffect(() => {
    if (viewMode === 'garden') return;
    setGardenMode('explore');
    setActiveTool(null);
    setIsArchitectMode(false);
  }, [viewMode, setActiveTool, setIsArchitectMode]);

  useEffect(() => {
    if (gardenMode === 'manage') return;
    setActiveTool(null);
    setFertilizeMode(false);
    setShowGraphicsMenu(false);
    setIsArchitectMode(false);
  }, [gardenMode, setActiveTool, setIsArchitectMode]);

  /** Start focus from garden: use main app flow (FocusSession + Tea Ceremony) so progress and rewards stay in sync. */
  const handleStartFocusFromGarden = useCallback((goal, minutes = 25) => {
    if (!goal?.id) return;
    const { session } = startFocusCommand({ goal, minutes, subtaskId: null });
    if (!session) return;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kaizen:startFocus', { detail: { goal: session, minutes: session.sessionDurationMinutes } }));
    }
    setViewingGoal(null);
  }, []);

  const [fertilizeMode, setFertilizeMode] = useState(false);

  const goals = useMemo(() => {
    if (viewMode === 'garden') {
      return allGoals.filter((g) => !isProjectDone(g) && getGoalProgressPercent(g) < 100);
    }
    return allGoals.filter((g) => isProjectDone(g) || getGoalProgressPercent(g) >= 100);
  }, [viewMode, allGoals]);

  const growingCount = allGoals.filter((g) => !isProjectDone(g) && getGoalProgressPercent(g) < 100).length;
  const harvestedCount = allGoals.filter((g) => isProjectDone(g) || getGoalProgressPercent(g) >= 100).length;

  const gardenSummary = useMemo(
    () => getGardenSummary(allGoals, logs, lastCheckInDate, weekAssignments),
    [allGoals, logs, lastCheckInDate, weekAssignments]
  );

  const ROUTINE_CATEGORIES = ['💪 Wellness', '📁 Life Admin', '🧹 Household', '🧼 Care & Hygiene'];
  const unplacedGoals = allGoals.filter((g) => g.type !== 'routine' && (!g.position3D || !Array.isArray(g.position3D)));
  const unplacedDecorations = decorations.filter((d) => !d.position3D || !Array.isArray(d.position3D));
  const unplacedRoutineCategories = useMemo(() => {
    const routineGoals = allGoals.filter((g) => g.type === 'routine');
    const byCategory = {};
    routineGoals.forEach((g) => {
      const cat = ROUTINE_CATEGORIES.includes(g.category) ? g.category : '📋 Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(g);
    });
    return Object.entries(byCategory)
      .filter(([, members]) => members.every((m) => !m.position3D || !Array.isArray(m.position3D)))
      .map(([category, members]) => ({ id: `routine-group-${category}`, title: category, goalId: members[0].id }));
  }, [allGoals]);
  const plantableSeeds = [
    ...unplacedGoals.map((g) => ({ id: g.id, title: g.title || 'Untitled goal', goalId: g.id, goal: g })),
    ...unplacedRoutineCategories.map((c) => ({ id: c.id, title: c.title, goalId: c.goalId, goal: allGoals.find((g) => g.id === c.goalId) })),
  ];
  /** Group plantable seeds by life domain (garden region) for legible planting list. */
  const plantableSeedsByRegion = useMemo(() => {
    const general = [];
    const byDomain = {};
    plantableSeeds.forEach((seed) => {
      const goal = seed.goal || allGoals.find((g) => g.id === seed.goalId);
      const domainId = goal ? getGoalSupportDomain(goal) : null;
      if (domainId) {
        if (!byDomain[domainId]) byDomain[domainId] = [];
        byDomain[domainId].push(seed);
      } else {
        general.push(seed);
      }
    });
    const regions = SUPPORT_DOMAINS.filter((d) => byDomain[d.id]?.length).map((d) => ({ id: d.id, label: d.label, emoji: d.emoji, seeds: byDomain[d.id] }));
    return { regions, general };
  }, [plantableSeeds, allGoals]);
  const firstUnplacedGoal = unplacedGoals[0];
  const firstUnplacedDecoration = unplacedDecorations[0];
  const gardenSummaryText = useMemo(() => {
    if (viewMode === 'garden') {
      if (allGoals.length === 0) return 'Plant your first seed to begin.';
      const harvestLabel = harvestedCount === 1 ? 'harvest' : 'harvests';
      return `${growingCount} growing, ${harvestedCount} ${harvestLabel}`;
    }
    if (goals.length === 0) return 'Nothing completed yet. Finished goals will appear here.';
    const goalLabel = goals.length === 1 ? 'goal' : 'goals';
    return `${goals.length} completed ${goalLabel} on display`;
  }, [allGoals.length, goals.length, growingCount, harvestedCount, viewMode]);
  const gardenModeDescription = useMemo(() => {
    if (viewMode !== 'garden') return 'Browse what you have finished and revisit completed work.';
    return gardenMode === 'manage'
      ? 'Tools are open so you can plant, water, and rearrange without cluttering the rest of the experience.'
      : 'Walk the garden, inspect goals, and reflect without extra controls on screen.';
  }, [gardenMode, viewMode]);
  const viewingGoalChecklist = useMemo(() => getGoalChecklist(viewingGoal), [viewingGoal]);
  const viewingGoalNextStep = useMemo(
    () => viewingGoalChecklist.find((item) => !item.completed)?.title ?? viewingGoalChecklist[0]?.title ?? null,
    [viewingGoalChecklist]
  );
  const viewingGoalSnapshot = useMemo(() => {
    if (!viewingGoal) return null;
    const progressPercent = getGoalProgressPercent(viewingGoal);
    const stage = getPlantStage(progressPercent);
    const stageEmoji = viewingGoal._projectGoal ? PROJECT_STAGE_EMOJI[stage] : STAGE_EMOJI[stage];
    const nextAt = stage === 'seed' ? 10 : stage === 'sprout' ? 50 : stage === 'bloom' ? 100 : null;
    const totalMin = Number(viewingGoal.totalMinutes) || 0;
    const lastTended = lastTendedForGoal(viewingGoal.id);
    const { state: goalState } = getGoalGardenState(viewingGoal, logs, (goal, ctx) => getProjectHealthState(goal, ctx ?? {}));

    let statusLabel = 'In motion';
    let statusNote = 'You can keep tending this goal at your own pace.';
    let statusClasses = 'bg-moss-50 text-moss-800 border-moss-200';

    if (goalState === GOAL_GARDEN_STATE.STUCK) {
      statusLabel = 'Needs next step';
      statusNote = 'Open the project when you are ready to clarify the next action.';
      statusClasses = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (goalState === GOAL_GARDEN_STATE.NEGLECTED) {
      statusLabel = 'Waiting for attention';
      statusNote = 'There has not been recent activity, but it is still here when you return.';
      statusClasses = 'bg-stone-100 text-stone-700 border-stone-200';
    } else if (goalState === GOAL_GARDEN_STATE.RESTORED) {
      statusLabel = 'Recently restarted';
      statusNote = 'This goal has momentum again.';
      statusClasses = 'bg-sky-50 text-sky-800 border-sky-200';
    }

    return {
      progressPercent,
      stage,
      stageEmoji,
      nextAt,
      totalMin,
      lastTended,
      statusLabel,
      statusNote,
      statusClasses,
    };
  }, [lastTendedForGoal, logs, viewingGoal]);

  const isPaintActive = (material) => activeTool?.type === 'paint' && activeTool?.material === material;
  const toolBtn = (material, label, emoji) => (
    <button
      type="button"
      onClick={() => setActiveTool({ type: 'paint', material })}
      className={`px-3 py-2 rounded-xl font-sans text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 ${
        isPaintActive(material)
          ? 'ring-2 ring-moss-500 scale-105 bg-white shadow-md border-2 border-moss-400 text-stone-800'
          : 'bg-white/95 border border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300'
      }`}
    >
      <span className="mr-1" aria-hidden>{emoji}</span>
      {label}
    </button>
  );

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Ambient garden background — dynamic by energy (spoons) */}
      <div
        className="relative rounded-3xl overflow-hidden transition-[background,box-shadow] duration-700 ease-out"
        style={{
          background: gradientStyle.background,
          boxShadow: gradientStyle.boxShadow,
        }}
      >
        {/* Subtle grain / paper texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none rounded-3xl"
          style={{
            opacity: energyTier === 'low' ? 0.02 : 0.03,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />
        {/* Weather overlay: low energy = gentle rain */}
        {energyTier === 'low' && (
          <div
            className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden"
            style={{
              background: 'repeating-linear-gradient(105deg, transparent 0px, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 3px)',
              animation: 'rain-drift 8s linear infinite',
            }}
            aria-hidden
          />
        )}
        {/* Weather overlay: high energy = soft sunbeams */}
        {energyTier === 'high' && (
          <div
            className="absolute inset-0 pointer-events-none rounded-3xl"
            aria-hidden
          >
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background: 'radial-gradient(ellipse 80% 60% at 30% 10%, rgba(255,248,220,0.5) 0%, transparent 50%), radial-gradient(ellipse 60% 50% at 70% 5%, rgba(255,250,205,0.35) 0%, transparent 45%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: 'linear-gradient(125deg, transparent 0%, rgba(255,255,255,0.08) 25%, transparent 50%, rgba(255,255,255,0.06) 75%, transparent 100%)',
                animation: 'sunbeam-shimmer 12s ease-in-out infinite',
              }}
            />
          </div>
        )}
        {gardenSummary.totalActive > 0 && (gardenSummary.neglectedCount > 0 || gardenSummary.stuckCount > 0) && (
          <p className="font-sans text-sm text-stone-600 mx-2 mb-1 text-center">
            Your garden reflects your projects. {gardenSummary.stuckCount > 0 && gardenSummary.neglectedCount > 0
              ? `${gardenSummary.stuckCount} could use a next step, ${gardenSummary.neglectedCount} haven't had recent activity — both are here when you're ready.`
              : gardenSummary.stuckCount > 0
                ? `${gardenSummary.stuckCount} could use a next step when you're ready.`
                : `${gardenSummary.neglectedCount} haven't had recent activity — still here when you're ready.`}
          </p>
        )}
        <div id="guide-garden-canvas" className="m-1 sm:m-2 h-[88vh] min-h-[400px] w-full rounded-3xl overflow-hidden relative">
          <Suspense fallback={<div className="absolute inset-0 bg-stone-200/70 animate-pulse" aria-hidden="true" />}>
            <Garden3D
              focusGoal={null}
              onOpenShop={() => setIsShopOpen(true)}
              onOpenJournal={() => setActiveAlmanac('journal')}
              onOpenInsights={() => setActiveAlmanac('insights')}
              onOpenNursery={onOpenNursery}
              onToolUsed={onToolUsed}
              onGoalClick={(goal) => {
                if (activeTool?.type === 'water') {
                  waterGoal(goal.id);
                  setActiveTool(null);
                  onToolUsed();
                } else {
                  setViewingGoal(goal);
                }
              }}
              uiBlocksCanvas={!!(viewingGoal || activeAlmanac)}
              ecoMode={ecoMode}
              invalidateRef={canvasInvalidateRef}
            />
          </Suspense>
          <VirtualJoystick onMove={() => canvasInvalidateRef.current?.()} />
          {/* Tour step 4: point to Spirit */}
          {tourStep === 4 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-sans shadow-lg max-w-[280px] text-center pointer-events-none">
              Welcome to the Garden! Click your Spirit to pet it.
            </div>
          )}
          {/* UI overlay: pointer-events-none so 3D canvas gets clicks; each interactive element has pointer-events-auto */}
          <div className="absolute inset-0 z-40 pointer-events-none rounded-3xl">
            {/* Toolbox: fades out when shop is open to avoid clutter */}
            <div
              className={
                isShopOpen
                  ? 'opacity-0 pointer-events-none transition-opacity duration-300'
                  : 'opacity-100 transition-opacity duration-300'
              }
            >
            <div className="absolute top-4 left-4 z-50 w-[min(21rem,calc(100vw-2rem))] pointer-events-auto">
              <div className="rounded-[1.5rem] border border-white/70 bg-white/78 p-3 shadow-xl backdrop-blur-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                      {viewMode === 'garden' ? (gardenMode === 'manage' ? 'Manage mode' : 'Explore mode') : 'Completed view'}
                    </p>
                    <p className="mt-1 font-sans text-sm leading-5 text-stone-700">{gardenModeDescription}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGraphicsMenu((prev) => !prev)}
                    className="shrink-0 rounded-full border border-stone-200 bg-white/85 px-3 py-1.5 font-sans text-xs font-semibold text-stone-600 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                    aria-expanded={showGraphicsMenu}
                    aria-label="Open graphics menu"
                  >
                    {graphicsMode}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    id="guide-garden-almanac"
                    type="button"
                    onClick={() => setActiveAlmanac('journal')}
                    className="rounded-full bg-moss-700 px-3 py-2 font-sans text-sm font-semibold text-white shadow-sm transition-colors hover:bg-moss-800 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2"
                    aria-label="Open journal"
                  >
                    Journal
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAlmanac('insights')}
                    className="rounded-full border border-stone-200 bg-white/90 px-3 py-2 font-sans text-sm font-semibold text-stone-700 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:ring-offset-2"
                  >
                    Insights
                  </button>
                  {viewMode === 'garden' && (
                    <span className="rounded-full bg-stone-100 px-3 py-2 font-sans text-xs font-medium text-stone-600">
                      {gardenMode === 'manage' ? 'Finish a quick change, then return to explore.' : 'Switch to Manage when you want tools.'}
                    </span>
                  )}
                </div>
              </div>
              <AnimatePresence>
                {showGraphicsMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.16 }}
                    className="mt-2 w-56 rounded-2xl border border-stone-200 bg-white/95 p-2 shadow-xl backdrop-blur-md"
                  >
                    {[
                      ['auto', 'Auto', 'Adapts to your device and motion settings.'],
                      ['smooth', 'Smooth', 'Prefer richer visuals and motion when possible.'],
                      ['saver', 'Saver', 'Prefer battery life and lower animation cost.'],
                    ].map(([value, label, description]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          updateUserSettings?.({ gardenGraphicsMode: value });
                          setShowGraphicsMenu(false);
                        }}
                        className={`w-full rounded-xl px-3 py-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                          graphicsMode === value ? 'bg-moss-50 text-moss-900' : 'text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-sans text-sm font-semibold">{label}</span>
                          {graphicsMode === value && <span className="text-[11px] font-semibold uppercase tracking-wide text-moss-700">Active</span>}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">{description}</div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {viewMode === 'garden' && (
              <div className="absolute top-4 right-4 z-50 flex max-w-[min(20rem,calc(100vw-2rem))] flex-col items-end gap-2 pointer-events-auto">
                <div className="inline-flex rounded-full border border-white/70 bg-white/80 p-1 shadow-lg backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setGardenMode('explore')}
                    className={`rounded-full px-4 py-2 font-sans text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                      gardenMode === 'explore' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-white'
                    }`}
                  >
                    Explore
                  </button>
                  <button
                    type="button"
                    onClick={() => setGardenMode('manage')}
                    className={`rounded-full px-4 py-2 font-sans text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                      gardenMode === 'manage' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-white'
                    }`}
                  >
                    Manage
                  </button>
                </div>
                {gardenMode === 'manage' && (
                  <>
                    <div className="flex flex-wrap justify-end gap-2">
                      {fertilizerCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setFertilizeMode((prev) => !prev)}
                          className={`rounded-full border px-3 py-2 font-sans text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 ${
                            fertilizeMode
                              ? 'border-amber-300 bg-amber-100 text-amber-900 shadow-md'
                              : 'border-stone-200 bg-white/90 text-stone-700 hover:bg-white'
                          }`}
                          title={fertilizeMode ? 'Click a growing plant to fertilize it.' : 'Turn on fertilize mode.'}
                        >
                          {fertilizerCount} Fertilizer
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTool(null);
                          setSelectedObjectId(null);
                          setIsArchitectMode(!isArchitectMode);
                        }}
                        className={`rounded-full border px-3 py-2 font-sans text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 ${
                          isArchitectMode
                            ? 'border-amber-300 bg-amber-200/90 text-amber-900'
                            : 'border-stone-200 bg-white/90 text-stone-700 hover:bg-white'
                        }`}
                        aria-pressed={!!isArchitectMode}
                        aria-label={isArchitectMode ? 'Done editing layout' : 'Edit layout'}
                        title={isArchitectMode ? 'Done editing layout' : 'Edit layout'}
                      >
                        {isArchitectMode ? 'Done editing' : 'Edit layout'}
                      </button>
                    </div>
                    <div className="max-w-[18rem] rounded-2xl bg-stone-900/72 px-3 py-2 text-right font-sans text-xs text-stone-50 shadow-md backdrop-blur">
                      {isArchitectMode
                        ? 'Tap an object to select it, then tap the ground to move it.'
                        : fertilizeMode
                          ? 'Fertilizer is ready. Click a growing plant to use it.'
                          : 'Tools appear below so you can make one change at a time.'}
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              id="guide-garden-almanac"
              type="button"
              onClick={() => setActiveAlmanac('journal')}
              className="hidden absolute top-4 left-4 z-50 p-3 bg-white/80 backdrop-blur rounded-2xl shadow-lg hover:bg-white transition-all text-stone-700 font-bold flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 pointer-events-auto"
              aria-label="Open Almanac"
            >
              <span aria-hidden>📖</span>
              Almanac
            </button>
            <div className="hidden absolute top-16 left-4 z-50 pointer-events-auto">
              <button
                type="button"
                onClick={() => setShowGraphicsMenu((prev) => !prev)}
                className="px-3 py-2 bg-white/80 backdrop-blur rounded-2xl shadow-lg hover:bg-white transition-all text-stone-700 font-bold flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2"
                aria-expanded={showGraphicsMenu}
                aria-label="Open graphics menu"
              >
                <span aria-hidden>Graphics</span>
                <span className="text-xs font-medium uppercase tracking-wide text-stone-500">{graphicsMode}</span>
              </button>
              <AnimatePresence>
                {showGraphicsMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.16 }}
                    className="mt-2 w-56 rounded-2xl border border-stone-200 bg-white/95 backdrop-blur-md shadow-xl p-2"
                  >
                    {[
                      ['auto', 'Auto', 'Adapts to your device and motion settings.'],
                      ['smooth', 'Smooth', 'Prefer richer visuals and motion when possible.'],
                      ['saver', 'Saver', 'Prefer battery life and lower animation cost.'],
                    ].map(([value, label, description]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          updateUserSettings?.({ gardenGraphicsMode: value });
                          setShowGraphicsMenu(false);
                        }}
                        className={`w-full text-left rounded-xl px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                          graphicsMode === value ? 'bg-moss-50 text-moss-900' : 'hover:bg-stone-100 text-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-sans text-sm font-semibold">{label}</span>
                          {graphicsMode === value && <span className="text-[11px] font-semibold uppercase tracking-wide text-moss-700">Active</span>}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">{description}</div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTool(null);
                setSelectedObjectId(null);
                setIsArchitectMode(!isArchitectMode);
              }}
              className={`hidden absolute top-4 right-4 z-50 px-3 py-2 rounded-2xl shadow-lg border backdrop-blur font-sans text-sm font-semibold transition-colors pointer-events-auto focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 ${
                isArchitectMode
                  ? 'bg-amber-200/90 border-amber-300 text-amber-900 hover:bg-amber-200'
                  : 'bg-white/80 border-stone-200 text-stone-700 hover:bg-white'
              }`}
              aria-pressed={!!isArchitectMode}
              aria-label={isArchitectMode ? 'Done editing layout' : 'Edit layout'}
              title={isArchitectMode ? 'Done editing layout' : 'Edit layout'}
            >
              {isArchitectMode ? '✅ Done Editing' : '🏗️ Edit Layout'}
            </button>
            {isArchitectMode && (
              <div className="hidden absolute top-16 right-4 z-50 px-3 py-2 rounded-2xl bg-stone-900/70 text-stone-50 text-xs font-sans shadow-md backdrop-blur pointer-events-none max-w-[220px]">
                Tap an object to select, then tap the ground to move it.
              </div>
            )}
            {/* Goal viewer panel — when user clicks a 3D plant */}
            <AnimatePresence>
              {viewingGoal && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="fixed top-16 right-2 left-2 sm:left-auto sm:right-8 z-50 w-[calc(100vw-1rem)] sm:w-96 max-w-md pointer-events-auto"
                >
              <div className="bg-white/90 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-2xl border border-white max-h-[80vh] overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setViewingGoal(null)}
                  aria-label="Close"
                  className="absolute top-3 right-3 w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors font-sans text-lg"
                >
                  ×
                </button>
                <div className="pr-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-xl text-stone-900">{viewingGoal.title}</h3>
                    {viewingGoal._projectGoal && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                        Project
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-sans text-sm text-stone-500">
                    {viewingGoal.deadline || viewingGoal._projectDeadline
                      ? new Date((viewingGoal.deadline || viewingGoal._projectDeadline) + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                      : 'No deadline'}
                  </p>
                </div>
                {viewingGoalSnapshot && (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/90 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 font-sans text-xs font-semibold ${viewingGoalSnapshot.statusClasses}`}>
                          {viewingGoalSnapshot.statusLabel}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 font-sans text-xs font-medium text-stone-600">
                          {viewingGoalSnapshot.stageEmoji} {viewingGoalSnapshot.stage}
                          {viewingGoalSnapshot.nextAt != null ? ` to ${viewingGoalSnapshot.nextAt}%` : ''}
                        </span>
                      </div>
                      <p className="mt-3 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Next step</p>
                      <p className="mt-1 font-sans text-sm text-stone-800">
                        {viewingGoalNextStep || 'No next step yet. Open the project when you are ready to define one.'}
                      </p>
                      <p className="mt-2 font-sans text-xs text-stone-500">{viewingGoalSnapshot.statusNote}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-sans text-xs text-stone-500">Progress</p>
                        <p className="font-sans text-xs font-medium text-stone-600">{Math.round(viewingGoalSnapshot.progressPercent)}%</p>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-200">
                        <motion.div
                          className="h-full rounded-full bg-moss-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${viewingGoalSnapshot.progressPercent}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1.5 font-sans text-xs text-stone-600 shadow-sm">
                        {viewingGoalSnapshot.totalMin} min logged
                      </span>
                      {viewingGoalSnapshot.lastTended && (
                        <span className="rounded-full bg-white px-3 py-1.5 font-sans text-xs text-stone-600 shadow-sm">
                          Last tended {viewingGoalSnapshot.lastTended.date
                            ? new Date(viewingGoalSnapshot.lastTended.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                            : 'recently'}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="font-sans text-xs font-medium uppercase tracking-wider text-stone-500">Next checks</p>
                        {viewingGoalChecklist.length > 0 && (
                          <p className="font-sans text-xs text-stone-400">
                            {viewingGoalChecklist.filter((item) => item.completed).length}/{viewingGoalChecklist.length} complete
                          </p>
                        )}
                      </div>
                      {viewingGoalChecklist.length > 0 ? (
                        <ul className="space-y-1.5">
                          {viewingGoalChecklist.slice(0, 5).map((item) => (
                            <li key={item.id} className="flex items-center gap-2 font-sans text-sm">
                              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${item.completed ? 'bg-moss-500 text-white' : 'border-stone-300'}`}>
                                {item.completed ? '✓' : ''}
                              </span>
                              <span className={item.completed ? 'text-stone-400 line-through' : 'text-stone-700'}>{item.title || 'Untitled step'}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="font-sans text-xs text-stone-400">No steps yet. Add the next action when you need it.</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="hidden">
                  <h3 className="font-serif text-xl text-stone-900 pr-10 mb-2">{viewingGoal.title}</h3>
                <p className="font-sans text-sm text-stone-500 mb-4">
                  {viewingGoal.deadline || viewingGoal._projectDeadline
                    ? new Date((viewingGoal.deadline || viewingGoal._projectDeadline) + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    : 'No deadline'}
                </p>
                <div className="mb-4">
                  <p className="font-sans text-xs text-stone-500 mb-1">Progress</p>
                  <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-moss-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${getGoalProgressPercent(viewingGoal)}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                  <p className="font-sans text-xs text-stone-600 mt-1">{Math.round(getGoalProgressPercent(viewingGoal))}%</p>
                </div>
                {/* Growth legibility: stage, total time, last tended, project state */}
                {(() => {
                  const pct = getGoalProgressPercent(viewingGoal);
                  const stage = getPlantStage(pct);
                  const stageEmoji = viewingGoal._projectGoal ? PROJECT_STAGE_EMOJI[stage] : STAGE_EMOJI[stage];
                  const nextAt = stage === 'seed' ? 10 : stage === 'sprout' ? 50 : stage === 'bloom' ? 100 : null;
                  const totalMin = Number(viewingGoal.totalMinutes) || 0;
                  const lastTended = lastTendedForGoal(viewingGoal.id);
                  const { state: goalState, lastActivityAt } = getGoalGardenState(viewingGoal, logs, (goal, ctx) => getProjectHealthState(goal, ctx ?? {}));
                  const stateLabel = getGardenStateLabel(goalState);
                  return (
                    <div className="mb-4 p-3 rounded-xl bg-stone-50 border border-stone-100">
                      <p className="font-sans text-xs font-medium text-stone-600 mb-1.5">Growth</p>
                      <p className="font-sans text-xs text-stone-600">
                        Stage: {stageEmoji} {stage}{nextAt != null ? ` → next at ${nextAt}%` : ''}
                      </p>
                      <p className="font-sans text-xs text-stone-600 mt-0.5">
                        {totalMin} min logged
                      </p>
                      {lastTended && (
                        <p className="font-sans text-xs text-stone-500 mt-1">
                          Last tended: {lastTended.date ? new Date(lastTended.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'} · {(Number(lastTended.minutes) || 0) > 0 ? `${lastTended.minutes} min focus` : 'completed'}
                        </p>
                      )}
                      {stateLabel && goalState !== GOAL_GARDEN_STATE.NURTURED && (
                        <p className="font-sans text-xs text-stone-500 mt-1.5 italic">
                          {goalState === GOAL_GARDEN_STATE.STUCK
                            ? 'No next step — add one in Project Planner when you\'re ready.'
                            : goalState === GOAL_GARDEN_STATE.NEGLECTED
                              ? 'No recent activity — it\'s still here when you\'re ready.'
                              : goalState === GOAL_GARDEN_STATE.RESTORED
                                ? 'Recently picked up again.'
                                : stateLabel}
                        </p>
                      )}
                    </div>
                  );
                })()}
                <div>
                  <p className="font-sans text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Vines / Subtasks</p>
                  <ul className="space-y-1.5">
                    {(viewingGoal.subtasks || viewingGoal.phases || viewingGoal.milestones || []).map((item, i) => {
                      const title = typeof item === 'object' ? (item.title ?? item.name) : String(item);
                      const completed = typeof item === 'object' && (item.completed === true || item.status === 'completed');
                      return (
                        <li key={item?.id ?? i} className="flex items-center gap-2 font-sans text-sm">
                          <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px] ${completed ? 'bg-moss-500 text-white' : 'border-stone-300'}`}>
                            {completed ? '✓' : ''}
                          </span>
                          <span className={completed ? 'text-stone-400 line-through' : 'text-stone-700'}>{title || '—'}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {!(viewingGoal.subtasks?.length || viewingGoal.phases?.length || viewingGoal.milestones?.length) && (
                    <p className="font-sans text-xs text-stone-400">No vines yet.</p>
                  )}
                </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => handleStartFocusFromGarden(viewingGoal, 25)}
                    className="flex-1 rounded-xl bg-indigo-500 px-4 py-3 font-sans font-bold text-white shadow-lg transition-all hover:bg-indigo-600"
                  >
                    Start Focus Session
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onGoalClick?.(viewingGoal);
                      setViewingGoal(null);
                    }}
                    className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 font-sans font-semibold text-stone-700 transition-colors hover:bg-stone-50"
                  >
                    Open project
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTransplanting((prev) => !prev)}
                  className="text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full mt-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  ✨ Change Plant Appearance
                </button>
                <AnimatePresence>
                  {isTransplanting && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-4 p-4 bg-stone-50 rounded-xl border border-stone-200 overflow-hidden"
                    >
                      <h4 className="text-sm font-bold text-stone-700 mb-2">Your Premium Seeds</h4>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const availableSeeds = SEED_CATALOG.filter((s) => Array.isArray(ownedSeeds) && ownedSeeds.includes(s.id));
                          return availableSeeds.length > 0 ? (
                            availableSeeds.map((seed) => (
                              <button
                                key={seed.id}
                                type="button"
                                onClick={() => {
                                  if (typeof editGoal === 'function') editGoal(viewingGoal.id, { seedModel: seed.model });
                                  setIsTransplanting(false);
                                  window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: `Transplanted into ${seed.name}!` } }));
                                }}
                                className="flex flex-col items-center p-2 bg-white rounded-lg shadow-sm hover:shadow-md hover:scale-105 transition-all border border-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                              >
                                <span className="text-2xl" aria-hidden>{seed.icon}</span>
                                <span className="text-xs font-medium text-stone-600 mt-1">{seed.name}</span>
                              </button>
                            ))
                          ) : (
                            <p className="text-xs text-stone-500 italic">No seeds owned. Buy some in the Spirit Shop!</p>
                          );
                        })()}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button
                  type="button"
                  onClick={() => handleStartFocusFromGarden(viewingGoal, 25)}
                  className="hidden w-full mt-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 transition-all"
                >
                  <span aria-hidden>🧘</span> Start Focus Session
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

            </div>

            {/* Shop overlay — glassmorphic modal over 3D canvas */}
            <div className="absolute inset-0 z-50 pointer-events-none rounded-3xl">
              <AnimatePresence>
                {isShopOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto rounded-3xl"
                onClick={() => setIsShopOpen(false)}
              >
                <div
                  className="relative max-h-[90vh] overflow-y-auto bg-stone-100 rounded-3xl w-full max-w-lg shadow-2xl pt-14 px-4 pb-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setIsShopOpen(false)}
                    aria-label="Close"
                    className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/80 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                  >
                    ×
                  </button>
                  <Suspense fallback={<div className="rounded-2xl bg-white p-6 text-sm text-stone-500">Loading shop...</div>}>
                    <SpiritShop onClose={() => setIsShopOpen(false)} embedded />
                  </Suspense>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Almanac modal — Journal or Insights (triggered by 3D monuments or Almanac button); wrapper is pointer-events-none so canvas stays interactable when closed */}
        <div className="absolute inset-0 z-50 pointer-events-none rounded-3xl">
          <AnimatePresence>
            {activeAlmanac && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-4 md:inset-12 z-50 bg-stone-100/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white overflow-hidden flex flex-col pointer-events-auto"
              >
                <div className="flex justify-between items-center p-4 bg-white/50 border-b border-stone-200">
                  <h2 className="text-xl font-bold text-stone-800">
                    {activeAlmanac === 'journal' ? "📔 Captain's Log" : '📊 Ancient Insights'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveAlmanac(null)}
                    className="p-2 hover:bg-stone-200 rounded-full font-bold"
                    aria-label="Close"
                  >
                    ✕ Close
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <Suspense fallback={<div className="p-6 text-sm text-stone-500">Loading almanac...</div>}>
                    {activeAlmanac === 'journal' ? <JournalView /> : <AnalyticsView />}
                  </Suspense>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Toolbelt — fades when shop open; fades after use, restores on hover (game-like) */}
        <div
          id="guide-garden-tools"
          className={
            isShopOpen || viewMode !== 'garden' || gardenMode !== 'manage'
              ? 'opacity-0 pointer-events-none transition-opacity duration-300'
              : 'transition-opacity duration-300'
          }
          style={!isShopOpen && viewMode === 'garden' && gardenMode === 'manage' ? { opacity: toolboxFaded ? 0.35 : 1 } : undefined}
        >
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-2 px-3 py-2 rounded-2xl bg-stone-800/90 backdrop-blur-sm shadow-lg border border-stone-600/50 pointer-events-auto"
          onMouseEnter={() => setToolboxFaded(false)}
          role="toolbar"
          aria-label="Garden tools"
        >
          <button
            type="button"
            disabled={waterDrops === 0}
            onClick={() => waterDrops > 0 && setActiveTool({ type: 'water' })}
            className={`px-3 py-2 rounded-xl font-sans text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:ring-offset-2 ${
              waterDrops === 0
                ? 'opacity-50 cursor-not-allowed bg-stone-300 border border-stone-400 text-stone-500'
                : activeTool?.type === 'water'
                  ? 'ring-2 ring-sky-400 scale-105 bg-sky-50 shadow-md border-2 border-sky-300 text-sky-800'
                  : 'bg-white/95 border border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300'
            }`}
          >
            <span className="mr-1" aria-hidden>💦</span>
            Water ({waterDrops})
          </button>
          {toolBtn('water', 'Water', '💧')}
          {toolBtn('stone', 'Stone', '🪨')}
          {toolBtn('sand', 'Sand', '🏖️')}
          {toolBtn('grass', 'Grass (Eraser)', '🌱')}
          <button
            type="button"
            title="Click an object, then click the ground to move it"
            onClick={() => setActiveTool({ type: 'move' })}
            className={`px-3 py-2 rounded-xl font-sans text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 ${
              activeTool?.type === 'move'
                ? 'ring-2 ring-moss-500 scale-105 bg-white shadow-md border-2 border-moss-400 text-stone-800'
                : 'bg-white/95 border border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300'
            }`}
          >
            <span className="mr-1" aria-hidden>✋</span>
            Move
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTool(null);
              setShowPlantingModal(true);
            }}
            className={`px-3 py-2 rounded-xl font-sans text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 ${
              activeTool?.type === 'plant'
                ? 'ring-2 ring-moss-500 scale-105 bg-white shadow-md border-2 border-moss-400 text-stone-800'
                : 'bg-white/95 border border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300'
            }`}
          >
            <span className="mr-1" aria-hidden>🌱</span>
            Plant Seed
          </button>
          {unplacedDecorations.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTool({ type: 'place', decoration: unplacedDecorations[0] })}
              className={`p-3 rounded-full flex items-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 ${
                activeTool?.type === 'place' && (activeTool?.decoration?.id === unplacedDecorations[0]?.id || activeTool?.decorationId === unplacedDecorations[0]?.id)
                  ? 'bg-amber-500 text-white scale-110'
                  : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              <span className="text-xl" aria-hidden>🏕️</span>
              <span className="font-bold hidden md:inline">
                Place {unplacedDecorations[0].name} ({unplacedDecorations.length})
              </span>
            </button>
          )}
          {firstUnplacedDecoration && (
            <button
              type="button"
              onClick={() => setActiveTool({ type: 'place', decorationId: firstUnplacedDecoration.id })}
              className={`px-3 py-2 rounded-xl font-sans text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 ${
                activeTool?.type === 'place' && activeTool?.decorationId === firstUnplacedDecoration.id
                  ? 'ring-2 ring-moss-500 scale-105 bg-white shadow-md border-2 border-moss-400 text-stone-800'
                  : 'bg-white/95 border border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300'
              }`}
            >
              <span className="mr-1" aria-hidden>🪴</span>
              Place Decoration
            </button>
          )}
          {(activeTool && (
            <button
              type="button"
              onClick={() => {
                setActiveTool(null);
                setToolboxFaded(true);
              }}
              className="px-3 py-2 rounded-xl font-sans text-sm font-medium bg-stone-600 text-white hover:bg-stone-500 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 transition-colors"
            >
              Cancel
            </button>
          ))}
        </div>
        </div>
          </div>
      </div>
      </div>

      {/* Planting Modal — pick a seed to plant or create a new goal */}
      <AnimatePresence>
        {showPlantingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm"
            onClick={() => setShowPlantingModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="planting-modal-title"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(253, 252, 245, 0.98)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.5)',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <div className="px-5 pt-5 pb-2">
                <h2 id="planting-modal-title" className="font-serif text-stone-800 text-lg font-medium">
                  Choose a seed to plant
                </h2>
                <p className="font-sans text-sm text-stone-500 mt-1">Tap one, then tap the grass to place it.</p>
              </div>
              <div className="px-4 pb-4 max-h-[60vh] overflow-y-auto">
                {plantableSeeds.length > 0 ? (
                  <div className="space-y-4" role="list">
                    {plantableSeedsByRegion.regions.map((region) => (
                      <div key={region.id}>
                        <p className="font-sans text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <span aria-hidden>{region.emoji}</span>
                          {region.label}
                        </p>
                        <ul className="space-y-2">
                          {region.seeds.map((seed) => (
                            <li key={seed.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTool({ type: 'plant', goalId: seed.goalId });
                                  setShowPlantingModal(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-sans text-left text-stone-800 bg-white/80 border border-stone-200/80 hover:bg-moss-50/80 hover:border-moss-300/80 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 transition-colors"
                              >
                                <span className="text-xl shrink-0" aria-hidden>🌱</span>
                                <span className="font-medium truncate">{seed.title || 'Untitled goal'}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {plantableSeedsByRegion.general.length > 0 && (
                      <div>
                        <p className="font-sans text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">General</p>
                        <ul className="space-y-2">
                          {plantableSeedsByRegion.general.map((seed) => (
                            <li key={seed.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTool({ type: 'plant', goalId: seed.goalId });
                                  setShowPlantingModal(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-sans text-left text-stone-800 bg-white/80 border border-stone-200/80 hover:bg-moss-50/80 hover:border-moss-300/80 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 transition-colors"
                              >
                                <span className="text-xl shrink-0" aria-hidden>🌱</span>
                                <span className="font-medium truncate">{seed.title || 'Untitled goal'}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlantingModal(false);
                        onOpenGoalCreator?.();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-sans text-moss-700 font-medium bg-moss-50 border-2 border-moss-200 hover:bg-moss-100 hover:border-moss-300 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 transition-colors"
                    >
                      <span aria-hidden>+</span>
                      <span>Create a New Goal</span>
                    </button>
                    <p className="font-sans text-sm text-stone-500 mt-3 text-center">You have no unplanted goals yet.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plant Details Modal */}
      <AnimatePresence>
        {selectedGoal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm"
            onClick={() => setSelectedGoal(null)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-stone-200/80 shadow-2xl p-6 overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #FDFCF5 0%, #f5f3eb 100%)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-serif text-lg text-stone-900 flex-1">{selectedGoal.title}</h3>
                {selectedGoal._projectGoal && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-sans text-[10px] font-bold uppercase tracking-wider">Project</span>
                )}
              </div>
              {selectedGoal._projectGoal && selectedGoal._projectName && (
                <p className="font-sans text-xs text-stone-500 mb-2">{selectedGoal._projectName}{selectedGoal._projectPhase ? ` \u00b7 ${selectedGoal._projectPhase}` : ''}</p>
              )}
              <div className="space-y-3">
                <div>
                  <p className="font-sans text-xs text-stone-500 mb-1">
                    {selectedGoal._projectGoal ? 'Milestone Progress' : 'Progress'}
                  </p>
                  <div className="h-3 w-full rounded-full bg-stone-200 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${selectedGoal._projectGoal ? 'bg-amber-500' : 'bg-moss-600'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${getGoalProgressPercent(selectedGoal)}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <p className="font-sans text-sm text-stone-600 mt-1">
                    {Math.round(getGoalProgressPercent(selectedGoal))}%
                    {selectedGoal._projectGoal && selectedGoal.milestones?.length > 0 && (
                      <span className="text-stone-400 ml-1">({selectedGoal.milestones.filter((m) => m.completed).length}/{selectedGoal.milestones.length} milestones)</span>
                    )}
                  </p>
                </div>
                {selectedGoal._projectGoal && selectedGoal.milestones?.length > 0 && (
                  <div>
                    <p className="font-sans text-xs text-stone-500 mb-1.5">Milestones</p>
                    <div className="space-y-1">
                      {selectedGoal.milestones.map((m, i) => (
                        <div key={m.id || i} className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] ${m.completed ? 'bg-amber-500 border-amber-500 text-white' : 'border-stone-300 text-transparent'}`}>
                            {m.completed ? '\u2713' : ''}
                          </span>
                          <span className={`font-sans text-sm ${m.completed ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{m.title || m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedGoal._projectGoal && selectedGoal._projectDeadline && (
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-xs text-stone-500">Deadline:</span>
                    <span className={`font-sans text-xs font-medium ${
                      new Date(selectedGoal._projectDeadline + 'T23:59:59') < new Date() ? 'text-amber-600' : 'text-stone-700'
                    }`}>{new Date(selectedGoal._projectDeadline + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {new Date(selectedGoal._projectDeadline + 'T23:59:59') < new Date() && (
                      <button
                        type="button"
                        onClick={() => {
                          showPrompt({
                            title: 'Extend deadline',
                            message: 'New date (YYYY-MM-DD)',
                            defaultValue: selectedGoal._projectDeadline ? new Date(selectedGoal._projectDeadline + 'T12:00:00').toISOString().slice(0, 10) : '',
                            placeholder: 'YYYY-MM-DD',
                            submitLabel: 'Save',
                            onSubmit: (raw) => {
                              if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
                                onEditGoal?.(selectedGoal.id, { _projectDeadline: raw.trim() });
                              }
                            },
                          });
                        }}
                        className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-sans text-[10px] font-medium hover:bg-amber-200 transition-colors"
                      >
                        Extend
                      </button>
                    )}
                  </div>
                )}
                {selectedGoal._projectGoal && isProjectDone(selectedGoal) && (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-center">
                    <span className="font-sans text-sm font-medium text-amber-800">Project completed!</span>
                  </div>
                )}
                {!selectedGoal._projectGoal && selectedGoal.milestones?.length > 0 && (
                  <div>
                    <p className="font-sans text-xs text-stone-500 mb-1">Next Milestone</p>
                    <p className="font-sans text-sm text-stone-800">
                      {selectedGoal.milestones.find((m) => !m.completed)?.title ??
                        selectedGoal.milestones[0]?.title ??
                        '\u2014'}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    onGoalClick?.(selectedGoal);
                    setSelectedGoal(null);
                  }}
                  className="flex-1 py-2 rounded-lg bg-moss-600 text-white font-sans text-sm hover:bg-moss-700"
                >
                  View Details
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGoal(null)}
                  className="px-4 py-2 rounded-lg border border-stone-200 font-sans text-sm text-stone-600 hover:bg-stone-100"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Bar */}
      <div className="flex flex-wrap justify-between items-center gap-4 px-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => setViewMode('garden')}
              className={`font-serif text-xl transition-colors rounded-lg px-2 py-1 -ml-1 ${viewMode === 'garden' ? 'text-stone-800 font-semibold bg-stone-100' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
            >
              Growing
            </button>
            <span className="text-stone-300 font-sans">|</span>
            <button
              type="button"
              onClick={() => setViewMode('greenhouse')}
              className={`font-serif text-xl transition-colors rounded-lg px-2 py-1 ${viewMode === 'greenhouse' ? 'text-stone-800 font-semibold bg-stone-100' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
            >
              Completed
            </button>
          </div>
          <p className="mt-0.5 font-sans text-sm text-stone-500">{gardenSummaryText}</p>
          <p className="hidden font-sans text-sm text-stone-500 mt-0.5">
            {viewMode === 'garden'
              ? (allGoals.length === 0
                ? 'Plant your first seed to begin.'
                : `${growingCount} growing · ${harvestedCount} ${harvestedCount === 1 ? 'harvest' : 'harvests'}`)
              : (goals.length === 0
                ? 'Nothing completed yet. Finished goals will appear here.'
                : `${goals.length} completed ${goals.length === 1 ? 'goal' : 'goals'} on display`)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-sans text-xs text-stone-500">
            {viewMode !== 'garden'
              ? 'Completed goals stay simple here so you can reflect without editing.'
              : gardenMode === 'manage'
                ? 'Manage mode is open below for planting, watering, and layout changes.'
                : 'Explore mode keeps the garden calm. Switch to Manage when you want tools.'}
          </p>
          {fertilizerCount > 0 && (
            <button
              type="button"
              onClick={() => setFertilizeMode((prev) => !prev)}
              className={`hidden flex items-center gap-2 px-4 py-3 rounded-xl font-sans text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 ${
                fertilizeMode
                  ? 'bg-amber-100 border-2 border-amber-400 text-amber-900 shadow-md'
                  : 'bg-stone-100 border border-stone-200 text-stone-700 hover:bg-stone-200'
              }`}
              title={fertilizeMode ? 'Click a growing plant to fertilize it (cancel by clicking again)' : 'Click then click a plant to fertilize'}
            >
              <span className="text-lg" aria-hidden>🎒</span>
              {fertilizerCount} Fertilizer
            </button>
          )}
          {fertilizeMode && (
            <span className="hidden font-sans text-xs text-amber-700 font-medium">Click a growing plant to fertilize</span>
          )}
        </div>
      </div>

    </div>
  );
}
