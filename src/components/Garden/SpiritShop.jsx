import { useGarden } from '../../context/GardenContext';
import { motion } from 'framer-motion';

const SHOP_ITEMS = [
  { type: 'bench', name: 'Stone Bench', cost: 50, description: 'A place to rest and watch the clouds.', icon: '🪑' },
  { type: 'pond', name: 'Koi Pond', cost: 150, description: 'Fish that bring good fortune.', icon: '🐟' },
  { type: 'lantern', name: 'Stone Lantern', cost: 75, description: 'Lights the way in the evening.', icon: '🏮' },
  { type: 'torii', name: 'Torii Gate', cost: 300, description: 'Marks the entrance to the sacred.', icon: '⛩️' },
  { type: 'cherry', name: 'Cherry Tree', cost: 100, description: 'Blossoms in the spring.', icon: '🌸' },
];

export default function SpiritShop({ onClose }) {
  const { embers, placeDecoration, spendEmbers } = useGarden();

  const handleBuy = (item) => {
    if (embers < item.cost) return;
    const ok = spendEmbers(item.cost);
    if (ok) {
      placeDecoration(item.type, '50%', '50%');
      onClose?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spirit-shop-title"
      aria-label="Mochi's Spirit Shop"
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
        {/* Header: Mochi + Embers */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-200/80">
          <div className="flex items-center justify-between gap-4">
            <h2 id="spirit-shop-title" className="font-serif text-xl text-[#2D2D2D]">
              Mochi&apos;s Spirit Shop
            </h2>
            <div className="flex items-center gap-1.5 rounded-full bg-stone-100 px-4 py-2 border border-stone-200">
              <span className="text-lg" aria-hidden>🔥</span>
              <span className="font-sans text-sm font-medium text-[#2D2D2D] tabular-nums">{embers}</span>
              <span className="font-sans text-xs text-stone-500">Embers</span>
            </div>
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
                className="rounded-xl border border-stone-200 bg-white p-4 flex flex-col gap-2 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl shrink-0" aria-hidden>{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-[#2D2D2D] text-base">{item.name}</h3>
                    <p className="font-sans text-xs text-stone-500 mt-0.5">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-auto pt-2">
                  <span className="font-sans text-sm text-stone-600 flex items-center gap-1">
                    <span aria-hidden>🔥</span>
                    <span className="tabular-nums">{item.cost}</span>
                  </span>
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => handleBuy(item)}
                    className={`font-sans text-sm font-medium px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#4A5D23]/40 focus:ring-offset-2 ${
                      canAfford
                        ? 'bg-[#4A5D23] text-[#FDFCF5] hover:bg-[#3d4e1c]'
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
    </div>
  );
}
