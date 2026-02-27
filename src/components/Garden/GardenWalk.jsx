import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { useEnergy } from '../../context/EnergyContext';
import SpiritShop from './SpiritShop';
import Garden3D from './Garden3D';
import VirtualJoystick from './VirtualJoystick';
import JournalView from '../Dashboard/JournalView';
import AnalyticsView from '../Dashboard/AnalyticsView';

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function getGoalProgressPercent(goal) {
  if (goal?._projectGoal) return getProjectProgressPercent(goal);
  const total = Number(goal?.totalMinutes) || 0;
  const target = (Number(goal?.targetHours) || 0) * 60 || (Number(goal?.estimatedMinutes) || 60);
  return clamp((total / target) * 100, 0, 100);
}

function getProjectProgressPercent(goal) {
  const ms = Array.isArray(goal?.milestones) ? goal.milestones : [];
  if (ms.length === 0) return 0;
  const done = ms.filter((m) => m.completed).length;
  return clamp((done / ms.length) * 100, 0, 100);
}

export function getPlantStage(pct) {
  if (pct < 10) return 'seed';
  if (pct < 50) return 'sprout';
  if (pct < 100) return 'bloom';
  return 'harvest';
}

export const STAGE_EMOJI = { seed: '🌱', sprout: '🌿', bloom: '🌸', harvest: '🌲' };
export const PROJECT_STAGE_EMOJI = { seed: '🫘', sprout: '🪴', bloom: '🌻', harvest: '🏆' };

/** 50+ flora emojis for Kaizen goals — deterministic per goal.id */
export const FLORA = [
  '🌻', '🌺', '🌹', '🌸', '🪷', '🍄', '🌾', '🌿', '🍀', '🪴', '🎋', '🌵', '🌴', '🌳', '🌲', '🍁', '🍂', '🍇', '🫐', '🍓',
  '🍒', '🍑', '🥝', '🍋', '🍊', '🌶️', '🥕', '🥬', '🥦', '🌽', '🫑', '🍅', '🥑', '🫒', '🌰', '🥜', '🪻', '🌼', '🏵️', '💐',
  '🪹', '🌱', '🪺', '🌴', '🪸', '🍀', '🌷', '🪷', '🌺', '🥀', '🪻',
];

/** Water/pond emojis for Vitality goals */
export const PONDS = ['🌊', '💧', '🧊', '🐟', '🐸', '🦆', '🪼', '🐚', '🦀', '🐢'];

/** Rock/zen emojis for Routine goals */
export const ROCKS = ['🪨', '🗿', '⛰️', '🗻', '🏯', '⛩️', '🪵', '🪷', '🪸', '🏔️'];

export function getHash(str) {
  const s = String(str ?? '');
  if (!s) return 0;
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

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

export default function GardenWalk({ goals: goalsProp, onGoalClick, onOpenGoalCreator, onEditGoal }) {
  const { goals: contextGoals, decorations = [], fertilizerCount = 0, fertilizeGoal, waterGoal, waterDrops = 0, addWater = () => {}, dailySpoonCount, activeTool, setActiveTool, ownedSeeds = [], editGoal } = useGarden();
  const { dailyEnergy } = useEnergy();
  const spoons = typeof dailySpoonCount === 'number' ? dailySpoonCount : dailyEnergy;
  const energyTier = getEnergyTier(spoons);
  const gradientStyle = GARDEN_GRADIENTS[energyTier];
  const allGoals = goalsProp ?? contextGoals ?? [];

  const [viewMode, setViewMode] = useState('garden'); // 'garden' | 'greenhouse'
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [viewingGoal, setViewingGoal] = useState(null);
  const [activeFocusGoal, setActiveFocusGoal] = useState(null);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [activeAlmanac, setActiveAlmanac] = useState(null); // 'journal' | 'insights' | null
  const [showPlantingModal, setShowPlantingModal] = useState(false);
  const [isTransplanting, setIsTransplanting] = useState(false);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!viewingGoal) setIsTransplanting(false);
  }, [viewingGoal]);

  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && activeFocusGoal) {
      setIsTimerRunning(false);
      if (typeof addWater === 'function') addWater(1);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Focus Session Complete! Earned 1 💧' } }));
      }
      setActiveFocusGoal(null);
      setTimeLeft(25 * 60);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft, addWater, activeFocusGoal]);
  const [fertilizeMode, setFertilizeMode] = useState(false);

  const goals = useMemo(() => {
    if (viewMode === 'garden') {
      return allGoals.filter((g) => !isProjectDone(g) && getGoalProgressPercent(g) < 100);
    }
    return allGoals.filter((g) => isProjectDone(g) || getGoalProgressPercent(g) >= 100);
  }, [viewMode, allGoals]);

  const growingCount = allGoals.filter((g) => !isProjectDone(g) && getGoalProgressPercent(g) < 100).length;
  const harvestedCount = allGoals.filter((g) => isProjectDone(g) || getGoalProgressPercent(g) >= 100).length;

  const unplacedGoals = allGoals.filter((g) => !g.position3D || !Array.isArray(g.position3D));
  const unplacedDecorations = decorations.filter((d) => !d.position3D || !Array.isArray(d.position3D));
  const firstUnplacedGoal = unplacedGoals[0];
  const firstUnplacedDecoration = unplacedDecorations[0];

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
        <div className="m-1 sm:m-2 h-[88vh] min-h-[400px] w-full rounded-3xl overflow-hidden relative">
          <Garden3D
            focusGoal={activeFocusGoal}
            onOpenShop={() => setIsShopOpen(true)}
            onOpenJournal={() => setActiveAlmanac('journal')}
            onOpenInsights={() => setActiveAlmanac('insights')}
            onGoalClick={(goal) => {
              if (activeTool?.type === 'water') {
                waterGoal(goal.id);
                setActiveTool(null);
              } else {
                setViewingGoal(goal);
              }
            }}
            uiBlocksCanvas={!!(viewingGoal || activeAlmanac)}
          />
          <VirtualJoystick />
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
            <button
              type="button"
              onClick={() => setActiveAlmanac('journal')}
              className="absolute top-4 left-4 z-50 p-3 bg-white/80 backdrop-blur rounded-2xl shadow-lg hover:bg-white transition-all text-stone-700 font-bold flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 pointer-events-auto"
              aria-label="Open Almanac"
            >
              <span aria-hidden>📖</span>
              Almanac
            </button>
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
                  onClick={() => {
                    setActiveFocusGoal(viewingGoal);
                    setViewingGoal(null);
                    setTimeLeft(25 * 60);
                    setIsTimerRunning(true);
                  }}
                  className="w-full mt-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 transition-all"
                >
                  <span aria-hidden>🧘</span> Start Focus Session
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeFocusGoal && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-stone-900/60 backdrop-blur-md p-8 rounded-3xl text-white text-center shadow-2xl border border-white/10 z-50 min-w-[300px] pointer-events-auto"
            >
              <h3 className="text-lg font-medium text-stone-300 mb-1">Focusing on</h3>
              <h2 className="text-2xl font-bold mb-4">{activeFocusGoal.title}</h2>
              <div className="text-6xl font-mono font-light mb-8 text-indigo-200">
                {formatTime(timeLeft)}
              </div>
              <div className="flex gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full font-bold transition-all"
                >
                  {isTimerRunning ? 'Pause' : 'Resume'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFocusGoal(null);
                    setIsTimerRunning(false);
                  }}
                  className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full font-bold shadow-md transition-all"
                >
                  Stop
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
                  <SpiritShop onClose={() => setIsShopOpen(false)} embedded />
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
                  {activeAlmanac === 'journal' ? <JournalView /> : <AnalyticsView />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Toolbelt — bottom center overlay; fades when shop is open */}
        <div
          className={
            isShopOpen
              ? 'opacity-0 pointer-events-none transition-opacity duration-300'
              : 'opacity-100 transition-opacity duration-300'
          }
        >
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-2 px-3 py-2 rounded-2xl bg-stone-800/90 backdrop-blur-sm shadow-lg border border-stone-600/50 pointer-events-auto">
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
              onClick={() => setActiveTool(null)}
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
                {unplacedGoals.length > 0 ? (
                  <ul className="space-y-2" role="list">
                    {unplacedGoals.map((goal) => (
                      <li key={goal.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTool({ type: 'plant', goalId: goal.id });
                            setShowPlantingModal(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-sans text-left text-stone-800 bg-white/80 border border-stone-200/80 hover:bg-moss-50/80 hover:border-moss-300/80 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 transition-colors"
                        >
                          <span className="text-xl shrink-0" aria-hidden>🌱</span>
                          <span className="font-medium truncate">{goal.title || 'Untitled goal'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
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
                          const raw = window.prompt('Extend deadline to (YYYY-MM-DD):');
                          if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
                            onEditGoal?.(selectedGoal.id, { _projectDeadline: raw.trim() });
                          }
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
              My Garden
            </button>
            <span className="text-stone-300 font-sans">|</span>
            <button
              type="button"
              onClick={() => setViewMode('greenhouse')}
              className={`font-serif text-xl transition-colors rounded-lg px-2 py-1 ${viewMode === 'greenhouse' ? 'text-stone-800 font-semibold bg-stone-100' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
            >
              The Greenhouse
            </button>
          </div>
          <p className="font-sans text-sm text-stone-500 mt-0.5">
            {viewMode === 'garden'
              ? (allGoals.length === 0
                ? 'Plant your first seed to begin.'
                : `${growingCount} growing · ${harvestedCount} ${harvestedCount === 1 ? 'harvest' : 'harvests'}`)
              : (goals.length === 0
                ? 'No harvests yet. Complete goals to see them here.'
                : `${goals.length} ${goals.length === 1 ? 'harvest' : 'harvests'} on display`)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fertilizerCount > 0 && (
            <button
              type="button"
              onClick={() => setFertilizeMode((prev) => !prev)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl font-sans text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 ${
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
            <span className="font-sans text-xs text-amber-700 font-medium">Click a growing plant to fertilize</span>
          )}
        </div>
      </div>

    </div>
  );
}
