/**
 * Gemini API bridge for Garden insights.
 * Requires VITE_GEMINI_API_KEY in .env (get key from https://aistudio.google.com/apikey).
 *
 * Analyzes GardenContext logs (and optional weekly plan) to return one short
 * Spirit-style insight or advice.
 */

const DEFAULT_MODEL = 'gemini-1.5-flash';

function getApiKey() {
  return typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY;
}

function formatLogsForPrompt(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return 'No activity logs yet.';
  return logs
    .slice(-30)
    .map((l) => {
      const date = l.date ? new Date(l.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '?';
      const task = l.taskTitle || l.title || 'Focus';
      const mins = l.minutes ?? 0;
      const rating = l.rating != null ? ` (rating: ${l.rating})` : '';
      return `- ${date}: ${task}, ${mins} min${rating}`;
    })
    .join('\n');
}

function formatPlanForPrompt(plan) {
  if (!Array.isArray(plan) || plan.length === 0) return 'No upcoming plan.';
  return plan
    .map((e) => {
      const day = e.day ?? e.dayIndex ?? '?';
      const title = e.title ?? 'Event';
      const type = e.type ?? '—';
      return `- ${day}: ${title} (${type})`;
    })
    .join('\n');
}

const SYSTEM_PROMPT = `You are a Zen Garden Spirit: warm, concise, and slightly witty. You speak in one or two short sentences. No bullet points, no emojis.`;

const USER_PROMPT_TEMPLATE = `Look at this person's activity logs and their upcoming weekly plan.

Activity logs (recent):
{{LOGS}}

Upcoming plan (this week):
{{PLAN}}

Find one hidden pattern (e.g. "You tend to do deep work better in the morning" or "You struggle with focus after back-to-back meetings"). Then give one piece of encouraging, witty advice in the Spirit's voice. Reply with only that advice, nothing else.`;

/**
 * Calls Gemini to get one personalized insight + advice from logs and plan.
 * @param {Array} logs - Activity logs (e.g. from GardenContext)
 * @param {Array} plan - Weekly plan / events (e.g. weeklyEvents)
 * @returns {Promise<string|null>} - Single sentence of advice, or null on error/missing key
 */
export async function getGardenInsights(logs, plan) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

    const logsText = formatLogsForPrompt(logs ?? []);
    const planText = formatPlanForPrompt(plan ?? []);

    const userPrompt = USER_PROMPT_TEMPLATE
      .replace('{{LOGS}}', logsText)
      .replace('{{PLAN}}', planText);

    const prompt = SYSTEM_PROMPT + '\n\n' + userPrompt;
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.();
    if (typeof text === 'string') {
      return text.trim().replace(/\n+/g, ' ').slice(0, 280);
    }
    return null;
  } catch (err) {
    console.warn('Gemini getGardenInsights:', err?.message || err);
    return null;
  }
}

/**
 * Analyze GardenContext logs (and optional plan) via Gemini.
 * Same as getGardenInsights; use this when you only have logs.
 * @param {Array} logs - GardenContext logs (taskTitle, minutes, date, rating, etc.)
 * @param {Array} [plan] - Optional weekly events for context
 * @returns {Promise<string|null>}
 */
export async function analyzeGardenLogs(logs, plan = []) {
  return getGardenInsights(logs, plan);
}
