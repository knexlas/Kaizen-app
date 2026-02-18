import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { DefaultSpiritSvg } from '../Dashboard/MochiSpirit';

const ARCHETYPES = [
  {
    id: 'mochi',
    name: 'Mochi',
    title: 'The Spirit',
    emoji: '🐱',
    description: 'Round, comforting, calm.',
    colorClass: 'bg-amber-100 border-amber-300 ring-amber-300/50',
    glowClass: 'shadow-amber-200/40',
  },
  {
    id: 'cat',
    name: 'Neko',
    title: 'The Cat',
    emoji: '🐱',
    description: 'Curious, playful, warm.',
    colorClass: 'bg-amber-100 border-amber-300 ring-amber-300/50',
    glowClass: 'shadow-amber-200/40',
  },
  {
    id: 'ember',
    name: 'Ember',
    title: 'The Flame',
    emoji: '🔥',
    description: 'Energetic, warm, motivating.',
    colorClass: 'bg-orange-100 border-orange-300 ring-orange-300/50',
    glowClass: 'shadow-orange-200/40',
  },
  {
    id: 'nimbus',
    name: 'Nimbus',
    title: 'The Cloud',
    emoji: '☁️',
    description: 'Soft, floating, gentle.',
    colorClass: 'bg-sky-100 border-sky-300 ring-sky-300/50',
    glowClass: 'shadow-sky-200/40',
  },
  {
    id: 'custom',
    name: 'Assembler',
    title: 'Custom',
    emoji: '🎨',
    description: 'Build your own form.',
    colorClass: 'bg-stone-100 border-stone-300 ring-stone-300/50',
    glowClass: 'shadow-stone-200/40',
  },
];

const HEADS = { bunny: '🐰', cat: '🐱', bear: '🐻', fox: '🦊', bot: '🤖' };
const BODIES = { tea: '🍵', backpack: '🎒', scarf: '🧣', glowing: '✨' };
const AURA_CLASSES = {
  pink: 'bg-pink-200/80 ring-pink-300 shadow-pink-200/40',
  blue: 'bg-sky-200/80 ring-sky-300 shadow-sky-200/40',
  green: 'bg-moss-200/80 ring-moss-400 shadow-moss-200/40',
  gold: 'bg-amber-200/80 ring-amber-300 shadow-amber-200/40',
};

const CONTRACT_TEXT = 'I am here to help you carry the load, not to judge you.';

export default function SpiritBuilder({ onComplete, mode = 'create', initialConfig = null }) {
  const { spiritConfig, setSpiritConfig } = useGarden();
  const source = initialConfig ?? spiritConfig;
  const [step, setStep] = useState(1);
  const [name, setName] = useState(source?.name?.trim() || '');
  const [type, setType] = useState(
    source?.type && (ARCHETYPES.some((a) => a.id === source.type) || source.type === 'custom') ? source.type : 'mochi'
  );
  const [customHead, setCustomHead] = useState(source?.head || 'bunny');
  const [customBody, setCustomBody] = useState(source?.body || 'tea');
  const [customColor, setCustomColor] = useState(source?.color || 'green');
  const [poofing, setPoofing] = useState(false);

  const selectedArchetype = ARCHETYPES.find((a) => a.id === type) ?? ARCHETYPES[0];
  const nameTrimmed = name.trim();

  const handleFinish = () => {
    const config =
      type === 'custom'
        ? { name: nameTrimmed || 'Mochi', type: 'custom', head: customHead, body: customBody, color: customColor }
        : { name: nameTrimmed || selectedArchetype.name, type };
    setPoofing(true);
    setTimeout(() => {
      setSpiritConfig(config);
      setPoofing(false);
      onComplete?.(config);
    }, mode === 'edit' ? 650 : 350);
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 bg-[#FDFCF5] rounded-2xl border border-stone-200 relative overflow-hidden shadow-inner">
      {poofing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" aria-hidden>
          <div className="animate-poof-burst w-32 h-32 rounded-full bg-amber-200/80 mix-blend-lighten" />
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-sm flex flex-col items-center text-center"
          >
            <h2 className="font-serif text-stone-900 text-xl mb-1">The Name</h2>
            <p className="font-sans text-stone-600 text-sm mb-6">
              What should we call your spirit companion?
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mochi"
              className="w-full py-3 px-4 rounded-xl border-2 border-stone-200 bg-white font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 text-center"
              aria-label="Spirit companion name"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-8 px-8 py-3 font-sans text-stone-50 bg-moss-600 rounded-xl hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
            >
              Next
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-lg flex flex-col items-center text-center"
          >
            <h2 className="font-serif text-stone-900 text-xl mb-1">The Shape</h2>
            <p className="font-sans text-stone-600 text-sm mb-6">Choose your companion’s essence.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
              {ARCHETYPES.map((arch) => (
                <button
                  key={arch.id}
                  type="button"
                  onClick={() => setType(arch.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 ${
                    type === arch.id
                      ? `${arch.colorClass} ring-2 ${arch.glowClass} shadow-lg`
                      : 'bg-stone-50 border-stone-200 hover:border-stone-300 hover:bg-stone-100'
                  }`}
                >
                  <span className="flex items-center justify-center w-12 h-12 shrink-0 overflow-visible" aria-hidden>
                    {arch.id === 'mochi' ? (
                      <DefaultSpiritSvg className="w-full h-full overflow-visible" />
                    ) : (
                      <span className="text-4xl leading-none">{arch.emoji}</span>
                    )}
                  </span>
                  <span className="font-serif text-stone-900 font-medium">{arch.title}</span>
                  <span className="font-sans text-xs text-stone-500">{arch.description}</span>
                </button>
              ))}
            </div>
            {type === 'custom' && (
              <div className="mt-6 space-y-4 w-full p-4 bg-white rounded-xl border border-stone-200">
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-2">Head</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {Object.entries(HEADS).map(([id, emoji]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setCustomHead(id)}
                        className={`text-2xl p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${customHead === id ? 'bg-stone-200' : 'hover:bg-stone-100'}`}
                        title={id}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-2">Body</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {Object.entries(BODIES).map(([id, emoji]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setCustomBody(id)}
                        className={`text-2xl p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${customBody === id ? 'bg-stone-200' : 'hover:bg-stone-100'}`}
                        title={id}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-2">Aura</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {Object.entries(AURA_CLASSES).map(([id, className]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setCustomColor(id)}
                        className={`w-10 h-10 rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${className} ${customColor === id ? 'ring-2 ring-stone-600 ring-offset-2' : ''}`}
                        title={id}
                        aria-label={`Aura ${id}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-6 py-2.5 font-sans text-stone-600 bg-stone-100 rounded-xl hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-8 py-3 font-sans text-stone-50 bg-moss-600 rounded-xl hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
              >
                Next
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-sm flex flex-col items-center text-center"
          >
            <h2 className="font-serif text-stone-900 text-xl mb-1">The Contract</h2>
            <div
              className={`flex flex-col items-center justify-center w-24 h-24 rounded-full border-2 ${selectedArchetype.colorClass} ring-2 ${selectedArchetype.glowClass} shadow-lg mb-6 overflow-visible`}
            >
              {type === 'mochi' ? (
                <DefaultSpiritSvg className="w-14 h-14 overflow-visible" />
              ) : (
                <span className="text-5xl" aria-hidden>{selectedArchetype.emoji}</span>
              )}
            </div>
            <p className="font-sans text-stone-700 text-lg italic mb-2">“{CONTRACT_TEXT}”</p>
            <p className="font-sans text-stone-500 text-sm mb-8">— {nameTrimmed || selectedArchetype.name}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2.5 font-sans text-stone-600 bg-stone-100 rounded-xl hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={poofing}
                className="px-8 py-3 font-sans text-stone-50 bg-moss-600 rounded-xl hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-70 disabled:pointer-events-none"
              >
                {mode === 'edit' ? 'Transform Spirit' : 'Begin'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
