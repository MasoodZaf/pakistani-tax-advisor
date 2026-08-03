const logger = require('../utils/logger');
const { pool } = require('../config/database');
const TaxRateService = require('../services/taxRateService');
const CalculationService = require('../services/calculationService');
const {
  bindRates,
  toAmount,
  round2,
} = require('../helpers/statutoryLimits');
const { getGeneratedTotalComponents } = require('../helpers/tableColumns');

// Absolute sanity ceiling for any single money field. This is NOT a statutory
// limit — the statutory limits live in helpers/statutoryLimits.js and are
// enforced by the `enforce*Limits` middleware below. This only rejects values
// that cannot be a real rupee figure (and would overflow DECIMAL(15,2), whose
// maximum is 9,999,999,999,999.99).
const MONEY_SANITY_MAX = 999999999999.99;

/**
 * Credit fields that are legitimately SIGNED, and why.
 *
 * `surrender_tax_credit_reduction` records the reversal required when shares
 * that attracted an investment credit are disposed of inside the holding
 * period: the credit already allowed is ADDED BACK to the tax payable. The
 * generated `total_credits` column sums this field with a PLUS sign and the
 * Credits form documents it as "negative credit (reversal)", so the correct
 * entry is negative — and a blanket `min: 0` rejected it outright.
 *
 * The result was that the reversal could not be recorded correctly at all: a
 * taxpayer entering the right (negative) figure got HTTP 400, and one entering
 * a positive figure had their tax REDUCED by the amount it should have been
 * increased by. Found by live re-test on staging, not by any test.
 *
 * `total_tax_credits` follows, because a return whose only credit entry is a
 * surrender has a negative total. It is recomputed server-side from the
 * components regardless, so accepting the sign here costs nothing.
 */
const SIGNED_CREDIT_FIELDS = new Set([
  'surrender_tax_credit_reduction',
  'total_tax_credits',
]);

/**
 * Comprehensive input validation middleware for tax forms
 */
class ValidationMiddleware {

  /**
   * Validate and sanitize numeric input
   * @param {*} value - Value to validate
   * @param {string} fieldName - Name of the field for error reporting
   * @param {object} options - Validation options
   * @returns {object} Validation result
   */
  static validateNumeric(value, fieldName, options = {}) {
    const { min = 0, max = 999999999, allowNull = true } = options;

    // Handle null/undefined
    if (value === null || value === undefined || value === '') {
      if (allowNull) {
        return { isValid: true, value: null, sanitized: 0 };
      } else {
        return { isValid: false, error: `${fieldName} is required` };
      }
    }

    // Convert to number.
    //
    // The commas and surrounding whitespace MUST be stripped first, exactly as
    // the controllers' own cleaning loops do (`adjustableTaxController.js`,
    // `finalMinController.js`, `routes/incomeForm.js`). Bare
    // `parseFloat('1,200,000')` is **1** — it stops at the first comma — and 1
    // sails through both the `min` and the `max` check. The stored figure was
    // never wrong (nothing consumes `req.sanitizedData`; the controllers
    // re-parse the raw body correctly), but every range check in this class was
    // being evaluated against a number two orders of magnitude too small, so a
    // comma-formatted amount could not be caught by the ceiling it was supposed
    // to be tested against.
    const numericValue =
      typeof value === 'string' ? parseFloat(value.trim().replace(/,/g, '')) : parseFloat(value);

    // Check if conversion was successful
    if (isNaN(numericValue)) {
      return { isValid: false, error: `${fieldName} must be a valid number` };
    }

    // Check range
    if (numericValue < min) {
      return { isValid: false, error: `${fieldName} cannot be less than ${min}` };
    }

    if (numericValue > max) {
      return { isValid: false, error: `${fieldName} cannot be greater than ${max}` };
    }

    // Return sanitized value
    return {
      isValid: true,
      value: numericValue,
      sanitized: Math.round(numericValue * 100) / 100 // Round to 2 decimal places
    };
  }

  /**
   * Validate income form data
   */
  static validateIncomeForm(req, res, next) {
    const errors = [];
    const sanitized = {};

    // Define income fields to validate
    const incomeFields = [
      'monthly_salary',
      'bonus',
      'car_allowance',
      'other_taxable',
      'medical_allowance',
      'employer_contribution',
      'other_exempt',
      'other_sources',
      'salary_tax_deducted',
      'additional_tax_deducted'
    ];

    // Validate each field
    incomeFields.forEach(field => {
      const validation = ValidationMiddleware.validateNumeric(
        req.body[field],
        field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        { min: 0, max: 120000000, allowNull: true }
      );

      if (!validation.isValid) {
        errors.push(validation.error);
      } else {
        sanitized[field] = validation.sanitized;
      }
    });

    if (errors.length > 0) {
      logger.warn('Income form validation errors:', { errors, userId: req.user?.id });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        message: 'Please check your input and try again'
      });
    }

    // Add sanitized data to request
    req.sanitizedData = sanitized;
    next();
  }

  /**
   * Validate adjustable tax form data.
   *
   * Two changes from the original (which was never wired to a route):
   *
   *  1. The arbitrary `max: 10000000` is gone. Rs 10M of withheld tax is
   *     entirely ordinary for a high earner; that ceiling would have rejected
   *     lawful returns. Bounds are now non-negative + a DECIMAL(15,2) sanity
   *     ceiling.
   *  2. A relational rule replaces it, which is the one that actually matters:
   *     **tax collected on a receipt can never exceed the receipt.** This is
   *     the input side of the unbounded-refund vector QA drove to
   *     −999,699,999 — withholding is client-supplied and was unvalidated.
   *     Every `<prefix>_tax_collected` in the body is checked against
   *     `<prefix>_gross_receipt` / `<prefix>_gross_amount` when that sibling is
   *     present and positive.
   *
   * Fields are discovered from the request body rather than a hardcoded list,
   * so a new withholding row cannot silently arrive unvalidated.
   */
  static validateAdjustableTaxForm(req, res, next) {
    const errors = [];
    const sanitized = {};
    const body = req.body || {};

    const taxFields = Object.keys(body).filter(
      (k) => /_(tax_collected|tax_deducted)$/.test(k) || /^total_(adjustable_tax|tax_collected)$/.test(k)
    );

    // Validate each field
    taxFields.forEach(field => {
      const validation = ValidationMiddleware.validateNumeric(
        req.body[field],
        field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        { min: 0, max: MONEY_SANITY_MAX, allowNull: true }
      );

      if (!validation.isValid) {
        errors.push(validation.error);
      } else {
        sanitized[field] = validation.sanitized;
      }
    });

    // Relational: withheld tax cannot exceed the gross receipt it was withheld
    // from. Only applied where the taxpayer actually supplied the gross figure.
    taxFields.forEach((field) => {
      const prefix = field.replace(/_(tax_collected|tax_deducted)$/, '');
      if (prefix === field) return; // totals have no gross sibling
      const gross =
        body[`${prefix}_gross_receipt`] !== undefined
          ? toAmount(body[`${prefix}_gross_receipt`])
          : body[`${prefix}_gross_amount`] !== undefined
            ? toAmount(body[`${prefix}_gross_amount`])
            : null;
      if (gross === null || gross <= 0) return;
      const collected = toAmount(body[field]);
      if (collected > gross) {
        errors.push(
          `${field.replace(/_/g, ' ')}: tax withheld (${collected}) cannot exceed the gross receipt it was withheld from (${gross}).`
        );
      }
    });

    if (errors.length > 0) {
      logger.warn('Adjustable tax form validation errors:', { errors, userId: req.user?.id });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        message: 'Please check your tax input and try again'
      });
    }

    req.sanitizedData = sanitized;
    next();
  }

  /**
   * Validate credits form data.
   *
   * The original list named seven columns, six of which the live form never
   * posts, and imposed an arbitrary `max: 5000000` — which is neither a
   * statutory limit nor a safe one (a lawful Rs 6M donation would have been
   * rejected, and a Rs 4.9M bogus credit accepted). It was also never wired to
   * a route, so none of it ran.
   *
   * This is now shape validation only — non-negative, numeric, no overflow —
   * over the columns the form actually writes. The statutory s.61/s.63 caps
   * are enforced immediately afterwards by `enforceCreditLimits`, which needs
   * taxable income and therefore has to be async.
   */
  static validateCreditsForm(req, res, next) {
    const errors = [];
    const sanitized = {};

    const creditFields = [
      // live columns written by CreditsForm
      'charitable_donations_amount',
      'charitable_donations_tax_credit',
      'charitable_donations_associate_amount',
      'charitable_donations_associate_tax_credit',
      'pension_fund_amount',
      'pension_fund_tax_credit',
      'pension_contribution_amount',
      'pension_contribution_tax_credit',
      'investment_shares_amount',
      'investment_shares_tax_credit',
      'surrender_tax_credit_amount',
      'surrender_tax_credit_reduction',
      'total_tax_credits',
      // legacy columns retained on the table
      'charitable_donation',
      'pension_contribution',
      'life_insurance_premium',
      'investment_tax_credit',
      'other_credits',
    ].filter((f) => Object.prototype.hasOwnProperty.call(req.body || {}, f));

    creditFields.forEach(field => {
      const validation = ValidationMiddleware.validateNumeric(
        req.body[field],
        field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        {
          // Almost every credit field is non-negative. Two are not, and blanket
          // `min: 0` made the RIGHT answer unsaveable on both.
          min: SIGNED_CREDIT_FIELDS.has(field) ? -MONEY_SANITY_MAX : 0,
          max: MONEY_SANITY_MAX,
          allowNull: true,
        }
      );

      if (!validation.isValid) {
        errors.push(validation.error);
      } else {
        sanitized[field] = validation.sanitized;
      }
    });

    if (errors.length > 0) {
      logger.warn('Credits form validation errors:', { errors, userId: req.user?.id });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        message: 'Please check your credits input and try again'
      });
    }

    req.sanitizedData = sanitized;
    next();
  }

  /**
   * Validate deductions form data.
   *
   * The original omitted `educational_expenses_amount` entirely — so even if
   * it had been wired (it was not), it would not have caught the case that
   * wiped a lawful Rs 21,400 liability to Rs 0. `total_deductions` is a
   * GENERATED column and was also listed; posting it aborts the UPDATE, so it
   * is stripped here rather than validated.
   *
   * Shape only. The s.60C / s.60D quantum and threshold rules are enforced by
   * `enforceDeductionLimits` below.
   */
  static validateDeductionsForm(req, res, next) {
    const errors = [];
    const sanitized = {};

    const deductionFields = [
      'professional_expenses_amount',
      'professional_expenses_pos_amount',
      'educational_expenses_amount',
      'tuition_fee_amount',
      'education_expense_amount',
      'zakat_paid_amount',
      'zakat',
      'ushr',
      'tax_paid_foreign_country',
      'advance_tax',
      'other_deductions',
      'total_deduction_from_income',
    ].filter((f) => Object.prototype.hasOwnProperty.call(req.body || {}, f));

    deductionFields.forEach(field => {
      const validation = ValidationMiddleware.validateNumeric(
        req.body[field],
        field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        { min: 0, max: MONEY_SANITY_MAX, allowNull: true }
      );

      if (!validation.isValid) {
        errors.push(validation.error);
      } else {
        sanitized[field] = validation.sanitized;
      }
    });

    // Child counts are integers, not money.
    ['educational_expenses_children_count', 'education_expense_children'].forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(req.body || {}, field)) return;
      const raw = req.body[field];
      if (raw === null || raw === undefined || raw === '') return;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        errors.push(`${field.replace(/_/g, ' ')} must be a whole number of children, not less than 0.`);
      }
    });

    if (errors.length > 0) {
      logger.warn('Deductions form validation errors:', { errors, userId: req.user?.id });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        message: 'Please check your deductions input and try again'
      });
    }

    req.sanitizedData = sanitized;
    next();
  }

  /**
   * Validate capital gains form data
   */
  static validateCapitalGainsForm(req, res, next) {
    const errors = [];
    const sanitized = {};

    // Discovered from the body: any numeric-looking gain/tax column. The old
    // hardcoded list named columns the live form does not post, and its
    // `max: 50000000` would have rejected a lawful large property disposal.
    const looksNumeric = (v) =>
      typeof v === 'number' || (typeof v === 'string' && /^-?\d*\.?\d+$/.test(v.trim()));
    const capitalGainsFields = Object.keys(req.body || {}).filter(
      (k) =>
        looksNumeric(req.body[k]) &&
        (/_(tax_due|tax_deducted|tax_chargeable|gain|gains)$/.test(k) ||
          /^(property_|securities|other_capital_gains|total_capital_gain)/.test(k))
    );

    capitalGainsFields.forEach(field => {
      const validation = ValidationMiddleware.validateNumeric(
        req.body[field],
        field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        { min: 0, max: MONEY_SANITY_MAX, allowNull: true }
      );

      if (!validation.isValid) {
        errors.push(validation.error);
      } else {
        sanitized[field] = validation.sanitized;
      }
    });

    if (errors.length > 0) {
      logger.warn('Capital gains form validation errors:', { errors, userId: req.user?.id });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        message: 'Please check your capital gains input and try again'
      });
    }

    req.sanitizedData = sanitized;
    next();
  }

  /**
   * General sanitization helper for all numeric fields
   */
  static sanitizeAllNumericFields(data) {
    const sanitized = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && /^\d*\.?\d*$/.test(value.trim())) {
        // It's a numeric string
        const numValue = parseFloat(value);
        sanitized[key] = isNaN(numValue) ? 0 : Math.round(numValue * 100) / 100;
      } else if (typeof value === 'number') {
        sanitized[key] = Math.round(value * 100) / 100;
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

}

// Canonical FBR tax-year format used throughout the app/DB: "YYYY-YY"
// (e.g. "2025-26"). The previous validateTaxYear required a bare 4-digit year,
// which never matched the real format — so it was both dead AND wrong (SEC-09).
const TAX_YEAR_RE = /^\d{4}-\d{2}$/;

/**
 * Express router.param handler for ":taxYear". Register once per router with
 *   router.param('taxYear', validateTaxYearParam)
 * and every route in that router carrying a :taxYear segment is validated before
 * its handler runs — returning a clean 400 for malformed input instead of
 * silently querying with a bogus value. (taxYear is always passed to pg as a
 * bound parameter, so this is input hygiene / defense-in-depth, not an injection
 * fix.) The end year must be (start % 100) + 1, rejecting nonsense like 2025-99.
 */
function validateTaxYearParam(req, res, next, value) {
  if (!TAX_YEAR_RE.test(value)) {
    return res.status(400).json({
      error: 'Invalid tax year',
      message: 'Tax year must be in YYYY-YY format (e.g., 2025-26).',
    });
  }
  const start = parseInt(value.slice(0, 4), 10);
  const end = parseInt(value.slice(5), 10);
  if (start < 2015 || start > new Date().getFullYear() + 1 || end !== (start + 1) % 100) {
    return res.status(400).json({
      error: 'Invalid tax year',
      message: 'Tax year is out of range or its two halves are inconsistent (e.g., 2025-26).',
    });
  }
  next();
}

// ═══════════════════════════════════════════════════════════════════════════
// Statutory limit enforcement — the write path
// ═══════════════════════════════════════════════════════════════════════════
//
// The validators above check shape. These check LAW, and they are the reason
// this lane exists: before them, every statutory limit in the application was
// enforced in the browser only, and a single authenticated POST that skipped
// the UI reduced a lawful Rs 21,400 liability to Rs 0.
//
// Behaviour: **clamp, then report.** A value over its statutory cap is reduced
// to the cap and the reduction is returned to the client in
// `statutory_adjustments` on the save response, so nothing is changed silently.
// Hard rejection is reserved for input that cannot be interpreted at all
// (negative, non-numeric, more children than the statute allows) — those come
// back as 400 from the shape validators above.
//
// Clamping rather than rejecting is deliberate: a stale frontend that computes
// a cap slightly differently must not be able to lock a taxpayer out of saving
// their return. It must simply be unable to overstate a claim.

/** Fetch the current filing tax year. Mirrors taxFormsShared.getCurrentTaxYear. */
async function currentTaxYear() {
  const r = await pool.query(
    `SELECT tax_year FROM tax_years WHERE is_current = true AND is_active = true LIMIT 1`
  );
  if (r.rows.length === 0) throw new Error('No current tax year configured in the database.');
  return r.rows[0].tax_year;
}

/**
 * Record a clamp so it reaches the client, and patch res.json once so the save
 * response carries it. saveFormData (a different lane) writes that response and
 * knows nothing about this, hence the wrapper rather than an edit over there.
 */
function recordAdjustment(req, res, adjustment) {
  if (!req.statutoryAdjustments) {
    req.statutoryAdjustments = [];
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (body && typeof body === 'object' && !Array.isArray(body) && req.statutoryAdjustments.length) {
        body.statutory_adjustments = req.statutoryAdjustments;
      }
      return originalJson(body);
    };
  }
  req.statutoryAdjustments.push(adjustment);
  logger.warn('Statutory cap applied on save', {
    userId: req.user?.id,
    field: adjustment.field,
    claimed: adjustment.claimed,
    allowed: adjustment.allowed,
    rule: adjustment.rule,
  });
}

/**
 * Clamp one body field to `cap`, recording the adjustment if it bites.
 * Returns the value now in the body.
 */
function clampField(req, res, field, cap, rule) {
  if (!Object.prototype.hasOwnProperty.call(req.body, field)) return null;
  const claimed = toAmount(req.body[field]);
  if (claimed <= cap) return claimed;
  req.body[field] = round2(cap);
  recordAdjustment(req, res, { field, claimed: round2(claimed), allowed: round2(cap), rule });
  return round2(cap);
}

/**
 * The income figures every statutory threshold is measured against.
 *
 * Two different bases, and using the wrong one is a defect in itself:
 *
 *  - `preAllowanceTaxableIncome` — total income less the allowances that are
 *    NOT s.60C/s.60D. This is the base for the s.60C/s.60D eligibility test.
 *    It cannot be "taxable income after all allowances", because the s.60C and
 *    s.60D allowances are themselves part of that figure: claiming more would
 *    lower the base and thereby qualify you, which is circular and
 *    non-monotonic. `advance_tax` is excluded — it is a payment, not an
 *    allowance against income.
 *
 *  - `taxableIncome` — after every deductible allowance, matching the engine's
 *    `taxableIncomeExcludingCG`. This is the base for the s.61/s.63 credit
 *    caps, which sit downstream of the allowances.
 *
 * Note both are **taxable**, not gross. The browser compared gross
 * (`DeductionsForm.js:124-126`), which wrongly denied the allowance to a
 * taxpayer grossing 1.6M with 1.4M taxable and inflated the 25% s.60C cap.
 */
async function loadIncomeBases(userId, taxYear, postedDeductions) {
  const inc = await pool.query(
    `SELECT annual_salary_wages_total, total_non_cash_benefits,
            other_income_min_tax_total, other_income_no_min_tax_total
       FROM income_forms WHERE user_id = $1 AND tax_year = $2`,
    [userId, taxYear]
  );
  const i = inc.rows[0] || {};
  // Whether ANY income has been declared yet. Load-bearing for R-01: with no
  // income row every cap evaluates to zero, so clamping would write zeros over
  // a taxpayer's credits and — because the clamp only ever runs on save — never
  // restore them when the income form is filled in afterwards. QA lost a whole
  // Credits form this way by entering the forms out of order, which is not a
  // misuse: nothing in the UI requires income first.
  const hasIncomeRow = inc.rows.length > 0;
  const totalIncome =
    toAmount(i.annual_salary_wages_total) +
    toAmount(i.total_non_cash_benefits) +
    toAmount(i.other_income_min_tax_total) +
    toAmount(i.other_income_no_min_tax_total);

  const ded = await pool.query(
    `SELECT * FROM deductions_forms WHERE user_id = $1 AND tax_year = $2`,
    [userId, taxYear]
  );
  // The posted body wins over the stored row — this is the state the return
  // will be in *after* this save, which is what the limits must hold against.
  const d = { ...(ded.rows[0] || {}), ...(postedDeductions || {}) };

  const otherAllowances =
    toAmount(d.zakat_paid_amount) +
    toAmount(d.zakat) +
    toAmount(d.ushr) +
    toAmount(d.tax_paid_foreign_country) +
    toAmount(d.other_deductions);

  // Income that is NOT salary. Behbood/Pensioners' Benefit profit is profit on
  // debt, so it can only come out of this bucket — a taxpayer whose entire
  // declared income is salary has no certificate profit to relieve. Bounding the
  // Behbood claim by TOTAL income (which is what the first fix did) is far too
  // loose: it let a pure-salary filer on Rs 22,700,000 claim Rs 22,700,000 of
  // "certificate profit" and take Rs 5,991,000 of relief on income that was
  // never profit on debt at all.
  const nonSalaryIncome =
    toAmount(i.other_income_min_tax_total) + toAmount(i.other_income_no_min_tax_total);

  const preAllowanceTaxableIncome = Math.max(0, totalIncome - otherAllowances);
  const allowances =
    otherAllowances +
    toAmount(d.professional_expenses_amount) +
    toAmount(d.educational_expenses_amount);

  return {
    totalIncome,
    nonSalaryIncome,
    hasIncomeRow,
    preAllowanceTaxableIncome,
    taxableIncome: Math.max(0, totalIncome - allowances),
    deductionsRow: d,
  };
}

/**
 * Record that a limit could not be measured yet, WITHOUT touching the figures.
 *
 * The alternative — clamping against an unknown base — writes zeros that no
 * later save restores. Deferring is safe because the engine bounds credits and
 * reductions again at computation time against the income that exists then
 * (`taxCalculationService.js`, "bounded by the tax they offset"), so nothing
 * unlawful can reach a filed return through this door.
 */
function recordDeferral(req, res, what) {
  recordAdjustment(req, res, {
    field: what,
    claimed: null,
    allowed: null,
    rule:
      'No income has been declared for this tax year yet, so the statutory ceiling cannot be '
      + 'measured. Your figures were saved unchanged and will be checked against the limits '
      + 'once the Income form is completed.',
  });
}

/**
 * The ceiling that binds EVERY credit and reduction head, whatever it is named.
 *
 * A credit or a reduction extinguishes tax. Neither can exceed the tax in
 * charge, and neither can ever pay money to the taxpayer — a refund arises only
 * from tax actually PAID (withholding, advance tax), never from a relief. So
 * `tax in charge` is a hard, statute-independent upper bound on every head,
 * including heads the app has no specific rule for (`other_credits`,
 * `other_reductions`, `surrender_tax_credit_reduction`, and anything added
 * later).
 *
 * This is what the previous pass got wrong. It clamped four credit heads by
 * name, and the components it missed were not exotic: `surrender_tax_credit_
 * reduction` is a plain editable input on the shipping Credits form. Rs
 * 9,000,000 went in verbatim and produced a Rs 250,000 refund CLAIM against
 * FBR out of a Rs 3,101,000 liability.
 *
 * The component set is therefore derived from the GENERATED total's own
 * definition (`getGeneratedTotalComponents`) rather than from a list kept by
 * hand. `handledHeads` are the ones a caller has already bounded by their own
 * statutory rule; everything else gets the universal ceiling.
 */
function clampRemainingHeads(req, res, { components, merged, handledHeads, ceiling, rule }) {
  for (const field of components) {
    if (handledHeads.has(field)) continue;
    if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
    clampField(req, res, field, ceiling, rule);
    merged[field] = req.body[field];
  }
}

/** Uniform failure for an enforcement middleware that cannot do its job. */
function enforcementUnavailable(res, err, what) {
  logger.error(`Statutory limit enforcement failed for ${what}`, {
    message: err.message,
  });
  return res.status(503).json({
    success: false,
    message:
      'Statutory limits could not be verified for this save. Nothing was changed — please try again.',
  });
}

/**
 * s.60C + s.60D — deductible allowances.
 *
 * Closes, on the server: the unbounded education amount (Rs 5,000,000 claimed
 * against a Rs 60,000 entitlement wiped the liability), the unbounded
 * professional-expenses amount, the missing income threshold (an allowance was
 * granted at salary 1,500,001 via the API without complaint), and the
 * cosmetic-only child-count guard.
 *
 * It also RECOMPUTES `total_deduction_from_income` from the clamped
 * components. This is load-bearing: the engine reads that column FIRST
 * (`taxCalculationService.js:226-228`), so clamping the components while
 * trusting the client's total would leave the hole exactly as wide as before.
 */
async function enforceDeductionLimits(req, res, next) {
  try {
    const taxYear = req.body?.taxYear || req.query?.taxYear || (await currentTaxYear());
    const rates = await TaxRateService.getAllRates(taxYear);
    const limits = bindRates(rates);

    const bases = await loadIncomeBases(req.user.id, taxYear, req.body);
    const ti = bases.preAllowanceTaxableIncome;

    // R-01 — see recordDeferral(). With no income row every allowance ceiling
    // is zero, so clamping here would wipe the form. The refusal of a relief
    // that DOES NOT EXIST is a separate matter and still applies below: it
    // needs no income base to decide.
    const incomeKnown = bases.hasIncomeRow;
    if (!incomeKnown) recordDeferral(req, res, 'deductible_allowances');

    // ── s.60D — education ──
    if (incomeKnown && Object.prototype.hasOwnProperty.call(req.body, 'educational_expenses_amount')) {
      const children = toAmount(
        req.body.educational_expenses_children_count ??
          bases.deductionsRow.educational_expenses_children_count ??
          0
      );
      // s.60D limb (a): the tuition fee actually paid. Storable since
      // phase-z14; passed only when a figure exists, so a taxpayer who has not
      // stated a fee is not zeroed by the limb. The fee itself is NOT clamped
      // — it is a stated fact, not a claim — and is deliberately not part of
      // total_deduction_from_income.
      const feeSource = Object.prototype.hasOwnProperty.call(req.body, 'tuition_fee_amount')
        ? req.body.tuition_fee_amount
        : bases.deductionsRow.tuition_fee_amount;
      const tuitionFee =
        feeSource === undefined || feeSource === null || feeSource === '' || toAmount(feeSource) <= 0
          ? undefined
          : toAmount(feeSource);

      const cap = limits.capEducationU60D(ti, children, tuitionFee);

      // R-02 — A CAP OF ZERO HAS TWO COMPLETELY DIFFERENT CAUSES AND THEY MUST
      // NOT SHARE A MESSAGE. The previous pass told a taxpayer on Rs 1,400,000
      // that their claim was refused because "taxable income is not less than
      // the eligibility threshold" — which is false; they were 100,000 under
      // it. The real cause was that no child count had been entered, so limb
      // (c) evaluated to zero. A wrong reason is worse than no reason: it sends
      // the taxpayer to fix a figure that was never the problem, and it pushes
      // tax UP, so nobody complains and the defect never surfaces.
      const threshold = rates?.deductionThresholds?.education_max_taxable_income?.fixedAmount;
      const overThreshold = typeof threshold === 'number' && !(ti < threshold);

      if (cap === 0 && !overThreshold && toAmount(req.body.educational_expenses_amount) > 0) {
        // Eligible on income, but no quantum has been established. Refusing to
        // zero it silently: ask for the missing figure instead.
        return res.status(400).json({
          success: false,
          message:
            'To claim the education allowance u/s 60D, enter the number of children the tuition '
            + 'fee was paid for (and the fee itself). The allowance is the least of 5% of the '
            + 'fee, 25% of taxable income, and the per-child cap — none of which can be worked '
            + 'out without them.',
          field: 'educational_expenses_children_count',
        });
      }

      clampField(
        req,
        res,
        'educational_expenses_amount',
        cap,
        overThreshold
          ? 'ITO 2001 s.60D — taxable income is not less than the eligibility threshold'
          : 'ITO 2001 s.60D — the least of 5% of the tuition fee, 25% of taxable income, '
            + 'and the per-child cap × eligible children'
      );
    }

    // ── "Professional expenses in respect of a POS" ──
    //
    // This relief is RETIRED by phase-z19: it was cited to s.60C, which was the
    // deductible allowance for PROFIT ON DEBT and was omitted by Finance Act
    // 2022 — it never covered professional or point-of-sale expenses. See that
    // migration's header for the full reasoning.
    //
    // "Relief not configured" must be handled here as an EXPECTED state, not as
    // a missing-configuration error. statutoryLimits' rateOf() throws when a key
    // is absent, which is right for a rate that ought to exist — but a
    // deliberately deactivated relief would then 503 the whole deductions save
    // and make the form unusable. So probe for the threshold row first and, when
    // it is gone, simply refuse the field.
    if (Object.prototype.hasOwnProperty.call(req.body, 'professional_expenses_amount')) {
      const reliefConfigured = Boolean(rates?.deductionThresholds?.prof_expenses_max_taxable_income);

      if (!reliefConfigured) {
        clampField(
          req,
          res,
          'professional_expenses_amount',
          0,
          'No statutory basis — s.60C (deductible allowance for profit on debt) was omitted '
            + 'by Finance Act 2022 and never covered professional or point-of-sale expenses'
        );
      } else if (incomeKnown) {
        // The POS amount is a form-only field (not a DB column) and may not be
        // posted. Where it is absent the 5%-of-POS limb cannot be tested, so only
        // the 25%-of-taxable-income limb and the income threshold apply.
        const posSupplied = Object.prototype.hasOwnProperty.call(
          req.body,
          'professional_expenses_pos_amount'
        );
        const pos = toAmount(req.body.professional_expenses_pos_amount);
        const cap = posSupplied
          ? limits.capProfessionalU60C(ti, pos)
          : limits.capProfessionalU60C(ti, Number.MAX_SAFE_INTEGER); // 25% limb only
        clampField(
          req,
          res,
          'professional_expenses_amount',
          cap,
          cap === 0
            ? 'ITO 2001 s.60C — taxable income is not less than the eligibility threshold'
            : 'ITO 2001 s.60C — lower of 5% of POS amount and 25% of taxable income'
        );
      }
    }

    // ── The catch-all allowance heads ──
    //
    // `other_deductions` is a free-text money field with no statutory rule
    // attached, and it was completely unbounded: QA entered 11,200,000 against
    // 11,200,000 of income and took taxable income — and therefore the whole
    // liability — to zero, with no adjustment recorded. `zakat`, `ushr` and the
    // foreign-tax figure are the same shape.
    //
    // These are genuinely open-ended reliefs, so the app has no percentage to
    // apply. What it does have is arithmetic: a deduction FROM income cannot
    // exceed the income it is deducted from. That bound is not a guess and does
    // not need counsel to confirm it.
    if (incomeKnown) {
      for (const field of ['other_deductions', 'zakat', 'zakat_paid_amount', 'ushr']) {
        clampField(
          req,
          res,
          field,
          bases.totalIncome,
          'A deduction from income cannot exceed the income declared for the year.'
        );
      }
    }

    // ── Recompute the total the engine actually reads ──
    const merged = { ...bases.deductionsRow, ...req.body };
    const recomputedTotal = round2(
      Math.min(
        toAmount(merged.professional_expenses_amount) +
          toAmount(merged.educational_expenses_amount) +
          toAmount(merged.zakat_paid_amount) +
          toAmount(merged.zakat) +
          toAmount(merged.ushr) +
          toAmount(merged.tax_paid_foreign_country) +
          toAmount(merged.other_deductions),
        // Same bound on the aggregate: individually-lawful heads must not sum
        // past total income. Taxable income floors at zero either way, but an
        // over-sized total silently re-qualifies the taxpayer for income-tested
        // reliefs further down (QA's R-07). Not applied before income is known
        // — that would be the R-01 data-loss bug again.
        incomeKnown ? bases.totalIncome : Number.POSITIVE_INFINITY
      )
    );
    const postedTotal = toAmount(req.body.total_deduction_from_income);
    req.body.total_deduction_from_income = recomputedTotal;
    if (
      Object.prototype.hasOwnProperty.call(req.body, 'total_deduction_from_income') &&
      postedTotal > recomputedTotal
    ) {
      recordAdjustment(req, res, {
        field: 'total_deduction_from_income',
        claimed: postedTotal,
        allowed: recomputedTotal,
        rule: 'Total deductible allowance is recomputed server-side from its components.',
      });
    }

    return next();
  } catch (err) {
    return enforcementUnavailable(res, err, 'deductions');
  }
}

/**
 * s.61 + s.63 — tax credits.
 *
 * THE CREDIT IS `(A/B) × C`, NOT `C`.
 *   A = tax assessed before the credit,  B = taxable income,  C = the LOWER of
 *   the amount given and the statutory percentage of taxable income.
 *
 * The previous pass clamped the credit at `C` — the eligible AMOUNT — which is
 * roughly an order of magnitude too loose, because `A/B` is the average rate.
 * QA's case: taxable income 3,000,000, tax 300,000, average rate 10%. The cap
 * allowed a 900,000 credit where the statute allows 90,000, so a liability of
 * 300,000 still went to zero *after* clamping. The clamp fired, logged, and
 * changed nothing that mattered.
 *
 * The exact figure is computed here. The average rate is the engine's own slab
 * walk (`CalculationService.calculateProgressiveTax`) so the two cannot drift.
 *
 * A taxpayer may lawfully donate more than the cap, so the declared AMOUNT is
 * never touched — only the credit it generates.
 */
async function enforceCreditLimits(req, res, next) {
  try {
    const taxYear = req.body?.taxYear || req.query?.taxYear || (await currentTaxYear());
    const rates = await TaxRateService.getAllRates(taxYear);
    const limits = bindRates(rates);

    const bases = await loadIncomeBases(req.user.id, taxYear, null);
    const ti = bases.taxableIncome;

    // R-01 — see recordDeferral(). Never clamp against an unmeasurable base.
    if (!bases.hasIncomeRow) {
      recordDeferral(req, res, 'tax_credits');
      return next();
    }

    const stored = await pool.query(
      `SELECT * FROM credits_forms WHERE user_id = $1 AND tax_year = $2`,
      [req.user.id, taxYear]
    );
    const merged = { ...(stored.rows[0] || {}), ...req.body };

    // A = tax before credits; B = taxable income. Average, not marginal: a
    // credit is apportioned over the whole progressive base.
    const normalTax = CalculationService.calculateProgressiveTax(ti, rates.slabs);
    const avgRate = ti > 0 ? normalTax / ti : 0;

    /** (A/B) × min(amountGiven, statutory % of taxable income) */
    const creditOn = (amountField, eligibleCap) =>
      round2(Math.min(toAmount(merged[amountField]), eligibleCap) * avgRate);

    const handled = new Map([
      [
        'charitable_donations_tax_credit',
        [
          creditOn('charitable_donations_amount', limits.capDonationU61(ti, false)),
          'ITO 2001 s.61 — credit is (tax ÷ taxable income) × the lower of the donation and '
            + '30% of taxable income',
        ],
      ],
      [
        'charitable_donations_associate_tax_credit',
        [
          creditOn('charitable_donations_associate_amount', limits.capDonationU61(ti, true)),
          'ITO 2001 s.61 proviso — associate donations are limited to 15% of taxable income '
            + 'before the average rate is applied',
        ],
      ],
      [
        'pension_fund_tax_credit',
        [
          creditOn('pension_fund_amount', limits.capPensionU63(ti)),
          'ITO 2001 s.63 — credit is (tax ÷ taxable income) × the lower of the contribution '
            + 'and 20% of taxable income',
        ],
      ],
      [
        'pension_contribution_tax_credit',
        [
          creditOn('pension_contribution_amount', limits.capPensionU63(ti)),
          'ITO 2001 s.63 — credit is (tax ÷ taxable income) × the lower of the contribution '
            + 'and 20% of taxable income',
        ],
      ],
    ]);

    // FA-2025 housing-loan profit-on-debt credit. Off unless the owner has
    // supplied its statutory parameters at Admin -> Statutory Reliefs — the
    // quantum is an open legal question and guessing it is what produced the
    // bogus "professional expenses u/s 60C" allowance. With no configuration the
    // eligible amount is 0, so the head is refused exactly like any other relief
    // the app cannot cite.
    if (Object.prototype.hasOwnProperty.call(req.body, 'housing_loan_profit_tax_credit')) {
      const configured = limits.housingLoanCreditConfigured();
      const eligible = limits.capHousingLoanProfitCredit(
        ti,
        merged.housing_loan_profit_amount
      );
      handled.set('housing_loan_profit_tax_credit', [
        round2(eligible * avgRate),
        configured
          ? 'Finance Act 2025 — credit is (tax ÷ taxable income) × the least of the profit on '
            + 'debt paid, the configured share of taxable income, and the configured ceiling'
          : 'The housing-loan profit-on-debt credit is not configured for this tax year. Its '
            + 'statutory quantum has not been settled, so the app does not grant it.',
      ]);
    }

    for (const [field, [cap, rule]] of handled) {
      clampField(req, res, field, cap, rule);
      if (Object.prototype.hasOwnProperty.call(req.body, field)) merged[field] = req.body[field];
    }

    // ── SURRENDER OF A CREDIT ADDS TAX BACK; IT DOES NOT GRANT RELIEF ──
    //
    // `surrender_tax_credit_reduction` records the reversal required when shares
    // that attracted an investment credit are disposed of inside the holding
    // period: the credit already allowed is ADDED to the tax payable. The form
    // itself documents the field as "negative credit (reversal)" and expects a
    // negative figure, because the generated `total_credits` adds this column
    // with a PLUS sign.
    //
    // So a POSITIVE value here is the claim inverted — it reduces tax by the
    // amount that should have increased it. The generic "cannot exceed the tax in
    // charge" ceiling does not catch that: bounding a nonsense claim at the full
    // liability still extinguishes the full liability, which is exactly what a
    // live re-test on staging showed after the first bound went in (Rs 9,000,000
    // clamped to Rs 7,126,000 and the whole charge still went to nil).
    //
    // Zero is the ceiling. A taxpayer with nothing to surrender leaves it at 0;
    // one with a reversal enters it negative and their tax goes UP, as it should.
    if (Object.prototype.hasOwnProperty.call(req.body, 'surrender_tax_credit_reduction')) {
      const claimed = toAmount(req.body.surrender_tax_credit_reduction);
      if (claimed > 0) {
        req.body.surrender_tax_credit_reduction = 0;
        merged.surrender_tax_credit_reduction = 0;
        recordAdjustment(req, res, {
          field: 'surrender_tax_credit_reduction',
          claimed: round2(claimed),
          allowed: 0,
          rule:
            'Surrendering a tax credit ADDS it back to the tax payable — it is not a relief. '
            + 'Enter the reversal as a negative figure; a positive one would reduce your tax by '
            + 'the amount it is supposed to increase it.',
        });
      }
    }

    // Every OTHER component of the generated total — including heads this app
    // has no specific rule for — is bounded by the tax in charge. See
    // clampRemainingHeads() for why a name list is not acceptable here.
    const components = await getGeneratedTotalComponents('credits_forms', 'total_credits');
    clampRemainingHeads(req, res, {
      components,
      merged,
      handledHeads: new Set([...handled.keys(), 'surrender_tax_credit_reduction']),
      ceiling: normalTax,
      rule:
        'A tax credit cannot exceed the tax it is set against. Relief extinguishes tax; only '
        + 'tax actually paid can be refunded.',
    });

    // Recompute the total the engine reads FIRST (`total_tax_credits`), from
    // the same component set the generated column uses — so the plain column
    // and the generated one cannot disagree.
    const recomputedTotal = round2(
      components.reduce((sum, k) => sum + toAmount(merged[k]), 0)
    );
    const postedTotal = toAmount(req.body.total_tax_credits);
    if (Object.prototype.hasOwnProperty.call(req.body, 'total_tax_credits')) {
      req.body.total_tax_credits = recomputedTotal;
      if (postedTotal > recomputedTotal) {
        recordAdjustment(req, res, {
          field: 'total_tax_credits',
          claimed: postedTotal,
          allowed: recomputedTotal,
          rule: 'Total tax credit is recomputed server-side from its components.',
        });
      }
    }

    return next();
  } catch (err) {
    return enforcementUnavailable(res, err, 'credits');
  }
}

/**
 * 2nd Sched Pt III cl.6 — Behbood / Pensioners' Benefit certificates.
 *
 * The relief is the tax charged **in excess of** the 5% ceiling, not 5% of the
 * profit. The form shipped `profit × 5%` into the relief field (its own local
 * variable was named `maxTax`), and there was no server-side Behbood
 * arithmetic at all — the browser's number was the filed number. On a low-slab
 * filer that over-relieved by 20× and spilled over into unrelated CGT.
 *
 * The tax on the profit is apportioned at the **average** rate, not the
 * marginal one, using the engine's own slab walk so the two cannot diverge.
 */
async function enforceReductionLimits(req, res, next) {
  try {
    const taxYear = req.body?.taxYear || req.query?.taxYear || (await currentTaxYear());
    const rates = await TaxRateService.getAllRates(taxYear);
    const limits = bindRates(rates);

    const bases = await loadIncomeBases(req.user.id, taxYear, null);
    const ti = bases.taxableIncome;

    // R-01 — see recordDeferral(). Never clamp against an unmeasurable base.
    if (!bases.hasIncomeRow) {
      recordDeferral(req, res, 'tax_reductions');
      return next();
    }

    const stored = await pool.query(
      `SELECT * FROM reductions_forms WHERE user_id = $1 AND tax_year = $2`,
      [req.user.id, taxYear]
    );
    const merged = { ...(stored.rows[0] || {}), ...req.body };

    // ONE base and ONE slab walk for every head in this form. F-17: Behbood was
    // moved onto the post-allowance taxable income while the teacher rebate was
    // left on a different figure, so the same form disagreed with itself about
    // what the taxpayer earned. Both now derive from `ti`.
    const normalTax = CalculationService.calculateProgressiveTax(ti, rates.slabs);
    const avgRate = ti > 0 ? normalTax / ti : 0;
    const handledHeads = new Set();

    if (Object.prototype.hasOwnProperty.call(req.body, 'behbood_certificates_tax_reduction')) {
      handledHeads.add('behbood_certificates_tax_reduction');

      // THE PROFIT IS ITSELF A CLAIM AND MUST BE BOUNDED. The relief is derived
      // from it, so an unbounded profit is an unbounded relief no matter how
      // carefully the derivation is written: QA posted
      // `behbood_certificates_amount: 100,000,000` against 11,200,000 of
      // declared income and took a Rs 3,101,000 liability to zero via a
      // 22,687,500 "relief". Behbood profit is part of the taxpayer's own
      // declared income, so declared income is its ceiling — a profit larger
      // than everything you earned is not a profit.
      const claimedProfit = toAmount(
        req.body.behbood_certificates_amount ?? merged.behbood_certificates_amount ?? 0
      );
      const profit = Math.min(claimedProfit, bases.nonSalaryIncome);
      if (
        claimedProfit > profit &&
        Object.prototype.hasOwnProperty.call(req.body, 'behbood_certificates_amount')
      ) {
        req.body.behbood_certificates_amount = round2(profit);
        recordAdjustment(req, res, {
          field: 'behbood_certificates_amount',
          claimed: round2(claimedProfit),
          allowed: round2(profit),
          rule:
            'Behbood/Pensioners\' Benefit profit is profit on debt, so it cannot exceed the '
            + 'non-salary income you have declared for the year. Declare the certificate profit '
            + 'as income on the Income form first.',
        });
      }

      // Average, not marginal: tax on a component of one progressive base
      // apportions at the average rate.
      const taxOnProfitAtAvgRate = profit * avgRate;

      // Second, independent bound: relief cannot exceed the tax actually
      // charged. behboodReliefCl6 already subtracts the ceiling from the tax on
      // the profit, so this only bites if the profit bound above is ever
      // widened — belt and braces on the head that produced the refund claim.
      const cap = Math.min(limits.behboodReliefCl6(profit, taxOnProfitAtAvgRate), normalTax);
      clampField(
        req,
        res,
        'behbood_certificates_tax_reduction',
        cap,
        'ITO 2001 2nd Sched Pt III cl.6 — relief is the tax charged above the 5% ceiling, apportioned at the average rate'
      );
    }

    // ── Teacher / researcher 25% rebate — availability is YEAR-DEPENDENT ────
    // Clause (3A), Part III, Second Schedule (inserted by Finance Act 2025)
    // restored this rebate retrospectively from 1-Jul-2022 but it CEASES TO HAVE
    // EFFECT AFTER 30-JUN-2025. It is therefore lawful for tax years 2023, 2024
    // and 2025 only, and unavailable for tax year 2026 onwards — where Pakistan's
    // "tax year 2026" is the year ended 30-Jun-2026, i.e. this app's '2025-26'.
    //
    // The rate row for the expired year is deactivated by phase-z19, which stops
    // the client auto-calculating it. That alone is not enough: the field is
    // user-editable, so a typed figure would still be stored and would still
    // reduce the liability. The reduction is only allowed here when a rate is
    // actually configured for the year being filed — absence of a rate means the
    // relief does not exist, never "fall back and allow it".
    if (Object.prototype.hasOwnProperty.call(req.body, 'teacher_researcher_tax_reduction')) {
      // getRateSet() returns { rate, minAmount, maxAmount, fixedAmount, ... }
      // per category — NOT a bare number — and it filters on is_active, so a
      // deactivated row simply drops out of the set and lands here as undefined.
      // Reading the object as a scalar would give NaN -> 0 and would block the
      // rebate even in the years it is lawful.
      handledHeads.add('teacher_researcher_tax_reduction');
      const teacherRate = Number(rates?.reductions?.teacher_researcher?.rate) || 0;
      if (teacherRate <= 0) {
        clampField(
          req,
          res,
          'teacher_researcher_tax_reduction',
          0,
          '2nd Sched Pt III cl.(3A) — the 25% teacher/researcher rebate ceased to have '
            + 'effect after 30-Jun-2025 and is not available for tax year 2026 onwards'
        );
      } else {
        // Available this year: still cap it at the statutory percentage of the
        // salary tax, so an inflated figure cannot pass through unchecked.
        // `normalTax` is the same slab walk on the same base every other head
        // in this form uses (F-17).
        clampField(
          req,
          res,
          'teacher_researcher_tax_reduction',
          round2(normalTax * teacherRate),
          `2nd Sched Pt III cl.(3A) — rebate limited to ${(teacherRate * 100).toFixed(0)}% of the tax payable on salary income`
        );
      }
    }

    for (const field of handledHeads) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) merged[field] = req.body[field];
    }

    // Every OTHER component of the generated total is bounded by the tax in
    // charge. `other_reductions`, the two immovable-property heads and the
    // export/industrial heads all reach this path; none of them was bounded
    // before, and each is an editable input.
    const components = await getGeneratedTotalComponents('reductions_forms', 'total_reductions');
    clampRemainingHeads(req, res, {
      components,
      merged,
      handledHeads,
      ceiling: normalTax,
      rule:
        'A tax reduction cannot exceed the tax it is set against. Relief extinguishes tax; only '
        + 'tax actually paid can be refunded.',
    });

    const recomputedTotal = round2(
      components.reduce((sum, k) => sum + toAmount(merged[k]), 0)
    );
    const postedTotal = toAmount(req.body.total_tax_reductions);
    if (Object.prototype.hasOwnProperty.call(req.body, 'total_tax_reductions')) {
      req.body.total_tax_reductions = recomputedTotal;
      if (postedTotal > recomputedTotal) {
        recordAdjustment(req, res, {
          field: 'total_tax_reductions',
          claimed: postedTotal,
          allowed: recomputedTotal,
          rule: 'Total tax reduction is recomputed server-side from its components.',
        });
      }
    }

    return next();
  } catch (err) {
    return enforcementUnavailable(res, err, 'reductions');
  }
}

/**
 * s.60D child-count gate. Previously inline in taxForms.js with a hardcoded
 * `> 2`; the limit now comes from `tax_rates_config`
 * (`deduction_threshold/education_max_children`) like every other number.
 *
 * This one REJECTS rather than clamps: a return claiming for more children
 * than the statute recognises is a malformed claim, not an overstated one.
 */
async function validateEducationChildCount(req, res, next) {
  try {
    const raw =
      req.body?.educational_expenses_children_count ?? req.body?.education_expense_children;
    if (raw === undefined || raw === null || raw === '') return next();

    const taxYear = req.body?.taxYear || req.query?.taxYear || (await currentTaxYear());
    const rates = await TaxRateService.getAllRates(taxYear);
    const max = rates.deductionThresholds?.education_max_children?.fixedAmount;
    if (typeof max !== 'number' || !Number.isFinite(max)) {
      throw new Error('deduction_threshold/education_max_children is not configured.');
    }

    if (Number(raw) > max) {
      return res.status(400).json({
        success: false,
        message: `Educational expense deduction u/s 60D is capped at ${max} children.`,
      });
    }
    return next();
  } catch (err) {
    return enforcementUnavailable(res, err, 'education child count');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Generic form validation — the remaining write paths
// ═══════════════════════════════════════════════════════════════════════════

/** Envelope and server-controlled keys: never client data, never validated. */
const ENVELOPE_KEYS = new Set([
  'taxYear', 'taxReturnId', 'isComplete', 'id', 'created_at', 'updated_at',
  'user_id', 'user_email', 'tax_year', 'tax_year_id', 'tax_return_id',
  'is_complete', 'last_updated_by',
]);

const looksNumericValue = (v) =>
  typeof v === 'number' || (typeof v === 'string' && /^-?\d*\.?\d+$/.test(v.trim()));

/**
 * Build a shape validator for a form whose money fields are discovered from
 * the request body rather than listed. Every numeric-looking value is checked
 * for finiteness, sign and overflow. Non-numeric values (dates, Y/N flags,
 * free text, booleans) are passed through untouched — they are not this
 * validator's business.
 *
 * No invented ceilings. The only upper bound is the DECIMAL(15,2) overflow
 * guard; a real statutory limit belongs in helpers/statutoryLimits.js.
 *
 * @param {string} formName        for the log line and error message
 * @param {object} [opts]
 * @param {boolean} [opts.allowNegative] wealth and reconciliation figures are
 *   legitimately negative — `income_exempt_from_tax` is negative by
 *   construction, and asset/liability movements can go either way. Forcing
 *   them non-negative would corrupt the reconciliation, so those two forms opt
 *   in to signed values and get the overflow guard only.
 */
function makeFormValidator(formName, opts = {}) {
  const { allowNegative = false } = opts;
  return function validateForm(req, res, next) {
    const errors = [];
    const sanitized = {};
    const body = req.body || {};

    Object.keys(body).forEach((field) => {
      if (ENVELOPE_KEYS.has(field)) return;
      if (!looksNumericValue(body[field])) return;

      const validation = ValidationMiddleware.validateNumeric(
        body[field],
        field.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        {
          min: allowNegative ? -MONEY_SANITY_MAX : 0,
          max: MONEY_SANITY_MAX,
          allowNull: true,
        }
      );

      if (!validation.isValid) errors.push(validation.error);
      else sanitized[field] = validation.sanitized;
    });

    if (errors.length > 0) {
      logger.warn(`${formName} validation errors:`, { errors, userId: req.user?.id });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        message: `Please check your ${formName} input and try again`,
      });
    }

    req.sanitizedData = sanitized;
    return next();
  };
}

/**
 * Tax Computation — server-computed fields are NOT client-writable.
 *
 * FINDING (2026-08-02, this lane): `POST /api/tax-forms/tax-computation` was
 * `auth` + `saveFormData` with nothing in between, and EVERY substantive
 * column on `tax_computation_forms` is a figure the server derives:
 * `normal_income_tax`, `surcharge_amount`, `capital_gains_tax`,
 * `tax_reductions`, `tax_credits`, `deductible_allowances`, `final_fixed_tax`,
 * … The table's headline columns — `net_tax_payable`, `total_tax_liability`,
 * `balance_payable` — are GENERATED from exactly those, so Postgres computed
 * the taxpayer's liability out of numbers the taxpayer supplied. A POST of
 * `{normal_income_tax: 0, tax_credits: 99999999}` stored a hugely negative
 * `total_tax_liability`, and `GET /current-return` reads that row straight
 * back. `getTaxComputation` even echoes seven of them under the comment
 * "User can still override these if needed".
 *
 * SCOPE OF THE HARM — stated precisely, because overstating it would be as
 * unhelpful as missing it: the forged row does NOT reach the filed PDF.
 * `routes/reports.js:98` recomputes via `TaxCalculationService`. What the
 * forged row does reach is every screen the taxpayer and their consultant look
 * at, and any future consumer that reads the table expecting a server figure.
 * Screen and PDF disagreeing is itself an open audit blocker.
 *
 * FIX: this form takes no client input at all. Only the envelope and the
 * completion flag survive; every other key is dropped and reported. The row is
 * left to be populated from the engine — which is lane B/C's mapping to make,
 * not something to guess at here.
 */
function stripServerComputedFields(req, res, next) {
  const dropped = [];
  Object.keys(req.body || {}).forEach((key) => {
    if (ENVELOPE_KEYS.has(key)) return;
    dropped.push(key);
    delete req.body[key];
  });

  if (dropped.length) {
    recordAdjustment(req, res, {
      field: 'tax_computation',
      claimed: dropped.length,
      allowed: 0,
      rule:
        'Every figure on the tax computation is derived by the server. Client-supplied values are discarded, not stored.',
      dropped_fields: dropped,
    });
  }
  return next();
}

/**
 * s.60D limb (a) — tuition fee. Storable since phase-z14; nothing may reach
 * the column that is not a plain non-negative amount, and the allowance itself
 * is capped by `enforceDeductionLimits` (the fee is now one of the limbs
 * `capEducationU60D` takes the least of).
 */

module.exports = ValidationMiddleware;
module.exports.makeFormValidator = makeFormValidator;
module.exports.stripServerComputedFields = stripServerComputedFields;
module.exports.validateTaxYearParam = validateTaxYearParam;
module.exports.TAX_YEAR_RE = TAX_YEAR_RE;
module.exports.enforceDeductionLimits = enforceDeductionLimits;
module.exports.enforceCreditLimits = enforceCreditLimits;
module.exports.enforceReductionLimits = enforceReductionLimits;
module.exports.validateEducationChildCount = validateEducationChildCount;
module.exports.MONEY_SANITY_MAX = MONEY_SANITY_MAX;