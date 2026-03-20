import {
  SYSTEM_INSTRUCTIONS,
  fetchFromGroq,
  getApiKey,
  getGroqModel,
  sanitizeJsonResponse,
  tryGenerate,
} from './aiClient';

function anonymizeLogs(logs) {
  if (!Array.isArray(logs)) return [];
  return logs.map((log) => ({
    rating: log.rating,
    durationMinutes: log.minutes ?? 0,
    taskTitle: log.taskTitle || log.title || 'Focus',
  }));
}

function formatLast10Logs(anonymizedLogs) {
  if (!Array.isArray(anonymizedLogs) || anonymizedLogs.length === 0) return 'No journal entries yet.';
  return anonymizedLogs.slice(-10).map((log) => {
    const task = log.taskTitle ?? 'Focus';
    const mins = log.durationMinutes ?? 0;
    const rating = log.rating != null ? ` (${log.rating})` : '';
    return `- ${task}, ${mins} min${rating}`;
  }).join('\n');
}

function formatGoals(goals) {
  if (!Array.isArray(goals) || goals.length === 0) return 'No seeds planted yet.';
  return goals.map((goal) => `- ${goal.title ?? 'Goal'} (${goal.domain ?? '-'})`).join('\n');
}

function formatUpcomingPlan(plan) {
  if (!Array.isArray(plan) || plan.length === 0) return 'No events this week.';
  return plan.map((event) => {
    const day = event.day ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][event.dayIndex] ?? '?';
    return `- ${day}: ${event.title ?? 'Event'} (${event.type ?? '-'})`;
  }).join('\n');
}

function buildContextNote(context) {
  const { logs = [], goals = [], energy = 0, weather = 'sun' } = context;
  const parts = [];
  if (weather === 'storm') parts.push('Weather: Stormy (gardener may be under pressure).');
  else if (weather === 'leaf') parts.push('Weather: Breeze (moderate load).');
  else parts.push('Weather: Sunny (clear skies).');
  if (energy <= -2) parts.push('Energy: Low Battery - gardener is low on energy.');
  else if (energy < 0) parts.push('Energy: Slightly low.');
  else if (energy > 0) parts.push('Energy: Good or high.');
  parts.push(`Seeds (goals): ${Array.isArray(goals) ? goals.length : 0} active.`);
  const recentLogs = Array.isArray(logs) ? logs.slice(-5) : [];
  if (recentLogs.length > 0) {
    parts.push('Recent activity: ' + recentLogs.map((log) => (log.taskTitle || log.title || 'Focus') + (log.rating ? ` (${log.rating})` : '')).join(', '));
  }
  return parts.join(' ');
}

export async function chatWithSpirit(history, context) {
  const groqKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY;
  const contextNote = buildContextNote(context || {});

  const messages = [
    {
      role: 'system',
      content: 'You are Mochi, a gentle, brief, and encouraging garden spirit. Answer in 1-2 short sentences.' + (contextNote ? ` Context: ${contextNote}` : ''),
    },
    ...(Array.isArray(history) ? history : []).map((message) => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: (message.text || '').trim() || '(no text)',
    })),
  ].filter((message) => message.content && message.content !== '(no text)');

  try {
    if (groqKey) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: getGroqModel(),
          messages,
          temperature: 0.7,
        }),
      });
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === 'string' && text.trim()) {
        return { text: text.trim().replace(/\n+/g, ' ').slice(0, 320) };
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
      const historyForPrompt = (Array.isArray(history) ? history : [])
        .map((message) => (message.role === 'user' ? `Gardener: ${(message.text || '').trim()}` : `Mochi: ${(message.text || '').trim()}`))
        .join('\n');
      const prompt = historyForPrompt.length > 0
        ? `${historyForPrompt}\n\nMochi, reply in character (2 sentences max):`
        : 'The gardener is about to send a message. Reply in character (2 sentences max) when they do.';
      const result = await tryGenerate(genAI, prompt, {
        systemInstruction: SYSTEM_INSTRUCTIONS + (contextNote ? `\n\nSystem Note (current context): ${contextNote}` : ''),
      });
      const text = result?.response?.text?.();
      if (typeof text === 'string') {
        return { text: text.trim().replace(/\n+/g, ' ').slice(0, 320) };
      }
    } catch (err) {
      console.warn('Gemini chatWithSpirit:', err?.message || err);
    }
  }

  return { text: "The garden winds are quiet right now. Let's focus on your next step." };
}

export async function generateMorningBriefing(userGoals, todayDate) {
  const apiKey = getApiKey();
  const goals = Array.isArray(userGoals) ? userGoals : [];
  const dateStr = typeof todayDate === 'string' ? todayDate : new Date().toISOString().split('T')[0];
  const goalsSummary = goals.length === 0 ? 'No active goals.' : goals.map((goal) => `- ${goal.title ?? 'Goal'} (${goal.type ?? '-'}, ${goal.domain ?? '-'})`).join('\n');
  const prompt = `The user is looking at their day for ${dateStr}. Here are their active goals:

${goalsSummary}

Based on these goals, are there any major real-world events, economic data releases, or contextual heads-ups they should be aware of today? Return a JSON array of objects with { "title": "...", "category": "...", "searchQuery": "..." }. Keep it under 3 items. If nothing is relevant, return an empty array []. Return ONLY valid JSON.`;

  try {
    if (apiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await tryGenerate(genAI, prompt);
      const text = result?.response?.text?.();
      if (typeof text === 'string') {
        let raw = sanitizeJsonResponse(text).trim();
        const arrMatch = raw.match(/\[[\s\S]*\]/);
        if (arrMatch) raw = arrMatch[0];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 3).filter((item) => item && typeof item.title === 'string').map((item) => ({
            title: String(item.title).trim(),
            category: typeof item.category === 'string' ? item.category.trim() : 'General',
            searchQuery: typeof item.searchQuery === 'string' ? item.searchQuery.trim() : String(item.title).trim(),
          }));
        }
      }
    }
    const groqKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY;
    if (groqKey) {
      const groqText = await fetchFromGroq(prompt);
      let raw = sanitizeJsonResponse(groqText).trim();
      const arrMatch = raw.match(/\[[\s\S]*\]/);
      if (arrMatch) raw = arrMatch[0];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 3).filter((item) => item && typeof item.title === 'string').map((item) => ({
          title: String(item.title).trim(),
          category: typeof item.category === 'string' ? item.category.trim() : 'General',
          searchQuery: typeof item.searchQuery === 'string' ? item.searchQuery.trim() : String(item.title).trim(),
        }));
      }
    }
  } catch (err) {
    console.warn('generateMorningBriefing failed:', err?.message || err);
  }

  return [];
}

export async function generateSpiritInsight(logs, goals, upcomingPlan) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    const logsText = formatLast10Logs(anonymizeLogs(logs ?? []));
    const goalsText = formatGoals(goals ?? []);
    const planText = formatUpcomingPlan(upcomingPlan ?? []);
    const userPrompt = `Here is the gardener's data.

Last 10 journal entries:
${logsText}

Seeds (goals) they are growing:
${goalsText}

This week's load (upcoming plan):
${planText}

Give one short Mochi Spirit insight (2 sentences max): find a pattern or gentle contradiction, and encourage them with seeds, weather, or tea.`;

    const result = await tryGenerate(genAI, `${SYSTEM_INSTRUCTIONS}\n\n${userPrompt}`);
    const text = result?.response?.text?.();
    return typeof text === 'string' ? text.trim().replace(/\n+/g, ' ').slice(0, 320) : null;
  } catch (err) {
    console.warn('Gemini generateSpiritInsight:', err?.message || err);
    return null;
  }
}

export async function generateHabitSynergy(newGoalTitle) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const title = typeof newGoalTitle === 'string' ? newGoalTitle.trim() : '';
  if (!title) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = `The user just created a new goal or routine: '${title.replace(/'/g, "\\'")}'. Identify one highly effective, small synergistic habit they could stack with this. Return strictly a JSON object: { "hasSynergy": boolean, "suggestedHabitTitle": "string", "pitchText": "string" }. If no good stack comes to mind, set hasSynergy to false and use empty strings.`;
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
