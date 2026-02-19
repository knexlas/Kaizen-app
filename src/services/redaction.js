/**
 * Lightweight PII redaction for user text before sending to AI APIs.
 */

const TOKENS = { email: '[EMAIL]', phone: '[PHONE]', address: '[ADDRESS]', url: '[URL]', id: '[ID]' };
const STREET_SUFFIX = /straat|street|laan|road|rd|ave|avenue|weg|plein|ln|drive|dr|blvd/i;

export function redactUserText(text) {
  const redactions = { email: 0, phone: 0, address: 0, url: 0, id: 0 };
  if (typeof text !== 'string') return { redactedText: '', redactionCount: 0, redactions };
  let out = text;

  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => { redactions.email += 1; return TOKENS.email; });
  out = out.replace(/(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi, () => { redactions.url += 1; return TOKENS.url; });
  out = out.replace(/(\+?\d[\d\s().-]{7,}\d)/g, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 9 && digits.length <= 15) { redactions.phone += 1; return TOKENS.phone; }
    return match;
  });
  out = out.replace(/\b\d{8,}\b/g, () => { redactions.id += 1; return TOKENS.id; });
  // Address: number + street word (with optional accented chars À-ÿ), only if suffix like straat/street/laan
  out = out.replace(/\b\d{1,4}\s+[A-Za-z\u00C0-\u00FF][A-Za-z\u00C0-\u00FF\s.'-]{2,}\b/g, (match) => {
    if (STREET_SUFFIX.test(match)) { redactions.address += 1; return TOKENS.address; }
    return match;
  });

  const redactionCount = redactions.email + redactions.phone + redactions.address + redactions.url + redactions.id;
  return { redactedText: out, redactionCount, redactions };
}
