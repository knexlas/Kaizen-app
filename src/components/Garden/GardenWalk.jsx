import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useGarden } from '../../context/GardenContext';
import { MochiSpirit } from '../Dashboard/MochiSpirit';
import { motion, AnimatePresence } from 'framer-motion';

// --- Growth stage from totalMinutes: 0=Seed, 1=Sprout, 2=Sapling, 3=Tree, 4=Bloom ---
function getTreeStage(totalMinutes = 0) {
  const mins = Number(totalMinutes) || 0;
  if (mins < 30) return 0;
  if (mins < 60) return 1;
  if (mins < 120) return 2;
  if (mins < 240) return 3;
  return 4;
}

/** Subtask vine color: red = deadline approaching, green = healthy/completed */
function getSubtaskVineStatus(st) {
  const deadline = st.deadline ? new Date(st.deadline) : null;
  const est = Number(st.estimatedHours) || 0;
  const done = Number(st.completedHours) || 0;
  const isComplete = est > 0 && done >= est;
  if (isComplete) return 'green';
  if (deadline) {
    const now = new Date();
    const daysLeft = (deadline - now) / (24 * 60 * 60 * 1000);
    if (daysLeft <= 3) return 'red';
  }
  return 'green';
}

// --- VISUAL COMPONENTS (Defined once) ---

// 1. The Organic Soil Base (for Trees)
function SoilBase({ width }) {
  const borderRadius = '30% 70% 70% 30% / 30% 30% 70% 70%';
  return (
    <div
      className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-stone-600 opacity-80 blur-sm"
      style={{ width: width || '80%', height: '20px', borderRadius, zIndex: 0 }}
    />
  );
}

// 2. Watercolor Tree (SVG) — stages 0–4
function WatercolorTree({ goal }) {
  const totalMinutes = goal.totalMinutes || 0;
  const stage = getTreeStage(totalMinutes);
  const subtasks = goal.subtasks ?? [];

  return (
    <div className="relative flex flex-col items-center group cursor-pointer transition-transform duration-500 hover:-translate-y-2">
      <svg viewBox="0 0 100 120" className="w-16 h-[120px] shrink-0" aria-hidden>
        <defs>
          <linearGradient id="trunk-grad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#5D4E37" />
            <stop offset="100%" stopColor="#6B5344" />
          </linearGradient>
          <linearGradient id="leaf-grad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#3A4A1C" />
            <stop offset="100%" stopColor="#4A5D23" />
          </linearGradient>
        </defs>
        {/* Soil mound (stages 0–4) */}
        <ellipse cx="50" cy="112" rx="28" ry="8" fill="#6B5344" stroke="#5D4E37" strokeWidth="1" />
        {/* Stage 0: Seed — brown dot in soil */}
        {stage === 0 && <circle cx="50" cy="108" r="4" fill="#5D4E37" stroke="#4A3C2A" strokeWidth="1" />}
        {/* Stage 1: Sprout — simple green curve */}
        {stage >= 1 && (
          <path
            d="M50 108 Q48 85 50 70 Q52 55 50 45"
            fill="none"
            stroke="url(#leaf-grad)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
        {/* Stage 2: Sapling — trunk + 2 small branches */}
        {stage >= 2 && (
          <>
            <path d="M50 108 L50 50" fill="none" stroke="url(#trunk-grad)" strokeWidth="3" strokeLinecap="round" />
            <path d="M50 65 L35 55" fill="none" stroke="url(#leaf-grad)" strokeWidth="2" strokeLinecap="round" />
            <path d="M50 55 L65 48" fill="none" stroke="url(#leaf-grad)" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {/* Stage 3: Tree — thicker trunk, more branches */}
        {stage >= 3 && (
          <>
            <path d="M50 108 L50 35" fill="none" stroke="url(#trunk-grad)" strokeWidth="4" strokeLinecap="round" />
            <path d="M50 70 L28 58" fill="none" stroke="url(#leaf-grad)" strokeWidth="2" strokeLinecap="round" />
            <path d="M50 58 L72 50" fill="none" stroke="url(#leaf-grad)" strokeWidth="2" strokeLinecap="round" />
            <path d="M50 45 L38 32" fill="none" stroke="url(#leaf-grad)" strokeWidth="2" strokeLinecap="round" />
            <path d="M50 38 L62 28" fill="none" stroke="url(#leaf-grad)" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {/* Stage 4: Bloom — pink/white circles at branch ends */}
        {stage >= 4 && (
          <>
            <circle cx="28" cy="58" r="5" fill="#F8E8EE" stroke="#E8B4B8" strokeWidth="1" />
            <circle cx="72" cy="50" r="5" fill="#F8E8EE" stroke="#E8B4B8" strokeWidth="1" />
            <circle cx="38" cy="32" r="4" fill="#F8E8EE" stroke="#E8B4B8" strokeWidth="1" />
            <circle cx="62" cy="28" r="4" fill="#F8E8EE" stroke="#E8B4B8" strokeWidth="1" />
          </>
        )}
        {/* Vines (subtasks) wrapping trunk — red = deadline near, green = healthy */}
        {subtasks.length > 0 && stage >= 2 && (
          <g>
            {subtasks.slice(0, 3).map((st, i) => {
              const isRed = getSubtaskVineStatus(st) === 'red';
              const q = (i + 1) / (subtasks.length + 1);
              const pathD = stage >= 3
                ? `M50 ${88 - i * 12} Q${50 + (i % 2 ? 1 : -1) * 18} ${75 - i * 10} ${50 + (i % 2 ? -1 : 1) * 22} ${55 - i * 8}`
                : `M50 ${78 - i * 8} Q${50 + (i % 2 ? 1 : -1) * 12} ${68 - i * 6} 50 ${58 - i * 6}`;
              return (
                <path
                  key={st.id}
                  d={pathD}
                  fill="none"
                  stroke={isRed ? '#B91C1C' : '#4A5D23'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity={0.9}
                />
              );
            })}
          </g>
        )}
      </svg>
      <SoilBase width="60%" />
      <span className="mt-2 px-2 py-0.5 bg-white/60 backdrop-blur-sm rounded text-[10px] font-medium text-stone-600 shadow-sm">
        {goal.title}
      </span>
    </div>
  );
}

// 3. Mossy Stone (SVG) — organic blob, moss via clipPath/mask, speckles
function MossyStone({ goal, progress }) {
  const p = Math.min(100, Math.max(0, progress)) / 100;
  const subtasks = goal.subtasks ?? [];
  const uid = `rock-${goal.id}`.replace(/\W/g, '');

  return (
    <div className="relative flex flex-col items-center justify-end transition-all duration-700 hover:scale-105 group cursor-pointer">
      <svg viewBox="0 0 100 80" className="w-24 h-[76px] shrink-0 relative" aria-hidden>
        <defs>
          <linearGradient id={`${uid}-stone`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="50%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
          <linearGradient id={`${uid}-moss`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#3A4A1C" />
            <stop offset="100%" stopColor="#4A5D23" />
          </linearGradient>
          <clipPath id={`${uid}-moss-clip`}>
            <rect x="0" y={80 - 80 * p} width="100" height={80 * p} />
          </clipPath>
        </defs>
        {/* Organic blob rock path */}
        <path
          d="M20 65 Q12 45 22 28 Q32 18 50 15 Q68 18 78 28 Q88 45 80 65 Q72 75 50 78 Q28 75 20 65 Z"
          fill={`url(#${uid}-stone)`}
          stroke="#475569"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Speckles / texture dots on rock */}
        {[52, 38, 62, 45, 55, 42, 48, 58, 35, 65, 44, 50].map((x, i) => (
          <circle
            key={i}
            cx={x}
            cy={25 + (i % 5) * 10 + (i % 3) * 4}
            r="1.2"
            fill="#334155"
            opacity="0.35"
          />
        ))}
        {/* Moss overlay — revealed by progress (bottom-up) */}
        <g clipPath={`url(#${uid}-moss-clip)`}>
          <path
            d="M20 65 Q12 45 22 28 Q32 18 50 15 Q68 18 78 28 Q88 45 80 65 Q72 75 50 78 Q28 75 20 65 Z"
            fill={`url(#${uid}-moss)`}
            fillOpacity="0.75"
            stroke="none"
          />
        </g>
        {/* Vines (subtasks) around rock */}
        {subtasks.length > 0 && (
          <g>
            {subtasks.slice(0, 4).map((st, i) => {
              const isRed = getSubtaskVineStatus(st) === 'red';
              const angle = (i / Math.max(1, subtasks.length)) * 200 + 20;
              const cx = 50 + 28 * Math.cos((angle * Math.PI) / 180);
              const cy = 42 + 22 * Math.sin((angle * Math.PI) / 180);
              const r = 18 + (i % 2) * 4;
              return (
                <path
                  key={st.id}
                  d={`M50 50 Q${cx + 5} ${cy} ${cx} ${cy} Q${cx - 5} ${cy + 8} ${50} ${52}`}
                  fill="none"
                  stroke={isRed ? '#B91C1C' : '#4A5D23'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              );
            })}
          </g>
        )}
      </svg>
      <span className="mt-2 px-3 py-1 bg-white/80 backdrop-blur-sm rounded-full text-xs font-bold text-stone-700 shadow-sm border border-stone-200 group-hover:bg-white transition-colors">
        {goal.title}
      </span>
      <span className="text-[10px] text-stone-500 font-medium mt-1">{Math.round(progress)}%</span>
    </div>
  );
}

// 4. The Vitality Pond (SVG)
function VitalityPond({ goals }) {
  return (
    <div className="relative flex flex-col items-center justify-end">
      <svg viewBox="0 0 120 40" className="w-32 h-12 shrink-0 overflow-visible" aria-hidden>
        <defs>
          <radialGradient id="pond-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.2" />
          </radialGradient>
        </defs>

        {/* The Water Surface */}
        <ellipse cx="60" cy="20" rx="55" ry="15" fill="url(#pond-grad)" stroke="#7DD3FC" strokeWidth="1" />

        {/* Koi Fish (Orange Dash) - Animated */}
        <path
          d="M30 20 Q45 25 60 20 T90 20"
          fill="none"
          stroke="#FB923C"
          strokeWidth="3"
          strokeLinecap="round"
          className="animate-pulse"
          opacity="0.6"
        />
      </svg>
      <span className="text-[10px] text-blue-800/60 font-medium -mt-2 relative z-10">Vitality Pond</span>
    </div>
  );
}

// Decorative: Wildflowers (random, non-purchased)
function Wildflowers({ x, y, color }) {
  return (
    <div className="absolute pointer-events-none opacity-60" style={{ left: x, top: y }}>
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="3" fill="#FDE047" />
        <circle cx="10" cy="5" r="4" fill={color} />
        <circle cx="10" cy="15" r="4" fill={color} />
        <circle cx="5" cy="10" r="4" fill={color} />
        <circle cx="15" cy="10" r="4" fill={color} />
      </svg>
    </div>
  );
}

const SHOP_ITEMS = [
  { type: 'lantern', label: 'Lantern', emoji: '🏮' },
  { type: 'bench', label: 'Bench', emoji: '🪑' },
  { type: 'pond', label: 'Pond', emoji: '💧' },
  { type: 'path', label: 'Path', emoji: '🪨' },
  { type: 'bush', label: 'Bush', emoji: '🌸' },
];

function DecorationIcon({ type }) {
  const t = type || 'path';
  if (t === 'lantern') return <span className="text-2xl" aria-hidden>🏮</span>;
  if (t === 'bench') return <span className="text-2xl" aria-hidden>🪑</span>;
  if (t === 'pond') return <span className="text-2xl" aria-hidden>💧</span>;
  if (t === 'bush') return <span className="text-2xl" aria-hidden>🌸</span>;
  return <span className="text-2xl" aria-hidden>🪨</span>;
}

function DraggableDecoration({ item, onUpdatePosition, placementMode }) {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0, left: 0, top: 0 });

  const handleMouseDown = useCallback(
    (e) => {
      if (!placementMode) return;
      e.preventDefault();
      setDragging(true);
      startRef.current = { x: e.clientX, y: e.clientY, left: parseFloat(String(item.x)) || 50, top: parseFloat(String(item.y)) || 50 };
    },
    [placementMode, item.x, item.y]
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const box = document.querySelector('[data-garden-container]');
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const deltaX = ((e.clientX - startRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - startRef.current.y) / rect.height) * 100;
      const newLeft = Math.max(0, Math.min(100, startRef.current.left + deltaX));
      const newTop = Math.max(0, Math.min(100, startRef.current.top + deltaY));
      const xPct = `${newLeft}%`;
      const yPct = `${newTop}%`;
      onUpdatePosition?.(item.id, xPct, yPct);
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging, item.id, onUpdatePosition]);

  const x = String(item.x).endsWith('%') ? item.x : `${item.x}%`;
  const y = String(item.y).endsWith('%') ? item.y : `${item.y}%`;
  return (
    <div
      className={`absolute z-10 ${placementMode ? 'cursor-move pointer-events-auto' : 'pointer-events-none'}`}
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
      onMouseDown={handleMouseDown}
      role={placementMode ? 'button' : undefined}
      aria-label={placementMode ? `Move ${item.type}` : undefined}
    >
      <div className={`rounded-lg bg-white/90 border border-stone-200 shadow-sm p-1 ${dragging ? 'ring-2 ring-moss-500' : ''}`}>
        <DecorationIcon type={item.type} />
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---

export default function GardenWalk({ onGoalClick }) {
  const { goals, spiritPoints = 0, decorations: purchasedDecorations = [], buyDecoration, updateDecorationPosition, decorationCosts = {} } = useGarden();
  const [showShop, setShowShop] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);
  const containerRef = useRef(null);

  const trees = useMemo(() => goals.filter(g => !g.type || g.type === 'kaizen'), [goals]);
  const rocks = useMemo(() => goals.filter(g => g.type === 'routine'), [goals]);
  const water = useMemo(() => goals.filter(g => g.type === 'vitality'), [goals]);

  const wildflowers = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: `wf-${i}`,
      x: `${Math.random() * 90}%`,
      y: `${60 + Math.random() * 30}%`,
      color: ['#F9A8D4', '#C084FC', '#818CF8'][i % 3],
    }));
  }, []);

  const getProgress = (g) => {
    if (!g.targetHours) return 0;
    const minutes = g.totalMinutes || 0;
    return (minutes / (g.targetHours * 60)) * 100;
  };

  return (
    <div className="relative w-full h-full min-h-[400px] overflow-hidden rounded-3xl border border-stone-200/50 shadow-inner bg-gradient-to-b from-stone-50 via-stone-100 to-stone-200">
      
      {/* --- ATMOSPHERE LAYERS --- */}
      
      {/* 1. Sky Gradient (Daytime) */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-100/40 to-transparent pointer-events-none" />

      {/* 2. Distant Mountains (Parallax Layer 1) */}
      <div className="absolute bottom-10 left-0 w-full h-32 bg-stone-300/30 blur-sm rounded-[50%_50%_0_0] scale-150 translate-y-10" />
      
      {/* 3. Fog/Mist (Parallax Layer 2 - Animated) */}
      <div className="absolute bottom-0 w-[200%] h-24 bg-white/40 blur-xl animate-float-slow pointer-events-none" />

      {/* 4. Fireflies (Particle Effect) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-1 h-1 bg-yellow-400 rounded-full blur-[1px] animate-pulse"
            style={{
              top: `${Math.random() * 80}%`,
              left: `${Math.random() * 100}%`,
              animationDuration: `${3 + Math.random() * 4}s`,
              opacity: 0.6
            }}
          />
        ))}
      </div>

      {/* 5. Decorative Wildflowers */}
      {wildflowers.map(dec => (
        <Wildflowers key={dec.id} x={dec.x} y={dec.y} color={dec.color} />
      ))}

      {/* Purchased decorations (draggable when placement mode on) */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 pointer-events-none" data-garden-container>
          {purchasedDecorations.map(item => (
            <DraggableDecoration
              key={item.id}
              item={item}
              onUpdatePosition={updateDecorationPosition}
              placementMode={placementMode}
            />
          ))}
        </div>
      </div>

      {/* Top bar: Spirit points + Move toggle + Shop */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-30 pointer-events-auto">
        <span className="text-stone-600 text-sm font-medium bg-white/80 backdrop-blur px-2 py-1 rounded-full shadow-sm">
          ✨ {spiritPoints}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlacementMode(p => !p)}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${placementMode ? 'bg-moss-500/20 border-moss-600 text-moss-800' : 'bg-white/80 border-stone-200 text-stone-600'}`}
          >
            Move
          </button>
          <button
            type="button"
            onClick={() => setShowShop(true)}
            className="text-xs px-2 py-1 rounded-full bg-white/80 border border-stone-200 text-stone-600 shadow-sm hover:bg-stone-50"
          >
            Shop
          </button>
        </div>
      </div>

      {/* Shop modal */}
      <AnimatePresence>
        {showShop && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowShop(false)}
          >
            <motion.div
              className="bg-[#FDFCF5] rounded-2xl border border-stone-200 shadow-xl p-4 w-full max-w-sm"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-stone-800 font-serif text-lg mb-2">Garden Shop</h3>
              <p className="text-stone-500 text-sm mb-3">Spend spirit points to decorate.</p>
              <ul className="space-y-2">
                {SHOP_ITEMS.map(({ type, label, emoji }) => {
                  const cost = decorationCosts[type] ?? 0;
                  const canAfford = spiritPoints >= cost;
                  return (
                    <li key={type}>
                      <button
                        type="button"
                        onClick={() => {
                          if (canAfford) buyDecoration(type);
                        }}
                        disabled={!canAfford}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-colors ${canAfford ? 'border-stone-200 hover:bg-stone-100' : 'border-stone-100 text-stone-400 cursor-not-allowed'}`}
                      >
                        <span><span className="text-xl mr-2" aria-hidden>{emoji}</span>{label}</span>
                        <span className="text-stone-500 text-sm">{cost} pts</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button type="button" onClick={() => setShowShop(false)} className="mt-3 w-full py-2 rounded-xl border border-stone-200 text-stone-600 text-sm">
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- GARDEN CONTENT --- */}

      <div className="absolute inset-0 flex flex-col justify-end pb-8 px-6">
        
        {/* Background: Trees (Kaizen) — clickable */}
        <div className="flex flex-wrap items-end justify-center gap-8 mb-4 opacity-90 relative z-10">
          {trees.map(goal => (
            <div
              key={goal.id}
              onClick={() => onGoalClick?.(goal)}
              className={onGoalClick ? 'cursor-pointer' : undefined}
            >
              <WatercolorTree goal={goal} />
            </div>
          ))}
          {trees.length === 0 && (
            <div className="text-stone-400 text-sm italic mb-10">Plant a seed to begin...</div>
          )}
        </div>

        {/* Foreground: Rocks (Routine) & Water (Vitality) — clickable */}
        <div className="flex items-end justify-center gap-12 relative z-20">
          
          {/* Left: Rocks */}
          <div className="flex items-end gap-4 relative">
            {rocks.map(goal => (
              <div
                key={goal.id}
                onClick={() => onGoalClick?.(goal)}
                className={onGoalClick ? 'cursor-pointer' : undefined}
              >
                <MossyStone goal={goal} progress={getProgress(goal)} />
              </div>
            ))}
            {/* Spirit: sitting on first rock if rocks exist, else floating near center */}
            <div
              className={`absolute flex items-end justify-center pointer-events-none ${
                rocks.length > 0
                  ? 'left-0 bottom-0 translate-y-1'
                  : 'left-1/2 -translate-x-1/2 bottom-0 translate-y-2'
              }`}
              style={rocks.length > 0 ? { width: '96px' } : { width: '80px' }}
              aria-hidden
            >
              <div className="drop-shadow-md">
                <MochiSpirit />
              </div>
            </div>
          </div>

          {/* Center/Right: Water */}
          {water.length > 0 && (
            <div className="mb-[-10px]">
              <VitalityPond goals={water} />
            </div>
          )}
        </div>

        {/* Ground Floor */}
        <div className="absolute bottom-0 left-0 w-full h-4 bg-gradient-to-t from-stone-300 to-transparent opacity-50 z-30" />
      </div>
    </div>
  );
}