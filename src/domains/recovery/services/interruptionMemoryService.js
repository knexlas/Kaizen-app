const STORAGE_KEY = 'kaizen:interruption-memory';

function safeNow() {
  return new Date().toISOString();
}

export function loadInterruptionMemory() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveInterruptionMemory(memory) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory ?? {}));
  } catch {
    // ignore persistence failure
  }
}

export function recordInterruptionSnapshot(memory, update) {
  const prev = memory && typeof memory === 'object' ? memory : {};
  return {
    ...prev,
    ...update,
    updatedAt: safeNow(),
  };
}

export function buildInterruptionResumeSummary(memory, goalTitleLookup = null) {
  const m = memory && typeof memory === 'object' ? memory : {};
  const goalTitle = typeof goalTitleLookup === 'function' && m.lastGoalId ? goalTitleLookup(m.lastGoalId) : null;
  const title = m.lastTaskTitle || goalTitle || 'your last task';
  if (m.lastFocusState === 'paused') {
    return `You paused while working on ${title}.`;
  }
  if (m.lastFocusState === 'abandoned') {
    return `You stepped away from ${title}.`;
  }
  if (m.lastFocusState === 'complete') {
    return `You last completed a focus block on ${title}.`;
  }
  if (m.lastIntent) {
    return `You were planning to: ${m.lastIntent}`;
  }
  return `Resume from ${title}.`;
}

