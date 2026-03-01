/**
 * Derives reflection-ready insights from logs, goals, and check-in data.
 * Used by Insights tab to answer: What happened? What helped? What's the pattern? What to try next?
 * Synthesizes existing data only — no new tracking.
 */

import { localISODate } from './dateUtils';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** This week Monday and Sunday (YYYY-MM-DD). */
function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { weekMonday: localISODate(monday), weekSunday: localISODate(sunday) };
}

function getLogDate(log) {
  const d = log?.date;
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) return localISODate(d);
  return '';
}

/**
 * @param {Array} logs
 * @param {Array} goals
 * @param {Array} checkInRows - { dateStr, spoonCount?, energyModifier? }
 * @param {number} [spiritPoints]
 * @returns {{
 *   whatHappened: { weekSessions, weekMinutes, weekTendingDays, topGoalNames, totalHarvest },
 *   whatHelped: { bestDayOfWeek, checkInEffect, shortVsLong, lowEnergyNote },
 *   pattern: string | null,
 *   suggestion: string | null,
 *   gardenStory: string | null
 * }}
 */
export function buildReflectionInsights(logs, goals, checkInRows = [], spiritPoints = 0) {
  const logList = Array.isArray(logs) ? logs : [];
  const goalList = Array.isArray(goals) ? goals : [];
  const goalMap = new Map(goalList.map((g) => [g.id, g]));
  const { weekMonday, weekSunday } = getWeekBounds();

  const totalHarvest = logList.reduce((sum, log) => sum + (Number(log.minutes) || 0), 0);

  const weekLogs = logList.filter((log) => {
    const d = getLogDate(log);
    return d >= weekMonday && d <= weekSunday;
  });
  const weekSessions = weekLogs.length;
  const weekMinutes = weekLogs.reduce((sum, log) => sum + (Number(log.minutes) || 0), 0);
  const weekDates = new Set(weekLogs.map(getLogDate).filter(Boolean));
  const weekTendingDays = weekDates.size;

  const byGoalThisWeek = {};
  weekLogs.forEach((log) => {
    const mins = Number(log.minutes) || 0;
    const name = goalMap.get(log.taskId)?.title ?? log.taskTitle ?? 'Focus';
    byGoalThisWeek[name] = (byGoalThisWeek[name] || 0) + mins;
  });
  const topGoalNames = Object.entries(byGoalThisWeek)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  let bestDayOfWeek = null;
  const last28Days = [];
  const now = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = localISODate(d);
    const mins = logList.reduce((sum, log) => (getLogDate(log) === dateStr ? sum + (Number(log.minutes) || 0) : sum), 0);
    last28Days.push({ dateStr, minutes: mins, dayOfWeek: d.getDay() });
  }
  const byDayOfWeek = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  last28Days.forEach(({ minutes, dayOfWeek }) => {
    byDayOfWeek[dayOfWeek] = (byDayOfWeek[dayOfWeek] || 0) + minutes;
  });
  const sorted = Object.entries(byDayOfWeek)
    .map(([d, m]) => ({ day: Number(d), minutes: m }))
    .filter((x) => x.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  if (sorted.length > 0) {
    const jsToLabel = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
    bestDayOfWeek = jsToLabel[sorted[0].day] ?? null;
  }

  let checkInEffect = null;
  const checkIns = Array.isArray(checkInRows) ? checkInRows : [];
  if (checkIns.length > 0) {
    const withCheckIn = checkIns.filter((r) => r.spoonCount != null);
    const minutesByDate = {};
    logList.forEach((log) => {
      const d = getLogDate(log);
      if (d) minutesByDate[d] = (minutesByDate[d] || 0) + (Number(log.minutes) || 0);
    });
    let sumWith = 0;
    let countWith = 0;
    let sumWithout = 0;
    let countWithout = 0;
    checkIns.forEach((r) => {
      const mins = minutesByDate[r.dateStr] || 0;
      if (r.spoonCount != null) {
        sumWith += mins;
        countWith += 1;
      } else {
        sumWithout += mins;
        countWithout += 1;
      }
    });
    const avgWith = countWith > 0 ? sumWith / countWith : 0;
    const avgWithout = countWithout > 0 ? sumWithout / countWithout : 0;
    if (countWith > 0 && avgWith > avgWithout + 5) {
      checkInEffect = 'On days you did a morning check-in, you tended to log more focus.';
    } else if (countWith > 0 && countWithout > 0) {
      checkInEffect = 'Your focus and check-ins moved together this week.';
    }
  }

  const shortThreshold = 10;
  let shortSessions = 0;
  let longSessions = 0;
  let shortMinutes = 0;
  let longMinutes = 0;
  logList.forEach((log) => {
    const m = Number(log.minutes) || 0;
    if (m <= shortThreshold) {
      shortSessions += 1;
      shortMinutes += m;
    } else {
      longSessions += 1;
      longMinutes += m;
    }
  });
  const totalSessions = shortSessions + longSessions;
  let shortVsLong = null;
  if (totalSessions > 0) {
    const shortPct = Math.round((shortSessions / totalSessions) * 100);
    if (shortSessions > 0 && longSessions > 0) {
      shortVsLong = `${shortPct}% of your sessions were 10 minutes or less — and they added up. Both short and longer sessions moved the needle.`;
    } else if (shortSessions > 0) {
      shortVsLong = 'Your focus came from short sessions. Small steps add up.';
    } else {
      shortVsLong = 'You leaned into longer sessions this period.';
    }
  }

  let lowEnergyNote = null;
  const lowSpoonDays = checkIns.filter((r) => typeof r.spoonCount === 'number' && r.spoonCount <= 4);
  if (lowSpoonDays.length > 0) {
    const minutesByDate = {};
    logList.forEach((log) => {
      const d = getLogDate(log);
      if (d) minutesByDate[d] = (minutesByDate[d] || 0) + (Number(log.minutes) || 0);
    });
    const minsOnLow = lowSpoonDays.reduce((sum, r) => sum + (minutesByDate[r.dateStr] || 0), 0);
    const avgLow = minsOnLow / lowSpoonDays.length;
    if (avgLow >= 5) {
      lowEnergyNote = 'On lower-spoon days you still showed up. That kind of tending matters.';
    }
  }

  let pattern = null;
  const parts = [];
  if (checkInEffect) parts.push(checkInEffect);
  if (shortVsLong && totalSessions >= 3) parts.push(shortVsLong);
  if (bestDayOfWeek) parts.push(`Your focus tended to cluster on ${bestDayOfWeek}s.`);
  if (parts.length > 0) pattern = parts.join(' ');

  let suggestion = null;
  if (weekTendingDays === 0 && totalHarvest === 0) {
    suggestion = 'Next week, try one 5-minute session on anything. Starting small counts.';
  } else if (weekTendingDays <= 2 && weekSessions > 0) {
    suggestion = 'You showed up a few times. Next week, try checking in one morning — it often helps focus follow.';
  } else if (checkInEffect && lowSpoonDays.length > 0) {
    suggestion = 'On low-energy days, one tiny step still grows the garden. Try one 5‑minute block next time.';
  } else if (shortSessions >= longSessions && totalSessions >= 2) {
    suggestion = 'Short sessions are working. Consider keeping one or two longer blocks for a goal you want to go deeper on.';
  } else if (bestDayOfWeek) {
    suggestion = `You tend to focus more on ${bestDayOfWeek}s. Next week, protect an hour on that day for one priority.`;
  } else {
    suggestion = 'Keep tending. One small session tomorrow will add to your rhythm.';
  }

  let gardenStory = null;
  if (spiritPoints > 0 || weekTendingDays > 0) {
    const pts = Math.floor(Number(spiritPoints) || 0);
    if (weekTendingDays > 0 && pts > 0) {
      gardenStory = `Your ${weekTendingDays} day${weekTendingDays !== 1 ? 's' : ''} of focus this week and ${pts} Spirit Point${pts !== 1 ? 's' : ''} (from every minute you tended) are what make the garden grow. You earned this.`;
    } else if (weekTendingDays > 0) {
      gardenStory = `You tended the garden ${weekTendingDays} day${weekTendingDays !== 1 ? 's' : ''} this week. That consistency is what growth is made of.`;
    } else if (pts > 0) {
      gardenStory = `Every minute you logged became a Spirit Point — ${pts} so far. The garden remembers.`;
    }
  }

  return {
    whatHappened: {
      weekSessions,
      weekMinutes,
      weekTendingDays,
      topGoalNames,
      totalHarvest,
    },
    whatHelped: {
      bestDayOfWeek,
      checkInEffect,
      shortVsLong,
      lowEnergyNote,
    },
    pattern,
    suggestion,
    gardenStory,
  };
}
