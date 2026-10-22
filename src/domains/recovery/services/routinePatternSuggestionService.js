import { MAINTENANCE_BLOCK_TEMPLATES } from './maintenanceBlockService';
import { getRecentStatusCounts } from './antiShameRecurrenceService';

function hasMaintenanceTemplate(maintenanceBlocks = [], templateId) {
  return (maintenanceBlocks ?? []).some((item) => item?.templateId === templateId);
}

function daysSince(dateStrOrIso) {
  if (!dateStrOrIso) return null;
  const d = new Date(String(dateStrOrIso).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Build restrained, explainable routine suggestions from repeated friction.
 * Returns max 2 suggestions by priority.
 */
export function buildRoutinePatternSuggestions({
  socialFollowUps = [],
  compost = [],
  maintenanceBlocks = [],
  needsRescheduling = [],
  stagingTaskStatus = {},
  weekAssignments = {},
  lastSundayRitualDate = null,
  routines = [],
  recurringSupportState = {},
} = {}) {
  const suggestions = [];
  const pendingSocial = (socialFollowUps ?? []).filter((item) => item?.status !== 'done');
  const activeBacklogCount = Object.values(stagingTaskStatus ?? {}).filter((v) => v === 'active').length;
  const postponedCount = Array.isArray(needsRescheduling) ? needsRescheduling.length : 0;
  const unscheduledCaptureCount = Array.isArray(compost) ? compost.length : 0;
  const plannedDayCountThisWeek = Object.values(weekAssignments ?? {}).filter((dayPlan) => dayPlan && Object.keys(dayPlan).length > 0).length;
  const sundayGapDays = daysSince(lastSundayRitualDate);

  const add = (id, title, body, actionLabel, actionPayload, priority = 0) => {
    if (suggestions.some((s) => s.id === id)) return;
    suggestions.push({ id, title, body, actionLabel, actionPayload, priority });
  };

  if (pendingSocial.length >= 3 && !hasMaintenanceTemplate(maintenanceBlocks, 'social_catchup')) {
    add(
      'social-catchup-block',
      'Batch social replies',
      'You have a few pending social follow-ups. A short catch-up block can make replies easier.',
      'Add social catch-up block',
      { type: 'maintenance_template', templateId: 'social_catchup' },
      90
    );
  }

  if (unscheduledCaptureCount >= 8 && !hasMaintenanceTemplate(maintenanceBlocks, 'inbox_cleanup')) {
    add(
      'inbox-triage-routine',
      'Protect inbox triage time',
      'A lot of captures are staying unscheduled. A small inbox reset block can lower planning load.',
      'Add inbox cleanup block',
      { type: 'maintenance_template', templateId: 'inbox_cleanup' },
      85
    );
  }

  if ((postponedCount >= 4 || activeBacklogCount >= 8) && !hasMaintenanceTemplate(maintenanceBlocks, 'life_admin')) {
    add(
      'life-admin-block',
      'Contain life admin in one block',
      'Life-admin items are being pushed around. A weekly logistics block can reduce repeated context switching.',
      'Add life admin block',
      { type: 'maintenance_template', templateId: 'life_admin' },
      80
    );
  }

  if ((sundayGapDays == null || sundayGapDays > 14 || plannedDayCountThisWeek <= 1) && !hasMaintenanceTemplate(maintenanceBlocks, 'weekly_planning_reset')) {
    add(
      'weekly-planning-reset',
      'Protect a planning reset',
      'Planning looks inconsistent lately. A recurring weekly planning reset can keep the week clear.',
      'Add weekly planning reset',
      { type: 'maintenance_template', templateId: 'weekly_planning_reset' },
      75
    );
  }

  if (postponedCount >= 3) {
    add(
      'shorter-routine-variant',
      'Try a shorter routine format',
      'Some items keep getting postponed. A shorter 25-minute upkeep block may be easier to start.',
      'Add 25-minute upkeep block',
      {
        type: 'custom_block',
        block: {
          title: 'Upkeep sprint',
          category: 'Upkeep',
          durationMinutes: 25,
          preferredDays: [2, 4],
          preferredTimeBand: 'late_afternoon',
          flexibility: 'flexible',
          importance: 'medium',
        },
      },
      70
    );
  }

  const ambitiousRoutine = (Array.isArray(routines) ? routines : []).find((routine) => {
    const duration = Number(routine?.duration) || 0;
    const counts = getRecentStatusCounts(recurringSupportState, { itemType: 'routine', itemId: routine?.id, lookbackDays: 14 });
    return duration >= 35 && (counts.skipped + counts.deferred) >= 3 && !routine?.pausedUntil;
  });
  if (ambitiousRoutine) {
    add(
      'soften-ambitious-routine',
      'Soften one routine for now',
      `"${ambitiousRoutine.title}" looks hard to keep right now. You can reduce frequency or pause it briefly.`,
      'Make this routine smaller',
      { type: 'soften_routine', routineId: ambitiousRoutine.id },
      78
    );
    add(
      'pause-ambitious-routine',
      'Pause this routine for a week',
      `You can pause "${ambitiousRoutine.title}" temporarily and resume gently later.`,
      'Pause for one week',
      { type: 'pause_routine', routineId: ambitiousRoutine.id, days: 7 },
      74
    );
  }

  return suggestions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2);
}

