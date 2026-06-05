const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const ensureTaxReturn = require('../../../helpers/ensureTaxReturn');
const {
  getCurrentTaxYear,
  recalculateFormCompletion,
} = require('../helpers/taxFormsShared');

const getCurrentReturn = async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || await getCurrentTaxYear();

    logger.info(`Fetching current tax return for user ${userId}, tax year ${taxYear}`);

    // Recalculate form completion from actual database data
    await recalculateFormCompletion(userId, taxYear);

    // Fetch income_profile from actual tax_returns row (if it exists)
    let incomeProfile = { primary: 'salaried', addons: [] };
    try {
      const trResult = await pool.query(
        `SELECT income_profile FROM tax_returns WHERE user_id = $1 AND tax_year = $2 LIMIT 1`,
        [userId, taxYear]
      );
      if (trResult.rows.length > 0 && trResult.rows[0].income_profile) {
        incomeProfile = trResult.rows[0].income_profile;
      }
    } catch (err) {
      logger.warn('Could not fetch income_profile from tax_returns:', err.message);
    }

    // Initialize response structure
    const response = {
      taxReturn: {
        id: `${userId}-${taxYear}`,
        user_id: userId,
        tax_year: taxYear,
        status: 'in_progress',
        income_profile: incomeProfile,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      formData: {},
      completedSteps: [],
      completionPercentage: 0,
    };

    // Fan out all reads in parallel — was 11 sequential round-trips, now one.
    // Failures on any individual table are caught and logged below, matching
    // the previous per-block try/catch behaviour. We unwrap by position.
    const _qs = (sql) => pool.query(sql, [userId, taxYear]);
    const _results = await Promise.allSettled([
      _qs('SELECT * FROM form_completion_status WHERE user_id = $1 AND tax_year = $2'),
      _qs('SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2'),
      _qs('SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2'),
      _qs('SELECT * FROM capital_gain_forms WHERE user_id = $1 AND tax_year = $2'),
      _qs('SELECT * FROM final_min_income_forms WHERE user_id = $1 AND tax_year = $2'),
      _qs('SELECT * FROM reductions_forms WHERE user_id = $1 AND tax_year = $2'),
      _qs('SELECT * FROM credits_forms WHERE user_id = $1 AND tax_year = $2'),
      _qs('SELECT * FROM deductions_forms WHERE user_id = $1 AND tax_year = $2'),
      _qs('SELECT * FROM final_tax_forms WHERE user_id = $1 AND tax_year = $2'),
      _qs('SELECT * FROM expenses_forms WHERE user_id = $1 AND tax_year = $2'),
      _qs('SELECT * FROM wealth_forms WHERE user_id = $1 AND tax_year = $2'),
      _qs('SELECT * FROM wealth_reconciliation_forms WHERE user_id = $1 AND tax_year = $2'),
      _qs('SELECT * FROM tax_computation_forms WHERE user_id = $1 AND tax_year = $2'),
    ]);
    const _unwrap = (i, label) => {
      const r = _results[i];
      if (r.status === 'fulfilled') return r.value;
      logger.error(`Error fetching ${label} data:`, { message: r.reason?.message });
      return { rows: [] };
    };
    const _completionStatusResult = _unwrap(0, 'completion status');
    const _incomeResult           = _unwrap(1, 'income form');
    const _adjustableTaxResult    = _unwrap(2, 'adjustable tax');
    const _capitalGainResult      = _unwrap(3, 'capital gains');
    const _finalMinIncomeResult   = _unwrap(4, 'final/min income');
    const _reductionsResult       = _unwrap(5, 'reductions');
    const _creditsResult          = _unwrap(6, 'credits');
    const _deductionsResult       = _unwrap(7, 'deductions');
    const _finalTaxResult         = _unwrap(8, 'final tax');
    const _expensesResult         = _unwrap(9, 'expenses');
    const _wealthResult           = _unwrap(10, 'wealth form');
    const _wealthReconResult      = _unwrap(11, 'wealth reconciliation');
    const _taxComputationResult   = _unwrap(12, 'tax computation');

    // Get actual completion status from form_completion_status table
    try {
      const completionStatusResult = _completionStatusResult;

      if (completionStatusResult.rows.length > 0) {
        const completionStatus = completionStatusResult.rows[0];

        // Add the actual completion_percentage from database
        response.completionPercentage = completionStatus.completion_percentage || 0;

        // Only add completed steps based on actual completion flags
        if (completionStatus.income_form_complete) response.completedSteps.push('income');
        if (completionStatus.adjustable_tax_form_complete)
          response.completedSteps.push('adjustable_tax');
        if (completionStatus.reductions_form_complete) response.completedSteps.push('reductions');
        if (completionStatus.credits_form_complete) response.completedSteps.push('credits');
        if (completionStatus.deductions_form_complete) response.completedSteps.push('deductions');
        if (completionStatus.final_tax_form_complete) response.completedSteps.push('final_tax');
        if (completionStatus.capital_gain_form_complete)
          response.completedSteps.push('capital_gain');
        if (completionStatus.expenses_form_complete) response.completedSteps.push('expenses');
        if (completionStatus.wealth_form_complete) response.completedSteps.push('wealth');
        if (completionStatus.final_min_income_form_complete)
          response.completedSteps.push('final_min_income');
        if (completionStatus.wealth_reconciliation_form_complete)
          response.completedSteps.push('wealth_reconciliation');
        if (completionStatus.tax_computation_form_complete)
          response.completedSteps.push('tax_computation');

        logger.info(
          `Completion status loaded for user ${userId}: ${response.completedSteps.length} forms completed (${response.completionPercentage}%)`
        );
      }
    } catch (error) {
      logger.error('Error fetching completion status:', error);
    }

    // Fetch income form data (from prefetch)
    try {
      const incomeResult = _incomeResult;

      if (incomeResult.rows.length > 0) {
        const incomeData = incomeResult.rows[0];
        response.formData.income = {
          annual_basic_salary: incomeData.annual_basic_salary,
          allowances: incomeData.allowances,
          bonus: incomeData.bonus,
          medical_allowance: incomeData.medical_allowance,
          pension_from_ex_employer: incomeData.pension_from_ex_employer,
          employment_termination_payment: incomeData.employment_termination_payment,
          retirement_from_approved_funds: incomeData.retirement_from_approved_funds,
          directorship_fee: incomeData.directorship_fee,
          other_cash_benefits: incomeData.other_cash_benefits,
          income_exempt_from_tax: incomeData.income_exempt_from_tax,
          employment_termination_total: incomeData.employment_termination_total,
          employer_contribution_provident: incomeData.employer_contribution_provident,
          taxable_car_value: incomeData.taxable_car_value,
          other_taxable_subsidies: incomeData.other_taxable_subsidies,
          non_cash_benefit_exempt: incomeData.non_cash_benefit_exempt,
          total_non_cash_benefits: incomeData.total_non_cash_benefits,
          profit_on_debt_15_percent: incomeData.profit_on_debt_15_percent,
          profit_on_debt_12_5_percent: incomeData.profit_on_debt_12_5_percent,
          other_income_min_tax_total: incomeData.other_income_min_tax_total,
          other_taxable_income_rent: incomeData.other_taxable_income_rent,
          other_taxable_income_others: incomeData.other_taxable_income_others,
          other_income_no_min_tax_total: incomeData.other_income_no_min_tax_total,
          // CRITICAL: Include computed totals needed for cross-form linking
          total_employment_income: incomeData.total_employment_income,
          annual_salary_wages_total: incomeData.annual_salary_wages_total,
          total_taxable_income: incomeData.total_taxable_income,
        };
        logger.info(`Income form data found for user ${userId}`);
      } else {
        logger.info(`No income form data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching income form data:', error);
    }

    // Fetch adjustable tax form data (from prefetch)
    try {
      const adjustableTaxResult = _adjustableTaxResult;

      if (adjustableTaxResult.rows.length > 0) {
        response.formData.adjustable_tax = adjustableTaxResult.rows[0];
        logger.info(`Adjustable tax data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching adjustable tax data:', error);
    }

    // Fetch capital gains form data (from prefetch)
    try {
      const capitalGainResult = _capitalGainResult;

      if (capitalGainResult.rows.length > 0) {
        response.formData.capital_gain = capitalGainResult.rows[0];
        logger.info(`Capital gains data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching capital gains data:', error);
    }

    // Fetch final/min income form data with auto-linking
    try {
      // Get income form data for auto-linking
      let incomeFormForFinalMin = null;
      let adjustableTaxForFinalMin = null;

      // Use already fetched income data if available
      if (response.formData.income) {
        incomeFormForFinalMin = response.formData.income;
      }

      // Reuse adjustable tax data already prefetched (same row).
      if (_adjustableTaxResult.rows.length > 0) {
        adjustableTaxForFinalMin = _adjustableTaxResult.rows[0];
      }

      const finalMinIncomeResult = _finalMinIncomeResult;

      if (finalMinIncomeResult.rows.length > 0) {
        const finalMinData = finalMinIncomeResult.rows[0];


        // Auto-link salary amount and tax deducted if they're 0
        if (incomeFormForFinalMin) {
          const salaryValue = parseFloat(finalMinData.salary_u_s_12_7);
          const shouldAutoLink = (salaryValue === 0 || finalMinData.salary_u_s_12_7 === null) && incomeFormForFinalMin.annual_salary_wages_total > 0;

          if (shouldAutoLink) {
            finalMinData.salary_u_s_12_7 = parseFloat(
              incomeFormForFinalMin.annual_salary_wages_total
            );
            logger.info('Auto-linked salary amount from income form'); // amounts omitted (OBS-06)
          }
        }

        if (adjustableTaxForFinalMin) {
          const taxDeductedValue = parseFloat(finalMinData.salary_u_s_12_7_tax_deducted);
          const shouldAutoLinkTax = (taxDeductedValue === 0 || finalMinData.salary_u_s_12_7_tax_deducted === null) && adjustableTaxForFinalMin.salary_employees_149_tax_collected > 0;

          if (shouldAutoLinkTax) {
            finalMinData.salary_u_s_12_7_tax_deducted = parseFloat(
              adjustableTaxForFinalMin.salary_employees_149_tax_collected
            );
            logger.info('Auto-linked salary tax deducted from adjustable-tax form'); // amounts omitted (OBS-06)
          }
        }

        // Transform database field names to frontend field names (add _amount suffix)
        const transformedFinalMinData = {};
        const fieldsWithoutAmountSuffix = ['salary_u_s_12_7']; // These fields don't need _amount suffix

        for (const [key, value] of Object.entries(finalMinData)) {
          // Skip metadata fields
          if (['id', 'user_id', 'user_email', 'tax_return_id', 'tax_year_id', 'tax_year', 'is_complete', 'created_at', 'updated_at', 'last_updated_by'].includes(key)) {
            transformedFinalMinData[key] = value;
            continue;
          }

          // If field ends with _tax_deducted or _tax_chargeable, keep as is
          if (key.endsWith('_tax_deducted') || key.endsWith('_tax_chargeable')) {
            transformedFinalMinData[key] = value;
            continue;
          }

          // For amount fields (those without _tax_deducted or _tax_chargeable suffix)
          // Add _amount suffix for all fields except salary_u_s_12_7
          if (!fieldsWithoutAmountSuffix.includes(key) &&
              !key.endsWith('_tax_deducted') &&
              !key.endsWith('_tax_chargeable') &&
              !key.includes('total')) {
            transformedFinalMinData[`${key}_amount`] = value;
          } else {
            transformedFinalMinData[key] = value;
          }
        }

        response.formData.final_min_income = transformedFinalMinData;
        logger.info(`Final/min income data found for user ${userId} (with auto-linking)`);
      } else if (incomeFormForFinalMin || adjustableTaxForFinalMin) {
        // No existing data - return auto-linked values with _amount suffix for all fields
        response.formData.final_min_income = {
          salary_u_s_12_7: incomeFormForFinalMin?.annual_salary_wages_total || 0,
          salary_u_s_12_7_tax_deducted: adjustableTaxForFinalMin?.salary_employees_149_tax_collected || 0,
          salary_u_s_12_7_tax_chargeable: 0,

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
        logger.info(`Final/min income auto-linked for user ${userId} (new record)`); // amounts omitted (OBS-06)
      }
    } catch (error) {
      logger.error('Error fetching final/min income data:', error);
    }

    // Fetch reductions form data (from prefetch)
    try {
      const reductionsResult = _reductionsResult;

      if (reductionsResult.rows.length > 0) {
        response.formData.reductions = reductionsResult.rows[0];
        logger.info(`Reductions data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching reductions data:', error);
    }

    // Fetch credits form data (from prefetch)
    try {
      const creditsResult = _creditsResult;

      if (creditsResult.rows.length > 0) {
        response.formData.credits = creditsResult.rows[0];
        logger.info(`Credits data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching credits data:', error);
    }

    // Fetch deductions form data (from prefetch)
    try {
      const deductionsResult = _deductionsResult;

      if (deductionsResult.rows.length > 0) {
        response.formData.deductions = deductionsResult.rows[0];
        logger.info(`Deductions data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching deductions data:', error);
    }

    // Fetch final tax form data (from prefetch)
    try {
      const finalTaxResult = _finalTaxResult;

      if (finalTaxResult.rows.length > 0) {
        response.formData.final_tax = finalTaxResult.rows[0];
        logger.info(`Final tax data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching final tax data:', error);
    }

    // Fetch expenses form data (from prefetch)
    try {
      const expensesResult = _expensesResult;

      if (expensesResult.rows.length > 0) {
        response.formData.expenses = expensesResult.rows[0];
        logger.info(`Expenses data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching expenses data:', error);
    }

    // Fetch wealth form data (from prefetch — matches WealthStatementForm field names)
    try {
      const wealthResult = _wealthResult;

      if (wealthResult.rows.length > 0) {
        // Key must be 'wealth' to match TaxFormContext FORM_STEPS id and WealthStatementForm context reads
        response.formData.wealth = wealthResult.rows[0];
        logger.info(`Wealth form data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching wealth form data:', error);
    }

    // Fetch wealth reconciliation form data (from prefetch)
    try {
      const wealthReconResult = _wealthReconResult;

      if (wealthReconResult.rows.length > 0) {
        response.formData.wealth_reconciliation = wealthReconResult.rows[0];
        logger.info(`Wealth reconciliation data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching wealth reconciliation data:', error);
    }

    // Fetch tax computation form data (from prefetch)
    try {
      const taxComputationResult = _taxComputationResult;

      if (taxComputationResult.rows.length > 0) {
        response.formData.tax_computation = taxComputationResult.rows[0];
        logger.info(`Tax computation data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching tax computation data:', error);
    }

    logger.info(`Tax return data retrieved for user ${userId}, tax year ${taxYear}`);
    res.json(response);
  } catch (error) {
    logger.error('Error fetching current tax return:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current tax return',
      error: error.message,
    });
  }
};

const createReturn = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const taxYear = req.body.taxYear || await getCurrentTaxYear();

    logger.info(`Creating new tax return for user ${userId}, tax year ${taxYear}`);

    // Persist via the shared helper used by every save endpoint, so the
    // returned `id` is the real DB UUID and matches what subsequent saves
    // will resolve. Previously this returned a synthetic `${userId}-${year}`
    // string that never appeared in the DB — harmless but misleading.
    const taxReturnId = await ensureTaxReturn(userId, userEmail, taxYear);

    const taxReturnRow = await pool.query(
      `SELECT id, user_id, tax_year, filing_status AS status, created_at, updated_at
         FROM tax_returns WHERE id = $1`,
      [taxReturnId]
    );

    res.json({
      success: true,
      message: 'Tax return ready',
      taxReturn: {
        ...taxReturnRow.rows[0],
        income_profile: { primary: 'salaried', addons: [] },
      },
    });
  } catch (error) {
    logger.error('Error creating tax return:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create tax return',
      error: error.message,
    });
  }
};

const saveIncomeProfile = async (req, res) => {
  try {
    const userId    = req.user.id;
    const userEmail = req.user.email;
    const taxYear   = req.body.taxYear || await getCurrentTaxYear();
    const { addons } = req.body;

    if (!Array.isArray(addons)) {
      return res.status(400).json({ success: false, message: 'addons must be an array' });
    }

    const VALID_ADDONS = [
      'bank_profit', 'dividends', 'securities', 'sukuk',
      'rental', 'property_gain', 'directorship', 'foreign_income',
      'prizes', 'pension', 'agriculture',
    ];
    const sanitised = addons.filter(a => VALID_ADDONS.includes(a));

    // Ensure the tax return row exists (creates if first time)
    const taxReturnId = await ensureTaxReturn(userId, userEmail, taxYear);

    await pool.query(
      `UPDATE tax_returns
       SET income_profile = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify({ primary: 'salaried', addons: sanitised }), taxReturnId]
    );

    logger.info(`Income profile saved for user ${userId}: addons=[${sanitised.join(',')}]`);
    res.json({
      success: true,
      income_profile: { primary: 'salaried', addons: sanitised },
    });
  } catch (error) {
    logger.error('Error saving income profile:', error);
    res.status(500).json({ success: false, message: 'Failed to save income profile' });
  }
};

module.exports = { getCurrentReturn, createReturn, saveIncomeProfile };
