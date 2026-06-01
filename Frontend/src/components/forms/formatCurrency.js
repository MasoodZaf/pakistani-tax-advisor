// Shared currency helpers for the tax-form kit. One implementation replaces the
// comma-formatting closure copy-pasted across every IncomeTax form.

// Format a number as grouped digits. Negatives are parenthesised (accounting
// convention used throughout the FBR return), e.g. -2500 -> "(2,500)".
export function formatPKR(value) {
  const num = Number(value);
  if (!isFinite(num)) return '0';
  const abs = new Intl.NumberFormat('en-US').format(Math.round(Math.abs(num)));
  return num < 0 ? `(${abs})` : abs;
}

// Parse a user-entered / formatted string back to a number.
export function parseAmount(str) {
  if (typeof str === 'number') return str;
  const n = Number(String(str ?? '').replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : 0;
}

// Live input formatter: strip non-digits and re-group with thousands separators.
// Returns the display string ('' for empty) — wire to an input's onChange.
export function handleCurrencyInput(raw) {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('en-US').format(Number(digits));
}
