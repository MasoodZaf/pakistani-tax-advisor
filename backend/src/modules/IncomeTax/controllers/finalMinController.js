const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const ensureTaxReturn = require('../../../helpers/ensureTaxReturn');
const {
  getAllowedColumns,
  filterToAllowedColumns,
} = require('../../../helpers/tableColumns');
const {
  getCurrentTaxYear,
} = require('../helpers/taxFormsShared');

const getFinalMinIncome = async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || await getCurrentTaxYear();

    logger.info(`Fetching final/min income data for user ${userId}, tax year ${taxYear}`);

    // Get income form data for auto-linking
    let incomeFormData = null;
    let adjustableTaxData = null;
    try {
      const incomeResult = await pool.query(
        'SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (incomeResult.rows.length > 0) {
        incomeFormData = incomeResult.rows[0];
        logger.info('Income form data found for auto-linking:', {
          total_employment_income: incomeFormData.total_employment_income,
          annual_salary_wages_total: incomeFormData.annual_salary_wages_total,
        });
      }
    } catch (error) {
      logger.warn('Could not fetch income form data for auto-linking:', error.message);
    }

    // Get adjustable tax form data for tax deducted amounts
    try {
      const adjustableResult = await pool.query(
        'SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (adjustableResult.rows.length > 0) {
        adjustableTaxData = adjustableResult.rows[0];
        logger.info('Adjustable tax data found for auto-linking:', {
          salary_tax_collected: adjustableTaxData.salary_employees_149_tax_collected,
        });
      }
    } catch (error) {
      logger.warn('Could not fetch adjustable tax data for auto-linking:', error.message);
    }

    const result = await pool.query(
      'SELECT * FROM final_min_income_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );

    if (result.rows.length === 0) {
      // No existing data - return auto-linked values from income form and adjustable tax
      if (incomeFormData || adjustableTaxData) {
        const autoLinkedData = {
          // Salary u/s 12(7) = Annual Salary Wages Total from Income Form
          salary_u_s_12_7: incomeFormData?.annual_salary_wages_total || 0,
          // Tax Deducted = Tax Collected from Adjustable Tax Form (Salary u/s 149)
          salary_u_s_12_7_tax_deducted: adjustableTaxData?.salary_employees_149_tax_collected || 0,
          salary_u_s_12_7_tax_chargeable: 0, // Will be calculated

          // Initialize all dividend/investment fields with _amount suffix to 0
          dividend_u_s_150_0pc_share_profit_reit_spv_amount: 0,
          dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted: 0,
          dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable: 0,

          dividend_u_s_150_35pc_share_profit_other_spv_amount: 0,
          dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted: 0,
          dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable: 0,

          dividend_u_s_150_7_5pc_ipp_shares_amount: 0,
          dividend_u_s_150_7_5pc_ipp_shares_tax_deducted: 0,
          dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable: 0,

          dividend_u_s_150_31pc_atl_amount: 0,
          dividend_u_s_150_31pc_atl_tax_deducted: 0,
          dividend_u_s_150_31pc_atl_tax_chargeable: 0,

          dividend_u_s_150_25pc_bf_losses: 0,
          dividend_u_s_150_25pc_bf_losses_tax_deducted: 0,
          dividend_u_s_150_25pc_bf_losses_tax_chargeable: 0,

          return_on_investment_sukuk_u_s_151_1a_10pc_amount: 0,
          return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted: 0,
          return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable: 0,

          return_on_investment_sukuk_u_s_151_1a_12_5pc_amount: 0,
          return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted: 0,
          return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable: 0,

          return_on_investment_sukuk_u_s_151_1a_25pc_amount: 0,
          return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted: 0,
          return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable: 0,

          return_invest_exceed_1m_sukuk_saa_12_5pc_amount: 0,
          return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted: 0,
          return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable: 0,

          return_invest_not_exceed_1m_sukuk_saa_10pc_amount: 0,
          return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted: 0,
          return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable: 0,

          profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_amount: 0,
          profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted: 0,
          profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable: 0,

          profit_debt_national_savings_defence_39_14a_amount: 0,
          profit_debt_national_savings_defence_39_14a_tax_deducted: 0,
          profit_debt_national_savings_defence_39_14a_tax_chargeable: 0,

          interest_income_profit_debt_7b_up_to_5m_amount: 0,
          interest_income_profit_debt_7b_up_to_5m_tax_deducted: 0,
          interest_income_profit_debt_7b_up_to_5m_tax_chargeable: 0,

          prize_raffle_lottery_quiz_promotional_156_amount: 0,
          prize_raffle_lottery_quiz_promotional_156_tax_deducted: 0,
          prize_raffle_lottery_quiz_promotional_156_tax_chargeable: 0,

          prize_bond_cross_world_puzzle_156_amount: 0,
          prize_bond_cross_world_puzzle_156_tax_deducted: 0,
          prize_bond_cross_world_puzzle_156_tax_chargeable: 0,

          bonus_shares_companies_236f_amount: 0,
          bonus_shares_companies_236f_tax_deducted: 0,
          bonus_shares_companies_236f_tax_chargeable: 0,

          employment_termination_benefits_12_6_avg_rate_amount: 0,
          employment_termination_benefits_12_6_avg_rate_tax_deducted: 0,
          employment_termination_benefits_12_6_avg_rate_tax_chargeable: 0,

          salary_arrears_12_7_relevant_rate_amount: 0,
          salary_arrears_12_7_relevant_rate_tax_deducted: 0,
          salary_arrears_12_7_relevant_rate_tax_chargeable: 0,

          capital_gain_amount: 0,
          capital_gain_tax_deducted: 0,
          capital_gain_tax_chargeable: 0,
        };

        logger.info('Auto-linked salary from income form and adjustable tax:', autoLinkedData);

        return res.json({
          success: true,
          data: autoLinkedData,
          autoLinked: true,
          message: 'No final/min income data found, returning auto-linked values from income and adjustable tax forms',
        });
      }

      return res.json({
        success: true,
        data: null,
        autoLinked: false,
        message: 'No final/min income data found',
      });
    }

    const finalMinIncomeData = result.rows[0];

    // Auto-link salary + tax deducted if the saved values are 0/null and the
    // source forms have data. pg NUMERIC values come back as strings (e.g.
    // "0.00"), so `=== 0` was silently false — always coerce with parseFloat.
    if (incomeFormData) {
      const existingSalary = parseFloat(finalMinIncomeData.salary_u_s_12_7) || 0;
      const incomeSalary = parseFloat(incomeFormData.annual_salary_wages_total) || 0;
      if (existingSalary === 0 && incomeSalary > 0) {
        finalMinIncomeData.salary_u_s_12_7 = incomeSalary;
        logger.info('Auto-linked salary amount:', incomeSalary);
      }
    }

    if (adjustableTaxData) {
      const existingTax = parseFloat(finalMinIncomeData.salary_u_s_12_7_tax_deducted) || 0;
      const adjTax = parseFloat(adjustableTaxData.salary_employees_149_tax_collected) || 0;
      if (existingTax === 0 && adjTax > 0) {
        finalMinIncomeData.salary_u_s_12_7_tax_deducted = adjTax;
        logger.info('Auto-linked salary tax deducted:', adjTax);
      }
    }

    // Transform database field names to frontend field names (add _amount suffix)
    // Database stores: salary_u_s_12_7, salary_u_s_12_7_tax_deducted, salary_u_s_12_7_tax_chargeable
    // Frontend expects: salary_u_s_12_7 (no suffix), but for dividends/investments it expects _amount suffix
    const transformedData = {};
    const fieldsWithoutAmountSuffix = ['salary_u_s_12_7']; // These fields don't need _amount suffix

    for (const [key, value] of Object.entries(finalMinIncomeData)) {
      // Skip metadata fields
      if (['id', 'user_id', 'user_email', 'tax_return_id', 'tax_year_id', 'tax_year', 'is_complete', 'created_at', 'updated_at', 'last_updated_by'].includes(key)) {
        transformedData[key] = value;
        continue;
      }

      // If field ends with _tax_deducted or _tax_chargeable, keep as is
      if (key.endsWith('_tax_deducted') || key.endsWith('_tax_chargeable')) {
        transformedData[key] = value;
        continue;
      }

      // For amount fields (those without _tax_deducted or _tax_chargeable suffix)
      // Add _amount suffix for all fields except salary_u_s_12_7
      if (!fieldsWithoutAmountSuffix.includes(key) &&
          !key.endsWith('_tax_deducted') &&
          !key.endsWith('_tax_chargeable') &&
          !key.includes('total')) {
        transformedData[`${key}_amount`] = value;
      } else {
        transformedData[key] = value;
      }
    }

    res.json({
      success: true,
      data: transformedData,
      autoLinked: incomeFormData ? true : false,
      message: 'Final/min income data retrieved successfully',
    });
  } catch (error) {
    logger.error('Error fetching final/min income:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch final/min income', error: error.message });
  }
};

const saveFinalMinIncome = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const taxYear = req.body.taxYear || await getCurrentTaxYear();
    const isComplete = req.body.isComplete || false;
    const formData = req.body;

    logger.info(`Saving final/min income data for user ${userId}, tax year ${taxYear}`);

    // Import tax rate configuration
    const { calculateTaxChargeable, FINAL_MIN_TAX_RATES, lineChargeable } = require('../../../config/finalMinTaxRates');

    // Get or create tax return (validated + typed via Prisma helper)
    let taxReturnId;
    try {
      taxReturnId = await ensureTaxReturn(userId, userEmail, taxYear);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    // Resolve tax_year_id for the data payload
    const taxYearRow = await pool.query('SELECT id FROM tax_years WHERE tax_year = $1', [taxYear]);
    const taxYearId = taxYearRow.rows[0].id;

    // Helper function to get numeric value
    const getNumericValue = (value) => {
      if (value === '' || value === null || value === undefined) return 0;
      if (typeof value === 'string') {
        const numericValue = parseFloat(value.replace(/,/g, ''));
        return isNaN(numericValue) ? 0 : numericValue;
      }
      if (typeof value === 'number') return value;
      return 0;
    };

    // Extract amounts and tax_deducted from form data
    // Accept both naming conventions: with _amount suffix (backend) and without (frontend/database)
    const cleanedData = {
      // Salary u/s 12(7)
      salary_u_s_12_7_amount: getNumericValue(formData.salary_u_s_12_7 || formData.salary_u_s_12_7_amount),
      salary_u_s_12_7_tax_deducted: getNumericValue(formData.salary_u_s_12_7_tax_deducted),

      // Dividend u/s 150 - REIT SPV @0%
      dividend_u_s_150_0pc_share_profit_reit_spv_amount: getNumericValue(formData.dividend_u_s_150_0pc_share_profit_reit_spv_amount),
      dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted: getNumericValue(formData.dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted),

      // Dividend u/s 150 - Other SPV @35%/70%
      dividend_u_s_150_35pc_share_profit_other_spv_amount: getNumericValue(formData.dividend_u_s_150_35pc_share_profit_other_spv_amount),
      dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted: getNumericValue(formData.dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted),

      // Dividend u/s 150 - IPP Shares @7.5%/15%
      dividend_u_s_150_7_5pc_ipp_shares_amount: getNumericValue(formData.dividend_u_s_150_7_5pc_ipp_shares_amount),
      dividend_u_s_150_7_5pc_ipp_shares_tax_deducted: getNumericValue(formData.dividend_u_s_150_7_5pc_ipp_shares_tax_deducted),

      // Dividend u/s 150 - @15% (Dividend in kind / MF <50% profit on debt)
      dividend_u_s_150_31pc_atl_amount: getNumericValue(formData.dividend_u_s_150_31pc_atl_amount),
      dividend_u_s_150_31pc_atl_tax_deducted: getNumericValue(formData.dividend_u_s_150_31pc_atl_tax_deducted),

      // Dividend u/s 150 - @25% (Companies with BF losses / MF 50%+ profit on debt)
      dividend_u_s_150_25pc_bf_losses: getNumericValue(formData.dividend_u_s_150_25pc_bf_losses_amount),
      dividend_u_s_150_25pc_bf_losses_tax_deducted: getNumericValue(formData.dividend_u_s_150_25pc_bf_losses_tax_deducted),

      // Return on Investment in Sukuk u/s 151(1A) @ 10%
      return_on_investment_sukuk_u_s_151_1a_10pc_amount: getNumericValue(formData.return_on_investment_sukuk_u_s_151_1a_10pc_amount),
      return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted: getNumericValue(formData.return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted),

      // Return on Investment in Sukuk u/s 151(1A) @ 12.5%
      return_on_investment_sukuk_u_s_151_1a_12_5pc_amount: getNumericValue(formData.return_on_investment_sukuk_u_s_151_1a_12_5pc_amount),
      return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted: getNumericValue(formData.return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted),

      // Return on Investment in Sukuk u/s 151(1A) @ 25%
      return_on_investment_sukuk_u_s_151_1a_25pc_amount: getNumericValue(formData.return_on_investment_sukuk_u_s_151_1a_25pc_amount),
      return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted: getNumericValue(formData.return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted),

      // Return on Investment exceeding 1M @ 12.5%
      return_invest_exceed_1m_sukuk_saa_12_5pc_amount: getNumericValue(formData.return_invest_exceed_1m_sukuk_saa_12_5pc_amount),
      return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted: getNumericValue(formData.return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted),

      // Return on Investment not exceeding 1M @ 10%
      return_invest_not_exceed_1m_sukuk_saa_10pc_amount: getNumericValue(formData.return_invest_not_exceed_1m_sukuk_saa_10pc_amount),
      return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted: getNumericValue(formData.return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted),

      // Profit on Debt 151A/SAA/SAB @ 10%/20%
      profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_amount: getNumericValue(formData.profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_amount),
      profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted: getNumericValue(formData.profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted),

      // Profit on Debt National Savings/Defence @ Variable
      profit_debt_national_savings_defence_39_14a_amount: getNumericValue(formData.profit_debt_national_savings_defence_39_14a_amount),
      profit_debt_national_savings_defence_39_14a_tax_deducted: getNumericValue(formData.profit_debt_national_savings_defence_39_14a_tax_deducted),

      // Interest Income/Profit on Debt u/s 7B up to 5M @ 15%
      interest_income_profit_debt_7b_up_to_5m_amount: getNumericValue(formData.interest_income_profit_debt_7b_up_to_5m_amount),
      interest_income_profit_debt_7b_up_to_5m_tax_deducted: getNumericValue(formData.interest_income_profit_debt_7b_up_to_5m_tax_deducted),

      // Prize on Raffle/Lottery/Quiz @ 20%
      prize_raffle_lottery_quiz_promotional_156_amount: getNumericValue(formData.prize_raffle_lottery_quiz_promotional_156_amount),
      prize_raffle_lottery_quiz_promotional_156_tax_deducted: getNumericValue(formData.prize_raffle_lottery_quiz_promotional_156_tax_deducted),

      // Prize on Prize Bond @ 15%
      prize_bond_cross_world_puzzle_156_amount: getNumericValue(formData.prize_bond_cross_world_puzzle_156_amount),
      prize_bond_cross_world_puzzle_156_tax_deducted: getNumericValue(formData.prize_bond_cross_world_puzzle_156_tax_deducted),

      // Bonus Shares u/s 236F
      bonus_shares_companies_236f_amount: getNumericValue(formData.bonus_shares_companies_236f_amount),
      bonus_shares_companies_236f_tax_deducted: getNumericValue(formData.bonus_shares_companies_236f_tax_deducted),

      // Employment Termination Benefits @ Average Rate
      employment_termination_benefits_12_6_avg_rate_amount: getNumericValue(formData.employment_termination_benefits_12_6_avg_rate_amount),
      employment_termination_benefits_12_6_avg_rate_tax_deducted: getNumericValue(formData.employment_termination_benefits_12_6_avg_rate_tax_deducted),

      // Salary Arrears @ Relevant Rate
      salary_arrears_12_7_relevant_rate_amount: getNumericValue(formData.salary_arrears_12_7_relevant_rate_amount),
      salary_arrears_12_7_relevant_rate_tax_deducted: getNumericValue(formData.salary_arrears_12_7_relevant_rate_tax_deducted),

      // Capital Gain (linked from Capital Gain form)
      capital_gain_amount: getNumericValue(formData.capital_gain_amount),
      capital_gain_tax_deducted: getNumericValue(formData.capital_gain_tax_deducted),
    };

    // ── Final/min-tax: tax_chargeable per line (audit TAX-01) ───────────────
    // chargeable must be the STATUTORY liability (gross × section rate), NOT the
    // amount withheld. The previous code set every line's tax_chargeable =
    // tax_deducted, so an under-withheld line cancelled itself out in the
    // computation (chargeable − deducted = 0) and silently filed an
    // UNDER-STATED return.
    //
    // `lineChargeable` (config/finalMinTaxRates.js) returns gross × statutory
    // rate for the lines whose filer/non-filer rate is verified against the FBR
    // Tax Card 2025-26 (FINAL_MIN_FIELD_RATE), and falls back to the withheld
    // amount for every other line — the ambiguous/variable lines stay flagged
    // (see the note in finalMinTaxRates.js). Gross-absent lines also fall back to
    // the withheld amount so we never invent a refund.
    //
    // Active Taxpayer (filer) status drives which rate applies — a non-filer pays
    // the higher (≈ double) final-tax rate per the Tax Card. The Final/Min form
    // asks "Are you an Active Taxpayer?"; default to filer when unanswered.
    const atlAnswer = formData.is_atl;
    const isATL = !(
      atlAnswer === false || atlAnswer === 'false' ||
      atlAnswer === 'no' || atlAnswer === 0 || atlAnswer === '0'
    );
    const FINAL_MIN_LINE_BASES = [
      'dividend_u_s_150_0pc_share_profit_reit_spv',
      'dividend_u_s_150_35pc_share_profit_other_spv',
      'dividend_u_s_150_7_5pc_ipp_shares',
      'dividend_u_s_150_31pc_atl',
      'dividend_u_s_150_25pc_bf_losses',
      'return_on_investment_sukuk_u_s_151_1a_10pc',
      'return_on_investment_sukuk_u_s_151_1a_12_5pc',
      'return_on_investment_sukuk_u_s_151_1a_25pc',
      'return_invest_exceed_1m_sukuk_saa_12_5pc',
      'return_invest_not_exceed_1m_sukuk_saa_10pc',
      'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc',
      'profit_debt_national_savings_defence_39_14a',
      'interest_income_profit_debt_7b_up_to_5m',
      'prize_raffle_lottery_quiz_promotional_156',
      'prize_bond_cross_world_puzzle_156',
      'bonus_shares_companies_236f',
      'employment_termination_benefits_12_6_avg_rate',
      'salary_arrears_12_7_relevant_rate',
      'capital_gain',
    ];
    const taxChargeableCalculations = {
      // Salary u/s 12(7) — variable, computed from the main tax computation.
      salary_u_s_12_7_tax_chargeable: 0,
    };
    for (const base of FINAL_MIN_LINE_BASES) {
      taxChargeableCalculations[`${base}_tax_chargeable`] = lineChargeable(
        base,
        getNumericValue(formData[`${base}_amount`]),
        getNumericValue(formData[`${base}_tax_deducted`]),
        isATL,
      );
    }

    logger.info('Tax chargeable calculations completed:', taxChargeableCalculations);

    // Map frontend/backend field names (with _amount suffix) to database column names (without _amount)
    // cleanedData has fields like: salary_u_s_12_7_amount, salary_u_s_12_7_tax_deducted
    // Database has fields like: salary_u_s_12_7, salary_u_s_12_7_tax_deducted
    // We need to remove the _amount suffix to match database columns
    const mappedCleanedData = {};
    for (const [key, value] of Object.entries(cleanedData)) {
      // Remove _amount suffix to match database column names
      const dbKey = key.replace(/_amount$/, '');
      mappedCleanedData[dbKey] = value;
    }

    // Persist the Active-Taxpayer answer (when the column exists) for transparency
    // and form pre-fill — the computation above already used it. Filtered to the
    // allowed columns below, so it's a safe no-op until the is_atl migration runs.
    mappedCleanedData.is_atl = isATL;

    logger.info('Field name mapping applied:', {
      sampleOriginal: 'salary_u_s_12_7_amount',
      sampleMapped: 'salary_u_s_12_7',
      totalMappedFields: Object.keys(mappedCleanedData).length
    });

    // Load the column allow-list for this table.
    const allowedColumns = await getAllowedColumns('final_min_income_forms');

    // Drop any request keys not present in the table's column list.
    const safeMappedData = filterToAllowedColumns(
      'final_min_income_forms',
      allowedColumns,
      mappedCleanedData
    );
    const safeTaxChargeable = filterToAllowedColumns(
      'final_min_income_forms',
      allowedColumns,
      taxChargeableCalculations
    );

    // Server-controlled fields win on conflict.
    const finalMinIncomeData = {
      ...safeMappedData,
      ...safeTaxChargeable,
      tax_return_id: taxReturnId,
      user_id: userId,
      user_email: userEmail,
      tax_year_id: taxYearId,
      tax_year: taxYear,
      is_complete: isComplete,
      last_updated_by: userId,
    };

    // Log the first few fields to verify mapping worked
    logger.info('Final data for database (sample):', {
      salary_u_s_12_7: finalMinIncomeData.salary_u_s_12_7,
      salary_u_s_12_7_tax_deducted: finalMinIncomeData.salary_u_s_12_7_tax_deducted,
      salary_u_s_12_7_tax_chargeable: finalMinIncomeData.salary_u_s_12_7_tax_chargeable,
      totalFields: Object.keys(finalMinIncomeData).length
    });

    // Atomic upsert — relies on UNIQUE(user_id, tax_year) from phase-d migration.
    const identityKeys = new Set(['tax_return_id', 'user_id', 'user_email', 'tax_year_id', 'tax_year']);
    const columns = Object.keys(finalMinIncomeData);
    const values = columns.map((c) => finalMinIncomeData[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const updateAssignments = columns
      .filter((c) => !identityKeys.has(c))
      // is_complete is sticky (BE-06): a partial "Save data" (is_complete=false)
      // must not silently un-complete a form the user already finished. Only an
      // explicit completion flips it true; OR keeps an existing true.
      .map((c) => c === 'is_complete'
        ? `is_complete = final_min_income_forms.is_complete OR EXCLUDED.is_complete`
        : `${c} = EXCLUDED.${c}`)
      .concat(['updated_at = CURRENT_TIMESTAMP'])
      .join(', ');

    const result = await pool.query(
      `INSERT INTO final_min_income_forms (${columns.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT (user_id, tax_year) DO UPDATE SET ${updateAssignments}
       RETURNING *`,
      values
    );

    logger.info(`Final/min income data saved for user ${userId}, tax year ${taxYear}`, {
      total_fields_saved: Object.keys(result.rows[0]).length,
      subtotal_tax_chargeable: result.rows[0].subtotal_tax_chargeable,
      grand_total_tax_chargeable: result.rows[0].grand_total_tax_chargeable,
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Final/min income data saved successfully with tax calculations',
      calculations: taxChargeableCalculations,
    });
  } catch (error) {
    logger.error('Error saving final/min income data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save final/min income data',
    });
  }
};

module.exports = { getFinalMinIncome, saveFinalMinIncome };
