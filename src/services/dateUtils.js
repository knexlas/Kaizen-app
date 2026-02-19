/**
 * Local date helpers (YYYY-MM-DD), day difference, and weekday indexing.
 *
 * Weekday index convention:
 * - JS Date.getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 * - mon0 (weekdayIndexMon0): 0 = Monday, 1 = Tuesday, ..., 6 = Sunday.
 *   Use mon0 in UI (e.g. day tabs Mon..Sun). Convert to/from getDay() only at boundaries.
 */

/**
 * Date as YYYY-MM-DD in local timezone.
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function localISODate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Weekday index with Monday = 0, Sunday = 6 (ISO-style). Convert from JS getDay() (0=Sun..6=Sat).
 * @param {Date} [date=new Date()]
 * @returns {number} 0..6 where 0=Mon, 6=Sun
 */
export function weekdayIndexMon0(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const js = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return (js + 6) % 7; // Mon->0, Tue->1, ..., Sun->6
}

/**
 * Convert mon0 index (0=Mon..6=Sun) back to JS getDay() (0=Sun..6=Sat). Use when calling APIs that expect getDay().
 * @param {number} mon0Index 0..6 (Mon..Sun)
 * @returns {number} 0..6 (Sun..Sat)
 */
export function jsDayFromMon0(mon0Index) {
  return (mon0Index + 1) % 7; // mon0=0 -> 1 (Mon), mon0=6 -> 0 (Sun)
}

/**
 * Number of days from start to end (end - start).
 * @param {string} endDate - YYYY-MM-DD
 * @param {string} startDate - YYYY-MM-DD
 * @returns {number}
 */
export function diffDays(endDate, startDate) {
  if (!endDate || !startDate) return 0;
  const end = new Date(endDate + 'T12:00:00');
  const start = new Date(startDate + 'T12:00:00');
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  // Sanity: 2025-02-17 is Monday -> mon0=0, js=1; 2025-02-23 is Sunday -> mon0=6, js=0
  const mon = new Date('2025-02-17T12:00:00');
  const sun = new Date('2025-02-23T12:00:00');
  if (weekdayIndexMon0(mon) !== 0 || weekdayIndexMon0(sun) !== 6 || jsDayFromMon0(0) !== 1 || jsDayFromMon0(6) !== 0) {
    console.warn('dateUtils: weekday mapping sanity check failed');
  }
}
