const express = require('express');
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const CalculationService = require('../services/calculationService');

const router = express.Router();

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
      // Return empty form structure if no data found
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
      return res.json(emptyForm);
    }

    const incomeForm = result.rows[0];
    logger.info(`Income form data retrieved for user ${userId}, tax year ${taxYear}`);
    logger.info(`ACTUAL DATA RETURNED: allowances=${incomeForm.allowances}, bonus=${incomeForm.bonus}, annual_basic_salary=${incomeForm.annual_basic_salary}`);
    res.json(incomeForm);

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
router.post('/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;
    const formData = req.body;

    logger.info(`Saving income form data for user ${userId}, tax year ${taxYear}`, {
      monthly_basic_salary: formData.monthly_basic_salary,
      directorship_fee: formData.directorship_fee
    });

    // Clean and validate all input data
    const cleanedData = {};
    const allFields = [
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

    // Clean all input fields
    for (const field of allFields) {
      const value = formData[field];
      if (value === '' || value === null || value === undefined) {
        cleanedData[field] = 0;
      } else if (typeof value === 'string') {
        const numericValue = parseFloat(value.replace(/,/g, ''));
        if (isNaN(numericValue)) {
          cleanedData[field] = 0; // Default to 0 for invalid values
        } else {
          cleanedData[field] = numericValue;
        }
      } else if (typeof value === 'number') {
        cleanedData[field] = value;
      } else {
        cleanedData[field] = 0;
      }
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

    // Use UPSERT with only input fields (generated columns are calculated automatically)
    const query = `
      INSERT INTO income_forms (
        user_id, tax_year,
        annual_basic_salary, allowances, bonus, medical_allowance,
        pension_from_ex_employer, employment_termination_payment,
        retirement_from_approved_funds, directorship_fee, other_cash_benefits,
        employer_contribution_provident, taxable_car_value, other_taxable_subsidies,
        profit_on_debt_15_percent, profit_on_debt_12_5_percent,
        other_taxable_income_rent, other_taxable_income_others
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      ON CONFLICT (user_id, tax_year)
      DO UPDATE SET
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
      dbData.other_taxable_income_others
    ];

    const result = await pool.query(query, values);
    const savedForm = result.rows[0];

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

// GET /api/income-form/:taxYear/summary - Get calculated summary of income form
router.get('/:taxYear/summary', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    logger.info(`Fetching income form summary for user ${userId}, tax year ${taxYear}`);

    const result = await pool.query(
      `SELECT
        employment_termination_total,
        total_non_cash_benefits,
        other_income_min_tax_total,
        other_income_no_min_tax_total,
        income_exempt_from_tax,
        non_cash_benefit_exempt,
        (employment_termination_total + total_non_cash_benefits + other_income_min_tax_total + other_income_no_min_tax_total) as total_income,
        updated_at
       FROM income_forms
       WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Income form not found'
      });
    }

    const summary = result.rows[0];
    logger.info(`Income form summary retrieved for user ${userId}, tax year ${taxYear}`);
    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error('Error fetching income form summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch income form summary',
      error: error.message
    });
  }
});

module.exports = router;