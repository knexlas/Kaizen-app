/**
 * Derives reflection-ready insights from logs, goals, and check-in data.
 * Used by Insights tab to answer: What happened? What helped? What's the pattern? What to try next?
 * Synthesizes existing data only — no new tracking.
 */

import { localISODate } from './dateUtils';
import { inferTaskTimingType } from './energyDictionaryService';
import { getPlannedMinutesByWeekday } from '../utils/plannedHoursAggregation';

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

const TIME_BANDS = [
  { id: 'early_morning', label: 'early morning', start: 6, end: 9 },
  { id: 'late_morning', label: 'late morning', start: 9, end: 12 },
  { id: 'early_afternoon', label: 'early afternoon', start: 12, end: 15 },
  { id: 'late_afternoon', label: 'late afternoon', start: 15, end: 18 },
  { id: 'evening', label: 'evening', start: 18, end: 22 },
];

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getHourFromDateValue(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getHours();
}

function getBandForHour(hour) {
  if (!Number.isFinite(Number(hour))) return TIME_BANDS[1];
  return TIME_BANDS.find((band) => hour >= band.start && hour < band.end) ?? TIME_BANDS[TIME_BANDS.length - 1];
}

function buildHourMap() {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    starts: 0,
    completes: 0,
    abandons: 0,
    completionMinutes: 0,
  }));
}

function buildBandMap() {
  return TIME_BANDS.reduce((acc, band) => {
    acc[band.id] = { bandId: band.id, label: band.label, starts: 0, completes: 0, abandons: 0, completionMinutes: 0 };
    return acc;
  }, {});
}

function completionScoreForHour(row) {
  return (row.completes * 3) + Math.min(3, row.completionMinutes / 45) - (row.abandons * 2) - Math.max(0, row.starts - row.completes) * 0.5;
}

function describeFocusReason(bestBand) {
  if (!bestBand) return null;
  if (bestBand.completes >= Math.max(2, bestBand.abandons + 1)) {
    return `You usually finish focused work better in ${bestBand.label}.`;
  }
  return `${bestBand.label[0].toUpperCase()}${bestBand.label.slice(1)} is currently your most reliable focus window.`;
}

function describeAdminReason(bestBand) {
  if (!bestBand) return null;
  return `Admin and lighter tasks tend to land better in ${bestBand.label}.`;
}

function describeWeakWindow(band) {
  if (!band) return null;
  return `Heavy work tends to slip more in ${band.label}.`;
}

/**
 * Build a lightweight derived energy model from logs, planner state, and focus behavior history.
 */
export function buildDerivedEnergyProfile({
  logs = [],
  goals = [],
  weekAssignments = {},
  behaviorHistory = [],
  userSettings = null,
} = {}) {
  const hourMap = buildHourMap();
  const focusBandMap = buildBandMap();
  const taskTypeBands = {
    deep_work: buildBandMap(),
    admin: buildBandMap(),
    low_energy: buildBandMap(),
  };
  const weekdayPressure = WEEKDAY_LABELS.map((label, dayIndex) => ({
    dayIndex,
    label,
    starts: 0,
    completes: 0,
    abandons: 0,
    plannedMinutes: 0,
  }));
  const goalMap = new Map((Array.isArray(goals) ? goals : []).map((goal) => [goal.id, goal]));
  const hasTrackedFocusCompletes = (Array.isArray(behaviorHistory) ? behaviorHistory : []).some((event) => event?.type === 'focus_complete');

  (Array.isArray(behaviorHistory) ? behaviorHistory : []).forEach((event) => {
    const d = event?.date ? new Date(event.date) : null;
    if (!d || Number.isNaN(d.getTime())) return;
    const hour = Number.isFinite(Number(event.hour)) ? Number(event.hour) : d.getHours();
    const band = getBandForHour(hour);
    const taskType = event?.taskType || inferTaskTimingType(goalMap.get(event?.goalId) ?? event?.title);
    const dayIndex = d.getDay();

    if (event.type === 'focus_start') {
      hourMap[hour].starts += 1;
      focusBandMap[band.id].starts += 1;
      weekdayPressure[dayIndex].starts += 1;
    }
    if (event.type === 'focus_complete') {
      hourMap[hour].completes += 1;
      hourMap[hour].completionMinutes += Number(event.minutes) || 0;
      focusBandMap[band.id].completes += 1;
      focusBandMap[band.id].completionMinutes += Number(event.minutes) || 0;
      weekdayPressure[dayIndex].completes += 1;
      taskTypeBands[taskType][band.id].completes += 1;
      taskTypeBands[taskType][band.id].completionMinutes += Number(event.minutes) || 0;
    }
    if (event.type === 'focus_abandon') {
      hourMap[hour].abandons += 1;
      focusBandMap[band.id].abandons += 1;
      weekdayPressure[dayIndex].abandons += 1;
    }
  });

  (Array.isArray(logs) ? logs : []).forEach((log) => {
    const d = log?.date ? new Date(log.date) : null;
    if (!d || Number.isNaN(d.getTime())) return;
    const hour = d.getHours();
    const band = getBandForHour(hour);
    const goal = goalMap.get(log?.taskId);
    const taskType = inferTaskTimingType({
      ...(goal ?? {}),
      taskTitle: log?.taskTitle,
      minutes: log?.minutes,
    });
    hourMap[hour].completionMinutes += Number(log?.minutes) || 0;
    focusBandMap[band.id].completionMinutes += Number(log?.minutes) || 0;
    taskTypeBands[taskType][band.id].completionMinutes += Number(log?.minutes) || 0;
    if (!hasTrackedFocusCompletes) {
      hourMap[hour].completes += 1;
      focusBandMap[band.id].completes += 1;
      weekdayPressure[d.getDay()].completes += 1;
      taskTypeBands[taskType][band.id].completes += 1;
    }
  });

  const plannedMinutesByWeekday = getPlannedMinutesByWeekday(weekAssignments ?? {}, goals ?? []);
  weekdayPressure.forEach((row) => {
    row.plannedMinutes = plannedMinutesByWeekday[row.dayIndex] ?? 0;
    row.pressureScore = (row.abandons * 2) + Math.max(0, row.starts - row.completes) + (row.plannedMinutes / 90);
  });

  const focusBandList = Object.values(focusBandMap).map((band) => ({
    ...band,
    score: (band.completes * 3) + Math.min(4, band.completionMinutes / 60) - (band.abandons * 2),
  }));
  const bestFocusBand = [...focusBandList].sort((a, b) => b.score - a.score || b.completes - a.completes)[0] ?? null;
  const weakFocusBand = [...focusBandList]
    .filter((band) => band.starts + band.completes + band.abandons >= 2)
    .sort((a, b) => (b.abandons - b.completes) - (a.abandons - a.completes))[0] ?? null;

  const deepWorkBand = Object.values(taskTypeBands.deep_work).sort((a, b) => (b.completes * 2 + b.completionMinutes / 60) - (a.completes * 2 + a.completionMinutes / 60))[0] ?? bestFocusBand;
  const adminBand = Object.values(taskTypeBands.admin).sort((a, b) => (b.completes * 2 + b.completionMinutes / 90) - (a.completes * 2 + a.completionMinutes / 90))[0] ?? TIME_BANDS[2];
  const lowEnergyBand = Object.values(taskTypeBands.low_energy).sort((a, b) => (b.completes * 2 + b.completionMinutes / 90) - (a.completes * 2 + a.completionMinutes / 90))[0] ?? TIME_BANDS[3];

  const bestHourWindow = (() => {
    let best = null;
    for (let startHour = 8; startHour <= 17; startHour += 1) {
      const rows = [hourMap[startHour], hourMap[startHour + 1]].filter(Boolean);
      const score = rows.reduce((sum, row) => sum + completionScoreForHour(row), 0);
      const starts = rows.reduce((sum, row) => sum + row.starts, 0);
      const abandons = rows.reduce((sum, row) => sum + row.abandons, 0);
      const completes = rows.reduce((sum, row) => sum + row.completes, 0);
      const candidate = {
        startHour,
        endHour: startHour + 2,
        score,
        starts,
        abandons,
        completes,
      };
      if (!best || candidate.score > best.score || (candidate.score === best.score && candidate.completes > best.completes)) {
        best = candidate;
      }
    }
    return best;
  })();

  const overloadWeekday = [...weekdayPressure]
    .filter((row) => row.pressureScore > 0)
    .sort((a, b) => b.pressureScore - a.pressureScore)[0] ?? null;

  const focusRecommendation = bestFocusBand
    ? {
        bandId: bestFocusBand.bandId,
        label: bestFocusBand.label,
        explanation: describeFocusReason(bestFocusBand),
      }
    : {
        bandId: 'late_morning',
        label: 'late morning',
        explanation: 'Late morning is a strong default for focused work.',
      };

  const adminRecommendation = adminBand
    ? {
        bandId: adminBand.bandId,
        label: adminBand.label,
        explanation: describeAdminReason(adminBand),
      }
    : {
        bandId: 'early_afternoon',
        label: 'early afternoon',
        explanation: 'Admin usually fits better after your first focus block.',
      };

  const lowEnergyRecommendation = lowEnergyBand
    ? {
        bandId: lowEnergyBand.bandId,
        label: lowEnergyBand.label,
        explanation: `When energy is lower, ${lowEnergyBand.label} is usually a better fit for lighter work.`,
      }
    : {
        bandId: 'late_afternoon',
        label: 'late afternoon',
        explanation: 'Lighter work tends to fit better later in the day.',
      };

  return {
    focusWindow: bestHourWindow
      ? {
          startHour: bestHourWindow.startHour,
          endHour: bestHourWindow.endHour,
          duration: bestHourWindow.endHour - bestHourWindow.startHour,
          label: `${bestHourWindow.startHour % 12 === 0 ? 12 : bestHourWindow.startHour % 12}${bestHourWindow.startHour >= 12 ? 'pm' : 'am'}-${bestHourWindow.endHour % 12 === 0 ? 12 : bestHourWindow.endHour % 12}${bestHourWindow.endHour >= 12 ? 'pm' : 'am'}`,
          explanation: focusRecommendation.explanation,
        }
      : null,
    recommendations: {
      deep_work: focusRecommendation,
      admin: adminRecommendation,
      low_energy: lowEnergyRecommendation,
    },
    weakWindow: weakFocusBand
      ? {
          bandId: weakFocusBand.bandId,
          label: weakFocusBand.label,
          explanation: describeWeakWindow(weakFocusBand),
        }
      : null,
    overloadWeekday: overloadWeekday && overloadWeekday.pressureScore >= 2
      ? {
          dayIndex: overloadWeekday.dayIndex,
          label: overloadWeekday.label,
          explanation: `${overloadWeekday.label}s tend to overload more easily for you.`,
        }
      : null,
    stats: {
      byHour: hourMap,
      focusBands: focusBandList,
      weekdayPressure,
    },
  };
}

export function getRecommendationForTaskType(profile, taskType = 'deep_work') {
  return profile?.recommendations?.[taskType] ?? null;
}

export function getTimingFitScore(profile, taskType = 'deep_work', hour = null) {
  const recommendation = getRecommendationForTaskType(profile, taskType);
  const targetBand = TIME_BANDS.find((band) => band.id === recommendation?.bandId);
  const numericHour = Number.isFinite(Number(hour)) ? Number(hour) : null;
  if (!targetBand || numericHour == null) return 0;
  if (numericHour >= targetBand.start && numericHour < targetBand.end) return 3;
  if (Math.abs(numericHour - targetBand.start) <= 1 || Math.abs(numericHour - targetBand.end) <= 1) return 1;
  const weakBand = TIME_BANDS.find((band) => band.id === profile?.weakWindow?.bandId);
  if (weakBand && numericHour >= weakBand.start && numericHour < weakBand.end && taskType === 'deep_work') return -2;
  return 0;
}
