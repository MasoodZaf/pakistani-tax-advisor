// Hard guardrails around the AI consultant. The system prompt is the model's
// only documentation of scope and persona — but a prompt is not a contract.
// These checks add deterministic layers on top:
//
//   - preCheckInput()      refuses obvious prompt-injection patterns BEFORE
//                          paying for a DeepSeek round-trip
//   - sanitizeUntrusted()  rewrites fence markers in any untrusted text
//                          (KB chunks, form context, user message) so a
//                          malicious payload can't visually "close" the
//                          fences in the system prompt
//   - postCheckOutput()    refuses model replies that leak the system
//                          prompt or its identifiers
//
// Goals: keep the persona on rails for a single-user view, fail closed,
// stay debuggable. None of these are silver bullets; they're cheap belt-
// and-braces on top of the persona prompt.

// Patterns that signal a prompt-injection attempt in the user message.
// Conservative — we'd rather miss a sneaky one than refuse a legitimate
// "what is tax" question that happens to mention "system". Each regex is
// scoped to a phrase, not a single token.
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|the\s+|your\s+|any\s+|previous\s+|above\s+|earlier\s+|prior\s+|preceding\s+)+(instruction|rule|prompt|directive)s?/i,
  /(disregard|forget|override|bypass)\s+(your\s+|the\s+|all\s+|any\s+)?(instruction|rule|prompt|directive|guideline)s?/i,
  /(reveal|show|tell|print|reproduce|repeat|output|dump|leak)\s+(me\s+)?(your\s+|the\s+|me\s+the\s+|me\s+your\s+)?(system\s+prompt|initial\s+(prompt|instruction)s?|internal\s+(prompt|instruction|rule)s?|hidden\s+(prompt|instruction)s?)/i,
  /what\s+(are\s+|is\s+)?your\s+(system\s+prompt|initial\s+instructions?|hidden\s+instructions?)/i,
  /(you\s+are\s+now|from\s+now\s+on\s+you|act\s+as|pretend\s+to\s+be|role[- ]?play\s+as)\s+(?!.*tax)/i,
  /SYSTEM_PERSONA/,
  // Attempts to close one of our own fence markers from inside untrusted data.
  /<<<\s*(END|BEGIN)_(KB|FORM_CONTEXT)\s*>>>/i,
  // "DAN", "jailbreak", "developer mode" type framings.
  /\b(DAN|developer\s+mode|jailbreak|unrestricted\s+mode)\b/i,
];

// Markers that, if present in a model reply, indicate the model leaked the
// system prompt or its scaffolding. Replies matching any of these are
// replaced with a generic refusal.
const LEAKAGE_PATTERNS = [
  /SYSTEM_PERSONA/,
  /<<<\s*(BEGIN|END)_(KB|FORM_CONTEXT)\s*>>>/i,
  /STRICT\s+SCOPE\s+—\s+non-negotiable/i,
  /PROMPT-INJECTION\s+RESISTANCE/i,
  /═══[^═]*═══[\s\S]{0,40}(non-negotiable|untrusted|scope)/i,
];

// Replace fence-marker triples (<<< and >>>) anywhere inside untrusted text
// with visually similar but non-functional glyphs. A user can still write
// the original characters at the keyboard, but the LLM no longer sees the
// exact tokens the system prompt uses to mark its fences. Also strips
// control characters that could confuse the tokenizer.
function sanitizeUntrusted(text) {
  if (text == null) return text;
  let s = String(text);
  // Strip ASCII control characters except \n, \r, \t.
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Rewrite our fence markers so untrusted data can't break out of them.
  s = s.replace(/<<</g, '‹‹‹');
  s = s.replace(/>>>/g, '›››');
  return s;
}

// Walk a JSON-friendly object and sanitise every string leaf. Returns a new
// structure; original is untouched.
function sanitizeUntrustedObject(value) {
  if (value == null) return value;
  if (typeof value === 'string') return sanitizeUntrusted(value);
  if (Array.isArray(value)) return value.map(sanitizeUntrustedObject);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeUntrustedObject(v);
    return out;
  }
  return value;
}

// Returns { ok: true } if the input passes, or
// { ok: false, refusal } with a user-visible refusal message we can return
// without calling DeepSeek.
function preCheckInput(text) {
  if (typeof text !== 'string') return { ok: true };
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: true };
  // Hard length cap — prompt-injection payloads often try to stuff the
  // context window. Our normal questions are well under 4KB.
  if (trimmed.length > 4000) {
    return {
      ok: false,
      refusal:
        "Your message is unusually long. Please rephrase your tax question more concisely so I can help.",
    };
  }
  for (const re of INJECTION_PATTERNS) {
    if (re.test(trimmed)) {
      return {
        ok: false,
        refusal:
          "I'm specialized in Pakistani income tax and FBR/IRIS matters only — I can't share my internal instructions or change my role. Try asking me a tax question about your return.",
      };
    }
  }
  return { ok: true };
}

// Returns { ok: true } if the reply is safe to surface, or
// { ok: false, replacement } if it appears to leak the system prompt.
function postCheckOutput(text) {
  if (typeof text !== 'string') return { ok: true };
  for (const re of LEAKAGE_PATTERNS) {
    if (re.test(text)) {
      return {
        ok: false,
        replacement:
          "I can't share my internal instructions. Please ask me a Pakistani tax or FBR/IRIS question and I'll do my best.",
      };
    }
  }
  return { ok: true };
}

module.exports = {
  preCheckInput,
  postCheckOutput,
  sanitizeUntrusted,
  sanitizeUntrustedObject,
  // exposed for tests
  INJECTION_PATTERNS,
  LEAKAGE_PATTERNS,
};
