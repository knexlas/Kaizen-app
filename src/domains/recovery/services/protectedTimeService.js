function getGoalIdFromAssignment(a) {
  if (!a) return null;
  if (typeof a === 'string') return a;
  return a.goalId ?? a.parentGoalId ?? null;
}

export function getProtectionStrengthFromAssignment(assignment, goal = null) {
  const direct = assignment?.protectedTimeStrength ?? assignment?._protectedTimeStrength;
  if (['soft', 'normal', 'strong'].includes(direct)) return direct;
  const fromGoal = goal?._protectedTimeStrength;
  if (['soft', 'normal', 'strong'].includes(fromGoal)) return fromGoal;
  return null;
}

export function isProtectedAssignment(assignment, goal = null) {
  return Boolean(getProtectionStrengthFromAssignment(assignment, goal));
}

export function shouldDisplaceCandidateFirst({ assignment, goal }) {
  if (isProtectedAssignment(assignment, goal)) return false;
  return true;
}

export function getProtectedTimeSignals({ weekAssignments = {}, goals = [] } = {}) {
  const goalMap = new Map((goals || []).map((g) => [g.id, g]));
  let protectedCount = 0;
  let workCount = 0;
  Object.values(weekAssignments || {}).forEach((dayPlan) => {
    Object.entries(dayPlan || {}).forEach(([slot, raw]) => {
      const list = Array.isArray(raw) ? raw : [raw];
      list.forEach((a) => {
        const goal = goalMap.get(getGoalIdFromAssignment(a));
        if (isProtectedAssignment(a, goal)) protectedCount += 1;
        if ((a?.type === 'kaizen' || goal?.type === 'kaizen' || goal?.energyType === 'high-focus') && slot !== 'anytime') workCount += 1;
      });
    });
  });
  const creepRisk = protectedCount <= 1 && workCount >= 8;
  return {
    protectedCount,
    workCount,
    creepRisk,
    message: creepRisk
      ? 'Protected recovery/social time looks squeezed by work this week.'
      : protectedCount === 0
        ? 'No protected blocks found yet.'
        : 'Protected time is present.',
  };
}

