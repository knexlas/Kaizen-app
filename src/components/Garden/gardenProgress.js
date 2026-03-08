export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function getGoalProgressPercent(goal) {
  if (goal?._projectGoal) return getProjectProgressPercent(goal);
  const total = Number(goal?.totalMinutes) || 0;
  const target = (Number(goal?.targetHours) || 0) * 60 || (Number(goal?.estimatedMinutes) || 60);
  return clamp((total / target) * 100, 0, 100);
}

export function getProjectProgressPercent(goal) {
  const milestones = Array.isArray(goal?.milestones) ? goal.milestones : [];
  if (milestones.length === 0) return 0;
  const done = milestones.filter((milestone) => milestone.completed).length;
  return clamp((done / milestones.length) * 100, 0, 100);
}

export function getPlantStage(progressPercent) {
  if (progressPercent < 10) return 'seed';
  if (progressPercent < 50) return 'sprout';
  if (progressPercent < 100) return 'bloom';
  return 'harvest';
}

export const STAGE_EMOJI = { seed: '🌱', sprout: '🌿', bloom: '🌸', harvest: '🌲' };
export const PROJECT_STAGE_EMOJI = { seed: '🫘', sprout: '🪴', bloom: '🌻', harvest: '🏆' };

export const FLORA = [
  '🌻', '🌺', '🌹', '🌸', '🪷', '🍄', '🌾', '🌿', '🍀', '🪴', '🎋', '🌵', '🌴', '🌳', '🌲', '🍁', '🍂', '🍇', '🫐', '🍓',
  '🍒', '🍑', '🥝', '🍋', '🍊', '🌶️', '🥕', '🥬', '🥦', '🌽', '🫑', '🍅', '🥑', '🫒', '🌰', '🥜', '🪻', '🌼', '🏵️', '💐',
  '🪹', '🌱', '🪺', '🌴', '🪸', '🍀', '🌷', '🪷', '🌺', '🥀', '🪻',
];

export const PONDS = ['🌊', '💧', '🧊', '🐟', '🐸', '🦆', '🪼', '🐚', '🦀', '🐢'];
export const ROCKS = ['🪨', '🗿', '⛰️', '🗻', '🏯', '⛩️', '🪵', '🪷', '🪸', '🏔️'];

export function getHash(str) {
  const value = String(str ?? '');
  if (!value) return 0;
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = value.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}
