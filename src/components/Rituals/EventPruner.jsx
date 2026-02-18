import { useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';

const WEATHER_OPTIONS = [
  { id: 'storm', label: 'Storm', icon: '⚡', desc: 'High Energy/Stress' },
  { id: 'leaf', label: 'Leaf', icon: '🍃', desc: 'Standard' },
  { id: 'sun', label: 'Sun', icon: '☀️', desc: 'Restorative' },
];

function newEventId() {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// --- Icons (Updated with Leaf) ---
const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-500"><circle cx="12" cy="12" r="5" strokeWidth="2" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeWidth="2" strokeLinecap="round" /></svg>
);
const LeafIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-moss-500"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const StormIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-600"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 11l-4 6h6l-4 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

const COSTS = { storm: 3, leaf: 1, sun: -1 };
const WEATHER_ORDER = ['storm', 'leaf', 'sun'];

export default function EventPruner({ weekDays = [], initialEvents, onCommit, googleToken = null, onImportFromCloud, importingFromCloud = false }) {
  const [events, setEvents] = useState(initialEvents);
  const [addingDayIndex, setAddingDayIndex] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('leaf');

  const totalLoad = events.reduce((acc, e) => acc + (COSTS[e.type] ?? 0), 0);
  const maxLoad = 15;
  const isOverloaded = totalLoad > maxLoad;

  const toggleEvent = (id) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          const nextIdx = (WEATHER_ORDER.indexOf(e.type) + 1) % WEATHER_ORDER.length;
          return { ...e, type: WEATHER_ORDER[nextIdx] };
        }
        return e;
      })
    );
  };

  const removeEvent = (id, e) => {
    e.stopPropagation();
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
  };

  const startAddEvent = (dayIndex) => {
    setAddingDayIndex(dayIndex);
    setNewTitle('');
    setNewType('leaf');
  };

  const submitAddEvent = () => {
    const title = newTitle.trim() || 'New Event';
    setEvents((prev) => [
      ...prev,
      { id: newEventId(), dayIndex: addingDayIndex, title, type: newType },
    ]);
    setAddingDayIndex(null);
    setNewTitle('');
  };

  const cancelAddEvent = () => {
    setAddingDayIndex(null);
    setNewTitle('');
  };

  const dayLabels =
    weekDays.length === 7
      ? weekDays.map((d) => ({ dayName: d.day, date: d.date }))
      : Array.from({ length: 7 }, (_, i) => ({
          dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i],
          date: '',
        }));

  const groupedEvents = dayLabels.map((day, i) => ({
    ...day,
    dayIndex: i,
    dayEvents: events.filter((e) => e.dayIndex === i),
  }));

  const handleImportFromCloud = async () => {
    if (!googleToken) {
      alert('Please connect Calendar on Dashboard first.');
      return;
    }
    const merged = await onImportFromCloud?.(events);
    if (merged) setEvents(merged);
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-stone-50 h-[80vh] flex flex-col rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-6 bg-white border-b border-stone-100 z-10">
        <h2 className="font-serif text-2xl text-stone-800">Prune your Garden</h2>
        <p className="text-stone-500 text-sm">Tap leaves to adjust your load.</p>
        <button
          type="button"
          onClick={handleImportFromCloud}
          disabled={importingFromCloud}
          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 text-stone-600 text-sm font-sans hover:bg-stone-50 hover:border-moss-400 hover:text-moss-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {importingFromCloud ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-moss-500 border-t-transparent rounded-full animate-spin" aria-hidden />
              Scanning...
            </>
          ) : (
            <>📥 Import from Cloud</>
          )}
        </button>
      </div>

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <LayoutGroup>
          {groupedEvents.map((group, i) => (
            <motion.div key={i} layout>
              {/* Day Header (day + date when available) */}
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3 ml-1">
                {group.date ? `${group.dayName} · ${group.date}` : group.dayName}
              </h3>

              {/* Add Event row */}
              {addingDayIndex === group.dayIndex ? (
                <div className="mb-3 p-3 rounded-xl border border-stone-200 bg-white space-y-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Event name..."
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-moss-400/50"
                    autoFocus
                  />
                  <div className="flex gap-2 flex-wrap">
                    {WEATHER_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setNewType(opt.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          newType === opt.id
                            ? 'border-moss-500 bg-moss-50 text-moss-700'
                            : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={submitAddEvent}
                      className="px-3 py-1.5 text-sm bg-stone-800 text-stone-50 rounded-lg hover:bg-stone-700"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={cancelAddEvent}
                      className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg hover:bg-stone-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startAddEvent(group.dayIndex)}
                  className="w-full mb-3 py-2.5 rounded-xl border border-dashed border-stone-300 text-stone-500 text-sm hover:border-moss-400 hover:text-moss-600 hover:bg-moss-50/30 transition-colors"
                >
                  + Add Event...
                </button>
              )}

              {/* Events for this day */}
              <div className="space-y-3">
                {group.dayEvents.map((event) => (
                  <motion.div
                    key={event.id}
                    layout
                    onClick={() => toggleEvent(event.id)}
                    className={`
                      relative p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] flex items-center justify-between group
                      ${event.type === 'storm' ? 'bg-white border-slate-300 border-l-[6px] border-l-slate-500 shadow-sm' : ''}
                      ${event.type === 'leaf' ? 'bg-white border-stone-100 border-l-[6px] border-l-moss-400' : ''}
                      ${event.type === 'sun' ? 'bg-amber-50/40 border-amber-100 border-l-[6px] border-l-amber-400' : ''}
                    `}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-stone-700">{event.title}</span>
                      <span
                        className={`text-xs font-bold mt-1
                        ${event.type === 'storm' ? 'text-slate-500' : ''}
                        ${event.type === 'leaf' ? 'text-moss-600' : ''}
                        ${event.type === 'sun' ? 'text-amber-600' : ''}
                      `}
                      >
                        {event.type === 'storm' && '⚡ +3 Stones (High Drain)'}
                        {event.type === 'leaf' && '🍃 +1 Stone (Flow)'}
                        {event.type === 'sun' && '☀️ +1 Energy (Restores)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="p-2 bg-stone-50 rounded-full group-hover:bg-stone-100 transition-colors">
                        {event.type === 'storm' && <StormIcon />}
                        {event.type === 'leaf' && <LeafIcon />}
                        {event.type === 'sun' && <SunIcon />}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => removeEvent(event.id, e)}
                        className="p-1.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        aria-label="Remove event"
                      >
                        ×
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </LayoutGroup>
      </div>

      {/* Footer Budget */}
      <div className="p-6 bg-white border-t border-stone-100">
        <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-bold text-stone-400">Energy Required</span>
            <div className="text-right">
                <span className={`text-2xl font-serif font-bold ${isOverloaded ? 'text-orange-500' : 'text-moss-600'}`}>
                    {totalLoad}
                </span>
                <span className="text-sm text-stone-400"> / {maxLoad} stones</span>
            </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden mb-4">
             <motion.div 
                className={`h-full ${isOverloaded ? 'bg-orange-400' : 'bg-moss-500'}`}
                animate={{ width: `${Math.min((totalLoad / maxLoad) * 100, 100)}%` }}
             />
        </div>

        <button
          type="button"
          onClick={() => onCommit?.(events)}
          className="w-full py-4 bg-stone-800 text-stone-50 rounded-xl font-serif hover:bg-stone-700 transition-colors shadow-lg"
        >
          Confirm Plan
        </button>
      </div>
    </div>
  );
}