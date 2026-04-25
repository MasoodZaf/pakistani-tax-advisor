const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/tax-year/current
 * Returns the current active tax year and the list of years the frontend may
 * offer for filing. "Filable" = rate tables seeded (slabs + surcharge + super
 * tax). Enforces "no advance filing" — years without complete rates are hidden.
 * Public endpoint (used during onboarding before login).
 */
router.get('/current', async (req, res) => {
  try {
    // Filable years intersect tax_years with the rate-completeness view.
    const result = await pool.query(`
      SELECT
        ty.tax_year,
        ty.start_date,
        ty.end_date,
        ty.filing_deadline,
        ty.is_current,
        ty.description
      FROM tax_years ty
      JOIN tax_years_filable f ON f.id = ty.id
      ORDER BY ty.tax_year DESC
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No filable tax years — administrator must seed rate tables'
      });
    }

    const current = result.rows.find((r) => r.is_current);
    if (!current) {
      return res.status(500).json({
        success: false,
        message: 'No tax year is marked as current. Please contact support.'
      });
    }

    res.json({
      success: true,
      currentTaxYear: current.tax_year,
      currentYear: current,
      availableYears: result.rows.map((r) => r.tax_year),
      allYears: result.rows,
    });
  } catch (error) {
    logger.error('Failed to fetch current tax year:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch tax year configuration' });
  }
});

module.exports = router;
