import { useState } from 'react';
import { useGarden } from '../../context/GardenContext';
import { motion, AnimatePresence } from 'framer-motion';

const SHOP_ITEMS = [
  { type: 'bench', name: 'Stone Bench', cost: 50, description: 'A place to rest and watch the clouds.', icon: '🪑', tagline: 'Rest & reflect' },
  { type: 'pond', name: 'Koi Pond', cost: 150, description: 'Fish that bring good fortune.', icon: '🐟', tagline: 'Abundance' },
  { type: 'lantern', name: 'Stone Lantern', cost: 75, description: 'Lights the way in the evening.', icon: '🏮', tagline: 'Guidance' },
  { type: 'torii', name: 'Torii Gate', cost: 300, description: 'Marks the entrance to the sacred.', icon: '⛩️', tagline: 'Sacred space' },
  { type: 'cherry', name: 'Cherry Tree', cost: 100, description: 'Blossoms in the spring.', icon: '🌸', tagline: 'Beauty & renewal' },
];

export default function SpiritShop({ onClose }) {
  const { embers, placeDecoration, spendEmbers } = useGarden();
  const [justBought, setJustBought] = useState(null);

  const handleBuy = (item) => {
    if (embers < item.cost) return;
    const ok = spendEmbers(item.cost);
    if (ok) {
      placeDecoration(item.type, '50%', '50%');
      setJustBought(item.name);
      setTimeout(() => setJustBought(null), 3000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spirit-shop-title"
      aria-label="The Ember Exchange"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #FDFCF5 0%, #f5f3eb 50%, #eeece2 100%)',
          boxShadow: '0 32px 64px -12px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/80 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
        >
          ×
        </button>
        {/* Header: The Ember Exchange + Embers */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 id="spirit-shop-title" className="font-serif text-2xl text-stone-900">
              The Ember Exchange
            </h2>
            <div
              className="flex items-center gap-2 rounded-2xl px-5 py-2.5 border shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderColor: 'rgba(245, 158, 11, 0.4)',
              }}
            >
              <span className="text-xl" aria-hidden>🔥</span>
              <span className="font-sans text-lg font-bold text-amber-900 tabular-nums">{embers}</span>
              <span className="font-sans text-xs font-medium text-amber-700 uppercase tracking-wider">Embers</span>
            </div>
          </div>
        </div>

        {/* Shopkeeper greeting */}
        <div
          className="mx-4 mt-2 mb-6 flex items-center gap-4 p-5 rounded-2xl border shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #3d4e1c 0%, #4a5d23 50%, #5c6e2e 100%)',
            borderColor: 'rgba(74, 93, 35, 0.5)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px -8px rgba(0,0,0,0.25)',
          }}
        >
          <div className="text-5xl drop-shadow-md">🦉</div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-amber-200 text-lg">&quot;Ah, a traveler.&quot;</h3>
            <p className="font-sans text-sm text-stone-200/95 mt-1 leading-relaxed">&quot;You have traded sweat for embers. Treat yourself. Your garden deserves it, and so do you.&quot;</p>
          </div>
        </div>

        {/* Grid of items */}
        <div className="px-4 sm:px-5 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto">
          {SHOP_ITEMS.map((item, i) => {
            const canAfford = embers >= item.cost;
            return (
              <motion.div
                key={item.type}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="rounded-2xl p-4 flex flex-col gap-3 border overflow-hidden"
                style={{
                  background: canAfford
                    ? 'linear-gradient(145deg, #ffffff 0%, #f8f7f2 100%)'
                    : 'linear-gradient(145deg, #f5f5f4 0%, #e7e5e4 100%)',
                  borderColor: canAfford ? 'rgba(180, 200, 140, 0.5)' : 'rgba(214, 211, 209, 0.8)',
                  boxShadow: canAfford ? '0 4px 14px -4px rgba(94, 114, 52, 0.2), 0 0 0 1px rgba(0,0,0,0.04)' : '0 2px 8px -2px rgba(0,0,0,0.06)',
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-4xl shrink-0"
                    style={{
                      background: 'linear-gradient(145deg, #e8edd8 0%, #d4e4c4 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 8px -2px rgba(94,114,52,0.2)',
                    }}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-stone-900 text-lg">{item.name}</h3>
                    {item.tagline && (
                      <p className="font-sans text-xs font-medium text-moss-600 uppercase tracking-wider mt-0.5">{item.tagline}</p>
                    )}
                    <p className="font-sans text-sm text-stone-500 mt-1.5 leading-snug">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 mt-auto pt-3 border-t border-stone-200/80">
                  <span
                    className="font-sans text-sm font-bold flex items-center gap-2 tabular-nums px-3 py-1.5 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                      color: '#92400e',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                    }}
                  >
                    <span aria-hidden>🔥</span>
                    <span>{item.cost}</span>
                  </span>
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => handleBuy(item)}
                    className={`font-sans text-sm font-semibold px-5 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moss-500/50 ${
                      canAfford
                        ? 'text-[#FDFCF5] hover:shadow-lg active:scale-[0.98]'
                        : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    }`}
                    style={canAfford ? { background: 'linear-gradient(135deg, #4a5d23 0%, #3d4e1c 100%)', boxShadow: '0 4px 14px -2px rgba(74, 93, 35, 0.45)' } : {}}
                  >
                    Buy
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="px-6 pb-5 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full font-sans text-sm font-medium text-stone-500 hover:text-stone-700 py-2.5 rounded-xl hover:bg-stone-100 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-300"
          >
            Close
          </button>
        </div>
      </motion.div>

      {/* Purchase celebration overlay */}
      <AnimatePresence>
        {justBought && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/60 backdrop-blur-md p-4"
            onClick={() => setJustBought(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="text-center max-w-sm mx-4 rounded-3xl overflow-hidden p-8"
              style={{
                background: 'linear-gradient(180deg, #FDFCF5 0%, #f5f3eb 100%)',
                boxShadow: '0 32px 64px -12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1)',
              }}
            >
              <motion.div
                className="text-6xl mb-4"
                animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                🎉
              </motion.div>
              <h3 className="font-serif text-2xl text-stone-900 mb-2">Beautiful choice!</h3>
              <p className="font-sans text-stone-600 mb-6">
                <strong className="text-moss-700">{justBought}</strong> is now in your garden. Enjoy it.
              </p>
              <button
                type="button"
                onClick={() => setJustBought(null)}
                className="px-6 py-3 rounded-xl font-sans font-medium transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2"
                style={{
                  background: 'linear-gradient(135deg, #4a5d23 0%, #3d4e1c 100%)',
                  color: '#FDFCF5',
                }}
              >
                Back to Exchange
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
