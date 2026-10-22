/**
 * Garmin watch sync.
 *
 * The web app publishes a small, watch-friendly snapshot to Firestore at watchFeeds/{watchKey}.
 * The watch reads it through the Firestore REST API (no sign-in on the watch; the key is the secret)
 * and writes actions (done / undo / snooze / start) to watchFeeds/{watchKey}/events, which the web
 * app applies and deletes while it is open. See firestore.rules for the access rules.
 *
 * Event fields: a = action (done | undo | snooze | start | today), i = block id, k = task id, d = date (yyyymmdd), s = block start minute,
 * n = new start minute ('start') or minutes to push ('snooze'), at = epoch ms on the watch.
 */
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { addDays, getBlockedDependents, getDayBlocks, getOpenBlockers, isTaskDone, taskMinutes } from './leanModel';

const KEY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const MAX_TASKS_PER_PROJECT = 12;
const MAX_TITLE = 40;

export function generateWatchKey(length = 12) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join('');
}

/** 'YYYY-MM-DD' -> 20261022 (what the watch compares against). */
export function dateToInt(dateStr) {
  return Number(String(dateStr).replaceAll('-', ''));
}

export function intToDate(value) {
  const s = String(value);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function short(text) {
  const s = String(text ?? '').trim();
  return s.length > MAX_TITLE ? `${s.slice(0, MAX_TITLE - 1)}…` : s;
}

/** Build the snapshot the watch shows: the next 7 days of blocks, this week's backlog and projects with blockers. */
export function buildWatchFeed({ today, goals, projects, index, weekBacklog, dayPlanFor }) {
  const blocks = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(today, i);
    getDayBlocks(dayPlanFor(date), goals).forEach((block) => {
      const task = block.taskId ? index[block.taskId]?.task : null;
      blocks.push({
        i: block.id ?? '',
        k: block.taskId ?? '',
        t: short(block.title),
        p: short(block.goalTitle ?? ''),
        d: dateToInt(date),
        s: block.start,
        m: block.duration,
        x: block.completed || (task ? isTaskDone(task) : false),
      });
    });
  }

  const projectFeed = projects.map((goal) => {
    const tasks = goal.subtasks ?? [];
    const open = tasks.filter((t) => !isTaskDone(t));
    const rows = open.map((task) => {
      const blockers = getOpenBlockers(task, index);
      const dependents = getBlockedDependents(task, index);
      return {
        k: task.id,
        t: short(task.title),
        b: short(blockers.map((b) => b.title).join(', ')),
        n: dependents.length,
        m: taskMinutes(task),
      };
    });
    // Tasks others wait on first, then free tasks, then blocked ones.
    rows.sort((a, b) => (a.b ? 1 : 0) - (b.b ? 1 : 0) || b.n - a.n);
    return {
      n: short(goal.title),
      o: open.length,
      c: tasks.length - open.length,
      tasks: rows.slice(0, MAX_TASKS_PER_PROJECT),
    };
  }).filter((p) => p.o > 0);

  const backlog = weekBacklog.map(({ task, goal }) => ({
    k: task.id,
    t: short(task.title),
    p: short(goal.title),
    m: taskMinutes(task),
    b: getOpenBlockers(task, index).length > 0,
  }));

  return { day: dateToInt(today), blocks, backlog, projects: projectFeed, alerts: buildAlerts(blocks) };
}

/**
 * Upcoming block starts as "epochSeconds|blockId|startMinute|title" strings (today and tomorrow, max 30).
 * The watch's background reminder fetches only this field, so it stays tiny; blockId + startMinute let it
 * skip blocks the watch already marked done or moved before the web app has caught up.
 */
function buildAlerts(blocks) {
  const now = Date.now() / 1000;
  return blocks
    .filter((b) => !b.x)
    .map((b) => {
      const date = intToDate(b.d);
      const epoch = Math.round(new Date(`${date}T${String(Math.floor(b.s / 60)).padStart(2, '0')}:${String(b.s % 60).padStart(2, '0')}:00`).getTime() / 1000);
      return { epoch, text: `${epoch}|${b.i}|${b.s}|${b.t}` };
    })
    .filter((a) => a.epoch > now - 3600 && a.epoch < now + 36 * 3600)
    .sort((a, b) => a.epoch - b.epoch)
    .slice(0, 30)
    .map((a) => a.text);
}

export function publishWatchFeed(watchKey, uid, feed) {
  return setDoc(doc(db, 'watchFeeds', watchKey), { ...feed, uid, v: Date.now() });
}

export function subscribeWatchEvents(watchKey, callback, onError) {
  return onSnapshot(
    collection(db, 'watchFeeds', watchKey, 'events'),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export function deleteWatchEvent(watchKey, eventId) {
  return deleteDoc(doc(db, 'watchFeeds', watchKey, 'events', eventId));
}
