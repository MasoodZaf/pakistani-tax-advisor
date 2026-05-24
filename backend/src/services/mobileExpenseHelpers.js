// Pure helpers for /api/mobile/v1/expenses — validation, tax-year derivation,
// cursor codec. Kept side-effect-free so they're easy to unit test without
// spinning up the DB.
//
// Categories, payment methods, tax treatments, and deriveTaxYear live in
// shared/expenseSchema.js so backend and mobile can't drift. See that file
// for the canonical list.

const {
  CATEGORIES_SET: CATEGORIES,
  PAYMENT_METHODS_SET: PAYMENT_METHODS,
  TAX_TREATMENTS_SET: TAX_TREATMENTS,
  deriveTaxYear,
} = require('../../../shared/expenseSchema');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validate one change from a /sync batch. Returns { ok: true, normalized }
// or { ok: false, error }. Doesn't touch the DB.
//
// `base_updated_at` is the server's `updated_at` value the client last knew
// for this row (echoed back unchanged). Null means "the client has never
// seen a server version" — i.e. this is a brand-new row created offline.
// The server uses it to detect concurrent edits: if the row on the server
// has moved past `base_updated_at`, the push is rejected as a conflict.
// Omitting it puts the change in legacy mode (clock comparison) — kept for
// transitional builds; new clients should always send it.
function validateChange(change) {
  if (!change || typeof change !== 'object') {
    return { ok: false, error: 'change_not_an_object' };
  }
  const { op, client_id, client_updated_at, base_updated_at } = change;

  if (op !== 'upsert' && op !== 'delete') {
    return { ok: false, error: 'invalid_op' };
  }
  if (!UUID_RE.test(client_id || '')) {
    return { ok: false, error: 'invalid_client_id' };
  }
  if (!isParseableIso(client_updated_at)) {
    return { ok: false, error: 'invalid_client_updated_at' };
  }
  // base_updated_at must be either omitted/null or a parseable ISO string.
  // Empty string explicitly invalid — protects against accidental "" sent
  // from a client that didn't initialise the field properly.
  let normalizedBase;
  if (base_updated_at === undefined) {
    normalizedBase = undefined; // legacy mode
  } else if (base_updated_at === null) {
    normalizedBase = null;
  } else if (isParseableIso(base_updated_at)) {
    normalizedBase = base_updated_at;
  } else {
    return { ok: false, error: 'invalid_base_updated_at' };
  }

  if (op === 'delete') {
    return {
      ok: true,
      normalized: { op, client_id, client_updated_at, base_updated_at: normalizedBase },
    };
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
      base_updated_at: normalizedBase,
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
