/**
 * Local date helpers (YYYY-MM-DD) and day difference.
 */

/**
 * Today's date as YYYY-MM-DD in local time.
 * @returns {string}
 */
export function localISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
