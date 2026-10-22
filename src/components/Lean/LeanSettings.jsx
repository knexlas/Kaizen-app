import { useState } from 'react';
import { generateWatchKey } from '../../domains/lean/watchFeed';
import { hhmm } from '../../domains/lean/leanModel';
import { Button, Card, SectionTitle, inputClass } from './ui';

const STATUS_TEXT = {
  off: 'Not set up',
  'signed-out': 'Sign in with Google to sync',
  pending: 'Connecting…',
  synced: 'Synced',
  error: 'Sync error',
};

function WatchSection({ lean, watch }) {
  const { googleUser, connectCalendar, updateUserSettings } = lean.garden;
  const [copied, setCopied] = useState(false);
  const key = watch.watchKey;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <SectionTitle>Garmin watch</SectionTitle>
      <p className="font-sans text-sm text-stone-600 dark:text-stone-300">
        Your fenix shows today’s blocks, this week and your projects, and buzzes when a block starts. Done and snooze on the watch come back here.
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-sans text-sm">
        <dt className="text-stone-500">Status</dt>
        <dd className={watch.status === 'error' ? 'text-rose-600' : 'text-stone-900 dark:text-stone-100'}>
          {STATUS_TEXT[watch.status]}{watch.lastSync ? ` · ${hhmm(watch.lastSync.getHours() * 60 + watch.lastSync.getMinutes())}` : ''}
        </dd>
        {watch.error && (<><dt className="text-stone-500">Error</dt><dd className="break-words text-xs text-rose-600">{watch.error}</dd></>)}
        <dt className="text-stone-500">Account</dt>
        <dd className="text-stone-900 dark:text-stone-100">{googleUser?.email ?? 'Not signed in'}</dd>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!googleUser && <Button tone="primary" onClick={() => connectCalendar()}>Sign in with Google</Button>}
        {!key && <Button tone={googleUser ? 'primary' : 'outline'} onClick={() => updateUserSettings({ watchKey: generateWatchKey() })}>Create watch code</Button>}
      </div>

      {key && (
        <div className="mt-4 rounded-xl bg-stone-100 p-3 dark:bg-stone-800">
          <p className="font-sans text-xs text-stone-500">Watch code: enter it in Garmin Connect → your watch → Apps → Kaizen Plan → Settings</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="select-all font-mono text-xl tracking-widest text-stone-900 dark:text-stone-100">{key}</code>
            <Button size="sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
            <Button size="sm" tone="ghost" onClick={() => updateUserSettings({ watchKey: generateWatchKey() })} title="The old code stops working">New code</Button>
            <Button size="sm" tone="danger" onClick={() => updateUserSettings({ watchKey: null })}>Turn off</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function LeanSettings({ lean, watch, onClose }) {
  const { userSettings, updateUserSettings } = lean.garden;
  const work = userSettings?.workHours ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100">Settings</h2>
        <Button tone="ghost" onClick={onClose}>Close</Button>
      </div>

      <Card>
        <SectionTitle>Working hours (used by “Plan my day/week”)</SectionTitle>
        <div className="flex flex-wrap items-center gap-2 font-sans text-sm">
          <input type="time" step={300} className={`${inputClass} w-auto`} value={work.start ?? '09:00'} onChange={(e) => updateUserSettings({ workHours: { start: e.target.value } })} aria-label="Work starts" />
          <span className="text-stone-500">to</span>
          <input type="time" step={300} className={`${inputClass} w-auto`} value={work.end ?? '17:00'} onChange={(e) => updateUserSettings({ workHours: { end: e.target.value } })} aria-label="Work ends" />
        </div>
      </Card>

      <WatchSection lean={lean} watch={watch} />

      <Card>
        <SectionTitle>Full Kaizen</SectionTitle>
        <p className="font-sans text-sm text-stone-600 dark:text-stone-300">
          The garden, Mochi, rituals and the rest are still here, using the same data. You can switch back any time.
        </p>
        <Button className="mt-3" onClick={() => updateUserSettings({ uiMode: 'garden' })}>Open full Kaizen</Button>
      </Card>
    </div>
  );
}
