import { localISODate } from '../../../services/dateUtils';

export const WAITING_TYPES = {
  PERSON: 'person',
  DOCUMENT: 'document',
  DECISION: 'decision',
  OTHER: 'other',
};

export function normalizeWaitingSupportState(state) {
  if (!state || typeof state !== 'object') return { byItem: {} };
  return {
    byItem: state.byItem && typeof state.byItem === 'object' ? state.byItem : {},
  };
}

function getItemKey(itemType, itemId) {
  return `${itemType}:${itemId}`;
}

export function setWaitingSupportItem(state, {
  itemType = 'goal',
  itemId,
  waitingType = WAITING_TYPES.OTHER,
  waitingOn = '',
  holdUntil = null,
  followUpDate = null,
  note = '',
  status = 'active',
} = {}) {
  if (!itemId) return normalizeWaitingSupportState(state);
  const next = normalizeWaitingSupportState(state);
  const key = getItemKey(itemType, itemId);
  next.byItem[key] = {
    itemType,
    itemId,
    waitingType: Object.values(WAITING_TYPES).includes(waitingType) ? waitingType : WAITING_TYPES.OTHER,
    waitingOn: String(waitingOn || '').trim(),
    holdUntil: holdUntil || null,
    followUpDate: followUpDate || null,
    note: String(note || '').trim(),
    status: status === 'resolved' ? 'resolved' : 'active',
    updatedAt: new Date().toISOString(),
  };
  return next;
}

export function clearWaitingSupportItem(state, { itemType = 'goal', itemId } = {}) {
  if (!itemId) return normalizeWaitingSupportState(state);
  const next = normalizeWaitingSupportState(state);
  const key = getItemKey(itemType, itemId);
  const prev = next.byItem[key];
  if (!prev) return next;
  next.byItem[key] = { ...prev, status: 'resolved', updatedAt: new Date().toISOString() };
  return next;
}

export function getWaitingItemsDue(state, { today = localISODate(), itemType = null } = {}) {
  const normalized = normalizeWaitingSupportState(state);
  const items = Object.values(normalized.byItem || {}).filter((entry) => {
    if (!entry || entry.status === 'resolved') return false;
    if (itemType && entry.itemType !== itemType) return false;
    if (entry.holdUntil && entry.holdUntil > today) return false;
    return true;
  });
  return items.sort((a, b) => {
    const af = a.followUpDate || '9999-99-99';
    const bf = b.followUpDate || '9999-99-99';
    return af.localeCompare(bf);
  });
}

