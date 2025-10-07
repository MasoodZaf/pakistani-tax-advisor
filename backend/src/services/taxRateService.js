/**
 * Tax Rate Service - FBR Compliant Tax Rate Management
 * Handles all tax rate operations and FBR compliance
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');

class TaxRateService {
  /**
   * Get all FBR tax rates for a specific tax year
   */
  static async getFBRTaxRates(taxYear = '2025-26') {
    try {
      const query = `
        SELECT
          rate_type,
          rate_category,
          tax_rate,
          fixed_amount,
          min_amount,
          max_amount,
          description
        FROM tax_rates_config
        WHERE tax_year = $1 AND is_active = true
        ORDER BY rate_type, min_amount ASC
      `;

      const result = await pool.query(query, [taxYear]);
      const rates = {};

      // Organize rates by type
      result.rows.forEach(row => {
        if (!rates[row.rate_type]) {
          rates[row.rate_type] = {};
        }

        if (row.rate_type === 'progressive') {
          if (!rates[row.rate_type].slabs) {
            rates[row.rate_type].slabs = [];
          }
          rates[row.rate_type].slabs.push({
            min_amount: parseFloat(row.min_amount),
            max_amount: parseFloat(row.max_amount),
            tax_rate: parseFloat(row.tax_rate),
            fixed_amount: parseFloat(row.fixed_amount),
            description: row.description
          });
        } else {
          rates[row.rate_type][row.rate_category] = parseFloat(row.tax_rate);
        }
      });

      logger.info(`FBR tax rates loaded for ${taxYear}:`, {
        progressive_slabs: rates.progressive?.slabs?.length || 0,
        withholding_rates: Object.keys(rates.withholding || {}).length,
        capital_gains_rates: Object.keys(rates.capital_gains || {}).length
      });

      return rates;
    } catch (error) {
      logger.error('Error fetching FBR tax rates:', error);
      throw error;
    }
  }

  /**
   * Get withholding tax rates specifically for adjustable tax form
   */
  static async getWithholdingTaxRates(taxYear = '2025-26') {
    try {
      const query = `
        SELECT
          rate_category,
          tax_rate,
          description
        FROM tax_rates_config
        WHERE tax_year = $1
          AND rate_type = 'withholding'
          AND is_active = true
        ORDER BY rate_category
      `;

      const result = await pool.query(query, [taxYear]);
      const rates = {};

      result.rows.forEach(row => {
        rates[row.rate_category] = parseFloat(row.tax_rate);
      });

      // Ensure we have all expected withholding tax rates
      const expectedRates = {
        directorship_fee: rates.directorship_fee || 0.20,
        profit_debt_15: rates.profit_debt_15 || 0.15,
        sukook_12_5: rates.sukook_12_5 || 0.125,
        rent_section_155: rates.rent_section_155 || 0.10,
        motor_vehicle_transfer: rates.motor_vehicle_transfer || 0.03,
        electricity_domestic: rates.electricity_domestic || 0.075,
        cellphone_bill: rates.cellphone_bill || 0.15
      };

      logger.info('Withholding tax rates loaded:', expectedRates);
      return expectedRates;
    } catch (error) {
      logger.error('Error fetching withholding tax rates:', error);
      // Return default FBR rates as fallback
      return {
        directorship_fee: 0.20,
        profit_debt_15: 0.15,
        sukook_12_5: 0.125,
        rent_section_155: 0.10,
        motor_vehicle_transfer: 0.03,
        electricity_domestic: 0.075,
        cellphone_bill: 0.15
      };
    }
  }

  /**
   * Get progressive tax rates (slabs) for income tax calculation
   */
  static async getProgressiveTaxRates(taxYear = '2025-26') {
    try {
      const query = `
        SELECT
          min_amount,
          max_amount,
          tax_rate,
          fixed_amount,
          description
        FROM tax_rates_config
        WHERE tax_year = $1
          AND rate_type = 'progressive'
          AND is_active = true
        ORDER BY min_amount ASC
      `;

      const result = await pool.query(query, [taxYear]);
      const progressiveRates = result.rows.map(row => ({
        min_amount: parseFloat(row.min_amount),
        max_amount: parseFloat(row.max_amount),
        tax_rate: parseFloat(row.tax_rate),
        fixed_amount: parseFloat(row.fixed_amount),
        description: row.description
      }));

      logger.info(`Progressive tax rates loaded: ${progressiveRates.length} slabs`);
      return progressiveRates;
    } catch (error) {
      logger.error('Error fetching progressive tax rates:', error);
      // Return default FBR 2025-26 progressive rates as fallback
      return [
        { min_amount: 0, max_amount: 600000, tax_rate: 0.00, fixed_amount: 0 },
        { min_amount: 600001, max_amount: 1200000, tax_rate: 0.01, fixed_amount: 0 },
        { min_amount: 1200001, max_amount: 2400000, tax_rate: 0.11, fixed_amount: 6000 },
        { min_amount: 2400001, max_amount: 3600000, tax_rate: 0.23, fixed_amount: 138000 },
        { min_amount: 3600001, max_amount: 6000000, tax_rate: 0.30, fixed_amount: 414000 },
        { min_amount: 6000001, max_amount: 999999999999, tax_rate: 0.35, fixed_amount: 1134000 }
      ];
    }
  }

  /**
   * Get capital gains tax rates
   */
  static async getCapitalGainsTaxRates(taxYear = '2025-26') {
    try {
      const query = `
        SELECT
          rate_category,
          tax_rate,
          description
        FROM tax_rates_config
        WHERE tax_year = $1
          AND rate_type = 'capital_gains'
          AND is_active = true
        ORDER BY rate_category
      `;

      const result = await pool.query(query, [taxYear]);
      const rates = {};

      result.rows.forEach(row => {
        rates[row.rate_category] = parseFloat(row.tax_rate);
      });

      logger.info('Capital gains tax rates loaded:', Object.keys(rates));
      return rates;
    } catch (error) {
      logger.error('Error fetching capital gains tax rates:', error);
      // Return default rates as fallback
      return {
        property_atl_post_july_2024: 0.15,
        property_non_atl_post_july_2024: 0.25,
        securities_standard: 0.075,
        securities_pmex: 0.05,
        securities_pre_2013: 0.00
      };
    }
  }

  /**
   * Calculate tax based on rate and amount
   */
  static calculateTax(grossAmount, taxRate) {
    try {
      if (!grossAmount || grossAmount <= 0 || !taxRate || taxRate < 0) {
        return 0;
      }

      const tax = Math.round(grossAmount * taxRate);
      logger.debug(`Tax calculation: ${grossAmount} * ${taxRate} = ${tax}`);
      return tax;
    } catch (error) {
      logger.error('Error in tax calculation:', error);
      return 0;
    }
  }

  /**
   * Validate FBR compliance for calculated taxes
   */
  static validateFBRCompliance(calculations, taxRates) {
    const validationResults = {
      isCompliant: true,
      warnings: [],
      errors: []
    };

    try {
      // Check if calculated rates match FBR rates within tolerance (±0.1%)
      const tolerance = 0.001;

      // Validate withholding tax calculations
      if (calculations.directorship_fee_tax && calculations.directorship_fee_gross) {
        const expectedRate = taxRates.directorship_fee || 0.20;
        const actualRate = calculations.directorship_fee_tax / calculations.directorship_fee_gross;

        if (Math.abs(actualRate - expectedRate) > tolerance) {
          validationResults.warnings.push(
            `Directorship fee tax rate (${(actualRate * 100).toFixed(2)}%) differs from FBR rate (${(expectedRate * 100).toFixed(2)}%)`
          );
        }
      }

      // Check progressive tax calculation for reasonableness
      if (calculations.normal_income_tax && calculations.taxable_income) {
        const effectiveRate = calculations.normal_income_tax / calculations.taxable_income;

        if (effectiveRate > 0.35) { // Maximum FBR rate is 35%
          validationResults.errors.push(
            `Effective tax rate (${(effectiveRate * 100).toFixed(2)}%) exceeds maximum FBR rate (35%)`
          );
          validationResults.isCompliant = false;
        }
      }

      logger.info('FBR compliance validation completed', {
        isCompliant: validationResults.isCompliant,
        warnings: validationResults.warnings.length,
        errors: validationResults.errors.length
      });

      return validationResults;
    } catch (error) {
      logger.error('Error in FBR compliance validation:', error);
      return {
        isCompliant: false,
        warnings: [],
        errors: ['Compliance validation failed']
      };
    }
  }

  /**
   * Get surcharge rate based on income and taxpayer type
   */
  static getSurchargeRate(taxableIncome, taxpayerType = 'salaried') {
    try {
      // FBR Finance Act 2024: 9% surcharge for salaried individuals with income > 10M
      if (taxpayerType === 'salaried' && taxableIncome > 10000000) {
        return 0.09;
      }

      return 0;
    } catch (error) {
      logger.error('Error getting surcharge rate:', error);
      return 0;
    }
  }

  /**
   * Update tax rates from FBR notifications (admin function)
   */
  static async updateTaxRate(taxYear, rateType, rateCategory, newRate, adminUserId) {
    try {
      const query = `
        UPDATE tax_rates_config
        SET tax_rate = $1, updated_at = CURRENT_TIMESTAMP
        WHERE tax_year = $2 AND rate_type = $3 AND rate_category = $4
        RETURNING *
      `;

      const result = await pool.query(query, [newRate, taxYear, rateType, rateCategory]);

      if (result.rows.length > 0) {
        // Log the rate change for audit
        logger.info('Tax rate updated by admin', {
          adminUserId,
          taxYear,
          rateType,
          rateCategory,
          newRate,
          oldRate: result.rows[0].tax_rate
        });

        return result.rows[0];
      } else {
        throw new Error('Tax rate not found for update');
      }
    } catch (error) {
      logger.error('Error updating tax rate:', error);
      throw error;
    }
  }
}

module.exports = TaxRateService;