import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { useEnergy } from '../../context/EnergyContext';
import SpiritShop from './SpiritShop';
import Garden3D from './Garden3D';

const GRID_COLS = 8;
const GRID_ROWS = 6;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
function hashToUnit(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

function getGoalProgressPercent(goal) {
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

function getPlantStage(pct) {
  if (pct < 10) return 'seed';
  if (pct < 50) return 'sprout';
  if (pct < 100) return 'bloom';
  return 'harvest';
}

const STAGE_EMOJI = { seed: '🌱', sprout: '🌿', bloom: '🌸', harvest: '🌲' };
const PROJECT_STAGE_EMOJI = { seed: '🫘', sprout: '🪴', bloom: '🌻', harvest: '🏆' };
const DECORATION_EMOJI = { bench: '🪑', pond: '🐟', lantern: '🏮', torii: '⛩️', cherry: '🌸' };

/** 50+ flora emojis for Kaizen goals — deterministic per goal.id */
const FLORA = [
  '🌻', '🌺', '🌹', '🌸', '🪷', '🍄', '🌾', '🌿', '🍀', '🪴', '🎋', '🌵', '🌴', '🌳', '🌲', '🍁', '🍂', '🍇', '🫐', '🍓',
  '🍒', '🍑', '🥝', '🍋', '🍊', '🌶️', '🥕', '🥬', '🥦', '🌽', '🫑', '🍅', '🥑', '🫒', '🌰', '🥜', '🪻', '🌼', '🏵️', '💐',
  '🪹', '🌱', '🪺', '🌴', '🪸', '🍀', '🌷', '🪷', '🌺', '🥀', '🪻',
];

/** Water/pond emojis for Vitality goals */
const PONDS = ['🌊', '💧', '🧊', '🐟', '🐸', '🦆', '🪼', '🐚', '🦀', '🐢'];

/** Rock/zen emojis for Routine goals */
const ROCKS = ['🪨', '🗿', '⛰️', '🗻', '🏯', '⛩️', '🪵', '🪷', '🪸', '🏔️'];

function getHash(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

function PixelPlant({ goal, stage, type = 'kaizen' }) {
  const showVariation = stage === 'sprout' || stage === 'bloom' || stage === 'harvest';
  const scaleClass = stage === 'sprout' ? 'scale-75 opacity-90' : 'scale-100';

  const plantList = type === 'vitality' ? PONDS : type === 'routine' ? ROCKS : FLORA;
  const selectedEmoji = plantList[getHash(goal?.id) % plantList.length];

  if (showVariation && type === 'project') {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full" aria-hidden>
        <div className={scaleClass}>
          <svg viewBox="0 0 20 24" className="w-9 h-11 shrink-0" fill="none" stroke="none">
            <rect x="8" y="18" width="4" height="6" fill="#5d4037" />
            <polygon points="10,2 18,14 2,14" fill="#2e7d32" />
            <polygon points="10,6 16,16 4,16" fill="#388e3c" />
            <polygon points="10,10 14,18 6,18" fill="#43a047" />
          </svg>
        </div>
      </div>
    );
  }

  if ((showVariation || stage === 'seed') && (type === 'kaizen' || type === 'routine' || type === 'vitality')) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className={scaleClass}>
          <motion.div
            className="text-3xl drop-shadow-sm"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          >
            {selectedEmoji}
          </motion.div>
        </div>
      </div>
    );
  }

  const emoji = type === 'project' ? (PROJECT_STAGE_EMOJI[stage] ?? '🫘') : (STAGE_EMOJI[stage] ?? '🌱');
  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <motion.div
        className="text-3xl drop-shadow-sm"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      >
        {emoji}
      </motion.div>
    </div>
  );
}

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
  const { goals: contextGoals, decorations = [], updateDecorationPosition, fertilizerCount = 0, fertilizeGoal, dailySpoonCount } = useGarden();
  const { dailyEnergy } = useEnergy();
  const spoons = typeof dailySpoonCount === 'number' ? dailySpoonCount : dailyEnergy;
  const energyTier = getEnergyTier(spoons);
  const gradientStyle = GARDEN_GRADIENTS[energyTier];
  const allGoals = goalsProp ?? contextGoals ?? [];

  const [viewMode, setViewMode] = useState('garden'); // 'garden' | 'greenhouse'
  const [is3D, setIs3D] = useState(false);
  const [positions, setPositions] = useState({});
  const [mochiCell, setMochiCell] = useState({ x: 1, y: 1 });
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [showShop, setShowShop] = useState(false);
  const [fertilizeMode, setFertilizeMode] = useState(false);
  const [pendingPlantCell, setPendingPlantCell] = useState(null);
  const gridContainerRef = useRef(null);

  const goals = useMemo(() => {
    if (viewMode === 'garden') {
      return allGoals.filter((g) => !isProjectDone(g) && getGoalProgressPercent(g) < 100);
    }
    return allGoals.filter((g) => isProjectDone(g) || getGoalProgressPercent(g) >= 100);
  }, [viewMode, allGoals]);

  useEffect(() => {
    const updates = {};
    let usedPending = false;
    goals.forEach((g) => {
      if (!g?.id || positions[g.id]) return;
      if (pendingPlantCell && !usedPending) {
        updates[g.id] = { ...pendingPlantCell };
        usedPending = true;
      } else {
        updates[g.id] = {
          x: Math.floor(hashToUnit(g.id) * (GRID_COLS - 1)),
          y: Math.floor(hashToUnit(g.id + 'y') * (GRID_ROWS - 1)),
        };
      }
    });
    if (Object.keys(updates).length > 0) {
      setPositions((p) => ({ ...p, ...updates }));
      if (usedPending) setPendingPlantCell(null);
    }
  }, [goals]);

  const goalByCell = useMemo(() => {
    const map = {};
    goals.forEach((g) => {
      const pos = positions[g.id];
      if (pos != null) map[`${pos.x},${pos.y}`] = g;
    });
    return map;
  }, [goals, positions]);

  const moveMochi = useCallback((x, y) => setMochiCell({ x, y }), []);

  const handleEmptyCellClick = useCallback(
    (x, y) => {
      moveMochi(x, y);
      if (onOpenGoalCreator) {
        setPendingPlantCell({ x, y });
        onOpenGoalCreator();
      }
    },
    [onOpenGoalCreator, moveMochi]
  );

  const handlePlantClick = useCallback((goal, x, y) => {
    if (fertilizeMode && fertilizeGoal && fertilizerCount >= 1) {
      const progress = getGoalProgressPercent(goal);
      const done = isProjectDone(goal);
          if (progress < 100 && !done) {
        fertilizeGoal(goal.id);
        setFertilizeMode(false);
        window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Fertilized! Progress bar moved forward 🍂' } }));
      }
      return;
    }
    moveMochi(x, y);
    setSelectedGoal(goal);
  }, [moveMochi, fertilizeMode, fertilizeGoal, fertilizerCount]);

  const nudgeGoal = useCallback((goalId, dx, dy) => {
    setPositions((prev) => {
      const pos = prev[goalId];
      if (!pos) return prev;
      const nx = clamp(pos.x + dx, 0, GRID_COLS - 1);
      const ny = clamp(pos.y + dy, 0, GRID_ROWS - 1);
      const targetKey = `${nx},${ny}`;
      const occupied = Object.entries(prev).some(([id, p]) => id !== goalId && `${p.x},${p.y}` === targetKey);
      if (occupied) return prev;
      return { ...prev, [goalId]: { x: nx, y: ny } };
    });
  }, []);

  const handleDecorationDragStart = useCallback((e, id) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDecorationDrop = useCallback((e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id || !updateDecorationPosition) return;
    const el = gridContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    updateDecorationPosition(id, `${Math.round(Math.max(0, Math.min(100, xPct)))}%`, `${Math.round(Math.max(0, Math.min(100, yPct)))}%`);
  }, [updateDecorationPosition]);

  const handleGridDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const growingCount = allGoals.filter((g) => !isProjectDone(g) && getGoalProgressPercent(g) < 100).length;
  const harvestedCount = allGoals.filter((g) => isProjectDone(g) || getGoalProgressPercent(g) >= 100).length;

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
        {is3D ? (
          <div className="m-2 sm:m-3 h-[60vh] rounded-3xl overflow-hidden">
            <Garden3D />
          </div>
        ) : (
        <div
          className={`relative rounded-3xl overflow-hidden m-2 sm:m-3 transition-all duration-300 ${
            viewMode === 'greenhouse'
              ? 'border-2 border-amber-800/40 shadow-inner'
              : 'border border-[#8b9f6e]/30'
          }`}
          style={viewMode === 'greenhouse' ? {
            background: 'linear-gradient(180deg, #c4a574 0%, #b8956a 15%, #a67c52 40%, #8b6914 100%)',
            boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 2px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1)',
          } : undefined}
        >
          <div
            className="grid gap-3 sm:gap-4 p-4 sm:p-6"
            style={{
              gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${GRID_ROWS}, minmax(64px, 1fr))`,
            }}
          >
            {Array.from({ length: GRID_ROWS }, (_, row) =>
              Array.from({ length: GRID_COLS }, (_, col) => {
                const key = `${col},${row}`;
                const goal = goalByCell[key];
                const isMochi = mochiCell.x === col && mochiCell.y === row;
                const progressPct = goal
                  ? Math.min(100, ((goal.totalMinutes || 0) / ((goal.targetHours || 1) * 60)) * 100)
                  : 0;
                const nextMilestone = goal?.milestones?.find((m) => !m?.completed);
                const stage = goal ? getPlantStage(getGoalProgressPercent(goal)) : null;
                const isHarvest = stage === 'harvest';

                const isGreenhouse = viewMode === 'greenhouse';
                const cellClasses = isGreenhouse
                  ? goal
                    ? 'bg-gradient-to-br from-amber-100/95 to-amber-800/30 shadow-[0_2px_0_0_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_3px_0_0_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.25)] border border-amber-900/30 cursor-pointer'
                    : 'bg-amber-900/20 border border-amber-800/40 border-dashed shadow-inner cursor-pointer hover:bg-amber-800/25'
                  : goal
                    ? isHarvest
                      ? 'bg-gradient-to-br from-amber-50 to-moss-100/90 shadow-[0_4px_0_0_#a8c68a,0_8px_16px_-4px_rgba(94,114,52,0.2)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_#a8c68a,0_12px_24px_-4px_rgba(94,114,52,0.25)] cursor-pointer ring-1 ring-amber-300/30'
                      : 'bg-gradient-to-br from-[#e5f0dc] to-[#d4e8c8] shadow-[0_4px_0_0_#b8d4a0,0_8px_16px_-4px_rgba(94,114,52,0.15)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_#b8d4a0,0_12px_20px_-4px_rgba(94,114,52,0.2)] cursor-pointer'
                    : 'bg-white/40 border-2 border-dashed border-stone-300/80 hover:border-moss-400/60 hover:bg-moss-50/70 cursor-pointer shadow-sm backdrop-blur-[1px]';

                return (
                  <div
                    key={key}
                    className={`group relative aspect-square rounded-2xl transition-all duration-300 ease-out flex flex-col items-center justify-center hover:z-40 ${isGreenhouse ? '' : goal ? 'hover:-translate-y-0.5' : ''} ${cellClasses} ${goal?._projectGoal ? 'ring-2 ring-amber-400/40' : ''}`}
                  >
                  {goal && (
                    <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-48 p-3 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-stone-100 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 scale-95 group-hover:scale-100 flex flex-col gap-1">
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white/95" aria-hidden />
                      <h4 className="font-serif text-moss-900 text-sm font-semibold truncate">{goal.title}</h4>
                      <div className="flex justify-between items-center text-[10px] font-sans text-stone-500 mb-1">
                        <span className="uppercase tracking-wider font-semibold text-moss-600">
                          {goal._projectGoal ? 'project' : (goal.type || 'kaizen')}
                        </span>
                        <span>
                          {goal.totalMinutes ? Math.round(goal.totalMinutes / 60) : 0}h / {(goal.targetHours || 0)}h
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full bg-moss-400 rounded-full transition-[width] duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      {nextMilestone && (
                        <p className="text-[10px] text-stone-500 leading-tight mt-1 border-t border-stone-100 pt-1">
                          <span className="font-medium text-stone-700">Next:</span>{' '}
                          {typeof nextMilestone === 'object' && nextMilestone.title != null ? nextMilestone.title : String(nextMilestone)}
                        </p>
                      )}
                    </div>
                  )}

                  {goal ? (
                    <button
                      type="button"
                      onClick={() => handlePlantClick(goal, col, row)}
                      className={`w-full h-full min-h-[64px] flex flex-col items-center justify-center rounded-2xl border-0 bg-transparent hover:bg-black/[0.04] transition-colors focus:outline-none focus:ring-2 focus:ring-[#558b2f]/50 focus:ring-inset ${isProjectDone(goal) ? 'opacity-70' : ''}`}
                    >
                      <PixelPlant goal={goal} stage={getPlantStage(getGoalProgressPercent(goal))} type={goal._projectGoal ? 'project' : (goal.type || 'kaizen')} />
                      <span className={`font-sans text-xs mt-0.5 truncate max-w-full px-1 ${goal._projectGoal ? 'text-amber-700' : 'text-stone-600'}`}>
                        {goal.title}
                      </span>
                      {goal._projectGoal && (
                        <span className="font-sans text-[9px] text-amber-500 leading-none">project</span>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEmptyCellClick(col, row)}
                      className="w-full h-full min-h-[64px] flex items-center justify-center rounded-2xl border-0 bg-transparent hover:bg-moss-100/30 transition-colors focus:outline-none focus:ring-2 focus:ring-[#558b2f]/40 focus:ring-inset"
                    >
                      <span className="text-2xl text-stone-300 group-hover:text-moss-500 transition-colors duration-200 select-none" aria-hidden>+</span>
                    </button>
                  )}

                  {isMochi && (
                    <motion.div
                      layoutId="mochi-sprite"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      className="absolute inset-0 flex flex-col items-center justify-end pb-1 z-10 pointer-events-none"
                    >
                      <span
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-3 rounded-full opacity-40"
                        style={{
                          background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(0,0,0,0.35) 0%, transparent 70%)',
                          filter: 'blur(4px)',
                        }}
                        aria-hidden
                      />
                      <motion.span
                        className="relative text-4xl drop-shadow-md"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                      >
                        🐱
                      </motion.span>
                    </motion.div>
                  )}
                </div>
              );
            })
          )}
          </div>
          {/* Decorations layer: drag to reposition */}
          {decorations?.length > 0 && (
            <div
              ref={gridContainerRef}
              className="absolute inset-0 z-20 p-2 pointer-events-none"
              style={{ pointerEvents: 'auto' }}
              aria-hidden
            >
              <div className="absolute inset-0" onDragOver={handleGridDragOver} onDrop={handleDecorationDrop} />
              {decorations.map((d) => {
                const left = typeof d.x === 'number' ? `${d.x}%` : d.x;
                const top = typeof d.y === 'number' ? `${d.y}%` : d.y;
                const emoji = DECORATION_EMOJI[d.type] ?? '🪴';
                return (
                  <motion.div
                    key={d.id}
                    draggable
                    onDragStart={(e) => handleDecorationDragStart(e, d.id)}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                    onDrop={handleDecorationDrop}
                    className="absolute w-12 h-12 flex items-center justify-center cursor-grab active:cursor-grabbing text-3xl select-none rounded-full"
                    style={{
                      left,
                      top,
                      transform: 'translate(-50%, -50%)',
                      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12)) drop-shadow(0 2px 4px rgba(94,114,52,0.15))',
                    }}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 1.05 }}
                    title="Drag to move"
                  >
                    {emoji}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
        )}

      </div>

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
              <div className="mt-4">
                <p className="font-sans text-xs text-stone-400 mb-2">Move on grid</p>
                <div className="flex items-center justify-center gap-1 mb-3">
                  <button type="button" onClick={() => nudgeGoal(selectedGoal.id, -1, 0)} className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 font-sans text-sm flex items-center justify-center" aria-label="Move left">←</button>
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => nudgeGoal(selectedGoal.id, 0, -1)} className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 font-sans text-sm flex items-center justify-center" aria-label="Move up">↑</button>
                    <button type="button" onClick={() => nudgeGoal(selectedGoal.id, 0, 1)} className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 font-sans text-sm flex items-center justify-center" aria-label="Move down">↓</button>
                  </div>
                  <button type="button" onClick={() => nudgeGoal(selectedGoal.id, 1, 0)} className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 font-sans text-sm flex items-center justify-center" aria-label="Move right">→</button>
                </div>
              </div>
              <div className="flex gap-2">
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
            <span className="text-stone-300 font-sans">|</span>
            <button
              type="button"
              onClick={() => setIs3D((prev) => !prev)}
              className={`font-serif text-xl transition-colors rounded-lg px-2 py-1 ${is3D ? 'text-stone-800 font-semibold bg-stone-100' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
            >
              {is3D ? 'Switch to 2D View' : 'Switch to 3D View'}
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
          <button
            onClick={() => setShowShop(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-sans text-sm font-medium transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2"
            style={{
              background: 'linear-gradient(135deg, #4a5d23 0%, #3d4e1c 100%)',
              color: '#FDFCF5',
            }}
          >
            <span className="text-lg" aria-hidden>🛍️</span>
            Garden Shop
          </button>
        </div>
      </div>

      {showShop && <SpiritShop onClose={() => setShowShop(false)} />}
    </div>
  );
}
