const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to verify session token authentication
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided'
      });
    }
    
    const sessionToken = authHeader.substring(7);
    
    const sessionResult = await pool.query(`
      SELECT us.user_id, us.user_email, u.id, u.email, u.name, u.user_type, u.role, u.is_active 
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_token = $1 AND us.expires_at > NOW() AND u.is_active = true
    `, [sessionToken]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid session',
        message: 'Session expired or invalid'
      });
    }
    
    const sessionData = sessionResult.rows[0];
    req.user = {
      id: sessionData.id,
      email: sessionData.email,
      name: sessionData.name,
      user_type: sessionData.user_type,
      role: sessionData.role,
      is_active: sessionData.is_active
    };
    req.userId = sessionData.user_id;
    req.userEmail = sessionData.user_email;
    next();
    
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    });
  }
};

// Get tax calculation summary report
router.get('/tax-calculation-summary/:taxYear', requireAuth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.userId;

    // Get tax return for the year
    const taxReturnResult = await pool.query(`
      SELECT * FROM tax_returns 
      WHERE user_id = $1 AND tax_year = $2
    `, [userId, taxYear]);

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'No tax return found for the specified year'
      });
    }

    const taxReturn = taxReturnResult.rows[0];
    const taxReturnId = taxReturn.id;

    // Get income data
    const incomeResult = await pool.query(`
      SELECT * FROM income_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get adjustable tax data
    const adjustableTaxResult = await pool.query(`
      SELECT * FROM adjustable_tax_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get reductions data
    const reductionsResult = await pool.query(`
      SELECT * FROM reductions_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get credits data
    const creditsResult = await pool.query(`
      SELECT * FROM credits_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get deductions data
    const deductionsResult = await pool.query(`
      SELECT * FROM deductions_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get final tax data
    const finalTaxResult = await pool.query(`
      SELECT * FROM final_tax_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get capital gains data
    const capitalGainsResult = await pool.query(`
      SELECT * FROM capital_gain_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get expenses data
    const expensesResult = await pool.query(`
      SELECT * FROM expenses_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get wealth data
    const wealthResult = await pool.query(`
      SELECT * FROM wealth_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    const reportData = {
      taxReturn,
      income: incomeResult.rows[0] || null,
      adjustableTax: adjustableTaxResult.rows[0] || null,
      reductions: reductionsResult.rows[0] || null,
      credits: creditsResult.rows[0] || null,
      deductions: deductionsResult.rows[0] || null,
      finalTax: finalTaxResult.rows[0] || null,
      capitalGains: capitalGainsResult.rows[0] || null,
      expenses: expensesResult.rows[0] || null,
      wealth: wealthResult.rows[0] || null
    };

    res.json({
      success: true,
      data: reportData,
      message: 'Tax calculation summary retrieved successfully'
    });

  } catch (error) {
    logger.error('Tax calculation summary error:', error);
    res.status(500).json({
      error: 'Failed to generate tax calculation summary',
      message: 'Internal server error'
    });
  }
});

// Get comprehensive income analysis
router.get('/income-analysis/:taxYear', requireAuth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.userId;

    // Get tax return for the year
    const taxReturnResult = await pool.query(`
      SELECT * FROM tax_returns 
      WHERE user_id = $1 AND tax_year = $2
    `, [userId, taxYear]);

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'No tax return found for the specified year'
      });
    }

    const taxReturnId = taxReturnResult.rows[0].id;

    // Get detailed income data
    const incomeData = await pool.query(`
      SELECT 
        monthly_salary,
        bonus,
        car_allowance,
        other_taxable,
        medical_allowance,
        employer_contribution,
        other_exempt,
        other_sources,
        subtotal_calculated,
        (COALESCE(monthly_salary, 0) + COALESCE(bonus, 0) + COALESCE(car_allowance, 0) + 
         COALESCE(other_taxable, 0) + COALESCE(medical_allowance, 0) + 
         COALESCE(employer_contribution, 0) + COALESCE(other_exempt, 0) + 
         COALESCE(other_sources, 0)) as total_gross_income,
        (COALESCE(medical_allowance, 0) + COALESCE(employer_contribution, 0) + 
         COALESCE(other_exempt, 0)) as total_exempt_income,
        (COALESCE(monthly_salary, 0) + COALESCE(bonus, 0) + COALESCE(car_allowance, 0) + 
         COALESCE(other_taxable, 0) + COALESCE(other_sources, 0)) as total_taxable_income
      FROM income_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get capital gains data
    const capitalGainsData = await pool.query(`
      SELECT 
        property_1_year,
        property_2_3_years,
        property_4_plus_years,
        securities,
        other_capital_gains,
        total_capital_gains
      FROM capital_gain_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get final tax income (if exists)
    const finalTaxData = await pool.query(`
      SELECT 
        sukuk_amount,
        debt_amount,
        prize_bonds,
        other_final_tax_amount
      FROM final_tax_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    const analysisData = {
      regularIncome: incomeData.rows[0] || null,
      capitalGains: capitalGainsData.rows[0] || null,
      finalTaxIncome: finalTaxData.rows[0] || null,
      taxYear,
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: analysisData,
      message: 'Income analysis retrieved successfully'
    });

  } catch (error) {
    logger.error('Income analysis error:', error);
    res.status(500).json({
      error: 'Failed to generate income analysis',
      message: 'Internal server error'
    });
  }
});

// Get adjustable tax payments report
router.get('/adjustable-tax-report/:taxYear', requireAuth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.userId;

    // Get tax return for the year
    const taxReturnResult = await pool.query(`
      SELECT * FROM tax_returns 
      WHERE user_id = $1 AND tax_year = $2
    `, [userId, taxYear]);

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'No tax return found for the specified year'
      });
    }

    const taxReturnId = taxReturnResult.rows[0].id;

    // Get adjustable tax data
    const adjustableTaxResult = await pool.query(`
      SELECT * FROM adjustable_tax_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    if (adjustableTaxResult.rows.length === 0) {
      return res.json({
        success: true,
        data: { message: 'No adjustable tax data found for this year' },
        message: 'Adjustable tax report retrieved successfully'
      });
    }

    const adjustableTaxData = adjustableTaxResult.rows[0];

    // Structure the data for reporting
    const reportData = {
      taxYear,
      totalAdjustableTax: adjustableTaxData.total_adjustable_tax,
      categories: {
        employment: {
          salaryTax: adjustableTaxData.salary_employees_149_tax_collected || 0,
          directorshipFee: adjustableTaxData.directorship_fee_149_3_tax_collected || 0
        },
        utilities: {
          electricity: adjustableTaxData.electricity_bill_domestic_235_tax_collected || 0,
          telephone: adjustableTaxData.telephone_bill_236_1e_tax_collected || 0,
          cellphone: adjustableTaxData.cellphone_bill_236_1f_tax_collected || 0
        },
        motorVehicle: {
          registration: adjustableTaxData.motor_vehicle_registration_fee_231b1_tax_collected || 0,
          transfer: adjustableTaxData.motor_vehicle_transfer_fee_231b2_tax_collected || 0,
          sale: adjustableTaxData.motor_vehicle_sale_231b3_tax_collected || 0
        },
        property: {
          saleTransfer: adjustableTaxData.sale_transfer_immoveable_property_236c_tax_collected || 0,
          purchase: adjustableTaxData.purchase_transfer_immoveable_property_236k_tax_collected || 0
        },
        financial: {
          profitOnDebt: adjustableTaxData.profit_debt_151_15_tax_collected || 0,
          cashWithdrawal: adjustableTaxData.advance_tax_cash_withdrawal_231ab_tax_collected || 0
        }
      },
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: reportData,
      message: 'Adjustable tax report retrieved successfully'
    });

  } catch (error) {
    logger.error('Adjustable tax report error:', error);
    res.status(500).json({
      error: 'Failed to generate adjustable tax report',
      message: 'Internal server error'
    });
  }
});

// Get wealth reconciliation report
router.get('/wealth-reconciliation/:taxYear', requireAuth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.userId;

    // Get tax return for the year
    const taxReturnResult = await pool.query(`
      SELECT * FROM tax_returns 
      WHERE user_id = $1 AND tax_year = $2
    `, [userId, taxYear]);

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'No tax return found for the specified year'
      });
    }

    const taxReturnId = taxReturnResult.rows[0].id;

    // Get wealth data
    const wealthResult = await pool.query(`
      SELECT * FROM wealth_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get wealth reconciliation data if it exists
    const wealthReconciliationResult = await pool.query(`
      SELECT * FROM wealth_reconciliation_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get income data for reconciliation
    const incomeResult = await pool.query(`
      SELECT 
        (COALESCE(monthly_salary, 0) + COALESCE(bonus, 0) + COALESCE(car_allowance, 0) + 
         COALESCE(other_taxable, 0) + COALESCE(other_sources, 0)) as total_taxable_income
      FROM income_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get expenses data for reconciliation
    const expensesResult = await pool.query(`
      SELECT total_expenses FROM expenses_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    const reportData = {
      taxYear,
      wealthStatement: wealthResult.rows[0] || null,
      wealthReconciliation: wealthReconciliationResult.rows[0] || null,
      totalTaxableIncome: incomeResult.rows[0]?.total_taxable_income || 0,
      totalExpenses: expensesResult.rows[0]?.total_expenses || 0,
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: reportData,
      message: 'Wealth reconciliation report retrieved successfully'
    });

  } catch (error) {
    logger.error('Wealth reconciliation report error:', error);
    res.status(500).json({
      error: 'Failed to generate wealth reconciliation report',
      message: 'Internal server error'
    });
  }
});

// Get available tax years for reports
router.get('/available-years', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await pool.query(`
      SELECT DISTINCT tr.tax_year, ty.start_date, ty.end_date, ty.filing_deadline
      FROM tax_returns tr
      JOIN tax_years ty ON tr.tax_year = ty.tax_year
      WHERE tr.user_id = $1
      ORDER BY tr.tax_year DESC
    `, [userId]);

    res.json({
      success: true,
      data: result.rows,
      message: 'Available tax years retrieved successfully'
    });

  } catch (error) {
    logger.error('Available years error:', error);
    res.status(500).json({
      error: 'Failed to retrieve available years',
      message: 'Internal server error'
    });
  }
});

module.exports = router;