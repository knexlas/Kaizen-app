import { useMemo, useState } from 'react';
import { useGarden } from '../../context/GardenContext';
import { useDialog } from '../../context/DialogContext';

function formatDateLabel(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getGoalBadge(goal) {
  if (goal?._projectGoal) return 'Project';
  if (goal?.type === 'vitality') return 'Vitality';
  return 'Goal';
}

function getGoalContext(goal) {
  if (!goal) return 'No details yet.';
  if (goal.archivedAt) return `Archived ${formatDateLabel(goal.archivedAt.slice(0, 10) || goal.archivedAt)}`;
  if (goal._projectDeadline) return `Due ${formatDateLabel(goal._projectDeadline)}`;
  if (Array.isArray(goal.subtasks) && goal.subtasks.length > 0) return `${goal.subtasks.length} task${goal.subtasks.length === 1 ? '' : 's'}`;
  if (typeof goal.targetHours === 'number' && goal.targetHours > 0) return `${goal.targetHours} target hours`;
  return 'Visible in planning and the garden.';
}

function getRoutineContext(routine) {
  if (!routine) return 'No details yet.';
  const bits = [`${Math.max(1, Number(routine.duration) || 15)} min`];
  if (routine.category) bits.push(routine.category);
  if (routine.pausedUntil) bits.push(`Paused until ${routine.pausedUntil}`);
  if (routine.archivedAt) bits.push(`Archived ${formatDateLabel(routine.archivedAt.slice(0, 10) || routine.archivedAt)}`);
  return bits.join(' · ');
}

function TypeBadge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 font-sans text-[11px] font-medium text-stone-700 dark:bg-slate-700 dark:text-stone-100">
      {children}
    </span>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="rounded-[22px] border border-dashed border-stone-300 bg-stone-50/70 px-4 py-5 text-center dark:border-slate-600 dark:bg-slate-800/55">
      <p className="font-sans text-sm font-medium text-stone-700 dark:text-stone-200">{title}</p>
      <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">{body}</p>
    </div>
  );
}

export default function PlannerManageHub({ onEditGoal, onEditRoutines, onClose }) {
  const {
    allGoals = [],
    allRoutines = [],
    archiveGoal,
    restoreGoal,
    deleteGoal,
    archiveRoutine,
    restoreRoutine,
    deleteRoutine,
  } = useGarden();
  const { showConfirm } = useDialog();
  const [entityType, setEntityType] = useState('goals');
  const [statusFilter, setStatusFilter] = useState('active');
  const [query, setQuery] = useState('');
  const [expandedActionId, setExpandedActionId] = useState(null);

  const normalizedQuery = query.trim().toLowerCase();

  const goalItems = useMemo(
    () => (Array.isArray(allGoals) ? allGoals : []).filter((goal) => goal && goal.type !== 'routine'),
    [allGoals]
  );

  const routineItems = useMemo(
    () => (Array.isArray(allRoutines) ? allRoutines : []).filter(Boolean),
    [allRoutines]
  );

  const filteredGoals = useMemo(() => (
    goalItems.filter((goal) => {
      const archived = Boolean(goal?.archivedAt);
      if (statusFilter === 'active' && archived) return false;
      if (statusFilter === 'archived' && !archived) return false;
      if (!normalizedQuery) return true;
      return `${goal?.title ?? ''} ${goal?._projectDeadline ?? ''}`.toLowerCase().includes(normalizedQuery);
    })
  ), [goalItems, normalizedQuery, statusFilter]);

  const filteredRoutines = useMemo(() => (
    routineItems.filter((routine) => {
      const archived = Boolean(routine?.archivedAt);
      if (statusFilter === 'active' && archived) return false;
      if (statusFilter === 'archived' && !archived) return false;
      if (!normalizedQuery) return true;
      return `${routine?.title ?? ''} ${routine?.category ?? ''}`.toLowerCase().includes(normalizedQuery);
    })
  ), [routineItems, normalizedQuery, statusFilter]);

  const items = entityType === 'goals' ? filteredGoals : filteredRoutines;

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-stone-200/80 bg-white/82 p-4 shadow-sm dark:border-slate-600/80 dark:bg-slate-800/78">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-sans text-sm font-semibold text-stone-800 dark:text-stone-200">Manage goals and routines</p>
            <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">
              Edit, archive, restore, or permanently remove items without going into the garden.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-3 py-1.5 font-sans text-xs font-medium text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/70"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: 'goals', label: `Goals (${goalItems.filter((goal) => !goal?.archivedAt).length})` },
            { id: 'routines', label: `Routines (${routineItems.filter((routine) => !routine?.archivedAt).length})` },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setEntityType(option.id);
                setExpandedActionId(null);
              }}
              className={`rounded-full px-3 py-1.5 font-sans text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                entityType === option.id
                  ? 'bg-moss-600 text-white'
                  : 'border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-slate-600 dark:bg-slate-800/70 dark:text-stone-200 dark:hover:bg-slate-700/70'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { id: 'active', label: 'Active' },
            { id: 'archived', label: 'Archived' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setStatusFilter(option.id);
                setExpandedActionId(null);
              }}
              className={`rounded-full px-3 py-1.5 font-sans text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                statusFilter === option.id
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-slate-950'
                  : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 dark:border-slate-600 dark:bg-slate-800/70 dark:text-stone-300 dark:hover:bg-slate-700/70'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={entityType === 'goals' ? 'Search goals or projects...' : 'Search routines...'}
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 font-sans text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-moss-500/40 dark:border-slate-600 dark:bg-slate-900/65 dark:text-stone-100"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={statusFilter === 'active' ? `No active ${entityType} here.` : `No archived ${entityType} yet.`}
          body={statusFilter === 'active' ? 'Everything in this section is already clear.' : 'Archived items will stay here until you restore or delete them.'}
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isGoal = entityType === 'goals';
            const itemId = `${entityType}-${item.id}`;
            const isArchived = Boolean(item?.archivedAt);
            const isExpanded = expandedActionId === itemId;

            return (
              <div
                key={itemId}
                className={`rounded-[22px] border px-4 py-4 shadow-sm ${
                  isArchived
                    ? 'border-stone-200/80 bg-stone-50/85 dark:border-slate-700/80 dark:bg-slate-800/52'
                    : 'border-stone-200/90 bg-white/92 dark:border-slate-700/80 dark:bg-slate-800/74'
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-sans text-sm font-semibold text-stone-900 dark:text-stone-100">{item.title || (isGoal ? 'Untitled goal' : 'Untitled routine')}</p>
                      <TypeBadge>{isGoal ? getGoalBadge(item) : 'Routine'}</TypeBadge>
                      {isArchived && <TypeBadge>Archived</TypeBadge>}
                    </div>
                    <p className="mt-1 font-sans text-xs text-stone-500 dark:text-stone-400">
                      {isGoal ? getGoalContext(item) : getRoutineContext(item)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isGoal) onEditGoal?.(item);
                        else onEditRoutines?.(item);
                      }}
                      className="rounded-xl border border-stone-300 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/70"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (isGoal) {
                          if (isArchived) restoreGoal?.(item.id);
                          else await archiveGoal?.(item.id, { reason: 'manage-hub' });
                        } else if (isArchived) {
                          restoreRoutine?.(item.id);
                        } else {
                          await archiveRoutine?.(item.id, { reason: 'manage-hub' });
                        }
                        setExpandedActionId(null);
                      }}
                      className="rounded-xl border border-stone-300 px-3 py-2 font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:border-slate-600 dark:text-stone-200 dark:hover:bg-slate-700/70"
                    >
                      {isArchived ? 'Restore' : 'Archive'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedActionId((prev) => (prev === itemId ? null : itemId))}
                      className="rounded-xl px-2.5 py-2 font-sans text-xs font-medium text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:text-stone-400 dark:hover:text-stone-200"
                    >
                      More
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-3 py-3 dark:border-rose-800/80 dark:bg-rose-950/20">
                      <p className="font-sans text-xs text-rose-700 dark:text-rose-200">
                        Permanent delete removes this {isGoal ? 'item' : 'routine'} and cannot be undone.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          showConfirm({
                            message: `Delete "${item.title || (isGoal ? 'this goal' : 'this routine')}" permanently? This cannot be undone.`,
                            confirmLabel: 'Delete permanently',
                            cancelLabel: 'Keep',
                            destructive: true,
                            onConfirm: () => {
                              if (isGoal) deleteGoal?.(item.id);
                              else deleteRoutine?.(item.id);
                              setExpandedActionId(null);
                            },
                          });
                        }}
                        className="mt-2 rounded-xl border border-rose-300 px-3 py-2 font-sans text-sm font-medium text-rose-700 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400/40 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-950/35"
                      >
                        Delete permanently
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
