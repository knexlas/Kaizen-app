/**
 * Normalize task/event capture payloads from multiple entry points (Quick Add, OmniAdd, planner actions)
 * into one shape consumed by GardenDashboard.
 */

import { localISODate } from './dateUtils';

function normalizeEnergyCost(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(3, Math.round(value)));
}

function normalizeRecurrence(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  if (raw.type === 'weekly') return { type: 'weekly', days: Array.isArray(raw.days) ? raw.days : [] };
  if (raw.type === 'monthly') return { type: 'monthly' };
  if (raw.type === 'custom') return { type: 'custom' };
  if (raw.type === 'daily') return { type: 'daily' };
  return undefined;
}

/**
 * Try to parse a date/time from raw text (fallback when Gemini returns no startTime).
 * Supports: "tomorrow at 3pm", "next tuesday", "friday 14:00", "today at 5pm".
 * @param {string} text
 * @returns {{ scheduledDate: string, scheduledTime: string } | null}
 */
export function parseScheduledFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.trim().toLowerCase();
  const now = new Date();
  let date = new Date(now);
  let hours = 9;
  let minutes = 0;

  const dayMatch = lower.match(/\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (dayMatch) {
    const day = dayMatch[1];
    if (day === 'tomorrow') {
      date.setDate(now.getDate() + 1);
    } else if (day === 'today') {
      date = new Date(now);
    } else {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const target = days.indexOf(day);
      const current = now.getDay();
      let diff = target - current;
      if (lower.includes('next ') && diff <= 0) diff += 7;
      else if (diff < 0) diff += 7;
      date.setDate(now.getDate() + diff);
    }
  }

  const timeMatch = lower.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = (timeMatch[3] || '').toLowerCase();
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    hours = Math.max(0, Math.min(23, hours));
    minutes = Math.max(0, Math.min(59, minutes));
  }

  date.setHours(hours, minutes, 0, 0);
  const scheduledDate = localISODate(date);
  const scheduledTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return { scheduledDate, scheduledTime };
}

function deriveScheduledFromStartTime(startTime) {
  if (!startTime || typeof startTime !== 'string') return null;
  try {
    const d = new Date(startTime);
    if (!Number.isFinite(d.getTime())) return null;
    return {
      scheduledDate: localISODate(d),
      scheduledTime: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    };
  } catch {
    return null;
  }
}

/**
 * @param {Object} input - Raw parse result (e.g. from parseOmniAddInput)
 * @param {string} [originalText] - Original user input; used for regex fallback when input has no startTime
 * @returns {{
 *   type: 'goal'|'calendar_event',
 *   title: string,
 *   isFixed?: boolean,
 *   context?: 'work'|'personal',
 *   recurrence?: { type: 'daily'|'weekly'|'monthly'|'custom', days?: number[] },
 *   energyCost?: number,
 *   startTime?: string,
 *   endTime?: string,
 *   scheduledDate?: string,
 *   scheduledTime?: string,
 * }}
 */
export function normalizeTaskCapture(input, originalText) {
  const raw = input && typeof input === 'object' ? input : {};
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const type = raw.type === 'calendar_event' ? 'calendar_event' : 'goal';

  let scheduledDate;
  let scheduledTime;
  const fromStart = deriveScheduledFromStartTime(raw.startTime);
  if (fromStart) {
    scheduledDate = fromStart.scheduledDate;
    scheduledTime = fromStart.scheduledTime;
  } else if (originalText && typeof originalText === 'string') {
    const parsed = parseScheduledFromText(originalText);
    if (parsed) {
      scheduledDate = parsed.scheduledDate;
      scheduledTime = parsed.scheduledTime;
    }
  }

  const base = {
    type,
    title,
    startTime: typeof raw.startTime === 'string' && raw.startTime ? raw.startTime : undefined,
    endTime: typeof raw.endTime === 'string' && raw.endTime ? raw.endTime : undefined,
    ...(scheduledDate && { scheduledDate }),
    ...(scheduledTime && { scheduledTime }),
  };

  if (type === 'calendar_event') {
    return base;
  }
  const context = raw.context === 'work' ? 'work' : raw.context === 'personal' ? 'personal' : undefined;
  return {
    ...base,
    isFixed: raw.isFixed === true,
    context,
    recurrence: normalizeRecurrence(raw.recurrence),
    energyCost: normalizeEnergyCost(raw.energyCost),
  };
}

/** Build normalized day-plan assignment object from backlog/planner task. */
export function toPlanAssignmentFromTask(task, goal) {
  if (!task?.goalId) return null;
  return {
    goalId: task.goalId,
    title: task.title || goal?.title || 'Task',
    duration: Math.max(15, Number(goal?.estimatedMinutes) || 60),
    ...(task.subtaskId ? { subtaskId: task.subtaskId } : {}),
  };
}
