import { localISODate } from './dateUtils';

const STORAGE_KEY = 'kaizen_spirit_briefing';

function todayString() {
  return localISODate();
}

/**
 * @returns {{ lastInsight: string | null, lastInsightDate: string | null }}
 */
export function getStoredBriefing() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastInsight: null, lastInsightDate: null };
    const data = JSON.parse(raw);
    return {
      lastInsight: typeof data.lastInsight === 'string' ? data.lastInsight : null,
      lastInsightDate: typeof data.lastInsightDate === 'string' ? data.lastInsightDate : null,
    };
  } catch {
    return { lastInsight: null, lastInsightDate: null };
  }
}

/** @param {string} insight */
export function setStoredBriefing(insight) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lastInsight: insight, lastInsightDate: todayString() })
    );
  } catch (e) {
    console.warn('spiritBriefingStorage: set failed', e);
  }
}

/** True if we have a stored insight for today (no need to call API for daily briefing). */
export function hasBriefingForToday() {
  const { lastInsightDate } = getStoredBriefing();
  return lastInsightDate === todayString();
}
