import { useEffect, useState } from 'react';
import { hhmm, isTaskBlocked, minutesNow } from '../../domains/lean/leanModel';
import TaskComposer from './TaskComposer';
import { Badge, Button, Card, Check, Empty, SectionTitle, formatMinutes } from './ui';

function useMinuteClock() {
  const [now, setNow] = useState(minutesNow());
  useEffect(() => {
    const timer = setInterval(() => setNow(minutesNow()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function NowCard({ lean, current, next, now }) {
  if (!current && !next) {
    return (
      <Card className="text-center">
        <p className="font-serif text-lg text-stone-800 dark:text-stone-100">Nothing left on the plan today.</p>
        <p className="mt-1 font-sans text-sm text-stone-500">Add a task below or let “Plan my day” fill the gaps.</p>
      </Card>
    );
  }
  if (!current) {
    return (
      <Card>
        <p className="font-sans text-xs font-semibold uppercase tracking-wider text-stone-500">Free until {hhmm(next.start)}</p>
        <p className="mt-1 font-serif text-xl text-stone-900 dark:text-stone-100">Next: {next.title}</p>
        <p className="mt-1 font-sans text-sm text-stone-500">Starts in {formatMinutes(next.start - now)}</p>
        <div className="mt-3 flex gap-2">
          <Button tone="primary" onClick={() => lean.moveBlock(lean.today, next, Math.floor(now / 5) * 5)}>Start now</Button>
        </div>
      </Card>
    );
  }
  const elapsed = now - current.start;
  const pct = Math.min(100, Math.max(0, (elapsed / current.duration) * 100));
  return (
    <Card className="border-moss-500/40">
      <div className="flex items-center justify-between">
        <p className="font-sans text-xs font-semibold uppercase tracking-wider text-moss-500 dark:text-moss-200">Now · until {hhmm(current.start + current.duration)}</p>
        <p className="font-sans text-xs text-stone-500">{formatMinutes(Math.max(0, current.start + current.duration - now))} left</p>
      </div>
      <p className="mt-1 font-serif text-2xl text-stone-900 dark:text-stone-100">{current.title}</p>
      {current.goalTitle && current.goalTitle !== current.title && <p className="font-sans text-sm text-stone-500">{current.goalTitle}</p>}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
        <div className="h-full rounded-full bg-moss-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button tone="primary" onClick={() => lean.setBlockDone(lean.today, current, true)}>Done</Button>
        <Button onClick={() => lean.moveBlock(lean.today, current, current.start + 15)}>Snooze 15m</Button>
        {next && <p className="ml-auto self-center font-sans text-sm text-stone-500">Next {hhmm(next.start)} · {next.title}</p>}
      </div>
    </Card>
  );
}

function BlockRow({ lean, block, now }) {
  const isNow = !block.completed && block.start <= now && now < block.start + block.duration;
  const isPast = !block.completed && block.start + block.duration <= now;
  const task = block.taskId ? lean.index[block.taskId]?.task : null;
  const blocked = task ? isTaskBlocked(task, lean.index) : false;
  return (
    <li className={`flex items-center gap-3 rounded-xl px-2 py-2 ${isNow ? 'bg-moss-100/70 dark:bg-moss-500/10' : ''}`}>
      <Check checked={block.completed} onChange={(v) => lean.setBlockDone(lean.today, block, v)} label={`Mark ${block.title} done`} />
      <span className={`w-24 shrink-0 font-sans text-xs tabular-nums ${isPast ? 'text-amber-600' : 'text-stone-500'}`}>
        {hhmm(block.start)}–{hhmm(block.start + block.duration)}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-sans text-sm ${block.completed ? 'text-stone-400 line-through' : 'text-stone-900 dark:text-stone-100'}`}>{block.title}</p>
        <div className="flex flex-wrap gap-1">
          {block.goalTitle && block.goalTitle !== block.title && <span className="truncate font-sans text-xs text-stone-500">{block.goalTitle}</span>}
          {blocked && <Badge tone="rose">blocked</Badge>}
          {isPast && <Badge tone="amber">missed</Badge>}
        </div>
      </div>
      {!block.completed && (
        <div className="flex shrink-0 gap-1">
          <Button size="sm" tone="ghost" title="Push back 15 minutes" onClick={() => lean.moveBlock(lean.today, block, block.start + 15)}>+15</Button>
          <Button size="sm" tone="ghost" title="Remove from today" onClick={() => lean.unscheduleBlock(lean.today, block)} aria-label={`Remove ${block.title} from today`}>✕</Button>
        </div>
      )}
    </li>
  );
}

export default function LeanToday({ lean }) {
  const now = useMinuteClock();
  const [message, setMessage] = useState(null);
  const blocks = lean.blocksFor(lean.today);
  const open = blocks.filter((b) => !b.completed);
  const current = open.find((b) => b.start <= now && now < b.start + b.duration) ?? null;
  const next = open.find((b) => b.start > now) ?? null;
  const done = blocks.length - open.length;
  const backlog = lean.weekBacklog;

  const flash = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-4">
      <NowCard lean={lean} current={current} next={next} now={now} />

      <Card>
        <SectionTitle action={<span className="font-sans text-xs text-stone-500">{done}/{blocks.length} done</span>}>Today</SectionTitle>
        {blocks.length === 0 ? <Empty>No time blocks yet.</Empty> : (
          <ul className="space-y-0.5">
            {blocks.map((block) => <BlockRow key={block.key} lean={lean} block={block} now={now} />)}
          </ul>
        )}
        <div className="mt-3 border-t border-stone-100 pt-3 dark:border-stone-800">
          <TaskComposer
            lean={lean}
            placeholder="Add a task to today…"
            targets={[{ label: 'Today', value: 'today' }, { label: 'This week', value: 'week' }]}
            onSubmit={({ goalId, projectTitle, title, minutes, target }) => {
              if (target === 'week') {
                lean.addTask(goalId, title, minutes, { weekOf: lean.monday });
                flash('Added to this week.');
              } else {
                const start = lean.addTaskToDay(goalId, title, minutes, lean.today, projectTitle);
                flash(start == null ? 'Added, but today is full. It is on this week’s list.' : `Planned at ${hhmm(start)}.`);
              }
            }}
          />
          {message && <p className="mt-2 font-sans text-xs text-moss-600 dark:text-moss-200" role="status">{message}</p>}
        </div>
      </Card>

      <Card>
        <SectionTitle
          action={
            <Button size="sm" tone="primary" disabled={backlog.length === 0} onClick={() => {
              const placed = lean.planDay(lean.today);
              flash(placed ? `Planned ${placed} task${placed === 1 ? '' : 's'} into today.` : 'No free time left today (or tasks are blocked).');
            }}>
              Plan my day
            </Button>
          }
        >
          This week, not scheduled yet
        </SectionTitle>
        {backlog.length === 0 ? <Empty>Everything for this week has a time.</Empty> : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {backlog.map(({ task, goal }) => {
              const blocked = isTaskBlocked(task, lean.index);
              return (
                <li key={task.id} className="flex items-center gap-3 py-2">
                  <Check checked={false} onChange={() => lean.setTaskDone(task.id, true)} label={`Mark ${task.title} done`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-sm text-stone-900 dark:text-stone-100">{task.title}</p>
                    <p className="truncate font-sans text-xs text-stone-500">{goal.title} · {formatMinutes(Math.round((task.estimatedHours || 0.5) * 60))}</p>
                  </div>
                  {blocked && <Badge tone="rose">blocked</Badge>}
                  <Button size="sm" onClick={() => {
                    const start = lean.scheduleTaskNext(task.id, lean.today);
                    flash(start == null ? 'Today is full.' : `Planned at ${hhmm(start)}.`);
                  }}>
                    Do today
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
