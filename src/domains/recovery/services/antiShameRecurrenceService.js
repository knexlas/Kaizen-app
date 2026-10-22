import { localISODate } from '../../../services/dateUtils';

export const RECURRING_SUPPORT_STATUSES = {
  SKIPPED_COMPASSIONATELY: 'skipped_compassionately',
  LIGHT_VERSION_COMPLETED: 'light_version_completed',
  DEFERRED_SAFELY: 'deferred_safely',
  RESUMED_GENTLY: 'resumed_gently',
};

export function normalizeRecurringSupportState(state) {
  if (!state || typeof state !== 'object') return { byItem: {} };
  return {
    byItem: state.byItem && typeof state.byItem === 'object' ? state.byItem : {},
  };
}

function getItemKey(itemType, itemId) {
  return `${itemType}:${itemId}`;
}

export function markRecurringSupportState(state, { itemType = 'routine', itemId, date = localISODate(), status, note = '' }) {
  if (!itemId || !status) return normalizeRecurringSupportState(state);
  const next = normalizeRecurringSupportState(state);
  const key = getItemKey(itemType, itemId);
  const prev = next.byItem[key] && typeof next.byItem[key] === 'object' ? next.byItem[key] : {};
  next.byItem[key] = {
    ...prev,
    [date]: {
      status,
      note: String(note || ''),
      updatedAt: new Date().toISOString(),
    },
  };
  return next;
}

export function getRecentStatusCounts(state, { itemType = 'routine', itemId, lookbackDays = 14 }) {
  const normalized = normalizeRecurringSupportState(state);
  const key = getItemKey(itemType, itemId);
  const entries = normalized.byItem[key] && typeof normalized.byItem[key] === 'object' ? normalized.byItem[key] : {};
  const now = new Date();
  const out = { skipped: 0, light: 0, deferred: 0, resumed: 0 };
  Object.entries(entries).forEach(([dateStr, payload]) => {
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
    if (diff < 0 || diff > lookbackDays) return;
    if (payload?.status === RECURRING_SUPPORT_STATUSES.SKIPPED_COMPASSIONATELY) out.skipped += 1;
    if (payload?.status === RECURRING_SUPPORT_STATUSES.LIGHT_VERSION_COMPLETED) out.light += 1;
    if (payload?.status === RECURRING_SUPPORT_STATUSES.DEFERRED_SAFELY) out.deferred += 1;
    if (payload?.status === RECURRING_SUPPORT_STATUSES.RESUMED_GENTLY) out.resumed += 1;
  });
  return out;
}

