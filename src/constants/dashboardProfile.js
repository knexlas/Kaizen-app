/**
 * Dashboard (home / Today tab) adapts to user's role and use case via stored onboarding preferences.
 * Shared structure; section order and visibility vary by profile. Reuses getPlannerPreset for profile.
 */

import { getPlannerPreset, PLANNER_PRESET_IDS } from './plannerPresets';

/** Dashboard profile = planner preset (freelancer, employee, habit_focused, mixed). */
export function getDashboardProfile(userSettings) {
  return getPlannerPreset(userSettings ?? {});
}

/**
 * Ordered section ids for the Today tab left column (and full-width check-in when applicable).
 * Profile-specific priority; sections not in the list are hidden for that profile.
 */
const SECTION_ORDER_BY_PROFILE = {
  [PLANNER_PRESET_IDS.FREELANCER]: [
    'what_to_work_on_today',
    'projects_strip',
    'week_capacity',
    'billable_strip',
    'needs_attention',
    'briefing',
    'continuity_summary',
    'your_day',
  ],
  [PLANNER_PRESET_IDS.EMPLOYEE]: [
    'todays_priorities',
    'calendar_deadlines',
    'blocked_work',
    'deep_work_suggestion',
    'weekly_plan_link',
    'briefing',
    'continuity_summary',
    'your_day',
  ],
  [PLANNER_PRESET_IDS.HABIT_FOCUSED]: [
    'check_in_prompt',
    'routines_today',
    'focus_suggestion',
    'recovery',
    'projects_if_relevant',
    'briefing',
    'continuity_summary',
    'your_day',
  ],
  [PLANNER_PRESET_IDS.MIXED]: [
    'what_to_do_now',
    'projects_strip',
    'week_capacity',
    'routines_today',
    'needs_attention',
    'briefing',
    'continuity_summary',
    'your_day',
  ],
};

const DEFAULT_ORDER = SECTION_ORDER_BY_PROFILE[PLANNER_PRESET_IDS.MIXED];

export function getDashboardSectionOrder(profile) {
  return SECTION_ORDER_BY_PROFILE[profile] ?? DEFAULT_ORDER;
}

/**
 * Which dashboard sections support each onboarding priority. Used to reorder/emphasize by user priorities.
 */
const PRIORITY_TO_SECTIONS = {
  plan_week: ['week_capacity', 'weekly_plan_link'],
  break_projects: ['projects_strip', 'needs_attention', 'what_to_work_on_today'],
  stay_focused: ['focus_suggestion', 'what_to_work_on_today', 'todays_priorities', 'what_to_do_now'],
  build_habits: ['routines_today', 'check_in_prompt'],
  calendar_deadlines: ['calendar_deadlines'],
  recover: ['recovery'],
};

/**
 * Section order with onboarding priorities applied: sections that match the user's priorities
 * are moved earlier in the list (within the profile's base order). Explainable and lightweight.
 */
export function getDashboardSectionOrderWithPriorities(profile, priorities = []) {
  const base = getDashboardSectionOrder(profile);
  if (!Array.isArray(priorities) || priorities.length === 0) return base;
  const baseSet = new Set(base);
  const prioritySections = new Set();
  for (const p of priorities) {
    const sections = PRIORITY_TO_SECTIONS[p];
    if (sections) for (const s of sections) if (baseSet.has(s)) prioritySections.add(s);
  }
  if (prioritySections.size === 0) return base;
  const ordered = base.filter((id) => id !== 'your_day');
  const boosted = ordered.filter((id) => prioritySections.has(id));
  const rest = ordered.filter((id) => !prioritySections.has(id));
  const reordered = [...boosted, ...rest];
  if (base.includes('your_day')) reordered.push('your_day');
  return reordered;
}

/** Section ids that match the user's priorities (for optional visual emphasis). */
export function getEmphasizedSectionIds(priorities = []) {
  const set = new Set();
  for (const p of priorities) {
    const sections = PRIORITY_TO_SECTIONS[p];
    if (sections) sections.forEach((s) => set.add(s));
  }
  return set;
}

/**
 * Which sections to show on the left column (primary). 'your_day' is always the right column (timeline).
 * Sections not in the order list are hidden. Some sections are only relevant for certain profiles.
 */
export function getDashboardSectionVisibility(profile, sectionId) {
  const order = getDashboardSectionOrder(profile);
  return order.includes(sectionId);
}

/**
 * Heading / label overrides per profile for the primary CTA block.
 */
export function getDashboardPrimaryHeading(profile) {
  const headings = {
    [PLANNER_PRESET_IDS.FREELANCER]: 'What to work on today',
    [PLANNER_PRESET_IDS.EMPLOYEE]: "Today's priorities",
    [PLANNER_PRESET_IDS.HABIT_FOCUSED]: 'Focus suggestion',
    [PLANNER_PRESET_IDS.MIXED]: 'What to do now',
  };
  return headings[profile] ?? headings[PLANNER_PRESET_IDS.MIXED];
}
