import { useLeanPlan } from '../../domains/lean/useLeanPlan';
import { useWatchSync } from '../../domains/lean/useWatchSync';

/** Keeps the watch feed syncing while the full garden UI is open. */
export default function WatchSyncBridge() {
  useWatchSync(useLeanPlan());
  return null;
}
