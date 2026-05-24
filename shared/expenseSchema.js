// Shared expense schema — the single source of truth for the enums and
// derivations that the backend, mobile, and (eventually) the web all need
// to agree on.
//
// Consumed by:
//   backend/src/services/mobileExpenseHelpers.js (server-side validator)
//   mobile/src/services/expensesDb.js            (tax-year derivation)
//   mobile/src/screens/ExpenseCaptureScreen.js   (UI picker options)
//
// CommonJS so Node can `require()` directly. Mobile (Metro/Babel) handles
// CJS interop transparently — `import { CATEGORIES } from '...'` works.
// Metro is configured to watch this folder via mobile/metro.config.js.

// Spend categories the user can tag on a captured expense. Adding a value
// here means adding it everywhere that consumes the schema (mobile picker
// + backend validator) in one place — no more drift between the two.
const CATEGORIES = Object.freeze([
  'groceries', 'food_dining', 'transport', 'fuel', 'utilities', 'rent',
  'mortgage', 'medical', 'education', 'insurance', 'zakat', 'charity',
  'family_support', 'repairs', 'communication', 'entertainment',
  'business_supplies', 'professional_fees', 'taxes_paid', 'asset_purchase',
  'other',
]);

const PAYMENT_METHODS = Object.freeze(['cash', 'bank', 'card', 'wallet', 'other']);

// Where on the tax return this expense flows. Mapped by the server when
// suggesting prefills for tax-form fields.
const TAX_TREATMENTS = Object.freeze([
  'zakat', 'donation', 'medical', 'advance_tax', 'business_expense',
  'asset_purchase', 'personal', 'unknown',
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Pakistan tax year runs 1 July YYYY to 30 June YYYY+1, labelled 'YYYY-YY'
// (e.g. '2025-26' covers 1 Jul 2025 – 30 Jun 2026). `occurredOn` is
// YYYY-MM-DD; throws on malformed input so callers see invalid data early.
function deriveTaxYear(occurredOn) {
  if (typeof occurredOn !== 'string' || !DATE_RE.test(occurredOn)) {
    throw new Error('occurred_on must be YYYY-MM-DD');
  }
  const [y, m] = occurredOn.split('-').map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
    throw new Error('occurred_on is not a real date');
  }
  const startYear = m >= 7 ? y : y - 1;
  const endTwoDigit = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endTwoDigit}`;
}

module.exports = {
  CATEGORIES,
  PAYMENT_METHODS,
  TAX_TREATMENTS,
  // Set-typed mirrors for fast `has()` checks in validators. Pre-built once
  // at module-load time so consumers don't recreate them per-request.
  CATEGORIES_SET: new Set(CATEGORIES),
  PAYMENT_METHODS_SET: new Set(PAYMENT_METHODS),
  TAX_TREATMENTS_SET: new Set(TAX_TREATMENTS),
  deriveTaxYear,
};
