import { useState, useMemo } from 'react';
import { useGarden } from '../../context/GardenContext';
import { motion, AnimatePresence } from 'framer-motion';

// 🌱 Seeds — premium flora (type: 'seed', category: 'seeds')
const SEED_ITEMS = [
  { id: 'seed_oak', name: 'Mighty Oak Seed', cost: 50, model: 'tree_oak.glb', icon: '🌳', type: 'seed', category: 'seeds', description: 'Grow a mighty oak in your garden.', tagline: 'Premium' },
  { id: 'seed_pine', name: 'Ancient Pine Seed', cost: 40, model: 'tree_pineTallA.glb', icon: '🌲', type: 'seed', category: 'seeds', description: 'A tall pine for shade and wisdom.', tagline: 'Premium' },
  { id: 'seed_palm', name: 'Tropical Palm Seed', cost: 60, model: 'tree_palm.glb', icon: '🌴', type: 'seed', category: 'seeds', description: 'Bring the tropics to your garden.', tagline: 'Premium' },
  { id: 'seed_sunflower', name: 'Sunflower Seed', cost: 20, model: 'flower_yellowA.glb', icon: '🌻', type: 'seed', category: 'seeds', description: 'Bright sunflowers for joy.', tagline: 'Premium' },
  { id: 'seed_mushroom', name: 'Giant Spore', cost: 75, model: 'mushroom_redGroup.glb', icon: '🍄', type: 'seed', category: 'seeds', description: 'Mystical giant mushrooms.', tagline: 'Premium' },
];

const SHOP_ITEMS = [
  { type: 'bench', name: 'Stone Bench', cost: 50, description: 'A place to rest and watch the clouds.', icon: '🪑', tagline: 'Rest & reflect', category: 'nature' },
  { type: 'pond', name: 'Koi Pond', cost: 150, description: 'Fish that bring good fortune.', icon: '🐟', tagline: 'Abundance', category: 'nature' },
  { type: 'lantern', name: 'Stone Lantern', cost: 75, description: 'Lights the way in the evening.', icon: '🏮', tagline: 'Guidance', category: 'nature' },
  { type: 'torii', name: 'Torii Gate', cost: 300, description: 'Marks the entrance to the sacred.', icon: '⛩️', tagline: 'Sacred space', category: 'nature' },
  { type: 'cherry', name: 'Cherry Tree', cost: 100, description: 'Blossoms in the spring.', icon: '🌸', tagline: 'Beauty & renewal', category: 'nature' },
];

const ANIMAL_ITEMS = [
  { animalKey: 'rabbit', name: 'Rabbit', cost: 50, description: 'Hops around the grass and twitches its nose.', icon: '🐇', tagline: 'Grass wanderer', category: 'pets' },
  { animalKey: 'fish', name: 'Koi Fish', cost: 50, description: 'Swims only in your painted water tiles.', icon: '🐟', tagline: 'Water dweller', category: 'pets' },
];

// 3D Kenney model decorations — category: 'decor' for tab
const DECORATION_ITEMS = [
  // 🏕️ Campsite & Wilderness
  { id: 'dec_tent', name: 'Cozy Tent', cost: 100, model: 'tent_smallOpen.glb', icon: '⛺', type: 'decoration', category: 'decor', description: 'A small open tent for your garden camp.', tagline: 'Campsite' },
  { id: 'dec_campfire', name: 'Log Campfire', cost: 50, model: 'campfire_logs.glb', icon: '🔥', type: 'decoration', category: 'decor', description: 'Warmth and light for your garden.', tagline: 'Cozy' },
  { id: 'dec_logstack', name: 'Stack of Logs', cost: 30, model: 'log_stackLarge.glb', icon: '🪵', type: 'decoration', category: 'decor', description: 'A large stack of logs.', tagline: 'Woodland' },
  { id: 'dec_canoe', name: 'Wooden Canoe', cost: 150, model: 'canoe.glb', icon: '🛶', type: 'decoration', category: 'decor', description: 'A wooden canoe by the shore.', tagline: 'Wilderness' },
  // 🌉 Structures & Paths
  { id: 'dec_bridge', name: 'Wood Bridge', cost: 75, model: 'bridge_wood.glb', icon: '🌉', type: 'decoration', category: 'decor', description: 'A wooden bridge over water or paths.', tagline: 'Structures' },
  { id: 'dec_fence', name: 'Wood Fence', cost: 15, model: 'fence_planks.glb', icon: '🚧', type: 'decoration', category: 'decor', description: 'A classic wooden fence section.', tagline: 'Rustic' },
  { id: 'dec_gate', name: 'Fence Gate', cost: 20, model: 'fence_gate.glb', icon: '⛩️', type: 'decoration', category: 'decor', description: 'A gate in the fence.', tagline: 'Structures' },
  { id: 'dec_sign', name: 'Wooden Sign', cost: 25, model: 'sign.glb', icon: '🪧', type: 'decoration', category: 'decor', description: 'A wooden signpost.', tagline: 'Paths' },
  // 🏛️ Ruins & Mystical
  { id: 'dec_obelisk', name: 'Stone Obelisk', cost: 200, model: 'statue_obelisk.glb', icon: '🪨', type: 'decoration', category: 'decor', description: 'An ancient stone obelisk.', tagline: 'Mystical' },
  { id: 'dec_column', name: 'Ruined Column', cost: 120, model: 'statue_columnDamaged.glb', icon: '🏛️', type: 'decoration', category: 'decor', description: 'A weathered ruined column.', tagline: 'Ruins' },
  { id: 'dec_pot', name: 'Large Clay Pot', cost: 40, model: 'pot_large.glb', icon: '🏺', type: 'decoration', category: 'decor', description: 'A large clay pot.', tagline: 'Garden' },
  { id: 'dec_lily', name: 'Giant Lily Pad', cost: 35, model: 'lily_large.glb', icon: '🪷', type: 'decoration', category: 'decor', description: 'A giant lily pad for the pond.', tagline: 'Water' },
  { id: 'dec_stump', name: 'Ancient Stump', cost: 20, model: 'stump_oldTall.glb', icon: '🪹', type: 'decoration', category: 'decor', description: 'An old tall tree stump.', tagline: 'Natural' },
];

// Pets & Animals — 3D model decorations (type: 'decoration')
const PETS_AND_ANIMALS_ITEMS = [
  { id: 'anim_pug', name: 'Pug Dog', cost: 250, model: 'Pug.glb', icon: '🐶', type: 'decoration', category: 'pets', description: 'A friendly pug for your garden.', tagline: 'Pets' },
  { id: 'anim_shiba', name: 'Shiba Inu', cost: 250, model: 'ShibaInu-v10.glb', icon: '🐕', type: 'decoration', description: 'Loyal Shiba companion.', tagline: 'Pets' },
  { id: 'anim_husky', name: 'Husky', cost: 300, model: 'Husky-v9.glb', icon: '🐺', type: 'decoration', description: 'Adventurous husky.', tagline: 'Pets' },
  { id: 'anim_cat_fox', name: 'Forest Fox', cost: 200, model: 'Fox-v6.glb', icon: '🦊', type: 'decoration', description: 'Cunning forest fox.', tagline: 'Pets' },
  { id: 'anim_wolf', name: 'Dire Wolf', cost: 350, model: 'Wolf-v12.glb', icon: '🐺', type: 'decoration', description: 'Majestic dire wolf.', tagline: 'Pets' },
  { id: 'anim_horse', name: 'Brown Horse', cost: 400, model: 'Horse-v7.glb', icon: '🐎', type: 'decoration', description: 'Brown horse for the meadow.', tagline: 'Farm' },
  { id: 'anim_horse_white', name: 'White Horse', cost: 450, model: 'Horse_White-v8.glb', icon: '🎠', type: 'decoration', description: 'Elegant white horse.', tagline: 'Farm' },
  { id: 'anim_alpaca', name: 'Alpaca', cost: 300, model: 'Alpaca-v1.glb', icon: '🦙', type: 'decoration', description: 'Fluffy alpaca.', tagline: 'Farm' },
  { id: 'anim_llama', name: 'Llama', cost: 300, model: 'Llama.glb', icon: '🦙', type: 'decoration', description: 'Curious llama.', tagline: 'Farm' },
  { id: 'anim_deer', name: 'Fawn', cost: 250, model: 'Deer-v4.glb', icon: '🦌', type: 'decoration', description: 'Gentle fawn.', tagline: 'Forest' },
  { id: 'anim_stag', name: 'Majestic Stag', cost: 350, model: 'Stag-v11.glb', icon: '🦌', type: 'decoration', description: 'Noble stag.', tagline: 'Forest' },
  { id: 'anim_cow', name: 'Dairy Cow', cost: 300, model: 'Cow-v3.glb', icon: '🐄', type: 'decoration', description: 'Peaceful dairy cow.', tagline: 'Farm' },
  { id: 'anim_bull', name: 'Bull', cost: 320, model: 'Bull-v2.glb', icon: '🐂', type: 'decoration', description: 'Strong bull.', tagline: 'Farm' },
  { id: 'anim_pig', name: 'Piglet', cost: 150, model: 'Pig.glb', icon: '🐷', type: 'decoration', description: 'Cute piglet.', tagline: 'Farm' },
  { id: 'anim_sheep', name: 'Fluffy Sheep', cost: 200, model: 'Sheep.glb', icon: '🐑', type: 'decoration', description: 'Fluffy sheep.', tagline: 'Farm' },
  { id: 'anim_donkey', name: 'Donkey', cost: 200, model: 'Donkey-v5.glb', icon: '🐴', type: 'decoration', description: 'Hardworking donkey.', tagline: 'Farm' },
  { id: 'anim_koi', name: 'Koi Fish', cost: 100, model: 'Fish1.glb', icon: '🎏', type: 'decoration', description: 'Graceful koi.', tagline: 'Aquatic' },
  { id: 'anim_manta', name: 'Manta Ray', cost: 200, model: 'Manta ray.glb', icon: '🌊', type: 'decoration', description: 'Gliding manta ray.', tagline: 'Aquatic' },
  { id: 'anim_dolphin', name: 'Dolphin', cost: 300, model: 'Dolphin.glb', icon: '🐬', type: 'decoration', description: 'Playful dolphin.', tagline: 'Aquatic' },
];

const TABS = [
  { id: 'seeds', label: '🌱 Seeds' },
  { id: 'pets', label: '🐾 Pets' },
  { id: 'decor', label: '🏕️ Decor' },
  { id: 'nature', label: '🪨 Nature' },
];

export default function SpiritShop({ onClose, embedded = false }) {
  const { embers, placeDecoration, spendEmbers, addDecoration, unlockedAnimals, addUnlockedAnimal, buyItem, ownedSeeds } = useGarden();
  const [justBought, setJustBought] = useState(null);
  const [activeTab, setActiveTab] = useState('seeds');

  // Group all shop items by category for tab filtering
  const itemsByCategory = useMemo(() => ({
    seeds: SEED_ITEMS,
    pets: [...ANIMAL_ITEMS.map((i) => ({ ...i, category: 'pets' })), ...PETS_AND_ANIMALS_ITEMS.map((i) => ({ ...i, category: 'pets' }))],
    decor: DECORATION_ITEMS,
    nature: SHOP_ITEMS,
  }), []);
  const itemsForTab = useMemo(() => itemsByCategory[activeTab] ?? [], [activeTab, itemsByCategory]);

  const handleBuy = (item) => {
    if (embers < item.cost) return;
    const ok = spendEmbers(item.cost);
    if (ok) {
      placeDecoration(item.type, '50%', '50%');
      setJustBought(item.name);
      setTimeout(() => setJustBought(null), 3000);
    }
  };

  const handleBuyDecoration = (item) => {
    if (!item || typeof item.cost !== 'number' || embers < item.cost) return;
    if (!item.model || !item.name) return;
    const ok = spendEmbers(item.cost);
    if (ok) {
      addDecoration({ id: item.id, name: item.name, model: item.model });
      setJustBought(item.name);
      setTimeout(() => setJustBought(null), 3000);
    }
  };

  const handleBuyAnimal = (item) => {
    if ((unlockedAnimals ?? []).includes(item.animalKey)) return;
    if (embers < item.cost) return;
    const ok = spendEmbers(item.cost);
    if (ok) {
      addUnlockedAnimal(item.animalKey);
      setJustBought(item.name);
      setTimeout(() => setJustBought(null), 3000);
    }
  };

  const handleBuySeed = (item) => {
    if (embers < item.cost) return;
    const ok = buyItem(item);
    if (ok) {
      setJustBought(item.name);
      setTimeout(() => setJustBought(null), 3000);
    }
  };

  const card = (
    <>
    <motion.div
      initial={embedded ? false : { opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-lg max-h-[90dvh] sm:max-h-[90vh] rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col my-auto"
      style={{
        background: 'linear-gradient(180deg, #FDFCF5 0%, #f5f3eb 50%, #eeece2 100%)',
        boxShadow: '0 32px 64px -12px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {!embedded && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/80 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors shrink-0"
        >
          ×
        </button>
      )}
        {/* Header: The Ember Exchange + Embers — sticky */}
        <div className="px-6 pt-6 pb-4 shrink-0">
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

        {/* Shopkeeper greeting — sticky */}
        <div
          className="mx-4 mt-2 mb-6 flex items-center gap-4 p-5 rounded-2xl border shadow-lg shrink-0"
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

        {/* Horizontal category tabs — glassmorphic, sticky */}
        <div className="mx-4 mb-4 shrink-0">
          <div
            className="flex rounded-2xl p-1.5 gap-1 overflow-x-auto"
            style={{
              background: 'rgba(255,255,255,0.5)',
              backdropFilter: 'blur(12px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 20px -4px rgba(0,0,0,0.1)',
              border: '1px solid rgba(255,255,255,0.4)',
            }}
            role="tablist"
            aria-label="Shop categories"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 px-4 py-2.5 rounded-xl font-sans text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 ${
                  activeTab === tab.id
                    ? 'text-stone-900 shadow-md'
                    : 'text-stone-600 hover:text-stone-800 hover:bg-white/50'
                }`}
                style={activeTab === tab.id ? { background: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.08)' } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable items grid — only this area scrolls */}
        <div className="overflow-y-auto flex-1 min-h-0 px-4 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <AnimatePresence mode="wait">
              {itemsForTab.map((item, i) => {
                const isSeed = item.type === 'seed';
                const isLegacyAnimal = item.animalKey != null;
                const isDecoration = item.model && item.type === 'decoration' && !isLegacyAnimal;
                const owned = isSeed ? (Array.isArray(ownedSeeds) && ownedSeeds.includes(item.id)) : isLegacyAnimal ? (unlockedAnimals ?? []).includes(item.animalKey) : false;
                const canAfford = embers >= (item.cost ?? 0) && !owned;
                const onBuy = isSeed ? () => handleBuySeed(item) : isLegacyAnimal ? () => handleBuyAnimal(item) : isDecoration ? () => handleBuyDecoration(item) : () => handleBuy(item);
                const key = item.id ?? item.animalKey ?? item.type ?? i;
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.3 }}
                    whileHover={!owned ? { y: -4, transition: { duration: 0.2 } } : {}}
                    className="rounded-2xl p-4 flex flex-col gap-3 border overflow-hidden"
                    style={{
                      background: owned
                        ? 'linear-gradient(145deg, #e8edd8 0%, #d4e4c4 100%)'
                        : canAfford
                          ? 'linear-gradient(145deg, #ffffff 0%, #f8f7f2 100%)'
                          : 'linear-gradient(145deg, #f5f5f4 0%, #e7e5e4 100%)',
                      borderColor: owned ? 'rgba(94, 114, 52, 0.5)' : canAfford ? 'rgba(180, 200, 140, 0.5)' : 'rgba(214, 211, 209, 0.8)',
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
                      {owned ? (
                        <span className="font-sans text-sm font-medium text-moss-700">Owned</span>
                      ) : (
                        <>
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
                            onClick={onBuy}
                            className={`font-sans text-sm font-semibold px-5 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moss-500/50 ${
                              canAfford
                                ? 'text-[#FDFCF5] hover:shadow-lg active:scale-[0.98]'
                                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                            }`}
                            style={canAfford ? { background: 'linear-gradient(135deg, #4a5d23 0%, #3d4e1c 100%)', boxShadow: '0 4px 14px -2px rgba(74, 93, 35, 0.45)' } : {}}
                          >
                            Buy
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        <div className="px-6 pb-5 pt-3 shrink-0">
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
    </>
  );
  return embedded ? card : (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/50 backdrop-blur-md overflow-y-auto safe-area-pb"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spirit-shop-title"
      aria-label="The Ember Exchange"
    >
      {card}
    </div>
  );
}
