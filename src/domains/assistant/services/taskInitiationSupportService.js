const VAGUE_TASK_REGEX = /\b(start|work on|handle|deal with|fix|organize|plan|review|taxes|clean|reply|follow up)\b/i;

function normalizeStyle(style) {
  return ['tiny_step', 'script', 'prepare', 'timer_start', 'low_energy', 'body_double'].includes(style) ? style : 'tiny_step';
}

function buildStarterScript(title = '') {
  const lower = String(title).toLowerCase();
  if (/\breply|message|text|email|follow up\b/.test(lower)) {
    return 'Hey, sorry for the delay - quick update:';
  }
  if (/\btax|invoice|billing\b/.test(lower)) {
    return 'Starting this now. First I will list what is missing.';
  }
  if (/\bclean|kitchen|house\b/.test(lower)) {
    return 'I will do one area first, not the whole space.';
  }
  return 'I will do a small first step now, not the whole task.';
}

function buildTinyStep(title = '') {
  const lower = String(title).toLowerCase();
  if (/\breply|message|text|email|follow up\b/.test(lower)) return 'Open the conversation and read only the last two messages.';
  if (/\btax|invoice|billing\b/.test(lower)) return 'Open the portal and list one missing document.';
  if (/\bclean|kitchen|house\b/.test(lower)) return 'Clear one surface or do dishes only.';
  return `Open "${title}" and do one visible first action.`;
}

function buildPrepStep(title = '') {
  const lower = String(title).toLowerCase();
  if (/\btax|invoice|billing\b/.test(lower)) return 'Gather documents first so starting feels lighter.';
  if (/\breply|message|text|email|follow up\b/.test(lower)) return 'Find the thread before writing anything.';
  if (/\bclean|kitchen|house\b/.test(lower)) return 'Set a timer and prepare one tool before starting.';
  return 'Prepare what you need first (tabs, docs, or materials).';
}

function buildLowerEnergyVersion(title = '') {
  const lower = String(title).toLowerCase();
  if (/\breply|message|text|email|follow up\b/.test(lower)) return 'Send a one-line holding reply instead of a full response.';
  if (/\btax|invoice|billing\b/.test(lower)) return 'Only identify what is missing today.';
  if (/\bclean|kitchen|house\b/.test(lower)) return 'Do one mini-zone for 7 minutes.';
  return `Do a reduced version of "${title}" for 10-15 minutes only.`;
}

function buildGoodEnoughTarget(title = '') {
  const lower = String(title).toLowerCase();
  if (/\breply|message|text|email|follow up\b/.test(lower)) return 'Good enough today: one clear reply sent.';
  if (/\btax|invoice|billing\b/.test(lower)) return 'Good enough today: list missing pieces and save progress.';
  if (/\bclean|kitchen|house\b/.test(lower)) return 'Good enough today: one surface reset.';
  return `Good enough today: one concrete step completed for "${title}".`;
}

export function shouldShowTaskInitiationSupport({
  taskTitle = '',
  isLowEnergy = false,
  noNextStep = false,
  reopenCount = 0,
  postponeCount = 0,
  dismissed = false,
} = {}) {
  if (dismissed) return false;
  if (!taskTitle || String(taskTitle).trim().length < 2) return false;
  if (isLowEnergy) return true;
  if (noNextStep) return true;
  if (postponeCount >= 2) return true;
  if (reopenCount >= 2) return true;
  return VAGUE_TASK_REGEX.test(taskTitle);
}

export function buildTaskInitiationSupport({
  taskTitle = '',
  preferredStyle = 'tiny_step',
} = {}) {
  const style = normalizeStyle(preferredStyle);
  const lower = String(taskTitle).toLowerCase();
  const bodyDoubleLine = /\breply|message|email|follow up\b/.test(lower)
    ? 'Stay with this for 3 minutes. Open the thread, read, then send one line.'
    : 'Stay with this for 3 minutes. One small move, then decide what is next.';
  return {
    tinyFirstStep: buildTinyStep(taskTitle),
    prepStep: buildPrepStep(taskTitle),
    easierVersion: buildLowerEnergyVersion(taskTitle),
    starterScript: buildStarterScript(taskTitle),
    timerStarter: 'Start a 5-minute timer and stop after one small move.',
    timerStarter3: 'Start a 3-minute timer and do only the setup step.',
    microCountdown: '3-2-1 and begin the first visible move.',
    setupStep: buildPrepStep(taskTitle),
    bodyDoubleLine,
    goodEnoughTarget: buildGoodEnoughTarget(taskTitle),
    preferredStyle: style,
  };
}

