import { motion } from 'framer-motion';
import SpiritBuilder from './SpiritBuilder';

export default function SpiritOrigins({ onComplete, onSkip }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] bg-slate-900 text-stone-100 flex flex-col items-center justify-center p-4"
    >
      <div className="relative z-10 w-full max-w-2xl">
        <h1 className="font-serif text-3xl md:text-4xl text-center mb-2 text-indigo-100">
          Summon Your Companion
        </h1>
        <p className="text-center text-indigo-200/60 mb-8 font-sans">
          Productivity is lonely. Let&apos;s make a friend.
        </p>

        <SpiritBuilder mode="create" onComplete={onComplete} />
        <button
          type="button"
          onClick={() => onSkip?.()}
          className="w-full text-center mt-6 text-xs text-slate-500 hover:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded py-1"
        >
          (Skip for now, I&apos;ll summon them later)
        </button>
      </div>
    </motion.div>
  );
}
