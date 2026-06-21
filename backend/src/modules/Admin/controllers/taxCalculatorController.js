const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const CalculationService = require('../../../services/calculationService');

const calculateTax = async (req, res) => {
  try {
    const { income, allowances = 0, tax_year = '2025-26', slab_type = 'individual' } = req.body;

    if (!income || income < 0) {
      return res.status(400).json({
        error: 'Valid income amount is required'
      });
    }

    // Get tax slabs for the specified year
    const taxYearResult = await pool.query(
      'SELECT id FROM tax_years WHERE tax_year = $1 AND is_active = true',
      [tax_year]
    );

    if (taxYearResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax year not found or inactive'
      });
    }

    const taxYearId = taxYearResult.rows[0].id;

    // Get tax slabs
    const taxSlabsResult = await pool.query(`
      SELECT min_income, max_income, tax_rate, fixed_amount
      FROM tax_slabs
      WHERE tax_year_id = $1 AND slab_type = $2
      ORDER BY min_income ASC
    `, [taxYearId, slab_type]);

    const taxSlabs = taxSlabsResult.rows;

    if (taxSlabs.length === 0) {
      return res.status(404).json({
        error: 'No tax slabs found for this tax year'
      });
    }

    // Calculate tax via the single source of truth (canonical engine), so the
    // admin calculator never diverges from the filing engine at slab break-points.
    const taxableIncome = Math.max(0, income - allowances);
    const totalTax = CalculationService.calculateProgressiveTax(taxableIncome, taxSlabs);
    const taxBreakdown = [];

    // Per-slab breakdown for the response. Mirror the engine's normalization
    // (effectiveLower = min - 1 for non-zero mins) so each row's taxable_amount
    // and tax_amount stay consistent with totalTax above.
    for (const slab of taxSlabs) {
      const slabMin = parseFloat(slab.min_income);
      const slabMax = slab.max_income ? parseFloat(slab.max_income) : Infinity;
      const taxRate = parseFloat(slab.tax_rate); // Already in decimal form (0.05 for 5%)
      const fixedAmount = parseFloat(slab.fixed_amount || 0);

      const effectiveLower = slabMin > 0 ? slabMin - 1 : 0;
      if (taxableIncome > effectiveLower) {
        const taxableAtThisSlab = Math.min(taxableIncome, slabMax) - effectiveLower;
        const taxAtThisSlab = (taxableAtThisSlab * taxRate) + fixedAmount; // No need to divide by 100

        if (taxableAtThisSlab > 0) {
          taxBreakdown.push({
            range: `${slabMin.toLocaleString()} - ${slabMax === Infinity ? 'Above' : slabMax.toLocaleString()}`,
            rate: `${(taxRate * 100).toFixed(1)}%`, // Convert back to percentage for display
            taxable_amount: taxableAtThisSlab,
            tax_amount: taxAtThisSlab,
            fixed_amount: fixedAmount
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        gross_income: income,
        allowances: allowances,
        taxable_income: taxableIncome,
        total_tax: Math.round(totalTax),
        net_income: Math.round(taxableIncome - totalTax),
        effective_tax_rate: taxableIncome > 0 ? ((totalTax / taxableIncome) * 100).toFixed(2) : 0,
        tax_year: tax_year,
        breakdown: taxBreakdown
      },
      message: 'Tax calculation completed successfully'
    });

  } catch (error) {
    logger.error('Tax calculator error:', error);
    res.status(500).json({
      error: 'Failed to calculate tax',
      message: error.message
    });
  }
};

module.exports = {
  calculateTax,
};
