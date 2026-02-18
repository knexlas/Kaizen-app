import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { MochiSpirit } from '../Dashboard/MochiSpirit';
import SpiritShop from './SpiritShop';

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function hashToUnit(str, salt = 0) {
  const s = String(str ?? '');
  let h = 2166136261 + salt;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 999;
}

function getGoalProgressPercent(goal) {
  const totalMinutes = Number(goal?.totalMinutes) || 0;
  const targetHours = Number(goal?.targetHours) || 0;
  const estimatedMinutes = Number(goal?.estimatedMinutes) || 0;
  const denomMinutes = targetHours > 0 ? targetHours * 60 : estimatedMinutes > 0 ? estimatedMinutes : 60;
  if (denomMinutes <= 0) return 0;
  return clamp((totalMinutes / denomMinutes) * 100, 0, 100);
}

function getPlantStage(progressPct) {
  const p = clamp(Number(progressPct) || 0, 0, 100);
  if (p <= 10) return 'seed';
  if (p < 40) return 'sprout';
  if (p < 80) return 'growth';
  if (p < 100) return 'bloom';
  return 'harvest';
}

const PLANT_EMOJI = { seed: '🕳️', sprout: '🌱', growth: '🌿', bloom: '🌷', harvest: '🌳' };

function DecorationIcon({ type }) {
  const t = type || 'path';
  if (t === 'lantern') return <span className="text-2xl" aria-hidden>🏮</span>;
  if (t === 'bench') return <span className="text-2xl" aria-hidden>🪑</span>;
  if (t === 'pond') return <span className="text-2xl" aria-hidden>🐟</span>;
  if (t === 'bush') return <span className="text-2xl" aria-hidden>🌸</span>;
  if (t === 'torii') return <span className="text-2xl" aria-hidden>⛩️</span>;
  if (t === 'cherry') return <span className="text-2xl" aria-hidden>🌸</span>;
  return <span className="text-2xl" aria-hidden>🪨</span>;
}

/** Single decoration: draggable, in edit mode shows wobble + X to remove. */
function DraggableDecoration({
  item,
  containerRef,
  onUpdatePosition,
  onRemove,
  editMode,
  onPondClick,
}) {
  const xPct = String(item.x).endsWith('%') ? parseFloat(item.x) : Number(item.x) || 50;
  const yPct = String(item.y).endsWith('%') ? parseFloat(item.y) : Number(item.y) || 50;
  const isPond = item.type === 'pond';

  const handleDragEnd = useCallback(
    (_e, info) => {
      const container = containerRef?.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const node = info.node.getBoundingClientRect();
      const centerX = node.left - rect.left + node.width / 2;
      const centerY = node.top - rect.top + node.height / 2;
      const newX = clamp((centerX / rect.width) * 100, 0, 100);
      const newY = clamp((centerY / rect.height) * 100, 0, 100);
      onUpdatePosition?.(item.id, `${newX}%`, `${newY}%`);
    },
    [item.id, onUpdatePosition, containerRef]
  );

  const handleClick = useCallback(
    (e) => {
      if (editMode) return;
      if (isPond) {
        e.stopPropagation();
        onPondClick?.();
      }
    },
    [editMode, isPond, onPondClick]
  );

  return (
    <motion.div
      className="absolute z-10 cursor-grab active:cursor-grabbing"
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        x: '-50%',
        y: '-50%',
      }}
      drag
      dragConstraints={containerRef}
      dragElastic={0}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      animate={
        editMode
          ? {
              rotate: [0, -1.5, 1.5, 0],
              transition: { duration: 0.5, repeat: Infinity, repeatDelay: 0.3 },
            }
          : {}
      }
      onClick={handleClick}
    >
      <div
        className={`rounded-lg bg-white/90 border border-stone-200 shadow-sm p-1 select-none touch-none ${
          isPond && !editMode ? 'cursor-pointer hover:ring-2 hover:ring-amber-300/60' : ''
        }`}
      >
        <div className="relative">
          <DecorationIcon type={item.type} />
          {editMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove?.(item.id);
              }}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500"
              aria-label={`Remove ${item.type}`}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Spirit avatar that slowly follows mouse or click position. */
function SpiritAvatar({ containerRef }) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const targetRef = useRef({ x: 50, y: 50 });
  const rafRef = useRef(null);
  const LERP = 0.03;

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const handleMove = (clientX, clientY) => {
      const rect = container.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      targetRef.current = { x: clamp(x, 5, 95), y: clamp(y, 5, 95) };
    };

    const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const onClick = (e) => {
      if (e.target === container || container.contains(e.target)) handleMove(e.clientX, e.clientY);
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('click', onClick, true);
    return () => {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('click', onClick, true);
    };
  }, [containerRef]);

  useEffect(() => {
    const tick = () => {
      setPosition((prev) => ({
        x: prev.x + (targetRef.current.x - prev.x) * LERP,
        y: prev.y + (targetRef.current.y - prev.y) * LERP,
      }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <motion.div
      className="absolute z-20 pointer-events-none"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        x: '-50%',
        y: '-50%',
      }}
      transition={{ type: 'tween', duration: 0.15 }}
    >
      <div className="scale-75 origin-center">
        <MochiSpirit />
      </div>
    </motion.div>
  );
}

/** Koi pond click: ripple + floating hearts/fish. */
function KoiReaction({ show, onComplete }) {
  const icons = ['🐟', '❤️', '🐟', '❤️', '🐟'];
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onComplete?.(), 2500);
    return () => clearTimeout(t);
  }, [show, onComplete]);

  if (!show) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
      {/* Ripple */}
      <motion.div
        className="absolute w-24 h-24 rounded-full border-2 border-amber-300/60"
        initial={{ scale: 0.3, opacity: 0.8 }}
        animate={{ scale: 2.5, opacity: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      {icons.map((icon, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl"
          initial={{ scale: 0, y: 0, opacity: 1 }}
          animate={{
            scale: 1,
            y: -80 - (i % 3) * 15,
            opacity: 0,
          }}
          transition={{
            duration: 1.5,
            delay: i * 0.1,
            ease: 'easeOut',
          }}
          style={{
            left: `${28 + i * 11}%`,
            top: '50%',
          }}
        >
          {icon}
        </motion.span>
      ))}
    </div>
  );
}

export default function GardenWalk({ goals: goalsProp, onGoalClick }) {
  const containerRef = useRef(null);
  const {
    goals: contextGoals,
    decorations,
    updateDecorationPosition,
    removeDecoration,
  } = useGarden();
  const goals = goalsProp ?? contextGoals ?? [];

  const [editMode, setEditMode] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [koiReaction, setKoiReaction] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const activeGoals = useMemo(() => goals.filter((g) => g?.id), [goals]);

  const handlePondClick = useCallback(() => {
    setKoiReaction(true);
    setToastMessage('The fish are happy.');
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const handleKoiReactionComplete = useCallback(() => setKoiReaction(false), []);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Canvas: full width/height, min-height 600px */}
      <div
        ref={containerRef}
        data-garden-container
        className="relative w-full min-h-[600px] rounded-2xl border border-[#4A5D23]/30 shadow-inner overflow-hidden bg-gradient-to-b from-[#5a6f2a] via-[#4A5D23] to-[#3d4e1c]"
        aria-label="Your garden"
      >
        {/* Goals (plants) */}
        <div className="absolute inset-0 pt-6 pb-10">
          {activeGoals.length === 0 ? (
            <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-sans text-sm text-white/80 bg-black/10 px-4 py-2 rounded-xl">
              Plant a goal to begin your garden.
            </p>
          ) : (
            activeGoals.map((g) => {
              const progress = getGoalProgressPercent(g);
              const stage = getPlantStage(progress);
              const x = 8 + hashToUnit(g.id, 11) * 84;
              const y = 12 + hashToUnit(g.id, 29) * 70;
              const animationDelay = hashToUnit(g.id, 47) * 0.8;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onGoalClick?.(g)}
                  className="absolute outline-none group cursor-pointer border-0 bg-transparent p-0 z-[5]"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    animationDelay: `${animationDelay}s`,
                  }}
                  aria-label={g.title}
                >
                  <span
                    className={`inline-flex items-center justify-center text-4xl drop-shadow-md transition-transform duration-200 group-hover:scale-110 ${
                      stage === 'harvest' ? 'drop-shadow-[0_0_12px_rgba(253,230,138,0.8)]' : ''
                    } animate-plant-sway`}
                    style={{ display: 'block' }}
                    aria-hidden
                  >
                    {PLANT_EMOJI[stage] ?? PLANT_EMOJI.seed}
                  </span>
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full w-40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 z-10">
                    <span className="block rounded-lg border border-stone-200 bg-white/95 backdrop-blur px-3 py-2 shadow-lg font-sans text-sm font-medium text-stone-800 truncate">
                      {g.title}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Decorations (absolute x,y, draggable) */}
        {decorations?.map((item) => (
          <DraggableDecoration
            key={item.id}
            item={item}
            containerRef={containerRef}
            onUpdatePosition={updateDecorationPosition}
            onRemove={removeDecoration}
            editMode={editMode}
            onPondClick={handlePondClick}
          />
        ))}

        {/* Spirit (Mochi) floating avatar */}
        <SpiritAvatar containerRef={containerRef} />

        {/* Koi reaction overlay */}
        <KoiReaction show={koiReaction} onComplete={handleKoiReactionComplete} />

        {/* Toast: "The fish are happy." */}
        {toastMessage && (
          <motion.div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-white/95 shadow-lg border border-stone-200 font-serif text-stone-800 text-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {toastMessage}
          </motion.div>
        )}
      </div>

      {/* Toolbar: Rearrange + Shop FAB */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setEditMode((prev) => !prev)}
          className={`font-sans text-sm font-medium px-4 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#4A5D23]/40 ${
            editMode
              ? 'bg-[#4A5D23] text-[#FDFCF5] border-[#4A5D23]'
              : 'bg-[#FDFCF5] text-stone-700 border-stone-200 hover:bg-stone-100'
          }`}
        >
          {editMode ? 'Done' : 'Rearrange'}
        </button>
        <button
          type="button"
          onClick={() => setShowShop(true)}
          className="font-sans text-sm font-medium px-5 py-2.5 rounded-full bg-[#4A5D23] text-[#FDFCF5] shadow-md hover:bg-[#3d4e1c] focus:outline-none focus:ring-2 focus:ring-[#4A5D23]/40 flex items-center gap-2"
          aria-label="Open Spirit Shop"
        >
          <span aria-hidden>🛒</span>
          Shop
        </button>
      </div>

      {/* Goal cards list (below canvas) */}
      <div className="rounded-2xl border border-stone-200 bg-[#FDFCF5] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-serif text-stone-900 text-lg">Your Plants</h3>
          <p className="font-sans text-xs text-stone-500">Hover plants above for details.</p>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {goals.map((g) => {
            const progress = getGoalProgressPercent(g);
            const stage = getPlantStage(progress);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onGoalClick?.(g)}
                className="text-left rounded-xl border border-stone-200 bg-white px-4 py-3 hover:bg-stone-50 transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <span className="text-xl" aria-hidden>
                      {PLANT_EMOJI[stage] ?? PLANT_EMOJI.seed}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-sm font-medium text-stone-900 truncate">{g.title}</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${progress >= 100 ? 'bg-amber-400' : progress >= 80 ? 'bg-pink-400' : 'bg-moss-600'}`}
                        style={{ width: `${clamp(progress, 0, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 font-sans text-xs text-stone-500 tabular-nums">{Math.round(progress)}%</p>
                  </div>
                </div>
              </button>
            );
          })}
          {goals.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-stone-300 bg-white/50 p-6 text-center">
              <p className="font-sans text-sm text-stone-500">No goals yet. Plant a seed to make your garden come alive.</p>
            </div>
          )}
        </div>
      </div>

      {showShop && <SpiritShop onClose={() => setShowShop(false)} />}
    </div>
  );
}
