/**
 * Garden Brain: Gemini integration for the Mochi Spirit.
 * Requires VITE_GEMINI_API_KEY in .env (https://aistudio.google.com/apikey).
 * Optional VITE_GROQ_API_KEY for fallback (https://console.groq.com).
 * Tries Gemini first; on rate limit/failure falls back to Groq (Llama-3).
 */

import { redactUserText } from './redaction.js';

/**
 * Strip ```json / ``` markdown from model output so we can parse JSON safely.
 * @param {string} text - Raw response text
 * @returns {string} Trimmed JSON-ready string
 */
function sanitizeJsonResponse(text) {
  if (typeof text !== 'string') return '';
  let raw = text.trim();
  raw = raw.replace(/^```json\s*/i, '').replace(/\s*```\s*$/g, '').trim();
  return raw;
}

/**
 * Call Groq API (Llama-3) as fallback when Gemini fails.
 * @param {string} prompt - Full user/system prompt
 * @returns {Promise<string>} Raw message content
 */
async function fetchFromGroq(prompt) {
  const groqKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY;
  if (!groqKey) throw new Error('No Groq key available.');

  console.warn('🌿 Mochi is routing request to Groq (Fallback)...');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Groq returned no content');
  return content;
}

const MODELS_TO_TRY = [
  'gemini-1.5-flash-002',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash-001',
  'gemini-1.5-pro-002',
  'gemini-pro',
];
const MODEL = MODELS_TO_TRY[0];

/**
 * Try generating content across all models in MODELS_TO_TRY.
 * Falls through to the next model on 404/429/model-not-found errors.
 * @param {object} genAI - GoogleGenerativeAI instance
 * @param {string|Array} content - prompt string or multipart content array
 * @param {object} opts - extra options passed to getGenerativeModel (e.g. systemInstruction)
 */
async function tryGenerate(genAI, content, opts = {}) {
  let lastErr;
  for (const modelName of MODELS_TO_TRY) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, ...opts });
      const result = await model.generateContent(content);
      return result;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message ?? '').toLowerCase();
      const isModelErr = msg.includes('404') || msg.includes('not found') || msg.includes('429') || msg.includes('quota') || msg.includes('deprecated');
      if (!isModelErr) throw err;
    }
  }
  throw lastErr;
}

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
 * User messages are redacted (PII) before sending; only user input is redacted, not assistant output.
 * @param {Array<{ role: 'user' | 'model', text: string }>} history - Conversation so far
 * @param {{ logs?: Array, goals?: Array, energy?: number, weather?: string }} context - Garden state
 * @returns {Promise<{ text: string, meta?: { redactionCount: number } }|null>} - Reply and optional meta, or null
 */
export async function chatWithSpirit(history, context) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    let totalRedactions = 0;
    const historyForPrompt =
      Array.isArray(history) && history.length > 0
        ? history
            .map((m) => {
              if (m.role === 'user') {
                const { redactedText, redactionCount } = redactUserText((m.text || '').trim());
                totalRedactions += redactionCount;
                return 'Gardener: ' + redactedText;
              }
              return 'Mochi: ' + (m.text || '').trim();
            })
            .join('\n')
        : '';
    const prompt =
      historyForPrompt.length > 0
        ? `${historyForPrompt}\n\nMochi, reply in character (2 sentences max):`
        : 'The gardener is about to send a message. Reply in character (2 sentences max) when they do.';

    const result = await tryGenerate(genAI, prompt, {
      systemInstruction: SYSTEM_INSTRUCTIONS + '\n\nSystem Note (current context): ' + buildContextNote(context || {}),
    });
    const text = result?.response?.text?.();
    if (typeof text === 'string') {
      const reply = text.trim().replace(/\n+/g, ' ').slice(0, 320);
      const meta = totalRedactions > 0 ? { redactionCount: totalRedactions } : undefined;
      return { text: reply, ...(meta && { meta }) };
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
    const result = await tryGenerate(genAI, prompt);
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

    const prompt = `Break down the task '${title.replace(/'/g, "\\'")}' into 3-5 very small, actionable subtasks (max 4 words each). Return ONLY a JSON array of strings, e.g., ["Draft outline", "Find sources"]. No other text or markdown.`;

    const result = await tryGenerate(genAI, prompt);
    const text = result?.response?.text?.();
    if (typeof text !== 'string') return null;

    let raw = sanitizeJsonResponse(text);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) raw = jsonMatch[0];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const strings = parsed.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean);
    return strings.length > 0 ? strings : null;
  } catch (err) {
    console.warn('Gemini breakDownTask failed, trying Groq:', err?.message || err);
    try {
      const prompt = `Break down the task '${title.replace(/'/g, "\\'")}' into 3-5 very small, actionable subtasks (max 4 words each). Return ONLY a JSON array of strings, e.g., ["Draft outline", "Find sources"]. No other text or markdown.`;
      const groqText = await fetchFromGroq(prompt);
      let raw = sanitizeJsonResponse(groqText);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) raw = jsonMatch[0];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      const strings = parsed.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean);
      return strings.length > 0 ? strings : null;
    } catch (groqErr) {
      console.warn('Groq breakDownTask fallback failed:', groqErr?.message || groqErr);
      return null;
    }
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

    const { isImage, mimeType, data } = parseImageInput(input);
    let result;

    if (isImage && data) {
      const parts = [
        { inlineData: { mimeType: mimeType || 'image/png', data } },
        { text: TASK_EXTRACT_PROMPT },
      ];
      result = await tryGenerate(genAI, parts);
    } else {
      const prompt = `${TASK_EXTRACT_PROMPT}\n\nInput:\n${input}`;
      result = await tryGenerate(genAI, prompt);
    }

    const text = result?.response?.text?.();
    if (typeof text !== 'string') return null;

    let raw = sanitizeJsonResponse(text);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) raw = jsonMatch[0];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const tasks = parsed.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean);
    return tasks;
  } catch (err) {
    console.warn('Gemini processIncomingCompost failed:', err?.message || err);
    const prompt = `${TASK_EXTRACT_PROMPT}\n\nInput:\n${input}`;
    if (!parseImageInput(input).isImage) {
      try {
        const groqText = await fetchFromGroq(prompt);
        let raw = sanitizeJsonResponse(groqText);
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) raw = jsonMatch[0];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        const tasks = parsed.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean);
        return tasks;
      } catch (groqErr) {
        console.warn('Groq processIncomingCompost fallback failed:', groqErr?.message || groqErr);
      }
    }
    return null;
  }
}

export async function suggestGoalStructure(title, type = 'kaizen', currentMetric, targetMetric) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("Missing API Key");
    return null;
  }

  const isRoutine = type === 'routine';

  const prompt = isRoutine
    ? `
      Act as a Kaizen productivity coach for recurring habits.
      User Routine: "${title}".

      This is a recurring habit/routine (not a project). Suggest a plan in strict JSON (no markdown).

      Requirements:
      1. "strategy": One sentence on how to build this habit sustainably.
      2. "vines": Array of 3-5 small setup tasks to get started (e.g. "Buy equipment", "Block calendar time", "Prepare workspace").
      3. "rituals": 1-2 recurring schedules with a descriptive name and days 0-6 (0=Sun). Use names like "Morning Session", "Evening Wind Down", "Sunday Reset", etc.
      4. "estimatedMinutes": Typical session length (15, 30, 45, 60, 90).
      5. "targetHours": Weekly hour commitment (integer).
      6. "suggestedMetrics": 1-3 measurable metrics. Each: { "name": string, "unit": string, "direction": "higher"|"lower" }.

      Example for "Daily Meditation":
      {
        "strategy": "Start with just 5 minutes and build up gradually.",
        "vines": ["Download a meditation app", "Set a morning alarm 10 min early", "Find a quiet spot"],
        "estimatedMinutes": 15,
        "targetHours": 3,
        "rituals": [{"title": "Morning Session", "days": [1, 2, 3, 4, 5]}, {"title": "Sunday Reset", "days": [0]}],
        "suggestedMetrics": [{"name": "Session streak", "unit": "days", "direction": "higher"}, {"name": "Session duration", "unit": "min", "direction": "higher"}]
      }
    `
    : `
      Act as a Kaizen productivity coach.
      User Goal: "${title}" (${type}).
      ${currentMetric ? `Current: ${currentMetric}, Target: ${targetMetric}` : ''}

      Create a comprehensive plan in strict JSON format (no markdown).

      Requirements:
      1. "strategy": One sentence of strategic advice.
      2. "vines": Array of 3-5 small, immediate subtasks (e.g. "Buy shoes", "Download app").
      3. "rituals": 1-2 recurring habits (title + days 0-6).
      4. "milestones": EXACTLY 4 progressive milestones.
      5. "estimatedMinutes": Session duration (15, 30, 45, 60).
      6. "targetHours": Weekly goal (integer).
      7. "suggestedMetrics": 1-3 measurable metrics to track progress. Each: { "name": string, "unit": string, "direction": "higher"|"lower" }.

      Example Output:
      {
        "strategy": "Focus on consistency before intensity.",
        "vines": ["Research gear", "Clear schedule", "First 10m walk"],
        "estimatedMinutes": 45,
        "targetHours": 5,
        "rituals": [{"title": "Morning Run", "days": [1, 3, 5]}],
        "milestones": ["Week 1: Walk 5k", "Week 4: Run 2k continuous", "Week 8: Run 5k", "Week 12: Run 10k"],
        "suggestedMetrics": [{"name": "Distance", "unit": "km", "direction": "higher"}, {"name": "Weight", "unit": "kg", "direction": "lower"}]
      }
    `;

  const safeFallback = () => ({
    _fallback: true,
    _reason: 'gemini_and_groq_failed',
    strategy: 'Start small, stay consistent.',
    vines: ['Research the basics', 'Set aside 15 minutes tomorrow', 'Track your first session'],
    estimatedMinutes: 30,
    targetHours: 3,
    rituals: [{ title: 'Daily Practice', days: [1, 3, 5] }],
    milestones: ['Complete first session', 'Build a 1-week streak', 'Reflect and adjust', 'Reach your first milestone'],
    suggestedMetrics: [{ name: 'Sessions completed', unit: 'count', direction: 'higher' }],
  });

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await tryGenerate(genAI, prompt);
    const text = result?.response?.text?.();
    if (!text) throw new Error('Empty response');
    const cleanJson = sanitizeJsonResponse(text);
    return JSON.parse(cleanJson);
  } catch (geminiErr) {
    console.warn('Gemini suggestGoalStructure failed, trying Groq fallback:', geminiErr?.message || geminiErr);
    try {
      const groqText = await fetchFromGroq(prompt);
      const cleanJson = sanitizeJsonResponse(groqText);
      return JSON.parse(cleanJson);
    } catch (groqErr) {
      console.error('Groq fallback also failed:', groqErr?.message || groqErr);
      return safeFallback();
    }
  }
}

/**
 * AI Weekly Planner: distributes goals across Mon-Sun based on targets, rituals, and energy.
 * Returns { monday: [{ goalId, hours }], tuesday: [...], ... }
 */
export async function generateWeeklyPlan(goals, calendarEvents = [], energyProfile = {}) {
  const apiKey = getApiKey();
  if (!apiKey) { console.error("Missing API Key"); return null; }

  const routineGoals = goals.filter((g) => g.type === 'routine' || g.type === 'kaizen');
  if (routineGoals.length === 0) return null;

  const goalSummaries = routineGoals.map((g) => ({
    id: g.id,
    title: g.title,
    type: g.type,
    targetHours: g.targetHours ?? 5,
    ritualDays: (g.rituals ?? []).flatMap((r) => r.days ?? []),
    estimatedMinutes: g.estimatedMinutes ?? 60,
    energyType: g.energyType ?? 'maintenance',
  }));

  const eventSummary = (calendarEvents ?? []).slice(0, 20).map((e) => {
    const start = e.start ? new Date(e.start) : null;
    return start ? `${start.toLocaleDateString('en-US', { weekday: 'short' })} ${start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : '';
  }).filter(Boolean).join('; ');

  const spoons = energyProfile.spoonCount ?? 8;

  const prompt = `
Act as a Kaizen weekly planner. Distribute these goals across Mon-Sun.

Goals (JSON):
${JSON.stringify(goalSummaries, null, 2)}

Calendar (busy times): ${eventSummary || 'None'}
Energy level: ${spoons} spoons out of 12 (${spoons <= 4 ? 'low' : spoons >= 9 ? 'high' : 'normal'} energy).

Rules:
- Respect ritualDays: if a goal has ritualDays [1,3,5] (Mon=1, Sun=0), schedule it on those days.
- Total hours per goal across the week should roughly match targetHours.
- Max ${Math.min(spoons, 10)} hours of work per day.
- High-focus tasks in the morning, lighter tasks in the afternoon.
- Leave at least 1 day lighter for rest.

Return strict JSON (no markdown):
{
  "monday": [{ "goalId": "...", "hours": 2 }],
  "tuesday": [...],
  "wednesday": [...],
  "thursday": [...],
  "friday": [...],
  "saturday": [...],
  "sunday": [...]
}
`;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await tryGenerate(genAI, prompt);
    const text = result?.response?.text?.();
    if (!text) throw new Error('Empty response');
    const clean = sanitizeJsonResponse(text);
    return JSON.parse(clean);
  } catch (err) {
    console.warn('Gemini generateWeeklyPlan failed, trying Groq:', err?.message || err);
    try {
      const groqText = await fetchFromGroq(prompt);
      const clean = sanitizeJsonResponse(groqText);
      return JSON.parse(clean);
    } catch (groqErr) {
      console.error('Groq generateWeeklyPlan fallback failed:', groqErr?.message || groqErr);
      return null;
    }
  }
}

/**
 * AI Monthly Planner: creates a high-level roadmap for the month.
 * Returns { summary, weeks: [{ focus, goals: { goalId: hours } }] }
 */
export async function generateMonthlyPlan(goals, monthIndex, year) {
  const apiKey = getApiKey();
  if (!apiKey) { console.error("Missing API Key"); return null; }

  const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][monthIndex];
  const goalSummaries = goals.filter((g) => g.type === 'routine' || g.type === 'kaizen').map((g) => ({
    id: g.id,
    title: g.title,
    type: g.type,
    weeklyTargetHours: g.targetHours ?? 5,
    monthlyTarget: g.schedulerSettings?.monthlyTarget ?? null,
    milestones: (g.milestones ?? []).filter((m) => !m.completed).map((m) => m.title).slice(0, 4),
  }));

  if (goalSummaries.length === 0) return null;

  const prompt = `
Act as a Kaizen monthly planner for ${monthName} ${year}.

Goals:
${JSON.stringify(goalSummaries, null, 2)}

Create a 4-week roadmap. For each week, specify which goals to focus on and hour targets.
Consider milestones and suggest when to aim for them.

Return strict JSON (no markdown):
{
  "summary": "Brief 1-sentence month overview",
  "weeks": [
    { "focus": "Description of week focus", "goals": { "goalId": hoursTarget, ... } },
    { "focus": "...", "goals": { ... } },
    { "focus": "...", "goals": { ... } },
    { "focus": "...", "goals": { ... } }
  ]
}
`;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await tryGenerate(genAI, prompt);
    const text = result?.response?.text?.();
    if (!text) throw new Error('Empty response');
    const clean = sanitizeJsonResponse(text);
    return JSON.parse(clean);
  } catch (err) {
    console.warn('Gemini generateMonthlyPlan failed, trying Groq:', err?.message || err);
    try {
      const groqText = await fetchFromGroq(prompt);
      const clean = sanitizeJsonResponse(groqText);
      return JSON.parse(clean);
    } catch (groqErr) {
      console.error('Groq generateMonthlyPlan fallback failed:', groqErr?.message || groqErr);
      return null;
    }
  }
}

/**
 * AI Project Planner: slices a project into phases, milestones, and tasks with a timeline.
 * @param {string} projectName
 * @param {string|null} deadline - ISO date string or null
 * @param {string} description - optional project description
 * @param {Array} existingGoals - existing goals that could be linked
 * @returns {{ summary, phases: [{ title, weekRange, tasks: [{ title, estimatedHours, type }], milestone }], suggestedLinks: [{ taskTitle, goalId, goalTitle }] }}
 */
export async function sliceProject(projectName, deadline, description = '', existingGoals = []) {
  const apiKey = getApiKey();
  if (!apiKey) { console.error("Missing API Key"); return null; }

  const deadlineStr = deadline ? `Deadline: ${deadline}.` : 'No hard deadline — suggest a reasonable timeline.';
  const goalList = existingGoals.slice(0, 15).map((g) => `${g.id}: "${g.title}" (${g.type})`).join('\n');

  const prompt = `
Act as a Kaizen project planner. Break this project into manageable phases.

Project: "${projectName}"
${description ? `Description: ${description}` : ''}
${deadlineStr}

Existing goals the user already has:
${goalList || 'None yet.'}

Return strict JSON (no markdown):
{
  "summary": "1-sentence project overview",
  "totalWeeks": number,
  "phases": [
    {
      "title": "Phase name",
      "weekRange": "Week 1-2",
      "tasks": [
        { "title": "Task name", "estimatedHours": 5, "type": "kaizen" }
      ],
      "milestone": "What success looks like at the end of this phase"
    }
  ],
  "suggestedLinks": [
    { "taskTitle": "A task that maps to an existing goal", "goalId": "id-from-list", "goalTitle": "title" }
  ]
}

Guidelines:
- Break into 3-6 phases.
- Each phase has 2-5 concrete tasks.
- Tasks should be small enough to finish in 1-2 weeks.
- If a task maps to an existing goal, include it in suggestedLinks.
- "type" should be "kaizen" for project work or "routine" for recurring support tasks.
`;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await tryGenerate(genAI, prompt);
    const text = result?.response?.text?.();
    if (!text) throw new Error('Empty response');
    const clean = sanitizeJsonResponse(text);
    return JSON.parse(clean);
  } catch (err) {
    console.warn('Gemini sliceProject failed, trying Groq:', err?.message || err);
    try {
      const groqText = await fetchFromGroq(prompt);
      const clean = sanitizeJsonResponse(groqText);
      return JSON.parse(clean);
    } catch (groqErr) {
      console.error('Groq sliceProject fallback failed:', groqErr?.message || groqErr);
      return null;
    }
  }
}
