import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import SpiritShop from './SpiritShop';

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

function PixelPlant({ stage, isProject }) {
  const emoji = isProject ? (PROJECT_STAGE_EMOJI[stage] ?? '🫘') : (STAGE_EMOJI[stage] ?? '🌱');
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

export default function GardenWalk({ goals: goalsProp, onGoalClick, onOpenGoalCreator, onEditGoal }) {
  const { goals: contextGoals, decorations = [], updateDecorationPosition } = useGarden();
  const goals = goalsProp ?? contextGoals ?? [];

  const [positions, setPositions] = useState({});
  const [mochiCell, setMochiCell] = useState({ x: 1, y: 1 });
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [showShop, setShowShop] = useState(false);
  const [pendingPlantCell, setPendingPlantCell] = useState(null);
  const gridContainerRef = useRef(null);

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
    moveMochi(x, y);
    setSelectedGoal(goal);
  }, [moveMochi]);

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

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Cozy Tile Grid */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-[#7cb342]/40 shadow-lg">
        <div
          className="grid gap-0 p-2"
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
              const isEven = (col + row) % 2 === 0;
              const cellBg = isEven ? '#dcedc8' : '#c5e1a5';

              return (
                <div
                  key={key}
                  className="relative rounded-lg overflow-hidden"
                  style={{ backgroundColor: cellBg }}
                >
                  {goal ? (
                    <button
                      type="button"
                      onClick={() => handlePlantClick(goal, col, row)}
                      className={`w-full h-full min-h-[64px] flex flex-col items-center justify-center rounded-lg border border-transparent hover:border-[#9e9e9e]/25 transition-colors focus:outline-none focus:ring-2 ${
                        goal._projectGoal
                          ? 'bg-amber-50/90 hover:bg-amber-100/90 border-amber-300/40 focus:ring-amber-500/50'
                          : 'bg-[#dcedc8]/80 hover:bg-[#c8e6a0]/90 focus:ring-[#558b2f]/50'
                      } ${isProjectDone(goal) ? 'opacity-70' : ''}`}
                    >
                      <PixelPlant stage={getPlantStage(getGoalProgressPercent(goal))} isProject={!!goal._projectGoal} />
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
                      className="group w-full h-full min-h-[64px] flex items-center justify-center rounded-lg bg-black/[0.06] hover:bg-[#8d6e63]/15 transition-colors focus:outline-none focus:ring-2 focus:ring-[#558b2f]/40 focus:ring-inset"
                    >
                      <span className="text-xl text-white/0 group-hover:text-white/70 transition-colors duration-200 select-none" aria-hidden>+</span>
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
            className="absolute inset-0 z-20 p-2"
            onDragOver={handleGridDragOver}
            onDrop={handleDecorationDrop}
            style={{ pointerEvents: 'auto' }}
            aria-hidden
          >
            {decorations.map((d) => {
              const left = typeof d.x === 'number' ? `${d.x}%` : d.x;
              const top = typeof d.y === 'number' ? `${d.y}%` : d.y;
              const emoji = DECORATION_EMOJI[d.type] ?? '🪴';
              return (
                <div
                  key={d.id}
                  draggable
                  onDragStart={(e) => handleDecorationDragStart(e, d.id)}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={handleDecorationDrop}
                  className="absolute w-10 h-10 flex items-center justify-center cursor-grab active:cursor-grabbing text-2xl drop-shadow-sm hover:scale-110 transition-transform select-none"
                  style={{
                    left,
                    top,
                    transform: 'translate(-50%, -50%)',
                  }}
                  title="Drag to move"
                >
                  {emoji}
                </div>
              );
            })}
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
              className="w-full max-w-sm rounded-2xl bg-[#FDFCF5] border border-stone-200 shadow-xl p-6"
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
      <div className="flex justify-between items-center px-2">
        <h3 className="font-serif text-xl text-stone-800">My Garden</h3>
        <button
          onClick={() => setShowShop(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-stone-800 text-stone-50 rounded-lg font-sans text-sm hover:bg-stone-700 transition-colors shadow"
        >
          <span>🛍️</span> Garden Shop
        </button>
      </div>

      {showShop && <SpiritShop onClose={() => setShowShop(false)} />}
    </div>
  );
}
