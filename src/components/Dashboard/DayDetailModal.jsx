import { motion, AnimatePresence } from 'framer-motion';

const StormIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-600 shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
    <path d="M13 11l-4 6h6l-4 6" />
  </svg>
);
const LeafIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-moss-500 shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);
const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-500 shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

function formatEventTime(startIso) {
  if (!startIso) return '—';
  try {
    const d = new Date(startIso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatEventDuration(startIso, endIso) {
  if (!startIso || !endIso) return null;
  try {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const mins = Math.round((end - start) / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  } catch {
    return null;
  }
}

function WeatherIcon({ type }) {
  if (type === 'storm') return <StormIcon />;
  if (type === 'sun') return <SunIcon />;
  return <LeafIcon />;
}

export default function DayDetailModal({ day, open, onClose, dateLabel = '', events: eventsProp = [] }) {
  const isOpen = day != null ? !!day : !!open;
  const dateLabelResolved = day != null ? (day.date ?? '') : dateLabel;
  const events = day != null ? (day.events ?? []) : eventsProp;
  const sortedEvents = Array.isArray(events)
    ? [...events].sort((a, b) => {
        if (!a.start || !b.start) return 0;
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      })
    : [];
  const hasEvents = sortedEvents.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-detail-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl bg-slate-50 border border-stone-200 shadow-xl overflow-hidden"
          >
            <header className="shrink-0 px-6 py-4 border-b border-stone-200">
              <h2 id="day-detail-title" className="font-serif text-stone-900 text-xl">
                {dateLabelResolved || 'Day'}
              </h2>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {!hasEvents ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="font-sans text-stone-500 text-sm">Calm water.</p>
                  <p className="font-sans text-stone-400 text-xs mt-1">No events this day.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {sortedEvents.map((event) => {
                    const timeStr = formatEventTime(event.start);
                    const durationStr = formatEventDuration(event.start, event.end);
                    return (
                      <li key={event.id ?? event.title ?? Math.random()}>
                        <div className="rounded-lg bg-white p-3 shadow-sm border border-stone-100 flex items-center gap-3">
                          <div className="shrink-0 w-12 font-sans text-sm font-medium text-stone-500 tabular-nums">
                            {timeStr}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-sans text-stone-900 text-sm font-medium truncate">
                              {event.title ?? 'Event'}
                            </p>
                            {durationStr && (
                              <p className="font-sans text-stone-500 text-xs mt-0.5">{durationStr}</p>
                            )}
                          </div>
                          <div className="shrink-0">
                            <WeatherIcon type={event.type ?? 'leaf'} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <footer className="shrink-0 px-6 py-4 border-t border-stone-200">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 font-sans text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                Close
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
