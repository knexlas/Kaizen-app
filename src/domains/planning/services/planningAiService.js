import { fetchFromGroq, getApiKey, sanitizeJsonResponse, tryGenerate } from '../../assistant/services/aiClient';

function sanitizeStepList(parsed, fallback = []) {
  const list = Array.isArray(parsed) ? parsed : fallback;
  return list
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function breakDownTask(taskTitle) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const title = typeof taskTitle === 'string' ? taskTitle.trim() : '';
  if (!title) return null;

  const prompt = `Break down the task '${title.replace(/'/g, "\\'")}' into 3-5 very small, actionable subtasks (max 4 words each). Return ONLY a JSON array of strings.`;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await tryGenerate(genAI, prompt);
    const text = result?.response?.text?.();
    if (typeof text !== 'string') return null;

    let raw = sanitizeJsonResponse(text);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) raw = jsonMatch[0];
    const parsed = JSON.parse(raw);
    const strings = Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
      : [];
    return strings.length > 0 ? strings : null;
  } catch (err) {
    console.warn('Gemini breakDownTask failed, trying Groq:', err?.message || err);
    try {
      const groqText = await fetchFromGroq(prompt);
      let raw = sanitizeJsonResponse(groqText);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) raw = jsonMatch[0];
      const parsed = JSON.parse(raw);
      const strings = Array.isArray(parsed)
        ? parsed.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
        : [];
      return strings.length > 0 ? strings : null;
    } catch (groqErr) {
      console.warn('Groq breakDownTask fallback failed:', groqErr?.message || groqErr);
      return null;
    }
  }
}

export async function generateNextThreeSteps(goalTitle, existingSteps = []) {
  const title = typeof goalTitle === 'string' ? goalTitle.trim() : '';
  if (!title) return [];

  const existing = Array.isArray(existingSteps)
    ? existingSteps.map((step) => String(step ?? '').trim()).filter(Boolean).slice(0, 8)
    : [];

  const apiKey = getApiKey();
  const prompt = `Goal: "${title.replace(/"/g, '\\"')}".
Existing steps:
${existing.length > 0 ? existing.map((step) => `- ${step}`).join('\n') : '- none'}

Return ONLY valid JSON as an array of exactly 3 short executable next steps. Each step should be concrete, action-first, and realistic within 5-30 minutes.`;

  try {
    if (apiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await tryGenerate(genAI, prompt);
      const text = result?.response?.text?.();
      if (typeof text === 'string') {
        const raw = sanitizeJsonResponse(text);
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const clean = sanitizeStepList(parsed);
          if (clean.length > 0) return clean.slice(0, 3);
        }
      }
    }
  } catch (err) {
    console.warn('Gemini generateNextThreeSteps failed:', err?.message || err);
  }

  const fallback = await breakDownTask(title);
  return sanitizeStepList(fallback, [title]).slice(0, 3);
}

export async function rewriteTaskAsExecutable(taskTitle) {
  const title = typeof taskTitle === 'string' ? taskTitle.trim() : '';
  if (!title) return null;

  const apiKey = getApiKey();
  const prompt = `Rewrite this vague task into one short, executable action that can be started within 5-20 minutes: "${title.replace(/"/g, '\\"')}".
Return ONLY valid JSON: { "title": "..." }`;

  try {
    if (apiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await tryGenerate(genAI, prompt);
      const text = result?.response?.text?.();
      if (typeof text === 'string') {
        const raw = sanitizeJsonResponse(text);
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const cleanTitle = String(parsed?.title ?? '').trim();
          if (cleanTitle) return cleanTitle;
        }
      }
    }
  } catch (err) {
    console.warn('Gemini rewriteTaskAsExecutable failed:', err?.message || err);
  }

  const fallback = await breakDownTask(title);
  return sanitizeStepList(fallback, [title])[0] ?? title;
}

export async function draftPlanFromNote(noteText) {
  const title = typeof noteText === 'string' ? noteText.trim() : '';
  if (!title) return null;

  const apiKey = getApiKey();
  const prompt = `Turn this raw note into a simple draft plan: "${title.replace(/"/g, '\\"')}".
Return ONLY valid JSON:
{
  "title": "short project title",
  "estimatedMinutes": number,
  "steps": ["step 1", "step 2", "step 3"]
}
Steps should be concrete and executable.`;

  try {
    if (apiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await tryGenerate(genAI, prompt);
      const text = result?.response?.text?.();
      if (typeof text === 'string') {
        const raw = sanitizeJsonResponse(text);
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const cleanSteps = sanitizeStepList(parsed?.steps, []);
          const cleanTitle = String(parsed?.title ?? '').trim() || title;
          const estimatedMinutes = Math.max(10, Math.min(240, Number(parsed?.estimatedMinutes) || 45));
          if (cleanSteps.length > 0) {
            return { title: cleanTitle, estimatedMinutes, steps: cleanSteps.slice(0, 5) };
          }
        }
      }
    }
  } catch (err) {
    console.warn('Gemini draftPlanFromNote failed:', err?.message || err);
  }

  const fallbackSteps = await generateNextThreeSteps(title, []);
  return {
    title,
    estimatedMinutes: 45,
    steps: sanitizeStepList(fallbackSteps, [title]).slice(0, 3),
  };
}
