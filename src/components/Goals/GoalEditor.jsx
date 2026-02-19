import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';

const DOMAINS = [
  { id: 'finance', label: 'Finance', emoji: '📈' },
  { id: 'body', label: 'Body', emoji: '🌿' },
  { id: 'mind', label: 'Mind', emoji: '🧠' },
  { id: 'spirit', label: 'Spirit', emoji: '✨' },
];

const COLOR_PRESETS = [
  { id: 'stone', label: 'Stone', class: 'bg-stone-400' },
  { id: 'moss', label: 'Moss', class: 'bg-moss-500' },
  { id: 'amber', label: 'Amber', class: 'bg-amber-500' },
];

export default function GoalEditor({ open, goal, onClose, onSave, addSubtask, updateSubtask, deleteSubtask }) {
  const { metrics = [], addMetric } = useGarden();
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('');
  const [color, setColor] = useState('');
  const [metricId, setMetricId] = useState('');
  const [vineTitle, setVineTitle] = useState('');
  const [vineHours, setVineHours] = useState('');
  const [vineDeadline, setVineDeadline] = useState('');

  useEffect(() => {
    if (goal) {
      setTitle(goal.title ?? '');
      setDomain(goal.domain ?? '');
      setColor(goal.color ?? '');
      setMetricId(goal.metricId ?? '');
    }
  }, [goal]);

  const handleAddVine = (e) => {
    e.preventDefault();
    const titleTrim = vineTitle.trim();
    if (!titleTrim || !goal?.id || !addSubtask) return;
    const hours = parseFloat(vineHours) || 0;
    addSubtask(goal.id, {
      title: titleTrim,
      estimatedHours: hours,
      completedHours: 0,
      deadline: vineDeadline.trim() || null,
      color: null,
    });
    setVineTitle('');
    setVineHours('');
    setVineDeadline('');
  };

  const subtasks = goal?.subtasks ?? [];
  const showVines = (goal?.type === 'routine' || goal?.type === 'kaizen') && (addSubtask || subtasks.length > 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !goal?.id) return;
    onSave?.({
      title: trimmedTitle,
      domain: domain || undefined,
      color: color || undefined,
      metricId: metricId || undefined,
    });
    onClose?.();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-editor-title"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-stone-50 rounded-2xl border border-stone-200 shadow-xl max-w-sm w-full p-6 max-h-[90vh] overflow-y-auto"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
          >
            ×
          </button>
          <h2 id="goal-editor-title" className="font-serif text-stone-900 text-xl mb-5">
            Rename / Edit
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="edit-goal-title" className="block font-sans text-sm font-medium text-stone-600 mb-1">
                Title
              </label>
              <input
                id="edit-goal-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Goal name"
                className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white text-stone-900 font-sans placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
              />
            </div>
            <div>
              <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Domain</label>
              <div className="flex flex-wrap gap-2">
                {DOMAINS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDomain(d.id)}
                    className={`px-4 py-2 rounded-full font-sans text-sm transition-colors ${
                      domain === d.id ? 'bg-moss-600 text-stone-50' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {d.label} {d.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Tracking (Vitality)</label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={metricId}
                  onChange={(e) => setMetricId(e.target.value)}
                  className="flex-1 min-w-0 py-2 px-3 rounded-lg border border-stone-200 bg-white text-stone-900 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                  aria-label="Link to metric"
                >
                  <option value="">No Tracking</option>
                  {metrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const name = window.prompt('New metric name (e.g. Steps, Sleep hours)');
                    if (name && addMetric) {
                      const id = addMetric(name);
                      if (id) setMetricId(id);
                    }
                  }}
                  className="shrink-0 py-2 px-3 rounded-lg font-sans text-sm border border-stone-200 text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                >
                  New Metric
                </button>
              </div>
            </div>

            <div>
              <label className="block font-sans text-sm font-medium text-stone-600 mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(color === c.id ? '' : c.id)}
                    className={`w-8 h-8 rounded-full ${c.class} border-2 transition-all ${
                      color === c.id ? 'border-stone-800 ring-2 ring-stone-400 ring-offset-2' : 'border-transparent'
                    }`}
                    title={c.label}
                    aria-label={c.label}
                  />
                ))}
              </div>
            </div>

            {showVines && (
              <div className="border-t border-stone-200 pt-5">
                <h3 className="font-sans text-sm font-medium text-stone-700 mb-3">🍃 Vines (Subtasks)</h3>
                {addSubtask && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    <input
                      type="text"
                      value={vineTitle}
                      onChange={(e) => setVineTitle(e.target.value)}
                      placeholder="Title"
                      className="flex-1 min-w-0 py-1.5 px-2 rounded-lg border border-stone-200 text-stone-900 font-sans text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={vineHours}
                      onChange={(e) => setVineHours(e.target.value)}
                      placeholder="Hours"
                      className="w-16 py-1.5 px-2 rounded-lg border border-stone-200 text-stone-900 font-sans text-sm"
                    />
                    <input
                      type="date"
                      value={vineDeadline}
                      onChange={(e) => setVineDeadline(e.target.value)}
                      className="py-1.5 px-2 rounded-lg border border-stone-200 text-stone-900 font-sans text-sm"
                      title="Deadline (optional)"
                    />
                    <button
                      type="button"
                      onClick={handleAddVine}
                      disabled={!vineTitle.trim()}
                      className="py-1.5 px-3 rounded-lg bg-moss-100 text-moss-800 font-sans text-sm hover:bg-moss-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}
                <ul className="space-y-2">
                  {subtasks.map((st) => {
                    const est = Number(st.estimatedHours) || 0;
                    const done = Number(st.completedHours) || 0;
                    const completed = est > 0 && done >= est;
                    return (
                      <li
                        key={st.id}
                        className="flex items-center gap-2 py-2 px-3 rounded-lg bg-stone-100/80 border border-stone-200/60"
                      >
                        {updateSubtask && (
                          <input
                            type="checkbox"
                            checked={!!completed}
                            onChange={() =>
                              updateSubtask(goal.id, st.id, { completedHours: completed ? 0 : est })
                            }
                            className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50"
                            aria-label={`Mark "${st.title}" complete`}
                          />
                        )}
                        <span className={`flex-1 font-sans text-sm truncate ${completed ? 'text-stone-500 line-through' : 'text-stone-800'}`}>
                          {st.title}
                        </span>
                        <span className="font-sans text-xs text-stone-500 shrink-0">{done}h / {est}h</span>
                        {st.deadline && (
                          <span className="font-sans text-xs text-stone-400 shrink-0">{st.deadline}</span>
                        )}
                        {deleteSubtask && (
                          <button
                            type="button"
                            onClick={() => deleteSubtask(goal.id, st.id)}
                            className="text-stone-400 hover:text-red-600 p-0.5 focus:outline-none"
                            aria-label={`Remove ${st.title}`}
                          >
                            ×
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 font-sans text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 font-sans text-stone-50 bg-moss-600 rounded-lg hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
              >
                Save
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
