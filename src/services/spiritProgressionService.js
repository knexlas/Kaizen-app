/**
 * Spirit progression: level tiers derived from total Spirit Points (1 per minute of focus).
 * Builds on existing save data only — no schema or persistence changes.
 */

/** Tier thresholds (inclusive min for each level). Level 0 = 0–29, 1 = 30–99, etc. */
export const SPIRIT_TIERS = [
  { minPoints: 0, name: 'Seed', icon: '🌱', description: 'Just beginning' },
  { minPoints: 30, name: 'Sprout', icon: '🌿', description: 'Taking root' },
  { minPoints: 100, name: 'Sapling', icon: '🌳', description: 'Growing steady' },
  { minPoints: 250, name: 'Grove', icon: '🌲', description: 'A small forest' },
  { minPoints: 500, name: 'Elder', icon: '🪵', description: 'Deep roots' },
  { minPoints: 1000, name: 'Spirit Keeper', icon: '✨', description: 'The garden remembers' },
];

/**
 * Get current level index (0-based) for a given point total.
 * @param {number} points - Total spirit points
 * @returns {number} Index into SPIRIT_TIERS
 */
export function getSpiritLevelIndex(points) {
  const n = Math.max(0, Math.floor(Number(points) || 0));
  let idx = 0;
  for (let i = SPIRIT_TIERS.length - 1; i >= 0; i--) {
    if (n >= SPIRIT_TIERS[i].minPoints) {
      idx = i;
      break;
    }
  }
  return idx;
}

/**
 * Get progression state for display: current tier, progress toward next, and copy.
 * @param {number} points - Total spirit points
 * @returns {{ levelIndex: number, tier: object, nextTier: object | null, pointsInLevel: number, pointsNeededForNext: number, progressFraction: number, totalPoints: number }}
 */
export function getSpiritProgression(points) {
  const totalPoints = Math.max(0, Math.floor(Number(points) || 0));
  const levelIndex = getSpiritLevelIndex(totalPoints);
  const tier = SPIRIT_TIERS[levelIndex];
  const nextTier = levelIndex < SPIRIT_TIERS.length - 1 ? SPIRIT_TIERS[levelIndex + 1] : null;
  const currentThreshold = tier.minPoints;
  const nextThreshold = nextTier ? nextTier.minPoints : currentThreshold;
  const pointsInLevel = totalPoints - currentThreshold;
  const pointsNeededForNext = nextTier ? nextThreshold - currentThreshold : 0;
  const progressFraction = pointsNeededForNext > 0
    ? Math.min(1, (totalPoints - currentThreshold) / pointsNeededForNext)
    : 1;

  return {
    levelIndex,
    tier,
    nextTier,
    pointsInLevel,
    pointsNeededForNext,
    progressFraction,
    totalPoints,
  };
}
