import { useState } from 'react';
import { useGarden } from '../../context/GardenContext';
import { motion, AnimatePresence } from 'framer-motion';

const SHOP_ITEMS = [
  { type: 'bench', name: 'Stone Bench', cost: 50, description: 'A place to rest and watch the clouds.', icon: '🪑' },
  { type: 'pond', name: 'Koi Pond', cost: 150, description: 'Fish that bring good fortune.', icon: '🐟' },
  { type: 'lantern', name: 'Stone Lantern', cost: 75, description: 'Lights the way in the evening.', icon: '🏮' },
  { type: 'torii', name: 'Torii Gate', cost: 300, description: 'Marks the entrance to the sacred.', icon: '⛩️' },
  { type: 'cherry', name: 'Cherry Tree', cost: 100, description: 'Blossoms in the spring.', icon: '🌸' },
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spirit-shop-title"
      aria-label="The Ember Exchange"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-lg rounded-2xl border border-stone-200 bg-[#FDFCF5] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
        >
          ×
        </button>
        {/* Header: The Ember Exchange + Embers */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-200/80">
          <div className="flex items-center justify-between gap-4">
            <h2 id="spirit-shop-title" className="font-serif text-xl text-[#2D2D2D]">
              The Ember Exchange
            </h2>
            <div className="flex items-center gap-1.5 rounded-full bg-stone-100 px-4 py-2 border border-stone-200">
              <span className="text-lg" aria-hidden>🔥</span>
              <span className="font-sans text-sm font-medium text-[#2D2D2D] tabular-nums">{embers}</span>
              <span className="font-sans text-xs text-stone-500">Embers</span>
            </div>
          </div>
        </div>

        {/* Shopkeeper Mochi greeting */}
        <div className="mx-4 mt-4 mb-8 flex items-center gap-4 p-4 bg-stone-800 rounded-2xl border border-stone-700 shadow-xl">
          <div className="text-4xl">🦉</div>
          <div>
            <h3 className="font-serif text-amber-400 text-xl">&quot;Ah, a traveler.&quot;</h3>
            <p className="font-sans text-sm text-stone-300 mt-1">&quot;You have traded sweat for embers. Treat yourself. Your garden deserves it, and so do you.&quot;</p>
          </div>
        </div>

        {/* Grid of items */}
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
          {SHOP_ITEMS.map((item) => {
            const canAfford = embers >= item.cost;
            return (
              <motion.div
                key={item.type}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-xl border border-stone-300 bg-stone-100/80 p-4 flex flex-col gap-2 shadow-md hover:shadow-lg hover:border-stone-400 transition-shadow duration-200"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl shrink-0 drop-shadow-sm" aria-hidden>{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-[#2D2D2D] text-base">{item.name}</h3>
                    <p className="font-sans text-xs text-stone-500 mt-0.5">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-auto pt-2">
                  <span className="font-sans text-sm font-medium flex items-center gap-1.5 tabular-nums text-amber-600 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200/80 shadow-sm">
                    <span aria-hidden>🔥</span>
                    <span>{item.cost}</span>
                  </span>
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => handleBuy(item)}
                    className={`font-sans text-sm font-medium px-4 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#4A5D23]/40 focus:ring-offset-2 ${
                      canAfford
                        ? 'bg-[#4A5D23] text-[#FDFCF5] hover:bg-[#3d4e1c] hover:shadow-md active:scale-[0.98]'
                        : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    }`}
                  >
                    Buy
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="px-6 pb-5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full font-sans text-sm text-stone-500 hover:text-stone-700 py-2 rounded-lg hover:bg-stone-100 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-300"
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
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setJustBought(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white p-8 rounded-3xl text-center shadow-2xl max-w-sm mx-4"
            >
              <div className="text-6xl mb-4 animate-bounce">🎉</div>
              <h3 className="font-serif text-2xl text-stone-800 mb-2">Beautiful choice!</h3>
              <p className="font-sans text-stone-600 mb-6">
                You have added <strong className="text-moss-600">{justBought}</strong> to your collection.
              </p>
              <button
                type="button"
                onClick={() => setJustBought(null)}
                className="px-6 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-stone-300"
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
