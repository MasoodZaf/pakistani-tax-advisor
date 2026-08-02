const express = require('express');
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const CalculationService = require('../services/calculationService');
const ensureTaxReturn = require('../helpers/ensureTaxReturn');
const { recalculateFormCompletion } = require('../modules/IncomeTax/helpers/taxFormsShared');
const {
  guardMoneyFields,
  assertStorable,
  parseMoneyInput,
} = require('../middleware/numericGuards');

const router = express.Router();

// Every money input this route accepts. Kept at module scope because it is now
// TWO things: the cleaning loop's field list (as it always was) and the
// `alsoGuard` set handed to the money guard. One list, so a field added here
// is validated automatically instead of quietly bypassing validation — the
// stale-hardcoded-list failure mode QA rejected the last remediation pass for.
//
// The schema-derived half of the guarded set covers the annual fields (they are
// income_forms columns). What this list adds is the derived inputs that are NOT
// columns: the monthly_* fields, which CalculationService annualises, and the
// alias fields consumed by the same service.
const INCOME_MONEY_INPUTS = [
  // Monthly fields (will be converted to annual)
  'monthly_basic_salary', 'monthly_allowances', 'monthly_house_rent_allowance',
  'monthly_conveyance_allowance', 'monthly_medical_allowance',
  // Annual fields (direct input)
  'annual_basic_salary', 'allowances', 'bonus', 'medical_allowance',
  'pension_from_ex_employer', 'employment_termination_payment',
  'retirement_from_approved_funds', 'directorship_fee', 'other_cash_benefits',
  'employer_contribution_provident', 'taxable_car_value', 'other_taxable_subsidies',
  'profit_on_debt_15_percent', 'profit_on_debt_12_5_percent',
  'other_taxable_income_rent', 'other_taxable_income_others',
  // Additional fields for comprehensive calculation
  'bonus_commission', 'retirement_amount', 'noncash_benefits_gross',
  'provident_fund_contribution', 'gratuity', 'rent_income', 'other_income'
];

// Validate any :taxYear segment up front (SEC-09).
router.param('taxYear', require('../middleware/validation').validateTaxYearParam);

// GET /api/income-form/:taxYear - Get income form data for a specific tax year
router.get('/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    logger.info(`Fetching income form data for user ${userId}, tax year ${taxYear}`);

    const result = await pool.query(
      `SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );

    if (result.rows.length === 0) {
      // Return empty form structure if no data found. Wrap in {success,data}
      // so the response shape matches every other /api/tax-forms/* endpoint.
      const emptyForm = {
        user_id: userId,
        tax_year: taxYear,
        annual_basic_salary: 0,
        allowances: 0,
        bonus: 0,
        medical_allowance: 0,
        pension_from_ex_employer: 0,
        employment_termination_payment: 0,
        retirement_from_approved_funds: 0,
        directorship_fee: 0,
        other_cash_benefits: 0,
        employer_contribution_provident: 0,
        taxable_car_value: 0,
        other_taxable_subsidies: 0,
        profit_on_debt_15_percent: 0,
        profit_on_debt_12_5_percent: 0,
        other_taxable_income_rent: 0,
        other_taxable_income_others: 0
      };

      logger.info(`No income form data found for user ${userId}, tax year ${taxYear}, returning empty form`);
      // Flat root copy kept for back-compat with any legacy frontend code that
      // reads the row directly. New code should use .data.
      return res.json({ success: true, data: emptyForm, ...emptyForm });
    }

    const incomeForm = result.rows[0];
    logger.info(`Income form data retrieved for user ${userId}, tax year ${taxYear}`);
    res.json({ success: true, data: incomeForm, ...incomeForm });

  } catch (error) {
    logger.error('Error fetching income form data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch income form data',
      error: error.message
    });
  }
});

// POST /api/income-form/:taxYear - Create or update income form data with Excel calculations
// Money guard runs AFTER auth so an anonymous caller gets 401 rather than a 400
// that would confirm which columns exist. Rejects (400, all offending fields at
// once): unparseable non-empty amounts (F-09, previously stored as 0.00 with a
// "saved" message), negative amounts (F-07), and amounts above the column's
// DECIMAL(15,2) ceiling (F-08, previously an opaque 500).
router.post('/:taxYear', auth, guardMoneyFields({
  table: 'income_forms',
  alsoGuard: INCOME_MONEY_INPUTS,
}), async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;
    const userEmail = req.user.email;
    const formData = req.body;
    // "Complete & next" on the income step. Coerced the same way saveFormData
    // coerces it for the other 11 forms.
    const isComplete = formData.isComplete === true || formData.isComplete === 'true';

    // Link the income form to its tax return. This endpoint historically did
    // NOT set tax_return_id (unlike every other form via saveFormData), leaving
    // income_forms.tax_return_id NULL — which broke every tax_return_id-keyed
    // read (Income Analysis report, Tax Computation view all showed Rs 0 even
    // with salary present). ensureTaxReturn creates the return if missing.
    const taxReturnId = await ensureTaxReturn(userId, userEmail, taxYear);

    logger.info(`Saving income form data for user ${userId}, tax year ${taxYear}`, {
      monthly_basic_salary: formData.monthly_basic_salary,
      directorship_fee: formData.directorship_fee
    });

    // Clean all input fields.
    //
    // parseMoneyInput is the SAME parser the money guard validated with, so a
    // value that passed the guard cannot mean something different here. The
    // lenient behaviours it preserves ("1,200,000", "1.2e6", padded whitespace,
    // decimals) are QA-verified and must not change.
    //
    // Reaching this point, `supplied: false` is the only remaining fallback-to-0
    // case — blank means "the user did not fill this in", which is legitimate on
    // an incrementally saved form. Junk can no longer reach here: the guard
    // returned 400 before the handler ran, so a figure is never silently
    // replaced with 0.00 while the user is told the form saved (F-09).
    const cleanedData = {};
    for (const field of INCOME_MONEY_INPUTS) {
      const parsed = parseMoneyInput(formData[field]);
      cleanedData[field] = parsed.supplied && parsed.valid ? parsed.value : 0;
    }

    // Calculate Excel formulas using CalculationService
    const calculations = CalculationService.calculateIncomeFormFields(cleanedData);

    logger.info('Income form calculations completed:', {
      input_monthly_salary: cleanedData.monthly_basic_salary,
      calculated_annual_salary: calculations.annual_basic_salary,
      total_employment_income: calculations.total_employment_income
    });

    // Prepare data for database insertion
    const dbData = {
      // Use calculated values where available, otherwise use cleaned input
      annual_basic_salary: calculations.annual_basic_salary || cleanedData.annual_basic_salary || 0,
      allowances: calculations.annual_allowances || cleanedData.allowances || 0,
      bonus: calculations.bonus_commission || cleanedData.bonus || 0,
      medical_allowance: calculations.annual_medical_allowance || cleanedData.medical_allowance || 0,
      pension_from_ex_employer: calculations.retirement_amount || cleanedData.pension_from_ex_employer || 0,
      employment_termination_payment: calculations.employment_termination_payment || cleanedData.employment_termination_payment || 0,
      retirement_from_approved_funds: cleanedData.retirement_from_approved_funds || 0,
      directorship_fee: calculations.directorship_fee || cleanedData.directorship_fee || 0,
      other_cash_benefits: cleanedData.other_cash_benefits || 0,
      employer_contribution_provident: cleanedData.employer_contribution_provident || 0,
      taxable_car_value: cleanedData.taxable_car_value || 0,
      other_taxable_subsidies: cleanedData.other_taxable_subsidies || 0,
      profit_on_debt_15_percent: calculations.profit_debt_15_percent || cleanedData.profit_on_debt_15_percent || 0,
      profit_on_debt_12_5_percent: calculations.profit_debt_12_5_percent || cleanedData.profit_on_debt_12_5_percent || 0,
      other_taxable_income_rent: calculations.rent_income || cleanedData.other_taxable_income_rent || 0,
      other_taxable_income_others: calculations.other_income || cleanedData.other_taxable_income_others || 0,
      // Note: Calculated fields are handled by database generated columns
    };

    // Second F-08 gate, on the values actually about to be bound.
    //
    // The middleware can only see what the client sent. CalculationService
    // DERIVES most of dbData — monthly_basic_salary is multiplied by 12, several
    // fields are summed — so an input that is individually storable can still
    // produce a figure past DECIMAL(15,2). Without this check that path is still
    // a Postgres 22003 surfaced as an opaque 500. Same helper, same maxima, so
    // the two gates cannot disagree.
    const storabilityErrors = await assertStorable('income_forms', dbData);
    if (storabilityErrors.length > 0) {
      logger.warn(`Income form rejected: ${storabilityErrors.length} unstorable computed amount(s)`, {
        userId,
        fields: storabilityErrors.map((e) => `${e.field}:${e.code}`)
      });
      return res.status(400).json({
        success: false,
        message: 'The calculated amounts are too large to be saved. Please check the figures you entered.',
        errors: storabilityErrors
      });
    }

    // Use UPSERT with only input fields (generated columns are calculated automatically)
    const query = `
      INSERT INTO income_forms (
        user_id, tax_year, tax_return_id, user_email,
        annual_basic_salary, allowances, bonus, medical_allowance,
        pension_from_ex_employer, employment_termination_payment,
        retirement_from_approved_funds, directorship_fee, other_cash_benefits,
        employer_contribution_provident, taxable_car_value, other_taxable_subsidies,
        profit_on_debt_15_percent, profit_on_debt_12_5_percent,
        other_taxable_income_rent, other_taxable_income_others,
        is_complete
      ) VALUES (
        $1, $2, $19, $20, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $21
      )
      ON CONFLICT (user_id, tax_year)
      DO UPDATE SET
        tax_return_id = EXCLUDED.tax_return_id,
        user_email = EXCLUDED.user_email,
        annual_basic_salary = EXCLUDED.annual_basic_salary,
        allowances = EXCLUDED.allowances,
        bonus = EXCLUDED.bonus,
        medical_allowance = EXCLUDED.medical_allowance,
        pension_from_ex_employer = EXCLUDED.pension_from_ex_employer,
        employment_termination_payment = EXCLUDED.employment_termination_payment,
        retirement_from_approved_funds = EXCLUDED.retirement_from_approved_funds,
        directorship_fee = EXCLUDED.directorship_fee,
        other_cash_benefits = EXCLUDED.other_cash_benefits,
        employer_contribution_provident = EXCLUDED.employer_contribution_provident,
        taxable_car_value = EXCLUDED.taxable_car_value,
        other_taxable_subsidies = EXCLUDED.other_taxable_subsidies,
        profit_on_debt_15_percent = EXCLUDED.profit_on_debt_15_percent,
        profit_on_debt_12_5_percent = EXCLUDED.profit_on_debt_12_5_percent,
        other_taxable_income_rent = EXCLUDED.other_taxable_income_rent,
        other_taxable_income_others = EXCLUDED.other_taxable_income_others,
        -- BE-06 sticky completion, identical to saveFormData's rule for the
        -- other 11 forms: a partial "Save data" must not un-complete a form the
        -- user already finished; only an explicit completion flips it true.
        -- This endpoint never wrote is_complete at all, so income_forms.is_complete
        -- was false for every user ever, which made all_forms_complete — and
        -- therefore submission — unreachable.
        is_complete = income_forms.is_complete OR EXCLUDED.is_complete,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      userId, taxYear,
      dbData.annual_basic_salary, dbData.allowances, dbData.bonus,
      dbData.medical_allowance, dbData.pension_from_ex_employer,
      dbData.employment_termination_payment, dbData.retirement_from_approved_funds,
      dbData.directorship_fee, dbData.other_cash_benefits,
      dbData.employer_contribution_provident, dbData.taxable_car_value,
      dbData.other_taxable_subsidies, dbData.profit_on_debt_15_percent,
      dbData.profit_on_debt_12_5_percent, dbData.other_taxable_income_rent,
      dbData.other_taxable_income_others,
      taxReturnId, userEmail,  // $19, $20
      isComplete               // $21
    ];

    const result = await pool.query(query, values);
    const savedForm = result.rows[0];

    // Refresh form_completion_status so the progress counter and
    // all_forms_complete reflect the write immediately, the same way
    // saveFormData does for every other form. Never fail the save on this.
    try {
      await recalculateFormCompletion(userId, taxYear);
    } catch (e) {
      logger.warn(`Income form completion recalc failed for user ${userId}: ${e.message}`);
    }

    logger.info(`Income form data saved successfully for user ${userId}, tax year ${taxYear}`, {
      annual_basic_salary: savedForm.annual_basic_salary,
      total_employment_income: savedForm.total_employment_income
    });

    res.json({
      success: true,
      message: 'Income form saved successfully',
      data: savedForm,
      calculations: calculations
    });

  } catch (error) {
    logger.error('Error saving income form data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save income form data',
      error: error.message
    });
  }
});

// DELETE /api/income-form/:taxYear - Delete income form data
router.delete('/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    logger.info(`Deleting income form data for user ${userId}, tax year ${taxYear}`);

    const result = await pool.query(
      'DELETE FROM income_forms WHERE user_id = $1 AND tax_year = $2 RETURNING *',
      [userId, taxYear]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Income form not found'
      });
    }

    logger.info(`Income form data deleted for user ${userId}, tax year ${taxYear}`);
    res.json({
      success: true,
      message: 'Income form deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting income form data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete income form data',
      error: error.message
    });
  }
});

module.exports = router;