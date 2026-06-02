// Input helpers for the tax-form kit (parse + live formatting). For DISPLAY use
// `formatCurrency` from src/utils/currency — the app-wide single source of truth
// ("Rs 1,234,567"). These two replace the comma-formatting closure that was
// copy-pasted across every IncomeTax form.

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
