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

// ──────────────────────────────────────────────────────────────────────────
// Validation.
//
// Two of these validators (`validateCreditsForm`, `validateDeductionsForm`)
// existed for months and were wired to no route at all — dead code, while the
// forms they were written for accepted anything. Every write path below now
// carries its shape validator AND its statutory-limit enforcer. If you add a
// POST route to this router, it needs both; a route with neither is the
// defect this file was remediated for.
// ──────────────────────────────────────────────────────────────────────────
const Validation = require('../../../middleware/validation');
const {
  enforceDeductionLimits,
  enforceCreditLimits,
  enforceReductionLimits,
  validateEducationChildCount,
  makeFormValidator,
  stripServerComputedFields,
} = Validation;

// Shape validators for the forms with no statutory quantum of their own.
// Fields are discovered from the body; the only ceiling is the DECIMAL(15,2)
// overflow guard.
const validateFinalTaxForm = makeFormValidator('final tax');
const validateFinalMinForm = makeFormValidator('final/min income');
const validateExpensesForm = makeFormValidator('expenses');
// Wealth and reconciliation figures are legitimately signed —
// `income_exempt_from_tax` is negative by construction and asset movements go
// both ways — so these two get the overflow guard without a sign constraint.
const validateWealthForm = makeFormValidator('wealth statement', { allowNegative: true });
const validateWealthReconForm = makeFormValidator('wealth reconciliation', { allowNegative: true });

const router = express.Router();

// Validate any :taxYear segment up front (SEC-09).
router.param('taxYear', Validation.validateTaxYearParam);

// GET /api/tax-forms/current-return - Get current tax return with all form data
router.get('/current-return', auth, getCurrentReturn);

// POST /api/tax-forms/create-return - Create a new tax return
router.post('/create-return', auth, createReturn);

// POST /api/tax-forms/income-profile - Save income profile (addons selection)
router.post('/income-profile', auth, saveIncomeProfile);

// GET /api/tax-forms/adjustable-tax - Get adjustable tax form data with auto-linking
router.get('/adjustable-tax', auth, getAdjustableTax);

// POST /api/tax-forms/adjustable-tax - Save adjustable tax form data
// Withholding is client-supplied and feeds the refund calculation directly;
// unvalidated it was drivable to a −999,699,999 "refund".
router.post('/adjustable-tax', auth, Validation.validateAdjustableTaxForm, saveAdjustableTax);

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
router.post('/capital-gains', auth, Validation.validateCapitalGainsForm, (req, res) =>
  saveFormData('capital_gain_forms', 'capital_gains', req, res)
);

// GET /api/tax-forms/final-min-income - Get final/min income data with auto-linking
router.get('/final-min-income', auth, getFinalMinIncome);

// POST /api/tax-forms/final-min-income - Save final/min income data with tax_chargeable calculations
router.post('/final-min-income', auth, validateFinalMinForm, saveFinalMinIncome);

// GET /api/tax-forms/reductions - Get reductions data
router.get('/reductions', auth, getReductions);

// POST /api/tax-forms/reductions - Save reductions data.
// enforceReductionLimits caps the Behbood relief at the tax charged above the
// 5% ceiling (2nd Sched Pt III cl.6) and recomputes total_tax_reductions from
// its components — the engine reads that total, not the components.
router.post('/reductions', auth, enforceReductionLimits, (req, res) =>
  saveFormData('reductions_forms', 'reductions', req, res)
);

// GET /api/tax-forms/credits - Get credits data
router.get('/credits', auth, getCredits);

// POST /api/tax-forms/credits - Save credits data.
// validateCreditsForm was written for this route and never attached to it.
// enforceCreditLimits applies the s.61 (30% / 15% associate) and s.63 (20%)
// caps and recomputes total_tax_credits from its components.
router.post(
  '/credits',
  auth,
  Validation.validateCreditsForm,
  enforceCreditLimits,
  (req, res) => saveFormData('credits_forms', 'credits', req, res)
);

// GET /api/tax-forms/deductions - Get deductions data
router.get('/deductions', auth, getDeductions);

// POST /api/tax-forms/deductions - Save deductions data.
//
// The previous guard here checked only `children > 2` and was cosmetic: a POST
// with children_count=1 and an education amount of 5,000,000 stored fine and
// the engine deducted all of it, taking a lawful Rs 21,400 liability to Rs 0.
// It guarded the count and never the amount, and there was no income-threshold
// check on the server at all.
//
//   validateDeductionsForm      — shape; also the validator that existed but
//                                 was wired to nothing, and which omitted
//                                 educational_expenses_amount entirely.
//   validateEducationChildCount — the count gate, limit now from
//                                 tax_rates_config rather than a literal 2.
//   enforceDeductionLimits      — the s.60C / s.60D quantum + threshold rules,
//                                 and the server-side recompute of
//                                 total_deduction_from_income.
router.post(
  '/deductions',
  auth,
  Validation.validateDeductionsForm,
  validateEducationChildCount,
  enforceDeductionLimits,
  (req, res) => saveFormData('deductions_forms', 'deductions', req, res)
);

// GET /api/tax-forms/final-tax - Get final tax data
router.get('/final-tax', auth, getFinalTax);

// POST /api/tax-forms/final-tax - Save final tax data
router.post('/final-tax', auth, validateFinalTaxForm, (req, res) =>
  saveFormData('final_tax_forms', 'final_tax', req, res)
);

// GET /api/tax-forms/expenses - Get expenses data
router.get('/expenses', auth, getExpenses);

// POST /api/tax-forms/expenses - Save expenses data
router.post('/expenses', auth, validateExpensesForm, (req, res) =>
  saveFormData('expenses_forms', 'expenses', req, res)
);

// GET /api/tax-forms/tax-computation - Get tax computation with auto-linking from all forms
router.get('/tax-computation', auth, getTaxComputation);

// POST /api/tax-forms/tax-computation - Save tax computation data
// Every substantive column on tax_computation_forms is a figure the SERVER
// derives, and the headline columns (net_tax_payable, total_tax_liability,
// balance_payable) are GENERATED from them — so a client-supplied value became
// the taxpayer's stored liability. This endpoint now accepts no figures at all;
// see stripServerComputedFields.
router.post('/tax-computation', auth, stripServerComputedFields, (req, res) =>
  saveFormData('tax_computation_forms', 'tax_computation', req, res)
);

// POST /api/tax-forms/wealth_forms - Save wealth statement data
// Called by TaxFormContext when step id='wealth' (formType='wealth_forms')
router.post('/wealth_forms', auth, validateWealthForm, (req, res) =>
  saveFormData('wealth_forms', 'wealth', req, res)
);

// POST /api/tax-forms/wealth_reconciliation_forms - Save wealth reconciliation data
// Called by TaxFormContext when step id='wealth_reconciliation' (formType='wealth_reconciliation_forms')
router.post('/wealth_reconciliation_forms', auth, validateWealthReconForm, (req, res) =>
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
