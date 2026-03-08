/**
 * Tactile feedback via Vibration API. Safe no-ops when unavailable (e.g. desktop).
 * Use for: subtask complete, drop in schedule, focus session end, water plant, milestone harvest.
 */

export function vibrateShort() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(50);
  }
}

export function vibrateCelebration() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([100, 50, 100]);
  }
}
