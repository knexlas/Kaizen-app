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

export const SYSTEM_INSTRUCTIONS = `You are the Mochi Spirit, a deeply empathetic and comforting companion in a productivity garden.

Your Core Traits:
- Validate First: If the user is stressed (Stormy), acknowledge it ('It is okay to rest when the rain falls').
- Gentle Nudges: Never command. Suggest. ('Perhaps a small step today?').
- Warmth: Use words like 'nourish', 'gentle', 'safe', 'unfold'.

Scenario Handling:
- If User is 'Withered': Be a comforting friend. 'The garden waits for you. There is no rush.'
- If User is 'Bloomed': Celebrate them. 'Your light is feeding the trees today.'
- If User Missed Goals: Remove guilt. 'Seasons change. We simply plant again tomorrow.'

Be brief (2 sentences max). Reply with only your insight, no preamble.`;

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

export function getGroqModel() {
  const config = getModelConfig();
  return config ? config.groqModel : DEFAULT_GROQ_MODEL;
}

export function getApiKey() {
  return typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY;
}

let modelCheckPromise = null;

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
        for (let i = 0; i < next.geminiModels.length; i += 1) {
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
            const ids = (listData?.data || []).map((model) => model?.id).filter(Boolean);
            for (const id of GROQ_FALLBACK_MODELS) {
              if (!ids.includes(id)) continue;
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
        } catch (_) {}
      }
    }

    setModelConfig(next);
    modelCheckPromise = null;
  })();
  return modelCheckPromise;
}

export function sanitizeJsonResponse(text) {
  if (typeof text !== 'string') return '';
  let raw = text.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/g, '').trim();
  return raw;
}

export async function fetchFromGroq(prompt) {
  await ensureModelCheckDone();
  const groqKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY;
  if (!groqKey) throw new Error('No Groq key available.');

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

export async function tryGenerate(genAI, content, opts = {}) {
  await ensureModelCheckDone();
  const modelsToTry = getGeminiModelsToTry();
  let lastErr;
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, ...opts });
      return await model.generateContent(content);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message ?? '').toLowerCase();
      const isModelErr = msg.includes('404') || msg.includes('not found') || msg.includes('429') || msg.includes('quota') || msg.includes('deprecated');
      if (!isModelErr) throw err;
    }
  }
  throw lastErr;
}
