/**
 * Planner presets: employee, freelancer, habit_focused, mixed.
 * One shared planner; preset drives defaults, visible fields, and emphasis.
 * Active preset: userSettings.plannerPreset (explicit) or derived from onboardingRole/onboardingUseCase.
 *
 * ## Preset rules (emphasis)
 * - **Freelancer**: Active projects, client field, billable vs non-billable, hours planned/completed
 *   this week, waiting on client, "what to work on today". Planner tab: week view, projects expanded.
 * - **Employee**: Today's priorities, due dates, deep work vs meetings, blocked work, weekly plan.
 *   Portfolio hours and needs attention shown; no client/billable in cards. Default filter: This week.
 * - **Habit-focused**: Routines, consistency, lightweight daily check-in, focus and recovery. Project
 *   cockpit minimal (no today strip, no portfolio summary/hours, no needs attention, no week capacity).
 *   Planner tab: day view, routines expanded, secondary details hidden by default.
 * - **Mixed**: Balance of projects, planning, and routines. All project cockpit sections and card
 *   fields visible; planner tab week view with projects and routines expanded.
 *
 * ## Project planner fields shown/hidden by default (per preset)
 * | Field/Section           | Freelancer | Employee | Habit-focused | Mixed |
 * |-------------------------|------------|----------|----------------|-------|
 * | Today needs this        | ✓ emph    | ✓ emph   | hidden         | ✓ emph |
 * | Portfolio summary tiles | ✓         | ✓        | hidden         | ✓     |
 * | Planned/Completed/Billable tiles | ✓ | ✓       | hidden         | ✓     |
 * | Client in cards         | ✓         | hidden   | hidden         | ✓     |
 * | Billable in cards       | ✓         | hidden   | hidden         | ✓     |
 * | Hours planned/completed in cards| ✓ | ✓       | hidden         | ✓     |
 * | Waiting on client badge | ✓         | hidden   | hidden         | ✓     |
 * | Needs attention         | ✓         | ✓        | hidden         | ✓     |
 * | Week capacity           | ✓         | ✓        | hidden         | ✓     |
 * | Billable row in capacity| ✓         | hidden   | —              | ✓     |
 * | Create form: Client     | ✓         | hidden   | hidden         | ✓     |
 * | Create form: Billable   | ✓         | hidden   | hidden         | ✓     |
 * | Filter chips: Billable/Waiting | ✓ | hidden | hidden         | ✓     |
 * | Default project filter  | all       | this_week| all            | all   |
 *
 * ## Planner tab defaults (GardenDashboard)
 * | Setting           | Freelancer | Employee | Habit-focused | Mixed |
 * |-------------------|------------|----------|----------------|-------|
 * | defaultView       | week       | week     | day            | week  |
 * | showSecondaryDefault | true  | true     | false          | true  |
 * | expandProjectsDefault | true | false    | false          | true  |
 * | expandRoutinesDefault | false | false   | true           | true  |
 *
 * ## How users switch presets
 * Settings → Personalization → "Planner preset" dropdown. Choose "Auto (from role & use case)"
 * to derive from onboarding, or pick Employee / Freelancer / Habit-focused / Mixed explicitly.
 * Save preferences. Planner tab defaults apply on next app load (or refresh).
 */

export const PLANNER_PRESET_IDS = {
  EMPLOYEE: 'employee',
  FREELANCER: 'freelancer',
  HABIT_FOCUSED: 'habit_focused',
  MIXED: 'mixed',
};

export const PLANNER_PRESET_OPTIONS = [
  { id: PLANNER_PRESET_IDS.EMPLOYEE, label: 'Employee', description: 'Today’s priorities, due dates, deep work vs meetings, weekly plan.' },
  { id: PLANNER_PRESET_IDS.FREELANCER, label: 'Freelancer', description: 'Active projects, client & billable, hours planned/done, what to work on today.' },
  { id: PLANNER_PRESET_IDS.HABIT_FOCUSED, label: 'Habit-focused', description: 'Routines, consistency, lightweight check-in, focus and recovery.' },
  { id: PLANNER_PRESET_IDS.MIXED, label: 'Mixed / multi-project', description: 'Balance of projects, planning, and routines.' },
];

/**
 * Preset config: project planner (cockpit) and planner tab behavior.
 * show* = include section/field; emphasize* = give it visual priority or default expanded.
 * Core cockpit (active projects, next action, health, deadline, what to work on today) is always shown.
 */
const PRESET_CONFIG = {
  [PLANNER_PRESET_IDS.FREELANCER]: {
    projectPlanner: {
      showTodayStrip: true,
      emphasizeTodayStrip: true,
      showPortfolioSummary: true,
      showPortfolioHours: true,
      showClientInCards: true,
      showBillableInCards: true,
      showHoursPlannedCompletedInCards: true,
      showWaitingOnClientInCards: true,
      showNeedsAttention: true,
      showWeekCapacity: true,
      showBlockedReasonInCards: false,
      defaultProjectFilter: null,
    },
    plannerTab: {
      defaultView: 'week',
      showSecondaryDefault: true,
      expandProjectsDefault: true,
      expandRoutinesDefault: false,
    },
    todayTab: {
      emphasizeCheckIn: false,
      emphasizeFocus: true,
    },
    /** Planning entry points: primary flow per persona; demote overlapping. */
    planningEntry: {
      showPlanAProjectInGoalCreator: true,
      primaryWeekPlanning: 'suggest',
    },
    /** Helper/empty-state copy tone: business = project/client-oriented; professional = direct; calm = gentle; default = balanced. */
    helperTone: 'business',
  },
  [PLANNER_PRESET_IDS.EMPLOYEE]: {
    projectPlanner: {
      showTodayStrip: true,
      emphasizeTodayStrip: true,
      showPortfolioSummary: true,
      showPortfolioHours: true,
      showClientInCards: false,
      showBillableInCards: false,
      showHoursPlannedCompletedInCards: true,
      showWaitingOnClientInCards: false,
      showNeedsAttention: true,
      showWeekCapacity: true,
      showBlockedReasonInCards: true,
      defaultProjectFilter: 'this_week',
    },
    plannerTab: {
      defaultView: 'week',
      showSecondaryDefault: true,
      expandProjectsDefault: false,
      expandRoutinesDefault: false,
    },
    todayTab: {
      emphasizeCheckIn: true,
      emphasizeFocus: true,
    },
    planningEntry: {
      showPlanAProjectInGoalCreator: true,
      primaryWeekPlanning: 'suggest',
    },
    helperTone: 'professional',
  },
  [PLANNER_PRESET_IDS.HABIT_FOCUSED]: {
    projectPlanner: {
      showTodayStrip: true,
      emphasizeTodayStrip: false,
      showPortfolioSummary: false,
      showPortfolioHours: false,
      showClientInCards: false,
      showBillableInCards: false,
      showHoursPlannedCompletedInCards: false,
      showWaitingOnClientInCards: false,
      showNeedsAttention: false,
      showWeekCapacity: false,
      showBlockedReasonInCards: false,
      defaultProjectFilter: null,
    },
    plannerTab: {
      defaultView: 'day',
      showSecondaryDefault: false,
      expandProjectsDefault: false,
      expandRoutinesDefault: true,
    },
    todayTab: {
      emphasizeCheckIn: true,
      emphasizeFocus: true,
    },
    planningEntry: {
      showPlanAProjectInGoalCreator: false,
      primaryWeekPlanning: 'suggest',
    },
    helperTone: 'calm',
  },
  [PLANNER_PRESET_IDS.MIXED]: {
    projectPlanner: {
      showTodayStrip: true,
      emphasizeTodayStrip: true,
      showPortfolioSummary: true,
      showPortfolioHours: true,
      showClientInCards: true,
      showBillableInCards: true,
      showHoursPlannedCompletedInCards: true,
      showWaitingOnClientInCards: true,
      showNeedsAttention: true,
      showWeekCapacity: true,
      showBlockedReasonInCards: false,
      defaultProjectFilter: null,
    },
    plannerTab: {
      defaultView: 'week',
      showSecondaryDefault: true,
      expandProjectsDefault: true,
      expandRoutinesDefault: true,
    },
    todayTab: {
      emphasizeCheckIn: true,
      emphasizeFocus: true,
    },
    planningEntry: {
      showPlanAProjectInGoalCreator: true,
      primaryWeekPlanning: 'suggest',
    },
    helperTone: 'default',
  },
};

const DEFAULT_PRESET_CONFIG = PRESET_CONFIG[PLANNER_PRESET_IDS.MIXED];

/**
 * Resolve active planner preset: explicit userSettings.plannerPreset or derived from onboarding.
 * Use onboarding to set smart defaults, not hard restrictions.
 */
export function getPlannerPreset(userSettings) {
  const explicit = userSettings?.plannerPreset;
  if (explicit && PRESET_CONFIG[explicit]) return explicit;
  const role = userSettings?.onboardingRole;
  const useCase = userSettings?.onboardingUseCase;
  if (role === 'freelancer' || useCase === 'freelance') return PLANNER_PRESET_IDS.FREELANCER;
  if (role === 'employee' || useCase === 'work_projects') return PLANNER_PRESET_IDS.EMPLOYEE;
  if (useCase === 'habits') return PLANNER_PRESET_IDS.HABIT_FOCUSED;
  if (role === 'creative' || useCase === 'mix' || useCase === 'personal' || role === 'student' || role === 'other') return PLANNER_PRESET_IDS.MIXED;
  return PLANNER_PRESET_IDS.MIXED;
}

/**
 * Get config for a preset (for project planner, planner tab, today tab).
 */
export function getPresetConfig(presetId) {
  return PRESET_CONFIG[presetId] ?? DEFAULT_PRESET_CONFIG;
}

/**
 * Get project planner config for the current preset.
 */
export function getProjectPlannerPresetConfig(userSettings) {
  const preset = getPlannerPreset(userSettings ?? {});
  const config = getPresetConfig(preset);
  return config.projectPlanner ?? DEFAULT_PRESET_CONFIG.projectPlanner;
}

/**
 * Get planner tab config for the current preset.
 */
export function getPlannerTabPresetConfig(userSettings) {
  const preset = getPlannerPreset(userSettings ?? {});
  const config = getPresetConfig(preset);
  return config.plannerTab ?? DEFAULT_PRESET_CONFIG.plannerTab;
}

const DEFAULT_PLANNING_ENTRY = {
  showPlanAProjectInGoalCreator: true,
  primaryWeekPlanning: 'suggest',
};

/**
 * Get planning entry point config for the current preset (what to show/demote in GoalCreator, week planning).
 */
export function getPlanningEntryConfig(userSettings) {
  const preset = getPlannerPreset(userSettings ?? {});
  const config = getPresetConfig(preset);
  return config.planningEntry ?? DEFAULT_PLANNING_ENTRY;
}

/** Helper copy tone for empty states, spirit, and labels: business | professional | calm | default. */
export function getHelperTone(userSettings) {
  const preset = getPlannerPreset(userSettings ?? {});
  const config = getPresetConfig(preset);
  return config.helperTone ?? 'default';
}

/** Persona-based first-run confirmation line (one short sentence). */
export function getPersonaWelcomeLine(presetId) {
  const lines = {
    [PLANNER_PRESET_IDS.FREELANCER]: "We'll help you stay on top of client work, capacity, and next steps.",
    [PLANNER_PRESET_IDS.EMPLOYEE]: "We'll help you keep priorities, deadlines, and focus time clear.",
    [PLANNER_PRESET_IDS.HABIT_FOCUSED]: "We'll keep things light and consistent, with projects available when you need them.",
    [PLANNER_PRESET_IDS.MIXED]: "We'll balance projects, planning, focus, and routines.",
  };
  return lines[presetId] ?? lines[PLANNER_PRESET_IDS.MIXED];
}
