import { useState } from 'react';
import { hhmm, isTaskBlocked } from '../../domains/lean/leanModel';
import TaskComposer from './TaskComposer';
import { Badge, Button, Card, Check, Empty, SectionTitle, formatMinutes } from './ui';

function dayName(date, today) {
  if (date === today) return 'Today';
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

function DayColumn({ lean, date }) {
  const blocks = lean.blocksFor(date);
  const isPast = date < lean.today;
  const total = blocks.reduce((sum, b) => sum + b.duration, 0);
  return (
    <div className={`flex min-h-[8rem] flex-col rounded-xl border p-2 ${date === lean.today ? 'border-moss-500/50 bg-moss-100/40 dark:bg-moss-500/10' : 'border-stone-200 dark:border-stone-700'} ${isPast ? 'opacity-60' : ''}`}>
      <div className="mb-1 flex items-baseline justify-between gap-1">
        <p className="font-sans text-sm font-semibold text-stone-800 dark:text-stone-100">{dayName(date, lean.today)}</p>
        <p className="font-sans text-[11px] text-stone-500">{total ? formatMinutes(total) : ''}</p>
      </div>
      <ul className="flex-1 space-y-1">
        {blocks.map((b) => (
          <li key={b.key} className="flex items-start gap-1.5">
            <Check checked={b.completed} onChange={(v) => lean.setBlockDone(date, b, v)} label={`Mark ${b.title} done`} />
            <div className="min-w-0 flex-1">
              <p className={`truncate font-sans text-xs ${b.completed ? 'text-stone-400 line-through' : 'text-stone-800 dark:text-stone-200'}`}>{b.title}</p>
              <p className="font-sans text-[10px] tabular-nums text-stone-500">{hhmm(b.start)} · {formatMinutes(b.duration)}</p>
            </div>
            {!b.completed && !isPast && (
              <button type="button" className="font-sans text-xs text-stone-400 hover:text-rose-600" onClick={() => lean.unscheduleBlock(date, b)} aria-label={`Unschedule ${b.title}`}>✕</button>
            )}
          </li>
        ))}
      </ul>
      {!isPast && lean.weekBacklog.length > 0 && (
        <Button size="sm" tone="ghost" className="mt-1" onClick={() => lean.planDay(date)}>Fill this day</Button>
      )}
    </div>
  );
}

export default function LeanWeek({ lean }) {
  const [message, setMessage] = useState(null);
  const backlog = lean.weekBacklog;
  const backlogMinutes = backlog.reduce((sum, { task }) => sum + Math.round((task.estimatedHours || 0.5) * 60), 0);

  const flash = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          action={
            <Button size="sm" tone="primary" disabled={backlog.length === 0} onClick={() => {
              const placed = lean.planWeek();
              flash(placed ? `Planned ${placed} task${placed === 1 ? '' : 's'} across the week.` : 'No free time found (or the remaining tasks are blocked).');
            }}>
              Plan my week
            </Button>
          }
        >
          This week’s tasks · {backlog.length} to schedule{backlogMinutes ? ` · ${formatMinutes(backlogMinutes)}` : ''}
        </SectionTitle>
        {backlog.length === 0 ? <Empty>Nothing waiting for a time slot.</Empty> : (
          <ul className="mb-3 divide-y divide-stone-100 dark:divide-stone-800">
            {backlog.map(({ task, goal }) => (
              <li key={task.id} className="flex items-center gap-3 py-2">
                <Check checked={false} onChange={() => lean.setTaskDone(task.id, true)} label={`Mark ${task.title} done`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-sm text-stone-900 dark:text-stone-100">{task.title}</p>
                  <p className="truncate font-sans text-xs text-stone-500">{goal.title} · {formatMinutes(Math.round((task.estimatedHours || 0.5) * 60))}</p>
                </div>
                {isTaskBlocked(task, lean.index) && <Badge tone="rose">blocked</Badge>}
                <Button size="sm" tone="ghost" onClick={() => lean.updateTask(task.id, { weekOf: null })} title="Move back to the project list">Not this week</Button>
              </li>
            ))}
          </ul>
        )}
        <TaskComposer
          lean={lean}
          placeholder="Add a task for this week…"
          targets={[{ label: 'Add to week', value: 'week' }]}
          onSubmit={({ goalId, title, minutes }) => lean.addTask(goalId, title, minutes, { weekOf: lean.monday })}
        />
        {message && <p className="mt-2 font-sans text-xs text-moss-600 dark:text-moss-200" role="status">{message}</p>}
      </Card>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {lean.dates.map((date) => <DayColumn key={date} lean={lean} date={date} />)}
      </div>
    </div>
  );
}
