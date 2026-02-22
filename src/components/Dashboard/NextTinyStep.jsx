import { useState, useMemo, useCallback } from 'react';
import { useGarden } from '../../context/GardenContext';

const SNOOZE_MS = 30 * 60 * 1000;
const MAX_SUGGESTIONS = 3;

function isRoutineOrMaintenance(item) {
  const g = item?.goal;
  return g?.type === 'routine' || g?.energyType === 'maintenance';
}

/** True if goal is low-activation (1 or 2) or has no activationEnergy set (backward compat). */
function isLowActivationGoal(goal) {
  const ae = goal?.activationEnergy;
  return ae === undefined || ae === null || ae === 1 || ae === 2;
}

/** Parse "Week 1-2" or "Week 3" into 0-based week indices { start, end }. */
function parseWeekRange(weekRangeStr, totalWeeks = 14) {
  if (!weekRangeStr || typeof weekRangeStr !== 'string') return { start: 0, end: totalWeeks - 1 };
  const m = weekRangeStr.trim().match(/Week\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
  if (!m) return { start: 0, end: totalWeeks - 1 };
  const start = Math.max(0, parseInt(m[1], 10) - 1);
  const end = m[2] ? Math.min(totalWeeks - 1, parseInt(m[2], 10) - 1) : start;
  return { start: Math.min(start, end), end };
}

/** Current 0-based week index from project start (deadline - totalWeeks). */
function getCurrentWeekIndex(projectDeadline, totalWeeks = 14) {
  if (!projectDeadline || totalWeeks < 1) return 0;
  const end = new Date(projectDeadline + 'T23:59:59').getTime();
  const start = end - totalWeeks * 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (now < start) return 0;
  if (now > end) return totalWeeks - 1;
  const weekIndex = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(totalWeeks - 1, weekIndex));
}

/** Build 1–3 micro-action suggestions from today's plan, compost inbox, and recent activity.
 * Ensures at least one suggestion is a routine or maintenance task from the day's plan when available.
 * When lowEnergy is true, only suggests tasks with activationEnergy 1 or 2.
 */
function useTinyStepSuggestions({
  todayPlanItems,
  compost = [],
  logs = [],
  goals = [],
  snoozedUntil = {},
  lowEnergy = false,
}) {
  const isSnoozed = useCallback(
    (id) => {
      const until = snoozedUntil[id];
      return until != null && until > Date.now();
    },
    [snoozedUntil]
  );

  return useMemo(() => {
    const out = [];
    const used = new Set();
    const planItems = lowEnergy ? todayPlanItems.filter((item) => isLowActivationGoal(item.goal)) : todayPlanItems;

    // 0) Active project: first uncompleted subtask from the current phase (or first uncompleted phase)
    const projectGoals = (goals || []).filter((g) => g._projectGoal === true);
    for (const goal of projectGoals) {
      if (lowEnergy && !isLowActivationGoal(goal)) continue;
      const phases = goal.milestones || [];
      const totalWeeks = Math.max(1, Number(goal._projectTotalWeeks) || 14);
      const currentWeek = getCurrentWeekIndex(goal._projectDeadline, totalWeeks);

      let activePhase = null;
      const phaseInRange = phases.find((p) => {
        const { start, end } = parseWeekRange(p.weekRange, totalWeeks);
        return currentWeek >= start && currentWeek <= end;
      });
      if (phaseInRange) {
        activePhase = phaseInRange;
      } else {
        activePhase = phases.find((p) => !p.completed) || phases[0] || null;
      }
      if (!activePhase) continue;

      const subtasks = (goal.subtasks || []).filter((st) => st.phaseId === activePhase.id);
      const firstIncomplete = subtasks.find((st) => (st.completedHours ?? 0) < (st.estimatedHours || 1));
      if (!firstIncomplete) continue;

      const id = `project-${goal.id}-${firstIncomplete.id}`;
      if (used.has(goal.id) || used.has(id)) continue;
      used.add(goal.id);
      used.add(id);
      out.unshift({
        id,
        source: 'project',
        title: firstIncomplete.title || 'Project task',
        goalId: goal.id,
        goal,
        subtaskId: firstIncomplete.id,
      });
      break; // one high-priority project suggestion at the top
    }

    // 1) Today's plan (up to 2)
    for (const item of planItems) {
      if (out.length >= MAX_SUGGESTIONS) break;
      const id = `plan-${item.goalId}-${item.hour ?? ''}`;
      if (used.has(item.goalId) || isSnoozed(id)) continue;
      used.add(item.goalId);
      out.push({
        id,
        source: 'plan',
        title: item.ritualTitle || item.goal?.title || 'Task',
        goalId: item.goalId,
        goal: item.goal,
        hour: item.hour,
        subtaskId: item.subtaskId,
      });
    }

    // 2) Compost inbox (up to 1)
    for (const item of compost) {
      if (out.length >= MAX_SUGGESTIONS) break;
      const id = `compost-${item.id}`;
      if (isSnoozed(id)) continue;
      out.push({
        id,
        source: 'compost',
        title: (item.text || '').trim() || 'Compost item',
        compostItem: item,
      });
    }

    // 3) Recent activity: last logged goal not already in plan (up to 1)
    const recentGoalIds = [...(logs || [])]
      .reverse()
      .map((l) => l.goalId)
      .filter(Boolean);
    for (const goalId of recentGoalIds) {
      if (out.length >= MAX_SUGGESTIONS || used.has(goalId)) continue;
      const goal = goals?.find((g) => g.id === goalId);
      if (!goal) continue;
      if (lowEnergy && !isLowActivationGoal(goal)) continue;
      const id = `recent-${goalId}`;
      if (isSnoozed(id)) continue;
      used.add(goalId);
      out.push({
        id,
        source: 'recent',
        title: goal.title || 'Task',
        goalId: goal.id,
        goal,
      });
    }

    // 4) Ensure at least one suggestion is routine/maintenance from today's plan (life admin visibility)
    const hasRoutineOrMaintenance = out.some(isRoutineOrMaintenance);
    if (!hasRoutineOrMaintenance && planItems.length > 0) {
      const firstRoutineOrMaintenance = planItems.find(
        (item) => isRoutineOrMaintenance(item) && !used.has(item.goalId) && !isSnoozed(`plan-${item.goalId}-${item.hour ?? ''}`)
      );
      if (firstRoutineOrMaintenance) {
        const item = firstRoutineOrMaintenance;
        const id = `plan-${item.goalId}-${item.hour ?? ''}`;
        used.add(item.goalId);
        out.unshift({
          id,
          source: 'plan',
          title: item.ritualTitle || item.goal?.title || 'Task',
          goalId: item.goalId,
          goal: item.goal,
          hour: item.hour,
          subtaskId: item.subtaskId,
        });
      }
    }

    return out.slice(0, MAX_SUGGESTIONS);
  }, [todayPlanItems, compost, logs, goals, isSnoozed, snoozedUntil, lowEnergy]);
}

export default function NextTinyStep({
  onStartSession,
  onMarkPlanItemDone,
  onMovePlanItemToCompost,
  onCompostStart5Min,
  onCompostMarkDone,
  lowEnergy = false,
  compact = false,
  className = '',
}) {
  const { goals, compost = [], logs = [], assignments, editGoal } = useGarden();
  const [snoozedUntil, setSnoozedUntil] = useState({});

  const todayPlanItems = useMemo(() => {
    const HOURS = [
      '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
      '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
    ];
    const out = [];
    for (const hour of HOURS) {
      const a = assignments?.[hour];
      if (!a) continue;
      const goalId = typeof a === 'string' ? a : (a?.goalId ?? a?.parentGoalId);
      const goal = goals?.find((g) => g.id === goalId);
      if (!goal) continue;
      const ritualTitle = typeof a === 'object' && a.ritualTitle ? a.ritualTitle : null;
      const subtaskId = typeof a === 'object' ? a.subtaskId : null;
      out.push({ hour, goalId, goal, ritualTitle, subtaskId });
    }
    return out;
  }, [assignments, goals]);

  const suggestions = useTinyStepSuggestions({
    todayPlanItems,
    compost,
    logs,
    goals,
    snoozedUntil,
    lowEnergy,
  });

  const handleSnooze = useCallback((itemId) => {
    setSnoozedUntil((prev) => ({ ...prev, [itemId]: Date.now() + SNOOZE_MS }));
  }, []);

  const handleMarkDone = useCallback(
    (suggestion) => {
      if ((suggestion.source === 'plan' || suggestion.source === 'recent' || suggestion.source === 'project') && suggestion.goal) {
        const est = suggestion.goal.estimatedMinutes ?? 60;
        const current = suggestion.goal.totalMinutes ?? 0;
        if (current < est) editGoal?.(suggestion.goalId, { totalMinutes: Math.max(current, est) });
        onMarkPlanItemDone?.(suggestion);
      } else if (suggestion.source === 'compost' && suggestion.compostItem) {
        onCompostMarkDone?.(suggestion.compostItem);
      }
    },
    [editGoal, onMarkPlanItemDone, onCompostMarkDone]
  );

  const handleMoveToCompost = useCallback(
    (suggestion) => {
      if (suggestion.source === 'plan' || suggestion.source === 'recent' || suggestion.source === 'project') {
        onMovePlanItemToCompost?.(suggestion);
      }
      // Compost items are already in compost; no "move to compost" for them
    },
    [onMovePlanItemToCompost]
  );

  const handleStart5Min = useCallback(
    (suggestion) => {
      if (suggestion.source === 'plan' || suggestion.source === 'recent' || suggestion.source === 'project') {
        if (suggestion.goal?.id) onStartSession?.(suggestion.goalId, suggestion.hour ?? null, suggestion.title, suggestion.subtaskId);
      } else if (suggestion.source === 'compost') {
        onCompostStart5Min?.(suggestion.compostItem);
      }
    },
    [onStartSession, onCompostStart5Min]
  );

  if (suggestions.length === 0) return null;

  return (
    <div
      className={`rounded-xl border-2 border-stone-200 bg-stone-50/90 ${compact ? 'p-3' : 'p-4'} ${className}`}
      aria-label="Next tiny steps"
    >
      <h3 className={`font-serif text-stone-800 ${compact ? 'text-sm mb-2' : 'text-base mb-3'}`}>
        Next tiny step
      </h3>
      <ul className="space-y-2" role="list">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg bg-white border border-stone-200/80"
          >
            <span className="min-w-0 flex-1 font-sans text-sm font-medium text-stone-900 truncate">
              {s.source === 'compost' && '♻️ '}
              {s.title}
            </span>
            <div className="flex flex-wrap items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleStart5Min(s)}
                className="px-2.5 py-1 rounded font-sans text-xs font-medium bg-moss-600 text-stone-50 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
              >
                5 min
              </button>
              {(s.source === 'plan' || s.source === 'recent' || s.source === 'project') && (
                <>
                  <button
                    type="button"
                    onClick={() => handleMarkDone(s)}
                    className="px-2.5 py-1 rounded font-sans text-xs font-medium bg-stone-200 text-stone-800 hover:bg-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-400/50"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveToCompost(s)}
                    className="px-2.5 py-1 rounded font-sans text-xs font-medium text-stone-600 hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-400/50"
                  >
                    To compost
                  </button>
                </>
              )}
              {s.source === 'compost' && (
                <button
                  type="button"
                  onClick={() => onCompostMarkDone?.(s.compostItem)}
                  className="px-2.5 py-1 rounded font-sans text-xs font-medium bg-stone-200 text-stone-800 hover:bg-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-400/50"
                >
                  Done
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSnooze(s.id)}
                className="px-2.5 py-1 rounded font-sans text-xs font-medium text-stone-500 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400/50"
                title="Snooze 30 min"
              >
                Snooze
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
