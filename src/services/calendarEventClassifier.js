const STORM_REGEX = /deadline|urgent|review|meeting/i;
const SUN_REGEX = /lunch|gym|break|coffee/i;

/**
 * Infer event type/weather and energy cost from title.
 * Returns canonical type ('storm'|'leaf'|'sun') and legacy weather key ('storm'|'cloud'|'sun').
 */
export function classifyCalendarEvent(title) {
  const t = String(title || '');
  let type = 'leaf';
  if (STORM_REGEX.test(t)) type = 'storm';
  if (SUN_REGEX.test(t)) type = 'sun';
  const weather = type === 'leaf' ? 'cloud' : type;
  const energy_cost = type === 'storm' ? 3 : type === 'sun' ? -1 : 1;
  return { type, weather, energy_cost };
}
