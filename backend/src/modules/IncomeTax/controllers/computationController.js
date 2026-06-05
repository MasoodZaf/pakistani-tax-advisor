const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const { checkReadiness } = require('../../../services/readinessService');
const {
  getCurrentTaxYear,
} = require('../helpers/taxFormsShared');

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

module.exports = { getTaxComputation, getReadiness, submitReturn };
