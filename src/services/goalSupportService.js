/**
 * Domain-aware goal support: suggestion packs and weekly planning prompts.
 * Maps goal domains (body, finance, mind, spirit) to optional support habits and planning helpers.
 * Rule-based and easy to extend; no external APIs required for v1.
 */

/** Support suggestion: optional habit/task/reminder linked to a goal's domain. */
const SUPPORT_PACKS = {
  body: {
    label: 'Health & fitness',
    suggestions: [
      { id: 'body-hydration', label: 'Hydration reminder', description: 'A quick habit to support energy and recovery.', type: 'habit', defaultTitle: 'Drink water (before or after)', estimatedMinutes: 1 },
      { id: 'body-stretch', label: 'Light stretch', description: 'A short prep or cooldown that often helps.', type: 'habit', defaultTitle: '5-min stretch or warm-up', estimatedMinutes: 5 },
      { id: 'body-meal', label: 'Light meal prep', description: 'One small habit that supports consistency.', type: 'habit', defaultTitle: '5-min meal or snack prep', estimatedMinutes: 5 },
    ],
    weeklyPrompt: { title: 'Recovery & prep', description: 'Consider adding a short recovery or meal-prep block to support your fitness goals this week.', actionLabel: 'Add a support block', blockType: 'habit' },
  },
  finance: {
    label: 'Finance & trading',
    suggestions: [
      { id: 'finance-review', label: 'Weekly market review', description: 'A regular block to review macro and positions.', type: 'task', defaultTitle: 'Weekly portfolio / market review', estimatedMinutes: 30 },
      { id: 'finance-calendar', label: 'Earnings & events check', description: 'Stay on top of earnings dates, CPI, Fed, ex-dividend.', type: 'task', defaultTitle: 'Check earnings & economic calendar', estimatedMinutes: 15 },
      { id: 'finance-journal', label: 'Trade journal', description: 'A short habit to log or review trades.', type: 'habit', defaultTitle: 'Trade journal (5 min)', estimatedMinutes: 5 },
    ],
    weeklyPrompt: { title: 'Market week', description: 'Consider adding a block for earnings, CPI, Fed, or portfolio review so you don’t miss important dates.', actionLabel: 'Add a review block', blockType: 'task' },
  },
  mind: {
    label: 'Learning & focus',
    suggestions: [
      { id: 'mind-practice', label: 'Practice block', description: 'A short, regular practice session.', type: 'habit', defaultTitle: '10-min practice or review', estimatedMinutes: 10 },
      { id: 'mind-notes', label: 'Notes or recap', description: 'Capture what you learned or decided.', type: 'habit', defaultTitle: '5-min notes or recap', estimatedMinutes: 5 },
      { id: 'mind-deep', label: 'Deep work block', description: 'Protected time for focused learning.', type: 'task', defaultTitle: 'Deep work block', estimatedMinutes: 25 },
    ],
    weeklyPrompt: { title: 'Learning rhythm', description: 'A short practice or recap block each week can help lock in progress.', actionLabel: 'Add a practice block', blockType: 'habit' },
  },
  spirit: {
    label: 'Creative & wellbeing',
    suggestions: [
      { id: 'spirit-inspiration', label: 'Inspiration time', description: 'A small window for references or ideas.', type: 'habit', defaultTitle: '10-min inspiration or reference time', estimatedMinutes: 10 },
      { id: 'spirit-warmup', label: 'Warm-up or setup', description: 'A simple ritual before creative work.', type: 'habit', defaultTitle: 'Warm-up / setup ritual', estimatedMinutes: 5 },
      { id: 'spirit-rest', label: 'Rest or recovery', description: 'Support your energy with a rest habit.', type: 'habit', defaultTitle: 'Short rest or breath work', estimatedMinutes: 5 },
    ],
    weeklyPrompt: { title: 'Creative support', description: 'Inspiration time or a short warm-up block can make creative goals easier to start.', actionLabel: 'Add an inspiration block', blockType: 'habit' },
  },
};

const DEFAULT_PACK = {
  label: 'General',
  suggestions: [
    { id: 'default-prep', label: 'Light prep step', description: 'One small step that often helps.', type: 'habit', defaultTitle: '5-min prep or warm-up', estimatedMinutes: 5 },
    { id: 'default-review', label: 'Quick review', description: 'A short check-in to stay on track.', type: 'habit', defaultTitle: '5-min weekly review', estimatedMinutes: 5 },
  ],
  weeklyPrompt: null,
};

/**
 * Get 2–3 optional support suggestions for a goal domain.
 * @param {string} domainId - Goal domain: 'body' | 'finance' | 'mind' | 'spirit'
 * @returns {Array<{ id, label, description, type, defaultTitle, estimatedMinutes }>}
 */
export function getSupportSuggestionsForDomain(domainId) {
  const pack = (domainId && SUPPORT_PACKS[domainId]) ? SUPPORT_PACKS[domainId] : DEFAULT_PACK;
  const list = pack.suggestions || DEFAULT_PACK.suggestions;
  return list.slice(0, 3);
}

/**
 * Get the weekly planning prompt for a domain (for Sunday ritual / planner).
 * @param {string} domainId
 * @returns {{ title, description, actionLabel, blockType } | null}
 */
export function getWeeklyPlanningPromptForDomain(domainId) {
  const pack = (domainId && SUPPORT_PACKS[domainId]) ? SUPPORT_PACKS[domainId] : null;
  return pack?.weeklyPrompt ?? null;
}

/**
 * Get domain-aware weekly prompts for active goals (one per domain, deduplicated).
 * @param {Array} goals - Goals with .domain
 * @returns {Array<{ domainId, domainLabel, title, description, actionLabel, blockType }>}
 */
export function getWeeklyPlanningPromptsForGoals(goals) {
  const seen = new Set();
  const out = [];
  (goals ?? []).forEach((g) => {
    const id = g.domain || 'body';
    if (seen.has(id)) return;
    const prompt = getWeeklyPlanningPromptForDomain(id);
    if (!prompt) return;
    seen.add(id);
    const pack = SUPPORT_PACKS[id] || DEFAULT_PACK;
    out.push({
      domainId: id,
      domainLabel: pack.label,
      ...prompt,
    });
  });
  return out;
}

/**
 * Build a support goal (habit or task) linked to a parent goal.
 * @param {object} suggestion - From getSupportSuggestionsForDomain
 * @param {string} parentGoalId - Id of the goal this supports
 * @param {string} [parentGoalTitle] - For display/linking
 * @returns {object} Goal shape for addGoal
 */
export function buildSupportGoal(suggestion, parentGoalId, parentGoalTitle = '') {
  const id = crypto.randomUUID?.() ?? `goal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const title = suggestion.defaultTitle || suggestion.label;
  const mins = Math.max(1, Math.min(120, suggestion.estimatedMinutes || 5));

  if (suggestion.type === 'habit') {
    const ritualId = crypto.randomUUID?.() ?? `r-${Date.now()}`;
    return {
      id,
      type: 'routine',
      title,
      estimatedMinutes: mins,
      totalMinutes: 0,
      createdAt: new Date().toISOString(),
      parentGoalId,
      parentGoalTitle: parentGoalTitle || undefined,
      rituals: [{ id: ritualId, title, days: [1, 2, 3, 4, 5], frequency: 'weekly', monthDay: null }],
      category: 'Support',
      schedulerSettings: { mode: 'liquid', weeklyTarget: mins * 3 / 60, ritualName: title, preference: 'balanced' },
    };
  }

  return {
    id,
    type: 'kaizen',
    title,
    estimatedMinutes: mins,
    targetHours: mins / 60,
    totalMinutes: 0,
    createdAt: new Date().toISOString(),
    parentGoalId,
    parentGoalTitle: parentGoalTitle || undefined,
    subtasks: [{ id: crypto.randomUUID?.() ?? `v-${Date.now()}`, title, estimatedHours: mins / 60, completedHours: 0, deadline: null, color: null }],
    milestones: [],
    rituals: [],
  };
}
