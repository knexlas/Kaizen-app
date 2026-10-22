import { useState } from 'react';
import { getBlockedDependents, getOpenBlockers, isTaskDone, taskMinutes } from '../../domains/lean/leanModel';
import TaskComposer from './TaskComposer';
import { Badge, Button, Card, Check, DurationSelect, Empty, SectionTitle, formatMinutes, inputClass } from './ui';

function BlockerPicker({ lean, task, goal }) {
  const candidates = (goal.subtasks ?? []).filter((t) => t.id !== task.id && !isTaskDone(t) && !(task.blockedBy ?? []).includes(t.id)
    // no direct cycles: a task cannot wait on something that waits on it
    && !(t.blockedBy ?? []).includes(task.id));
  if (candidates.length === 0) return null;
  return (
    <select
      aria-label={`Add a task that blocks ${task.title}`}
      value=""
      onChange={(e) => e.target.value && lean.updateTask(task.id, { blockedBy: [...(task.blockedBy ?? []), e.target.value] })}
      className={`${inputClass} w-auto py-0.5 text-xs`}
    >
      <option value="">+ blocked by…</option>
      {candidates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
    </select>
  );
}

function TaskRow({ lean, task, goal }) {
  const [open, setOpen] = useState(false);
  const done = isTaskDone(task);
  const blockers = getOpenBlockers(task, lean.index);
  const dependents = getBlockedDependents(task, lean.index);
  const thisWeek = Boolean(task.weekOf) && task.weekOf <= lean.monday;
  return (
    <li className="py-2">
      <div className="flex items-center gap-3">
        <Check checked={done} onChange={(v) => lean.setTaskDone(task.id, v)} label={`Mark ${task.title} done`} />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <p className={`truncate font-sans text-sm ${done ? 'text-stone-400 line-through' : 'text-stone-900 dark:text-stone-100'}`}>{task.title}</p>
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-sans text-xs text-stone-500">{formatMinutes(taskMinutes(task))}</span>
            {!done && blockers.length > 0 && <Badge tone="rose" title={blockers.map((b) => b.title).join(', ')}>waiting on {blockers.length === 1 ? blockers[0].title : `${blockers.length} tasks`}</Badge>}
            {!done && dependents.length > 0 && <Badge tone="amber">blocks {dependents.length}</Badge>}
            {!done && thisWeek && <Badge tone="moss">this week</Badge>}
          </div>
        </button>
        {!done && (
          <Button size="sm" tone={thisWeek ? 'ghost' : 'outline'} onClick={() => lean.updateTask(task.id, { weekOf: thisWeek ? null : lean.monday })}>
            {thisWeek ? 'Unplan' : 'This week'}
          </Button>
        )}
      </div>
      {open && (
        <div className="ml-8 mt-2 flex flex-wrap items-center gap-2">
          <input
            className={`${inputClass} w-56 py-1 text-xs`}
            defaultValue={task.title}
            aria-label="Rename task"
            onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && lean.updateTask(task.id, { title: e.target.value.trim() })}
          />
          <DurationSelect className="py-0.5 text-xs" value={taskMinutes(task)} onChange={(m) => lean.updateTask(task.id, { estimatedHours: m / 60 })} />
          {(task.blockedBy ?? []).map((id) => {
            const blocker = lean.index[id]?.task;
            if (!blocker) return null;
            return (
              <Badge key={id} tone={isTaskDone(blocker) ? 'stone' : 'rose'}>
                blocked by {blocker.title}
                <button type="button" aria-label={`Remove blocker ${blocker.title}`} className="ml-0.5 hover:text-stone-900" onClick={() => lean.updateTask(task.id, { blockedBy: task.blockedBy.filter((b) => b !== id) })}>✕</button>
              </Badge>
            );
          })}
          <BlockerPicker lean={lean} task={task} goal={goal} />
          {!done && <Button size="sm" onClick={() => lean.scheduleTaskNext(task.id, lean.today)}>Do today</Button>}
          <Button size="sm" tone="danger" onClick={() => lean.removeTask(task.id)}>Delete</Button>
        </div>
      )}
    </li>
  );
}

function ProjectCard({ lean, goal, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const [showDone, setShowDone] = useState(false);
  const tasks = goal.subtasks ?? [];
  const openTasks = tasks.filter((t) => !isTaskDone(t));
  const doneTasks = tasks.filter((t) => isTaskDone(t));
  const blocked = openTasks.filter((t) => getOpenBlockers(t, lean.index).length > 0);
  const blockers = openTasks.filter((t) => getBlockedDependents(t, lean.index).length > 0);
  // Blockers first (they unlock the rest), then free tasks, then blocked ones.
  const rank = (t) => (blockers.includes(t) ? 0 : blocked.includes(t) ? 2 : 1);
  const sorted = [...openTasks].sort((a, b) => rank(a) - rank(b));
  const pct = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  return (
    <Card>
      <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg text-stone-900 dark:text-stone-100">{goal.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="font-sans text-xs text-stone-500">{doneTasks.length}/{tasks.length} done</span>
            {blocked.length > 0 && <Badge tone="rose">{blocked.length} blocked</Badge>}
            {blockers.length > 0 && <Badge tone="amber">{blockers.length} blocking</Badge>}
          </div>
        </div>
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700" aria-hidden>
          <div className="h-full bg-moss-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-sans text-stone-400" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-3">
          {blockers.some((t) => !blocked.includes(t)) && (
            <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 font-sans text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              Unblock first: {blockers.filter((t) => !blocked.includes(t)).map((t) => t.title).join(', ')}
            </p>
          )}
          {sorted.length === 0 ? <Empty>No open tasks.</Empty> : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {sorted.map((t) => <TaskRow key={t.id} lean={lean} task={t} goal={goal} />)}
            </ul>
          )}
          {doneTasks.length > 0 && (
            <button type="button" className="mt-2 font-sans text-xs text-stone-500 hover:text-stone-800" onClick={() => setShowDone((v) => !v)}>
              {showDone ? 'Hide' : 'Show'} {doneTasks.length} done
            </button>
          )}
          {showDone && (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {doneTasks.map((t) => <TaskRow key={t.id} lean={lean} task={t} goal={goal} />)}
            </ul>
          )}
          <div className="mt-3 border-t border-stone-100 pt-3 dark:border-stone-800">
            <TaskComposer
              lean={lean}
              fixedProjectId={goal.id}
              placeholder={`Add a task to ${goal.title}…`}
              targets={[{ label: 'Add', value: 'later' }, { label: 'This week', value: 'week' }]}
              onSubmit={({ title, minutes, target }) => lean.addTask(goal.id, title, minutes, target === 'week' ? { weekOf: lean.monday } : {})}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

export default function LeanProjects({ lean }) {
  const [name, setName] = useState('');
  const totalBlocked = lean.projects.reduce((sum, g) => sum + (g.subtasks ?? []).filter((t) => !isTaskDone(t) && getOpenBlockers(t, lean.index).length > 0).length, 0);

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>{lean.projects.length} projects{totalBlocked ? ` · ${totalBlocked} tasks blocked` : ''}</SectionTitle>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (lean.addProject(name)) setName(''); }}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="New project…" aria-label="New project name" />
          <Button tone="primary" type="submit" disabled={!name.trim()}>Add</Button>
        </form>
      </Card>
      {lean.projects.length === 0 && <Empty>No projects yet.</Empty>}
      {lean.projects.map((goal, i) => <ProjectCard key={goal.id} lean={lean} goal={goal} defaultOpen={i === 0} />)}
    </div>
  );
}
