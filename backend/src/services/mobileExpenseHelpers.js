// Pure helpers for /api/mobile/v1/expenses — validation, tax-year derivation,
// cursor codec. Kept side-effect-free so they're easy to unit test without
// spinning up the DB.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const CATEGORIES = new Set([
  'groceries', 'food_dining', 'transport', 'fuel', 'utilities', 'rent',
  'mortgage', 'medical', 'education', 'insurance', 'zakat', 'charity',
  'family_support', 'repairs', 'communication', 'entertainment',
  'business_supplies', 'professional_fees', 'taxes_paid', 'asset_purchase',
  'other',
]);

const PAYMENT_METHODS = new Set(['cash', 'bank', 'card', 'wallet', 'other']);

const TAX_TREATMENTS = new Set([
  'zakat', 'donation', 'medical', 'advance_tax', 'business_expense',
  'asset_purchase', 'personal', 'unknown',
]);

// Pakistan tax year runs 1 July YYYY to 30 June YYYY+1, labelled
// 'YYYY-YY' (e.g. '2025-26' covers 1 Jul 2025 – 30 Jun 2026).
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

// Validate one change from a /sync batch. Returns { ok: true, normalized }
// or { ok: false, error }. Doesn't touch the DB.
function validateChange(change) {
  if (!change || typeof change !== 'object') {
    return { ok: false, error: 'change_not_an_object' };
  }
  const { op, client_id, client_updated_at } = change;

  if (op !== 'upsert' && op !== 'delete') {
    return { ok: false, error: 'invalid_op' };
  }
  if (!UUID_RE.test(client_id || '')) {
    return { ok: false, error: 'invalid_client_id' };
  }
  if (!isParseableIso(client_updated_at)) {
    return { ok: false, error: 'invalid_client_updated_at' };
  }

  if (op === 'delete') {
    return { ok: true, normalized: { op, client_id, client_updated_at } };
  }

  // Upsert: full field validation.
  const {
    amount, currency, fx_rate_to_pkr, amount_pkr,
    occurred_on, category, description, payee, payment_method,
    tax_treatment, tax_section, receipt_id,
  } = change;

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'invalid_amount' };
  }
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, error: 'invalid_currency' };
  }
  if (!DATE_RE.test(occurred_on || '')) {
    return { ok: false, error: 'invalid_occurred_on' };
  }
  try { deriveTaxYear(occurred_on); }
  catch { return { ok: false, error: 'invalid_occurred_on' }; }

  if (!CATEGORIES.has(category)) {
    return { ok: false, error: 'invalid_category' };
  }
  if (payment_method != null && !PAYMENT_METHODS.has(payment_method)) {
    return { ok: false, error: 'invalid_payment_method' };
  }
  if (tax_treatment != null && !TAX_TREATMENTS.has(tax_treatment)) {
    return { ok: false, error: 'invalid_tax_treatment' };
  }
  if (receipt_id != null && !UUID_RE.test(receipt_id)) {
    return { ok: false, error: 'invalid_receipt_id' };
  }

  // Multi-currency consistency. PKR rows must equal amount; non-PKR rows
  // must carry a positive fx_rate_to_pkr and an explicit amount_pkr.
  let normalizedAmountPkr;
  let normalizedFxRate;
  if (currency === 'PKR') {
    if (fx_rate_to_pkr != null) {
      return { ok: false, error: 'fx_rate_not_allowed_for_pkr' };
    }
    if (amount_pkr != null && Math.abs(amount_pkr - amount) > 0.001) {
      return { ok: false, error: 'amount_pkr_must_equal_amount_for_pkr' };
    }
    normalizedAmountPkr = amount;
    normalizedFxRate = null;
  } else {
    if (typeof fx_rate_to_pkr !== 'number' || !(fx_rate_to_pkr > 0)) {
      return { ok: false, error: 'fx_rate_to_pkr_required_for_non_pkr' };
    }
    if (typeof amount_pkr !== 'number' || !(amount_pkr >= 0)) {
      return { ok: false, error: 'amount_pkr_required_for_non_pkr' };
    }
    normalizedAmountPkr = amount_pkr;
    normalizedFxRate = fx_rate_to_pkr;
  }

  return {
    ok: true,
    normalized: {
      op: 'upsert',
      client_id,
      client_updated_at,
      amount,
      currency,
      fx_rate_to_pkr: normalizedFxRate,
      amount_pkr: normalizedAmountPkr,
      occurred_on,
      category,
      description: description || null,
      payee: payee || null,
      payment_method: payment_method || null,
      tax_year: deriveTaxYear(occurred_on),
      tax_treatment: tax_treatment || null,
      tax_section: tax_section || null,
      receipt_id: receipt_id || null,
    },
  };
}

function isParseableIso(s) {
  if (typeof s !== 'string' || s.length < 10) return false;
  const t = Date.parse(s);
  return !Number.isNaN(t);
}

// Cursor for delta pagination. We encode (updated_at, id) as a base64 JSON
// blob — opaque to the client so we can change the shape later.
function encodeCursor(updatedAt, id) {
  const payload = JSON.stringify({ u: new Date(updatedAt).toISOString(), i: id });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const { u, i } = JSON.parse(json);
    if (!isParseableIso(u) || !UUID_RE.test(i || '')) return null;
    return { updatedAt: u, id: i };
  } catch {
    return null;
  }
}

module.exports = {
  deriveTaxYear,
  validateChange,
  encodeCursor,
  decodeCursor,
  // exposed for tests
  CATEGORIES,
  PAYMENT_METHODS,
  TAX_TREATMENTS,
  UUID_RE,
};
