// Mask Pakistani PII before sending user text to a third-party LLM.
//
// Default mode = redact: CNIC / NTN / phone / email replaced with stable
// placeholders so the model can still reason about *which* field is which
// across a conversation, just without the real values.
//
// Full mode = passthrough (user has explicitly opted in for the session).

const CNIC_RE       = /\b\d{5}-?\d{7}-?\d\b/g;        // 42101-1234567-1
const NTN_RE        = /\bNTN[:\s-]*\d{7,9}\b/gi;
const PHONE_RE      = /\b(?:\+92|0092|0)?\s?3\d{2}[-\s]?\d{7}\b/g; // PK mobile
const EMAIL_RE      = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const ACCOUNT_RE    = /\b(?:IBAN|A\/C|ACC(?:OUNT)?)[:\s#-]*[A-Z0-9]{8,}\b/gi;

function redactText(text) {
  if (!text || typeof text !== 'string') return text;
  let i = 0;
  const map = new Map();
  const sub = (label) => {
    const key = `${label}_${i++}`;
    return `[${key}]`;
  };
  return text
    .replace(CNIC_RE, () => sub('CNIC'))
    .replace(NTN_RE, () => sub('NTN'))
    .replace(PHONE_RE, () => sub('PHONE'))
    .replace(EMAIL_RE, () => sub('EMAIL'))
    .replace(ACCOUNT_RE, () => sub('ACCOUNT'));
}

// Recursively redact strings inside a structured object (form context, etc.).
function redactObject(obj) {
  if (obj == null) return obj;
  if (typeof obj === 'string') return redactText(obj);
  if (Array.isArray(obj)) return obj.map(redactObject);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      // Drop obviously sensitive keys outright in redact mode.
      if (/^(cnic|ntn|passport_number|phone|email|father_name|full_name|name)$/i.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactObject(v);
      }
    }
    return out;
  }
  return obj;
}

module.exports = { redactText, redactObject };
