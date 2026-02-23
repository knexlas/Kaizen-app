import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { useEnergy } from '../../context/EnergyContext';
import SpiritShop from './SpiritShop';
import Garden3D from './Garden3D';

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
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
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
  const { goals: contextGoals, decorations = [], fertilizerCount = 0, fertilizeGoal, dailySpoonCount, activeTool, setActiveTool } = useGarden();
  const { dailyEnergy } = useEnergy();
  const spoons = typeof dailySpoonCount === 'number' ? dailySpoonCount : dailyEnergy;
  const energyTier = getEnergyTier(spoons);
  const gradientStyle = GARDEN_GRADIENTS[energyTier];
  const allGoals = goalsProp ?? contextGoals ?? [];

  const [viewMode, setViewMode] = useState('garden'); // 'garden' | 'greenhouse'
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [isShopOpen, setIsShopOpen] = useState(false);
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
        <div className="m-2 sm:m-3 h-[70vh] w-full rounded-3xl overflow-hidden relative">
          <Garden3D />
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

        {/* Toolbelt — bottom center overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-2 px-3 py-2 rounded-2xl bg-stone-800/90 backdrop-blur-sm shadow-lg border border-stone-600/50">
          {toolBtn('water', 'Water', '💧')}
          {toolBtn('stone', 'Stone', '🪨')}
          {toolBtn('sand', 'Sand', '🏖️')}
          {toolBtn('grass', 'Grass (Eraser)', '🌱')}
          {firstUnplacedGoal && (
            <button
              type="button"
              onClick={() => setActiveTool({ type: 'plant', goalId: firstUnplacedGoal.id })}
              className={`px-3 py-2 rounded-xl font-sans text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 ${
                activeTool?.type === 'plant' && activeTool?.goalId === firstUnplacedGoal.id
                  ? 'ring-2 ring-moss-500 scale-105 bg-white shadow-md border-2 border-moss-400 text-stone-800'
                  : 'bg-white/95 border border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300'
              }`}
            >
              <span className="mr-1" aria-hidden>🎒</span>
              Plant Next Seed
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
          <button
            onClick={() => setIsShopOpen(true)}
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

    </div>
  );
}
