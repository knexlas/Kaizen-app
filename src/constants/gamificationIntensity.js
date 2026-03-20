/**
 * Gamification intensity: minimal, balanced, playful.
 * Controls helper frequency, celebration intensity, decorative visuals, metaphor wording, garden/world visibility.
 * Core functionality (planning, tasks, focus) is unchanged; planning screens stay clear and professional.
 *
 * Stored in userSettings.gamificationIntensity. Default (undefined or '') = balanced.
 * Users change it in Settings → Personalization → Gamification intensity.
 */

export const GAMIFICATION_INTENSITY_LEVELS = {
  MINIMAL: 'minimal',
  BALANCED: 'balanced',
  PLAYFUL: 'playful',
};

export const GAMIFICATION_INTENSITY_OPTIONS = [
  { id: GAMIFICATION_INTENSITY_LEVELS.MINIMAL, label: 'Minimal', description: 'Plain productivity UI, subtle feedback, reduced helper chatter, minimal decoration.' },
  { id: GAMIFICATION_INTENSITY_LEVELS.BALANCED, label: 'Balanced', description: 'Calm motivational elements (default).' },
  { id: GAMIFICATION_INTENSITY_LEVELS.PLAYFUL, label: 'Playful', description: 'Stronger garden presence, richer celebration, more visible companion.' },
];

const DEFAULT_LEVEL = GAMIFICATION_INTENSITY_LEVELS.BALANCED;

/**
 * @param {Object} [userSettings]
 * @returns {'minimal'|'balanced'|'playful'}
 */
export function getGamificationIntensity(userSettings) {
  const v = userSettings?.gamificationIntensity;
  if (v === GAMIFICATION_INTENSITY_LEVELS.MINIMAL || v === GAMIFICATION_INTENSITY_LEVELS.BALANCED || v === GAMIFICATION_INTENSITY_LEVELS.PLAYFUL) return v;
  return DEFAULT_LEVEL;
}

/**
 * Config per level for UI behavior. Used by components that need to branch on intensity.
 */
export function getGamificationConfig(userSettings) {
  const level = getGamificationIntensity(userSettings ?? {});
  const configs = {
    [GAMIFICATION_INTENSITY_LEVELS.MINIMAL]: {
      showParticles: false,
      showConfetti: false,
      rewardDurationMs: 1800,
      showRewardBonusDetails: false,
      showRewardGrowthLine: false,
      showFocusSuccessCurrency: false,
      /** Only critical unblock/recover interventions. */
      helperFrequency: 'reduced',
      /** Small avatar, no auto-open dialogue. */
      spiritPresence: 'minimal',
      metaphorWording: false,
      /** Garden tab still available; less decorative cues on Now. */
      gardenWorldVisibility: 'reduced',
      /** No auto-open spirit dialogue on load. */
      autoShowSpiritDialogue: false,
    },
    [GAMIFICATION_INTENSITY_LEVELS.BALANCED]: {
      showParticles: true,
      showConfetti: false,
      rewardDurationMs: 2400,
      showRewardBonusDetails: false,
      showRewardGrowthLine: false,
      showFocusSuccessCurrency: false,
      helperFrequency: 'normal',
      spiritPresence: 'calm',
      metaphorWording: false,
      gardenWorldVisibility: 'reduced',
      autoShowSpiritDialogue: false,
    },
    [GAMIFICATION_INTENSITY_LEVELS.PLAYFUL]: {
      showParticles: true,
      showConfetti: true,
      rewardDurationMs: 3500,
      showRewardBonusDetails: true,
      showRewardGrowthLine: true,
      showFocusSuccessCurrency: true,
      helperFrequency: 'normal',
      spiritPresence: 'rich',
      metaphorWording: true,
      gardenWorldVisibility: 'prominent',
      autoShowSpiritDialogue: true,
    },
  };
  return configs[level] ?? configs[DEFAULT_LEVEL];
}

/** Helper intervention types that are always allowed in minimal (critical only). */
const CRITICAL_HELPER_TYPES = new Set([
  'overloaded',
  'no_next_step',
  'overdue_unscheduled',
  'focus_abandoned',
  'missed_day_recovery',
]);

/**
 * Whether to show a helper intervention of the given type at the current intensity.
 * @param {string} type - HELPER_INTERVENTION_TYPES value
 * @param {'minimal'|'balanced'|'playful'} intensity
 */
export function shouldShowHelperForIntensity(type, intensity) {
  if (intensity !== GAMIFICATION_INTENSITY_LEVELS.MINIMAL) return true;
  return CRITICAL_HELPER_TYPES.has(type);
}
