export function buildTodayAssistantActions({
  isOverloaded = false,
  todayPrimaryTask = null,
  needsAttention = null,
  compost = [],
  maintenanceSuggestion = null,
  socialBacklogCount = 0,
  routinePatternSuggestions = [],
  waitingCount = 0,
  lifeDomainCount = 0,
  protectedTimeRisk = false,
} = {}) {
  const actions = [];
  const seen = new Set();

  const addAction = (id, label, tone = null, payload = {}, description = '') => {
    if (seen.has(id)) return;
    seen.add(id);
    actions.push({ id, label, tone, payload, description });
  };

  addAction('LIGHTEN_TODAY', 'Lighten today', isOverloaded ? 'primary' : null, {}, 'Reduce overload and keep today realistic.');
  addAction('PROTECT_FOCUS_BLOCK', 'Protect focus block', !isOverloaded ? 'primary' : null, {}, 'Reserve a protected deep-work slot.');
  addAction('REBALANCE_WEEK', 'Rebalance this week', null, {}, 'Redistribute load across the week.');
  addAction('MOVE_LOW_ENERGY_LATER', 'Move low-energy tasks later', null, {}, 'Align task timing to available energy.');

  if (todayPrimaryTask?.goalId) {
    addAction('PULL_FORWARD_TASK', 'Pull one high-priority task forward', null, { goalId: todayPrimaryTask.goalId }, 'Bring priority work into an earlier slot.');
  }
  if ((needsAttention?.noNextStep?.length ?? 0) > 0) {
    addAction('BREAK_NEXT_3_STEPS', 'Break goal into next 3 steps', null, { goalId: needsAttention.noNextStep[0]?.goal?.id ?? null }, 'Create executable next actions now.');
  }
  if ((compost?.length ?? 0) > 0) {
    addAction('NOTE_TO_PLAN', 'Turn note into draft plan', null, { title: compost[0]?.text ?? '' }, 'Convert a note into a structured plan draft.');
  }
  if (maintenanceSuggestion?.templateId) {
    addAction(
      'ADD_MAINTENANCE_BLOCK',
      `Add ${maintenanceSuggestion.template.title}`,
      null,
      { templateId: maintenanceSuggestion.templateId },
      maintenanceSuggestion.reason ?? 'Add a recurring support block to reduce repeated friction.'
    );
  }
  if (socialBacklogCount >= 3) {
    addAction(
      'ADD_SOCIAL_CATCHUP_BLOCK',
      'Add social catch-up block',
      null,
      { templateId: 'social_catchup' },
      'You have a few pending social follow-ups. Batch them in one calm block.'
    );
  }
  if (waitingCount > 0) {
    addAction(
      'WAITING_REVIEW',
      'Review waiting-for items',
      null,
      {},
      'These are parked loops. Review follow-up timing without loading today.'
    );
  }
  if (lifeDomainCount > 0) {
    addAction(
      'REVIEW_LIFE_DOMAINS',
      'Review life domains',
      null,
      {},
      'Keep support systems healthy without flooding today with extra tasks.'
    );
  }
  if (protectedTimeRisk) {
    addAction(
      'DEFEND_PROTECTED_TIME',
      'Defend recovery/social time',
      'warn',
      {},
      'Keep recovery and relationship blocks. Move work/admin first.'
    );
  }
  if (Array.isArray(routinePatternSuggestions) && routinePatternSuggestions.length > 0) {
    const top = routinePatternSuggestions[0];
    addAction(
      'ADD_ROUTINE_STRUCTURE',
      top.actionLabel || 'Add support structure',
      null,
      { suggestion: top },
      top.body || 'Add a recurring block to reduce repeated friction.'
    );
  }
  if (isOverloaded) {
    addAction(
      'ENTER_LOW_FRICTION_MODE',
      'Turn on low-friction mode',
      null,
      {},
      'Reduce decisions and keep only one main task plus one support action.'
    );
  }
  if (isOverloaded) {
    addAction('MINIMUM_VIABLE_DAY', 'Offer minimum viable day', 'warn', { goalId: todayPrimaryTask?.goalId ?? null }, 'Keep one anchor task and defer the rest.');
  }
  if (todayPrimaryTask?.title) {
    addAction('MAKE_EXECUTABLE', 'Make task executable', null, { title: todayPrimaryTask.title, goalId: todayPrimaryTask.goalId ?? null }, 'Rewrite vague work into a clear action.');
    addAction('START_FOCUS_5', 'Start 5-min focus', null, {}, 'Start a small focus block immediately.');
  }

  return actions.slice(0, 8);
}
