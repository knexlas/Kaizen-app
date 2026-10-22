import { useEffect, useMemo, useRef, useState } from 'react';
import { buildWatchFeed, deleteWatchEvent, intToDate, publishWatchFeed, subscribeWatchEvents } from './watchFeed';

const PUBLISH_DEBOUNCE_MS = 1500;

/**
 * Keeps watchFeeds/{watchKey} up to date and applies actions sent from the watch.
 * Runs only when a watch key is set and the user is signed in with Google.
 * Returns { status, lastSync, error }.
 */
export function useWatchSync(lean) {
  const { garden, today, projects, index, weekBacklog, blocksFor, setBlockDone, setTaskDone, moveBlock, scheduleTaskNext } = lean;
  const { goals, weekAssignments, googleUser, userSettings } = garden;
  const watchKey = userSettings?.watchKey ?? null;
  const uid = googleUser?.uid ?? null;
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);

  const feed = useMemo(() => {
    if (!watchKey) return null;
    return buildWatchFeed({
      today,
      goals,
      projects,
      index,
      weekBacklog,
      dayPlanFor: (date) => weekAssignments?.[date] ?? {},
    });
  }, [watchKey, today, goals, projects, index, weekBacklog, weekAssignments]);
  const feedJson = useMemo(() => (feed ? JSON.stringify(feed) : null), [feed]);

  useEffect(() => {
    if (!watchKey || !uid || !feedJson) return undefined;
    const timer = setTimeout(() => {
      publishWatchFeed(watchKey, uid, JSON.parse(feedJson))
        .then(() => { setLastSync(new Date()); setError(null); })
        .catch((e) => setError(e?.message ?? String(e)));
    }, PUBLISH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [watchKey, uid, feedJson]);

  // Latest appliers in a ref so the Firestore subscription does not resubscribe on every render.
  const applyRef = useRef(null);
  applyRef.current = (event) => {
    const date = event.d ? intToDate(event.d) : today;
    const blocks = blocksFor(date);
    const block = blocks.find((b) => event.i && b.id === event.i)
      ?? blocks.find((b) => event.k && b.taskId === event.k && (event.s == null || b.start === Number(event.s)));
    switch (event.a) {
      case 'done':
      case 'undo': {
        const done = event.a === 'done';
        if (block) setBlockDone(date, block, done);
        else if (event.k) setTaskDone(event.k, done);
        break;
      }
      case 'snooze':
        if (block) moveBlock(date, block, block.start + (Number(event.n) || 15));
        break;
      case 'start':
        if (block && event.n != null) moveBlock(date, block, Number(event.n));
        break;
      case 'today':
        if (event.k) scheduleTaskNext(event.k, today);
        break;
      default:
        break;
    }
  };

  const appliedRef = useRef(new Set());
  useEffect(() => {
    if (!watchKey || !uid) return undefined;
    return subscribeWatchEvents(
      watchKey,
      (events) => {
        events
          .filter((event) => !appliedRef.current.has(event.id))
          .sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0))
          .forEach((event) => {
            appliedRef.current.add(event.id);
            applyRef.current?.(event);
            deleteWatchEvent(watchKey, event.id).catch(() => {});
          });
      },
      (e) => setError(e?.message ?? String(e))
    );
  }, [watchKey, uid]);

  const status = !watchKey ? 'off' : !uid ? 'signed-out' : error ? 'error' : lastSync ? 'synced' : 'pending';
  return { status, lastSync, error, watchKey };
}
