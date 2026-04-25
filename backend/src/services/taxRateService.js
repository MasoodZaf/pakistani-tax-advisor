/**
 * TaxRateService — single DB-backed entry point for all year-versioned rates.
 *
 * Design:
 *   - Rates live in tax_slabs (slab schedules) and tax_rates_config (everything else).
 *   - All methods take `taxYear` (string, e.g. '2025-26') and fail loudly if rates
 *     are missing for that year. No hardcoded fallbacks — missing data is a config
 *     bug, not something to paper over.
 *   - Each call does one SELECT. Cache-per-request is left to callers (the compute
 *     engine loads everything once at the start of a run).
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');

const FILABLE_YEARS_QUERY = `SELECT id, tax_year, is_current FROM tax_years_filable ORDER BY tax_year DESC`;

class TaxRateService {
  /** Resolve a tax_year string to its UUID, failing loudly if absent. */
  static async resolveTaxYearId(taxYear) {
    const r = await pool.query('SELECT id FROM tax_years WHERE tax_year = $1', [taxYear]);
    if (r.rows.length === 0) throw new Error(`Tax year "${taxYear}" is not configured.`);
    return r.rows[0].id;
  }

  /**
   * List the tax years for which filing is currently permitted (slabs + surcharge
   * + super_tax all seeded). Frontend dropdown queries this — no advance filing.
   */
  static async listFilableYears() {
    const r = await pool.query(FILABLE_YEARS_QUERY);
    return r.rows;
  }

  /**
   * Slab schedule for a given tax year (salaried individual by default).
   * Returns rows with min_income, max_income, tax_rate, fixed_amount.
   */
  static async getSlabs(taxYear, slabType = 'individual') {
    const taxYearId = await this.resolveTaxYearId(taxYear);
    const r = await pool.query(
      `SELECT min_income, max_income, tax_rate, fixed_amount
         FROM tax_slabs
        WHERE tax_year_id = $1 AND slab_type = $2
        ORDER BY slab_order ASC`,
      [taxYearId, slabType]
    );
    if (r.rows.length === 0) {
      throw new Error(`No ${slabType} tax slabs configured for tax year "${taxYear}".`);
    }
    return r.rows;
  }

  /** Single-row rate lookup. Returns { tax_rate, min_amount, max_amount, fixed_amount }. */
  static async getSingleRate(taxYear, rateType, rateCategory) {
    const r = await pool.query(
      `SELECT tax_rate, min_amount, max_amount, fixed_amount
         FROM tax_rates_config
        WHERE tax_year = $1 AND rate_type = $2 AND rate_category = $3 AND is_active = true`,
      [taxYear, rateType, rateCategory]
    );
    if (r.rows.length === 0) {
      throw new Error(
        `Rate "${rateType}/${rateCategory}" not configured for tax year "${taxYear}".`
      );
    }
    return r.rows[0];
  }

  /** Multi-row rate lookup keyed by rate_category. */
  static async getRateSet(taxYear, rateType) {
    const r = await pool.query(
      `SELECT rate_category, tax_rate, min_amount, max_amount, fixed_amount, description
         FROM tax_rates_config
        WHERE tax_year = $1 AND rate_type = $2 AND is_active = true
        ORDER BY rate_category`,
      [taxYear, rateType]
    );
    if (r.rows.length === 0) {
      throw new Error(`No "${rateType}" rates configured for tax year "${taxYear}".`);
    }
    const out = {};
    r.rows.forEach((row) => {
      out[row.rate_category] = {
        rate: parseFloat(row.tax_rate),
        minAmount: parseFloat(row.min_amount),
        maxAmount: parseFloat(row.max_amount),
        fixedAmount: parseFloat(row.fixed_amount),
        description: row.description,
      };
    });
    return out;
  }

  /** Surcharge rate + threshold (FA 2025: 9% over 10M for salaried individuals). */
  static async getSurcharge(taxYear, category = 'salaried_above_10m') {
    const row = await this.getSingleRate(taxYear, 'surcharge', category);
    return {
      rate: parseFloat(row.tax_rate),
      threshold: parseFloat(row.min_amount),
    };
  }

  /** Ordered super-tax tiers (income brackets, flat rate on full taxable income). */
  static async getSuperTaxBrackets(taxYear) {
    const r = await pool.query(
      `SELECT rate_category, tax_rate, min_amount, max_amount
         FROM tax_rates_config
        WHERE tax_year = $1 AND rate_type = 'super_tax' AND is_active = true
        ORDER BY min_amount ASC`,
      [taxYear]
    );
    if (r.rows.length === 0) {
      throw new Error(`No super-tax brackets configured for tax year "${taxYear}".`);
    }
    return r.rows.map((row) => ({
      tier: row.rate_category,
      rate: parseFloat(row.tax_rate),
      minIncome: parseFloat(row.min_amount),
      maxIncome: parseFloat(row.max_amount),
    }));
  }

  /** Calculate super tax: flat rate applied to full taxable income when > 150M. */
  static async calculateSuperTax(taxYear, taxableIncome) {
    if (!taxableIncome || taxableIncome <= 0) return 0;
    const brackets = await this.getSuperTaxBrackets(taxYear);
    for (const b of brackets) {
      if (taxableIncome >= b.minIncome && taxableIncome <= b.maxIncome) {
        return Math.round(taxableIncome * b.rate);
      }
    }
    return 0;
  }

  /** Calculate surcharge for a given tax_year and base normal tax. */
  static async calculateSurcharge(taxYear, normalTax, taxableIncome) {
    if (!normalTax || normalTax <= 0) return 0;
    const { rate, threshold } = await this.getSurcharge(taxYear);
    if (taxableIncome <= threshold) return 0;
    return Math.round(normalTax * rate);
  }

  static async getCreditCaps(taxYear) {
    return this.getRateSet(taxYear, 'credit_cap');
  }

  static async getDeductionThresholds(taxYear) {
    return this.getRateSet(taxYear, 'deduction_threshold');
  }

  static async getReductionRates(taxYear) {
    return this.getRateSet(taxYear, 'reduction');
  }

  static async getFinalTaxRates(taxYear) {
    return this.getRateSet(taxYear, 'final_tax');
  }

  static async getWithholdingRates(taxYear) {
    return this.getRateSet(taxYear, 'withholding');
  }

  /**
   * Back-compat shim. Older callers (adjustable-tax POST handler, income-form
   * auto-link) expect a flat `{ category: rate }` map — that was the shape
   * before TaxRateService was rewritten in Phase B. Returns the same keys
   * but typed as plain numbers so `CalculationService.calculateAdjustableTaxFields`
   * keeps working without a 3-call-site refactor.
   */
  static async getWithholdingTaxRates(taxYear) {
    const full = await this.getRateSet(taxYear, 'withholding');
    const flat = {};
    for (const [k, v] of Object.entries(full)) {
      flat[k] = v.rate;
    }
    return flat;
  }

  static async getCapitalGainsRates(taxYear) {
    return this.getRateSet(taxYear, 'capital_gains');
  }

  /**
   * Load the complete rate set for a tax year in one call. Used by the compute
   * engine so it does ONE burst of DB queries per compute, not one-per-rate.
   */
  static async getAllRates(taxYear) {
    const [slabs, surcharge, superTax, creditCaps, deductionThresholds, reductions, finalTax, withholding, capitalGains] =
      await Promise.all([
        this.getSlabs(taxYear),
        this.getSurcharge(taxYear),
        this.getSuperTaxBrackets(taxYear),
        this.getCreditCaps(taxYear),
        this.getDeductionThresholds(taxYear),
        this.getReductionRates(taxYear),
        this.getFinalTaxRates(taxYear).catch((e) => {
          logger.warn(`final_tax rates missing for ${taxYear}: ${e.message}`);
          return {};
        }),
        this.getWithholdingRates(taxYear).catch((e) => {
          logger.warn(`withholding rates missing for ${taxYear}: ${e.message}`);
          return {};
        }),
        this.getCapitalGainsRates(taxYear).catch((e) => {
          logger.warn(`capital_gains rates missing for ${taxYear}: ${e.message}`);
          return {};
        }),
      ]);

    return {
      taxYear,
      slabs,
      surcharge,
      superTax,
      creditCaps,
      deductionThresholds,
      reductions,
      finalTax,
      withholding,
      capitalGains,
    };
  }

  /** Admin-only: update a single rate value. */
  static async updateRate(taxYear, rateType, rateCategory, newRate, adminUserId) {
    const result = await pool.query(
      `UPDATE tax_rates_config
          SET tax_rate = $1, updated_at = CURRENT_TIMESTAMP
        WHERE tax_year = $2 AND rate_type = $3 AND rate_category = $4
        RETURNING *`,
      [newRate, taxYear, rateType, rateCategory]
    );
    if (result.rows.length === 0) {
      throw new Error(`Rate ${rateType}/${rateCategory} not found for ${taxYear}`);
    }
    logger.info('Tax rate updated', { adminUserId, taxYear, rateType, rateCategory, newRate });
    return result.rows[0];
  }
}

module.exports = TaxRateService;
