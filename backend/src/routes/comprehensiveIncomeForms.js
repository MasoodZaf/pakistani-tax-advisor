const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to verify session token authentication (same as main taxForms)
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
      message: error.message
    });
  }
};

// Get comprehensive income form data
router.get('/:taxYear', requireAuth, async (req, res) => {
  try {
    const { userId, userEmail } = req;
    const { taxYear } = req.params;
    
    logger.info(`Getting comprehensive income form for user ${userEmail}, tax year ${taxYear}`);
    
    const result = await pool.query(`
      SELECT if.*, ty.id as tax_year_id, tr.id as tax_return_id
      FROM income_forms if
      JOIN tax_years ty ON if.tax_year = ty.tax_year
      JOIN tax_returns tr ON if.tax_return_id = tr.id
      WHERE if.user_id = $1 AND if.user_email = $2 AND if.tax_year = $3
    `, [userId, userEmail, taxYear]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Income form not found',
        message: `No income form found for tax year ${taxYear}`
      });
    }
    
    const formData = result.rows[0];
    
    // Structure the data to match the frontend expectations
    const structuredData = {
      formId: formData.id,
      taxReturnId: formData.tax_return_id,
      taxYearId: formData.tax_year_id,
      taxYear: formData.tax_year,
      isComplete: formData.is_complete,
      
      // Comprehensive income fields
      salaryIncome: {
        salary_u_s_12_7: parseFloat(formData.salary_u_s_12_7 || 0)
      },
      
      dividendInterest: {
        dividend_u_s_150_exempt_profit_rate_mlt_30: parseFloat(formData.dividend_u_s_150_exempt_profit_rate_mlt_30 || 0),
        dividend_u_s_150_31_atl_15pc: parseFloat(formData.dividend_u_s_150_31_atl_15pc || 0),
        dividend_u_s_150_56_10_shares: parseFloat(formData.dividend_u_s_150_56_10_shares || 0)
      },
      
      investmentReturns: {
        return_on_investment_sukuk_u_s_151_1a_10pc: parseFloat(formData.return_on_investment_sukuk_u_s_151_1a_10pc || 0),
        return_on_investment_sukuk_u_s_151_1a_12_5pc: parseFloat(formData.return_on_investment_sukuk_u_s_151_1a_12_5pc || 0),
        return_on_investment_sukuk_u_s_151_1b_15pc: parseFloat(formData.return_on_investment_sukuk_u_s_151_1b_15pc || 0),
        return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a: parseFloat(formData.return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a || 0),
        return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a: parseFloat(formData.return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a || 0)
      },
      
      profitDebt: {
        profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc: parseFloat(formData.profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc || 0),
        profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a: parseFloat(formData.profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a || 0),
        profit_on_debt_u_s_7b: parseFloat(formData.profit_on_debt_u_s_7b || 0),
        prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156: parseFloat(formData.prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156 || 0),
        bonus_shares_issued_by_companies_u_s_236f: parseFloat(formData.bonus_shares_issued_by_companies_u_s_236f || 0)
      },
      
      employmentBenefits: {
        employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate: parseFloat(formData.employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate || 0)
      },
      
      otherIncome: {
        salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate: parseFloat(formData.salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate || 0)
      },
      
      // Totals
      totals: {
        subtotal: parseFloat(formData.subtotal || 0),
        capitalGain: parseFloat(formData.capital_gain || 0),
        grandTotal: parseFloat(formData.grand_total || 0),
        subtotalCalculated: parseFloat(formData.subtotal_calculated || 0),
        grandTotalCalculated: parseFloat(formData.grand_total_calculated || 0)
      },
      
      // Legacy fields for backward compatibility
      legacy: {
        monthly_salary: parseFloat(formData.monthly_salary || 0),
        bonus: parseFloat(formData.bonus || 0),
        car_allowance: parseFloat(formData.car_allowance || 0),
        other_taxable: parseFloat(formData.other_taxable || 0),
        salary_tax_deducted: parseFloat(formData.salary_tax_deducted || 0),
        multiple_employer: formData.multiple_employer,
        additional_tax_deducted: parseFloat(formData.additional_tax_deducted || 0),
        medical_allowance: parseFloat(formData.medical_allowance || 0),
        employer_contribution: parseFloat(formData.employer_contribution || 0),
        other_exempt: parseFloat(formData.other_exempt || 0),
        other_sources: parseFloat(formData.other_sources || 0)
      },
      
      lastUpdatedBy: formData.last_updated_by,
      createdAt: formData.created_at,
      updatedAt: formData.updated_at
    };
    
    res.json({
      success: true,
      data: structuredData,
      message: 'Comprehensive income form retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Error getting comprehensive income form:', error);
    res.status(500).json({ 
      error: 'Database error',
      message: 'Failed to retrieve comprehensive income form data'
    });
  }
});

// Save/Update comprehensive income form data
router.post('/:taxYear', requireAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId, userEmail } = req;
    const { taxYear } = req.params;
    const formData = req.body;
    
    logger.info(`Saving comprehensive income form for user ${userEmail}, tax year ${taxYear}`);
    
    // Get tax year and tax return IDs
    const taxYearResult = await client.query(
      'SELECT id FROM tax_years WHERE tax_year = $1',
      [taxYear]
    );
    
    if (taxYearResult.rows.length === 0) {
      throw new Error(`Tax year ${taxYear} not found`);
    }
    
    const taxYearId = taxYearResult.rows[0].id;
    
    const taxReturnResult = await client.query(
      'SELECT id FROM tax_returns WHERE user_id = $1 AND user_email = $2 AND tax_year = $3',
      [userId, userEmail, taxYear]
    );
    
    if (taxReturnResult.rows.length === 0) {
      throw new Error(`Tax return not found for user ${userEmail} and tax year ${taxYear}`);
    }
    
    const taxReturnId = taxReturnResult.rows[0].id;
    
    // Prepare the upsert query with all comprehensive income fields
    const upsertQuery = `
      INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        salary_u_s_12_7,
        dividend_u_s_150_exempt_profit_rate_mlt_30, dividend_u_s_150_31_atl_15pc, dividend_u_s_150_56_10_shares,
        return_on_investment_sukuk_u_s_151_1a_10pc, return_on_investment_sukuk_u_s_151_1a_12_5pc,
        return_on_investment_sukuk_u_s_151_1b_15pc, return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a,
        return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a,
        profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc,
        profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a,
        profit_on_debt_u_s_7b, prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156,
        bonus_shares_issued_by_companies_u_s_236f, employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate,
        salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate,
        subtotal, capital_gain, grand_total,
        is_complete, last_updated_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26
      )
      ON CONFLICT (user_id, tax_year_id) 
      DO UPDATE SET
        salary_u_s_12_7 = EXCLUDED.salary_u_s_12_7,
        dividend_u_s_150_exempt_profit_rate_mlt_30 = EXCLUDED.dividend_u_s_150_exempt_profit_rate_mlt_30,
        dividend_u_s_150_31_atl_15pc = EXCLUDED.dividend_u_s_150_31_atl_15pc,
        dividend_u_s_150_56_10_shares = EXCLUDED.dividend_u_s_150_56_10_shares,
        return_on_investment_sukuk_u_s_151_1a_10pc = EXCLUDED.return_on_investment_sukuk_u_s_151_1a_10pc,
        return_on_investment_sukuk_u_s_151_1a_12_5pc = EXCLUDED.return_on_investment_sukuk_u_s_151_1a_12_5pc,
        return_on_investment_sukuk_u_s_151_1b_15pc = EXCLUDED.return_on_investment_sukuk_u_s_151_1b_15pc,
        return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a = EXCLUDED.return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a,
        return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a = EXCLUDED.return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a,
        profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc = EXCLUDED.profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc,
        profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a = EXCLUDED.profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a,
        profit_on_debt_u_s_7b = EXCLUDED.profit_on_debt_u_s_7b,
        prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156 = EXCLUDED.prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156,
        bonus_shares_issued_by_companies_u_s_236f = EXCLUDED.bonus_shares_issued_by_companies_u_s_236f,
        employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate = EXCLUDED.employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate,
        salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate = EXCLUDED.salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate,
        subtotal = EXCLUDED.subtotal,
        capital_gain = EXCLUDED.capital_gain,
        grand_total = EXCLUDED.grand_total,
        is_complete = EXCLUDED.is_complete,
        last_updated_by = EXCLUDED.last_updated_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`;
    
    // Execute the upsert with form data
    const values = [
      taxReturnId, userId, userEmail, taxYearId, taxYear,
      // Individual field values
      parseFloat(formData.salary_u_s_12_7 || 0),
      parseFloat(formData.dividend_u_s_150_exempt_profit_rate_mlt_30 || 0),
      parseFloat(formData.dividend_u_s_150_31_atl_15pc || 0),
      parseFloat(formData.dividend_u_s_150_56_10_shares || 0),
      parseFloat(formData.return_on_investment_sukuk_u_s_151_1a_10pc || 0),
      parseFloat(formData.return_on_investment_sukuk_u_s_151_1a_12_5pc || 0),
      parseFloat(formData.return_on_investment_sukuk_u_s_151_1b_15pc || 0),
      parseFloat(formData.return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a || 0),
      parseFloat(formData.return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a || 0),
      parseFloat(formData.profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc || 0),
      parseFloat(formData.profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a || 0),
      parseFloat(formData.profit_on_debt_u_s_7b || 0),
      parseFloat(formData.prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156 || 0),
      parseFloat(formData.bonus_shares_issued_by_companies_u_s_236f || 0),
      parseFloat(formData.employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate || 0),
      parseFloat(formData.salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate || 0),
      // Totals
      parseFloat(formData.subtotal || 0),
      parseFloat(formData.capital_gain || 0),
      parseFloat(formData.grand_total || 0),
      // Meta fields
      formData.isComplete || false,
      userId
    ];
    
    const result = await client.query(upsertQuery, values);
    
    await client.query('COMMIT');
    
    logger.info(`Successfully saved comprehensive income form for user ${userEmail}, tax year ${taxYear}`);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Comprehensive income form saved successfully'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error saving comprehensive income form:', error);
    res.status(500).json({ 
      error: 'Database error',
      message: 'Failed to save comprehensive income form data'
    });
  } finally {
    client.release();
  }
});

module.exports = router;