const express = require('express');
const { pool } = require('../../../config/database');
const auth = require('../../../middleware/auth');
const logger = require('../../../utils/logger');
const TaxRateService = require('../../../services/taxRateService');
const CalculationService = require('../../../services/calculationService');

const router = express.Router();

// GET /api/tax-forms/current-return - Get current tax return with all form data
router.get('/current-return', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = '2025-26'; // Default to current tax year

    logger.info(`Fetching current tax return for user ${userId}, tax year ${taxYear}`);

    // Initialize response structure
    const response = {
      taxReturn: {
        id: `${userId}-${taxYear}`,
        user_id: userId,
        tax_year: taxYear,
        status: 'in_progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      formData: {},
      completedSteps: []
    };

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
          other_income_no_min_tax_total: incomeData.other_income_no_min_tax_total
        };
        response.completedSteps.push('income');
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
        response.completedSteps.push('adjustable_tax');
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
        response.completedSteps.push('capital_gains');
        logger.info(`Capital gains data found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error fetching capital gains data:', error);
    }

    // Fetch final/min income form data
    try {
      const finalMinIncomeResult = await pool.query(
        'SELECT * FROM final_min_income_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (finalMinIncomeResult.rows.length > 0) {
        response.formData.final_min_income = finalMinIncomeResult.rows[0];
        response.completedSteps.push('final_min_income');
        logger.info(`Final/min income data found for user ${userId}`);
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
        response.completedSteps.push('reductions');
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
        response.completedSteps.push('credits');
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
        response.completedSteps.push('deductions');
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
        response.completedSteps.push('final_tax');
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
        response.completedSteps.push('expenses');
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
        response.completedSteps.push('wealth_statement');
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
        response.completedSteps.push('wealth_reconciliation');
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
        response.completedSteps.push('tax_computation');
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
      error: error.message
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
      updated_at: new Date().toISOString()
    };

    logger.info(`New tax return created for user ${userId}, tax year ${taxYear}`);
    res.json({
      success: true,
      message: 'Tax return created successfully',
      taxReturn: taxReturn
    });

  } catch (error) {
    logger.error('Error creating tax return:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create tax return',
      error: error.message
    });
  }
});

// GET /api/tax-forms/adjustable-tax - Get adjustable tax form data
router.get('/adjustable-tax', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || '2025-26';

    logger.info(`Fetching adjustable tax data for user ${userId}, tax year ${taxYear}`);

    const result = await pool.query(
      'SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No adjustable tax data found'
      });
    }

    const adjustableTaxData = result.rows[0];
    res.json({
      success: true,
      data: adjustableTaxData,
      message: 'Adjustable tax data retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching adjustable tax data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch adjustable tax data',
      error: error.message
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
    const taxYearResult = await pool.query(
      'SELECT id FROM tax_years WHERE tax_year = $1',
      [taxYear]
    );

    if (taxYearResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tax year'
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
          profit_debt_15: incomeFormData.profit_on_debt_15_percent
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

    // Map both old complex format and new simple format
    cleanedData.directorship_fee_149_3_gross_receipt =
      getNumericValue(formData.directorship_fee_149_3_gross_receipt) ||
      getNumericValue(formData.directorshipFee149_3?.grossReceipt) || 0;

    cleanedData.profit_debt_15_percent_gross_receipt =
      getNumericValue(formData.profit_debt_15_percent_gross_receipt) ||
      getNumericValue(formData.profitDebt151_15?.grossReceipt) || 0;

    cleanedData.sukook_12_5_percent_gross_receipt =
      getNumericValue(formData.sukook_12_5_percent_gross_receipt) ||
      getNumericValue(formData.profitDebtSukook151A?.grossReceipt) || 0;

    cleanedData.rent_section_155_gross_receipt =
      getNumericValue(formData.rent_section_155_gross_receipt) ||
      getNumericValue(formData.taxDeductedRentSection155?.grossReceipt) || 0;

    cleanedData.motor_vehicle_transfer_gross_receipt =
      getNumericValue(formData.motor_vehicle_transfer_gross_receipt) ||
      getNumericValue(formData.motorVehicleTransferFee231B2?.grossReceipt) || 0;

    cleanedData.electricity_domestic_gross_receipt =
      getNumericValue(formData.electricity_domestic_gross_receipt) ||
      getNumericValue(formData.electricityBillDomestic235?.grossReceipt) || 0;

    cleanedData.cellphone_bill_gross_receipt =
      getNumericValue(formData.cellphone_bill_gross_receipt) ||
      getNumericValue(formData.cellphoneBill236_1F?.grossReceipt) || 0;

    // Auto-link from Income Form if data is available and fields are zero
    if (incomeFormData) {
      if (cleanedData.directorship_fee_149_3_gross_receipt === 0 && incomeFormData.directorship_fee > 0) {
        cleanedData.directorship_fee_149_3_gross_receipt = parseFloat(incomeFormData.directorship_fee);
        logger.info('Auto-linked directorship fee from income form:', cleanedData.directorship_fee_149_3_gross_receipt);
      }
      if (cleanedData.profit_debt_15_percent_gross_receipt === 0 && incomeFormData.profit_on_debt_15_percent > 0) {
        cleanedData.profit_debt_15_percent_gross_receipt = parseFloat(incomeFormData.profit_on_debt_15_percent);
        logger.info('Auto-linked profit debt 15% from income form:', cleanedData.profit_debt_15_percent_gross_receipt);
      }
    }

    // Calculate FBR compliant tax amounts using CalculationService
    const calculations = CalculationService.calculateAdjustableTaxFields(cleanedData, taxRates);
    logger.info('Adjustable tax calculations completed:', {
      directorship_tax: calculations.directorship_fee_149_3_tax_collected,
      total_tax: calculations.total_tax_collected
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
      profit_debt_sukook_151a_gross_receipt: cleanedData.sukook_12_5_percent_gross_receipt,
      profit_debt_sukook_151a_tax_collected: calculations.sukook_12_5_percent_tax_collected || 0,
      tax_deducted_rent_section_155_gross_receipt: cleanedData.rent_section_155_gross_receipt,
      tax_deducted_rent_section_155_tax_collected: calculations.rent_section_155_tax_collected || 0,
      motor_vehicle_transfer_fee_231b2_gross_receipt: cleanedData.motor_vehicle_transfer_gross_receipt,
      motor_vehicle_transfer_fee_231b2_tax_collected: calculations.motor_vehicle_transfer_tax_collected || 0,
      electricity_bill_domestic_235_gross_receipt: cleanedData.electricity_domestic_gross_receipt,
      electricity_bill_domestic_235_tax_collected: calculations.electricity_domestic_tax_collected || 0,
      cellphone_bill_236_1f_gross_receipt: cleanedData.cellphone_bill_gross_receipt,
      cellphone_bill_236_1f_tax_collected: calculations.cellphone_bill_tax_collected || 0,

      // Set all other fields to 0 to maintain database compatibility
      salary_employees_149_gross_receipt: 0,
      salary_employees_149_tax_collected: 0,
      advance_tax_cash_withdrawal_231ab_gross_receipt: 0,
      advance_tax_cash_withdrawal_231ab_tax_collected: 0,
      motor_vehicle_registration_fee_231b1_gross_receipt: 0,
      motor_vehicle_registration_fee_231b1_tax_collected: 0,
      motor_vehicle_sale_231b3_gross_receipt: 0,
      motor_vehicle_sale_231b3_tax_collected: 0,
      motor_vehicle_leasing_231b1a_gross_receipt: 0,
      motor_vehicle_leasing_231b1a_tax_collected: 0,
      advance_tax_motor_vehicle_231b2a_gross_receipt: 0,
      advance_tax_motor_vehicle_231b2a_tax_collected: 0,
      telephone_bill_236_1e_gross_receipt: 0,
      telephone_bill_236_1e_tax_collected: 0,
      prepaid_telephone_card_236_1b_gross_receipt: 0,
      prepaid_telephone_card_236_1b_tax_collected: 0,
      phone_unit_236_1c_gross_receipt: 0,
      phone_unit_236_1c_tax_collected: 0,
      internet_bill_236_1d_gross_receipt: 0,
      internet_bill_236_1d_tax_collected: 0,
      prepaid_internet_card_236_1e_gross_receipt: 0,
      prepaid_internet_card_236_1e_tax_collected: 0,
      sale_transfer_immoveable_property_236c_gross_receipt: 0,
      sale_transfer_immoveable_property_236c_tax_collected: 0,
      tax_deducted_236c_property_purchased_sold_same_year_gross_recei: 0,
      tax_deducted_236c_property_purchased_sold_same_year_tax_collect: 0,
      tax_deducted_236c_property_purchased_prior_year_gross_receipt: 0,
      tax_deducted_236c_property_purchased_prior_year_tax_collected: 0,
      purchase_transfer_immoveable_property_236k_gross_receipt: 0,
      purchase_transfer_immoveable_property_236k_tax_collected: 0,
      functions_gatherings_charges_236cb_gross_receipt: 0,
      functions_gatherings_charges_236cb_tax_collected: 0,
      withholding_tax_sale_considerations_37e_gross_receipt: 0,
      withholding_tax_sale_considerations_37e_tax_collected: 0,
      advance_fund_23a_part_i_second_schedule_gross_receipt: 0,
      advance_fund_23a_part_i_second_schedule_tax_collected: 0,
      persons_remitting_amount_abroad_236v_gross_receipt: 0,
      persons_remitting_amount_abroad_236v_tax_collected: 0,
      advance_tax_foreign_domestic_workers_231c_gross_receipt: 0,
      advance_tax_foreign_domestic_workers_231c_tax_collected: 0,

      is_complete: isComplete,
      last_updated_by: userId
    };

    let result;
    if (existingFormResult.rows.length > 0) {
      // Update existing form
      const updateFields = Object.keys(adjustableTaxData)
        .filter(key => key !== 'tax_return_id' && key !== 'user_id' && key !== 'user_email' && key !== 'tax_year_id' && key !== 'tax_year')
        .map((key, index) => `${key} = $${index + 3}`)
        .join(', ');

      const updateValues = Object.keys(adjustableTaxData)
        .filter(key => key !== 'tax_return_id' && key !== 'user_id' && key !== 'user_email' && key !== 'tax_year_id' && key !== 'tax_year')
        .map(key => adjustableTaxData[key]);

      result = await pool.query(
        `UPDATE adjustable_tax_forms SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND tax_year = $2 RETURNING *`,
        [userId, taxYear, ...updateValues]
      );
    } else {
      // Insert new form
      const insertFields = Object.keys(adjustableTaxData).join(', ');
      const insertPlaceholders = Object.keys(adjustableTaxData).map((_, index) => `$${index + 1}`).join(', ');
      const insertValues = Object.values(adjustableTaxData);

      result = await pool.query(
        `INSERT INTO adjustable_tax_forms (${insertFields}) VALUES (${insertPlaceholders}) RETURNING *`,
        insertValues
      );
    }

    logger.info(`Adjustable tax data saved for user ${userId}, tax year ${taxYear}`, {
      directorship_tax: result.rows[0].directorship_fee_149_3_tax_collected,
      total_fields_saved: Object.keys(result.rows[0]).length
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Adjustable tax data saved successfully',
      calculations: calculations,
      taxRatesUsed: taxRates,
      crossFormLinking: incomeFormData ? 'enabled' : 'no_income_data'
    });

  } catch (error) {
    logger.error('Error saving adjustable tax data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save adjustable tax data',
      error: error.message
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
    const taxYearResult = await pool.query(
      'SELECT id FROM tax_years WHERE tax_year = $1',
      [taxYear]
    );

    if (taxYearResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tax year'
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
      last_updated_by: userId
    };

    let result;
    if (existingResult.rows.length > 0) {
      // Update
      const updateFields = Object.keys(dataToSave)
        .filter(key => !['tax_return_id', 'user_id', 'user_email', 'tax_year_id', 'tax_year'].includes(key))
        .map((key, index) => `${key} = $${index + 3}`)
        .join(', ');

      const updateValues = Object.keys(dataToSave)
        .filter(key => !['tax_return_id', 'user_id', 'user_email', 'tax_year_id', 'tax_year'].includes(key))
        .map(key => dataToSave[key]);

      result = await pool.query(
        `UPDATE ${tableName} SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND tax_year = $2 RETURNING *`,
        [userId, taxYear, ...updateValues]
      );
    } else {
      // Insert
      const insertFields = Object.keys(dataToSave).join(', ');
      const insertPlaceholders = Object.keys(dataToSave).map((_, index) => `$${index + 1}`).join(', ');
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
      message: `${formKey} data saved successfully`
    });

  } catch (error) {
    logger.error(`Error saving ${formKey} data:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to save ${formKey} data`,
      error: error.message
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
    res.status(500).json({ success: false, message: 'Failed to fetch capital gains', error: error.message });
  }
});

// POST /api/tax-forms/capital-gains - Save capital gains data
router.post('/capital-gains', auth, (req, res) => saveFormData('capital_gain_forms', 'capital_gains', req, res));

// GET /api/tax-forms/final-min-income - Get final/min income data
router.get('/final-min-income', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || '2025-26';
    const result = await pool.query(
      'SELECT * FROM final_min_income_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching final/min income:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch final/min income', error: error.message });
  }
});

// POST /api/tax-forms/final-min-income - Save final/min income data
router.post('/final-min-income', auth, (req, res) => saveFormData('final_min_income_forms', 'final_min_income', req, res));

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
    res.status(500).json({ success: false, message: 'Failed to fetch reductions', error: error.message });
  }
});

// POST /api/tax-forms/reductions - Save reductions data
router.post('/reductions', auth, (req, res) => saveFormData('reductions_forms', 'reductions', req, res));

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
    res.status(500).json({ success: false, message: 'Failed to fetch credits', error: error.message });
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
    res.status(500).json({ success: false, message: 'Failed to fetch deductions', error: error.message });
  }
});

// POST /api/tax-forms/deductions - Save deductions data
router.post('/deductions', auth, (req, res) => saveFormData('deductions_forms', 'deductions', req, res));

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
    res.status(500).json({ success: false, message: 'Failed to fetch final tax', error: error.message });
  }
});

// POST /api/tax-forms/final-tax - Save final tax data
router.post('/final-tax', auth, (req, res) => saveFormData('final_tax_forms', 'final_tax', req, res));

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
    res.status(500).json({ success: false, message: 'Failed to fetch expenses', error: error.message });
  }
});

// POST /api/tax-forms/expenses - Save expenses data
router.post('/expenses', auth, (req, res) => saveFormData('expenses_forms', 'expenses', req, res));

module.exports = router;