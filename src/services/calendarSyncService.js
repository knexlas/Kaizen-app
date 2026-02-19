import { fetchGoogleEvents, createGoogleEvent } from './googleCalendarService';

const STORM_KEYWORDS = ['Meeting', 'Deadline', 'Review'];
const SUN_KEYWORDS = ['Lunch', 'Coffee', 'Gym'];

function inferWeatherAndCost(title) {
  const t = title || '';
  if (STORM_KEYWORDS.some((k) => t.includes(k))) return { weather: 'storm', energy_cost: 3 };
  if (SUN_KEYWORDS.some((k) => t.includes(k))) return { weather: 'sun', energy_cost: -1 };
  return { weather: 'cloud', energy_cost: 1 };
}

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
 * Fetches weekly events. With accessToken uses Google Calendar; otherwise returns placeholder data.
 * @param {string} [accessToken] - Optional Google OAuth token
 * @returns {Promise<Array<{ id, title, start, end, weather, energy_cost? }>>}
 */
export async function fetchWeeklyEvents(accessToken) {
  if (accessToken) {
    try {
      const start = new Date();
      const end = new Date(Date.now() + 7 * 86400000);
      const raw = await fetchGoogleEvents(accessToken, start, end);
      return raw.map((ev) => {
        const { weather, energy_cost } = inferWeatherAndCost(ev.title);
        return { ...ev, weather, energy_cost };
      });
    } catch (_) {
      return [];
    }
  }
  await new Promise((r) => setTimeout(r, 400));
  return DUMMY_WEEKLY_EVENTS.map((ev) => {
    const { weather, energy_cost } = inferWeatherAndCost(ev.title);
    return { ...ev, weather, energy_cost };
  });
}

/**
 * Helper function to escape special characters for ICS format
 */
function esc(s) {
  return String(s || '').replace(/[,;\\]/g, '\\$&');
}

/**
 * Convert Date to ICS format (YYYYMMDDTHHMMSSZ)
 */
function toICS(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generate ICS format string from events array
 * Each event has BEGIN:VEVENT/END:VEVENT with UID, DTSTART, DTEND, SUMMARY, DESCRIPTION
 */
export function generateICS(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KaizenGarden//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  
  events.forEach((ev) => {
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + (ev.id || crypto.randomUUID()) + '@kaizengarden');
    lines.push('DTSTART:' + toICS(ev.startTime || ev.start));
    lines.push('DTEND:' + toICS(ev.endTime || ev.end));
    lines.push('SUMMARY:' + esc(ev.title || 'Kaizen Task'));
    lines.push('DESCRIPTION:' + esc(ev.description || 'Planned in Kaizen Garden'));
    lines.push('END:VEVENT');
  });
  
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Parse ICS format string and extract events
 * Categorizes events as storm/sun/leaf based on title keywords
 */
export function parseICS(icsString) {
  const events = [];
  const blocks = icsString.split('BEGIN:VEVENT');
  
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    
    const get = (key) => {
      const regex = new RegExp(key + '[^:]*:(.+)', 'i');
      const match = block.match(regex);
      return match ? match[1].trim() : '';
    };
    
    const parseDate = (raw) => {
      if (!raw) return null;
      const cleaned = raw.replace(/Z/g, '');
      if (cleaned.length >= 15) {
        const year = parseInt(cleaned.slice(0, 4));
        const month = parseInt(cleaned.slice(4, 6)) - 1;
        const day = parseInt(cleaned.slice(6, 8));
        const hour = parseInt(cleaned.slice(9, 11)) || 0;
        const minute = parseInt(cleaned.slice(11, 13)) || 0;
        return new Date(year, month, day, hour, minute);
      }
      return new Date(raw);
    };
    
    const title = get('SUMMARY');
    const start = parseDate(get('DTSTART'));
    const end = parseDate(get('DTEND'));
    
    if (title && start) {
      // Categorize based on title keywords
      let type = 'leaf';
      if (title.match(/deadline|urgent|review|meeting/i)) {
        type = 'storm';
      } else if (title.match(/lunch|gym|break|coffee/i)) {
        type = 'sun';
      }
      
      events.push({
        id: get('UID') || 'ics-' + Date.now() + '-' + i,
        title,
        start: start.toISOString(),
        end: end ? end.toISOString() : start.toISOString(),
        source: 'ics',
        type
      });
    }
  }
  
  return events;
}

/**
 * Create Blob and trigger download of ICS file
 */
export function downloadICS(events, filename = 'kaizen-schedule.ics') {
  const ics = generateICS(events);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Create file input, read .ics file, and parse it
 */
export function importICSFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ics,text/calendar';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        resolve([]);
        return;
      }
      try {
        const text = await file.text();
        resolve(parseICS(text));
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}

/**
 * Generate Outlook.com deep link URL with subject/startdt/enddt/body params
 */
export function getOutlookURL(event) {
  const params = new URLSearchParams({
    subject: event.title || 'Kaizen Task',
    startdt: (event.startTime || event.start || '').toString(),
    enddt: (event.endTime || event.end || '').toString(),
    body: event.description || 'Planned in Kaizen Garden'
  });
  return 'https://outlook.live.com/calendar/0/deeplink/compose?' + params.toString();
}

/**
 * Generate Google Calendar URL with action=TEMPLATE
 */
export function getGoogleURL(event) {
  const start = toICS(event.startTime || event.start).replace('Z', '');
  const end = toICS(event.endTime || event.end).replace('Z', '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'Kaizen Task',
    dates: start + '/' + end,
    details: event.description || 'Planned in Kaizen Garden'
  });
  return 'https://calendar.google.com/calendar/render?' + params.toString();
}

/**
 * Unified function to push event to calendar
 * Routes to createGoogleEvent (if token), or opens URL (google/outlook), or downloadICS
 */
export async function pushToCalendar(provider, event, accessToken) {
  if (provider === 'google' && accessToken) {
    return createGoogleEvent(accessToken, event);
  }
  if (provider === 'google') {
    window.open(getGoogleURL(event), '_blank', 'noopener');
    return null;
  }
  if (provider === 'outlook') {
    window.open(getOutlookURL(event), '_blank', 'noopener');
    return null;
  }
  if (provider === 'ics') {
    downloadICS([event]);
    return null;
  }
  return null;
}

/**
 * Unified function to pull events from calendar
 * Routes to fetchGoogleEvents (google) or importICSFile (ics)
 */
export async function pullFromCalendar(provider, opts = {}) {
  if (provider === 'google') {
    if (!opts.accessToken) {
      throw new Error('Google token required');
    }
    return fetchGoogleEvents(
      opts.accessToken,
      opts.timeMin || new Date(),
      opts.timeMax || new Date(Date.now() + 7 * 86400000)
    );
  }
  if (provider === 'ics') {
    return importICSFile();
  }
  return [];
}

/**
 * Calendar provider definitions
 */
export const CALENDAR_PROVIDERS = [
  { id: 'google', name: 'Google Calendar', icon: 'G', needsAuth: true },
  { id: 'outlook', name: 'Outlook', icon: 'O', needsAuth: false },
  { id: 'ics', name: 'Apple / iCal / Other', icon: 'C', needsAuth: false }
];
