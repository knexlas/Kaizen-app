const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Fetch events for the upcoming week from the primary calendar.
 */
export async function fetchGoogleEvents(accessToken, timeMin, timeMax) {
  if (!accessToken) throw new Error("No access token");

  const url = new URL(`${CALENDAR_API_BASE}/calendars/primary/events`);
  url.searchParams.append('timeMin', timeMin.toISOString());
  url.searchParams.append('timeMax', timeMax.toISOString());
  url.searchParams.append('singleEvents', 'true');
  url.searchParams.append('orderBy', 'startTime');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) throw new Error('Failed to fetch events');
  const data = await response.json();
  
  // Map Google Events to "Garden Weather" format
  return (data.items || []).map(event => {
    const title = event.summary || 'Busy';
    // Simple logic to guess weather based on keywords
    let type = 'leaf';
    if (title.match(/deadline|urgent|review|meeting/i)) type = 'storm';
    if (title.match(/lunch|gym|break|coffee/i)) type = 'sun';

    return {
      id: event.id,
      title: title,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      type: type, // 'storm', 'leaf', 'sun'
      weather: type === 'storm' ? 'storm' : type === 'sun' ? 'sun' : 'cloud', // Legacy support
      source: 'google'
    };
  });
}

/**
 * Fetch events for a full month. Maps results to same Garden Weather format.
 * @param {string} accessToken - Google OAuth token
 * @param {number} year - Full year (e.g. 2025)
 * @param {number} month - Calendar month 1–12 (1 = January)
 * @returns {Promise<Array>} Events with id, title, start, end, type ('storm'|'leaf'|'sun')
 */
export async function fetchMonthEvents(accessToken, year, month) {
  if (!accessToken) throw new Error("No access token");

  const timeMin = new Date(year, month - 1, 1);
  const timeMax = new Date(year, month, 0, 23, 59, 59, 999);

  return fetchGoogleEvents(accessToken, timeMin, timeMax);
}

/**
 * Create a new event in Google Calendar (Time Blocking)
 */
export async function createGoogleEvent(accessToken, eventDetails) {
  if (!accessToken) return;

  const event = {
    summary: eventDetails.title,
    description: "Planted in Kaizen Garden 🌱",
    start: {
      dateTime: eventDetails.startTime, // ISO String
    },
    end: {
      dateTime: eventDetails.endTime, // ISO String
    },
  };

  const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) throw new Error('Failed to create event');
  return await response.json();
}