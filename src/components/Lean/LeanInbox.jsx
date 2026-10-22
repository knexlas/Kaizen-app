import { useState } from 'react';
import TaskComposer from './TaskComposer';
import { Button, Card, Empty, SectionTitle, inputClass } from './ui';

function InboxItem({ lean, item }) {
  const [converting, setConverting] = useState(false);
  const { removeFromCompost } = lean.garden;
  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 font-sans text-sm text-stone-900 dark:text-stone-100">{item.text}</p>
        <Button size="sm" onClick={() => setConverting((v) => !v)}>{converting ? 'Cancel' : 'Make task'}</Button>
        <Button size="sm" tone="ghost" onClick={() => removeFromCompost(item.id)} aria-label={`Delete “${item.text}”`}>✕</Button>
      </div>
      {converting && (
        <div className="mt-2">
          <TaskComposer
            lean={lean}
            initialTitle={item.text}
            autoFocus
            targets={[{ label: 'Today', value: 'today' }, { label: 'This week', value: 'week' }, { label: 'Project only', value: 'later' }]}
            onSubmit={({ goalId, projectTitle, title, minutes, target }) => {
              if (target === 'today') lean.addTaskToDay(goalId, title, minutes, lean.today, projectTitle);
              else lean.addTask(goalId, title, minutes, target === 'week' ? { weekOf: lean.monday } : {});
              removeFromCompost(item.id);
            }}
          />
        </div>
      )}
    </li>
  );
}

export default function LeanInbox({ lean }) {
  const { compost, addToCompost } = lean.garden;
  const [text, setText] = useState('');
  const items = Array.isArray(compost) ? compost : [];

  return (
    <Card>
      <SectionTitle>Inbox · {items.length}</SectionTitle>
      <form className="mb-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { addToCompost(text); setText(''); } }}>
        <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} placeholder="Capture anything. Sort it later." aria-label="Capture to inbox" />
        <Button tone="primary" type="submit" disabled={!text.trim()}>Capture</Button>
      </form>
      {items.length === 0 ? <Empty>Inbox zero.</Empty> : (
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {items.map((item) => <InboxItem key={item.id} lean={lean} item={item} />)}
        </ul>
      )}
    </Card>
  );
}
