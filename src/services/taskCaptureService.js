/**
 * Normalize free-form capture payloads from multiple entry points into one shape
 * consumed by GardenDashboard, OmniAdd, and the command palette.
 */

import { localISODate } from './dateUtils';
import { isLikelyCalendarEventTitle, isLikelyScheduledTaskTitle } from './calendarEventClassifier';

const TASK_VERB_REGEX = /\b(email|call|text|book|buy|pay|send|draft|finish|write|review|fix|clean|order|reply|follow up|submit|ship|record|schedule|cancel|renew|pick up|drop off|update|plan|get|need)\b/i;
const PROJECT_REGEX = /\b(project|launch|roadmap|migration|redesign|website|app|feature|campaign|rollout|plan .* project|build .* app|build .* site|decompose|strategy)\b/i;
const HABIT_REGEX = /\b(habit|routine|daily|weekly|every day|every morning|every evening|every night|every week|each week|\d+\s*x\s*(?:a|per)?\s*week)\b/i;
const SOMEDAY_REGEX = /\b(someday|maybe later|for later|one day|eventually|someday maybe|later maybe)\b/i;
const NOTE_REGEX = /\b(note|idea|brain dump|thought|remember|journal|reflection|brainstorm)\b/i;
const INCUBATE_REGEX = /\b(inbox|triage|incubate|parking lot|hold for later|not now)\b/i;
const SOCIAL_REGEX = /\b(reply to|reply|follow up|text back|message|group chat|check family group|reach out|friend check-in|call mom|call dad|call friend)\b/i;
const LIFE_DOMAIN_REGEX = /\b(help me keep|stay on top of|social life|home upkeep|health admin|finances|life admin|errands|logistics|partner connection|pets)\b/i;
const LISTISH_REGEX = /\b(ideas|tasks|things|notes)\b|,|\/|\s+and\s+/i;
const LOCATION_REGEX = /\b(?:at|@)\s+([A-Z][\w' -]+(?:'s)?(?:\s+[A-Z][\w' -]+)*)/;
const PARTICIPANT_REGEX = /\b(with|w\/)\s+([A-Z][\w' -]+(?:\s+[A-Z][\w' -]+)*)/i;
const WAITING_FOR_REGEX = /\b(waiting for|blocked on|pending|awaiting)\b/i;

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

function deriveRecurrenceFromText(text) {
  const lower = String(text || '').trim().toLowerCase();
  if (!lower) return undefined;
  if (/\b(daily|every day|every morning|every evening|every night)\b/.test(lower)) return { type: 'daily' };
  if (/\b(monthly|every month)\b/.test(lower)) return { type: 'monthly' };
  if (/\b(weekly|every week|each week|\d+\s*x\s*(?:a|per)?\s*week)\b/.test(lower)) return { type: 'weekly', days: [] };
  return undefined;
}

/**
 * Try to parse a date/time from raw text.
 * Supports: "tomorrow at 3pm", "next tuesday", "friday 14:00", "today at 5pm".
 * Returns date-only when no explicit time is present.
 * @param {string} text
 * @returns {{ scheduledDate?: string, scheduledTime?: string } | null}
 */
export function parseScheduledFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.trim().toLowerCase();
  const now = new Date();
  let date = new Date(now);
  let hasDate = false;
  let hours = 9;
  let minutes = 0;
  let hasExplicitTime = false;

  const dayMatch = lower.match(/\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (dayMatch) {
    hasDate = true;
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

  const timeWithColon = lower.match(/\b(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
  const timeWithAmPm = lower.match(/\b(?:at\s+)?(\d{1,2})\s*(am|pm)\b/i);
  const timeWithAt = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/i);
  const timeMatch = timeWithColon || timeWithAmPm || timeWithAt;

  if (timeMatch) {
    hasExplicitTime = true;
    hours = parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = (timeMatch[3] || '').toLowerCase();
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    hours = Math.max(0, Math.min(23, hours));
    minutes = Math.max(0, Math.min(59, minutes));
  }

  if (!hasDate && !hasExplicitTime) return null;
  if (hasExplicitTime) {
    date.setHours(hours, minutes, 0, 0);
  }

  return {
    scheduledDate: localISODate(date),
    ...(hasExplicitTime
      ? { scheduledTime: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` }
      : {}),
  };
}

function parseLocationAndParticipants(text) {
  if (!text || typeof text !== 'string') return {};
  const locationMatch = text.match(LOCATION_REGEX);
  const participantsMatch = text.match(PARTICIPANT_REGEX);
  return {
    ...(locationMatch?.[1] ? { location: locationMatch[1].trim() } : {}),
    ...(participantsMatch?.[2] ? { participants: [participantsMatch[2].trim()] } : {}),
  };
}

function parseWaitingSupport(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  if (!WAITING_FOR_REGEX.test(lower)) return null;
  const waitingType = /\b(reply|response|person|client|from)\b/.test(lower)
    ? 'person'
    : /\b(document|file|form|paperwork|invoice)\b/.test(lower)
      ? 'document'
      : /\bdecision|approval|sign off|sign-off\b/.test(lower)
        ? 'decision'
        : 'other';
  const parsed = parseScheduledFromText(text);
  return {
    waitingType,
    waitingOn: text.replace(/^.*?(waiting for|blocked on|pending|awaiting)\s*/i, '').trim().slice(0, 80),
    holdUntil: parsed?.scheduledDate ?? null,
    followUpDate: parsed?.scheduledDate ?? null,
    note: 'Captured as waiting-for item.',
  };
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

function toLegacyType(captureKind) {
  return captureKind === 'calendar_event' ? 'calendar_event' : 'goal';
}

function getRouteForCaptureKind(captureKind) {
  switch (captureKind) {
    case 'social_followup':
      return 'social_bucket';
    case 'project':
      return 'project_planner';
    case 'life_domain':
      return 'life_domains';
    case 'calendar_event':
      return 'schedule_event';
    case 'note':
    case 'someday':
    case 'compost':
      return 'inbox';
    case 'habit':
    case 'task':
    case 'scheduled_item':
    default:
      return 'quick_goal';
  }
}

function getConfirmationLabel(captureKind) {
  switch (captureKind) {
    case 'project':
      return 'Open project planner';
    case 'life_domain':
      return 'Create support domain';
    case 'habit':
      return 'Add habit';
    case 'calendar_event':
      return 'Add event';
    case 'scheduled_item':
      return 'Add scheduled task';
    case 'someday':
      return 'Save for later';
    case 'note':
      return 'Send to inbox';
    case 'compost':
      return 'Incubate in inbox';
    case 'social_followup':
      return 'Add to social follow-up';
    case 'task':
    default:
      return 'Add task';
  }
}

function inferCaptureKind({ raw, text, title, recurrence, scheduledDate, scheduledTime }) {
  const lower = String(text || title || '').trim().toLowerCase();
  const aiType = raw?.type === 'calendar_event' ? 'calendar_event' : raw?.type === 'task' ? 'task' : 'goal';
  const hasSchedule = Boolean(scheduledDate || scheduledTime || raw?.startTime || raw?.endTime);
  const looksProject = PROJECT_REGEX.test(lower);
  const looksHabit = Boolean(recurrence) || HABIT_REGEX.test(lower);
  const looksSomeday = SOMEDAY_REGEX.test(lower);
  const looksNote = NOTE_REGEX.test(lower);
  const looksIncubate = INCUBATE_REGEX.test(lower);
  const looksListish = LISTISH_REGEX.test(lower);
  const looksTask = TASK_VERB_REGEX.test(lower);
  const looksSocial = SOCIAL_REGEX.test(lower);
  const looksLifeDomain = LIFE_DOMAIN_REGEX.test(lower);
  const looksEvent = isLikelyCalendarEventTitle(title || text);
  const looksScheduledTask = isLikelyScheduledTaskTitle(title || text);

  if (hasSchedule) {
    if ((looksEvent || aiType === 'calendar_event') && !looksScheduledTask) {
      return { captureKind: 'calendar_event', confidence: looksEvent ? 'high' : 'medium' };
    }
    return { captureKind: 'scheduled_item', confidence: scheduledTime ? 'high' : 'medium' };
  }

  if (looksProject) return { captureKind: 'project', confidence: 'high' };
  if (looksLifeDomain) return { captureKind: 'life_domain', confidence: 'high' };
  if (looksHabit) return { captureKind: 'habit', confidence: recurrence ? 'high' : 'medium' };
  if (looksSocial) return { captureKind: 'social_followup', confidence: 'high' };
  if (looksIncubate) return { captureKind: 'compost', confidence: 'high' };
  if (looksSomeday) return { captureKind: 'someday', confidence: 'high' };
  if (looksNote) return { captureKind: 'note', confidence: 'high' };
  if (!looksTask && looksListish) return { captureKind: 'note', confidence: 'low' };
  if (aiType === 'task' || looksTask) return { captureKind: 'task', confidence: looksTask ? 'high' : 'medium' };
  return { captureKind: 'task', confidence: 'medium' };
}

function normalizeCaptureKind(rawKind) {
  return ['task', 'habit', 'project', 'someday', 'note', 'scheduled_item', 'calendar_event', 'compost', 'social_followup', 'life_domain'].includes(rawKind)
    ? rawKind
    : null;
}

/**
 * @param {Object} input - Raw parse result (e.g. from parseOmniAddInput)
 * @param {string} [originalText] - Original user input
 * @returns {{
 *   type: 'goal'|'calendar_event',
 *   title: string,
 *   captureKind: 'task'|'habit'|'project'|'someday'|'note'|'scheduled_item'|'calendar_event'|'social_followup',
 *   route: 'quick_goal'|'project_planner'|'schedule_event'|'inbox'|'social_bucket',
 *   confirmationLabel: string,
 *   confidence: 'high'|'medium'|'low',
 *   isAmbiguous: boolean,
 *   rawText?: string,
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
  const title = typeof raw.title === 'string' ? raw.title.trim() : String(originalText || '').trim();
  const parsedFromText = originalText && typeof originalText === 'string' ? parseScheduledFromText(originalText) : null;
  const derivedFromStart = !parsedFromText ? deriveScheduledFromStartTime(raw.startTime) : null;
  const recurrence = normalizeRecurrence(raw.recurrence) ?? deriveRecurrenceFromText(originalText);

  const scheduledDate = parsedFromText?.scheduledDate ?? derivedFromStart?.scheduledDate;
  const scheduledTime = parsedFromText?.scheduledTime ?? derivedFromStart?.scheduledTime;
  const startTime = parsedFromText?.scheduledTime
    ? (typeof raw.startTime === 'string' && raw.startTime ? raw.startTime : undefined)
    : undefined;
  const endTime = parsedFromText?.scheduledTime
    ? (typeof raw.endTime === 'string' && raw.endTime ? raw.endTime : undefined)
    : undefined;

  const explicitCaptureKind = normalizeCaptureKind(raw.captureKind);
  const inferred = explicitCaptureKind
    ? { captureKind: explicitCaptureKind, confidence: raw.confidence ?? 'high' }
    : inferCaptureKind({
        raw,
        text: originalText,
        title,
        recurrence,
        scheduledDate,
        scheduledTime,
      });
  const captureKind = inferred.captureKind;
  const confidence = inferred.confidence;
  const route = getRouteForCaptureKind(captureKind);
  const resolvedRoute = confidence === 'low' ? 'inbox' : route;
  const context = raw.context === 'work' ? 'work' : raw.context === 'personal' ? 'personal' : undefined;
  const parsedContext = parseLocationAndParticipants(originalText || title);
  const waitingSupport = parseWaitingSupport(originalText || title);

  return {
    type: toLegacyType(captureKind),
    title: title || 'New capture',
    captureKind,
    route: resolvedRoute,
    confidence,
    isAmbiguous: confidence === 'low',
    confirmationLabel: getConfirmationLabel(captureKind),
    rawText: typeof originalText === 'string' ? originalText : title,
    isFixed: raw.isFixed === true,
    context,
    recurrence,
    energyCost: normalizeEnergyCost(raw.energyCost),
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    ...(scheduledDate ? { scheduledDate } : {}),
    ...(scheduledTime ? { scheduledTime } : {}),
    ...(typeof raw.location === 'string' && raw.location.trim() ? { location: raw.location.trim() } : parsedContext.location ? { location: parsedContext.location } : {}),
    ...(Array.isArray(raw.participants) && raw.participants.length > 0 ? { participants: raw.participants } : parsedContext.participants ? { participants: parsedContext.participants } : {}),
    ...(waitingSupport ? { waitingSupport } : {}),
  };
}

export function overrideCaptureClassification(capture, nextCaptureKind) {
  const base = capture && typeof capture === 'object' ? capture : {};
  const captureKind = nextCaptureKind === 'calendar_event'
    ? 'calendar_event'
    : nextCaptureKind === 'scheduled_item'
      ? 'scheduled_item'
      : nextCaptureKind === 'project'
        ? 'project'
        : nextCaptureKind === 'habit'
          ? 'habit'
          : nextCaptureKind === 'social_followup'
            ? 'social_followup'
          : nextCaptureKind === 'life_domain'
            ? 'life_domain'
          : nextCaptureKind === 'someday'
            ? 'someday'
            : nextCaptureKind === 'note'
              ? 'note'
              : 'task';
  const recurrence = captureKind === 'habit'
    ? base.recurrence ?? { type: 'weekly', days: [] }
    : base.recurrence;

  return {
    ...base,
    type: toLegacyType(captureKind),
    captureKind,
    route: getRouteForCaptureKind(captureKind),
    confirmationLabel: getConfirmationLabel(captureKind),
    confidence: 'high',
    isAmbiguous: false,
    recurrence,
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
