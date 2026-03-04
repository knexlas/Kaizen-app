import { motion } from 'framer-motion';
import { DefaultSpiritSvg } from './MochiSpirit';

const THINKING_MESSAGES = [
  'Mochi is reading your garden…',
  'Arranging stones on the path…',
  'Brewing a fresh pot of tea…',
  'Listening to the wind…',
  'Studying the seasons…',
  'Counting stepping stones…',
  'Tending the soil…',
];

function pickMessage(seed) {
  return THINKING_MESSAGES[Math.abs(seed) % THINKING_MESSAGES.length];
}

/** Gentle animated dots — same rhythm as ThinkingDots but configurable size. */
function Dots({ size = 6, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="rounded-full bg-moss-400"
          style={{ width: size, height: size }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}

/**
 * Inline thinking indicator for AI-powered buttons.
 * Use instead of just changing button text to "…".
 * Shows animated dots with a contextual message.
 */
export function AiButtonThinking({ label = 'Thinking' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <motion.span
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="text-base"
      >
        🌱
      </motion.span>
      <span>{label}</span>
      <Dots size={4} />
    </span>
  );
}

/**
 * Card-level thinking indicator — replaces content area while AI is working.
 * Shows Mochi spirit with an animated thinking state and a rotating message.
 */
export function AiThinkingCard({ message, className = '' }) {
  const msg = message || pickMessage(Date.now());
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`flex flex-col items-center justify-center gap-3 py-8 px-4 ${className}`}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <DefaultSpiritSvg className="w-14 h-16 drop-shadow-sm" />
      </motion.div>
      <div className="flex flex-col items-center gap-1.5">
        <Dots size={6} />
        <p className="font-sans text-sm text-stone-500 text-center max-w-[220px]">{msg}</p>
      </div>
    </motion.div>
  );
}

/**
 * Full overlay for long operations (week/month planning).
 * Semi-transparent backdrop with centered Mochi animation.
 */
export function AiThinkingOverlay({ message, visible = true }) {
  if (!visible) return null;
  const msg = message || pickMessage(Date.now());
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-stone-50/80 dark:bg-slate-900/70 backdrop-blur-sm rounded-xl"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <DefaultSpiritSvg className="w-16 h-20 drop-shadow-md" />
      </motion.div>
      <Dots size={7} className="mt-3" />
      <p className="mt-2 font-sans text-sm text-stone-600 dark:text-stone-300 text-center max-w-[250px]">
        {msg}
      </p>
    </motion.div>
  );
}

export default AiThinkingCard;
