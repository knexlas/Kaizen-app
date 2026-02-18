import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';

const HEADS = [
  { id: 'bunny', emoji: '🐰', label: 'Bunny' },
  { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'bear', emoji: '🐻', label: 'Bear' },
  { id: 'fox', emoji: '🦊', label: 'Fox' },
  { id: 'bot', emoji: '🤖', label: 'Bot' },
];

const BODIES = [
  { id: 'tea', emoji: '🍵', label: 'Tea' },
  { id: 'backpack', emoji: '🎒', label: 'Hiker' },
  { id: 'scarf', emoji: '🧣', label: 'Cozy' },
  { id: 'glowing', emoji: '✨', label: 'Glowing' },
];

const AURA_COLORS = [
  { id: 'pink', label: 'Pastel Pink', class: 'bg-pink-200', ring: 'ring-pink-300', glow: 'shadow-pink-200/50' },
  { id: 'blue', label: 'Blue', class: 'bg-sky-200', ring: 'ring-sky-300', glow: 'shadow-sky-200/50' },
  { id: 'green', label: 'Green', class: 'bg-moss-200', ring: 'ring-moss-400', glow: 'shadow-moss-200/50' },
  { id: 'gold', label: 'Gold', class: 'bg-amber-200', ring: 'ring-amber-300', glow: 'shadow-amber-200/50' },
];

function Carousel({ options, value, onChange, label }) {
  const idx = options.findIndex((o) => o.id === value);
  const index = idx >= 0 ? idx : 0;
  const current = options[index] ?? options[0];

  const go = (delta) => {
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].id);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-sans text-xs font-medium text-stone-500">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          className="w-10 h-10 rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
          aria-label={`Previous ${label}`}
        >
          ‹
        </button>
        <span className="text-3xl min-w-[3rem] text-center" aria-hidden>
          {current?.emoji}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          className="w-10 h-10 rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
          aria-label={`Next ${label}`}
        >
          ›
        </button>
      </div>
    </div>
  );
}

export default function SpiritBuilder({ onComplete, mode = 'create', initialConfig = null }) {
  const { spiritConfig, setSpiritConfig } = useGarden();
  const source = initialConfig ?? spiritConfig;
  const [head, setHead] = useState(source?.head ?? 'bunny');
  const [body, setBody] = useState(source?.body ?? 'tea');
  const [color, setColor] = useState(source?.color ?? 'green');
  const [name, setName] = useState(source?.name ?? 'Mochi');
  const [poofing, setPoofing] = useState(false);

  useEffect(() => {
    if (!initialConfig) return;
    setHead(initialConfig.head ?? 'bunny');
    setBody(initialConfig.body ?? 'tea');
    setColor(initialConfig.color ?? 'green');
    setName(initialConfig.name ?? 'Mochi');
  }, [initialConfig]);

  const headOption = HEADS.find((h) => h.id === head) ?? HEADS[0];
  const bodyOption = BODIES.find((b) => b.id === body) ?? BODIES[0];
  const colorOption = AURA_COLORS.find((c) => c.id === color) ?? AURA_COLORS[2];

  const handleSave = () => {
    const config = { head, body, color, name: name.trim() || 'Mochi' };
    if (mode === 'edit') {
      setPoofing(true);
      setTimeout(() => {
        setSpiritConfig(config);
        setPoofing(false);
        onComplete?.(config);
      }, 650);
    } else {
      setSpiritConfig(config);
      onComplete?.(config);
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 bg-stone-50 rounded-2xl border border-stone-200 relative overflow-hidden">
      {poofing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" aria-hidden>
          <div className="animate-poof-burst w-32 h-32 rounded-full bg-amber-200/80 mix-blend-lighten" />
        </div>
      )}
      <h2 className="font-serif text-stone-900 text-xl mb-1">{mode === 'edit' ? 'Spirit Mirror' : 'Spirit Constructor'}</h2>
      <p className="font-sans text-sm text-stone-500 mb-6">{mode === 'edit' ? 'Refine your companion.' : 'Create your companion.'}</p>

      {/* Preview: assembled spirit floating in center */}
      <motion.div
        className={`relative flex flex-col items-center justify-center w-28 h-28 rounded-full border-2 ${colorOption.ring} ${colorOption.class} shadow-lg ${colorOption.glow}`}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-4xl leading-none" aria-hidden>
          {headOption.emoji}
        </span>
        <span className="text-2xl mt-0.5" aria-hidden>
          {bodyOption.emoji}
        </span>
      </motion.div>

      {/* Carousels */}
      <div className="flex gap-8 mt-8 flex-wrap justify-center">
        <Carousel options={HEADS} value={head} onChange={setHead} label="Head" />
        <Carousel options={BODIES} value={body} onChange={setBody} label="Body" />
      </div>

      {/* Aura color */}
      <div className="mt-6 w-full max-w-xs">
        <span className="block font-sans text-xs font-medium text-stone-500 mb-2 text-center">Spirit Aura</span>
        <div className="flex justify-center gap-2 flex-wrap">
          {AURA_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.id)}
              className={`w-10 h-10 rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moss-500/50 ${
                color === c.id ? `${c.class} ${c.ring} border-current` : 'bg-stone-100 border-stone-200 hover:bg-stone-200'
              }`}
              aria-label={c.label}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* Name input */}
      <div className="mt-6 w-full max-w-xs">
        <label htmlFor="spirit-name" className="block font-sans text-sm font-medium text-stone-600 mb-1 text-center">
          Name your Spirit Companion
        </label>
        <input
          id="spirit-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mochi"
          className="w-full py-2.5 px-4 rounded-xl border border-stone-200 bg-white font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 text-center"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={poofing}
        className="mt-8 px-8 py-3 font-sans text-stone-50 bg-moss-600 rounded-xl hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-70 disabled:pointer-events-none transition-opacity"
      >
        {mode === 'edit' ? 'Transform Spirit' : 'Save Spirit'}
      </button>
    </div>
  );
}
