const STORM_REGEX = /deadline|urgent|review|meeting/i;
const SUN_REGEX = /lunch|gym|break|coffee/i;
const EVENT_TITLE_REGEX = /\b(meeting|appointment|dentist|doctor|therapy|interview|flight|reservation|standup|sync|coffee with|lunch with|dinner with|class|event|party|wedding|birthday)\b/i;
const SCHEDULED_TASK_REGEX = /\b(email|call|text|book|buy|pay|send|draft|finish|write|review|fix|clean|order|reply|follow up|submit|ship|record|cancel|renew|pick up|drop off|update|get|need)\b/i;

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

export function isLikelyCalendarEventTitle(title) {
  return EVENT_TITLE_REGEX.test(String(title || ''));
}

export function isLikelyScheduledTaskTitle(title) {
  return SCHEDULED_TASK_REGEX.test(String(title || ''));
}
