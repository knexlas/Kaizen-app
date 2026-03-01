/**
 * Domain-aware goal support: suggests optional habits, tasks, review blocks, and reminders
 * based on the goal's domain. Rule-based and expandable; no external APIs required for v1.
 *
 * Goal model extension (optional, backward compatible):
 * - goal.supportDomain: one of GOAL_SUPPORT_DOMAIN_IDS (fitness, finance, creative, learning, home, relationships)
 * - goal.linkedToGoalId: id of parent goal when this goal was created from a support suggestion
 */

/** Valid values for goal.supportDomain (optional on goals). */
export const GOAL_SUPPORT_DOMAIN_IDS = ['fitness', 'finance', 'creative', 'learning', 'home', 'relationships'];

/** Support domains aligned with goal domains + life areas. */
export const SUPPORT_DOMAINS = [
  { id: 'finance', label: 'Finance & trading', emoji: '📈', keywords: ['trade', 'trading', 'stock', 'market', 'portfolio', 'invest', 'earnings', 'dividend', 'cpi', 'fed', 'macro'] },
  { id: 'fitness', label: 'Health & fitness', emoji: '🌿', keywords: ['workout', 'gym', 'run', 'exercise', 'fitness', 'yoga', 'strength', 'cardio', 'train', 'health'] },
  { id: 'creative', label: 'Creative', emoji: '✨', keywords: ['paint', 'draw', 'write', 'music', 'art', 'craft', 'design', 'creative', 'practice', 'sketch'] },
  { id: 'learning', label: 'Learning', emoji: '📚', keywords: ['learn', 'study', 'course', 'read', 'language', 'certification'] },
  { id: 'home', label: 'Home & life admin', emoji: '🏠', keywords: ['admin', 'household', 'tidy', 'bills', 'life admin'] },
  { id: 'relationships', label: 'Relationships', emoji: '💬', keywords: ['family', 'friend', 'relationship', 'connect', 'call'] },
];

/**
 * Suggestion template shape: id, domain, title, description, type (task|habit|review_block|reminder),
 * optional suggestedSchedule, optional parent-goal link at creation time.
 */
function normalizeTemplate(entry, domainId) {
  return {
    id: entry.id,
    domain: domainId,
    title: entry.title ?? entry.label,
    description: entry.description ?? '',
    type: entry.type ?? 'habit',
    estimatedMinutes: entry.estimatedMinutes ?? 15,
    label: entry.label ?? entry.title,
    ...(entry.suggestedSchedule && { suggestedSchedule: entry.suggestedSchedule }),
  };
}

const SUGGESTION_PACKS = {
  finance: [
    { id: 'macro-review', label: 'Weekly macro / economic check', description: 'A short block to review earnings dates, CPI, or Fed events.', type: 'review_block', title: 'Weekly market dates check', estimatedMinutes: 15, suggestedSchedule: { dayOfWeek: 0, hour: 10, durationMinutes: 15 } },
    { id: 'portfolio-review', label: 'Portfolio review block', description: 'A recurring slot for a quick portfolio or watchlist review.', type: 'task', title: 'Portfolio review', estimatedMinutes: 20 },
    { id: 'prep-trading-day', label: 'Light prep before trading', description: 'A small prep step (e.g. review plan, set alerts) to start the day.', type: 'habit', title: 'Trading day prep', estimatedMinutes: 10 },
  ],
  fitness: [
    { id: 'hydration', label: 'Hydration reminder', description: 'A simple habit to support recovery and energy.', type: 'reminder', title: 'Hydrate (water check)', estimatedMinutes: 1 },
    { id: 'stretch-recovery', label: 'Stretch or recovery', description: 'A short stretch or cooldown to pair with your main practice.', type: 'habit', title: 'Stretch / recovery', estimatedMinutes: 10 },
    { id: 'meal-prep', label: 'Light meal prep', description: 'One small meal-prep or healthy-eating step that often helps consistency.', type: 'habit', title: 'Quick meal prep', estimatedMinutes: 15 },
  ],
  creative: [
    { id: 'inspiration-time', label: 'Inspiration time', description: 'A short block to collect references or get inspired.', type: 'habit', title: 'Inspiration / reference time', estimatedMinutes: 15 },
    { id: 'practice-block', label: 'Practice block', description: 'A recurring short practice to build the habit.', type: 'habit', title: 'Daily practice', estimatedMinutes: 15 },
    { id: 'setup-ritual', label: 'Setup ritual', description: 'A tiny setup step so starting feels easier.', type: 'habit', title: 'Creative setup', estimatedMinutes: 5 },
  ],
  learning: [
    { id: 'review-notes', label: 'Review notes', description: 'A short slot to review what you learned.', type: 'habit', title: 'Review notes', estimatedMinutes: 10 },
    { id: 'practice-session', label: 'Practice session', description: 'A small practice to reinforce learning.', type: 'habit', title: 'Practice', estimatedMinutes: 15 },
  ],
  home: [
    { id: 'quick-tidy', label: 'Quick tidy', description: 'A 5-minute tidy to keep things manageable.', type: 'habit', title: 'Quick tidy', estimatedMinutes: 5 },
    { id: 'admin-block', label: 'Admin block', description: 'A short recurring block for bills or life admin.', type: 'habit', title: 'Life admin', estimatedMinutes: 15 },
  ],
  relationships: [
    { id: 'check-in', label: 'Check-in', description: 'A reminder to reach out to someone.', type: 'reminder', title: 'Reach out', estimatedMinutes: 5 },
  ],
};

/** Weekly planning prompt per domain: shown in Planner or Sunday ritual. Gentle, optional tone. */
const WEEKLY_PROMPTS = {
  finance: {
    title: 'Finance & trading',
    description: 'Would you like one helpful extra this week? A short block for market dates or portfolio review often helps — completely optional.',
    cta: 'Add',
    suggestionId: 'macro-review',
  },
  fitness: {
    title: 'Health & fitness',
    description: 'One small support habit can pair well with your main practice — e.g. stretch, hydration, or meal prep. Your choice.',
    cta: 'Add',
    suggestionId: 'stretch-recovery',
  },
  creative: {
    title: 'Creative',
    description: 'A little inspiration time or a short practice block can keep the thread going. Would you like to add one?',
    cta: 'Add',
    suggestionId: 'inspiration-time',
  },
  learning: {
    title: 'Learning',
    description: 'A short review or practice block can reinforce what you\'re learning. Optional — add if it feels right.',
    cta: 'Add',
    suggestionId: 'review-notes',
  },
  home: {
    title: 'Home & life admin',
    description: 'A quick tidy or admin block can keep things from piling up. Add one if it would help.',
    cta: 'Add',
    suggestionId: 'quick-tidy',
  },
  relationships: {
    title: 'Relationships',
    description: 'A small reminder to reach out can make a big difference. Would you like to add one?',
    cta: 'Add',
    suggestionId: 'check-in',
  },
};

/**
 * Infer support domain from goal title, optional category, and optional explicit domain.
 * Order: explicit support domain > keyword match on title/category > GoalCreator domain mapping > null.
 * @param {string} [title]
 * @param {string} [explicitDomain] - goal.domain from GoalCreator (body, mind, spirit, finance) or goal.supportDomain
 * @param {string} [category] - goal.category for keyword matching
 * @returns {string | null} support domain id or null
 */
export function inferSupportDomain(title = '', explicitDomain = '', category = '') {
  const t = (title || '').toLowerCase().trim();
  const c = (category || '').toLowerCase().trim();
  const e = (explicitDomain || '').toLowerCase().trim();
  if (GOAL_SUPPORT_DOMAIN_IDS.includes(e)) return e;
  if (e === 'finance') return 'finance';
  if (e === 'body') return 'fitness';
  const text = `${t} ${c}`;
  for (const domain of SUPPORT_DOMAINS) {
    if (domain.keywords.some((kw) => text.includes(kw))) return domain.id;
  }
  if (e === 'mind') return 'learning';
  if (e === 'spirit') return 'creative';
  return null;
}

/**
 * Get the support domain for a goal. Prefer explicit saved domain, then keyword match, then null.
 * @param {object} goal - { supportDomain?, domain?, title?, category? }
 * @returns {string | null}
 */
export function getGoalSupportDomain(goal) {
  if (!goal) return null;
  if (goal.supportDomain && GOAL_SUPPORT_DOMAIN_IDS.includes(goal.supportDomain)) return goal.supportDomain;
  return inferSupportDomain(goal.title ?? '', goal.domain ?? '', goal.category ?? '');
}

/**
 * Get 2–3 optional support suggestions for a domain (normalized template shape).
 * @param {string} domainId
 * @param {number} [limit=3]
 * @returns {Array<{ id, domain, title, description, type, estimatedMinutes, label?, suggestedSchedule? }>}
 */
export function getSupportSuggestions(domainId, limit = 3) {
  const pack = domainId ? SUGGESTION_PACKS[domainId] : null;
  if (!pack || !Array.isArray(pack)) return [];
  return pack.slice(0, limit).map((entry) => normalizeTemplate(entry, domainId));
}

/**
 * Resolve 2–3 support suggestions for a goal (goal → domain → suggestions). Deterministic, rule-based.
 * @param {object} goal
 * @param {number} [limit=3]
 * @returns {Array<{ id, domain, title, description, type, estimatedMinutes, label?, suggestedSchedule? }>}
 */
export function resolveSupportSuggestions(goal, limit = 3) {
  const domainId = getGoalSupportDomain(goal);
  return getSupportSuggestions(domainId, limit);
}

/**
 * Get weekly planning prompt for a domain (for Planner / Sunday ritual).
 * @param {string} domainId
 * @returns {{ title, description, cta, suggestionId } | null}
 */
export function getWeeklyPrompt(domainId) {
  return domainId ? WEEKLY_PROMPTS[domainId] ?? null : null;
}

/**
 * Get the suggestion template by domain and suggestion id (normalized shape).
 * @param {string} domainId
 * @param {string} suggestionId
 * @returns {object | null}
 */
export function getSuggestionTemplate(domainId, suggestionId) {
  const pack = domainId ? SUGGESTION_PACKS[domainId] : null;
  if (!pack) return null;
  const entry = pack.find((s) => s.id === suggestionId);
  return entry ? normalizeTemplate(entry, domainId) : null;
}

/**
 * Create an app object from an accepted support suggestion. Use for task, habit, reminder (goal) or review_block (weekly event).
 * Preserves optional parent-goal link (linkedToGoalId / parentGoalId on goal; linkedToGoalId on event for future use).
 * @param {object} template - normalized suggestion template (from getSuggestionTemplate or resolveSupportSuggestions)
 * @param {string | null} [parentGoalId]
 * @returns {{ kind: 'goal', goal: object } | { kind: 'weekly_event', event: object } | null}
 */
export function createFromSupportSuggestion(template, parentGoalId = null) {
  if (!template) return null;
  const id = crypto.randomUUID?.() ?? `goal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const mins = Math.max(1, Math.min(120, template.estimatedMinutes ?? 15));
  const now = new Date().toISOString();
  const linkMeta = parentGoalId ? { linkedToGoalId: parentGoalId } : {};

  switch (template.type) {
    case 'task': {
      return {
        kind: 'goal',
        goal: {
          id,
          type: 'kaizen',
          title: template.title,
          estimatedMinutes: mins,
          totalMinutes: 0,
          createdAt: now,
          ...linkMeta,
          subtasks: [{ id: `${id}-st`, title: template.title, estimatedHours: mins / 60, completedHours: 0, deadline: null, color: null, phaseId: null, weekRange: null }],
          milestones: [],
          rituals: [],
        },
      };
    }
    case 'habit':
    case 'reminder': {
      const ritualId = crypto.randomUUID?.() ?? `r-${Date.now()}`;
      return {
        kind: 'goal',
        goal: {
          id,
          type: 'routine',
          title: template.title,
          estimatedMinutes: mins,
          totalMinutes: 0,
          createdAt: now,
          ...linkMeta,
          rituals: [{ id: ritualId, title: template.title, days: [1, 2, 3, 4, 5], frequency: 'weekly', monthDay: null }],
          category: 'Support',
        },
      };
    }
    case 'review_block': {
      const schedule = template.suggestedSchedule ?? { dayOfWeek: 0, hour: 10, durationMinutes: mins };
      const eventId = crypto.randomUUID?.() ?? `ev-${Date.now()}`;
      const start = getNextWeekdayAtHour(schedule.dayOfWeek, schedule.hour);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + (schedule.durationMinutes ?? mins));
      const event = {
        id: eventId,
        start: start.toISOString(),
        end: end.toISOString(),
        title: template.title,
        ...(parentGoalId && { linkedToGoalId: parentGoalId }),
      };
      return { kind: 'weekly_event', event };
    }
    default:
      return {
        kind: 'goal',
        goal: {
          id,
          type: 'routine',
          title: template.title,
          estimatedMinutes: mins,
          totalMinutes: 0,
          createdAt: now,
          ...linkMeta,
          rituals: [],
        },
      };
  }
}

/** Next occurrence of dayOfWeek (0=Sun..6=Sat) at hour (0-23). */
function getNextWeekdayAtHour(dayOfWeek, hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  let diff = (dayOfWeek - d.getDay() + 7) % 7;
  if (diff === 0 && d.getTime() <= Date.now()) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Build a goal payload from a suggestion template, optionally linked to a parent goal.
 * For habit/task/reminder returns the goal; for review_block returns null (use createFromSupportSuggestion for weekly_event).
 * @param {object} template - from getSuggestionTemplate
 * @param {string | null} [parentGoalId] - if provided, goal is linked to this parent
 * @returns {object | null} goal shape for addGoal, or null if template type is review_block
 */
export function buildSupportGoalFromTemplate(template, parentGoalId = null) {
  const result = createFromSupportSuggestion(template, parentGoalId);
  if (result?.kind === 'goal') return result.goal;
  return null;
}

/**
 * Get active support domains from a list of goals (for weekly planning card).
 * Returns at most one domain to avoid overwhelming; prefers first with suggestions.
 * @param {Array} goals
 * @returns {string | null} domain id to show a prompt for, or null
 */
export function getActiveSupportDomainForWeek(goals) {
  const list = Array.isArray(goals) ? goals : [];
  const domainCounts = {};
  for (const g of list) {
    const domain = getGoalSupportDomain(g);
    if (domain) domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  }
  const ordered = ['finance', 'fitness', 'creative', 'learning', 'home', 'relationships'];
  for (const id of ordered) {
    if (domainCounts[id] > 0 && getWeeklyPrompt(id)) return id;
  }
  return null;
}
