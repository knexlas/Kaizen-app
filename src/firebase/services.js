// Firebase Firestore services
import { collection, addDoc, deleteDoc, doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

const GARDEN_DOC = 'data';
const COMPOST_COLLECTION = 'compost';
const DAILY_PLANS_COLLECTION = 'dailyPlans';

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
 * Fetch the daily plan for a date (one-time read).
 * @param {string} uid - Firebase user id
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<{ assignments: Object }>}
 */
export async function getDailyPlan(uid, date) {
  if (!uid || !date) return { assignments: {} };
  const docRef = doc(db, 'users', uid, 'garden', GARDEN_DOC, DAILY_PLANS_COLLECTION, date);
  const snap = await getDoc(docRef);
  const data = snap.exists() ? snap.data() : {};
  const assignments = data?.assignments && typeof data.assignments === 'object' ? data.assignments : {};
  return { assignments };
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
