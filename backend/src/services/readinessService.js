/**
 * readinessService.js
 *
 * Pre-submit gate for a tax return. Inspects every form for the user+year
 * and returns a structured `{ ready, issues, warnings }` report. Used by
 * both:
 *   - GET  /api/tax-forms/readiness/:taxYear  (frontend punch list)
 *   - POST /api/tax-forms/submit              (server-side enforcement)
 *
 * Issue shape:
 *   { severity, code, message, formStep, fix }
 *
 * `severity` is 'error' | 'warning'. Errors block submission; warnings are
 * surfaced but allow submission to proceed.
 *
 * `code` is a stable machine-readable identifier so the frontend can render
 * issue-specific UI (e.g., a "fix it" button that navigates to the right form).
 *
 * `formStep` is the canonical form id (income, wealth_reconciliation, …) the
 * user should open to fix the issue.
 */

const { pool } = require('../config/database');

// ── Helpers ──────────────────────────────────────────────────────────────────

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// CNIC format: 13 digits, optional dashes XXXXX-XXXXXXX-X.
const CNIC_RE = /^\d{5}-?\d{7}-?\d$/;
// NTN format: 7-8 digits, optional dash before the check digit.
const NTN_RE  = /^\d{6,7}-?\d$/;

// Lightweight per-form fetchers — small, deliberate, tolerant of missing
// rows (return null rather than throwing) so a half-filled return still
// produces useful diagnostics.
async function fetchUser(userId) {
  // NTN lives on personal_information, not users — left-join so a user
  // without a personal_info row still resolves (ntn just becomes null and
  // the readiness check downgrades to a warning instead of crashing).
  const r = await pool.query(
    `SELECT u.id, u.email, u.name, u.cnic, p.ntn
       FROM users u
       LEFT JOIN personal_information p ON p.user_id = u.id
      WHERE u.id = $1`,
    [userId]
  );
  return r.rows[0] || null;
}
async function fetchIncome(userId, taxYear) {
  const r = await pool.query('SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2', [userId, taxYear]);
  return r.rows[0] || null;
}
async function fetchAdjustable(userId, taxYear) {
  const r = await pool.query('SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2', [userId, taxYear]);
  return r.rows[0] || null;
}
async function fetchCapitalGain(userId, taxYear) {
  const r = await pool.query('SELECT * FROM capital_gain_forms WHERE user_id = $1 AND tax_year = $2', [userId, taxYear]);
  return r.rows[0] || null;
}
async function fetchExpenses(userId, taxYear) {
  const r = await pool.query('SELECT * FROM expenses_forms WHERE user_id = $1 AND tax_year = $2', [userId, taxYear]);
  return r.rows[0] || null;
}
async function fetchWealth(userId, taxYear) {
  const r = await pool.query('SELECT * FROM wealth_forms WHERE user_id = $1 AND tax_year = $2', [userId, taxYear]);
  return r.rows[0] || null;
}
async function fetchWealthRecon(userId, taxYear) {
  const r = await pool.query('SELECT * FROM wealth_reconciliation_forms WHERE user_id = $1 AND tax_year = $2', [userId, taxYear]);
  return r.rows[0] || null;
}
async function fetchTaxReturn(userId, taxYear) {
  const r = await pool.query(
    `SELECT id, filing_status, submission_date FROM tax_returns
       WHERE user_id = $1 AND tax_year = $2`,
    [userId, taxYear]
  );
  return r.rows[0] || null;
}

// ── Individual checks ────────────────────────────────────────────────────────
// Each check returns an array of issues (possibly empty).

function checkUserIdentity(user) {
  const issues = [];
  if (!user) {
    issues.push({
      severity: 'error', code: 'USER_NOT_FOUND',
      message: 'User record could not be loaded.',
      formStep: null, fix: null,
    });
    return issues;
  }
  if (!user.name || !user.name.trim()) {
    issues.push({
      severity: 'error', code: 'NAME_MISSING',
      message: 'Your full name must be set on your profile before submitting.',
      formStep: 'profile', fix: 'Open Settings → Profile and add your full legal name.',
    });
  }
  if (user.cnic && !CNIC_RE.test(String(user.cnic).trim())) {
    issues.push({
      severity: 'error', code: 'CNIC_INVALID',
      message: 'CNIC format is invalid — should be 13 digits (with or without dashes).',
      formStep: 'profile', fix: 'Open Settings → Profile and re-enter your CNIC as 12345-1234567-1.',
    });
  }
  if (user.ntn && !NTN_RE.test(String(user.ntn).trim())) {
    issues.push({
      severity: 'error', code: 'NTN_INVALID',
      message: 'NTN format is invalid — should be 7–8 digits with a check digit.',
      formStep: 'profile', fix: 'Open Settings → Profile and re-enter your NTN.',
    });
  }
  return issues;
}

function checkIncomeForm(income) {
  const issues = [];
  if (!income) {
    issues.push({
      severity: 'error', code: 'INCOME_FORM_MISSING',
      message: 'The Normal Income form has not been saved yet.',
      formStep: 'income',
      fix: 'Open Income Tax → Normal Income and save at least your basic salary.',
    });
    return issues;
  }
  // Negative taxable values are almost always a typo.
  for (const col of [
    'annual_basic_salary', 'allowances', 'bonus',
    'taxable_car_value', 'other_taxable_subsidies',
    'profit_on_debt_15_percent', 'profit_on_debt_12_5_percent',
  ]) {
    const v = num(income[col]);
    if (v < 0) {
      issues.push({
        severity: 'error', code: 'INCOME_NEGATIVE_VALUE',
        message: `Income field "${col}" has a negative value (Rs ${v.toLocaleString()}).`,
        formStep: 'income',
        fix: 'Open Income Tax → Normal Income and correct the field; FBR rejects negative income amounts.',
      });
    }
  }
  return issues;
}

function checkAdjustableTax(income, adjustable) {
  const issues = [];
  if (!adjustable || !income) return issues;

  // The salary gross-receipt on the AT form should match the salary total
  // on the Income form. A drift here is usually because the user edited
  // Income after AT and the link wasn't refreshed.
  const incomeSalary = num(income.annual_salary_wages_total);
  const atSalary     = num(adjustable.salary_employees_149_gross_receipt);
  if (incomeSalary > 0 && Math.abs(incomeSalary - atSalary) > 1) {
    issues.push({
      severity: 'warning', code: 'AT_SALARY_GROSS_DRIFT',
      message: `Adjustable Tax salary gross (Rs ${atSalary.toLocaleString()}) doesn't match Income form salary (Rs ${incomeSalary.toLocaleString()}).`,
      formStep: 'adjustable_tax',
      fix: 'Open Adjustable Tax and click "Refresh links" — the gross receipt should re-sync from the Income form.',
    });
  }

  // Tax collected can't exceed gross receipt (would imply a > 100% WHT rate).
  const grossReceiptCols = Object.keys(adjustable).filter((k) => k.endsWith('_gross_receipt'));
  for (const grossCol of grossReceiptCols) {
    const taxCol = grossCol.replace(/_gross_receipt$/, '_tax_collected');
    const gross  = num(adjustable[grossCol]);
    const tax    = num(adjustable[taxCol]);
    if (gross > 0 && tax > gross) {
      issues.push({
        severity: 'error', code: 'AT_TAX_EXCEEDS_GROSS',
        message: `Adjustable Tax line "${grossCol.replace(/_gross_receipt$/, '')}": tax collected (Rs ${tax.toLocaleString()}) exceeds gross receipt (Rs ${gross.toLocaleString()}).`,
        formStep: 'adjustable_tax',
        fix: 'Open Adjustable Tax and verify the gross-receipt and tax-collected pair against your withholding certificate.',
      });
    }
  }
  return issues;
}

function checkCapitalGain(cg) {
  if (!cg) return [];
  // Drift check intentionally retired.
  //
  // This used to compare a declared total against the sum of per-bucket
  // amounts (property_1_year / property_2_3_years / securities / …). Migration
  // phase-u dropped all of those legacy columns and replaced total_capital_gain
  // with a GENERATED ALWAYS AS (...) STORED column summed from the surviving
  // immovable_property_*_taxable / securities_*_taxable families. Because the
  // total is now derived by the database it can no longer drift from its
  // components, so the check has nothing to verify. (Reading the dropped column
  // names also silently produced 0 here, making this a permanent no-op — see
  // audit finding BE-04.) Left as an explicit, documented no-op rather than
  // resurrecting a check the schema now enforces for us.
  return [];
}

function checkWealth(wealth, wealthRecon) {
  const issues = [];

  if (!wealthRecon) {
    issues.push({
      severity: 'error', code: 'WEALTH_RECON_MISSING',
      message: 'Wealth Reconciliation has not been completed.',
      formStep: 'wealth_reconciliation',
      fix: 'Open Wealth Statement → Reconciliation and balance your inflows against outflows.',
    });
    return issues;
  }

  // The single most common FBR rejection: unreconciled difference > 0.
  const diff = Math.abs(num(wealthRecon.unreconciled_difference));
  if (diff >= 1) {
    issues.push({
      severity: 'error', code: 'WEALTH_RECON_UNBALANCED',
      message: `Wealth reconciliation has an unreconciled difference of Rs ${num(wealthRecon.unreconciled_difference).toLocaleString()}. FBR will reject the return.`,
      formStep: 'wealth_reconciliation',
      fix: 'Open Wealth Reconciliation; the inflows must equal asset-increase + outflows. Common balancing items: foreign remittance, gift received, loan received.',
    });
  }

  if (wealth) {
    // Net assets in wealth statement should match net_assets_* on recon.
    // Drift means the user edited one without the other.
    const wsCurrent = num(wealth.total_assets_current_year)     - num(wealth.total_liabilities_current_year);
    const wsPrev    = num(wealth.total_assets_previous_year)    - num(wealth.total_liabilities_previous_year);
    const wrCurrent = num(wealthRecon.net_assets_current_year);
    const wrPrev    = num(wealthRecon.net_assets_previous_year);
    if (wrCurrent > 0 && Math.abs(wsCurrent - wrCurrent) > 1) {
      issues.push({
        severity: 'warning', code: 'WEALTH_NET_ASSETS_DRIFT',
        message: `Net assets (current year) on the Wealth Statement (Rs ${wsCurrent.toLocaleString()}) doesn't match the Reconciliation (Rs ${wrCurrent.toLocaleString()}).`,
        formStep: 'wealth_reconciliation',
        fix: 'Open Wealth Reconciliation and confirm the net-assets figures sync from the Wealth Statement.',
      });
    }
    if (wrPrev > 0 && Math.abs(wsPrev - wrPrev) > 1) {
      issues.push({
        severity: 'warning', code: 'WEALTH_NET_ASSETS_DRIFT',
        message: `Net assets (previous year) on the Wealth Statement (Rs ${wsPrev.toLocaleString()}) doesn't match the Reconciliation (Rs ${wrPrev.toLocaleString()}).`,
        formStep: 'wealth_reconciliation',
        fix: 'Open Wealth Reconciliation and confirm the prior-year net-assets figure.',
      });
    }
  }

  return issues;
}

function checkExpenses(expenses, income) {
  if (!expenses || !income) return [];
  const issues = [];
  // Personal expenses > total income is suspicious. FBR auto-flags it.
  const totalExpenses = num(expenses.total_expenses);
  const totalIncome = num(income.total_employment_income) + num(income.other_income_min_tax_total) + num(income.other_income_no_min_tax_total);
  if (totalIncome > 0 && totalExpenses > totalIncome * 1.5) {
    issues.push({
      severity: 'warning', code: 'EXPENSES_EXCEED_INCOME',
      message: `Total expenses (Rs ${totalExpenses.toLocaleString()}) exceed 150% of declared income (Rs ${totalIncome.toLocaleString()}). FBR may flag this for audit.`,
      formStep: 'expenses',
      fix: 'Open Allowable Expenses and verify each line — check the "other_expenses" balancing figure especially.',
    });
  }
  return issues;
}

function checkAlreadySubmitted(taxReturn) {
  if (!taxReturn) return [];
  if (taxReturn.filing_status === 'submitted') {
    return [{
      severity: 'error', code: 'ALREADY_SUBMITTED',
      message: `This return was already submitted on ${new Date(taxReturn.submission_date).toLocaleDateString('en-PK')}.`,
      formStep: null,
      fix: 'A submitted return cannot be re-submitted from the app. Use FBR IRIS to file a revised return.',
    }];
  }
  return [];
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run every readiness check for a (user, taxYear). Returns:
 *   { ready: bool, issues: Issue[], warnings: Issue[],
 *     summary: { errorCount, warningCount, taxYear } }
 */
async function checkReadiness(userId, taxYear) {
  const [user, income, adjustable, cg, expenses, wealth, wealthRecon, taxReturn] = await Promise.all([
    fetchUser(userId),
    fetchIncome(userId, taxYear),
    fetchAdjustable(userId, taxYear),
    fetchCapitalGain(userId, taxYear),
    fetchExpenses(userId, taxYear),
    fetchWealth(userId, taxYear),
    fetchWealthRecon(userId, taxYear),
    fetchTaxReturn(userId, taxYear),
  ]);

  const all = [
    ...checkAlreadySubmitted(taxReturn),
    ...checkUserIdentity(user),
    ...checkIncomeForm(income),
    ...checkAdjustableTax(income, adjustable),
    ...checkCapitalGain(cg),
    ...checkWealth(wealth, wealthRecon),
    ...checkExpenses(expenses, income),
  ];

  const issues   = all.filter((x) => x.severity === 'error');
  const warnings = all.filter((x) => x.severity === 'warning');

  return {
    ready: issues.length === 0,
    issues,
    warnings,
    summary: {
      taxYear,
      errorCount:   issues.length,
      warningCount: warnings.length,
    },
  };
}

module.exports = {
  checkReadiness,
  // Exported for unit tests
  _internal: {
    checkUserIdentity,
    checkIncomeForm,
    checkAdjustableTax,
    checkCapitalGain,
    checkWealth,
    checkExpenses,
    checkAlreadySubmitted,
  },
};
