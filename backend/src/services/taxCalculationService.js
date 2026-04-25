/**
 * Tax Calculation Service — orchestrates cross-form computation.
 *
 * All rates come from DB via TaxRateService (year-versioned, no hardcoded fallbacks).
 * Pure-math primitives live in CalculationService.
 *
 * Two entry points:
 *   - calculateTaxComputation(userId, taxYear)   — reads saved form data from DB
 *   - previewTaxComputation(userId, taxYear, in) — same math, but input comes from
 *                                                  unsaved form data (for UI preview)
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');
const CalculationService = require('./calculationService');
const TaxRateService = require('./taxRateService');

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

class TaxCalculationService {
  // Kept for backwards-compatibility with routes that call it directly.
  static async resolveTaxYearId(taxYear) {
    return TaxRateService.resolveTaxYearId(taxYear);
  }

  // ──────── DB-backed form reads ────────

  static async getIncomeFormData(userId, taxYear) {
    const result = await pool.query(
      `SELECT
        annual_basic_salary, allowances, bonus, medical_allowance,
        pension_from_ex_employer, employment_termination_payment,
        retirement_from_approved_funds, directorship_fee,
        other_cash_benefits, employer_contribution_provident,
        taxable_car_value, other_taxable_subsidies,
        profit_on_debt_15_percent, profit_on_debt_12_5_percent,
        other_taxable_income_rent, other_taxable_income_others,
        income_exempt_from_tax           AS b15_income_exempt_from_tax,
        annual_salary_wages_total        AS b16_annual_salary_wages_total,
        non_cash_benefit_exempt          AS b22_non_cash_benefit_exempt,
        total_non_cash_benefits          AS b23_total_non_cash_benefits,
        other_income_min_tax_total       AS b28_other_income_min_tax_total,
        other_income_no_min_tax_total    AS b33_other_income_no_min_tax_total,
        total_employment_income,
        updated_at
      FROM income_forms
      WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    return result.rows[0] || null;
  }

  static async getAdjustableFormData(userId, taxYear) {
    const incomeData = await this.getIncomeFormData(userId, taxYear);

    const result = await pool.query(
      `SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    const adjustableData = result.rows[0] || {};

    // Inter-form linking from income_forms (Excel cross-sheet references).
    if (incomeData) {
      adjustableData.salary_employees_149_gross_receipt = incomeData.b16_annual_salary_wages_total;
      adjustableData.directorship_fee_149_3_gross_receipt = incomeData.directorship_fee;
      adjustableData.profit_debt_15_percent_gross_receipt = incomeData.profit_on_debt_15_percent;
      adjustableData.sukook_12_5_percent_gross_receipt = incomeData.profit_on_debt_12_5_percent;
      adjustableData.rent_section_155_gross_receipt = incomeData.other_taxable_income_rent;
    }
    return adjustableData;
  }

  static async getCapitalGainsData(userId, taxYear) {
    const result = await pool.query(
      `SELECT * FROM capital_gain_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    return result.rows[0] || null;
  }

  static async getReductionsData(userId, taxYear) {
    const r = await pool.query(
      `SELECT * FROM reductions_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    return r.rows[0] || null;
  }

  static async getCreditsData(userId, taxYear) {
    const r = await pool.query(
      `SELECT * FROM credits_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    return r.rows[0] || null;
  }

  static async getDeductionsData(userId, taxYear) {
    const r = await pool.query(
      `SELECT * FROM deductions_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    return r.rows[0] || null;
  }

  // ──────── Core compute ────────

  /**
   * Run the full tax computation for a user + tax_year using DB-stored inputs.
   * Returns the structured breakdown the frontend renders.
   */
  static async calculateTaxComputation(userId, taxYear) {
    logger.info(`Tax computation run: user=${userId} year=${taxYear}`);

    const [incomeData, adjustableData, capitalGainsData, reductionsData, creditsData, deductionsData, rates] =
      await Promise.all([
        this.getIncomeFormData(userId, taxYear),
        this.getAdjustableFormData(userId, taxYear),
        this.getCapitalGainsData(userId, taxYear),
        this.getReductionsData(userId, taxYear),
        this.getCreditsData(userId, taxYear),
        this.getDeductionsData(userId, taxYear),
        TaxRateService.getAllRates(taxYear),
      ]);

    if (!incomeData) {
      throw new Error('Income form data not found — required for tax computation');
    }

    return this._computeFromInputs({
      incomeData,
      adjustableData,
      capitalGainsData,
      reductionsData,
      creditsData,
      deductionsData,
      rates,
      taxYear,
    });
  }

  /**
   * Preview: same math, but caller provides in-flight (unsaved) form values.
   * The frontend uses this to render the computation summary live as the user types.
   * `inputs` is shaped like { income, adjustable_tax, capital_gain, reductions,
   * credits, deductions, final_min_income, final_tax } — each a plain object of
   * field -> value (the same shape saved to the DB).
   */
  static async previewTaxComputation(taxYear, inputs = {}) {
    const rates = await TaxRateService.getAllRates(taxYear);

    const incomeData = inputs.income || {};
    const adjustableData = inputs.adjustable_tax || {};
    const capitalGainsData = inputs.capital_gain || {};
    const reductionsData = inputs.reductions || {};
    const creditsData = inputs.credits || {};
    const deductionsData = inputs.deductions || {};

    // Normalize: preview inputs use snake_case DB names directly; derive the
    // bN_* aliases the compute function expects, matching getIncomeFormData.
    const incomeWithAliases = {
      ...incomeData,
      b15_income_exempt_from_tax: incomeData.income_exempt_from_tax,
      b16_annual_salary_wages_total: incomeData.annual_salary_wages_total,
      b22_non_cash_benefit_exempt: incomeData.non_cash_benefit_exempt,
      b23_total_non_cash_benefits: incomeData.total_non_cash_benefits,
      b28_other_income_min_tax_total: incomeData.other_income_min_tax_total,
      b33_other_income_no_min_tax_total: incomeData.other_income_no_min_tax_total,
    };

    return this._computeFromInputs({
      incomeData: incomeWithAliases,
      adjustableData,
      capitalGainsData,
      reductionsData,
      creditsData,
      deductionsData,
      rates,
      taxYear,
      preview: true,
    });
  }

  /**
   * Pure function: takes all inputs + rates, returns the breakdown.
   * Does NOT touch DB. Callable from both the saved-run and preview paths.
   */
  static _computeFromInputs({
    incomeData,
    adjustableData,
    capitalGainsData,
    reductionsData,
    creditsData,
    deductionsData,
    rates,
    taxYear,
    preview = false,
  }) {
    // ── Income buckets ──
    const incomeFromSalary =
      toNum(incomeData?.b16_annual_salary_wages_total) + toNum(incomeData?.b23_total_non_cash_benefits);
    const incomeFromOtherSources =
      toNum(incomeData?.b28_other_income_min_tax_total) + toNum(incomeData?.b33_other_income_no_min_tax_total);
    const incomeFromCapitalGains = toNum(capitalGainsData?.total_capital_gain);

    const totalIncome = incomeFromSalary + incomeFromOtherSources + incomeFromCapitalGains;

    // ── Deductible allowances ──
    // DB-computed column `total_deduction_from_income` / `total_deductions`
    // already sums zakat + ushr + professional expenses + education + other.
    // Read that if present; otherwise fall back to individual components.
    const deductibleAllowances =
      toNum(deductionsData?.total_deduction_from_income) ||
      toNum(deductionsData?.total_deductions) ||
      (toNum(deductionsData?.zakat_paid_amount) +
       toNum(deductionsData?.zakat) +
       toNum(deductionsData?.ushr) +
       toNum(deductionsData?.professional_expenses_amount) +
       toNum(deductionsData?.educational_expenses_amount) +
       toNum(deductionsData?.other_deductions));

    const taxableIncomeExcludingCG = Math.max(0, totalIncome - incomeFromCapitalGains - deductibleAllowances);
    const taxableIncomeIncludingCG = taxableIncomeExcludingCG + incomeFromCapitalGains;

    // ── Progressive normal tax ──
    const normalIncomeTax = CalculationService.calculateProgressiveTax(
      taxableIncomeExcludingCG,
      rates.slabs
    );

    // ── Surcharge: DB-driven rate + threshold ──
    let surcharge = 0;
    if (taxableIncomeExcludingCG > rates.surcharge.threshold) {
      surcharge = Math.round(normalIncomeTax * rates.surcharge.rate);
    }

    // ── CGT: use the per-form computed value (CGT rules vary by asset class) ──
    const capitalGainsTax = toNum(capitalGainsData?.total_capital_gain_tax);

    const totalTaxBeforeAdjustments = normalIncomeTax + surcharge + capitalGainsTax;

    // ── Reductions (teacher, Behbood, immovable-property ex-serv) ──
    const totalReductions =
      toNum(reductionsData?.total_tax_reductions) ||
      toNum(reductionsData?.total_reductions) ||
      0;

    // ── Credits (donations, pension). Keep as-is if the form has totaled them. ──
    const totalCredits = toNum(creditsData?.total_tax_credits) || toNum(creditsData?.total_credits) || 0;

    const netTaxPayable = Math.max(0, totalTaxBeforeAdjustments - totalReductions - totalCredits);

    // ── Super tax u/s 4C (DB-driven brackets) ──
    const superTax = (() => {
      const income = taxableIncomeIncludingCG;
      if (income <= 0) return 0;
      for (const b of rates.superTax) {
        if (income >= b.minIncome && income <= b.maxIncome) {
          return Math.round(income * b.rate);
        }
      }
      return 0;
    })();

    const totalTaxChargeable = netTaxPayable + superTax;

    // ── Advance / withholding tax paid ──
    const withholdingTax = toNum(adjustableData?.total_tax_collected) || toNum(adjustableData?.total_adjustable_tax);
    const advanceTax = toNum(adjustableData?.advance_tax_u_s_147);
    const balancePayableRefundable = totalTaxChargeable - withholdingTax - advanceTax;

    const breakdown = {
      taxYear,
      preview,
      income: {
        incomeFromSalary,
        incomeFromOtherSources,
        incomeFromCapitalGains,
        totalIncome,
        deductibleAllowances,
        taxableIncomeExcludingCG,
        taxableIncomeIncludingCG,
      },
      tax: {
        normalIncomeTax,
        surcharge,
        capitalGainsTax,
        totalTaxBeforeAdjustments,
        totalReductions,
        totalCredits,
        netTaxPayable,
        superTax,
        totalTaxChargeable,
      },
      payments: {
        withholdingTax,
        advanceTax,
        balancePayableRefundable,
      },
      rates: {
        surchargeRate: rates.surcharge.rate,
        surchargeThreshold: rates.surcharge.threshold,
        slabCount: rates.slabs.length,
      },
    };

    logger.info('Tax computation produced', {
      taxYear,
      preview,
      totalIncome,
      normalIncomeTax,
      netTaxPayable,
      superTax,
      balancePayableRefundable,
    });

    return breakdown;
  }

  // ──────── Legacy methods kept for old route compatibility ────────

  /**
   * Mirror adjustable_tax_forms with values linked from income_forms.
   * Wraps ensureTaxReturn via the common helper.
   */
  static async updateAdjustableFormWithLinks(userId, taxYear) {
    const incomeData = await this.getIncomeFormData(userId, taxYear);
    if (!incomeData) {
      logger.warn('No income data found for adjustable tax linking', { userId, taxYear });
      return;
    }

    const taxYearId = await TaxRateService.resolveTaxYearId(taxYear);
    const userRow = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const userEmail = userRow.rows[0]?.email || null;

    await pool.query(
      `INSERT INTO adjustable_tax_forms (
         user_id, user_email, tax_year, tax_year_id,
         salary_employees_149_gross_receipt,
         directorship_fee_149_3_gross_receipt,
         profit_debt_15_percent_gross_receipt,
         sukook_12_5_percent_gross_receipt,
         rent_section_155_gross_receipt
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, tax_year) DO UPDATE SET
         salary_employees_149_gross_receipt   = EXCLUDED.salary_employees_149_gross_receipt,
         directorship_fee_149_3_gross_receipt = EXCLUDED.directorship_fee_149_3_gross_receipt,
         profit_debt_15_percent_gross_receipt = EXCLUDED.profit_debt_15_percent_gross_receipt,
         sukook_12_5_percent_gross_receipt    = EXCLUDED.sukook_12_5_percent_gross_receipt,
         rent_section_155_gross_receipt       = EXCLUDED.rent_section_155_gross_receipt,
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        userEmail,
        taxYear,
        taxYearId,
        incomeData.b16_annual_salary_wages_total || 0,
        incomeData.directorship_fee || 0,
        incomeData.profit_on_debt_15_percent || 0,
        incomeData.profit_on_debt_12_5_percent || 0,
        incomeData.other_taxable_income_rent || 0,
      ]
    );
  }

  static async getCompleteTaxSummary(userId, taxYear) {
    const [incomeData, adjustableData, capitalGainsData, taxComputation] = await Promise.all([
      this.getIncomeFormData(userId, taxYear),
      this.getAdjustableFormData(userId, taxYear),
      this.getCapitalGainsData(userId, taxYear),
      this.calculateTaxComputation(userId, taxYear),
    ]);

    return {
      userId,
      taxYear,
      incomeData,
      adjustableData,
      capitalGainsData,
      taxComputation,
      summary: {
        totalIncome: taxComputation.income.totalIncome,
        totalTax: taxComputation.tax.totalTaxChargeable,
        withholdingTax: taxComputation.payments.withholdingTax,
        balanceDue: taxComputation.payments.balancePayableRefundable,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

module.exports = TaxCalculationService;
