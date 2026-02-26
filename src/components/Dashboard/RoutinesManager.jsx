import { useState, useMemo } from 'react';
import { useGarden } from '../../context/GardenContext';
import { motion, AnimatePresence } from 'framer-motion';

const FORM_CATEGORIES = ['🧼 Care & Hygiene', '🧹 Household', '📁 Life Admin', '💪 Wellness'];

export default function RoutinesManager() {
  const { routines, addRoutine, deleteRoutine } = useGarden();
  const [newRoutine, setNewRoutine] = useState({ title: '', category: '🧼 Care & Hygiene', duration: 15 });

  const byCategory = useMemo(() => {
    const map = {};
    (routines ?? []).forEach((r) => {
      const cat = r.category || '📋 Other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(r);
    });
    FORM_CATEGORIES.forEach((c) => { if (!map[c]) map[c] = []; });
    return map;
  }, [routines]);

  const sortedCategories = useMemo(() => {
    const cats = Object.keys(byCategory);
    return [...FORM_CATEGORIES.filter((c) => cats.includes(c)), ...cats.filter((c) => !FORM_CATEGORIES.includes(c))];
  }, [byCategory]);

  const handleAddRoutine = () => {
    const title = (newRoutine.title || '').trim();
    if (!title) return;
    addRoutine({ ...newRoutine, title, duration: Math.max(1, Math.min(120, Number(newRoutine.duration) || 15)) });
    setNewRoutine({ ...newRoutine, title: '' });
  };

  const handleDelete = (id) => {
    if (window.confirm('Remove this routine?')) deleteRoutine(id);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="font-serif text-stone-800 text-lg mb-2">Micro-habits</h2>
      <p className="font-sans text-stone-500 text-sm mb-4">
        Manage your recurring routines. These appear in the Seed Bag so you can pull them into your day.
      </p>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 mb-6 flex flex-col md:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="text-xs font-bold text-stone-500 mb-1 block">Routine Name</label>
          <input
            type="text"
            placeholder="e.g. Feed the cat..."
            value={newRoutine.title}
            onChange={(e) => setNewRoutine({ ...newRoutine, title: e.target.value })}
            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="w-full md:w-48">
          <label className="text-xs font-bold text-stone-500 mb-1 block">Category</label>
          <select
            value={newRoutine.category}
            onChange={(e) => setNewRoutine({ ...newRoutine, category: e.target.value })}
            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="🧼 Care & Hygiene">🧼 Care & Hygiene</option>
            <option value="🧹 Household">🧹 Household</option>
            <option value="📁 Life Admin">📁 Life Admin</option>
            <option value="💪 Wellness">💪 Wellness</option>
          </select>
        </div>
        <div className="w-full md:w-32">
          <label className="text-xs font-bold text-stone-500 mb-1 block">Duration (min)</label>
          <input
            type="number"
            min={1}
            max={120}
            value={newRoutine.duration}
            onChange={(e) => setNewRoutine({ ...newRoutine, duration: parseInt(e.target.value, 10) || 15 })}
            className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <button
          type="button"
          onClick={handleAddRoutine}
          className="w-full md:w-auto px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg transition-colors"
        >
          Add
        </button>
      </div>

      <div className="space-y-6">
        {sortedCategories.map((cat) => {
          const items = byCategory[cat] ?? [];
          if (items.length === 0) return null;
          return (
            <div key={cat} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <h3 className="font-sans text-sm font-bold text-stone-700 uppercase tracking-wide mb-3">{cat}</h3>
              <ul className="space-y-2" role="list">
                <AnimatePresence mode="popLayout">
                  {items.map((r) => (
                    <motion.li
                      key={r.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-stone-50 border border-stone-100"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-sans text-sm font-medium text-stone-800">{r.title}</span>
                        <span className="font-sans text-xs text-stone-500 ml-2">[{r.duration} min]</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 shrink-0"
                        aria-label="Delete"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
