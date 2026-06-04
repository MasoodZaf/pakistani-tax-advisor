/**
 * Tax Computation Routes — backend-owned compute endpoints.
 *
 *   GET  /api/tax-computation/:taxYear                 — run against saved DB data
 *   GET  /api/tax-computation/:taxYear/summary         — full summary (saved data)
 *   POST /api/tax-computation/:taxYear/preview         — compute from unsaved form data
 *   GET  /api/tax-computation/years/filable            — years the frontend may offer
 *   POST /api/tax-computation/:taxYear/update-links    — refresh adjustable-form links
 *
 * All rates are DB-sourced via TaxRateService (year-versioned).
 */

const express = require('express');
const TaxCalculationService = require('../services/taxCalculationService');
const TaxRateService = require('../services/taxRateService');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validate any :taxYear segment up front (SEC-09).
router.param('taxYear', require('../middleware/validation').validateTaxYearParam);

/**
 * GET /api/tax-computation/years/filable
 * Returns the tax years the frontend dropdown may offer. A year is "filable"
 * only if its rate tables (slabs + surcharge + super-tax) are seeded. This
 * enforces "no advance filing" — the dropdown can't show a year the system
 * can't actually compute.
 */
router.get('/years/filable', auth, async (req, res) => {
  try {
    const rows = await TaxRateService.listFilableYears();
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error listing filable years:', error);
    res.status(500).json({ success: false, message: 'Failed to list filable years' });
  }
});

/**
 * GET /api/tax-computation/:taxYear/rates
 * Return the DB-sourced rate set for a tax year. Frontend caches this via the
 * useTaxRates hook and uses it for any display-only presentation of rates
 * (slab labels, cap percentages) — no more hardcoded constants in the UI.
 */
router.get('/:taxYear/rates', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const rates = await TaxRateService.getAllRates(taxYear);
    res.json({ success: true, data: rates });
  } catch (error) {
    logger.error('Failed to load rates:', error);
    const isConfigError = /not configured|No /.test(error?.message || '');
    res.status(isConfigError ? 400 : 500).json({
      success: false,
      message: isConfigError ? error.message : 'Failed to load rates',
    });
  }
});

/**
 * POST /api/tax-computation/:taxYear/preview
 * Compute the tax breakdown from unsaved form data in the request body.
 *
 * Body shape: { inputs: { income, adjustable_tax, capital_gain, reductions,
 *                          credits, deductions } }
 * Each sub-object is a flat map of DB-column-name -> value.
 */
router.post('/:taxYear/preview', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const inputs = (req.body && req.body.inputs) || {};

    const preview = await TaxCalculationService.previewTaxComputation(taxYear, inputs);
    res.json({ success: true, data: preview });
  } catch (error) {
    logger.error('Tax preview failed:', error);
    // Preview is user-facing UX; surface "rates not configured" as 400 for UX,
    // keep real 500s for unexpected problems.
    const isConfigError =
      typeof error?.message === 'string' &&
      (error.message.includes('not configured') || error.message.includes('No '));
    const status = isConfigError ? 400 : 500;
    res.status(status).json({
      success: false,
      message: isConfigError ? error.message : 'Failed to preview tax computation',
    });
  }
});

/**
 * GET /api/tax-computation/:taxYear
 * Get complete tax computation (like Excel Tax Computation sheet)
 * This automatically links data from all forms
 */
router.get('/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    logger.info(`Getting tax computation for user ${userId}, tax year ${taxYear}`);

    const computation = await TaxCalculationService.calculateTaxComputation(userId, taxYear);

    res.json({
      success: true,
      data: computation,
      message: 'Tax computation calculated successfully'
    });

  } catch (error) {
    logger.error('Error getting tax computation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate tax computation',
      error: error.message
    });
  }
});

/**
 * GET /api/tax-computation/:taxYear/summary
 * Get complete tax summary linking all forms (like Excel overview)
 */
router.get('/:taxYear/summary', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    logger.info(`Getting complete tax summary for user ${userId}, tax year ${taxYear}`);

    const summary = await TaxCalculationService.getCompleteTaxSummary(userId, taxYear);

    res.json({
      success: true,
      data: summary,
      message: 'Complete tax summary retrieved successfully'
    });

  } catch (error) {
    logger.error('Error getting tax summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tax summary',
      error: error.message
    });
  }
});

/**
 * POST /api/tax-computation/:taxYear/update-links
 * Update inter-form links (like Excel automatic recalculation)
 */
router.post('/:taxYear/update-links', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    logger.info(`Updating inter-form links for user ${userId}, tax year ${taxYear}`);

    await TaxCalculationService.updateAdjustableFormWithLinks(userId, taxYear);

    res.json({
      success: true,
      message: 'Inter-form links updated successfully'
    });

  } catch (error) {
    logger.error('Error updating inter-form links:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inter-form links',
      error: error.message
    });
  }
});

/**
 * GET /api/tax-computation/:taxYear/income-data
 * Get income form data with Excel cell references
 */
router.get('/:taxYear/income-data', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    const incomeData = await TaxCalculationService.getIncomeFormData(userId, taxYear);

    if (!incomeData) {
      return res.status(404).json({
        success: false,
        message: 'Income form data not found'
      });
    }

    res.json({
      success: true,
      data: incomeData,
      message: 'Income form data retrieved successfully',
      excelReferences: {
        'B15': incomeData.b15_income_exempt_from_tax,
        'B16': incomeData.b16_annual_salary_wages_total,
        'B22': incomeData.b22_non_cash_benefit_exempt,
        'B23': incomeData.b23_total_non_cash_benefits,
        'B28': incomeData.b28_other_income_min_tax_total,
        'B33': incomeData.b33_other_income_no_min_tax_total
      }
    });

  } catch (error) {
    logger.error('Error getting income data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get income data',
      error: error.message
    });
  }
});

/**
 * GET /api/tax-computation/:taxYear/adjustable-data
 * Get adjustable tax data with automatic linking to income sheet
 */
router.get('/:taxYear/adjustable-data', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    const adjustableData = await TaxCalculationService.getAdjustableFormData(userId, taxYear);

    res.json({
      success: true,
      data: adjustableData,
      message: 'Adjustable tax data retrieved with income sheet links',
      excelLinks: {
        'B5': 'Income!B16 (Salary)',
        'B6': 'Income!B13 (Directorship Fee)',
        'B7': 'Income!B26 (Profit on Debt 15%)',
        'B8': 'Income!B27 (Profit on Debt 12.5%)',
        'B9': 'Income!B31 (Rent Income)'
      }
    });

  } catch (error) {
    logger.error('Error getting adjustable tax data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get adjustable tax data',
      error: error.message
    });
  }
});

module.exports = router;