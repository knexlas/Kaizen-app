import { useState } from 'react';
import { useLeanPlan } from '../../domains/lean/useLeanPlan';
import { useWatchSync } from '../../domains/lean/useWatchSync';
import LeanInbox from './LeanInbox';
import LeanProjects from './LeanProjects';
import LeanSettings from './LeanSettings';
import LeanToday from './LeanToday';
import LeanWeek from './LeanWeek';

const TABS = [
  { id: 'today', label: 'Today', icon: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'week', label: 'Week', icon: 'M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z' },
  { id: 'projects', label: 'Projects', icon: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z' },
  { id: 'inbox', label: 'Inbox', icon: 'M4 13h4l2 3h4l2-3h4M5 5h14l1 8v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5l1-8z' },
];

const TAB_STORAGE_KEY = 'kaizen.lean.tab';

function readTab() {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return TABS.some((t) => t.id === saved) ? saved : 'today';
  } catch {
    return 'today';
  }
}

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Lean Plan mode: Today / Week / Projects / Inbox on top of the same garden data. */
export default function LeanApp() {
  const lean = useLeanPlan();
  const watch = useWatchSync(lean);
  const [tab, setTabState] = useState(readTab);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inboxCount = Array.isArray(lean.garden.compost) ? lean.garden.compost.length : 0;

  const setTab = (id) => {
    setTabState(id);
    setSettingsOpen(false);
    try { localStorage.setItem(TAB_STORAGE_KEY, id); } catch { /* storage unavailable */ }
  };

  const dateLabel = new Date(`${lean.today}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-24 pt-4 sm:pb-8">
      <header className="mb-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl text-stone-900 dark:text-stone-100">Kaizen</h1>
          <p className="font-sans text-sm text-stone-500">{dateLabel}</p>
        </div>
        <nav className="hidden gap-1 rounded-xl bg-stone-100 p-1 sm:flex dark:bg-stone-800" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id && !settingsOpen ? 'page' : undefined}
              className={`rounded-lg px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                tab === t.id && !settingsOpen ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100' : 'text-stone-600 hover:text-stone-900 dark:text-stone-300'
              }`}
            >
              {t.label}{t.id === 'inbox' && inboxCount ? ` · ${inboxCount}` : ''}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="Settings"
          title={watch.status === 'synced' ? 'Watch synced' : 'Settings'}
          className="relative rounded-lg p-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
          {watch.status === 'synced' && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-moss-500" aria-hidden />}
          {watch.status === 'error' && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" aria-hidden />}
        </button>
      </header>

      <main>
        {settingsOpen ? (
          <LeanSettings lean={lean} watch={watch} onClose={() => setSettingsOpen(false)} />
        ) : (
          <>
            {tab === 'today' && <LeanToday lean={lean} />}
            {tab === 'week' && <LeanWeek lean={lean} />}
            {tab === 'projects' && <LeanProjects lean={lean} />}
            {tab === 'inbox' && <LeanInbox lean={lean} />}
          </>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-stone-700 dark:bg-stone-900/95" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id && !settingsOpen ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 font-sans text-[11px] ${tab === t.id && !settingsOpen ? 'text-moss-500 dark:text-moss-200' : 'text-stone-500'}`}
          >
            <Icon d={t.icon} />
            {t.label}{t.id === 'inbox' && inboxCount ? ` ${inboxCount}` : ''}
          </button>
        ))}
      </nav>
    </div>
  );
}
