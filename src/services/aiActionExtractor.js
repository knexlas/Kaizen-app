/**
 * Lightweight extraction of action candidates from assistant message text.
 * Used by AI Action Chips to derive a task title and optional steps.
 */

const MAX_TITLE_LEN = 60;
const FALLBACK_TITLE = 'Tiny next step';

/** Strip leading/trailing emojis and normalize whitespace */
function normalize(s) {
  if (typeof s !== 'string') return '';
  let t = s.replace(/\s+/g, ' ').trim();
  t = t.replace(/^[\u{1F300}-\u{1F9FF}\s]+/u, '').replace(/[\u{1F300}-\u{1F9FF}\s]+$/u, '').trim();
  return t;
}

/**
 * Extract a single candidate task title from assistant message text.
 * - If bullets exist (lines starting with - or *), use first bullet as title.
 * - Else use first sentence.
 * - Normalize whitespace, strip emojis at ends, cap length.
 * @param {string} text - Full assistant message
 * @returns {{ title: string, steps?: string[] }}
 */
export function extractActionCandidate(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { title: FALLBACK_TITLE };
  }

  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => /^[-*•]\s*/.test(l) || /^\d+\.\s*/.test(l));
  const firstBullet = bullets.length > 0 ? bullets[0].replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '') : null;
  const firstSentence = lines[0] ? lines[0].replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '') : null;

  let title = firstBullet ?? firstSentence ?? FALLBACK_TITLE;
  title = normalize(title);
  if (title.length > MAX_TITLE_LEN) title = title.slice(0, MAX_TITLE_LEN - 1).trim();
  if (!title) title = FALLBACK_TITLE;

  const steps = bullets.length > 1 ? bullets.slice(0, 5).map((b) => normalize(b.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, ''))) : undefined;
  return { title, steps };
}

/**
 * Split message into up to maxSteps short step strings (from bullets or sentences).
 * @param {string} text - Assistant message
 * @param {number} maxSteps - Default 3
 * @returns {string[]}
 */
export function splitIntoSteps(text, maxSteps = 3) {
  if (typeof text !== 'string' || !text.trim()) return [];

  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => /^[-*•]\s*/.test(l) || /^\d+\.\s*/.test(l));
  if (bullets.length > 0) {
    return bullets
      .slice(0, maxSteps)
      .map((b) => normalize(b.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '')))
      .filter(Boolean);
  }
  const sentences = text.split(/[.!?]+/).map((s) => normalize(s)).filter(Boolean);
  return sentences.slice(0, maxSteps).filter(Boolean);
}
