function dateKey(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

function parseHourKey(key) {
  if (typeof key !== 'string') return null;
  const [h, m] = key.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h + (m / 60);
}

function readTitleFromAssignment(value, goals = []) {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) return null;
  if (typeof first === 'string') {
    const goal = (goals ?? []).find((g) => g.id === first);
    return goal?.title ?? null;
  }
  if (typeof first === 'object') {
    if (typeof first.title === 'string' && first.title.trim()) return first.title.trim();
    const goalId = first.goalId ?? first.parentGoalId ?? null;
    if (goalId) {
      const goal = (goals ?? []).find((g) => g.id === goalId);
      return goal?.title ?? null;
    }
  }
  return null;
}

export function buildRestartResumeModel({
  today = '',
  assignments = {},
  logs = [],
  goals = [],
  compost = [],
  needsRescheduling = [],
  todayPrimaryTask = null,
  dailyEnergy = null,
  now = new Date(),
} = {}) {
  if (!today) return null;
  const todayLogs = (Array.isArray(logs) ? logs : []).filter((log) => dateKey(log?.date) === today);
  const hasWorkedToday = todayLogs.length > 0;
  const currentHour = now.getHours() + (now.getMinutes() / 60);
  const slotEntries = Object.entries(assignments ?? {}).filter(([slot]) => slot !== 'anytime');
  const pastPlanned = slotEntries.filter(([slot]) => {
    const h = parseHourKey(slot);
    return h != null && h < currentHour;
  });
  const futurePlanned = slotEntries.filter(([slot]) => {
    const h = parseHourKey(slot);
    return h != null && h >= currentHour;
  });

  const pastPlannedCount = pastPlanned.length;
  const futurePlannedCount = futurePlanned.length;
  const compostCount = Array.isArray(compost) ? compost.length : 0;
  const needsRescheduleCount = Array.isArray(needsRescheduling) ? needsRescheduling.length : 0;

  const drifted = !hasWorkedToday && pastPlannedCount >= 2;
  const overloaded = futurePlannedCount >= 5 || needsRescheduleCount >= 3;
  const lowEnergy = typeof dailyEnergy === 'number' && dailyEnergy <= 4;
  const captureOverflow = compostCount >= 6;
  const relevant = drifted || overloaded || lowEnergy || captureOverflow;
  if (!relevant) return null;

  const resumeTitle = todayPrimaryTask?.title
    ?? readTitleFromAssignment(futurePlanned[0]?.[1], goals)
    ?? readTitleFromAssignment(pastPlanned[pastPlanned.length - 1]?.[1], goals)
    ?? null;
  const recentIntent = todayLogs[todayLogs.length - 1]?.taskTitle
    ?? (Array.isArray(compost) && compost[0]?.text ? compost[0].text : null)
    ?? resumeTitle;

  const reasonParts = [];
  if (drifted) reasonParts.push('today drifted after interruptions');
  if (overloaded) reasonParts.push('the remaining plan is heavy');
  if (lowEnergy) reasonParts.push('energy is lower right now');
  if (captureOverflow) reasonParts.push('captures are piling up');

  return {
    relevant: true,
    reasonLine: reasonParts.length > 0
      ? `Restart support: ${reasonParts.join(', ')}.`
      : 'Restart support is ready.',
    headline: resumeTitle ? `Resume from ${resumeTitle}` : 'Resume from where you left off',
    tinyStepLabel: resumeTitle ? `Start 5 minutes on ${resumeTitle}` : 'Start for 5 minutes',
    contextLine: recentIntent ? `Recent intent: ${recentIntent}` : null,
    stats: {
      pastPlannedCount,
      futurePlannedCount,
      compostCount,
      needsRescheduleCount,
    },
  };
}

