import { useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { MochiSpirit } from '../Dashboard/MochiSpirit';
import SpiritShop from './SpiritShop';

// --- Visual Assets (SVG Components) ---

// A soft isometric tile for the ground
const IsoTile = ({ x, y, delay }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: delay * 0.05, duration: 0.5 }}
    className="absolute w-24 h-14"
    style={{
      left: x,
      top: y,
      backgroundImage: 'linear-gradient(to bottom, #f0fdf4, #dcfce7)',
      transform: 'rotateX(60deg) rotateZ(-45deg)',
      borderRadius: '12px',
      boxShadow: '4px 4px 0px #bbf7d0',
      zIndex: 1
    }}
  />
);

// Custom SVG Plants that look better than emojis
const PlantSVG = ({ stage, colorClass }) => {
  // Seed
  if (stage === 'seed') {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40" className="drop-shadow-sm">
        <circle cx="20" cy="32" r="6" fill="#78350f" />
        <path d="M20 32 Q20 20 26 18" stroke="#84cc16" strokeWidth="3" fill="none" />
        <circle cx="26" cy="18" r="3" fill="#84cc16" />
      </svg>
    );
  }
  // Sprout
  if (stage === 'sprout') {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-md">
        <path d="M24 40 Q24 20 14 15" stroke="#65a30d" strokeWidth="3" fill="none" />
        <path d="M24 40 Q24 20 34 15" stroke="#65a30d" strokeWidth="3" fill="none" />
        <ellipse cx="14" cy="15" rx="5" ry="3" fill="#84cc16" transform="rotate(-20 14 15)" />
        <ellipse cx="34" cy="15" rx="5" ry="3" fill="#84cc16" transform="rotate(20 34 15)" />
      </svg>
    );
  }
  // Bloom/Harvest
  const flowerColor = stage === 'harvest' ? '#fbbf24' : '#f472b6'; // Gold or Pink
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="drop-shadow-lg">
      <path d="M32 56 Q32 30 32 20" stroke="#4d7c0f" strokeWidth="4" fill="none" />
      <path d="M32 40 Q10 30 15 20" stroke="#65a30d" strokeWidth="3" fill="none" />
      <path d="M32 40 Q54 30 49 20" stroke="#65a30d" strokeWidth="3" fill="none" />
      <circle cx="32" cy="18" r="10" fill={flowerColor} />
      <circle cx="32" cy="18" r="4" fill="#fff" opacity="0.6" />
    </svg>
  );
};

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
function hashToUnit(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

function getGoalProgressPercent(goal) {
  const total = Number(goal?.totalMinutes) || 0;
  const target = (Number(goal?.targetHours) || 0) * 60 || (Number(goal?.estimatedMinutes) || 60);
  return clamp((total / target) * 100, 0, 100);
}

function getPlantStage(pct) {
  if (pct < 10) return 'seed';
  if (pct < 50) return 'sprout';
  if (pct < 100) return 'bloom';
  return 'harvest';
}

export default function GardenWalk({ goals: goalsProp, onGoalClick }) {
  const containerRef = useRef(null);
  const { goals: contextGoals } = useGarden();
  const goals = goalsProp ?? contextGoals ?? [];
  const [showShop, setShowShop] = useState(false);

  // Generate deterministic positions based on Goal ID so they stay put
  const placedGoals = useMemo(() => {
    return goals.map(g => {
      const u = hashToUnit(g.id);
      const v = hashToUnit(g.id + 'y');
      return {
        ...g,
        x: 10 + u * 80, // Keep away from edges
        y: 15 + v * 60,
        stage: getPlantStage(getGoalProgressPercent(g))
      };
    });
  }, [goals]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* The Garden Canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-[600px] rounded-3xl overflow-hidden bg-[#FDFCF5] border border-stone-200 shadow-inner group"
      >
        {/* Background Elements */}
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ backgroundImage: 'radial-gradient(#e7e5e4 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />

        {/* Render Plants */}
        <AnimatePresence>
          {placedGoals.map((goal) => (
            <motion.button
              key={goal.id}
              onClick={() => onGoalClick?.(goal)}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, top: `${goal.y}%`, left: `${goal.x}%` }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.1, y: -5 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="absolute flex flex-col items-center justify-center z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none group"
            >
              {/* Tooltip on Hover */}
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl text-xs font-serif text-stone-700 shadow-sm border border-stone-100 whitespace-nowrap pointer-events-none">
                {goal.title} ({Math.round(getGoalProgressPercent(goal))}%)
              </div>

              <PlantSVG stage={goal.stage} />
            </motion.button>
          ))}
        </AnimatePresence>

        {/* Floating Mochi Spirit (Purely visual companion) */}
        <div className="absolute bottom-6 right-6 pointer-events-none scale-75 opacity-90">
           <MochiSpirit isWalking />
        </div>

        {/* Empty State */}
        {goals.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-stone-400 font-serif opacity-60">
            The soil is ready. Plant a seed to begin.
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="flex justify-between items-center px-2">
         <h3 className="font-serif text-xl text-stone-800">My Garden</h3>
         <button
          onClick={() => setShowShop(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-stone-800 text-stone-50 rounded-full font-sans text-sm hover:bg-stone-700 transition-colors shadow-lg shadow-stone-200"
         >
           <span>🛍️</span> Garden Shop
         </button>
      </div>

      {showShop && <SpiritShop onClose={() => setShowShop(false)} />}
    </div>
  );
}
