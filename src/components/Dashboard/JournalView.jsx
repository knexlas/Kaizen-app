import { useGarden } from '../../context/GardenContext';
import { localISODate } from '../../services/dateUtils';

const RATING_ICON = {
  withered: '🥀',
  sustained: '🍃',
  bloomed: '🌸',
};

function formatLogTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatLogDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

export default function JournalView() {
  const { logs } = useGarden();

  const byDate = (Array.isArray(logs) ? logs : []).reduce((acc, log) => {
    const dateKey = log.date ? (typeof log.date === 'string' ? log.date.slice(0, 10) : localISODate(new Date(log.date))) : 'unknown';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(log);
    return acc;
  }, {});

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  if (sortedDates.length === 0) {
    return (
      <div className="bg-stone-50 rounded-xl border border-stone-200 p-8 text-center">
        <p className="font-serif text-stone-600 text-lg">The pages are fresh.</p>
        <p className="font-sans text-sm text-stone-500 mt-2">Complete a session to write your first entry.</p>
      </div>
    );
  }

  return (
    <div className="bg-stone-50 rounded-xl border border-stone-200 overflow-hidden">
      <h2 className="font-serif text-stone-900 text-lg px-6 py-4 border-b border-stone-200">Journal</h2>
      <div className="divide-y divide-stone-100">
        {sortedDates.map((dateKey) => {
          const dayLogs = byDate[dateKey];
          const firstDate = dayLogs[0]?.date;
          const headerLabel = formatLogDate(firstDate);
          return (
            <div key={dateKey}>
              <h3 className="font-sans text-sm font-medium text-stone-500 px-6 py-3 bg-stone-100/60">
                {headerLabel}
              </h3>
              <ul className="divide-y divide-stone-100">
                {dayLogs.map((log, i) => (
                  <li key={log.date + i} className="px-6 py-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-sans text-sm text-stone-500 shrink-0">
                      {formatLogTime(log.date)}
                    </span>
                    <span className="font-sans text-stone-400 shrink-0" aria-hidden>•</span>
                    <span className="font-sans text-stone-900 font-medium min-w-0 truncate">
                      {log.taskTitle ?? 'Focus'}
                    </span>
                    <span className="shrink-0" aria-hidden>
                      {log.rating ? RATING_ICON[log.rating] ?? '🍃' : '—'}
                    </span>
                    {log.note && (
                      <span className="w-full font-sans text-sm text-stone-600 mt-0.5">
                        {log.note}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
