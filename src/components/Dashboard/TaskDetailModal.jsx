import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const uid = () => crypto.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Resolve task data from taskRef and goals.
 * taskRef: { type: 'narrative', goalId, milestoneIndex, taskIndex } | { type: 'subtask', goalId, subtaskId } | { type: 'staging', task } (task has goalId, title; may have source + milestoneIndex/taskIndex for narrative)
 */
function getTaskFromRef(taskRef, goals) {
  if (!taskRef || !goals) return null;
  const goal = goals.find((g) => g.id === taskRef.goalId);
  if (!goal) return null;
  if (taskRef.type === 'subtask' && taskRef.subtaskId) {
    const st = (goal.subtasks || []).find((s) => s.id === taskRef.subtaskId);
    return st ? { type: 'subtask', goal, task: st, ref: taskRef } : null;
  }
  if ((taskRef.type === 'narrative' || taskRef.source === 'narrative') && typeof taskRef.milestoneIndex === 'number' && typeof taskRef.taskIndex === 'number') {
    const milestones = goal.narrativeBreakdown?.milestones ?? [];
    const m = milestones[taskRef.milestoneIndex];
    const t = m?.tasks?.[taskRef.taskIndex];
    return t ? { type: 'narrative', goal, task: t, milestoneIndex: taskRef.milestoneIndex, taskIndex: taskRef.taskIndex, ref: taskRef } : null;
  }
  if (taskRef.type === 'staging' && taskRef.task) {
    const t = taskRef.task;
    if (t.source === 'narrative' && typeof t.milestoneIndex === 'number' && typeof t.taskIndex === 'number') {
      const milestones = goal.narrativeBreakdown?.milestones ?? [];
      const m = milestones[t.milestoneIndex];
      const taskData = m?.tasks?.[t.taskIndex];
      return taskData ? { type: 'narrative', goal, task: taskData, milestoneIndex: t.milestoneIndex, taskIndex: t.taskIndex, ref: { ...taskRef, goalId: goal.id, milestoneIndex: t.milestoneIndex, taskIndex: t.taskIndex } } : null;
    }
    if (t.source === 'subtask' && t.subtaskId) {
      const st = (goal.subtasks || []).find((s) => s.id === t.subtaskId);
      return st ? { type: 'subtask', goal, task: st, ref: { type: 'subtask', goalId: goal.id, subtaskId: t.subtaskId } } : null;
    }
  }
  return null;
}

export default function TaskDetailModal({
  open,
  onClose,
  taskRef,
  goals = [],
  onUpdateNarrativeTask,
  onUpdateSubtask,
}) {
  const resolved = getTaskFromRef(taskRef, goals);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [subTasks, setSubTasks] = useState([]); // { id, title, completed }[]
  const [recurringDays, setRecurringDays] = useState([]); // [0..6] for routine subtask per-task recurrence
  const [linkedRoutineId, setLinkedRoutineId] = useState('');

  const taskKey = taskRef ? `${taskRef.type}-${taskRef.goalId ?? ''}-${taskRef.subtaskId ?? ''}-${taskRef.milestoneIndex ?? ''}-${taskRef.taskIndex ?? ''}` : '';
  const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const routineGoals = (goals || []).filter((g) => g.type === 'routine');
  const showHabitStack = resolved && (resolved.goal?.type === 'kaizen' || resolved.goal?._projectGoal === true);

  useEffect(() => {
    if (!open || !taskRef) return;
    const r = getTaskFromRef(taskRef, goals);
    if (!r) return;
    setTitle(r.task.title ?? '');
    setNotes(r.task.notes ?? '');
    setSubTasks(Array.isArray(r.task.subTasks) ? r.task.subTasks.map((s) => ({ ...s, id: s.id || uid(), title: s.title ?? '', completed: !!s.completed })) : []);
    setRecurringDays(Array.isArray(r.task.days) ? [...r.task.days] : []);
    setLinkedRoutineId(r.task.linkedRoutineId ?? '');
  }, [open, taskKey, goals]);

  const handleSave = useCallback(() => {
    if (!resolved) return;
    const notesTrim = notes.trim();
    const subTasksNorm = subTasks.map((s) => ({ id: s.id || uid(), title: String(s.title ?? '').trim(), completed: !!s.completed })).filter((s) => s.title !== '');
    if (resolved.type === 'narrative' && onUpdateNarrativeTask) {
      const narrativePayload = { title: title.trim() || resolved.task.title, notes: notesTrim || undefined, subTasks: subTasksNorm.length ? subTasksNorm : undefined };
      if (linkedRoutineId) narrativePayload.linkedRoutineId = linkedRoutineId;
      else narrativePayload.linkedRoutineId = undefined;
      onUpdateNarrativeTask(resolved.goal.id, resolved.milestoneIndex, resolved.taskIndex, narrativePayload);
    }
    if (resolved.type === 'subtask' && onUpdateSubtask) {
      const payload = { title: title.trim() || resolved.task.title, notes: notesTrim || undefined, subTasks: subTasksNorm.length ? subTasksNorm : undefined };
      if (resolved.goal?.type === 'routine') payload.days = recurringDays.length > 0 ? recurringDays.slice().sort((a, b) => a - b) : undefined;
      if (linkedRoutineId) payload.linkedRoutineId = linkedRoutineId;
      else payload.linkedRoutineId = undefined;
      onUpdateSubtask(resolved.goal.id, resolved.task.id, payload);
    }
    onClose?.();
  }, [resolved, title, notes, subTasks, recurringDays, linkedRoutineId, onUpdateNarrativeTask, onUpdateSubtask, onClose]);

  const addSubTask = useCallback(() => {
    setSubTasks((prev) => [...prev, { id: uid(), title: '', completed: false }]);
  }, []);

  const updateSubTask = useCallback((id, updates) => {
    setSubTasks((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  const removeSubTask = useCallback((id) => {
    setSubTasks((prev) => prev.filter((s) => s.id !== id));
  }, []);

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
        aria-labelledby="task-detail-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden"
        >
          <header className="shrink-0 px-5 py-4 border-b border-stone-200 flex items-center justify-between gap-2">
            <h2 id="task-detail-title" className="font-serif text-stone-900 text-lg truncate">
              Task details
            </h2>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100" aria-label="Close">
              ✕
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
            {!resolved ? (
              <p className="font-sans text-stone-500 text-sm">Task not found.</p>
            ) : (
              <>
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 font-sans text-stone-900 focus:ring-2 focus:ring-moss-500/50 focus:border-moss-500"
                    placeholder="Task title"
                  />
                </div>
                {showHabitStack && (
                  <div>
                    <label className="block font-sans text-sm font-medium text-stone-700 mb-1">🔗 Habit Stack (Optional)</label>
                    <p className="font-sans text-xs text-stone-500 mb-2">Do this immediately after:</p>
                    <select
                      value={linkedRoutineId}
                      onChange={(e) => setLinkedRoutineId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 font-sans text-stone-900 focus:ring-2 focus:ring-moss-500/50 focus:border-moss-500"
                      aria-label="Anchor routine (do this task after)"
                    >
                      <option value="">None</option>
                      {routineGoals.map((g) => (
                        <option key={g.id} value={g.id}>{g.title ?? 'Routine'}</option>
                      ))}
                    </select>
                  </div>
                )}
                {resolved.type === 'subtask' && resolved.goal?.type === 'routine' && (
                  <div>
                    <label className="block font-sans text-sm font-medium text-stone-700 mb-1">Recurring days</label>
                    <p className="font-sans text-xs text-stone-500 mb-2">When this task repeats (S–S = Sun–Sat). Leave empty to use the routine&apos;s default.</p>
                    <div className="flex flex-wrap gap-1">
                      {DAY_LETTERS.map((letter, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setRecurringDays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort((a, b) => a - b)))}
                          className={`w-8 h-8 rounded font-sans text-sm font-medium transition-colors ${recurringDays.includes(i) ? 'bg-moss-600 text-white' : 'bg-stone-200 text-stone-500 hover:bg-stone-300'}`}
                          aria-pressed={recurringDays.includes(i)}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-700 mb-1">Notes (Markdown supported)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 font-sans text-stone-900 focus:ring-2 focus:ring-moss-500/50 focus:border-moss-500 resize-y"
                    placeholder="Notes for your future self…"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-sans text-sm font-medium text-stone-700">Sub-tasks</label>
                    <button type="button" onClick={addSubTask} className="text-xs font-medium text-moss-600 hover:text-moss-700">
                      + Add
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {subTasks.map((s) => (
                      <li key={s.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!s.completed}
                          onChange={(e) => updateSubTask(s.id, { completed: e.target.checked })}
                          className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50"
                        />
                        <input
                          type="text"
                          value={s.title}
                          onChange={(e) => updateSubTask(s.id, { title: e.target.value })}
                          className="flex-1 px-2 py-1.5 rounded border border-stone-200 font-sans text-sm text-stone-800 placeholder:text-stone-400"
                          placeholder="Sub-task"
                        />
                        <button type="button" onClick={() => removeSubTask(s.id)} className="p-1 text-stone-400 hover:text-red-600" aria-label="Remove">
                          🗑️
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          <footer className="shrink-0 px-5 py-4 border-t border-stone-200 flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-sans text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={!resolved} className="px-4 py-2 rounded-lg font-sans text-sm font-medium text-white bg-moss-600 hover:bg-moss-700 disabled:opacity-50">
              Save
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
