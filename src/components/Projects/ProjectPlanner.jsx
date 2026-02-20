import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sliceProject } from '../../services/geminiService';
import { useGarden } from '../../context/GardenContext';

/** Parse "Week 1-2" or "Week 3" into 0-based week indices { start, end }. */
function parseWeekRange(weekRangeStr, totalWeeks = 14) {
  if (!weekRangeStr || typeof weekRangeStr !== 'string') return { start: 0, end: totalWeeks - 1 };
  const m = weekRangeStr.trim().match(/Week\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
  if (!m) return { start: 0, end: totalWeeks - 1 };
  const start = Math.max(0, parseInt(m[1], 10) - 1);
  const end = m[2] ? Math.min(totalWeeks - 1, parseInt(m[2], 10) - 1) : start;
  return { start: Math.min(start, end), end };
}

export default function ProjectPlanner({ open, onClose, onCreateGoals }) {
  const { goals } = useGarden();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSlicing, setIsSlicing] = useState(false);
  const [plan, setPlan] = useState(null);
  const [sliceError, setSliceError] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [linkedGoals, setLinkedGoals] = useState({});

  const handleSlice = useCallback(async () => {
    if (!name.trim()) return;
    setIsSlicing(true);
    setPlan(null);
    setSliceError(null);
    try {
      const result = await sliceProject(name, deadline || null, description, goals);
      if (result && Array.isArray(result.phases) && result.phases.length > 0) {
        setPlan(result);
        const allTasks = new Set();
        result.phases.forEach((phase) => {
          (phase.tasks || []).forEach((t) => allTasks.add(t.title));
        });
        setSelectedTasks(allTasks);
        const links = {};
        (result.suggestedLinks ?? []).forEach((l) => {
          if (l.goalId && l.taskTitle) links[l.taskTitle] = l.goalId;
        });
        setLinkedGoals(links);
      } else {
        setSliceError("Mochi's plan didn't come through. Try again or describe the project differently.");
      }
    } catch (e) {
      console.error('Project slice failed', e);
      setSliceError("Mochi couldn't connect. Check your API key (VITE_GEMINI_API_KEY) or try again later.");
    } finally {
      setIsSlicing(false);
    }
  }, [name, deadline, description, goals]);

  const handleCreate = useCallback(() => {
    if (!plan || !onCreateGoals) return;
    const totalWeeks = Math.max(1, Number(plan.totalWeeks) || 14);
    const uid = () => crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const milestones = (plan.phases || []).map((phase) => ({
      id: uid(),
      title: phase.milestone || phase.title || 'Phase milestone',
      completed: false,
    }));

    const subtasks = [];
    (plan.phases || []).forEach((phase) => {
      (phase.tasks || []).forEach((task) => {
        if (!selectedTasks.has(task.title)) return;
        if (linkedGoals[task.title]) return;
        const estimatedHours = Math.max(0, Number(task.estimatedHours) ?? 2);
        subtasks.push({
          id: uid(),
          title: task.title,
          estimatedHours,
          completedHours: 0,
          deadline: null,
          color: null,
        });
      });
    });

    const notesParts = [plan.summary || ''];
    if (totalWeeks) notesParts.push(`${totalWeeks} weeks`);
    if (deadline) notesParts.push(`Deadline: ${deadline}`);
    const notes = notesParts.filter(Boolean).join(' \u00b7 ');

    const projectGoal = {
      id: uid(),
      type: 'kaizen',
      title: name.trim() || 'Project',
      domain: 'mind',
      estimatedMinutes: 60,
      targetHours: subtasks.reduce((sum, st) => sum + (st.estimatedHours || 0), 0) || 5,
      milestones,
      subtasks,
      notes,
      rituals: [],
      _projectName: name.trim() || 'Project',
      _projectDeadline: deadline || null,
      _projectTotalWeeks: totalWeeks,
      _projectGoal: true,
    };

    onCreateGoals([projectGoal]);
    onClose?.();
    setName('');
    setDescription('');
    setDeadline('');
    setPlan(null);
    setSliceError(null);
    setSelectedTasks(new Set());
    setLinkedGoals({});
  }, [plan, selectedTasks, linkedGoals, name, deadline, onCreateGoals, onClose]);

  const toggleTask = (title) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-lg max-h-[85vh] flex flex-col"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
          >
            ×
          </button>
          <div className="px-6 py-4 border-b border-stone-100">
            <h2 className="font-serif text-stone-900 text-xl">Project Planner</h2>
            <p className="font-sans text-sm text-stone-500 mt-0.5">
              Describe your project and Mochi will slice it into manageable goals.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {sliceError && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 font-sans text-sm text-amber-800">
                {sliceError}
              </div>
            )}
            {!plan ? (
              <>
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-1">Project Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Launch my portfolio website"
                    className="w-full py-2.5 px-3 rounded-lg border border-stone-200 bg-stone-50 font-sans text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-1">
                    Description <span className="text-stone-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does success look like? Any constraints?"
                    rows={3}
                    className="w-full py-2.5 px-3 rounded-lg border border-stone-200 bg-stone-50 font-sans text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-600 mb-1">
                    Deadline <span className="text-stone-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-lg border border-stone-200 bg-stone-50 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:border-moss-500"
                  />
                </div>
              </>
            ) : (
              <>
                {plan.summary && (
                  <div className="p-3 rounded-lg bg-moss-50 border border-moss-200">
                    <p className="font-sans text-sm text-moss-800">{plan.summary}</p>
                    {plan.totalWeeks && (
                      <p className="font-sans text-xs text-moss-600 mt-1">
                        Estimated timeline: {plan.totalWeeks} weeks
                      </p>
                    )}
                  </div>
                )}

                {plan.phases?.map((phase, pi) => (
                  <div key={pi} className="rounded-xl border border-stone-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
                      <h4 className="font-serif text-stone-900 text-sm font-medium">{phase.title}</h4>
                      <p className="font-sans text-xs text-stone-500">{phase.weekRange}</p>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {phase.tasks?.map((task, ti) => {
                        const isSelected = selectedTasks.has(task.title);
                        const existingLink = linkedGoals[task.title];
                        const linkedGoal = existingLink ? goals.find((g) => g.id === existingLink) : null;
                        return (
                          <div key={ti} className="flex items-start gap-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTask(task.title)}
                              className="mt-0.5 rounded border-stone-300 text-moss-500 focus:ring-moss-500/50"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-sans text-sm text-stone-800">{task.title}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                                    task.type === 'routine'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-moss-100 text-moss-700'
                                  }`}
                                >
                                  {task.type === 'routine' ? 'Routine' : 'Kaizen'}
                                </span>
                              </div>
                              <span className="font-sans text-xs text-stone-400">
                                {task.estimatedHours}h estimated
                              </span>
                              {linkedGoal && (
                                <span className="block font-sans text-xs text-sky-600 mt-0.5">
                                  Linked to: {linkedGoal.title}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {phase.milestone && (
                        <div className="mt-2 pt-2 border-t border-stone-100">
                          <span className="font-sans text-xs text-stone-500">Milestone: </span>
                          <span className="font-sans text-xs text-stone-700 font-medium">
                            {phase.milestone}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <p className="font-sans text-xs text-stone-400">
                  Uncheck tasks you want to skip. One goal will be created with these as milestones and subtasks. Linked tasks are omitted.
                </p>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-stone-100 flex gap-2">
            {!plan ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg border border-stone-200 font-sans text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSlice}
                  disabled={!name.trim() || isSlicing}
                  className="flex-1 py-2.5 rounded-lg bg-moss-600 text-white font-sans text-sm font-medium hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSlicing ? 'Mochi is planning\u2026' : '\u2728 Slice this project'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setPlan(null); setSliceError(null); }}
                  className="px-4 py-2.5 rounded-lg border border-stone-200 font-sans text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="flex-1 py-2.5 rounded-lg bg-moss-600 text-white font-sans text-sm font-medium hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
                >
                  Create project goal
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
