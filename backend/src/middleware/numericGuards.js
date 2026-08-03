/**
 * Money-field input guards (QA findings F-07 / F-08 / F-09).
 *
 * WHY THIS EXISTS
 * ---------------
 * Every form route in this app cleans money input with some variant of
 * `parseFloat(String(v).replace(/,/g,''))` and falls back to 0 when the parse
 * fails. That fallback is the bug: it is indistinguishable, at the database,
 * from the taxpayer genuinely entering zero. QA reproduced three consequences
 * against POST /api/income-form/2025-26:
 *
 *   F-07  {"annual_basic_salary": -5000000}      -> HTTP 200, stored -5000000.00.
 *         The tax engine clamps at 0 so no negative tax is produced, but the
 *         negative rupee figure still flows into wealth reconciliation and the
 *         filed PDF, where it is nonsense.
 *   F-08  {"annual_basic_salary": 99999999999999} -> HTTP 500 opaque error.
 *         These columns are DECIMAL(15,2): 13 integer digits, so the largest
 *         storable value is 9,999,999,999,999.99. Postgres raises 22003
 *         "numeric field overflow" and the route's catch-all turns it into a
 *         generic 500 the user cannot act on.
 *   F-09  {"annual_basic_salary": "not-a-number"} -> HTTP 200, stored 0.00.
 *         Silent destruction of a figure the user was told had been saved.
 *
 * WHAT IT DELIBERATELY DOES *NOT* CHANGE
 * --------------------------------------
 * The lenient parse itself is load-bearing and QA-verified. All of these must
 * keep working exactly as they do today:
 *
 *     "1,200,000"    -> 1200000.00      "1200000.75"  -> 1200000.75
 *     "  1200000  "  -> 1200000.00      "1.2e6"       -> 1200000.00
 *
 * So the guard rejects *true junk only*: a non-empty value whose parse yields
 * no number at all. Empty string / null / undefined continue to mean "field
 * not supplied", never "field invalid" — the forms are saved incrementally and
 * a half-filled form must stay savable.
 *
 * HOW THE GUARDED FIELD SET IS CHOSEN
 * -----------------------------------
 * Not "every key in the body" (that would reject booleans, `_yn` flags, ids and
 * the tax-year string) and not a hardcoded field-name list (that goes stale the
 * moment a column is added — exactly the failure mode that sank the previous
 * remediation pass). Instead the set is derived from the target table's own
 * schema: every non-generated DECIMAL/NUMERIC column is money, and the column's
 * declared precision/scale gives the storable maximum for free, so F-08's limit
 * is never a literal that can drift away from the migration.
 *
 * A route may additionally declare `alsoGuard` for money *inputs* that are not
 * themselves columns (the income form's `monthly_*` fields, for instance, are
 * annualised by CalculationService before they reach a column). Those are held
 * to DEFAULT_MONEY_MAX; the post-calculation values are separately checked with
 * assertStorable() so an annualised overflow is still a 400, not a 500.
 */

const { pool } = require('../config/database');
const { ALLOWED_TABLES } = require('../helpers/tableColumns');
const logger = require('../utils/logger');

/**
 * Fallback ceiling for a money input that has no column of its own to describe
 * it (route-declared derived inputs), and for the degraded path where schema
 * introspection is unavailable.
 *
 * Derivation: every money column on every form table in this schema is
 * DECIMAL(15,2) — 15 significant digits with 2 after the point, i.e. 13 integer
 * digits — so the largest storable value is 10^13 - 0.01 = 9,999,999,999,999.99.
 * Anything above it is a Postgres 22003 overflow, which is what F-08 was.
 */
const DEFAULT_MONEY_MAX = 9999999999999.99;

// Reason codes are part of the response contract; the frontend keys field-level
// error styling off them, so do not rename without telling that lane.
const REASONS = {
  NOT_A_NUMBER: 'NOT_A_NUMBER',
  NEGATIVE_AMOUNT: 'NEGATIVE_AMOUNT',
  AMOUNT_TOO_LARGE: 'AMOUNT_TOO_LARGE',
};

// tableName -> Map(columnName -> { precision, scale, max })
const moneyColumnCache = new Map();

/**
 * Largest value a DECIMAL(precision, scale) column can hold.
 * DECIMAL(15,2) -> 10^(15-2) - 10^-2 = 9999999999999.99
 */
function maxForPrecision(precision, scale) {
  if (!Number.isFinite(precision) || !Number.isFinite(scale)) return DEFAULT_MONEY_MAX;
  return Math.pow(10, precision - scale) - Math.pow(10, -scale);
}

/**
 * The money columns of `tableName`, keyed by column name.
 *
 * Same shape of contract as helpers/tableColumns.getAllowedColumns: allow-listed
 * table names only (the name is interpolated into no SQL, but the allow list is
 * what keeps callers from introspecting arbitrary tables), cached for process
 * lifetime because DDL does not change under a running container.
 *
 * Generated columns are excluded: they are computed by the database from the
 * input columns, so a client can never write one and rejecting on one would be
 * a false positive.
 */
async function getMoneyColumns(tableName) {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(`Table "${tableName}" is not in the save-form allow list`);
  }
  if (moneyColumnCache.has(tableName)) return moneyColumnCache.get(tableName);

  const result = await pool.query(
    `SELECT column_name, numeric_precision, numeric_scale
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
        AND is_generated = 'NEVER'
        AND data_type IN ('numeric', 'decimal')`,
    [tableName]
  );

  const columns = new Map();
  for (const row of result.rows) {
    const precision = row.numeric_precision === null ? NaN : Number(row.numeric_precision);
    const scale = row.numeric_scale === null ? NaN : Number(row.numeric_scale);
    columns.set(row.column_name, {
      precision,
      scale,
      max: maxForPrecision(precision, scale),
    });
  }

  if (columns.size === 0) {
    throw new Error(`No money columns found for table "${tableName}"`);
  }
  moneyColumnCache.set(tableName, columns);
  return columns;
}

/**
 * The single parse used for every money input on the guarded routes.
 *
 * Extracted verbatim from the cleaning loop that was inline in
 * routes/incomeForm.js so that the guard and the code that actually computes
 * the stored value can never disagree about what a string means. If these two
 * ever diverge you get a value that passes validation and then stores something
 * else — which is how F-09 shipped in the first place.
 *
 * @returns {{supplied: boolean, valid: boolean, value: number|null}}
 *   supplied=false  -> '', null, undefined, whitespace-only. Means "the user did
 *                      not fill this in", NOT an error. Callers store 0.
 *   valid=false     -> non-empty but unparseable. This is the F-09 case.
 */
/**
 * Normalise the ways a Pakistani filer actually writes an amount.
 *
 * The strict "parse in full or refuse" rule below is correct — silently turning
 * "12,00x,000" into Rs 1,200 was a four-order-of-magnitude corruption reported
 * as success. But strictness alone refused several forms that are perfectly
 * ordinary here, and a guard that blocks lawful input is its own defect:
 *
 *   "Rs 1,200,000"    a figure pasted from a payslip or bank statement
 *   "1,200,000/-"     idiomatic in Pakistani and Indian business writing
 *   "1 200 000"       space grouping
 *   "١٢٠٠٠٠٠"          Arabic-Indic digits; "۱۲۰۰۰۰۰" the Urdu/Persian forms
 *   "(1,200)"         accounting negative
 *
 * Each of those has exactly ONE possible reading, which is what makes
 * normalising them safe. Nothing ambiguous is guessed: a stray letter, a
 * mis-grouped separator or a second decimal point still fails, and the space
 * form is only accepted when the spaces group in threes — the same test the
 * commas get, so "12 34" is still refused rather than becoming 1234.
 *
 * Returns the canonical ASCII string, or null when the input is not salvageable.
 */
function normaliseMoneyString(raw) {
  let s = String(raw);

  // Unicode spaces (NBSP, thin, narrow-NBSP) behave as ordinary separators.
  s = s.replace(/[    ]/g, ' ').trim();

  // Arabic-Indic (U+0660..) and Extended Arabic-Indic (U+06F0..) digits.
  s = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
       .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
  // Arabic decimal separator and thousands separator.
  s = s.replace(/٫/g, '.').replace(/٬/g, ',');

  // Currency prefix and the "/-" or "/=" suffix.
  s = s.replace(/^(?:rs\.?|pkr|₨)\s*/i, '').replace(/\s*\/[-=]$/, '').trim();

  // Accounting negative: (1,200) means -1200. Only when it wraps the WHOLE
  // value, and it stays negative so a negative-amount guard still refuses it
  // with the right reason instead of a confusing "not a number".
  let negated = false;
  const paren = s.match(/^\((.*)\)$/);
  if (paren) {
    negated = true;
    s = paren[1].trim();
  }

  const sign = s.match(/^[+-]/) ? s[0] : '';
  let body = sign ? s.slice(1).trim() : s;

  // Space-grouped thousands — accepted only when the grouping is valid, exactly
  // as for commas. Converted to commas so one grouping check covers both.
  if (/\s/.test(body)) {
    if (!/^\d{1,3}(?: \d{3})*(?:\.\d+)?$/.test(body)) return null;
    body = body.replace(/ /g, ',');
  }

  const out = (negated ? '-' : sign) + body;
  return out === '' || out === '-' || out === '+' ? null : out;
}

function parseMoneyInput(value) {
  if (value === null || value === undefined) {
    return { supplied: false, valid: true, value: null };
  }

  if (typeof value === 'number') {
    // NaN / Infinity can arrive via JSON only as a non-number, but a caller
    // passing computed values in (assertStorable) can produce them.
    if (!Number.isFinite(value)) {
      return { supplied: true, valid: false, value: null };
    }
    return { supplied: true, valid: true, value };
  }

  if (typeof value === 'string') {
    if (value.trim() === '') return { supplied: false, valid: true, value: null };

    // Canonicalise the locally-idiomatic forms first — see normaliseMoneyString.
    const trimmed = normaliseMoneyString(value);
    if (trimmed === null) return { supplied: true, valid: false, value: null };

    // THOUSANDS SEPARATORS MUST ACTUALLY SEPARATE THOUSANDS.
    //
    // Blind comma-stripping is lossy in a way that hides typing mistakes:
    // "1,2,3" strips to "123" and passes as a perfectly good number, so a
    // mis-typed amount becomes a plausible one. If commas are present they must
    // group correctly — 1-3 digits, then any number of `,ddd` groups — before
    // the integer part is allowed through.
    if (trimmed.includes(',')) {
      const integerPart = trimmed.replace(/^[+-]/, '').split('.')[0];
      if (!/^\d{1,3}(?:,\d{3})*$/.test(integerPart)) {
        return { supplied: true, valid: false, value: null };
      }
    }

    // Comma stripping keeps "1,200,000" working; the numeric grammar keeps
    // "1.2e6" and surrounding whitespace working. Both are QA-verified.
    const stripped = trimmed.replace(/,/g, '');

    // PARSE THE WHOLE STRING OR NONE OF IT.
    //
    // `parseFloat` stops at the first character it cannot use and returns what it
    // has, so partial garbage came back as a plausible number and passed every
    // check downstream:
    //     "12,00x,000" -> parseFloat("1200x000") -> 1200      (Rs 1,200)
    //     "1,2,3"      -> 123
    //     "1e"         -> 1
    //     "0x10"       -> 0
    // The first of those is the dangerous one: Rs 12,000,000 silently became
    // Rs 1,200 and the save reported success. That is F-09 again by a different
    // door — the earlier fix only caught input with NO leading digits.
    //
    // The grammar below is exactly what the working formats need and nothing
    // more: optional sign, digits with an optional decimal part (or a bare
    // decimal like ".5"), and an optional exponent. Anything with a stray
    // character anywhere is refused outright rather than truncated.
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(stripped)) {
      return { supplied: true, valid: false, value: null };
    }

    const parsed = Number(stripped);
    if (!Number.isFinite(parsed)) {
      return { supplied: true, valid: false, value: null };
    }
    return { supplied: true, valid: true, value: parsed };
  }

  // Booleans, objects and arrays are not money. The old code coerced every one
  // of them to 0 and reported success — the same silent loss as F-09.
  return { supplied: true, valid: false, value: null };
}

function describe(field) {
  return field.replace(/_/g, ' ');
}

/**
 * Validate a bag of money values against per-field maxima.
 *
 * Collects EVERY violation rather than short-circuiting on the first: a
 * taxpayer correcting a 20-field form should see all of their mistakes at once,
 * not rediscover them one save at a time.
 *
 * @param {object} values            field -> raw input
 * @param {Map<string,{max:number}>} columnMeta  money columns of the target table
 * @param {Iterable<string>} fields  the fields to consider (already the guarded set)
 * @returns {Array<{field: string, code: string, message: string}>}
 */
function collectMoneyViolations(values, columnMeta, fields) {
  const violations = [];

  for (const field of fields) {
    // Never reject a field the request did not send. `hasOwnProperty` rather
    // than a truthiness test so an explicit 0 is still inspected.
    if (!Object.prototype.hasOwnProperty.call(values, field)) continue;

    const raw = values[field];
    const parsed = parseMoneyInput(raw);

    if (!parsed.supplied) continue; // blank means "not filled in", not invalid

    if (!parsed.valid) {
      violations.push({
        field,
        code: REASONS.NOT_A_NUMBER,
        message: `${describe(field)} must be a number. Remove any text or symbols and enter the amount in rupees.`,
      });
      continue;
    }

    if (parsed.value < 0) {
      // F-07. The tax engine clamps negatives to zero so the *tax* was never
      // wrong, but the stored figure reaches wealth reconciliation and the PDF,
      // where a negative salary is not a number any reviewer can defend.
      violations.push({
        field,
        code: REASONS.NEGATIVE_AMOUNT,
        message: `${describe(field)} cannot be negative.`,
      });
      continue;
    }

    const meta = columnMeta.get(field);
    const max = meta ? meta.max : DEFAULT_MONEY_MAX;
    if (parsed.value > max) {
      // F-08. Caught here the user gets an actionable 400; left to Postgres it
      // is a 22003 numeric overflow surfaced as an opaque 500.
      violations.push({
        field,
        code: REASONS.AMOUNT_TOO_LARGE,
        message: `${describe(field)} exceeds the maximum storable amount of ${max.toLocaleString('en-US', { maximumFractionDigits: 2 })}.`,
      });
    }
  }

  return violations;
}

/**
 * Express middleware factory.
 *
 * @param {object}   options
 * @param {string}   options.table       allow-listed table whose DECIMAL columns
 *                                       define the guarded set and the maxima
 * @param {string[]} [options.alsoGuard] extra money *inputs* the route accepts
 *                                       that are not columns of `table` (e.g.
 *                                       fields annualised before storage). Pass
 *                                       the route's existing input list rather
 *                                       than writing a second one to maintain.
 *
 * Responds 400 with EVERY offending field:
 *   { success: false, message, errors: [{ field, code, message }] }
 */
function guardMoneyFields({ table, alsoGuard = [] }) {
  return async function guardMoneyFieldsMiddleware(req, res, next) {
    try {
      let columnMeta;
      try {
        columnMeta = await getMoneyColumns(table);
      } catch (introspectionError) {
        // Degrade quietly on availability, never on integrity: if we cannot
        // read the schema we still enforce not-junk / not-negative / not-absurd
        // using the documented DECIMAL(15,2) fallback.
        logger.warn(
          `Money-column introspection failed for ${table}; falling back to DEFAULT_MONEY_MAX`,
          { error: introspectionError.message }
        );
        columnMeta = new Map();
      }

      const body = req.body || {};
      // Union, de-duplicated: schema-derived money columns (self-updating) plus
      // the route's declared derived inputs.
      const guarded = new Set([...columnMeta.keys(), ...alsoGuard]);

      const errors = collectMoneyViolations(body, columnMeta, guarded);
      if (errors.length > 0) {
        logger.warn(`Rejected ${errors.length} invalid money field(s) on ${req.originalUrl}`, {
          userId: req.user && req.user.id,
          fields: errors.map((e) => `${e.field}:${e.code}`),
        });
        return res.status(400).json({
          success: false,
          message:
            errors.length === 1
              ? 'One amount could not be accepted. Please correct it and save again.'
              : `${errors.length} amounts could not be accepted. Please correct them and save again.`,
          errors,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Post-calculation storability check.
 *
 * The middleware sees only what the client sent. A route that derives stored
 * values from that input (the income form annualises `monthly_*` by 12) can
 * still produce an out-of-range figure from in-range input, which would land as
 * the same opaque 500 F-08 described. Call this on the values that are actually
 * about to be bound into the INSERT.
 *
 * @returns {Array} same violation shape as collectMoneyViolations (empty = ok)
 */
async function assertStorable(table, dbData) {
  let columnMeta;
  try {
    columnMeta = await getMoneyColumns(table);
  } catch (introspectionError) {
    logger.warn(`assertStorable introspection failed for ${table}; using DEFAULT_MONEY_MAX`, {
      error: introspectionError.message,
    });
    columnMeta = new Map();
  }
  return collectMoneyViolations(dbData, columnMeta, Object.keys(dbData));
}

/**
 * Test seam. `moneyColumnCache` is keyed by table name and holds the precision
 * read from information_schema, so a suite that mocked the schema differently
 * leaves the WRONG ceiling behind for the next suite in the same Jest worker —
 * which showed up as a boundary test that passed alone and failed in the full
 * run. Cheaper to reset than to reason about worker scheduling.
 */
function _resetMoneyColumnCache() {
  moneyColumnCache.clear();
}

module.exports = {
  guardMoneyFields,
  _resetMoneyColumnCache,
  normaliseMoneyString,
  assertStorable,
  parseMoneyInput,
  collectMoneyViolations,
  getMoneyColumns,
  maxForPrecision,
  DEFAULT_MONEY_MAX,
  REASONS,
};
