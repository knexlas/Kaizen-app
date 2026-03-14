import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDialog } from '../../context/DialogContext';
import { generateGoalBreakdownMilestones } from '../../services/geminiService';

/**
 * Displays the Task 2 JSON output: goals as high-level cards that expand to show
 * Milestones as Step 1, Step 2, Step 3… with tasks. No calendar dates — narrative only.
 */
function NarrativeCard({ goal, expanded, onToggle, onGoalClick, onDeleteGoal }) {
  const { showConfirm } = useDialog();
  const [breakdown, setBreakdown] = useState(goal.narrativeBreakdown ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerateNarrative = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await generateGoalBreakdownMilestones(goal.title);
      if (result && Array.isArray(result.milestones) && result.milestones.length > 0) {
        setBreakdown(result);
      } else {
        setError("Couldn't generate a narrative. Try again or edit the goal title.");
      }
    } catch (e) {
      console.warn('Generate narrative failed', e);
      setError("Connection issue. Try again or check Settings.");
    } finally {
      setLoading(false);
    }
  }, [goal.title]);

  const hasNarrative = breakdown && breakdown.milestones && breakdown.milestones.length > 0;
  const showContent = expanded && (hasNarrative || loading || error);

  return (
    <div
      className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm transition-shadow hover:shadow-md"
      data-testid="narrative-card"
    >
      <button
        type="button"
        onClick={() => onToggle(goal.id)}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:ring-inset"
        aria-expanded={expanded}
        aria-controls={`narrative-content-${goal.id}`}
      >
        <span className="font-serif text-stone-900 font-medium text-base truncate pr-2">{goal.title}</span>
        <span className="shrink-0 text-stone-400" aria-hidden>
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      <AnimatePresence>
        {showContent && (
          <motion.div
            id={`narrative-content-${goal.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-stone-100"
          >
            <div className="px-4 py-3 bg-stone-50/80">
              {loading && (
                <p className="font-sans text-sm text-stone-500 flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-moss-500 border-t-transparent rounded-full animate-spin" aria-hidden />
                  Generating narrative…
                </p>
              )}
              {error && !loading && (
                <div className="flex flex-col gap-2">
                  <p className="font-sans text-sm text-amber-700">{error}</p>
                  <button
                    type="button"
                    onClick={handleGenerateNarrative}
                    className="self-start px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-stone-200 text-stone-800 hover:bg-stone-300 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                  >
                    Try again
                  </button>
                </div>
              )}
              {hasNarrative && !loading && (
                <div className="space-y-4">
                  <p className="font-sans text-xs text-stone-500 uppercase tracking-wide">The path — no dates, just the sequence</p>
                  {breakdown.milestones.map((milestone, stepIndex) => (
                    <div key={stepIndex} className="flex gap-3">
                      <div className="shrink-0 flex flex-col items-center">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-moss-100 text-moss-700 font-sans text-sm font-semibold"
                          aria-hidden
                        >
                          {stepIndex + 1}
                        </span>
                        {stepIndex < breakdown.milestones.length - 1 && (
                          <div className="w-px flex-1 min-h-[8px] bg-stone-200 my-0.5" aria-hidden />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-4">
                        <h3 className="font-sans text-stone-800 font-medium text-sm mb-2">{milestone.title}</h3>
                        <ul className="space-y-1.5" role="list">
                          {(milestone.tasks || []).map((task, taskIndex) => (
                            <li
                              key={taskIndex}
                              className="flex items-center gap-2 font-sans text-sm text-stone-600 pl-0"
                            >
                              <span className="text-stone-400 shrink-0" aria-hidden>↳</span>
                              <span className="flex-1">{task.title}</span>
                              <span
                                className="shrink-0 text-stone-400 text-xs"
                                title={`Effort: ${task.estimatedSparks} spark${task.estimatedSparks !== 1 ? 's' : ''}`}
                              >
                                {'✦'.repeat(task.estimatedSparks || 1)}
                              </span>
                              {task.isKaizen && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-moss-100 text-moss-700">
                                  Kaizen
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {expanded && !hasNarrative && !loading && !error && (
                <div className="flex flex-col gap-3">
                  <p className="font-sans text-sm text-stone-500">See this goal as a step-by-step narrative (no dates).</p>
                  <button
                    type="button"
                    onClick={handleGenerateNarrative}
                    className="self-start px-4 py-2 rounded-xl font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2"
                  >
                    Generate narrative
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {expanded && (onGoalClick || onDeleteGoal) && (
        <div className="px-4 py-2 border-t border-stone-100 flex gap-2">
          {onGoalClick && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onGoalClick(goal); }}
              className="text-xs text-stone-500 hover:text-stone-700 px-2 py-1 rounded bg-stone-100"
            >
              Edit goal
            </button>
          )}
          {onDeleteGoal && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showConfirm({
                message: 'Delete this goal? This cannot be undone.',
                confirmLabel: 'Delete',
                destructive: true,
                onConfirm: () => onDeleteGoal(goal.id),
              });
              }}
              className="text-xs text-stone-500 hover:text-red-600 px-2 py-1 rounded bg-stone-100"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function HorizonsNarrativeBoard({
  goals = [],
  onGoalClick,
  onDeleteGoal,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const toggle = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const narrativeGoals = goals.filter((g) => g._projectGoal || g.type === 'kaizen');

  if (narrativeGoals.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
        <p className="font-sans text-stone-500 text-sm">No projects or kaizen goals yet. Add one from the Today view to see their narrative here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" role="list">
      {narrativeGoals.map((goal) => (
        <NarrativeCard
          key={goal.id}
          goal={goal}
          expanded={expandedId === goal.id}
          onToggle={toggle}
          onGoalClick={onGoalClick}
          onDeleteGoal={onDeleteGoal}
        />
      ))}
    </div>
  );
}
