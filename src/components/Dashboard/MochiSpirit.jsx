import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';

const HEADS = { bunny: '🐰', cat: '🐱', bear: '🐻', fox: '🦊', bot: '🤖' };
const BODIES = { tea: '🍵', backpack: '🎒', scarf: '🧣', glowing: '✨' };
const AURA_CLASSES = {
  pink: 'bg-pink-200/80 ring-pink-300 shadow-pink-200/40',
  blue: 'bg-sky-200/80 ring-sky-300 shadow-sky-200/40',
  green: 'bg-moss-200/80 ring-moss-400 shadow-moss-200/40',
  gold: 'bg-amber-200/80 ring-amber-300 shadow-amber-200/40',
};

/**
 * Returns a short spirit message based on current context.
 * Priority: justFinishedSession > isOverloaded > weather storm.
 */
export function getSpiritAdvice(context = {}) {
  const { weather, isOverloaded, justFinishedSession } = context;
  if (justFinishedSession) {
    return 'Rest your eyes. The tea is warm.';
  }
  if (isOverloaded) {
    return 'You are carrying many stones. Is your pack too heavy?';
  }
  if (weather === 'storm') {
    return 'The terrain is rocky today. Move with intention.';
  }
  return null;
}

/** Default message when no context rule matches (e.g. for first land). */
export function getSpiritGreeting(context = {}) {
  return getSpiritAdvice(context) ?? 'One step at a time.';
}

/**
 * Immediate feedback after morning check-in, based on energy and the generated plan.
 * @param {number} energyModifier - From check-in: -2 = low, 0 = normal, 1 = high
 * @param {null|{ slotCount: number }} planSummary - If auto-plan ran, { slotCount }; otherwise null
 * @returns {string} Spirit message to show right after check-in closes
 */
export function getPlanReaction(energyModifier, planSummary) {
  const mod = Number(energyModifier) || 0;
  const slots = planSummary?.slotCount ?? 0;
  const isHeavy = slots >= 5;
  const isLight = slots > 0 && slots <= 3;

  if (mod <= -2) {
    if (isHeavy) {
      return "I see heavy stones in your path. I have moved the biggest ones to the side for today.";
    }
    return "The path is gentle today. Rest when you need it.";
  }
  if (mod >= 1) {
    if (isLight) {
      return "You are glowing today! I've added a challenge to your afternoon.";
    }
    return "Your path has many steps today. You have the energy for it.";
  }
  return "The path is clear. One step at a time.";
}

/** Animated dots for "thinking" state. Exported for SpiritChat. */
export function ThinkingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-stone-400"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  );
}

/** Speech bubble above the spirit: soft white rounded rect with a small tail. Supports thinking (dots) then speaking (text). */
export function SpeechBubble({ text, visible, isThinking = false }) {
  const showBubble = visible && (text || isThinking);
  if (!showBubble) return null;
  return (
    <AnimatePresence mode="wait">
      {showBubble && (
        <motion.div
          key={isThinking ? 'thinking' : 'speaking'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-[260px] min-w-[80px] px-4 py-3 rounded-2xl bg-white/95 shadow-lg border border-stone-100"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.06))' }}
        >
          {isThinking ? (
            <div className="flex justify-center py-0.5">
              <ThinkingDots />
            </div>
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="font-sans text-sm text-stone-700 leading-relaxed text-center"
            >
              {text}
            </motion.p>
          )}
          {/* Tail */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 rotate-45 bg-white border-r border-b border-stone-100"
            style={{ boxShadow: '2px 2px 4px rgba(0,0,0,0.04)' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Default spirit SVG (hand-drawn Mochi). */
function DefaultSpiritSvg() {
  return (
    <svg width="56" height="64" viewBox="0 0 60 70" fill="none" className="overflow-visible">
      <circle cx="30" cy="40" r="25" fill="white" filter="blur(15px)" opacity="0.4" />
      <path
        d="M15 45 C15 30, 20 10, 30 10 C40 10, 45 30, 45 45 C45 55, 40 60, 30 60 C20 60, 15 55, 15 45 Z"
        fill="white"
        stroke="#57534E"
        strokeWidth="1.5"
      />
      <circle cx="24" cy="38" r="2.5" fill="#2D2D2D" opacity="0.9" />
      <circle cx="36" cy="38" r="2.5" fill="#2D2D2D" opacity="0.9" />
      <circle cx="22" cy="42" r="3" fill="#FFB7B2" opacity="0.4" />
      <circle cx="38" cy="42" r="3" fill="#FFB7B2" opacity="0.4" />
      <path d="M28 42 Q30 44 32 42" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M30 10 Q35 0 40 5 Q35 10 30 10" fill="#8FA967" stroke="#57534E" strokeWidth="1.5" />
    </svg>
  );
}

/** Custom spirit from Spirit Builder: head + body emoji with aura. */
function CustomSpirit({ config }) {
  const headEmoji = HEADS[config.head] ?? '🐰';
  const bodyEmoji = BODIES[config.body] ?? '🍵';
  const auraClass = AURA_CLASSES[config.color] ?? AURA_CLASSES.green;
  return (
    <div className={`flex flex-col items-center justify-center w-14 h-16 rounded-2xl border-2 ring-2 ${auraClass} shadow-lg`}>
      <span className="text-2xl leading-none">{headEmoji}</span>
      <span className="text-lg mt-0.5">{bodyEmoji}</span>
    </div>
  );
}

/** The Mochi spirit character (hand-drawn look or custom avatar). Idle = gentle float; isWalking/isThinking = motion + glow. */
export function MochiSpirit({ isWalking = false, isThinking = false }) {
  const { spiritConfig } = useGarden();
  const breathingDuration = isThinking ? 0.25 : isWalking ? 0.4 : 0.2;
  const breathingY = isWalking || isThinking ? [0, -8, 0] : 0;
  const useFloat = !isWalking && !isThinking;
  const isCustom = spiritConfig && spiritConfig.head && spiritConfig.body;

  return (
    <motion.div
      className="drop-shadow-md"
      animate={
        isThinking
          ? {
              boxShadow: [
                '0 0 0 0 rgba(139, 115, 85, 0)',
                '0 0 20px 4px rgba(139, 115, 85, 0.15)',
                '0 0 0 0 rgba(139, 115, 85, 0)',
              ],
            }
          : {}
      }
      transition={
        isThinking
          ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 }
      }
    >
      <motion.div
        className={useFloat ? 'animate-float' : ''}
        animate={useFloat ? undefined : { y: breathingY }}
        transition={
          useFloat
            ? undefined
            : {
                duration: breathingDuration,
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      >
        {isCustom ? (
          <CustomSpirit config={spiritConfig} />
        ) : (
          <DefaultSpiritSvg />
        )}
      </motion.div>
    </motion.div>
  );
}

/** Spirit with optional speech bubble. message and showBubble control the dialogue. isThinking shows dots + spirit animation. */
export default function MochiSpiritWithDialogue({ message, showBubble = false, isWalking = false, isThinking = false }) {
  return (
    <div className="relative inline-flex flex-col items-center">
      <SpeechBubble text={message} visible={showBubble} isThinking={isThinking} />
      <MochiSpirit isWalking={isWalking} isThinking={isThinking} />
    </div>
  );
}
