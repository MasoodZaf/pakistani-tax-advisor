const express = require('express');
const { pool } = require('../../../config/database');
const auth = require('../../../middleware/auth');
const logger = require('../../../utils/logger');
const TaxRateService = require('../../../services/taxRateService');
const CalculationService = require('../../../services/calculationService');

const router = express.Router();

// Helper function to recalculate form completion from database
async function recalculateFormCompletion(userId, taxYear) {
  try {
    const formsToCheck = [
      { table: 'income_forms', column: 'income_form_complete' },
      { table: 'adjustable_tax_forms', column: 'adjustable_tax_form_complete' },
      { table: 'reductions_forms', column: 'reductions_form_complete' },
      { table: 'credits_forms', column: 'credits_form_complete' },
      { table: 'deductions_forms', column: 'deductions_form_complete' },
      { table: 'final_tax_forms', column: 'final_tax_form_complete' },
      { table: 'capital_gain_forms', column: 'capital_gain_form_complete' },
      { table: 'expenses_forms', column: 'expenses_form_complete' },
      { table: 'wealth_forms', column: 'wealth_form_complete' },
    ];

    const completionStatus = {};

    for (const form of formsToCheck) {
      try {
        const result = await pool.query(
          `SELECT * FROM ${form.table} WHERE user_id = $1 AND tax_year = $2`,
          [userId, taxYear]
        );

        if (result.rows.length > 0) {
          const formData = result.rows[0];
          const excludeFields = [
            'id',
            'user_id',
            'user_email',
            'tax_year_id',
            'tax_year',
            'tax_return_id',
            'created_at',
            'updated_at',
            'last_updated_by',
          ];
          const hasData = Object.entries(formData).some(
            ([key, value]) => !excludeFields.includes(key) && typeof value === 'number' && value > 0
          );
          completionStatus[form.column] = hasData;
        } else {
          completionStatus[form.column] = false;
        }
      } catch (err) {
        logger.warn(`Error checking ${form.table}:`, err.message);
        completionStatus[form.column] = false;
      }
    }

    const completedCount = Object.values(completionStatus).filter(Boolean).length;
    const totalForms = formsToCheck.length;
    const percentage = Math.round((completedCount / totalForms) * 100);

    await pool.query(
      `UPDATE form_completion_status
       SET income_form_complete = $1, adjustable_tax_form_complete = $2,
           reductions_form_complete = $3, credits_form_complete = $4,
           deductions_form_complete = $5, final_tax_form_complete = $6,
           capital_gain_form_complete = $7, expenses_form_complete = $8,
           wealth_form_complete = $9,
           last_updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $10 AND tax_year = $11`,
      [
        completionStatus['income_form_complete'],
        completionStatus['adjustable_tax_form_complete'],
        completionStatus['reductions_form_complete'],
        completionStatus['credits_form_complete'],
        completionStatus['deductions_form_complete'],
        completionStatus['final_tax_form_complete'],
        completionStatus['capital_gain_form_complete'],
        completionStatus['expenses_form_complete'],
        completionStatus['wealth_form_complete'],
        userId,
        taxYear,
      ]
    );

    logger.info(
      `Form completion recalculated for ${userId}: ${completedCount}/${totalForms} forms completed`
    );
  } catch (error) {
    logger.error('Error recalculating completion:', error);
  }
}

// GET /api/tax-forms/current-return - Get current tax return with all form data
router.get('/current-return', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = '2025-26'; // Default to current tax year

    logger.info(`Fetching current tax return for user ${userId}, tax year ${taxYear}`);

    // Recalculate form completion from actual database data
    await recalculateFormCompletion(userId, taxYear);

    // Initialize response structure
    const response = {
      taxReturn: {
        id: `${userId}-${taxYear}`,
        user_id: userId,
        tax_year: taxYear,
        status: 'in_progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      formData: {},
      completedSteps: [],
      completionPercentage: 0,
    };

    // Get actual completion status from form_completion_status table
    try {
      const completionStatusResult = await pool.query(
        'SELECT * FROM form_completion_status WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

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
          response.completedSteps.push('capital_gains');
        if (completionStatus.expenses_form_complete) response.completedSteps.push('expenses');
        if (completionStatus.wealth_form_complete) response.completedSteps.push('wealth_statement');

        logger.info(
          `Completion status loaded for user ${userId}: ${response.completedSteps.length} forms completed (${response.completionPercentage}%)`
        );
      }
    } catch (error) {
      logger.error('Error fetching completion status:', error);
    }

    // Fetch income form data
    try {
      const incomeResult = await pool.query(
        'SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

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

    // Fetch adjustable tax form data
    try {
      const adjustableTaxResult = await pool.query(
        'SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (adjustableTaxResult.rows.length > 0) {
        response.formData.adjustable_tax = adjustableTaxResult.rows[0];
        logger.info(`Adjustable tax data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching adjustable tax data:', error);
    }

    // Fetch capital gains form data
    try {
      const capitalGainResult = await pool.query(
        'SELECT * FROM capital_gain_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (capitalGainResult.rows.length > 0) {
        response.formData.capital_gains = capitalGainResult.rows[0];
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

      // Fetch adjustable tax data for auto-linking
      const adjustableForMinResult = await pool.query(
        'SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (adjustableForMinResult.rows.length > 0) {
        adjustableTaxForFinalMin = adjustableForMinResult.rows[0];
      }

      const finalMinIncomeResult = await pool.query(
        'SELECT * FROM final_min_income_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (finalMinIncomeResult.rows.length > 0) {
        const finalMinData = finalMinIncomeResult.rows[0];

        // Debug logging
        logger.info(`[DEBUG] Current salary_u_s_12_7: ${finalMinData.salary_u_s_12_7}, type: ${typeof finalMinData.salary_u_s_12_7}`);
        logger.info(`[DEBUG] Income form available: ${!!incomeFormForFinalMin}, total_employment_income: ${incomeFormForFinalMin?.total_employment_income}`);
        logger.info(`[DEBUG] Adjustable tax available: ${!!adjustableTaxForFinalMin}, salary_tax_collected: ${adjustableTaxForFinalMin?.salary_employees_149_tax_collected}`);

        // Auto-link salary amount and tax deducted if they're 0
        if (incomeFormForFinalMin) {
          const salaryValue = parseFloat(finalMinData.salary_u_s_12_7);
          const shouldAutoLink = (salaryValue === 0 || finalMinData.salary_u_s_12_7 === null) && incomeFormForFinalMin.annual_salary_wages_total > 0;
          logger.info(`[DEBUG] Should auto-link amount? salaryValue=${salaryValue}, shouldAutoLink=${shouldAutoLink}`);

          if (shouldAutoLink) {
            finalMinData.salary_u_s_12_7 = parseFloat(
              incomeFormForFinalMin.annual_salary_wages_total
            );
            logger.info(`Auto-linked salary amount: ${finalMinData.salary_u_s_12_7} from income: ${incomeFormForFinalMin.annual_salary_wages_total}`);
          }
        }

        if (adjustableTaxForFinalMin) {
          const taxDeductedValue = parseFloat(finalMinData.salary_u_s_12_7_tax_deducted);
          const shouldAutoLinkTax = (taxDeductedValue === 0 || finalMinData.salary_u_s_12_7_tax_deducted === null) && adjustableTaxForFinalMin.salary_employees_149_tax_collected > 0;
          logger.info(`[DEBUG] Should auto-link tax? taxDeductedValue=${taxDeductedValue}, shouldAutoLinkTax=${shouldAutoLinkTax}`);

          if (shouldAutoLinkTax) {
            finalMinData.salary_u_s_12_7_tax_deducted = parseFloat(
              adjustableTaxForFinalMin.salary_employees_149_tax_collected
            );
            logger.info(`Auto-linked salary tax deducted: ${finalMinData.salary_u_s_12_7_tax_deducted} from adjustable: ${adjustableTaxForFinalMin.salary_employees_149_tax_collected}`);
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
        logger.info(`Final/min income auto-linked for user ${userId} (new record): salary=${incomeFormForFinalMin?.annual_salary_wages_total}, tax_deducted=${adjustableTaxForFinalMin?.salary_employees_149_tax_collected}`);
      }
    } catch (error) {
      logger.error('Error fetching final/min income data:', error);
    }

    // Fetch reductions form data
    try {
      const reductionsResult = await pool.query(
        'SELECT * FROM reductions_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (reductionsResult.rows.length > 0) {
        response.formData.reductions = reductionsResult.rows[0];
        logger.info(`Reductions data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching reductions data:', error);
    }

    // Fetch credits form data
    try {
      const creditsResult = await pool.query(
        'SELECT * FROM credits_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (creditsResult.rows.length > 0) {
        response.formData.credits = creditsResult.rows[0];
        logger.info(`Credits data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching credits data:', error);
    }

    // Fetch deductions form data
    try {
      const deductionsResult = await pool.query(
        'SELECT * FROM deductions_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (deductionsResult.rows.length > 0) {
        response.formData.deductions = deductionsResult.rows[0];
        logger.info(`Deductions data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching deductions data:', error);
    }

    // Fetch final tax form data
    try {
      const finalTaxResult = await pool.query(
        'SELECT * FROM final_tax_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (finalTaxResult.rows.length > 0) {
        response.formData.final_tax = finalTaxResult.rows[0];
        logger.info(`Final tax data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching final tax data:', error);
    }

    // Fetch expenses form data
    try {
      const expensesResult = await pool.query(
        'SELECT * FROM expenses_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (expensesResult.rows.length > 0) {
        response.formData.expenses = expensesResult.rows[0];
        logger.info(`Expenses data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching expenses data:', error);
    }

    // Fetch wealth statement form data
    try {
      const wealthResult = await pool.query(
        'SELECT * FROM wealth_statement_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (wealthResult.rows.length > 0) {
        response.formData.wealth_statement = wealthResult.rows[0];
        logger.info(`Wealth statement data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching wealth statement data:', error);
    }

    // Fetch wealth reconciliation form data
    try {
      const wealthReconResult = await pool.query(
        'SELECT * FROM wealth_reconciliation_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (wealthReconResult.rows.length > 0) {
        response.formData.wealth_reconciliation = wealthReconResult.rows[0];
        logger.info(`Wealth reconciliation data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching wealth reconciliation data:', error);
    }

    // Fetch tax computation form data
    try {
      const taxComputationResult = await pool.query(
        'SELECT * FROM tax_computation_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

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
});

// POST /api/tax-forms/create-return - Create a new tax return
router.post('/create-return', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = '2025-26'; // Default to current tax year

    logger.info(`Creating new tax return for user ${userId}, tax year ${taxYear}`);

    const taxReturn = {
      id: `${userId}-${taxYear}`,
      user_id: userId,
      tax_year: taxYear,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    logger.info(`New tax return created for user ${userId}, tax year ${taxYear}`);
    res.json({
      success: true,
      message: 'Tax return created successfully',
      taxReturn: taxReturn,
    });
  } catch (error) {
    logger.error('Error creating tax return:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create tax return',
      error: error.message,
    });
  }
});

// GET /api/tax-forms/adjustable-tax - Get adjustable tax form data with auto-linking
router.get('/adjustable-tax', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || '2025-26';

    logger.info(`Fetching adjustable tax data for user ${userId}, tax year ${taxYear}`);

    // Get income form data for auto-linking
    let incomeFormData = null;
    try {
      const incomeResult = await pool.query(
        'SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (incomeResult.rows.length > 0) {
        incomeFormData = incomeResult.rows[0];
        logger.info('Income form data found for auto-linking:', {
          directorship_fee: incomeFormData.directorship_fee,
          profit_debt_15: incomeFormData.profit_on_debt_15_percent,
          profit_debt_12_5: incomeFormData.profit_on_debt_12_5_percent,
          rent_income: incomeFormData.other_taxable_income_rent,
        });
      }
    } catch (error) {
      logger.warn('Could not fetch income form data for auto-linking:', error.message);
    }

    const result = await pool.query(
      'SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );

    if (result.rows.length === 0) {
      // No existing data - return auto-linked values from income form WITH calculated tax
      if (incomeFormData) {
        const autoLinkedData = {
          // Salary u/s 149 = Annual Salary and Wages Total (as shown in withholding certificate)
          salary_employees_149_gross_receipt: incomeFormData.annual_salary_wages_total || 0,
          directorship_fee_149_3_gross_receipt: incomeFormData.directorship_fee || 0,
          profit_debt_151_15_gross_receipt: incomeFormData.profit_on_debt_15_percent || 0,
          profit_debt_sukook_151a_gross_receipt: incomeFormData.profit_on_debt_12_5_percent || 0,
          tax_deducted_rent_section_155_gross_receipt:
            incomeFormData.other_taxable_income_rent || 0,
        };

        // Calculate tax collected amounts using FBR rates
        const TaxRateService = require('../../../services/taxRateService');
        const taxRates = await TaxRateService.getWithholdingTaxRates(taxYear);
        const calculations = CalculationService.calculateAdjustableTaxFields(
          autoLinkedData,
          taxRates
        );

        // Add calculated tax values to auto-linked data
        autoLinkedData.salary_employees_149_tax_collected = 0; // Salary is not subject to withholding
        autoLinkedData.directorship_fee_149_3_tax_collected =
          calculations.directorship_fee_149_3_tax_collected || 0;
        autoLinkedData.profit_debt_151_15_tax_collected =
          calculations.profit_debt_15_percent_tax_collected || 0;
        autoLinkedData.profit_debt_sukook_151a_tax_collected =
          calculations.sukook_12_5_percent_tax_collected || 0;
        autoLinkedData.tax_deducted_rent_section_155_tax_collected =
          calculations.rent_section_155_tax_collected || 0;

        logger.info('Auto-linked data from income form with calculated tax:', autoLinkedData);

        return res.json({
          success: true,
          data: autoLinkedData,
          autoLinked: true,
          message:
            'No adjustable tax data found, returning auto-linked values from income form with calculated tax',
        });
      }

      return res.json({
        success: true,
        data: null,
        autoLinked: false,
        message: 'No adjustable tax data found',
      });
    }

    const adjustableTaxData = result.rows[0];

    // Auto-link values if they are 0 and income form has data AND calculate tax
    if (incomeFormData) {
      let needsRecalculation = false;

      if (
        (adjustableTaxData.salary_employees_149_gross_receipt === 0 ||
          adjustableTaxData.salary_employees_149_gross_receipt === null) &&
        incomeFormData.annual_salary_wages_total > 0
      ) {
        adjustableTaxData.salary_employees_149_gross_receipt = parseFloat(
          incomeFormData.annual_salary_wages_total
        );
        // Keep existing tax_collected value - it's a user input field
        logger.info(
          'Auto-linked salary employees (annual salary wages total):',
          incomeFormData.annual_salary_wages_total
        );
        needsRecalculation = true;
      }
      if (
        adjustableTaxData.directorship_fee_149_3_gross_receipt === 0 &&
        incomeFormData.directorship_fee > 0
      ) {
        adjustableTaxData.directorship_fee_149_3_gross_receipt = incomeFormData.directorship_fee;
        logger.info('Auto-linked directorship fee:', incomeFormData.directorship_fee);
        needsRecalculation = true;
      }
      if (
        adjustableTaxData.profit_debt_151_15_gross_receipt === 0 &&
        incomeFormData.profit_on_debt_15_percent > 0
      ) {
        adjustableTaxData.profit_debt_151_15_gross_receipt =
          incomeFormData.profit_on_debt_15_percent;
        logger.info('Auto-linked profit debt 15%:', incomeFormData.profit_on_debt_15_percent);
        needsRecalculation = true;
      }
      if (
        adjustableTaxData.profit_debt_sukook_151a_gross_receipt === 0 &&
        incomeFormData.profit_on_debt_12_5_percent > 0
      ) {
        adjustableTaxData.profit_debt_sukook_151a_gross_receipt =
          incomeFormData.profit_on_debt_12_5_percent;
        logger.info('Auto-linked profit debt 12.5%:', incomeFormData.profit_on_debt_12_5_percent);
        needsRecalculation = true;
      }
      if (
        adjustableTaxData.tax_deducted_rent_section_155_gross_receipt === 0 &&
        incomeFormData.other_taxable_income_rent > 0
      ) {
        adjustableTaxData.tax_deducted_rent_section_155_gross_receipt =
          incomeFormData.other_taxable_income_rent;
        logger.info('Auto-linked rent income:', incomeFormData.other_taxable_income_rent);
        needsRecalculation = true;
      }

      // Recalculate tax collected amounts if any gross receipt was auto-linked
      if (needsRecalculation) {
        const TaxRateService = require('../../../services/taxRateService');
        const taxRates = await TaxRateService.getWithholdingTaxRates(taxYear);
        const calculations = CalculationService.calculateAdjustableTaxFields(
          adjustableTaxData,
          taxRates
        );

        // Update tax collected fields with calculated values
        adjustableTaxData.directorship_fee_149_3_tax_collected =
          calculations.directorship_fee_149_3_tax_collected || 0;
        adjustableTaxData.profit_debt_151_15_tax_collected =
          calculations.profit_debt_15_percent_tax_collected || 0;
        adjustableTaxData.profit_debt_sukook_151a_tax_collected =
          calculations.sukook_12_5_percent_tax_collected || 0;
        adjustableTaxData.tax_deducted_rent_section_155_tax_collected =
          calculations.rent_section_155_tax_collected || 0;

        logger.info('Recalculated tax collected values:', {
          directorship_tax: adjustableTaxData.directorship_fee_149_3_tax_collected,
          profit_15_tax: adjustableTaxData.profit_debt_151_15_tax_collected,
          sukook_tax: adjustableTaxData.profit_debt_sukook_151a_tax_collected,
          rent_tax: adjustableTaxData.tax_deducted_rent_section_155_tax_collected,
        });
      }
    }

    res.json({
      success: true,
      data: adjustableTaxData,
      autoLinked: incomeFormData ? true : false,
      message: 'Adjustable tax data retrieved successfully',
    });
  } catch (error) {
    logger.error('Error fetching adjustable tax data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch adjustable tax data',
      error: error.message,
    });
  }
});

// POST /api/tax-forms/adjustable-tax - Save adjustable tax form data
router.post('/adjustable-tax', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const taxYear = req.body.taxYear || '2025-26';
    const isComplete = req.body.isComplete || false;
    const formData = req.body;

    logger.info(`Saving adjustable tax data for user ${userId}, tax year ${taxYear}`);

    // Get tax year ID
    const taxYearResult = await pool.query('SELECT id FROM tax_years WHERE tax_year = $1', [
      taxYear,
    ]);

    if (taxYearResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tax year',
      });
    }

    const taxYearId = taxYearResult.rows[0].id;

    // Get or create tax return ID
    let taxReturnId;
    const taxReturnResult = await pool.query(
      'SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );

    if (taxReturnResult.rows.length === 0) {
      // Create new tax return
      const newTaxReturnResult = await pool.query(
        'INSERT INTO tax_returns (user_id, tax_year_id, tax_year, status) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, taxYearId, taxYear, 'in_progress']
      );
      taxReturnId = newTaxReturnResult.rows[0].id;
    } else {
      taxReturnId = taxReturnResult.rows[0].id;
    }

    // Check if adjustable tax form already exists
    const existingFormResult = await pool.query(
      'SELECT id FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );

    // Get FBR tax rates
    const taxRates = await TaxRateService.getWithholdingTaxRates(taxYear);
    logger.info('FBR tax rates loaded:', taxRates);

    // Get income form data for cross-form linking
    let incomeFormData = null;
    try {
      const incomeResult = await pool.query(
        'SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (incomeResult.rows.length > 0) {
        incomeFormData = incomeResult.rows[0];
        logger.info('Income form data found for linking:', {
          directorship_fee: incomeFormData.directorship_fee,
          profit_debt_15: incomeFormData.profit_on_debt_15_percent,
        });
      }
    } catch (error) {
      logger.warn('Could not fetch income form data for linking:', error.message);
    }

    // Clean and validate input data - handle both old and new field formats
    const cleanedData = {};

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

    // Map salary tax collected (user input field)
    cleanedData.salary_employees_149_tax_collected =
      getNumericValue(formData.salary_employees_149_tax_collected) ||
      getNumericValue(formData.salaryEmployees149?.taxCollected) ||
      0;

    // Map both old complex format and new simple format
    cleanedData.directorship_fee_149_3_gross_receipt =
      getNumericValue(formData.directorship_fee_149_3_gross_receipt) ||
      getNumericValue(formData.directorshipFee149_3?.grossReceipt) ||
      0;

    cleanedData.profit_debt_15_percent_gross_receipt =
      getNumericValue(formData.profit_debt_15_percent_gross_receipt) ||
      getNumericValue(formData.profitDebt151_15?.grossReceipt) ||
      0;

    cleanedData.profit_debt_sukook_151a_gross_receipt =
      getNumericValue(formData.profit_debt_sukook_151a_gross_receipt) ||
      getNumericValue(formData.sukook_12_5_percent_gross_receipt) ||
      getNumericValue(formData.profitDebtSukook151A?.grossReceipt) ||
      0;

    cleanedData.tax_deducted_rent_section_155_gross_receipt =
      getNumericValue(formData.tax_deducted_rent_section_155_gross_receipt) ||
      getNumericValue(formData.rent_section_155_gross_receipt) ||
      getNumericValue(formData.taxDeductedRentSection155?.grossReceipt) ||
      0;

    cleanedData.motor_vehicle_transfer_gross_receipt =
      getNumericValue(formData.motor_vehicle_transfer_gross_receipt) ||
      getNumericValue(formData.motorVehicleTransferFee231B2?.grossReceipt) ||
      0;

    // All Motor Vehicle fields
    cleanedData.motor_vehicle_registration_fee_231b1_gross_receipt =
      getNumericValue(formData.motor_vehicle_registration_fee_231b1_gross_receipt) ||
      getNumericValue(formData.motorVehicleRegistrationFee231B1?.grossReceipt) ||
      0;

    cleanedData.motor_vehicle_sale_231b3_gross_receipt =
      getNumericValue(formData.motor_vehicle_sale_231b3_gross_receipt) ||
      getNumericValue(formData.motorVehicleSale231B3?.grossReceipt) ||
      0;

    cleanedData.motor_vehicle_leasing_231b1a_gross_receipt =
      getNumericValue(formData.motor_vehicle_leasing_231b1a_gross_receipt) ||
      getNumericValue(formData.motorVehicleLeasing231B1A?.grossReceipt) ||
      0;

    cleanedData.advance_tax_motor_vehicle_231b2a_gross_receipt =
      getNumericValue(formData.advance_tax_motor_vehicle_231b2a_gross_receipt) ||
      getNumericValue(formData.advanceTaxMotorVehicle231B2A?.grossReceipt) ||
      0;

    // Motor Vehicle tax collected fields
    cleanedData.motor_vehicle_registration_fee_231b1_tax_collected =
      getNumericValue(formData.motor_vehicle_registration_fee_231b1_tax_collected) ||
      getNumericValue(formData.motorVehicleRegistrationFee231B1?.taxCollected) ||
      0;

    cleanedData.motor_vehicle_sale_231b3_tax_collected =
      getNumericValue(formData.motor_vehicle_sale_231b3_tax_collected) ||
      getNumericValue(formData.motorVehicleSale231B3?.taxCollected) ||
      0;

    cleanedData.motor_vehicle_leasing_231b1a_tax_collected =
      getNumericValue(formData.motor_vehicle_leasing_231b1a_tax_collected) ||
      getNumericValue(formData.motorVehicleLeasing231B1A?.taxCollected) ||
      0;

    cleanedData.advance_tax_motor_vehicle_231b2a_tax_collected =
      getNumericValue(formData.advance_tax_motor_vehicle_231b2a_tax_collected) ||
      getNumericValue(formData.advanceTaxMotorVehicle231B2A?.taxCollected) ||
      0;

    cleanedData.electricity_domestic_gross_receipt =
      getNumericValue(formData.electricity_domestic_gross_receipt) ||
      getNumericValue(formData.electricityBillDomestic235?.grossReceipt) ||
      0;

    cleanedData.cellphone_bill_gross_receipt =
      getNumericValue(formData.cellphone_bill_gross_receipt) ||
      getNumericValue(formData.cellphoneBill236_1F?.grossReceipt) ||
      0;

    // Tax collected fields for utilities
    cleanedData.electricity_domestic_tax_collected =
      getNumericValue(formData.electricity_domestic_tax_collected) ||
      getNumericValue(formData.electricityBillDomestic235?.taxCollected) ||
      0;

    cleanedData.cellphone_bill_tax_collected =
      getNumericValue(formData.cellphone_bill_tax_collected) ||
      getNumericValue(formData.cellphoneBill236_1F?.taxCollected) ||
      0;

    // Telecommunications fields
    cleanedData.telephone_bill_236_1e_gross_receipt =
      getNumericValue(formData.telephone_bill_236_1e_gross_receipt) ||
      getNumericValue(formData.telephoneBill236_1E?.grossReceipt) ||
      0;

    cleanedData.telephone_bill_236_1e_tax_collected =
      getNumericValue(formData.telephone_bill_236_1e_tax_collected) ||
      getNumericValue(formData.telephoneBill236_1E?.taxCollected) ||
      0;

    cleanedData.cellphone_bill_236_1f_gross_receipt =
      getNumericValue(formData.cellphone_bill_236_1f_gross_receipt) ||
      getNumericValue(formData.cellphoneBill236_1F?.grossReceipt) ||
      getNumericValue(formData.cellphone_bill_gross_receipt) ||
      0;

    cleanedData.cellphone_bill_236_1f_tax_collected =
      getNumericValue(formData.cellphone_bill_236_1f_tax_collected) ||
      getNumericValue(formData.cellphoneBill236_1F?.taxCollected) ||
      getNumericValue(formData.cellphone_bill_tax_collected) ||
      0;

    cleanedData.prepaid_telephone_card_236_1b_gross_receipt =
      getNumericValue(formData.prepaid_telephone_card_236_1b_gross_receipt) ||
      getNumericValue(formData.prepaidTelephoneCard236_1B?.grossReceipt) ||
      0;

    cleanedData.prepaid_telephone_card_236_1b_tax_collected =
      getNumericValue(formData.prepaid_telephone_card_236_1b_tax_collected) ||
      getNumericValue(formData.prepaidTelephoneCard236_1B?.taxCollected) ||
      0;

    cleanedData.phone_unit_236_1c_gross_receipt =
      getNumericValue(formData.phone_unit_236_1c_gross_receipt) ||
      getNumericValue(formData.phoneUnit236_1C?.grossReceipt) ||
      0;

    cleanedData.phone_unit_236_1c_tax_collected =
      getNumericValue(formData.phone_unit_236_1c_tax_collected) ||
      getNumericValue(formData.phoneUnit236_1C?.taxCollected) ||
      0;

    cleanedData.internet_bill_236_1d_gross_receipt =
      getNumericValue(formData.internet_bill_236_1d_gross_receipt) ||
      getNumericValue(formData.internetBill236_1D?.grossReceipt) ||
      0;

    cleanedData.internet_bill_236_1d_tax_collected =
      getNumericValue(formData.internet_bill_236_1d_tax_collected) ||
      getNumericValue(formData.internetBill236_1D?.taxCollected) ||
      0;

    cleanedData.prepaid_internet_card_236_1e_gross_receipt =
      getNumericValue(formData.prepaid_internet_card_236_1e_gross_receipt) ||
      getNumericValue(formData.prepaidInternetCard236_1E?.grossReceipt) ||
      0;

    cleanedData.prepaid_internet_card_236_1e_tax_collected =
      getNumericValue(formData.prepaid_internet_card_236_1e_tax_collected) ||
      getNumericValue(formData.prepaidInternetCard236_1E?.taxCollected) ||
      0;

    // Property fields
    cleanedData.sale_transfer_immoveable_property_236c_gross_receipt =
      getNumericValue(formData.sale_transfer_immoveable_property_236c_gross_receipt) ||
      getNumericValue(formData.saleTransferImmoveableProperty236C?.grossReceipt) ||
      0;

    cleanedData.sale_transfer_immoveable_property_236c_tax_collected =
      getNumericValue(formData.sale_transfer_immoveable_property_236c_tax_collected) ||
      getNumericValue(formData.saleTransferImmoveableProperty236C?.taxCollected) ||
      0;

    cleanedData.tax_deducted_236c_property_purchased_sold_same_year_gross_receipt =
      getNumericValue(formData.tax_deducted_236c_property_purchased_sold_same_year_gross_receipt) ||
      getNumericValue(formData.taxDeducted236CPropertyPurchasedSoldSameYear?.grossReceipt) ||
      0;

    cleanedData.tax_deducted_236c_property_purchased_sold_same_year_tax_collected =
      getNumericValue(formData.tax_deducted_236c_property_purchased_sold_same_year_tax_collected) ||
      getNumericValue(formData.taxDeducted236CPropertyPurchasedSoldSameYear?.taxCollected) ||
      0;

    cleanedData.tax_deducted_236c_property_purchased_prior_year_gross_receipt =
      getNumericValue(formData.tax_deducted_236c_property_purchased_prior_year_gross_receipt) ||
      getNumericValue(formData.taxDeducted236CPropertyPurchasedPriorYear?.grossReceipt) ||
      0;

    cleanedData.tax_deducted_236c_property_purchased_prior_year_tax_collected =
      getNumericValue(formData.tax_deducted_236c_property_purchased_prior_year_tax_collected) ||
      getNumericValue(formData.taxDeducted236CPropertyPurchasedPriorYear?.taxCollected) ||
      0;

    cleanedData.purchase_transfer_immoveable_property_236k_gross_receipt =
      getNumericValue(formData.purchase_transfer_immoveable_property_236k_gross_receipt) ||
      getNumericValue(formData.purchaseTransferImmoveableProperty236K?.grossReceipt) ||
      0;

    cleanedData.purchase_transfer_immoveable_property_236k_tax_collected =
      getNumericValue(formData.purchase_transfer_immoveable_property_236k_tax_collected) ||
      getNumericValue(formData.purchaseTransferImmoveableProperty236K?.taxCollected) ||
      0;

    // Events and Services fields
    cleanedData.functions_gatherings_charges_236cb_gross_receipt =
      getNumericValue(formData.functions_gatherings_charges_236cb_gross_receipt) ||
      getNumericValue(formData.functionsGatheringsCharges236CB?.grossReceipt) ||
      0;

    cleanedData.functions_gatherings_charges_236cb_tax_collected =
      getNumericValue(formData.functions_gatherings_charges_236cb_tax_collected) ||
      getNumericValue(formData.functionsGatheringsCharges236CB?.taxCollected) ||
      0;

    cleanedData.withholding_tax_sale_considerations_37e_gross_receipt =
      getNumericValue(formData.withholding_tax_sale_considerations_37e_gross_receipt) ||
      getNumericValue(formData.withholdingTaxSaleConsiderations37E?.grossReceipt) ||
      0;

    cleanedData.withholding_tax_sale_considerations_37e_tax_collected =
      getNumericValue(formData.withholding_tax_sale_considerations_37e_tax_collected) ||
      getNumericValue(formData.withholdingTaxSaleConsiderations37E?.taxCollected) ||
      0;

    // Financial and International fields
    cleanedData.advance_fund_23a_part_i_second_schedule_gross_receipt =
      getNumericValue(formData.advance_fund_23a_part_i_second_schedule_gross_receipt) ||
      getNumericValue(formData.advanceFund23APartISecondSchedule?.grossReceipt) ||
      0;

    cleanedData.advance_fund_23a_part_i_second_schedule_tax_collected =
      getNumericValue(formData.advance_fund_23a_part_i_second_schedule_tax_collected) ||
      getNumericValue(formData.advanceFund23APartISecondSchedule?.taxCollected) ||
      0;

    cleanedData.persons_remitting_amount_abroad_236v_gross_receipt =
      getNumericValue(formData.persons_remitting_amount_abroad_236v_gross_receipt) ||
      getNumericValue(formData.personsRemittingAmountAbroad236V?.grossReceipt) ||
      0;

    cleanedData.persons_remitting_amount_abroad_236v_tax_collected =
      getNumericValue(formData.persons_remitting_amount_abroad_236v_tax_collected) ||
      getNumericValue(formData.personsRemittingAmountAbroad236V?.taxCollected) ||
      0;

    cleanedData.advance_tax_foreign_domestic_workers_231c_gross_receipt =
      getNumericValue(formData.advance_tax_foreign_domestic_workers_231c_gross_receipt) ||
      getNumericValue(formData.advanceTaxForeignDomesticWorkers231C?.grossReceipt) ||
      0;

    cleanedData.advance_tax_foreign_domestic_workers_231c_tax_collected =
      getNumericValue(formData.advance_tax_foreign_domestic_workers_231c_tax_collected) ||
      getNumericValue(formData.advanceTaxForeignDomesticWorkers231C?.taxCollected) ||
      0;

    // Cash withdrawal field
    cleanedData.advance_tax_cash_withdrawal_231ab_gross_receipt =
      getNumericValue(formData.advance_tax_cash_withdrawal_231ab_gross_receipt) ||
      getNumericValue(formData.advanceTaxCashWithdrawal231AB?.grossReceipt) ||
      0;

    cleanedData.advance_tax_cash_withdrawal_231ab_tax_collected =
      getNumericValue(formData.advance_tax_cash_withdrawal_231ab_tax_collected) ||
      getNumericValue(formData.advanceTaxCashWithdrawal231AB?.taxCollected) ||
      0;

    // Auto-link from Income Form if data is available and fields are zero
    // Map ALL 5 fields: salary, directorship, profit 15%, sukook 12.5%, rent
    if (incomeFormData) {
      // Auto-link salary from total_employment_income
      cleanedData.salary_employees_149_gross_receipt = parseFloat(
        incomeFormData.total_employment_income || 0
      );
      if (cleanedData.salary_employees_149_gross_receipt > 0) {
        logger.info(
          'Auto-linked salary from income form:',
          cleanedData.salary_employees_149_gross_receipt
        );
      }

      // Auto-link directorship fee
      if (
        cleanedData.directorship_fee_149_3_gross_receipt === 0 &&
        incomeFormData.directorship_fee > 0
      ) {
        cleanedData.directorship_fee_149_3_gross_receipt = parseFloat(
          incomeFormData.directorship_fee
        );
        logger.info(
          'Auto-linked directorship fee from income form:',
          cleanedData.directorship_fee_149_3_gross_receipt
        );
      }

      // Auto-link profit @15%
      if (
        cleanedData.profit_debt_15_percent_gross_receipt === 0 &&
        incomeFormData.profit_on_debt_15_percent > 0
      ) {
        cleanedData.profit_debt_15_percent_gross_receipt = parseFloat(
          incomeFormData.profit_on_debt_15_percent
        );
        logger.info(
          'Auto-linked profit debt 15% from income form:',
          cleanedData.profit_debt_15_percent_gross_receipt
        );
      }

      // Auto-link Sukook @12.5%
      if (
        cleanedData.profit_debt_sukook_151a_gross_receipt === 0 &&
        incomeFormData.profit_on_debt_12_5_percent > 0
      ) {
        cleanedData.profit_debt_sukook_151a_gross_receipt = parseFloat(
          incomeFormData.profit_on_debt_12_5_percent
        );
        // Also set the field name expected by CalculationService
        cleanedData.sukook_12_5_percent_gross_receipt =
          cleanedData.profit_debt_sukook_151a_gross_receipt;
        logger.info(
          'Auto-linked sukook 12.5% from income form:',
          cleanedData.profit_debt_sukook_151a_gross_receipt
        );
      }

      // Auto-link Rent
      if (
        cleanedData.tax_deducted_rent_section_155_gross_receipt === 0 &&
        incomeFormData.other_taxable_income_rent > 0
      ) {
        cleanedData.tax_deducted_rent_section_155_gross_receipt = parseFloat(
          incomeFormData.other_taxable_income_rent
        );
        // Also set the field name expected by CalculationService
        cleanedData.rent_section_155_gross_receipt =
          cleanedData.tax_deducted_rent_section_155_gross_receipt;
        logger.info(
          'Auto-linked rent from income form:',
          cleanedData.tax_deducted_rent_section_155_gross_receipt
        );
      }
    }

    // Calculate FBR compliant tax amounts using CalculationService
    const calculations = CalculationService.calculateAdjustableTaxFields(cleanedData, taxRates);
    logger.info('Adjustable tax calculations completed:', {
      directorship_tax: calculations.directorship_fee_149_3_tax_collected,
      total_tax: calculations.total_tax_collected,
    });

    // Prepare data for the complex database structure (maintain backward compatibility)
    const adjustableTaxData = {
      tax_return_id: taxReturnId,
      user_id: userId,
      user_email: userEmail,
      tax_year_id: taxYearId,
      tax_year: taxYear,

      // Map to existing database fields - main ones we need for testing
      directorship_fee_149_3_gross_receipt: cleanedData.directorship_fee_149_3_gross_receipt,
      directorship_fee_149_3_tax_collected: calculations.directorship_fee_149_3_tax_collected || 0,
      profit_debt_151_15_gross_receipt: cleanedData.profit_debt_15_percent_gross_receipt,
      profit_debt_151_15_tax_collected: calculations.profit_debt_15_percent_tax_collected || 0,
      profit_debt_sukook_151a_gross_receipt: cleanedData.profit_debt_sukook_151a_gross_receipt,
      profit_debt_sukook_151a_tax_collected: calculations.sukook_12_5_percent_tax_collected || 0,
      tax_deducted_rent_section_155_gross_receipt:
        cleanedData.tax_deducted_rent_section_155_gross_receipt,
      tax_deducted_rent_section_155_tax_collected: calculations.rent_section_155_tax_collected || 0,
      motor_vehicle_transfer_fee_231b2_gross_receipt:
        cleanedData.motor_vehicle_transfer_gross_receipt,
      motor_vehicle_transfer_fee_231b2_tax_collected:
        calculations.motor_vehicle_transfer_tax_collected || 0,
      electricity_bill_domestic_235_gross_receipt: cleanedData.electricity_domestic_gross_receipt,
      electricity_bill_domestic_235_tax_collected:
        calculations.electricity_domestic_tax_collected || 0,
      cellphone_bill_236_1f_gross_receipt: cleanedData.cellphone_bill_236_1f_gross_receipt || 0,
      cellphone_bill_236_1f_tax_collected: cleanedData.cellphone_bill_236_1f_tax_collected || 0,

      // Set all other fields to 0 to maintain database compatibility
      // EXCEPT salary which is auto-linked from income form
      salary_employees_149_gross_receipt: cleanedData.salary_employees_149_gross_receipt || 0,
      salary_employees_149_tax_collected: cleanedData.salary_employees_149_tax_collected || 0, // User input field
      advance_tax_cash_withdrawal_231ab_gross_receipt: cleanedData.advance_tax_cash_withdrawal_231ab_gross_receipt || 0,
      advance_tax_cash_withdrawal_231ab_tax_collected: cleanedData.advance_tax_cash_withdrawal_231ab_tax_collected || 0,
      motor_vehicle_registration_fee_231b1_gross_receipt: cleanedData.motor_vehicle_registration_fee_231b1_gross_receipt || 0,
      motor_vehicle_registration_fee_231b1_tax_collected: cleanedData.motor_vehicle_registration_fee_231b1_tax_collected || 0,
      motor_vehicle_sale_231b3_gross_receipt: cleanedData.motor_vehicle_sale_231b3_gross_receipt || 0,
      motor_vehicle_sale_231b3_tax_collected: cleanedData.motor_vehicle_sale_231b3_tax_collected || 0,
      motor_vehicle_leasing_231b1a_gross_receipt: cleanedData.motor_vehicle_leasing_231b1a_gross_receipt || 0,
      motor_vehicle_leasing_231b1a_tax_collected: cleanedData.motor_vehicle_leasing_231b1a_tax_collected || 0,
      advance_tax_motor_vehicle_231b2a_gross_receipt: cleanedData.advance_tax_motor_vehicle_231b2a_gross_receipt || 0,
      advance_tax_motor_vehicle_231b2a_tax_collected: cleanedData.advance_tax_motor_vehicle_231b2a_tax_collected || 0,
      telephone_bill_236_1e_gross_receipt: cleanedData.telephone_bill_236_1e_gross_receipt || 0,
      telephone_bill_236_1e_tax_collected: cleanedData.telephone_bill_236_1e_tax_collected || 0,
      prepaid_telephone_card_236_1b_gross_receipt: cleanedData.prepaid_telephone_card_236_1b_gross_receipt || 0,
      prepaid_telephone_card_236_1b_tax_collected: cleanedData.prepaid_telephone_card_236_1b_tax_collected || 0,
      phone_unit_236_1c_gross_receipt: cleanedData.phone_unit_236_1c_gross_receipt || 0,
      phone_unit_236_1c_tax_collected: cleanedData.phone_unit_236_1c_tax_collected || 0,
      internet_bill_236_1d_gross_receipt: cleanedData.internet_bill_236_1d_gross_receipt || 0,
      internet_bill_236_1d_tax_collected: cleanedData.internet_bill_236_1d_tax_collected || 0,
      prepaid_internet_card_236_1e_gross_receipt: cleanedData.prepaid_internet_card_236_1e_gross_receipt || 0,
      prepaid_internet_card_236_1e_tax_collected: cleanedData.prepaid_internet_card_236_1e_tax_collected || 0,
      sale_transfer_immoveable_property_236c_gross_receipt: cleanedData.sale_transfer_immoveable_property_236c_gross_receipt || 0,
      sale_transfer_immoveable_property_236c_tax_collected: cleanedData.sale_transfer_immoveable_property_236c_tax_collected || 0,
      tax_deducted_236c_property_purchased_sold_same_year_gross_recei: cleanedData.tax_deducted_236c_property_purchased_sold_same_year_gross_receipt || 0,
      tax_deducted_236c_property_purchased_sold_same_year_tax_collect: cleanedData.tax_deducted_236c_property_purchased_sold_same_year_tax_collected || 0,
      tax_deducted_236c_property_purchased_prior_year_gross_receipt: cleanedData.tax_deducted_236c_property_purchased_prior_year_gross_receipt || 0,
      tax_deducted_236c_property_purchased_prior_year_tax_collected: cleanedData.tax_deducted_236c_property_purchased_prior_year_tax_collected || 0,
      purchase_transfer_immoveable_property_236k_gross_receipt: cleanedData.purchase_transfer_immoveable_property_236k_gross_receipt || 0,
      purchase_transfer_immoveable_property_236k_tax_collected: cleanedData.purchase_transfer_immoveable_property_236k_tax_collected || 0,
      functions_gatherings_charges_236cb_gross_receipt: cleanedData.functions_gatherings_charges_236cb_gross_receipt || 0,
      functions_gatherings_charges_236cb_tax_collected: cleanedData.functions_gatherings_charges_236cb_tax_collected || 0,
      withholding_tax_sale_considerations_37e_gross_receipt: cleanedData.withholding_tax_sale_considerations_37e_gross_receipt || 0,
      withholding_tax_sale_considerations_37e_tax_collected: cleanedData.withholding_tax_sale_considerations_37e_tax_collected || 0,
      advance_fund_23a_part_i_second_schedule_gross_receipt: cleanedData.advance_fund_23a_part_i_second_schedule_gross_receipt || 0,
      advance_fund_23a_part_i_second_schedule_tax_collected: cleanedData.advance_fund_23a_part_i_second_schedule_tax_collected || 0,
      persons_remitting_amount_abroad_236v_gross_receipt: cleanedData.persons_remitting_amount_abroad_236v_gross_receipt || 0,
      persons_remitting_amount_abroad_236v_tax_collected: cleanedData.persons_remitting_amount_abroad_236v_tax_collected || 0,
      advance_tax_foreign_domestic_workers_231c_gross_receipt: cleanedData.advance_tax_foreign_domestic_workers_231c_gross_receipt || 0,
      advance_tax_foreign_domestic_workers_231c_tax_collected: cleanedData.advance_tax_foreign_domestic_workers_231c_tax_collected || 0,

      is_complete: isComplete,
      last_updated_by: userId,
    };

    let result;
    if (existingFormResult.rows.length > 0) {
      // Update existing form
      const updateFields = Object.keys(adjustableTaxData)
        .filter(
          (key) =>
            key !== 'tax_return_id' &&
            key !== 'user_id' &&
            key !== 'user_email' &&
            key !== 'tax_year_id' &&
            key !== 'tax_year'
        )
        .map((key, index) => `${key} = $${index + 3}`)
        .join(', ');

      const updateValues = Object.keys(adjustableTaxData)
        .filter(
          (key) =>
            key !== 'tax_return_id' &&
            key !== 'user_id' &&
            key !== 'user_email' &&
            key !== 'tax_year_id' &&
            key !== 'tax_year'
        )
        .map((key) => adjustableTaxData[key]);

      result = await pool.query(
        `UPDATE adjustable_tax_forms SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND tax_year = $2 RETURNING *`,
        [userId, taxYear, ...updateValues]
      );
    } else {
      // Insert new form
      const insertFields = Object.keys(adjustableTaxData).join(', ');
      const insertPlaceholders = Object.keys(adjustableTaxData)
        .map((_, index) => `$${index + 1}`)
        .join(', ');
      const insertValues = Object.values(adjustableTaxData);

      result = await pool.query(
        `INSERT INTO adjustable_tax_forms (${insertFields}) VALUES (${insertPlaceholders}) RETURNING *`,
        insertValues
      );
    }

    logger.info(`Adjustable tax data saved for user ${userId}, tax year ${taxYear}`, {
      directorship_tax: result.rows[0].directorship_fee_149_3_tax_collected,
      total_fields_saved: Object.keys(result.rows[0]).length,
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Adjustable tax data saved successfully',
      calculations: calculations,
      taxRatesUsed: taxRates,
      crossFormLinking: incomeFormData ? 'enabled' : 'no_income_data',
    });
  } catch (error) {
    logger.error('Error saving adjustable tax data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save adjustable tax data',
      error: error.message,
    });
  }
});

// Removed duplicate income_forms endpoint - now using /api/income-form/* for all income operations

// Helper function to save form data generically
const saveFormData = async (tableName, formKey, req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const taxYear = req.body.taxYear || req.query.taxYear || '2025-26';
    const formData = req.body;

    logger.info(`Saving ${formKey} data for user ${userId}, tax year ${taxYear}`);

    // Get tax year ID
    const taxYearResult = await pool.query('SELECT id FROM tax_years WHERE tax_year = $1', [
      taxYear,
    ]);

    if (taxYearResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tax year',
      });
    }

    const taxYearId = taxYearResult.rows[0].id;

    // Get or create tax return
    let taxReturnResult = await pool.query(
      'SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );

    let taxReturnId;
    if (taxReturnResult.rows.length === 0) {
      const newReturn = await pool.query(
        'INSERT INTO tax_returns (user_id, user_email, tax_year_id, tax_year, filing_status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [userId, userEmail, taxYearId, taxYear, 'draft']
      );
      taxReturnId = newReturn.rows[0].id;
    } else {
      taxReturnId = taxReturnResult.rows[0].id;
    }

    // Check if form exists
    const existingResult = await pool.query(
      `SELECT id FROM ${tableName} WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );

    // Prepare data - filter out taxYear from formData to avoid duplication
    const { taxYear: _, ...cleanFormData } = formData;
    const dataToSave = {
      tax_return_id: taxReturnId,
      user_id: userId,
      user_email: userEmail,
      tax_year_id: taxYearId,
      tax_year: taxYear,
      ...cleanFormData,
      last_updated_by: userId,
    };

    let result;
    if (existingResult.rows.length > 0) {
      // Update
      const updateFields = Object.keys(dataToSave)
        .filter(
          (key) =>
            !['tax_return_id', 'user_id', 'user_email', 'tax_year_id', 'tax_year'].includes(key)
        )
        .map((key, index) => `${key} = $${index + 3}`)
        .join(', ');

      const updateValues = Object.keys(dataToSave)
        .filter(
          (key) =>
            !['tax_return_id', 'user_id', 'user_email', 'tax_year_id', 'tax_year'].includes(key)
        )
        .map((key) => dataToSave[key]);

      result = await pool.query(
        `UPDATE ${tableName} SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND tax_year = $2 RETURNING *`,
        [userId, taxYear, ...updateValues]
      );
    } else {
      // Insert
      const insertFields = Object.keys(dataToSave).join(', ');
      const insertPlaceholders = Object.keys(dataToSave)
        .map((_, index) => `$${index + 1}`)
        .join(', ');
      const insertValues = Object.values(dataToSave);

      result = await pool.query(
        `INSERT INTO ${tableName} (${insertFields}) VALUES (${insertPlaceholders}) RETURNING *`,
        insertValues
      );
    }

    logger.info(`${formKey} data saved for user ${userId}`);
    res.json({
      success: true,
      data: result.rows[0],
      message: `${formKey} data saved successfully`,
    });
  } catch (error) {
    logger.error(`Error saving ${formKey} data:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to save ${formKey} data`,
      error: error.message,
    });
  }
};

// GET /api/tax-forms/capital-gains - Get capital gains data
router.get('/capital-gains', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || '2025-26';
    const result = await pool.query(
      'SELECT * FROM capital_gain_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching capital gains:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch capital gains', error: error.message });
  }
});

// POST /api/tax-forms/capital-gains - Save capital gains data
router.post('/capital-gains', auth, (req, res) =>
  saveFormData('capital_gain_forms', 'capital_gains', req, res)
);

// GET /api/tax-forms/final-min-income - Get final/min income data with auto-linking
router.get('/final-min-income', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || '2025-26';

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

    // Auto-link salary amount and tax deducted if they're 0 and source forms have data
    if (incomeFormData) {
      if (
        (finalMinIncomeData.salary_u_s_12_7 === 0 ||
          finalMinIncomeData.salary_u_s_12_7 === null) &&
        incomeFormData.annual_salary_wages_total > 0
      ) {
        finalMinIncomeData.salary_u_s_12_7 = parseFloat(
          incomeFormData.annual_salary_wages_total
        );
        logger.info(
          'Auto-linked salary amount:',
          finalMinIncomeData.salary_u_s_12_7
        );
      }
    }

    if (adjustableTaxData) {
      if (
        (finalMinIncomeData.salary_u_s_12_7_tax_deducted === 0 ||
          finalMinIncomeData.salary_u_s_12_7_tax_deducted === null) &&
        adjustableTaxData.salary_employees_149_tax_collected > 0
      ) {
        finalMinIncomeData.salary_u_s_12_7_tax_deducted = parseFloat(
          adjustableTaxData.salary_employees_149_tax_collected
        );
        logger.info(
          'Auto-linked salary tax deducted:',
          finalMinIncomeData.salary_u_s_12_7_tax_deducted
        );
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
});

// POST /api/tax-forms/final-min-income - Save final/min income data with tax_chargeable calculations
router.post('/final-min-income', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const taxYear = req.body.taxYear || '2025-26';
    const isComplete = req.body.isComplete || false;
    const formData = req.body;

    logger.info(`Saving final/min income data for user ${userId}, tax year ${taxYear}`);

    // Import tax rate configuration
    const { calculateTaxChargeable, FINAL_MIN_TAX_RATES } = require('../../../config/finalMinTaxRates');

    // Get tax year ID
    const taxYearResult = await pool.query('SELECT id FROM tax_years WHERE tax_year = $1', [
      taxYear,
    ]);

    if (taxYearResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tax year',
      });
    }

    const taxYearId = taxYearResult.rows[0].id;

    // Get or create tax return ID
    let taxReturnId;
    const taxReturnResult = await pool.query(
      'SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );

    if (taxReturnResult.rows.length === 0) {
      const newTaxReturnResult = await pool.query(
        'INSERT INTO tax_returns (user_id, tax_year_id, tax_year, status) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, taxYearId, taxYear, 'in_progress']
      );
      taxReturnId = newTaxReturnResult.rows[0].id;
    } else {
      taxReturnId = taxReturnResult.rows[0].id;
    }

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

      // Dividend u/s 150 - Regular dividend (15%/30% or 25%/50%)
      dividend_u_s_150_31pc_atl_amount: getNumericValue(formData.dividend_u_s_150_31pc_atl_amount),
      dividend_u_s_150_31pc_atl_tax_deducted: getNumericValue(formData.dividend_u_s_150_31pc_atl_tax_deducted),

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

    // Calculate tax_chargeable for each field using tax rate configuration
    // For now, use simple fixed rates - ATL status will be added later
    const isATL = formData.isATL || false; // TODO: Get from user profile or form

    // Calculate tax chargeable for each income type
    // For final tax income, tax_chargeable = tax_deducted (tax already withheld at source)
    const taxChargeableCalculations = {
      // Salary - Variable rate (from tax computation)
      salary_u_s_12_7_tax_chargeable: 0, // Will be calculated from tax computation

      // REIT SPV - Tax chargeable = tax deducted
      dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable:
        getNumericValue(formData.dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted) || 0,

      // Other SPV - Tax chargeable = tax deducted
      dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable:
        getNumericValue(formData.dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted) || 0,

      // IPP Shares - Tax chargeable = tax deducted
      dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable:
        getNumericValue(formData.dividend_u_s_150_7_5pc_ipp_shares_tax_deducted) || 0,

      // Regular dividend - Tax chargeable = tax deducted
      dividend_u_s_150_31pc_atl_tax_chargeable:
        getNumericValue(formData.dividend_u_s_150_31pc_atl_tax_deducted) || 0,

      // Sukuk @ 10% - Tax chargeable = tax deducted
      return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable:
        getNumericValue(formData.return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted) || 0,

      // Sukuk @ 12.5% - Tax chargeable = tax deducted
      return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable:
        getNumericValue(formData.return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted) || 0,

      // Sukuk @ 25% - Tax chargeable = tax deducted
      return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable:
        getNumericValue(formData.return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted) || 0,

      // Return exceeding 1M @ 12.5% - Tax chargeable = tax deducted
      return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable:
        getNumericValue(formData.return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted) || 0,

      // Return not exceeding 1M @ 10% - Tax chargeable = tax deducted
      return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable:
        getNumericValue(formData.return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted) || 0,

      // Profit on Debt @ 10%/20% - Tax chargeable = tax deducted
      profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable:
        getNumericValue(formData.profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted) || 0,

      // National Savings - Variable (use tax_deducted as tax_chargeable)
      profit_debt_national_savings_defence_39_14a_tax_chargeable:
        getNumericValue(formData.profit_debt_national_savings_defence_39_14a_tax_deducted) || 0,

      // Interest/Profit on Debt @ 15% - Tax chargeable = tax deducted
      interest_income_profit_debt_7b_up_to_5m_tax_chargeable:
        getNumericValue(formData.interest_income_profit_debt_7b_up_to_5m_tax_deducted) || 0,

      // Prize on Raffle/Lottery @ 20% - Tax chargeable = tax deducted
      prize_raffle_lottery_quiz_promotional_156_tax_chargeable:
        getNumericValue(formData.prize_raffle_lottery_quiz_promotional_156_tax_deducted) || 0,

      // Prize on Prize Bond @ 15% - Tax chargeable = tax deducted
      prize_bond_cross_world_puzzle_156_tax_chargeable:
        getNumericValue(formData.prize_bond_cross_world_puzzle_156_tax_deducted) || 0,

      // Bonus Shares - Tax chargeable = tax deducted
      bonus_shares_companies_236f_tax_chargeable:
        getNumericValue(formData.bonus_shares_companies_236f_tax_deducted) || 0,

      // Employment Termination - Variable (use tax_deducted as tax_chargeable)
      employment_termination_benefits_12_6_avg_rate_tax_chargeable:
        getNumericValue(formData.employment_termination_benefits_12_6_avg_rate_tax_deducted) || 0,

      // Salary Arrears - Relevant rate (use tax_deducted as tax_chargeable)
      salary_arrears_12_7_relevant_rate_tax_chargeable:
        getNumericValue(formData.salary_arrears_12_7_relevant_rate_tax_deducted) || 0,

      // Capital Gain (from capital gain form calculation)
      capital_gain_tax_chargeable:
        getNumericValue(formData.capital_gain_tax_deducted) || 0, // Use tax_deducted as tax_chargeable
    };

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

    logger.info('Field name mapping applied:', {
      sampleOriginal: 'salary_u_s_12_7_amount',
      sampleMapped: 'salary_u_s_12_7',
      totalMappedFields: Object.keys(mappedCleanedData).length
    });

    // Prepare data for database
    const finalMinIncomeData = {
      tax_return_id: taxReturnId,
      user_id: userId,
      user_email: userEmail,
      tax_year_id: taxYearId,
      tax_year: taxYear,

      // Merge amounts (with mapped field names), tax_deducted, and calculated tax_chargeable
      ...mappedCleanedData,
      ...taxChargeableCalculations,

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

    // Check if form already exists
    const existingFormResult = await pool.query(
      'SELECT id FROM final_min_income_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );

    let result;
    if (existingFormResult.rows.length > 0) {
      // Update existing form
      const updateFields = Object.keys(finalMinIncomeData)
        .filter(
          (key) =>
            key !== 'tax_return_id' &&
            key !== 'user_id' &&
            key !== 'user_email' &&
            key !== 'tax_year_id' &&
            key !== 'tax_year'
        )
        .map((key, index) => `${key} = $${index + 3}`)
        .join(', ');

      const updateValues = Object.keys(finalMinIncomeData)
        .filter(
          (key) =>
            key !== 'tax_return_id' &&
            key !== 'user_id' &&
            key !== 'user_email' &&
            key !== 'tax_year_id' &&
            key !== 'tax_year'
        )
        .map((key) => finalMinIncomeData[key]);

      result = await pool.query(
        `UPDATE final_min_income_forms SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND tax_year = $2 RETURNING *`,
        [userId, taxYear, ...updateValues]
      );
    } else {
      // Insert new form
      const insertFields = Object.keys(finalMinIncomeData).join(', ');
      const insertPlaceholders = Object.keys(finalMinIncomeData)
        .map((_, index) => `$${index + 1}`)
        .join(', ');
      const insertValues = Object.values(finalMinIncomeData);

      result = await pool.query(
        `INSERT INTO final_min_income_forms (${insertFields}) VALUES (${insertPlaceholders}) RETURNING *`,
        insertValues
      );
    }

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
      error: error.message,
    });
  }
});

// GET /api/tax-forms/reductions - Get reductions data
router.get('/reductions', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || '2025-26';
    const result = await pool.query(
      'SELECT * FROM reductions_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching reductions:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch reductions', error: error.message });
  }
});

// POST /api/tax-forms/reductions - Save reductions data
router.post('/reductions', auth, (req, res) =>
  saveFormData('reductions_forms', 'reductions', req, res)
);

// GET /api/tax-forms/credits - Get credits data
router.get('/credits', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || '2025-26';
    const result = await pool.query(
      'SELECT * FROM credits_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching credits:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch credits', error: error.message });
  }
});

// POST /api/tax-forms/credits - Save credits data
router.post('/credits', auth, (req, res) => saveFormData('credits_forms', 'credits', req, res));

// GET /api/tax-forms/deductions - Get deductions data
router.get('/deductions', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || '2025-26';
    const result = await pool.query(
      'SELECT * FROM deductions_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching deductions:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch deductions', error: error.message });
  }
});

// POST /api/tax-forms/deductions - Save deductions data
router.post('/deductions', auth, (req, res) =>
  saveFormData('deductions_forms', 'deductions', req, res)
);

// GET /api/tax-forms/final-tax - Get final tax data
router.get('/final-tax', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || '2025-26';
    const result = await pool.query(
      'SELECT * FROM final_tax_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching final tax:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch final tax', error: error.message });
  }
});

// POST /api/tax-forms/final-tax - Save final tax data
router.post('/final-tax', auth, (req, res) =>
  saveFormData('final_tax_forms', 'final_tax', req, res)
);

// GET /api/tax-forms/expenses - Get expenses data
router.get('/expenses', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || '2025-26';
    const result = await pool.query(
      'SELECT * FROM expenses_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching expenses:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch expenses', error: error.message });
  }
});

// POST /api/tax-forms/expenses - Save expenses data
router.post('/expenses', auth, (req, res) => saveFormData('expenses_forms', 'expenses', req, res));

// GET /api/tax-forms/tax-computation - Get tax computation with auto-linking from all forms
router.get('/tax-computation', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || '2025-26';

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
    const taxComputation = {
      // B6: Income from Salary = Income Form B27 (total_employment_income)
      income_from_salary: incomeData?.total_employment_income || 0,

      // B7: Income from Other Sources = Income Form B22 + B25
      income_from_other_sources:
        (incomeData?.other_income_min_tax_total || 0) +
        (incomeData?.other_income_no_min_tax_total || 0),

      // B8: Capital Gains = Capital Gains Form total
      capital_gains: capitalGainsData?.total_capital_gains || 0,

      // B9: Total Taxable Income = B6 + B7 + B8 (auto-calculated in database)
      // This will be calculated by generated column

      // B12: Withholding Income Tax = Adjustable Tax B32 (total_adjustable_tax)
      withholding_income_tax: adjustableTaxData?.total_adjustable_tax || 0,

      // B13: Tax Credits = Credits Form total
      tax_credits: creditsData?.total_tax_credits || 0,

      // B14: Total Reductions = Reductions Form total
      total_reductions: reductionsData?.total_reductions || 0,

      // User can still override these if needed
      tax_payable_u_s_1: existingTaxComputation?.tax_payable_u_s_1 || 0,
      minimum_tax_u_s_113: existingTaxComputation?.minimum_tax_u_s_113 || 0,
      tax_payable_after_minimum: existingTaxComputation?.tax_payable_after_minimum || 0,
      surcharge_if_applicable: existingTaxComputation?.surcharge_if_applicable || 0,
      tax_payable_before_credit: existingTaxComputation?.tax_payable_before_credit || 0,
      refund_due: existingTaxComputation?.refund_due || 0,
      balance_tax_payable: existingTaxComputation?.balance_tax_payable || 0,
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
});

// POST /api/tax-forms/tax-computation - Save tax computation data
router.post('/tax-computation', auth, (req, res) =>
  saveFormData('tax_computation_forms', 'tax_computation', req, res)
);

module.exports = router;
