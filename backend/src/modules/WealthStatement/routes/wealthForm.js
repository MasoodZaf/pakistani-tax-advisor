const express = require('express');
const { pool } = require('../../../config/database');
const auth = require('../../../middleware/auth');
const logger = require('../../../utils/logger');

const router = express.Router();

// GET /api/wealth-statement/form/:taxYear - Get wealth statement form data
router.get('/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    logger.info(`Fetching wealth statement for user ${userId}, tax year ${taxYear}`);

    const result = await pool.query(
      `SELECT * FROM wealth_statement_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );

    if (result.rows.length === 0) {
      logger.info(`No wealth statement found for user ${userId}, tax year ${taxYear}`);
      return res.status(404).json({
        success: false,
        message: 'No wealth statement data found'
      });
    }

    const wealthStatement = result.rows[0];
    logger.info(`Wealth statement retrieved for user ${userId}, tax year ${taxYear}`);

    res.json({
      success: true,
      wealthStatement: wealthStatement
    });

  } catch (error) {
    logger.error('Error fetching wealth statement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wealth statement',
      error: error.message
    });
  }
});

// POST /api/wealth-statement/form/:taxYear - Create or update wealth statement
router.post('/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;
    const userEmail = req.user.email;
    const formData = req.body;

    logger.info(`Saving wealth statement for user ${userId}, tax year ${taxYear}`);

    // Get tax year ID
    const taxYearResult = await pool.query(
      `SELECT id FROM tax_years WHERE tax_year = $1`,
      [taxYear]
    );

    if (taxYearResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tax year not found'
      });
    }

    const taxYearId = taxYearResult.rows[0].id;

    // Get or create tax return
    let taxReturnResult = await pool.query(
      `SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year_id = $2`,
      [userId, taxYearId]
    );

    let taxReturnId;
    if (taxReturnResult.rows.length === 0) {
      const newReturn = await pool.query(
        `INSERT INTO tax_returns (user_id, user_email, tax_year_id, tax_year, filing_status, return_number)
         VALUES ($1, $2, $3, $4, 'draft', $5) RETURNING id`,
        [userId, userEmail, taxYearId, taxYear, `TR-${userId.substring(0, 8)}-${taxYear}`]
      );
      taxReturnId = newReturn.rows[0].id;
    } else {
      taxReturnId = taxReturnResult.rows[0].id;
    }

    // Check if wealth statement exists
    const existingResult = await pool.query(
      `SELECT id FROM wealth_statement_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );

    let result;
    if (existingResult.rows.length > 0) {
      // Update existing
      result = await pool.query(
        `UPDATE wealth_statement_forms SET
          commercial_property_prev = $1,
          investments_prev = $2,
          motor_vehicles_prev = $3,
          precious_possessions_prev = $4,
          cash_prev = $5,
          other_assets_prev = $6,
          personal_liabilities_prev = $7,
          commercial_property_curr = $8,
          investments_curr = $9,
          motor_vehicles_curr = $10,
          precious_possessions_curr = $11,
          cash_curr = $12,
          other_assets_curr = $13,
          personal_liabilities_curr = $14,
          updated_at = NOW()
         WHERE user_id = $15 AND tax_year = $16
         RETURNING *`,
        [
          formData.commercial_property_prev || 0,
          formData.investments_prev || 0,
          formData.motor_vehicles_prev || 0,
          formData.precious_possessions_prev || 0,
          formData.cash_prev || 0,
          formData.other_assets_prev || 0,
          formData.personal_liabilities_prev || 0,
          formData.commercial_property_curr || 0,
          formData.investments_curr || 0,
          formData.motor_vehicles_curr || 0,
          formData.precious_possessions_curr || 0,
          formData.cash_curr || 0,
          formData.other_assets_curr || 0,
          formData.personal_liabilities_curr || 0,
          userId,
          taxYear
        ]
      );
    } else {
      // Insert new
      result = await pool.query(
        `INSERT INTO wealth_statement_forms (
          tax_return_id, user_id, user_email, tax_year_id, tax_year,
          commercial_property_prev, investments_prev, motor_vehicles_prev,
          precious_possessions_prev, cash_prev, other_assets_prev, personal_liabilities_prev,
          commercial_property_curr, investments_curr, motor_vehicles_curr,
          precious_possessions_curr, cash_curr, other_assets_curr, personal_liabilities_curr
         ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19
         ) RETURNING *`,
        [
          taxReturnId, userId, userEmail, taxYearId, taxYear,
          formData.commercial_property_prev || 0,
          formData.investments_prev || 0,
          formData.motor_vehicles_prev || 0,
          formData.precious_possessions_prev || 0,
          formData.cash_prev || 0,
          formData.other_assets_prev || 0,
          formData.personal_liabilities_prev || 0,
          formData.commercial_property_curr || 0,
          formData.investments_curr || 0,
          formData.motor_vehicles_curr || 0,
          formData.precious_possessions_curr || 0,
          formData.cash_curr || 0,
          formData.other_assets_curr || 0,
          formData.personal_liabilities_curr || 0
        ]
      );
    }

    logger.info(`Wealth statement saved for user ${userId}, tax year ${taxYear}`);

    res.json({
      success: true,
      message: 'Wealth statement saved successfully',
      wealthStatement: result.rows[0]
    });

  } catch (error) {
    logger.error('Error saving wealth statement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save wealth statement',
      error: error.message
    });
  }
});

module.exports = router;
