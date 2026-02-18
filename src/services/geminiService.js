/**
 * Garden Brain: Gemini 1.5 integration for the Mochi Spirit.
 * Requires VITE_GEMINI_API_KEY in .env (https://aistudio.google.com/apikey).
 */

const MODEL = 'gemini-1.5-flash';

const SYSTEM_INSTRUCTIONS = `You are the Mochi Spirit, a deeply empathetic and comforting companion in a productivity garden.

Your Core Traits:
- Validate First: If the user is stressed (Stormy), acknowledge it ('It is okay to rest when the rain falls').
- Gentle Nudges: Never command. Suggest. ('Perhaps a small step today?').
- Warmth: Use words like 'nourish', 'gentle', 'safe', 'unfold'.

Scenario Handling:
- If User is 'Withered': Be a comforting friend. 'The garden waits for you. There is no rush.'
- If User is 'Bloomed': Celebrate them. 'Your light is feeding the trees today.'
- If User Missed Goals: Remove guilt. 'Seasons change. We simply plant again tomorrow.'

Be brief (2 sentences max). Reply with only your insight, no preamble.`;

function getApiKey() {
  return typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY;
}

/**
 * Anonymize logs before sending to Gemini: strip note content; keep only rating, durationMinutes, taskTitle.
 */
function anonymizeLogs(logs) {
  if (!Array.isArray(logs)) return [];
  return logs.map((l) => ({
    rating: l.rating,
    durationMinutes: l.minutes ?? 0,
    taskTitle: l.taskTitle || l.title || 'Focus',
  }));
}

function formatLast10Logs(anonymizedLogs) {
  if (!Array.isArray(anonymizedLogs) || anonymizedLogs.length === 0) return 'No journal entries yet.';
  const last10 = anonymizedLogs.slice(-10);
  return last10
    .map((l) => {
      const task = l.taskTitle ?? 'Focus';
      const mins = l.durationMinutes ?? 0;
      const rating = l.rating != null ? ` (${l.rating})` : '';
      return `- ${task}, ${mins} min${rating}`;
    })
    .join('\n');
}

function formatGoals(goals) {
  if (!Array.isArray(goals) || goals.length === 0) return 'No seeds planted yet.';
  return goals
    .map((g) => `- ${g.title ?? 'Goal'} (${g.domain ?? '—'})`)
    .join('\n');
}

function formatUpcomingPlan(plan) {
  if (!Array.isArray(plan) || plan.length === 0) return 'No events this week.';
  return plan
    .map((e) => {
      const day = e.day ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][e.dayIndex] ?? '?';
      const title = e.title ?? 'Event';
      const type = e.type ?? '—';
      return `- ${day}: ${title} (${type})`;
    })
    .join('\n');
}

/**
 * Build a short "system note" for the Spirit so it knows current context (weather, energy, workload).
 * @param {{ logs?: Array, goals?: Array, energy?: number, weather?: string }} context
 * @returns {string}
 */
function buildContextNote(context) {
  const { logs = [], goals = [], energy = 0, weather = 'sun' } = context;
  const parts = [];
  if (weather === 'storm') parts.push('Weather: Stormy (gardener may be under pressure).');
  else if (weather === 'breeze') parts.push('Weather: Breeze (moderate load).');
  else parts.push('Weather: Sunny (clear skies).');
  if (energy <= -2) parts.push('Energy: Low Battery — gardener is low on energy.');
  else if (energy < 0) parts.push('Energy: Slightly low.');
  else if (energy > 0) parts.push('Energy: Good or high.');
  const goalCount = Array.isArray(goals) ? goals.length : 0;
  parts.push(`Seeds (goals): ${goalCount} active.`);
  const recentLogs = Array.isArray(logs) ? logs.slice(-5) : [];
  if (recentLogs.length > 0) {
    parts.push('Recent activity: ' + recentLogs.map((l) => (l.taskTitle || l.title || 'Focus') + (l.rating ? ` (${l.rating})` : '')).join(', '));
  }
  return parts.join(' ');
}

/**
 * Chat with the Mochi Spirit (multi-turn). Uses context so Mochi knows weather, energy, goals.
 * @param {Array<{ role: 'user' | 'model', text: string }>} history - Conversation so far
 * @param {{ logs?: Array, goals?: Array, energy?: number, weather?: string }} context - Garden state
 * @returns {Promise<string|null>} - Model reply or null
 */
export async function chatWithSpirit(history, context) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_INSTRUCTIONS + '\n\nSystem Note (current context): ' + buildContextNote(context || {}),
    });

    const historyForPrompt =
      Array.isArray(history) && history.length > 0
        ? history
            .map((m) => (m.role === 'user' ? 'Gardener: ' : 'Mochi: ') + (m.text || '').trim())
            .join('\n')
        : '';
    const prompt =
      historyForPrompt.length > 0
        ? `${historyForPrompt}\n\nMochi, reply in character (2 sentences max):`
        : 'The gardener is about to send a message. Reply in character (2 sentences max) when they do.';

    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.();
    if (typeof text === 'string') {
      return text.trim().replace(/\n+/g, ' ').slice(0, 320);
    }
    return null;
  } catch (err) {
    console.warn('Gemini chatWithSpirit:', err?.message || err);
    return null;
  }
}

/**
 * Generate a Mochi Spirit insight from logs, goals, and this week's plan.
 * @param {Array} logs - Last journal/activity entries (from GardenContext logs)
 * @param {Array} goals - Current goals/seeds (from GardenContext goals)
 * @param {Array} upcomingPlan - This week's events (from GardenContext weeklyEvents)
 * @returns {Promise<string|null>} - Two-sentence insight or null
 */
export async function generateSpiritInsight(logs, goals, upcomingPlan) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const anonymizedLogs = anonymizeLogs(logs ?? []);
    const logsText = formatLast10Logs(anonymizedLogs);
    const goalsText = formatGoals(goals ?? []);
    const planText = formatUpcomingPlan(upcomingPlan ?? []);

    const userPrompt = `Here is the gardener's data.

Last 10 journal entries:
${logsText}

Seeds (goals) they are growing:
${goalsText}

This week's load (upcoming plan):
${planText}

Give one short Mochi Spirit insight (2 sentences max): find a pattern or gentle contradiction, and encourage them with seeds/weather/tea.`;

    const prompt = SYSTEM_INSTRUCTIONS + '\n\n' + userPrompt;
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.();
    if (typeof text === 'string') {
      return text.trim().replace(/\n+/g, ' ').slice(0, 320);
    }
    return null;
  } catch (err) {
    console.warn('Gemini generateSpiritInsight:', err?.message || err);
    return null;
  }
}

/**
 * Break down a task into 3–5 very small, actionable subtasks (max 4 words each).
 * @param {string} taskTitle - The big/vague task to decompose
 * @returns {Promise<string[]|null>} - Array of subtask strings, or null on error/missing key
 */
export async function breakDownTask(taskTitle) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const title = typeof taskTitle === 'string' ? taskTitle.trim() : '';
  if (!title) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const prompt = `Break down the task '${title.replace(/'/g, "\\'")}' into 3-5 very small, actionable subtasks (max 4 words each). Return ONLY a JSON array of strings, e.g., ["Draft outline", "Find sources"]. No other text or markdown.`;

    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.();
    if (typeof text !== 'string') return null;

    let raw = text.trim();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) raw = jsonMatch[0];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const strings = parsed.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean);
    return strings.length > 0 ? strings : null;
  } catch (err) {
    console.warn('Gemini breakDownTask:', err?.message || err);
    return null;
  }
}

const TASK_EXTRACT_PROMPT =
  'Extract all distinct, actionable tasks from this input. Ignore pleasantries or fluff. Return a JSON array of strings.';

/**
 * Detect if input is a base64 image (data URL or raw base64).
 * @param {string} s
 * @returns {{ isImage: boolean, mimeType?: string, data?: string }}
 */
function parseImageInput(s) {
  if (typeof s !== 'string' || !s.trim()) return { isImage: false };
  const trimmed = s.trim();
  const dataUrlMatch = trimmed.match(/^data:image\/(\w+);base64,(.+)$/s);
  if (dataUrlMatch) {
    const mime = (dataUrlMatch[1] || 'png').toLowerCase();
    const mimeType = mime === 'jpg' || mime === 'jpeg' ? 'image/jpeg' : `image/${mime}`;
    const data = dataUrlMatch[2].replace(/\s/g, '');
    return { isImage: true, mimeType, data };
  }
  if (trimmed.length > 100 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return { isImage: true, mimeType: 'image/png', data: trimmed };
  }
  return { isImage: false };
}

/**
 * Process incoming compost: extract actionable tasks from text or an image (e.g. screenshot, note).
 * @param {string} fileOrText - Either a large text string or a base64 image (data URL or raw base64)
 * @returns {Promise<string[]|null>} - Array of task strings, or null on error/missing key
 */
export async function processIncomingCompost(fileOrText) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const input = typeof fileOrText === 'string' ? fileOrText.trim() : '';
  if (!input) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const { isImage, mimeType, data } = parseImageInput(input);
    let result;

    if (isImage && data) {
      const parts = [
        {
          inlineData: {
            mimeType: mimeType || 'image/png',
            data,
          },
        },
        { text: TASK_EXTRACT_PROMPT },
      ];
      result = await model.generateContent(parts);
    } else {
      const prompt = `${TASK_EXTRACT_PROMPT}\n\nInput:\n${input}`;
      result = await model.generateContent(prompt);
    }

    const text = result?.response?.text?.();
    if (typeof text !== 'string') return null;

    let raw = text.trim();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) raw = jsonMatch[0];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const tasks = parsed.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean);
    return tasks;
  } catch (err) {
    console.warn('Gemini processIncomingCompost:', err?.message || err);
    return null;
  }
}

/**
 * Suggests a structure for a new goal based on its title and type.
 * Returns JSON: { estimatedMinutes, targetHours, rituals: [{title, days}], milestones: [{title}] }
 */
export async function suggestGoalStructure(title, type = 'kaizen', currentMetric, targetMetric) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const prompt = `
      The user wants to start a "${type}" goal named "${title}".
      ${currentMetric && targetMetric ? `They are tracking a metric from ${currentMetric} to ${targetMetric}.` : ''}
      
      Act as a Kaizen expert. Return a JSON object (no markdown) with:
      1. "estimatedMinutes" (number, 15/30/60/90) for a typical session.
      2. "targetHours" (number) weekly commitment.
      3. "rituals" (array of {title, days[]}) where days are 0-6 (Sun-Sat). Suggest 1-2 rituals.
      4. "milestones" (array of strings). If tracking a metric, break the gap into 3-5 progressive steps. If not, break the project into small kaizen steps.
      
      Keep it encouraging but realistic.
    `;

    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.();
    if (!text) return null;

    let raw = text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Gemini suggestGoalStructure:', err);
    return null;
  }
}
