/**
 * Calendar import — placeholder for Google Calendar API.
 * Returns dummy weekly events; in production, replace with real API calls.
 */

const STORM_KEYWORDS = ['Meeting', 'Deadline', 'Review'];
const SUN_KEYWORDS = ['Lunch', 'Coffee', 'Gym'];

function inferWeatherAndCost(title) {
  const t = title || '';
  if (STORM_KEYWORDS.some((k) => t.includes(k))) {
    return { weather: 'storm', energy_cost: 3 };
  }
  if (SUN_KEYWORDS.some((k) => t.includes(k))) {
    return { weather: 'sun', energy_cost: -1 };
  }
  return { weather: 'cloud', energy_cost: 1 };
}

/** Dummy data that looks like real meetings (placeholder for Google Calendar API). */
const DUMMY_WEEKLY_EVENTS = [
  { id: '1', title: 'Sprint Review', start: '2025-02-17T10:00:00', end: '2025-02-17T11:00:00' },
  { id: '2', title: 'Team Meeting', start: '2025-02-17T14:00:00', end: '2025-02-17T14:30:00' },
  { id: '3', title: 'Lunch with Sarah', start: '2025-02-18T12:30:00', end: '2025-02-18T13:30:00' },
  { id: '4', title: 'Deadline: Report', start: '2025-02-18T17:00:00', end: '2025-02-18T17:00:00' },
  { id: '5', title: 'Coffee chat', start: '2025-02-19T09:00:00', end: '2025-02-19T09:30:00' },
  { id: '6', title: 'Gym', start: '2025-02-19T18:00:00', end: '2025-02-19T19:00:00' },
  { id: '7', title: '1:1 Review', start: '2025-02-20T11:00:00', end: '2025-02-20T11:30:00' },
];

/**
 * Fetches weekly events (placeholder: returns dummy data).
 * Applies rule-based weather and energy_cost from title.
 * @returns {Promise<Array<{ id, title, start, end, weather, energy_cost }>>}
 */
export async function fetchWeeklyEvents() {
  // TODO: Replace with Google Calendar API
  await new Promise((r) => setTimeout(r, 400));
  return DUMMY_WEEKLY_EVENTS.map((ev) => {
    const { weather, energy_cost } = inferWeatherAndCost(ev.title);
    return { ...ev, weather, energy_cost };
  });
}
