const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const { checkReadiness } = require('../../../services/readinessService');
const {
  getCurrentTaxYear,
} = require('../helpers/taxFormsShared');
const { getAllowedColumns, filterToAllowedColumns } = require('../../../helpers/tableColumns');
const {
  toTaxComputationRow,
  NO_ENGINE_COUNTERPART,
  KNOWN_GENERATED_COLUMN_GAPS,
} = require('../helpers/taxComputationShape');
const ensureTaxReturn = require('../../../helpers/ensureTaxReturn');

/**
 * Populate tax_computation_forms from the engine.
 *
 * The POST endpoint accepts no figures (lane A stripped them — the headline
 * columns are GENERATED over the inputs, so a client value became the stored
 * liability). Every substantive column is therefore written here, from
 * TaxCalculationService's breakdown, never from the request body.
 *
 * Returns the persisted row, or null when the computation cannot run (no income
 * form yet). Never throws into the caller's save — a failure to compute must not
 * lose the user's completion flag.
 */
const populateTaxComputationFromEngine = async (userId, userEmail, taxYear) => {
  const TaxCalculationService = require('../../../services/taxCalculationService');

  let breakdown;
  try {
    breakdown = await TaxCalculationService.calculateTaxComputation(userId, taxYear);
  } catch (e) {
    logger.warn(
      `Tax computation not populated for user ${userId} ${taxYear}: ${e.message}`
    );
    return null;
  }

  const { values } = toTaxComputationRow(breakdown);

  const taxReturnId = await ensureTaxReturn(userId, userEmail, taxYear);
  const taxYearRow = await pool.query(
    'SELECT id FROM tax_years WHERE tax_year = $1',
    [taxYear]
  );
  if (taxYearRow.rows.length === 0) {
    throw new Error(`Invalid tax year "${taxYear}"`);
  }

  const allowedColumns = await getAllowedColumns('tax_computation_forms');
  // Filters out any column this deployment's schema does not have (phase-w /
  // phase-t1 may or may not be applied), and would flag a mapping key that is
  // not a column at all.
  const safeValues = filterToAllowedColumns('tax_computation_forms', allowedColumns, values);

  const dataToSave = {
    ...safeValues,
    tax_return_id: taxReturnId,
    user_id: userId,
    user_email: userEmail,
    tax_year_id: taxYearRow.rows[0].id,
    tax_year: taxYear,
    last_updated_by: userId,
  };

  const identityKeys = new Set([
    'tax_return_id', 'user_id', 'user_email', 'tax_year_id', 'tax_year',
  ]);
  const columns = Object.keys(dataToSave);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateAssignments = columns
    .filter((c) => !identityKeys.has(c))
    .map((c) => `${c} = EXCLUDED.${c}`)
    .concat(['updated_at = CURRENT_TIMESTAMP'])
    .join(', ');

  const result = await pool.query(
    `INSERT INTO tax_computation_forms (${columns.join(', ')}) ` +
    `VALUES (${placeholders}) ` +
    `ON CONFLICT (user_id, tax_year) DO UPDATE SET ${updateAssignments} ` +
    `RETURNING *`,
    columns.map((c) => dataToSave[c])
  );

  logger.info(`Tax computation populated from engine for user ${userId} ${taxYear}`, {
    columnsWritten: Object.keys(safeValues).length,
    leftAtZero: Object.keys(NO_ENGINE_COUNTERPART),
    generatedColumnGaps: Object.keys(KNOWN_GENERATED_COLUMN_GAPS),
  });

  return result.rows[0];
};

const getTaxComputation = async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || await getCurrentTaxYear();

    logger.info(
      `Fetching tax computation for user ${userId}, tax year ${taxYear} with auto-linking`
    );

    // Fetch Income Form data (primary source)
    let incomeData = null;
    try {
      const incomeResult = await pool.query(
        'SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (incomeResult.rows.length > 0) {
        incomeData = incomeResult.rows[0];
        logger.info('Income form data found for auto-linking:', {
          total_employment_income: incomeData.total_employment_income,
          other_income_min_tax_total: incomeData.other_income_min_tax_total,
          other_income_no_min_tax_total: incomeData.other_income_no_min_tax_total,
        });
      }
    } catch (error) {
      logger.warn('Could not fetch income form data:', error.message);
    }

    // Fetch Adjustable Tax data
    let adjustableTaxData = null;
    try {
      const adjustableResult = await pool.query(
        'SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (adjustableResult.rows.length > 0) {
        adjustableTaxData = adjustableResult.rows[0];
        logger.info('Adjustable tax data found:', {
          total_adjustable_tax: adjustableTaxData.total_adjustable_tax,
        });
      }
    } catch (error) {
      logger.warn('Could not fetch adjustable tax data:', error.message);
    }

    // Fetch Reductions data
    let reductionsData = null;
    try {
      const reductionsResult = await pool.query(
        'SELECT * FROM reductions_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (reductionsResult.rows.length > 0) {
        reductionsData = reductionsResult.rows[0];
        logger.info('Reductions data found');
      }
    } catch (error) {
      logger.warn('Could not fetch reductions data:', error.message);
    }

    // Fetch Credits data
    let creditsData = null;
    try {
      const creditsResult = await pool.query(
        'SELECT * FROM credits_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (creditsResult.rows.length > 0) {
        creditsData = creditsResult.rows[0];
        logger.info('Credits data found');
      }
    } catch (error) {
      logger.warn('Could not fetch credits data:', error.message);
    }

    // Fetch Capital Gains data
    let capitalGainsData = null;
    try {
      const capitalResult = await pool.query(
        'SELECT * FROM capital_gain_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (capitalResult.rows.length > 0) {
        capitalGainsData = capitalResult.rows[0];
        logger.info('Capital gains data found');
      }
    } catch (error) {
      logger.warn('Could not fetch capital gains data:', error.message);
    }

    // Fetch existing Tax Computation data
    let existingTaxComputation = null;
    try {
      const taxCompResult = await pool.query(
        'SELECT * FROM tax_computation_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (taxCompResult.rows.length > 0) {
        existingTaxComputation = taxCompResult.rows[0];
        logger.info('Existing tax computation found');
      }
    } catch (error) {
      logger.warn('Could not fetch existing tax computation:', error.message);
    }

    // Build Tax Computation with auto-linked values
    // Excel Sheet 6: Tax Computation mapping
    // pg NUMERIC columns come back as strings. Coerce with toNum() before ANY
    // arithmetic — otherwise `"0.00" + "0.00"` was producing `"0.000.00"`.
    const toNum = (v) => {
      const n = typeof v === 'number' ? v : parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };
    const capitalGainValue =
      toNum(capitalGainsData?.total_capital_gain) ||
      toNum(capitalGainsData?.total_capital_gains);

    const taxComputation = {
      // B6: Income from Salary = Income Form B27 (total_employment_income)
      income_from_salary: toNum(incomeData?.total_employment_income),

      // B7: Income from Other Sources = Income Form B22 + B25
      income_from_other_sources:
        toNum(incomeData?.other_income_min_tax_total) +
        toNum(incomeData?.other_income_no_min_tax_total),

      // B8: Capital Gains. Exposed under both `capital_gain` (canonical) and
      // `capital_gains_loss` (the DB column name used on tax_computation_forms)
      // so frontend code can read either.
      capital_gain: capitalGainValue,
      capital_gains_loss: capitalGainValue,

      // B12: Withholding Income Tax = Adjustable Tax B32 (total_adjustable_tax)
      withholding_income_tax: toNum(adjustableTaxData?.total_adjustable_tax),

      // B13: Tax Credits = Credits Form total. The surviving generated column is
      // `total_credits`; `total_tax_credits` was dropped (phase-u), so reading it
      // returned undefined → credits silently showed Rs 0 (BE-03). Prefer the
      // real column, keep the old name as a defensive fallback.
      tax_credits: toNum(creditsData?.total_credits ?? creditsData?.total_tax_credits),

      // B14: Total Reductions = Reductions Form total
      total_reductions: toNum(reductionsData?.total_reductions),

      // User can still override these if needed
      tax_payable_u_s_1: toNum(existingTaxComputation?.tax_payable_u_s_1),
      minimum_tax_u_s_113: toNum(existingTaxComputation?.minimum_tax_u_s_113),
      tax_payable_after_minimum: toNum(existingTaxComputation?.tax_payable_after_minimum),
      surcharge_if_applicable: toNum(existingTaxComputation?.surcharge_if_applicable),
      tax_payable_before_credit: toNum(existingTaxComputation?.tax_payable_before_credit),
      refund_due: toNum(existingTaxComputation?.refund_due),
      balance_tax_payable: toNum(existingTaxComputation?.balance_tax_payable),
    };

    // Server-computed columns, straight off the persisted row. These are
    // populated from the engine on save (populateTaxComputationFromEngine);
    // surfacing them here is what stops the seven headline figures reading 0 on
    // screen now that the endpoint no longer accepts them from the client.
    // Read-only for the client — POSTing them back is ignored (lane A's
    // stripServerComputedFields).
    for (const col of [
      'income_from_salary', 'other_income_subject_to_min_tax',
      'income_loss_other_sources', 'total_income', 'deductible_allowances',
      'taxable_income_excluding_cg', 'capital_gains_loss',
      'taxable_income_including_cg', 'normal_income_tax', 'surcharge_amount',
      'capital_gains_tax', 'normal_tax_including_surcharge_cgt',
      'tax_reductions', 'net_tax_payable', 'super_tax', 'final_fixed_tax',
      'minimum_tax_on_other_income', 'total_tax_liability', 'advance_tax_paid',
      'balance_payable',
    ]) {
      if (!existingTaxComputation) continue;
      // ZERO IS NOT AN ENGINE ANSWER — IT IS AN UNPOPULATED ROW.
      //
      // `/api/register` pre-creates a tax_computation_forms row full of zeros,
      // and the engine only writes it on save. Overriding whenever the column was
      // merely `!== undefined` therefore let that pre-created 0 CLOBBER the live
      // auto-linked value: a user who saved a Rs 500,000 capital gain and then
      // read the computation back saw `capital_gains_loss: 0`, because the empty
      // row won. Caught by the E2E inter-form linking spec.
      //
      // A genuine engine zero is indistinguishable from an unpopulated one on
      // this row, and falling through costs nothing when it is genuine — the
      // auto-linked value is 0 in that case too.
      const stored = toNum(existingTaxComputation[col]);
      if (stored !== 0) taxComputation[col] = stored;
    }

    // Log the auto-linked values
    logger.info('Tax Computation auto-linked values:', {
      income_from_salary: taxComputation.income_from_salary,
      income_from_other_sources: taxComputation.income_from_other_sources,
      capital_gains: taxComputation.capital_gains,
      withholding_income_tax: taxComputation.withholding_income_tax,
      tax_credits: taxComputation.tax_credits,
      total_reductions: taxComputation.total_reductions,
    });

    res.json({
      success: true,
      data: taxComputation,
      autoLinked: true,
      message: 'Tax computation retrieved with auto-linked values from all forms',
      sources: {
        incomeForm: incomeData ? 'available' : 'not_found',
        adjustableTax: adjustableTaxData ? 'available' : 'not_found',
        reductions: reductionsData ? 'available' : 'not_found',
        credits: creditsData ? 'available' : 'not_found',
        capitalGains: capitalGainsData ? 'available' : 'not_found',
      },
    });
  } catch (error) {
    logger.error('Error fetching tax computation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tax computation',
      error: error.message,
    });
  }
};

const getReadiness = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taxYear } = req.params;
    const report = await checkReadiness(userId, taxYear);
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(500).json({ success: false, message: 'Readiness check failed', error: error.message });
  }
};

const submitReturn = async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.body.taxYear || req.query.taxYear || await getCurrentTaxYear();
    const taxReturnId = req.body.taxReturnId;

    const report = await checkReadiness(userId, taxYear);
    if (!report.ready) {
      return res.status(422).json({
        success: false,
        message: `Cannot submit — ${report.issues.length} blocking issue(s). Fix and try again.`,
        readiness: report,
      });
    }

    const update = await pool.query(
      `UPDATE tax_returns
          SET filing_status = 'submitted',
              submission_date = NOW(),
              updated_at = NOW()
        WHERE user_id = $1 AND tax_year = $2 AND ($3::uuid IS NULL OR id = $3)
        RETURNING *`,
      [userId, taxYear, taxReturnId || null]
    );

    if (update.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tax return not found for this user and year.' });
    }

    res.json({
      success: true,
      taxReturn: update.rows[0],
      readiness: report,
      message: 'Tax return submitted successfully.',
    });
  } catch (error) {
    logger.error('Submit failed:', error);
    res.status(500).json({ success: false, message: 'Submit failed', error: error.message });
  }
};

module.exports = {
  getTaxComputation,
  getReadiness,
  submitReturn,
  populateTaxComputationFromEngine,
};
