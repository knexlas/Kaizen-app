/**
 * Energy Memory / Task Dictionary: learn energy cost from user feedback (Energized/Drained).
 * Normalizes task names (case-insensitive, strip emojis) and stores per-user stats in Firebase.
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const GARDEN_DOC = 'data';
const ENERGY_DICTIONARY_DOC = 'energyDictionary';

function toFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeEstimatedCost(value, fallback = 1) {
  return Math.max(0, Math.min(3, toFiniteNumber(value, fallback)));
}

/** Normalize task name for dictionary key: lowercase, strip emojis and extra spaces. Forgiving matching. */
export function normalizeTaskName(title) {
  if (title == null || typeof title !== 'string') return '';
  // Remove emojis and other symbols (keep letters, numbers, spaces)
  const stripped = title
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/[^\p{L}\p{N}\s\-_]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return stripped;
}

/**
 * Compute learnedCost from counts. Rule: if timesEnergizing dominates → 0; if timesDraining >> estimated → increase.
 * @param {{ timesDraining: number, timesEnergizing: number, estimatedCost?: number }} entry
 * @returns {number} 0–3
 */
function computeLearnedCost(entry) {
  const drain = Number(entry?.timesDraining) || 0;
  const energize = Number(entry?.timesEnergizing) || 0;
  const estimated = normalizeEstimatedCost(entry?.estimatedCost, 1);

  if (energize > drain) return 0;
  if (drain >= 2 * (energize + 1)) return Math.min(3, estimated + 1);
  return estimated;
}

/**
 * Get the Task Dictionary document ref for a user.
 * @param {string} uid
 */
function dictionaryRef(uid) {
  return doc(db, 'users', uid, 'garden', GARDEN_DOC, ENERGY_DICTIONARY_DOC);
}

/**
 * Record a vibe (energizer | drainer) for a task. Call when user taps Energized or Drained.
 * Updates running tally and learnedCost in Firestore.
 * @param {string} uid - Firebase user id
 * @param {string} taskTitle - Display title of the task
 * @param {'energizer'|'drainer'} vibe
 * @param {number} [estimatedCost] - Current energy cost of the task (0–3) if known
 */
export async function recordVibe(uid, taskTitle, vibe, estimatedCost) {
  if (!uid || !taskTitle || (vibe !== 'energizer' && vibe !== 'drainer')) return;
  const key = normalizeTaskName(taskTitle);
  if (!key) return;

  const ref = dictionaryRef(uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const entries = data?.entries && typeof data.entries === 'object' ? data.entries : {};

  const existing = entries[key] || {
    timesDraining: 0,
    timesEnergizing: 0,
    estimatedCost: normalizeEstimatedCost(estimatedCost, 1),
  };
  if (existing.estimatedCost == null || Number.isNaN(existing.estimatedCost)) {
    existing.estimatedCost = normalizeEstimatedCost(estimatedCost, 1);
  }

  if (vibe === 'drainer') {
    existing.timesDraining = (existing.timesDraining || 0) + 1;
  } else {
    existing.timesEnergizing = (existing.timesEnergizing || 0) + 1;
  }

  existing.learnedCost = computeLearnedCost(existing);
  existing.updatedAt = serverTimestamp();
  entries[key] = existing;

  await setDoc(ref, { entries, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Get a single task's dictionary entry by title (forgiving: normalized key).
 * @param {string} uid - Firebase user id
 * @param {string} taskTitle - Display title (will be normalized)
 * @returns {Promise<{ learnedCost: number, timesDraining: number, timesEnergizing: number }|null>}
 */
export async function getTaskDictionaryEntry(uid, taskTitle) {
  if (!uid || !taskTitle) return null;
  const key = normalizeTaskName(taskTitle);
  if (!key) return null;

  const ref = dictionaryRef(uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const entries = data?.entries && typeof data.entries === 'object' ? data.entries : {};
  const entry = entries[key];
  if (!entry) return null;

  return {
    learnedCost: entry.learnedCost != null ? Math.max(0, Math.min(3, Number(entry.learnedCost))) : null,
    timesDraining: Number(entry.timesDraining) || 0,
    timesEnergizing: Number(entry.timesEnergizing) || 0,
    estimatedCost: entry.estimatedCost != null ? Number(entry.estimatedCost) : null,
  };
}

/**
 * Get tasks with highest timesEnergizing (for "Energy First Aid" suggestions).
 * @param {string} uid
 * @param {number} limit
 * @returns {Promise<Array<{ key: string, timesEnergizing: number, learnedCost: number }>>}
 */
export async function getMostEnergizingTasks(uid, limit = 5) {
  if (!uid) return [];
  const ref = dictionaryRef(uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const entries = data?.entries && typeof data.entries === 'object' ? data.entries : {};
  const list = Object.entries(entries)
    .filter(([, e]) => (e?.timesEnergizing || 0) > 0)
    .map(([k, e]) => ({ key: k, timesEnergizing: Number(e.timesEnergizing) || 0, learnedCost: e?.learnedCost ?? 0 }))
    .sort((a, b) => b.timesEnergizing - a.timesEnergizing);
  return list.slice(0, limit);
}

const ADMIN_TITLE_REGEX = /\b(email|reply|follow up|admin|calendar|book|pay|invoice|review|sort|inbox|groceries|dentist|schedule|renew|update|life admin)\b/i;
const LOW_ENERGY_TITLE_REGEX = /\b(rest|reset|walk|stretch|water|hydrate|meal prep|tidy|backup|low-energy|recovery|breath|prep)\b/i;

/**
 * Infer a lightweight task timing category for learned energy recommendations.
 * @param {object|string|null|undefined} taskLike
 * @returns {'deep_work'|'admin'|'low_energy'}
 */
export function inferTaskTimingType(taskLike) {
  const title = typeof taskLike === 'string'
    ? taskLike
    : taskLike?.title ?? taskLike?.taskTitle ?? taskLike?.subtaskTitle ?? '';
  const estimatedMinutes = Number(taskLike?.estimatedMinutes ?? taskLike?.minutes ?? 0) || 0;
  const energyType = taskLike?.energyType;
  const energyCost = Number(taskLike?.energyCost ?? taskLike?.spoonCost ?? 1);

  if (taskLike?._projectGoal || energyType === 'high-focus' || estimatedMinutes >= 45) return 'deep_work';
  if (LOW_ENERGY_TITLE_REGEX.test(title) || energyType === 'restorative' || energyCost <= 1 || estimatedMinutes <= 15 || taskLike?.type === 'routine') {
    return 'low_energy';
  }
  if (ADMIN_TITLE_REGEX.test(title) || energyType === 'maintenance') return 'admin';
  return estimatedMinutes >= 30 ? 'deep_work' : 'admin';
}
