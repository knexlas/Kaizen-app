// Firebase Firestore services
import { collection, addDoc, deleteDoc, doc, getDoc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

const GARDEN_DOC = 'data';
const COMPOST_COLLECTION = 'compost';
const DAILY_PLANS_COLLECTION = 'dailyPlans';
const USER_INSIGHTS_COLLECTION = 'userInsights';

/**
 * Normalize a Firestore compost doc to { id, text, createdAt } (createdAt as ISO string).
 */
function compostDocToItem(docSnap) {
  const data = docSnap.data();
  const createdAt = data?.createdAt?.toDate?.();
  return {
    id: docSnap.id,
    text: data?.text ?? '',
    createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
  };
}

/**
 * Subscribe to the user's compost heap. Callback receives array of { id, text, createdAt }.
 * @param {string} uid - Firebase user id
 * @param {(items: { id: string, text: string, createdAt: string }[]) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function subscribeToCompost(uid, callback) {
  if (!uid || typeof callback !== 'function') return () => {};
  const colRef = collection(db, 'users', uid, 'garden', GARDEN_DOC, COMPOST_COLLECTION);
  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const items = snapshot.docs
        .map(compostDocToItem)
        .filter((item) => item.text !== '')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    },
    (err) => {
      console.warn('subscribeToCompost error', err);
    }
  );
  return unsubscribe;
}

/**
 * Add an item to the user's compost heap.
 * @param {string} uid - Firebase user id
 * @param {string} text - Item text
 * @returns {Promise<string>} Document id
 */
export async function addCompostItem(uid, text) {
  const trimmed = (text || '').trim();
  if (!uid || !trimmed) throw new Error('uid and text required');
  const colRef = collection(db, 'users', uid, 'garden', GARDEN_DOC, COMPOST_COLLECTION);
  const docRef = await addDoc(colRef, {
    text: trimmed,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Delete a compost item by id.
 * @param {string} uid - Firebase user id
 * @param {string} id - Document id
 */
export async function deleteCompostItem(uid, id) {
  if (!uid || !id) return;
  const docRef = doc(db, 'users', uid, 'garden', GARDEN_DOC, COMPOST_COLLECTION, id);
  await deleteDoc(docRef);
}

/**
 * Update a compost item (e.g. to link it to a goal).
 * @param {string} uid - Firebase user id
 * @param {string} id - Compost document id
 * @param {Object} fields - Fields to update (e.g. { linkedGoalId, tags })
 */
export async function updateCompostItem(uid, id, fields) {
  if (!uid || !id) return;
  const docRef = doc(db, 'users', uid, 'garden', GARDEN_DOC, COMPOST_COLLECTION, id);
  await updateDoc(docRef, fields);
}

/**
 * Save the daily schedule (assignments) for a given date.
 * @param {string} uid - Firebase user id
 * @param {string} date - YYYY-MM-DD
 * @param {Object} assignments - { [hour]: goalId | assignmentObject }
 */
export async function saveDailyPlan(uid, date, assignments) {
  if (!uid || !date) return;
  const docRef = doc(db, 'users', uid, 'garden', GARDEN_DOC, DAILY_PLANS_COLLECTION, date);
  await setDoc(docRef, { assignments: assignments ?? {}, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Subscribe to the daily plan for a given date. Callback receives { assignments }.
 * @param {string} uid - Firebase user id
 * @param {string} date - YYYY-MM-DD
 * @param {(data: { assignments: Object }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function subscribeToDailyPlan(uid, date, callback) {
  if (!uid || !date || typeof callback !== 'function') return () => {};
  const docRef = doc(db, 'users', uid, 'garden', GARDEN_DOC, DAILY_PLANS_COLLECTION, date);
  const unsubscribe = onSnapshot(
    docRef,
    (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : {};
      const assignments = data?.assignments && typeof data.assignments === 'object' ? data.assignments : {};
      callback({ assignments });
    },
    (err) => {
      console.warn('subscribeToDailyPlan error', err);
    }
  );
  return unsubscribe;
}

/**
 * Fetch the daily plan for a date (one-time read). Also returns check-in data if present.
 * @param {string} uid - Firebase user id
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<{ assignments: Object, spoonCount?: number, energyModifier?: number }>}
 */
export async function getDailyPlan(uid, date) {
  if (!uid || !date) return { assignments: {} };
  const docRef = doc(db, 'users', uid, 'garden', GARDEN_DOC, DAILY_PLANS_COLLECTION, date);
  const snap = await getDoc(docRef);
  const data = snap.exists() ? snap.data() : {};
  const assignments = data?.assignments && typeof data.assignments === 'object' ? data.assignments : {};
  const spoonCount = typeof data?.spoonCount === 'number' ? data.spoonCount : undefined;
  const energyModifier = typeof data?.energyModifier === 'number' ? data.energyModifier : undefined;
  return { assignments, spoonCount, energyModifier };
}

/**
 * Save check-in (spoons/energy) for a date. Merges into the daily plan doc without overwriting assignments.
 * @param {string} uid - Firebase user id
 * @param {string} date - YYYY-MM-DD
 * @param {{ spoonCount?: number, energyModifier?: number }} payload
 */
export async function saveCheckInForDate(uid, date, payload) {
  if (!uid || !date) return;
  const docRef = doc(db, 'users', uid, 'garden', GARDEN_DOC, DAILY_PLANS_COLLECTION, date);
  await setDoc(
    docRef,
    {
      spoonCount: payload.spoonCount ?? null,
      energyModifier: payload.energyModifier ?? null,
      checkInAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Fetch check-in data for the last N days (for Insights charts).
 * @param {string} uid - Firebase user id
 * @param {number} days - Number of days (default 7)
 * @returns {Promise<Array<{ dateStr: string, spoonCount?: number, energyModifier?: number }>>}
 */
export async function getCheckInsForLastDays(uid, days = 7) {
  if (!uid) return [];
  const result = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const docRef = doc(db, 'users', uid, 'garden', GARDEN_DOC, DAILY_PLANS_COLLECTION, dateStr);
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : {};
    result.push({
      dateStr,
      spoonCount: typeof data?.spoonCount === 'number' ? data.spoonCount : undefined,
      energyModifier: typeof data?.energyModifier === 'number' ? data.energyModifier : undefined,
    });
  }
  return result;
}

/**
 * Save a weekly narrative insight. Id = week id (e.g. "2025-W09"). Schema: { id, text, generatedAt }.
 * @param {string} uid - Firebase user id
 * @param {string} weekId - e.g. "2025-W09"
 * @param {string} text - Narrative text from AI
 * @returns {Promise<void>}
 */
export async function saveUserInsight(uid, weekId, text) {
  if (!uid || !weekId || typeof text !== 'string') return;
  const docRef = doc(db, 'users', uid, USER_INSIGHTS_COLLECTION, weekId);
  await setDoc(
    docRef,
    {
      id: weekId,
      text: text.trim(),
      generatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Fetch the cached narrative insight for a week.
 * @param {string} uid - Firebase user id
 * @param {string} weekId - e.g. "2025-W09"
 * @returns {Promise<{ id: string, text: string, generatedAt?: string } | null>}
 */
export async function getUserInsight(uid, weekId) {
  if (!uid || !weekId) return null;
  const docRef = doc(db, 'users', uid, USER_INSIGHTS_COLLECTION, weekId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  const generatedAt = data?.generatedAt?.toDate?.();
  return {
    id: data?.id ?? weekId,
    text: typeof data?.text === 'string' ? data.text : '',
    generatedAt: generatedAt ? generatedAt.toISOString() : undefined,
  };
}

/**
 * Adds a new goal to the 'goals' collection in Firestore
 */
export async function addNewGoal(title, emotionalWhy) {
  try {
    const docRef = await addDoc(collection(db, 'goals'), {
      title: title.trim(),
      emotional_why: emotionalWhy.trim(),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding goal:', error);
    throw error;
  }
}

/**
 * Appends a record to the 'energyHistory' collection for tracking drain over time.
 * @param {Object} record - { stones: number, valence: 'drain'|'charge', journal: string }
 * @returns {Promise<string>} Document ID
 */
export async function addEnergyRecord(record) {
  try {
    const docRef = await addDoc(collection(db, 'energyHistory'), {
      ...record,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding energy record:', error);
    throw error;
  }
}

/**
 * Placeholder for Gemini API: analyze energy patterns from journal + valence + cost.
 * @param {Object} data - { stones: number, valence: 'drain'|'charge', journal: string }
 * @returns {Promise<Object>} Placeholder insight
 */
export async function analyzeEnergyPattern(data) {
  // TODO: Call Gemini API with data.journal, data.valence, data.stones
  await new Promise((r) => setTimeout(r, 300));
  return { ok: true, message: 'Pattern analysis (Gemini placeholder)' };
}
