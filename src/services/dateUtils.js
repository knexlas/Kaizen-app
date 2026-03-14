/**
 * Local date helpers (YYYY-MM-DD), day difference, weekday indexing, and custom day-start.
 *
 * Weekday index convention:
 * - JS Date.getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 * - mon0 (weekdayIndexMon0): 0 = Monday, 1 = Tuesday, ..., 6 = Sunday.
 *
 * Custom day start: If "my day starts at 3:00 AM", then 1:30 AM Tuesday is still "Monday" (logical).
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
 * Parse "My Day Starts At" setting to hour (0–5). '00:00' -> 0, '03:00' -> 3.
 * @param {string} [value] - '00:00' | '01:00' | ... | '05:00'
 * @returns {number} 0–5
 */
export function getDayStartsAtHour(value) {
  if (value == null || value === '') return 0;
  const h = parseInt(String(value).trim().split(':')[0], 10);
  if (Number.isNaN(h)) return 0;
  return Math.max(0, Math.min(5, Math.floor(h)));
}

/**
 * Logical "today" given a custom day start. If day starts at 3:00 AM, then 1:30 AM Tuesday is still Monday.
 * @param {Date} [date=new Date()]
 * @param {number} [dayStartsAtHour=0] - 0 = midnight, 1 = 1 AM, ..., 5 = 5 AM
 * @returns {string} YYYY-MM-DD
 */
export function getLogicalToday(date = new Date(), dayStartsAtHour = 0) {
  const d = date instanceof Date ? date : new Date(date);
  if (dayStartsAtHour <= 0) return localISODate(d);
  const hour = d.getHours();
  if (hour < dayStartsAtHour) {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    return localISODate(prev);
  }
  return localISODate(d);
}

/**
 * Is the given date string the same as logical today?
 * @param {string} dateStr - YYYY-MM-DD
 * @param {Date} [now=new Date()]
 * @param {number} [dayStartsAtHour=0]
 */
export function isLogicalToday(dateStr, now = new Date(), dayStartsAtHour = 0) {
  if (!dateStr) return false;
  return getLogicalToday(now, dayStartsAtHour) === dateStr;
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
 * This week's Sunday as YYYY-MM-DD in local timezone.
 * Stable for the whole week: same value from Sun–Sat so ritual completion keying is consistent.
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getThisWeekSundayLocal(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getDay();
  const sundayOffset = day === 0 ? 0 : -day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + sundayOffset);
  return localISODate(sunday);
}

/**
 * ISO week-based id for caching (e.g. "2025-W09"). Same week = same id.
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getWeekId(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7)); // Thursday of this week
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
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

/**
 * Days until a deadline date (YYYY-MM-DD). Positive = future, negative = overdue, null if missing/invalid.
 * Single source of truth for deadline display and risk logic across cockpit and services.
 * @param {string|null|undefined} dateStr - YYYY-MM-DD
 * @returns {number|null}
 */
export function daysUntilDeadline(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const deadline = new Date(dateStr + 'T23:59:59');
  if (Number.isNaN(deadline.getTime())) return null;
  const now = new Date();
  return Math.ceil((deadline - now) / (24 * 60 * 60 * 1000));
}

if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  // Sanity: 2025-02-17 is Monday -> mon0=0, js=1; 2025-02-23 is Sunday -> mon0=6, js=0
  const mon = new Date('2025-02-17T12:00:00');
  const sun = new Date('2025-02-23T12:00:00');
  if (weekdayIndexMon0(mon) !== 0 || weekdayIndexMon0(sun) !== 6 || jsDayFromMon0(0) !== 1 || jsDayFromMon0(6) !== 0) {
    console.warn('dateUtils: weekday mapping sanity check failed');
  }
}
