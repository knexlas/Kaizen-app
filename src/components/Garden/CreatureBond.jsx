import { motion } from 'framer-motion';

const CREATURE_INFO = {
  rabbit: { name: 'Rabbit', emoji: '🐇', bonus: '+1 soil nutrient/day', bonusIcon: '🌿' },
  frog: { name: 'Frog', emoji: '🐸', bonus: '+1 water drop on rainy days', bonusIcon: '💧' },
  owl: { name: 'Owl', emoji: '🦉', bonus: '+2 Embers from night sessions', bonusIcon: '🔥' },
  butterfly: { name: 'Butterfly', emoji: '🦋', bonus: '+1 Ember per compost item', bonusIcon: '♻️' },
  fish: { name: 'Koi', emoji: '🐟', bonus: '+1 water drop/day', bonusIcon: '💧' },
  deer: { name: 'Deer', emoji: '🦌', bonus: 'Streak shield (1 missed day forgiven)', bonusIcon: '🛡️' },
};

function Hearts({ level, max = 5 }) {
  return (
    <div className="flex gap-0.5" aria-label={`Bond level ${level} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`text-xs ${i < level ? 'opacity-100' : 'opacity-20'}`}
          aria-hidden
        >
          ❤️
        </span>
      ))}
    </div>
  );
}

export default function CreatureBond({ creatureId, bond = {}, onFeed, onClose, className = '' }) {
  const info = CREATURE_INFO[creatureId] || { name: creatureId, emoji: '🐾', bonus: 'Companion', bonusIcon: '✨' };
  const { bondLevel = 0, fedCount = 0 } = bond;
  const nextFeedAt = (Math.floor(fedCount / 3) + 1) * 3;
  const feedsToNextLevel = bondLevel < 5 ? nextFeedAt - fedCount : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      transition={{ duration: 0.2 }}
      className={`pointer-events-auto bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-xl border border-stone-200/60 dark:border-slate-600/40 p-4 w-72 ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-3xl" aria-hidden>{info.emoji}</span>
          <div>
            <h3 className="font-serif text-sm font-semibold text-stone-800 dark:text-stone-200">{info.name}</h3>
            <Hearts level={bondLevel} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Passive bonus */}
      <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-amber-50/60 dark:bg-amber-900/20 border border-amber-200/40 dark:border-amber-700/30 mb-3">
        <span className="text-sm" aria-hidden>{info.bonusIcon}</span>
        <p className="font-sans text-xs text-amber-800 dark:text-amber-300">
          {bondLevel > 0 ? info.bonus : 'Feed to unlock bonus'}
        </p>
      </div>

      {/* Feed progress */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-sans text-xs text-stone-500 dark:text-stone-400">
          {bondLevel < 5 ? (
            <span>{feedsToNextLevel} feed{feedsToNextLevel !== 1 ? 's' : ''} to next heart</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400 font-semibold">Max bond!</span>
          )}
        </div>
        <span className="font-sans text-[10px] text-stone-400 dark:text-stone-500">
          Fed {fedCount} time{fedCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Feed button */}
      {bondLevel < 5 && onFeed && (
        <button
          type="button"
          onClick={() => onFeed(creatureId)}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-moss-500 to-moss-600 hover:from-moss-600 hover:to-moss-700 text-white font-sans text-sm font-semibold shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/40 flex items-center justify-center gap-2"
        >
          <span aria-hidden>🌾</span>
          Feed {info.name}
        </button>
      )}
    </motion.div>
  );
}
