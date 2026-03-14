/**
 * Onboarding preference options and keys. Stored in userSettings; used for defaults only.
 * Step 1: use case. Step 2: role. Step 3: priorities (up to 3) + style preference.
 */

export const ONBOARDING_USE_CASE_OPTIONS = [
  { id: 'work_projects', label: 'Work projects' },
  { id: 'freelance', label: 'Freelance/client work' },
  { id: 'personal', label: 'Personal organization' },
  { id: 'habits', label: 'Habits and routines' },
  { id: 'mix', label: 'A mix of these' },
];

export const ONBOARDING_ROLE_OPTIONS = [
  { id: 'employee', label: 'Employee' },
  { id: 'freelancer', label: 'Freelancer / self-employed' },
  { id: 'student', label: 'Student' },
  { id: 'creative', label: 'Multi-project creative / builder' },
  { id: 'other', label: 'Other' },
];

export const ONBOARDING_PRIORITY_OPTIONS = [
  { id: 'plan_week', label: 'Plan my week' },
  { id: 'break_projects', label: 'Break projects into steps' },
  { id: 'stay_focused', label: 'Stay focused' },
  { id: 'build_habits', label: 'Build habits' },
  { id: 'calendar_deadlines', label: 'Manage calendar and deadlines' },
  { id: 'recover', label: 'Recover when I fall behind' },
];

export const MAX_PRIORITIES = 3;

/** Style preference: app tone (minimal / balanced / playful). Stored as userSettings.gamificationIntensity. */
export const ONBOARDING_STYLE_OPTIONS = [
  { id: 'minimal', label: 'Minimal', description: 'Plain productivity UI, subtle feedback.' },
  { id: 'balanced', label: 'Balanced', description: 'Calm motivational elements (default).' },
  { id: 'playful', label: 'Playful', description: 'Stronger garden presence, more visible delight.' },
];
