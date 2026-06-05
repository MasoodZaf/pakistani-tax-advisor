const express = require('express');
const auth = require('../../../middleware/auth');
// Shared form helpers (CQ-05): getCurrentTaxYear / recalculateFormCompletion /
// saveFormData were lifted verbatim into this module.
const {
  saveFormData,
} = require('../helpers/taxFormsShared');

const {
  getCurrentReturn,
  createReturn,
  saveIncomeProfile,
} = require('../controllers/returnController');
const {
  getAdjustableTax,
  saveAdjustableTax,
} = require('../controllers/adjustableTaxController');
const {
  getFinalMinIncome,
  saveFinalMinIncome,
} = require('../controllers/finalMinController');
const {
  getCapitalGains,
  getReductions,
  getCredits,
  getDeductions,
  getFinalTax,
  getExpenses,
} = require('../controllers/formsReadController');
const {
  getTaxComputation,
  getReadiness,
  submitReturn,
} = require('../controllers/computationController');
const {
  getExpenseSuggestions,
  applyExpenseSuggestions,
} = require('../controllers/expenseSuggestionsController');

const router = express.Router();

// Validate any :taxYear segment up front (SEC-09).
router.param('taxYear', require('../../../middleware/validation').validateTaxYearParam);

// GET /api/tax-forms/current-return - Get current tax return with all form data
router.get('/current-return', auth, getCurrentReturn);

// POST /api/tax-forms/create-return - Create a new tax return
router.post('/create-return', auth, createReturn);

// POST /api/tax-forms/income-profile - Save income profile (addons selection)
router.post('/income-profile', auth, saveIncomeProfile);

// GET /api/tax-forms/adjustable-tax - Get adjustable tax form data with auto-linking
router.get('/adjustable-tax', auth, getAdjustableTax);

// POST /api/tax-forms/adjustable-tax - Save adjustable tax form data
router.post('/adjustable-tax', auth, saveAdjustableTax);

// Removed duplicate income_forms endpoint - now using /api/income-form/* for all income operations

// Helper function to save form data generically.
//
// Atomic upsert via INSERT ... ON CONFLICT (user_id, tax_year) DO UPDATE SET ...
// Requires the target table to carry the unique constraint added in
// phase-d-form-unique-constraints.sql. Before that migration, this helper
// fell back to a SELECT-then-INSERT/UPDATE pattern which raced under
// concurrent saves and duplicated rows.
//
// Identifiers (table, columns) are NEVER taken from request input — they come
// from getAllowedColumns(tableName), sourced from information_schema.
// GET /api/tax-forms/capital-gains - Get capital gains data
router.get('/capital-gains', auth, getCapitalGains);

// POST /api/tax-forms/capital-gains - Save capital gains data
router.post('/capital-gains', auth, (req, res) =>
  saveFormData('capital_gain_forms', 'capital_gains', req, res)
);

// GET /api/tax-forms/final-min-income - Get final/min income data with auto-linking
router.get('/final-min-income', auth, getFinalMinIncome);

// POST /api/tax-forms/final-min-income - Save final/min income data with tax_chargeable calculations
router.post('/final-min-income', auth, saveFinalMinIncome);

// GET /api/tax-forms/reductions - Get reductions data
router.get('/reductions', auth, getReductions);

// POST /api/tax-forms/reductions - Save reductions data
router.post('/reductions', auth, (req, res) =>
  saveFormData('reductions_forms', 'reductions', req, res)
);

// GET /api/tax-forms/credits - Get credits data
router.get('/credits', auth, getCredits);

// POST /api/tax-forms/credits - Save credits data
router.post('/credits', auth, (req, res) => saveFormData('credits_forms', 'credits', req, res));

// GET /api/tax-forms/deductions - Get deductions data
router.get('/deductions', auth, getDeductions);

// POST /api/tax-forms/deductions - Save deductions data.
// Server-side guard: education-expense deduction (s.60D) is capped at
// 2 children — the client form enforces this via `max=2` on the input, but
// a crafted POST could persist a higher count. Reject anything > 2 before
// the row hits the DB.
router.post('/deductions', auth, (req, res, next) => {
  const count = Number(
    req.body?.educational_expenses_children_count ??
    req.body?.education_expense_children ??
    0
  );
  if (count > 2) {
    return res.status(400).json({
      success: false,
      message: 'Educational expense deduction u/s 60D is capped at 2 children.',
    });
  }
  next();
}, (req, res) => saveFormData('deductions_forms', 'deductions', req, res));

// GET /api/tax-forms/final-tax - Get final tax data
router.get('/final-tax', auth, getFinalTax);

// POST /api/tax-forms/final-tax - Save final tax data
router.post('/final-tax', auth, (req, res) =>
  saveFormData('final_tax_forms', 'final_tax', req, res)
);

// GET /api/tax-forms/expenses - Get expenses data
router.get('/expenses', auth, getExpenses);

// POST /api/tax-forms/expenses - Save expenses data
router.post('/expenses', auth, (req, res) => saveFormData('expenses_forms', 'expenses', req, res));

// GET /api/tax-forms/tax-computation - Get tax computation with auto-linking from all forms
router.get('/tax-computation', auth, getTaxComputation);

// POST /api/tax-forms/tax-computation - Save tax computation data
router.post('/tax-computation', auth, (req, res) =>
  saveFormData('tax_computation_forms', 'tax_computation', req, res)
);

// POST /api/tax-forms/wealth_forms - Save wealth statement data
// Called by TaxFormContext when step id='wealth' (formType='wealth_forms')
router.post('/wealth_forms', auth, (req, res) =>
  saveFormData('wealth_forms', 'wealth', req, res)
);

// POST /api/tax-forms/wealth_reconciliation_forms - Save wealth reconciliation data
// Called by TaxFormContext when step id='wealth_reconciliation' (formType='wealth_reconciliation_forms')
router.post('/wealth_reconciliation_forms', auth, (req, res) =>
  saveFormData('wealth_reconciliation_forms', 'wealth_reconciliation', req, res)
);

// ──────────────────────────────────────────────────────────────────────────
// Filing readiness — pre-submit gate
// ──────────────────────────────────────────────────────────────────────────

// GET /api/tax-forms/readiness/:taxYear
// Returns the structured pre-submit punch list. The frontend uses this to
// render the "Before you submit" panel; the submit endpoint enforces it
// server-side regardless.
router.get('/readiness/:taxYear', auth, getReadiness);

// POST /api/tax-forms/submit
// Body: { taxReturnId, taxYear }. Runs readiness; refuses if not ready.
// Otherwise marks the return as submitted (filing_status='submitted',
// submission_date=NOW()). Returns 422 with the issue list on failure.
router.post('/submit', auth, submitReturn);

// GET /api/tax-forms/expense-suggestions?taxYear=YYYY-YY
// Aggregates the mobile-captured expenses for a year so the web filing flow
// can offer "you have ₨50,000 in Zakat across 5 entries — apply?" pre-fills.
// Returns rows where deleted_at IS NULL AND included_in_return = FALSE.
router.get('/expense-suggestions', auth, getExpenseSuggestions);

// POST /api/tax-forms/expense-suggestions/apply
// Body: { taxYear, expense_ids: [...] }
// Marks the given (user-owned, non-deleted, not-yet-included) expenses as
// included_in_return=TRUE and returns the per-treatment totals that were
// applied so the caller can pre-fill the deductions form.
router.post('/expense-suggestions/apply', auth, applyExpenseSuggestions);

module.exports = router;
