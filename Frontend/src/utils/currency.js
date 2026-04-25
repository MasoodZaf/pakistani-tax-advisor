// Currency formatting helpers — single source of truth for PKR display.
//
// Before this util, every form re-defined its own `formatCurrency(value)`,
// each with subtle drift (some accepted strings, some didn't; some defaulted
// to 0 on null, some printed "PKR NaN"). Drift like that costs trust on a
// tax form. Use these helpers everywhere.

const PKR_FORMATTER = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const PLAIN_FORMATTER = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format a value as a PKR currency string ("Rs 1,234,567"). Tolerant of:
 *   - null / undefined / '' → "Rs 0"
 *   - numeric strings ("1234") → "Rs 1,234"
 *   - non-finite (NaN, Infinity) → "Rs 0"
 */
export function formatPKR(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return PKR_FORMATTER.format(0);
  return PKR_FORMATTER.format(n);
}

/**
 * Format a value as plain grouped digits ("1,234,567"). Same tolerance as
 * formatPKR but no currency symbol — useful inside tables where the column
 * header already states the unit.
 */
export function formatNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return PLAIN_FORMATTER.format(0);
  return PLAIN_FORMATTER.format(n);
}

// Back-compat alias — most existing call sites use `formatCurrency`.
export const formatCurrency = formatPKR;

export default formatPKR;
