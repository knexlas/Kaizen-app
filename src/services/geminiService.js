/**
 * Garden Brain: Gemini integration for the Mochi Spirit.
 * Requires VITE_GEMINI_API_KEY in .env (https://aistudio.google.com/apikey).
 * Optional VITE_GROQ_API_KEY for fallback (https://console.groq.com).
 * Tries Gemini first; on rate limit/failure falls back to Groq (Llama-3).
 *
 * Model IDs are checked once per day; if the current models return 404/400,
 * the service switches to working models and persists them (localStorage).
 */

import { redactUserText } from './redaction.js';

const AI_MODEL_CONFIG_KEY = 'kaizen_ai_model_config';
const DEFAULT_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_FALLBACK_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama-3.1-70b-versatile',
];

function getTodayString() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function getModelConfig() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(AI_MODEL_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.geminiModels && parsed.geminiModels.includes('gemini-pro')) return null;
    return {
      geminiModels: Array.isArray(parsed.geminiModels) && parsed.geminiModels.length > 0
        ? parsed.geminiModels
        : DEFAULT_GEMINI_MODELS,
      groqModel: typeof parsed.groqModel === 'string' && parsed.groqModel
        ? parsed.groqModel
        : DEFAULT_GROQ_MODEL,
      lastCheck: typeof parsed.lastCheck === 'string' ? parsed.lastCheck : '',
    };
  } catch (_) {
    return null;
  }
}

function setModelConfig(config) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(AI_MODEL_CONFIG_KEY, JSON.stringify({
      geminiModels: config.geminiModels || DEFAULT_GEMINI_MODELS,
      groqModel: config.groqModel || DEFAULT_GROQ_MODEL,
      lastCheck: config.lastCheck || getTodayString(),
    }));
  } catch (_) {}
}

function getGeminiModelsToTry() {
  const config = getModelConfig();
  return config ? config.geminiModels : DEFAULT_GEMINI_MODELS;
}

function getGroqModel() {
  const config = getModelConfig();
  return config ? config.groqModel : DEFAULT_GROQ_MODEL;
}

let modelCheckPromise = null;

/**
 * Run once per day: probe Gemini and Groq with current models; if they return
 * 404/400, try fallbacks and persist working model IDs so the app stays usable.
 */
export async function ensureModelCheckDone() {
  const today = getTodayString();
  const config = getModelConfig();
  if (config && config.lastCheck === today) return;

  if (modelCheckPromise) return modelCheckPromise;
  modelCheckPromise = (async () => {
    const next = {
      geminiModels: getGeminiModelsToTry(),
      groqModel: getGroqModel(),
      lastCheck: today,
    };

    const apiKey = getApiKey();
    if (apiKey) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        for (let i = 0; i < next.geminiModels.length; i++) {
          const modelId = next.geminiModels[i];
          try {
            const model = genAI.getGenerativeModel({ model: modelId });
            await model.generateContent('Hi');
            next.geminiModels = next.geminiModels.slice(i).concat(next.geminiModels.slice(0, i));
            break;
          } catch (e) {
            const msg = String(e?.message ?? '').toLowerCase();
            if (msg.includes('404') || msg.includes('not found') || msg.includes('429') || msg.includes('quota') || msg.includes('deprecated')) continue;
            break;
          }
        }
      } catch (_) {}
    }

    const groqKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY;
    if (groqKey) {
      let groqOk = false;
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: next.groqModel,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 2,
          }),
        });
        groqOk = res.ok;
      } catch (_) {}
      if (!groqOk) {
        try {
          const listRes = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${groqKey}` },
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            const ids = (listData?.data || []).map((m) => m?.id).filter(Boolean);
            for (const id of GROQ_FALLBACK_MODELS) {
              if (ids.includes(id)) {
                const tryRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${groqKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: id,
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 2,
                  }),
                });
                if (tryRes.ok) {
                  next.groqModel = id;
                  break;
                }
              }
            }
          }
        } catch (_) {}
      }
    }

    setModelConfig(next);
    modelCheckPromise = null;
  })();
  return modelCheckPromise;
}

/**
 * Strip ```json / ``` markdown from model output so we can parse JSON safely.
 * @param {string} text - Raw response text
 * @returns {string} Trimmed JSON-ready string
 */
function sanitizeJsonResponse(text) {
  if (typeof text !== 'string') return '';
  let raw = text.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/g, '').trim();
  return raw;
}

/**
 * Call Groq API (Llama-3) as fallback when Gemini fails.
 * @param {string} prompt - Full user/system prompt
 * @returns {Promise<string>} Raw message content
 */
async function fetchFromGroq(prompt) {
  await ensureModelCheckDone();
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
      model: getGroqModel(),
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

/**
 * Try generating content across all models in config (or defaults).
 * Falls through to the next model on 404/429/model-not-found errors.
 * @param {object} genAI - GoogleGenerativeAI instance
 * @param {string|Array} content - prompt string or multipart content array
 * @param {object} opts - extra options passed to getGenerativeModel (e.g. systemInstruction)
 */
async function tryGenerate(genAI, content, opts = {}) {
  await ensureModelCheckDone();
  const modelsToTry = getGeminiModelsToTry();
  let lastErr;
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, ...opts });
      const result = await model.generateContent(content);
      return result;
    } catch (err) {
      console.warn(`Model ${modelName} failed:`, err?.message);
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
  else if (weather === 'leaf') parts.push('Weather: Breeze (moderate load).');
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
 * Chat with the Mochi Spirit (multi-turn). Plain-text completion, no JSON parsing.
 * Tries Groq first (fast), then Gemini. Returns a short reply so the chat actually works.
 * @param {Array<{ role: 'user' | 'model', text: string }>} history - Conversation so far
 * @param {{ logs?: Array, goals?: Array, energy?: number, weather?: string }} context - Garden state
 * @returns {Promise<{ text: string }|null>} - Reply text, or null
 */
export async function chatWithSpirit(history, context) {
  const groqKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY;
  const contextNote = buildContextNote(context || {});

  const messages = [
    {
      role: 'system',
      content: 'You are Mochi, a gentle, brief, and encouraging garden spirit. Answer in 1-2 short sentences.' + (contextNote ? ` Context: ${contextNote}` : ''),
    },
    ...(Array.isArray(history) && history.length > 0
      ? history.map((h) => ({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: (h.text || '').trim() || '(no text)',
        }))
      : []),
  ].filter((m) => m.content && m.content !== '(no text)');

  try {
    if (groqKey) {
      const model = getGroqModel();
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
        }),
      });
      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        const text = String(data.choices[0].message.content).trim().replace(/\n+/g, ' ').slice(0, 320);
        return { text };
      }
    }
  } catch (err) {
    console.error('Chat Error (Groq):', err);
  }

  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const historyForPrompt =
        Array.isArray(history) && history.length > 0
          ? history.map((m) => (m.role === 'user' ? 'Gardener: ' + (m.text || '').trim() : 'Mochi: ' + (m.text || '').trim())).join('\n')
          : '';
      const prompt =
        historyForPrompt.length > 0
          ? `${historyForPrompt}\n\nMochi, reply in character (2 sentences max):`
          : 'The gardener is about to send a message. Reply in character (2 sentences max) when they do.';
      const result = await tryGenerate(genAI, prompt, {
        systemInstruction: SYSTEM_INSTRUCTIONS + (contextNote ? '\n\nSystem Note (current context): ' + contextNote : ''),
      });
      const text = result?.response?.text?.();
      if (typeof text === 'string') {
        const reply = text.trim().replace(/\n+/g, ' ').slice(0, 320);
        return { text: reply };
      }
    } catch (err) {
      console.warn('Gemini chatWithSpirit:', err?.message || err);
    }
  }

  return { text: "The garden winds are quiet right now. Let's focus on your next step." };
}

/**
 * Morning Briefing: contextual heads-ups (events, economic releases, etc.) based on user goals.
 * @param {Array} userGoals - Active goals (from GardenContext goals); each has at least { title, type?, domain? }
 * @param {string} todayDate - Date string YYYY-MM-DD for "today"
 * @returns {Promise<Array<{ title: string, category: string, searchQuery: string }>>} - Up to 3 items, or []
 */
export async function generateMorningBriefing(userGoals, todayDate) {
  const apiKey = getApiKey();
  const goals = Array.isArray(userGoals) ? userGoals : [];
  const dateStr = typeof todayDate === 'string' ? todayDate : new Date().toISOString().split('T')[0];

  const goalsSummary = goals.length === 0 ? 'No active goals.' : goals.map((g) => `- ${g.title ?? 'Goal'} (${g.type ?? '—'}, ${g.domain ?? '—'})`).join('\n');

  const prompt = `The user is looking at their day for ${dateStr}. Here are their active goals:

${goalsSummary}

Based on these goals (especially if they involve day trading, finance, or specific hobbies), are there any major real-world events, economic data releases, or general contextual heads-ups they should be aware of today? Return a JSON array of objects with { "title": "...", "category": "...", "searchQuery": "..." }. Keep it under 3 items. If nothing is relevant, return an empty array []. Return ONLY valid JSON, no markdown or explanation.`;

  try {
    if (apiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await tryGenerate(genAI, prompt);
      const text = result?.response?.text?.();
      if (typeof text !== 'string') return [];
      let raw = sanitizeJsonResponse(text).trim();
      const arrMatch = raw.match(/\[[\s\S]*\]/);
      if (arrMatch) raw = arrMatch[0];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const items = parsed.slice(0, 3).filter((item) => item && typeof item.title === 'string').map((item) => ({
        title: String(item.title).trim(),
        category: typeof item.category === 'string' ? item.category.trim() : 'General',
        searchQuery: typeof item.searchQuery === 'string' ? item.searchQuery.trim() : String(item.title).trim(),
      }));
      return items;
    }
    const groqKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY;
    if (groqKey) {
      const groqText = await fetchFromGroq(prompt);
      let raw = sanitizeJsonResponse(groqText).trim();
      const arrMatch = raw.match(/\[[\s\S]*\]/);
      if (arrMatch) raw = arrMatch[0];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(0, 3).filter((item) => item && typeof item.title === 'string').map((item) => ({
        title: String(item.title).trim(),
        category: typeof item.category === 'string' ? item.category.trim() : 'General',
        searchQuery: typeof item.searchQuery === 'string' ? item.searchQuery.trim() : String(item.title).trim(),
      }));
    }
  } catch (err) {
    console.warn('generateMorningBriefing failed:', err?.message || err);
  }
  return [];
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
 * Suggest one synergistic habit to stack with a newly created goal (e.g. Gym -> Drink a protein shake).
 * @param {string} newGoalTitle - Title of the goal the user just created
 * @returns {Promise<{ hasSynergy: boolean, suggestedHabitTitle: string, pitchText: string }|null>}
 */
export async function generateHabitSynergy(newGoalTitle) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const title = typeof newGoalTitle === 'string' ? newGoalTitle.trim() : '';
  if (!title) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `The user just created a new goal/routine: '${title.replace(/'/g, "\\'")}'. Identify one highly effective, small 'synergistic' habit they could stack with this (e.g., if they added 'Gym', suggest 'Drink a protein shake' or 'Prep a healthy meal'). Return strictly a JSON object: { "hasSynergy": boolean, "suggestedHabitTitle": "string", "pitchText": "string (A friendly 1-sentence explanation of why they pair well)" }. If the goal is too vague or no good stack comes to mind, set hasSynergy to false and use empty strings for the others. No other text or markdown.`;

    const result = await tryGenerate(genAI, prompt);
    const text = result?.response?.text?.();
    if (typeof text !== 'string') return null;

    let raw = sanitizeJsonResponse(text).trim();
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) raw = objMatch[0];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.hasSynergy !== 'boolean') return null;
    if (!parsed.hasSynergy) return { hasSynergy: false, suggestedHabitTitle: '', pitchText: '' };

    return {
      hasSynergy: true,
      suggestedHabitTitle: typeof parsed.suggestedHabitTitle === 'string' ? parsed.suggestedHabitTitle.trim() : '',
      pitchText: typeof parsed.pitchText === 'string' ? parsed.pitchText.trim() : '',
    };
  } catch (err) {
    console.warn('Gemini generateHabitSynergy:', err?.message || err);
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

/**
 * Daily "Help Me Prioritize": pick exactly one task from today's list for the user to focus on.
 * Uses energy level and respects fixed times (prefers flexible tasks).
 * @param {Array<{ id: string, title: string, isFixed?: boolean }>} tasks - Today's uncompleted tasks (from assignments)
 * @param {number} [energyLevel=3] - User's current energy 1-5 (spoons); when >5 we pass 5
 * @returns {Promise<{ recommendedTaskId: string | null, reason: string | null }>}
 */
export async function recommendDailyPriority(tasks, energyLevel = 3) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { recommendedTaskId: null, reason: null };
  }
  const energy = Math.max(1, Math.min(5, Number(energyLevel) || 3));
  const flexibleTasks = tasks.filter((t) => !t.isFixed);
  const fixedTasks = tasks.filter((t) => t.isFixed);

  const formatList = (list) =>
    list.map((t) => `- id: "${t.id}", title: "${(t.title || '').replace(/"/g, "'")}"`).join('\n');

  const prompt = `You are an executive function assistant. Look at these tasks for today. The user has ${energy}/5 energy. Pick EXACTLY ONE task that they should do first to build momentum or clear a major hurdle.

TASKS FOR TODAY:
${flexibleTasks.length > 0 ? 'FLEXIBLE (no fixed time):\n' + formatList(flexibleTasks) : ''}
${fixedTasks.length > 0 ? (flexibleTasks.length > 0 ? '\nFIXED-TIME (scheduled):\n' : '') + formatList(fixedTasks) : ''}

Return ONLY a JSON object: {"recommendedTaskId": "id", "reason": "A 1-sentence encouraging reason why."}
Example: {"recommendedTaskId":"goal-123","reason":"Starting with this will give you a quick win and clear mental space for the rest."}
Use the exact task id from the list. Keep the reason warm and brief.`;

  const fallbackId = flexibleTasks[0]?.id ?? tasks[0]?.id ?? null;
  const fallbackReason = fallbackId ? 'Start here to build momentum.' : null;

  const apiKey = getApiKey();
  try {
    if (apiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await tryGenerate(genAI, prompt);
      const text = result?.response?.text?.();
      if (typeof text !== 'string') return { recommendedTaskId: fallbackId, reason: fallbackReason };
      const raw = sanitizeJsonResponse(text);
      const match = raw.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/) || raw.match(/\{[^{}]*\}/);
      const parsed = match ? JSON.parse(match[0]) : JSON.parse(raw);
      const id = parsed?.recommendedTaskId;
      const reason = typeof parsed?.reason === 'string' ? parsed.reason.trim() : fallbackReason;
      const valid = typeof id === 'string' && tasks.some((t) => t.id === id);
      return {
        recommendedTaskId: valid ? id : fallbackId,
        reason: valid ? reason : fallbackReason,
      };
    }
    const groqKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY;
    if (groqKey) {
      const groqText = await fetchFromGroq(prompt);
      const raw = sanitizeJsonResponse(groqText);
      const match = raw.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/) || raw.match(/\{[^{}]*\}/);
      const parsed = match ? JSON.parse(match[0]) : JSON.parse(raw);
      const id = parsed?.recommendedTaskId;
      const reason = typeof parsed?.reason === 'string' ? parsed.reason.trim() : fallbackReason;
      const valid = typeof id === 'string' && tasks.some((t) => t.id === id);
      return {
        recommendedTaskId: valid ? id : fallbackId,
        reason: valid ? reason : fallbackReason,
      };
    }
  } catch (err) {
    console.warn('recommendDailyPriority failed:', err?.message || err);
  }
  return { recommendedTaskId: fallbackId, reason: fallbackReason };
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

/**
 * Parse free-form "What's on your mind?" text into a single intent for Omni-Add routing.
 * @param {string} userText - Raw input from the user
 * @returns {Promise<{ type: 'goal'|'task'|'calendar_event', title: string, startTime?: string, endTime?: string }|null>}
 */
export async function parseOmniAddInput(userText) {
  const apiKey = getApiKey();
  const text = typeof userText === 'string' ? userText.trim() : '';
  if (!text) return null;
  if (!apiKey) return { type: 'goal', title: text.slice(0, 120) };

  const prompt = `Classify this short user input into exactly one type and extract a title. No other text.
Types: "goal" (something to achieve, a project, habit, or metric), "task" (a concrete to-do or action), "calendar_event" (meeting, appointment, or time-bound event).
If the user mentions a time (e.g. "tomorrow 3pm", "next Tuesday 9am"), set type to "calendar_event" and include startTime/endTime as ISO 8601 strings (use today's date if no date given).
Return ONLY valid JSON in this exact shape (no markdown): {"type":"goal"|"task"|"calendar_event","title":"short title","startTime":"ISO string or null","endTime":"ISO string or null"}
Input: "${text.replace(/"/g, '\\"').slice(0, 500)}"`;

  try {
    if (apiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await tryGenerate(genAI, prompt);
      const raw = result?.response?.text?.();
      if (typeof raw !== 'string') return null;
      const cleaned = sanitizeJsonResponse(raw).replace(/\s+/g, ' ');
      const match = cleaned.match(/\{[^{}]*\}/);
      const parsed = JSON.parse(match ? match[0] : cleaned);
      const type = ['goal', 'task', 'calendar_event'].includes(parsed?.type) ? parsed.type : 'goal';
      const title = typeof parsed?.title === 'string' ? parsed.title.trim() : text.slice(0, 120);
      return {
        type: type === 'task' ? 'goal' : type,
        title: title || text.slice(0, 120),
        startTime: parsed?.startTime && parsed.startTime !== 'null' ? parsed.startTime : undefined,
        endTime: parsed?.endTime && parsed.endTime !== 'null' ? parsed.endTime : undefined,
      };
    }
    const groqKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY;
    if (groqKey) {
      const groqText = await fetchFromGroq(prompt);
      const cleaned = sanitizeJsonResponse(groqText).replace(/\s+/g, ' ');
      const match = cleaned.match(/\{[^{}]*\}/);
      const parsed = JSON.parse(match ? match[0] : cleaned);
      const type = ['goal', 'task', 'calendar_event'].includes(parsed?.type) ? parsed.type : 'goal';
      const title = typeof parsed?.title === 'string' ? parsed.title.trim() : text.slice(0, 120);
      return {
        type: type === 'task' ? 'goal' : type,
        title: title || text.slice(0, 120),
        startTime: parsed?.startTime && parsed.startTime !== 'null' ? parsed.startTime : undefined,
        endTime: parsed?.endTime && parsed.endTime !== 'null' ? parsed.endTime : undefined,
      };
    }
  } catch (err) {
    console.warn('parseOmniAddInput failed:', err?.message || err);
    return { type: 'goal', title: text.slice(0, 120) };
  }
}

/**
 * Iron-clad work hours block: when app is in personal mode (!isWorkScheduler) and work hours are set,
 * forbid the AI from scheduling any tasks during that window.
 * @param {{ isWorkScheduler?: boolean, workHours?: { start?: string, end?: string } }|undefined} settings - From GardenContext userSettings
 * @returns {string} Constraint string for the system prompt, or ''
 */
function getWorkBlockConstraint(settings) {
  if (settings?.isWorkScheduler || !settings?.workHours) return '';
  const start = settings.workHours.start ?? '09:00';
  const end = settings.workHours.end ?? '17:00';
  return `CRITICAL HARD CONSTRAINT: The user works from ${start} to ${end}. You are absolutely FORBIDDEN from scheduling any tasks during this time window. Do not suggest or place any tasks between these hours.`;
}

/** Proficiency-aware instruction: tailor micro-habits to experience level (Beginner = ultra-easy, Advanced = optimization). */
function getSkillLevelInstruction(skillLevel) {
  const level = (skillLevel || 'intermediate').toLowerCase();
  if (level === 'beginner') {
    return 'The user is at a Beginner level for this goal. Tailor the suggested micro-habits to this level: make them 5-minute ultra-easy steps that anyone can do from scratch. No assumptions about prior knowledge or equipment.';
  }
  if (level === 'expert' || level === 'advanced') {
    return 'The user is at an Advanced level for this goal. Skip the basics. Suggest 15-minute optimization or consistency habits (e.g. advanced techniques, refinement, or sustaining momentum). Assume they are already proficient.';
  }
  return 'The user is at an Intermediate level for this goal. Suggest micro-habits that assume some experience: 10–15 minute steps, neither ultra-basic nor advanced-only.';
}

export async function suggestGoalStructure(title, type = 'kaizen', currentMetric, targetMetric, skillLevel) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("Missing API Key");
    return null;
  }

  const isRoutine = type === 'routine';
  const skillInstruction = getSkillLevelInstruction(skillLevel);

  const prompt = isRoutine
    ? `
      Act as a Kaizen productivity coach for recurring habits.
      User Routine: "${title}".

      ${skillInstruction}

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

      ${skillInstruction}

      Create a comprehensive plan in strict JSON format (no markdown).

      Requirements:
      1. "strategy": One sentence of strategic advice.
      2. "vines": Array of 3-5 immediate subtasks that physically take less than 5 minutes to do (e.g. "Put shoes by the door", "Open a blank document").
      3. "rituals": 1-2 recurring habits (title + days 0-6).
      4. "milestones": EXACTLY 4 milestones that scale up in difficulty. Milestone 1 = a 5-minute action. Milestone 2 = a 15-minute action. Milestone 3 = a 30-minute action. Milestone 4 = achieving consistency (e.g., "Do it 3 days in a row").
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
    vines: ['Clear your workspace', 'Set a 5-minute timer', 'Take one deep breath'],
    estimatedMinutes: 30,
    targetHours: 3,
    rituals: [{ title: 'Daily Practice', days: [1, 3, 5] }],
    milestones: ['Complete a 5-minute session', 'Complete a 15-minute session', 'Complete a 30-minute session', 'Do it 3 days in a row'],
    suggestedMetrics: [{ name: 'Sessions completed', unit: 'count', direction: 'higher' }],
  });

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await tryGenerate(genAI, prompt);
    const text = result?.response?.text?.();
    if (!text) throw new Error('Empty response');
    let raw = sanitizeJsonResponse(text);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];
    return JSON.parse(raw);
  } catch (geminiErr) {
    console.warn('Gemini suggestGoalStructure failed, trying Groq fallback:', geminiErr?.message || geminiErr);
    try {
      const groqText = await fetchFromGroq(prompt);
      let raw = sanitizeJsonResponse(groqText);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      return JSON.parse(raw);
    } catch (groqErr) {
      console.error('Groq fallback also failed:', groqErr?.message || groqErr);
      return safeFallback();
    }
  }
}

/**
 * AI Weekly Planner: distributes goals across Mon-Sun based on targets, rituals, and energy.
 * Returns { monday: [{ goalId, hours, priority? }, ...], ... }
 * @param {Object} options - Optional { northStarTitle } to prioritize that project
 */
export async function generateWeeklyPlan(goals, calendarEvents = [], energyProfile = {}, options = {}) {
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
  const northStarTitle = options.northStarTitle ?? null;

  const settings = options.userSettings ?? options.settings ?? {};
  const workBlockConstraint = getWorkBlockConstraint(settings);

  const todayString = new Date().toISOString().split('T')[0];
  const northStarConstraint = northStarTitle
    ? `

CRITICAL: The user's #1 priority this week is the project/goal named "${northStarTitle}". When distributing tasks, you MUST schedule subtasks belonging to this project earlier in the week, and mark them with "priority": true in your JSON response. All other blocks use "priority": false.`
    : '';

  const prompt = `
Act as a Kaizen weekly planner. Distribute these goals across Mon-Sun.
${workBlockConstraint ? `\n${workBlockConstraint}\n` : ''}

CRITICAL CONSTRAINT: Today's date is ${todayString}. You absolutely MUST NOT schedule any tasks on days before this date. Only distribute tasks starting from today and moving forward into the future.${northStarConstraint || ''}

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
${northStarTitle ? '- Each time block MUST include a boolean "priority" field: true only for tasks belonging to the North Star project above, false otherwise.' : ''}

Return strict JSON (no markdown). Each day array item must have goalId, hours, and priority (boolean):
{
  "monday": [{ "goalId": "...", "hours": 2, "priority": false }],
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
    let raw = sanitizeJsonResponse(text);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Gemini generateWeeklyPlan failed, trying Groq:', err?.message || err);
    try {
      const groqText = await fetchFromGroq(prompt);
      let raw = sanitizeJsonResponse(groqText);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      return JSON.parse(raw);
    } catch (groqErr) {
      console.error('Groq generateWeeklyPlan fallback failed:', groqErr?.message || groqErr);
      return null;
    }
  }
}

/**
 * AI Monthly Planner: creates a high-level roadmap for the month.
 * Returns { summary, weeks: [{ focus, goals: { goalId: hours } }] }
 * @param {Object} [options] - Optional { userSettings } from GardenContext (for work-hours block in personal mode)
 */
export async function generateMonthlyPlan(goals, monthIndex, year, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) { console.error("Missing API Key"); return null; }

  const settings = options.userSettings ?? options.settings ?? {};
  const workBlockConstraint = getWorkBlockConstraint(settings);

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

  const todayString = new Date().toISOString().split('T')[0];
  const prompt = `
Act as a Kaizen monthly planner for ${monthName} ${year}.
${workBlockConstraint ? `\n${workBlockConstraint}\n` : ''}

CRITICAL CONSTRAINT: Today's date is ${todayString}. You absolutely MUST NOT schedule any tasks on days before this date. Only distribute tasks starting from today and moving forward into the future.

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
    let raw = sanitizeJsonResponse(text);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Gemini generateMonthlyPlan failed, trying Groq:', err?.message || err);
    try {
      const groqText = await fetchFromGroq(prompt);
      let raw = sanitizeJsonResponse(groqText);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      return JSON.parse(raw);
    } catch (groqErr) {
      console.error('Groq generateMonthlyPlan fallback failed:', groqErr?.message || groqErr);
      return null;
    }
  }
}

/**
 * Monthly AI Planner (strict JSON): returns an array of tasks for the calendar.
 * Each item: { title: string, date: "YYYY-MM-DD", durationMinutes: number, priority?: boolean }.
 * Used with user consent: show pending plan modal, then Apply to Calendar.
 * @param {Array} goals - Kaizen goals
 * @param {number} monthIndex - 0-11
 * @param {number} year
 * @param {{ userSettings?: object, northStarTitle?: string }} options
 */
export async function generateMonthlyPlanTasks(goals, monthIndex, year, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Missing API Key');
    return null;
  }

  const settings = options.userSettings ?? {};
  const workBlockConstraint = getWorkBlockConstraint(settings);
  const northStarTitle = options.northStarTitle ?? null;
  const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][monthIndex];
  const todayString = new Date().toISOString().split('T')[0];
  const goalSummaries = goals.filter((g) => g.type === 'routine' || g.type === 'kaizen').map((g) => ({
    id: g.id,
    title: g.title,
    type: g.type,
  }));

  if (goalSummaries.length === 0) return null;

  const northStarConstraint = northStarTitle
    ? `\nCRITICAL: The user's #1 priority this month is the project/goal named "${northStarTitle}". Schedule tasks belonging to this project earlier in the month and set "priority": true for those items; use "priority": false for others.`
    : '';

  const prompt = `You are a JSON-only API. Do not include markdown formatting, do not include \`\`\`json or \`\`\` text. You must return a raw JSON array of objects with keys: title, date (YYYY-MM-DD), durationMinutes, and priority (boolean).
${workBlockConstraint ? `\n${workBlockConstraint}\n` : ''}${northStarConstraint}

Act as a Kaizen monthly planner for ${monthName} ${year}. Distribute tasks across the month for these goals:
${JSON.stringify(goalSummaries, null, 2)}

CRITICAL CONSTRAINT: Today's date is ${todayString}. You absolutely MUST NOT schedule any tasks on days before this date. Only use dates from today onward. Each date must be YYYY-MM-DD.

Return ONLY a raw JSON array. Example: [{"title":"Review goals","date":"2025-02-21","durationMinutes":30,"priority":true},{"title":"Deep work block","date":"2025-02-23","durationMinutes":60,"priority":false}]
`;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await tryGenerate(genAI, prompt);
    const text = result?.response?.text?.();
    if (!text) throw new Error('Empty response');
    let raw = sanitizeJsonResponse(text).trim();
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (arrMatch) raw = arrMatch[0];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(
      (item) =>
        item &&
        typeof item.title === 'string' &&
        typeof item.date === 'string' &&
        typeof item.durationMinutes === 'number'
    );
    return valid.map((item) => ({
      title: String(item.title).trim(),
      date: item.date,
      durationMinutes: Math.max(1, Math.min(480, Math.floor(item.durationMinutes))),
      priority: item.priority === true,
    }));
  } catch (err) {
    console.warn('Gemini generateMonthlyPlanTasks failed, trying Groq:', err?.message || err);
    try {
      const groqText = await fetchFromGroq(prompt);
      let raw = sanitizeJsonResponse(groqText).trim();
      const arrMatch = raw.match(/\[[\s\S]*\]/);
      if (arrMatch) raw = arrMatch[0];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      const valid = parsed.filter(
        (item) =>
          item &&
          typeof item.title === 'string' &&
          typeof item.date === 'string' &&
          typeof item.durationMinutes === 'number'
      );
      return valid.map((item) => ({
        title: String(item.title).trim(),
        date: item.date,
        durationMinutes: Math.max(1, Math.min(480, Math.floor(item.durationMinutes))),
        priority: item.priority === true,
      }));
    } catch (groqErr) {
      console.error('Groq generateMonthlyPlanTasks fallback failed:', groqErr?.message || groqErr);
      return null;
    }
  }
}

/**
 * Goal breakdown as structured milestones (no dates).
 * Use for the Monthly Planner / Goal Breakdown: AI returns logical milestones and flexible tasks
 * so the user can schedule them later. Parsed and normalized; not a text blob.
 *
 * @param {string} goalTitle - The goal to break down
 * @param {{ userSettings?: object }} [options]
 * @returns {Promise<{ goalTitle: string, milestones: Array<{ title: string, tasks: Array<{ title: string, estimatedSparks: number, isKaizen: boolean }> }> | null>}
 */
export async function generateGoalBreakdownMilestones(goalTitle, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Missing API Key');
    return null;
  }
  const title = String(goalTitle || '').trim();
  if (!title) return null;

  const prompt = `You are a JSON-only API. Do not include markdown, \`\`\`json, or any text outside the JSON object.

Break down this goal into a logical sequence of milestones. Do NOT assign specific dates to any task. Instead:
- Create 3 to 5 logical "Milestones" (phases or stages) for this goal.
- Under each Milestone, list 3 to 5 flexible "Tasks" that belong to that phase.
- For each task: "title" (short string), "estimatedSparks" (number 1, 2, or 3: 1=small, 2=medium, 3=large), "isKaizen" (boolean: true if it's a small improvement/experiment, false if it's a concrete deliverable).

Goal to break down: "${title}"

Return ONLY a single JSON object with this exact shape (no other keys, no explanation):
{
  "goalTitle": "${title}",
  "milestones": [
    {
      "title": "string",
      "tasks": [
        { "title": "string", "estimatedSparks": 1, "isKaizen": false },
        { "title": "string", "estimatedSparks": 2, "isKaizen": true }
      ]
    }
  ]
}`;

  function parseAndNormalize(rawText) {
    let raw = sanitizeJsonResponse(rawText).trim();
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) raw = objMatch[0];
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.goalTitle !== 'string') return null;
    const milestones = Array.isArray(obj.milestones) ? obj.milestones : [];
    const normalized = {
      goalTitle: String(obj.goalTitle).trim() || title,
      milestones: milestones.map((m) => {
        const tasks = Array.isArray(m?.tasks) ? m.tasks : [];
        const out = {
          title: String(m?.title ?? '').trim() || 'Milestone',
          tasks: tasks.map((t) => ({
            title: String(t?.title ?? '').trim() || 'Task',
            estimatedSparks: Math.max(1, Math.min(3, Math.floor(Number(t?.estimatedSparks) || 2))),
            isKaizen: Boolean(t?.isKaizen),
          })),
        };
        if (m?.activeMonth && typeof m.activeMonth === 'string') out.activeMonth = m.activeMonth.slice(0, 7);
        else if (m?.active_month && typeof m.active_month === 'string') out.activeMonth = m.active_month.slice(0, 7);
        return out;
      }).filter((m) => m.tasks.length > 0),
    };
    return normalized;
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await tryGenerate(genAI, prompt);
    const text = result?.response?.text?.();
    if (!text) throw new Error('Empty response');
    return parseAndNormalize(text);
  } catch (err) {
    console.warn('Gemini generateGoalBreakdownMilestones failed, trying Groq:', err?.message || err);
    try {
      const groqText = await fetchFromGroq(prompt);
      return parseAndNormalize(groqText);
    } catch (groqErr) {
      console.error('Groq generateGoalBreakdownMilestones fallback failed:', groqErr?.message || groqErr);
      return null;
    }
  }
}

/**
 * Rebalance month: distribute remainingHours across availableDates, avoiding userEvents.
 * @param {number} remainingHours - Hours to distribute
 * @param {string[]} availableDates - YYYY-MM-DD dates (e.g. remaining days in month excluding Sundays)
 * @param {Array} userEvents - Hard-coded events [{ start, end, date or start }]
 * @param {{ userSettings?: object }} [options] - Optional; userSettings from GardenContext for work-hours block in personal mode
 * @returns {Promise<Array<{ date: string, startTime: string, endTime: string }>>} Time blocks
 */
export async function rebalanceMonthQuota(remainingHours, availableDates = [], userEvents = [], options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Missing API Key');
    return [];
  }

  const settings = options.userSettings ?? options.settings ?? {};
  const workBlockConstraint = getWorkBlockConstraint(settings);

  const todayString = new Date().toISOString().split('T')[0];
  const prompt = `The user needs to distribute ${remainingHours} hours of work across ${availableDates.length} days. Available dates (use ONLY these): ${JSON.stringify(availableDates)}. They have the following hard-coded events: ${JSON.stringify(userEvents)}.
${workBlockConstraint ? `\n${workBlockConstraint}\n` : ''}

CRITICAL CONSTRAINT: Today's date is ${todayString}. You absolutely MUST NOT schedule any tasks on days before this date. Only distribute tasks starting from today and moving forward into the future.

Output a JSON array of time blocks. Each block must have: "date" (YYYY-MM-DD from the available dates list), "startTime" (e.g. "09:00"), "endTime" (e.g. "11:00"). Blocks must not overlap with the hard-coded events. Spread the hours evenly across the available days.

Return ONLY a JSON array, no markdown or explanation. Example: [{"date":"2025-02-21","startTime":"09:00","endTime":"11:00"},{"date":"2025-02-22","startTime":"14:00","endTime":"16:00"}]`;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await tryGenerate(genAI, prompt);
    const text = result?.response?.text?.();
    if (!text) throw new Error('Empty response');
    let raw = sanitizeJsonResponse(text);
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (arrMatch) raw = arrMatch[0];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (b) => b && typeof b.date === 'string' && typeof b.startTime === 'string' && typeof b.endTime === 'string'
    );
    return valid.map((b) => ({ ...b, date: b.date < todayString ? todayString : b.date }));
  } catch (err) {
    console.warn('Gemini rebalanceMonthQuota failed, trying Groq:', err?.message || err);
    try {
      const groqText = await fetchFromGroq(prompt);
      let raw = sanitizeJsonResponse(groqText);
      const arrMatch = raw.match(/\[[\s\S]*\]/);
      if (arrMatch) raw = arrMatch[0];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const valid = parsed.filter(
        (b) => b && typeof b.date === 'string' && typeof b.startTime === 'string' && typeof b.endTime === 'string'
      );
      return valid.map((b) => ({ ...b, date: b.date < todayString ? todayString : b.date }));
    } catch (groqErr) {
      console.error('Groq rebalanceMonthQuota fallback failed:', groqErr?.message || groqErr);
      return [];
    }
  }
}

/**
 * Tweak or extend milestones for a goal based on natural-language instruction.
 * @param {string} goalTitle - Goal name
 * @param {string[]} currentMilestones - Current milestone titles
 * @param {string} instruction - User instruction (e.g. "Make these steps smaller")
 * @returns {Promise<string[]>} 3-5 new milestone title strings
 */
export async function tweakMilestones(goalTitle, currentMilestones, instruction) {
  const prompt = `Goal: "${goalTitle}". Current Milestones: ${currentMilestones.join(', ')}.
Instruction: "${instruction}".
Return EXACTLY a JSON array of 3-5 strings representing the new or updated milestones. Do not return an object, return an Array [].`;
  try {
    const apiKey = getApiKey();
    if (apiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await tryGenerate(genAI, prompt);
      const text = result?.response?.text?.();
      if (typeof text === 'string') {
        const raw = sanitizeJsonResponse(text);
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((s) => typeof s === 'string').map((s) => String(s).trim()).filter(Boolean);
        }
      }
    }
  } catch (e) {
    console.error('tweakMilestones:', e);
  }
  try {
    const groqText = await fetchFromGroq(prompt);
    const raw = sanitizeJsonResponse(groqText);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s) => typeof s === 'string').map((s) => String(s).trim()).filter(Boolean);
    }
  } catch (_) {}
  return ['Adjusted step 1', 'Adjusted step 2', 'Adjusted step 3'];
}

/**
 * AI Project Planner: slices a project into phases, milestones, and tasks with a timeline.
 * @param {string} projectName
 * @param {string|null} deadline - ISO date string or null
 * @param {string} feedback - optional user feedback for revision (e.g. "Add a testing phase")
 * @param {string} description - optional project description
 * @param {Array} existingGoals - existing goals that could be linked
 * @param {string} skillLevel - 'beginner' | 'intermediate' | 'expert' (scales task granularity)
 * @returns {{ summary, phases: [{ title, weekRange, tasks: [{ title, estimatedHours, type }], milestone }], suggestedLinks: [{ taskTitle, goalId, goalTitle }], mochiFeedback: string }}
 */
export async function sliceProject(projectName, deadline, feedback = '', description = '', existingGoals = [], skillLevel) {
  const apiKey = getApiKey();
  if (!apiKey) { console.error("Missing API Key"); return null; }

  const today = new Date();
  let availableWeeks = 14; // Default fallback
  if (deadline) {
    const end = new Date(deadline);
    availableWeeks = Math.max(1, Math.round((end - today) / (1000 * 60 * 60 * 24 * 7)));
  }
  const isShortTerm = availableWeeks <= 3;
  const deadlineStr = deadline ? `Deadline: ${deadline} (Exactly ${availableWeeks} weeks from today).` : 'No hard deadline — suggest a reasonable timeline (default 12 weeks).';
  const timeRangeExample = isShortTerm ? '"Day 1-2"' : '"Week 1-2"';
  const taskTimeRangeExample = isShortTerm ? '"Day 1"' : '"Week 1"';
  const goalList = existingGoals.slice(0, 15).map((g) => `${g.id}: "${g.title}" (${g.type})`).join('\n');
  const skillInstruction = getSkillLevelInstruction(skillLevel);

  const prompt = `
Act as a Kaizen project planner. Break this project into manageable phases.

${skillInstruction}

Project: "${projectName}"
${description ? `Description: ${description}` : ''}
${deadlineStr}
${isShortTerm ? 'This is a SHORT-TERM project (3 weeks or less). Use "Day 1", "Day 2-3", etc. for all time ranges.' : ''}

${feedback ? `CRITICAL USER FEEDBACK FOR REVISION: The user reviewed your previous plan and said: "${feedback}". You MUST adjust the phases and tasks to accommodate this feedback.` : ''}

Existing goals the user already has:
${goalList || 'None yet.'}

Return strict JSON (no markdown). Use "timeRange" for phase and task timing (the value can be "Week 1-2" or "Day 1-3" depending on project length):
{
  "summary": "1-sentence project overview",
  "totalWeeks": number,
  "phases": [
    {
      "title": "Phase name",
      "timeRange": ${timeRangeExample},
      "tasks": [
        { "title": "Task name", "estimatedHours": 5, "type": "kaizen", "timeRange": ${taskTimeRangeExample} }
      ],
      "milestone": "What success looks like at the end of this phase"
    }
  ],
  "suggestedLinks": [
    { "taskTitle": "A task that maps to an existing goal", "goalId": "id-from-list", "goalTitle": "title" }
  ],
  "mochiFeedback": "A 1-2 sentence comforting assessment of the workload."
}

Guidelines:
- Break into 3-6 phases.
- You MUST fit all phases strictly within the ${availableWeeks} weeks available.
- SCOPE MANAGEMENT RULE: Evaluate the user's goal against the available timeframe. If the goal is unrealistically large for the deadline (e.g., "Master 3 instruments in 1 month"), DO NOT just compress impossible tasks into the timeline. Instead, DOWN-SCOPE the project to what is actually achievable in that time (e.g., "Learn basic chords").
- TIME SCALE RULE: If the project has 3 weeks or less available, you MUST use "Day 1", "Day 2-3", etc. for your time ranges. If it is longer than 3 weeks, use "Week 1", "Week 2-3".
- SEQUENTIAL TASKS: Within each phase, tasks are often sequential (the first must be done before the second can start). Give each task its own "timeRange" that falls inside the phase. Example: if the phase is "Week 1-2", the first task might be "Week 1", the second "Week 2". For short projects with days: if the phase is "Day 1-3", use "Day 1", "Day 2", "Day 3" for consecutive tasks. If tasks can run in parallel, give them the same timeRange. Order tasks in the array in the order they should be done.
- In mochiFeedback, if you had to down-scope the project to make it realistic, gently explain this to the user (e.g., "Mastering all of this in 40 days is a lot, so I've created a plan to build a strong foundation first!"). Then state the estimated total hours.
- LINKING RULE: ONLY populate suggestedLinks if the task is an EXACT, undeniable match to an existing goal. If it is only vaguely related, leave suggestedLinks empty!
`;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await tryGenerate(genAI, prompt);
    const text = typeof result?.response?.text === 'function' ? result.response.text() : result?.response?.text;
    if (!text) throw new Error('Empty response');
    let raw = sanitizeJsonResponse(text);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];
    const parsed = JSON.parse(raw);
    return normalizeSliceProjectParsed(parsed);
  } catch (err) {
    console.warn('Gemini sliceProject failed, trying Groq:', err?.message || err);
    try {
      const groqText = await fetchFromGroq(prompt);
      let raw = sanitizeJsonResponse(groqText);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      const parsed = JSON.parse(raw);
      return normalizeSliceProjectParsed(parsed);
    } catch (groqErr) {
      console.error('Groq sliceProject fallback failed:', groqErr?.message || groqErr);
      return null;
    }
  }
}

/**
 * Proficiency Arc: estimate hours to reach Beginner, Intermediate, and Mastery for a goal/skill.
 * Used to show RPG-style leveling bars on project/kaizen goals.
 * @param {string} goalTitle - Goal or project title (e.g. "Learn Spanish", "Piano")
 * @returns {Promise<{ beginner: number, intermediate: number, mastery: number }|null>}
 */
export async function generateProficiencyEstimates(goalTitle) {
  const title = typeof goalTitle === 'string' ? goalTitle.trim() : '';
  if (!title) return null;

  const prompt = `The user wants to pursue the following goal/skill: '${title.replace(/'/g, "\\'")}'. Estimate the average number of dedicated hours required for a human to reach three milestones: 1. Beginner (Basic understanding/usage), 2. Intermediate (Competent, average level), 3. Mastery (Advanced/Expert). Return ONLY a strict JSON object with this exact schema: { "beginner": number, "intermediate": number, "mastery": number }. Make the estimates realistic and research-backed (e.g., 20 hours for beginner, 100 for intermediate, 10000 for mastery).`;

  const fallback = { beginner: 20, intermediate: 100, mastery: 10000 };

  try {
    const apiKey = getApiKey();
    if (apiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await tryGenerate(genAI, prompt);
      const text = typeof result?.response?.text === 'function' ? result.response.text() : result?.response?.text;
      if (!text) return fallback;
      let raw = sanitizeJsonResponse(text);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      const parsed = JSON.parse(raw);
      const beginner = Math.max(0, Number(parsed?.beginner));
      const intermediate = Math.max(beginner, Number(parsed?.intermediate));
      const mastery = Math.max(intermediate, Number(parsed?.mastery));
      if (Number.isFinite(beginner) && Number.isFinite(intermediate) && Number.isFinite(mastery)) {
        return { beginner, intermediate, mastery };
      }
    }
    const groqKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY;
    if (groqKey) {
      const groqText = await fetchFromGroq(prompt);
      let raw = sanitizeJsonResponse(groqText);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      const parsed = JSON.parse(raw);
      const beginner = Math.max(0, Number(parsed?.beginner));
      const intermediate = Math.max(beginner, Number(parsed?.intermediate));
      const mastery = Math.max(intermediate, Number(parsed?.mastery));
      if (Number.isFinite(beginner) && Number.isFinite(intermediate) && Number.isFinite(mastery)) {
        return { beginner, intermediate, mastery };
      }
    }
  } catch (err) {
    console.warn('generateProficiencyEstimates failed:', err?.message || err);
  }
  return fallback;
}

/**
 * Suggest one concrete project that would support a goal (e.g. "run a marathon" -> "Running plan for 41km").
 * @param {string} goalTitle - The skill or goal title
 * @returns {Promise<{ suggestedProjectTitle: string, pitchText: string }|null>}
 */
export async function suggestProjectForGoal(goalTitle) {
  const title = typeof goalTitle === 'string' ? goalTitle.trim() : '';
  if (!title) return null;

  const prompt = `The user has a goal: "${title.replace(/"/g, '\\"')}". Suggest ONE concrete project they could create to work toward this goal. Examples: goal "run a marathon" -> project "Running plan for 41km"; goal "learn to code" -> project "Build a small website in 4 weeks". Return ONLY a strict JSON object with this exact schema: { "suggestedProjectTitle": "string (short project name)", "pitchText": "string (one friendly sentence encouraging them to create this project)" }. No other text or markdown.`;

  const fallback = { suggestedProjectTitle: '', pitchText: '' };

  try {
    const apiKey = getApiKey();
    if (apiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await tryGenerate(genAI, prompt);
      const text = typeof result?.response?.text === 'function' ? result.response.text() : result?.response?.text;
      if (!text) return fallback;
      let raw = sanitizeJsonResponse(text);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      const parsed = JSON.parse(raw);
      const suggestedProjectTitle = typeof parsed?.suggestedProjectTitle === 'string' ? parsed.suggestedProjectTitle.trim() : '';
      const pitchText = typeof parsed?.pitchText === 'string' ? parsed.pitchText.trim() : '';
      if (suggestedProjectTitle || pitchText) return { suggestedProjectTitle, pitchText };
    }
    const groqKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY;
    if (groqKey) {
      const groqText = await fetchFromGroq(prompt);
      let raw = sanitizeJsonResponse(groqText);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      const parsed = JSON.parse(raw);
      const suggestedProjectTitle = typeof parsed?.suggestedProjectTitle === 'string' ? parsed.suggestedProjectTitle.trim() : '';
      const pitchText = typeof parsed?.pitchText === 'string' ? parsed.pitchText.trim() : '';
      if (suggestedProjectTitle || pitchText) return { suggestedProjectTitle, pitchText };
    }
  } catch (err) {
    console.warn('suggestProjectForGoal failed:', err?.message || err);
  }
  return fallback;
}

/**
 * Normalize parsed slice-project JSON so consumers get a stable shape (phases, tasks with estimatedHours, etc.).
 * Shared by sliceProject and planProjectFromDocument.
 * @param {object} parsed - Raw parsed JSON from Gemini
 * @returns {object} Normalized { summary, totalWeeks, phases, suggestedLinks, mochiFeedback }
 */
/** Normalize time string from AI (timeRange, weekRange, days) into standard weekRange for Gantt. */
function toWeekRange(val) {
  if (val == null) return null;
  const s = String(val).trim();
  return s || null;
}

function normalizeSliceProjectParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if (!Array.isArray(parsed.phases)) parsed.phases = [];
  const getPhaseTasks = (p) =>
    Array.isArray(p.tasks) ? p.tasks
      : Array.isArray(p.subtasks) ? p.subtasks
        : Array.isArray(p.items) ? p.items
          : Array.isArray(p.steps) ? p.steps
            : [];
  parsed.phases = parsed.phases.map((p) => {
    const phaseWeekRange = toWeekRange(p?.timeRange ?? p?.weekRange ?? p?.days);
    const rawTasks = getPhaseTasks(p);
    const tasks = rawTasks.map((t) => {
      const taskWeekRange = toWeekRange(t?.timeRange ?? t?.weekRange ?? t?.days);
      return {
        ...t,
        title: String(t?.title ?? t?.name ?? '').trim() || 'Task',
        estimatedHours: Math.max(0, Number(t?.estimatedHours ?? t?.hours) || 2),
        type: t?.type === 'routine' ? 'routine' : 'kaizen',
        weekRange: taskWeekRange,
      };
    });
    return { ...p, weekRange: phaseWeekRange, tasks };
  });
  if (!Array.isArray(parsed.suggestedLinks)) parsed.suggestedLinks = [];
  parsed.mochiFeedback = parsed.mochiFeedback != null ? String(parsed.mochiFeedback).trim() : '';
  if (parsed.title != null) parsed.title = String(parsed.title).trim();
  return parsed;
}

/**
 * Read a document (PDF, text, or plain string) and turn it into a structured project plan.
 * Uses the same JSON shape as sliceProject: title, summary, totalWeeks, phases, tasks with estimatedHours.
 * @param {string} base64DataOrText - Base64-encoded document content, or raw text when isRawText is true
 * @param {string} mimeType - MIME type (e.g. application/pdf, text/plain)
 * @param {string} fileName - Display name for the document
 * @param {boolean} [isRawText=false] - If true, base64DataOrText is raw text (e.g. from mammoth); otherwise Base64 for inlineData
 * @param {string|null} [deadline=null] - Optional deadline; timeline and totalWeeks will be adjusted to fit
 * @param {string} [extraContext=''] - Optional extra instructions from the user
 * @returns {Promise<{ title, summary, totalWeeks, phases, suggestedLinks, mochiFeedback }|null>}
 */
export async function planProjectFromDocument(base64DataOrText, mimeType, fileName, isRawText = false, deadline = null, extraContext = '') {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Missing API Key');
    return null;
  }

  const safeFileName = typeof fileName === 'string' ? fileName.trim() || 'Document' : 'Document';
  const deadlineStr = deadline ? `The user wants this completed by: ${deadline}. Adjust the timeline and totalWeeks to fit this strictly.` : 'No hard deadline.';
  const contextStr = extraContext ? `Extra instructions from user: ${extraContext}` : '';

  const prompt = `Read the attached document titled "${safeFileName}". Extract the core objective and break it down into a structured project plan.

${deadlineStr}
${contextStr}

You MUST return the EXACT same strict JSON structure as a project slice:
{
  "title": "Short, punchy project name (MAX 5 WORDS)",
  "summary": "1-sentence project overview",
  "totalWeeks": number,
  "phases": [
    {
      "title": "Phase name",
      "weekRange": "Week 1-2",
      "tasks": [
        { "title": "Task name", "estimatedHours": 5, "type": "kaizen", "weekRange": "Week 1" }
      ],
      "milestone": "What success looks like at the end of this phase"
    }
  ],
  "suggestedLinks": [],
  "mochiFeedback": "A 1-2 sentence comforting assessment of the workload."
}

Guidelines:
- SCOPE MANAGEMENT RULE: Evaluate the user's goal against the available timeframe. If the goal is unrealistically large for the deadline (e.g., "Master 3 instruments in 1 month"), DO NOT just compress impossible tasks into the timeline. Instead, DOWN-SCOPE the project to what is actually achievable in that time (e.g., "Learn basic chords").
- In mochiFeedback, if you had to down-scope the project to make it realistic, gently explain this to the user (e.g., "Mastering all of this in 40 days is a lot, so I've created a plan to build a strong foundation first!"). Then state the estimated total hours.

Return ONLY valid JSON (no markdown, no code fence).`;

  const content = isRawText
    ? [{ text: `Document Content:\n${base64DataOrText}\n\n${prompt}` }]
    : [
        { inlineData: { data: base64DataOrText, mimeType: mimeType || 'application/octet-stream' } },
        { text: prompt },
      ];

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await tryGenerate(genAI, content);
    const text = typeof result?.response?.text === 'function' ? result.response.text() : result?.response?.text;
    if (!text) throw new Error('Empty response');
    let raw = sanitizeJsonResponse(text);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];
    const parsed = JSON.parse(raw);
    return normalizeSliceProjectParsed(parsed);
  } catch (err) {
    console.warn('Gemini planProjectFromDocument failed:', err?.message || err);
    throw err;
  }
}

/**
 * Test Mochi (Gemini) connection. Use from Settings to verify API key and env.
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function testMochiConnection() {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, message: "Mochi couldn't connect. Check VITE_GEMINI_API_KEY in .env and restart the dev server." };
  }
  try {
    await ensureModelCheckDone();
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelId = getGeminiModelsToTry()[0];
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent('Reply with only: OK');
    const text = result?.response?.text?.();
    if (text && text.trim()) {
      return { ok: true, message: 'Mochi is connected.' };
    }
    return { ok: false, message: 'Mochi responded but returned no text. Try again.' };
  } catch (err) {
    const msg = String(err?.message ?? '').toLowerCase();
    if (msg.includes('api key') || msg.includes('invalid') || msg.includes('403')) {
      return { ok: false, message: "Mochi couldn't connect. Check VITE_GEMINI_API_KEY in .env and restart the dev server." };
    }
    return { ok: false, message: `Mochi couldn't connect: ${err?.message || 'Unknown error'}. Check API key or try again later.` };
  }
}
