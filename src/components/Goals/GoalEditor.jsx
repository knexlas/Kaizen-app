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
  const { metrics = [], addMetric, toggleMilestone } = useGarden();
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('');
  const [color, setColor] = useState('');
  const [metricId, setMetricId] = useState('');
  const [vineTitle, setVineTitle] = useState('');
  const [vineHours, setVineHours] = useState('');
  const [vineDeadline, setVineDeadline] = useState('');
  const [targetHours, setTargetHours] = useState(5);
  const [expandedPhases, setExpandedPhases] = useState({});
  const togglePhase = (id) => setExpandedPhases((prev) => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    if (goal) {
      setTitle(goal.title ?? '');
      setDomain(goal.domain ?? '');
      setColor(goal.color ?? '');
      setMetricId(goal.metricId ?? '');
      setTargetHours(Math.max(0, Number(goal.targetHours) ?? 5));
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
  const isProject = goal?._projectGoal === true;
  const projectTotalHours = isProject
    ? subtasks.reduce((sum, st) => sum + (Number(st.estimatedHours) || 0), 0)
    : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !goal?.id) return;
    const updates = {
      title: trimmedTitle,
      domain: domain || undefined,
      color: color || undefined,
      metricId: metricId || undefined,
    };
    const showHours = goal?.type === 'kaizen' || goal?.type === 'routine' || goal?._projectGoal;
    if (showHours) {
      updates.targetHours = isProject ? projectTotalHours : (typeof targetHours === 'number' && targetHours >= 0 ? targetHours : 5);
    }
    onSave?.(updates);
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
            {(goal?.type === 'kaizen' || goal?.type === 'routine' || goal?._projectGoal) && (
              <div>
                {isProject ? (
                  <>
                    <label className="block font-sans text-sm font-medium text-stone-600 mb-1">
                      Total project load
                    </label>
                    <p className="font-sans text-stone-800 py-2">
                      Total Project Load: <strong>{projectTotalHours}</strong> hours (Sum of all tasks)
                    </p>
                  </>
                ) : (
                  <>
                    <label htmlFor="edit-goal-target-hours" className="block font-sans text-sm font-medium text-stone-600 mb-1">
                      Estimated hours
                    </label>
                    <input
                      id="edit-goal-target-hours"
                      type="number"
                      min={0}
                      step={0.5}
                      value={targetHours}
                      onChange={(e) => setTargetHours(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full py-2 px-3 rounded-lg border border-stone-200 bg-white text-stone-900 font-sans focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                    />
                    <p className="font-sans text-xs text-stone-400 mt-0.5">
                      Weekly target (or total for this goal).
                    </p>
                  </>
                )}
              </div>
            )}
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

            {goal?.milestones?.length > 0 && (
              <div className="border-t border-stone-200 pt-5 mb-5">
                <h3 className="font-sans text-sm font-medium text-stone-700 mb-3">📍 Phases / Milestones</h3>
                <ul className="space-y-2">
                  {goal.milestones.map((m) => {
                    const isExpanded = expandedPhases[m.id];
                    const phaseSubtasks = subtasks.filter((st) => st.phaseId === m.id);

                    return (
                      <div key={m.id} className="rounded-lg bg-stone-100/80 border border-stone-200/60 overflow-hidden">
                        {/* Phase Header */}
                        <div className="flex items-center gap-3 py-2 px-3">
                          <button type="button" onClick={() => togglePhase(m.id)} className="text-stone-400 hover:text-stone-600 w-4 focus:outline-none">
                            {isExpanded ? '▼' : '▶'}
                          </button>
                          <input
                            type="checkbox"
                            checked={!!m.completed}
                            onChange={() => toggleMilestone && toggleMilestone(goal.id, m.id)}
                            className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50 w-4 h-4 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0 flex flex-col cursor-pointer" onClick={() => togglePhase(m.id)}>
                            <span className={`font-sans text-sm truncate ${m.completed ? 'text-stone-500 line-through' : 'text-stone-800'}`}>
                              {m.title}
                            </span>
                            {m.weekRange && <span className="font-sans text-xs text-stone-400">{m.weekRange}</span>}
                          </div>
                        </div>

                        {/* Nested Subtasks */}
                        {isExpanded && phaseSubtasks.length > 0 && (
                          <ul className="bg-stone-50/50 border-t border-stone-200/60 p-2 space-y-1">
                            {phaseSubtasks.map((st) => {
                              const est = Number(st.estimatedHours) || 0;
                              const done = Number(st.completedHours) || 0;
                              const stCompleted = est > 0 && done >= est;
                              return (
                                <li key={st.id} className="flex items-center gap-2 py-1.5 px-2 pl-6 rounded hover:bg-stone-100/50">
                                  {updateSubtask && (
                                    <input
                                      type="checkbox"
                                      checked={!!stCompleted}
                                      onChange={() => updateSubtask(goal.id, st.id, { completedHours: stCompleted ? 0 : est })}
                                      className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50 w-3.5 h-3.5 cursor-pointer"
                                    />
                                  )}
                                  <span className={`flex-1 font-sans text-xs truncate ${stCompleted ? 'text-stone-400 line-through' : 'text-stone-600'}`}>
                                    ↳ {st.title}
                                  </span>
                                  <span className="font-sans text-[10px] text-stone-400 shrink-0">{done}h / {est}h</span>
                                  {deleteSubtask && (
                                    <button type="button" onClick={() => deleteSubtask(goal.id, st.id)} className="text-stone-300 hover:text-red-500 px-1">×</button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </ul>
              </div>
            )}

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
