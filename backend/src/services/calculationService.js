/**
 * Calculation Service - Excel Formula Implementation
 * Implements all Excel formulas from the official FBR template
 * Based on XlCal.md documentation
 */

const logger = require('../utils/logger');

class CalculationService {
  /**
   * Calculate Income Form Excel formulas (Sheet 2)
   */
  static calculateIncomeFormFields(data) {
    try {
      const calculations = {};

      // Data validation and sanitization
      const sanitizeNumber = (value) => {
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : Math.max(0, parsed); // No negative values
        }
        if (typeof value === 'number') {
          return isNaN(value) ? 0 : Math.max(0, value); // No negative values
        }
        return 0;
      };

      // Monthly to Annual Conversions (Excel formulas B6, B7, B8, etc.)
      calculations.annual_basic_salary = sanitizeNumber(data.monthly_basic_salary) * 12;
      calculations.annual_allowances = sanitizeNumber(data.monthly_allowances) * 12;
      calculations.annual_house_rent_allowance = sanitizeNumber(data.monthly_house_rent_allowance) * 12;
      calculations.annual_conveyance_allowance = sanitizeNumber(data.monthly_conveyance_allowance) * 12;

      // Medical allowance capped at 120,000 per year
      const annual_medical_allowance = sanitizeNumber(data.monthly_medical_allowance) * 12;
      calculations.annual_medical_allowance = Math.min(annual_medical_allowance, 120000);

      // Other annual amounts (direct input)
      calculations.directorship_fee = sanitizeNumber(data.directorship_fee);
      calculations.bonus_commission = sanitizeNumber(data.bonus_commission);
      calculations.retirement_amount = sanitizeNumber(data.retirement_amount);
      calculations.employment_termination_payment = sanitizeNumber(data.employment_termination_payment);
      calculations.medical_allowance_exempt = Math.min(calculations.annual_medical_allowance, 120000);

      // Excel Formula B15: -(B12+B11+B9) = Income Exempt from Tax
      calculations.income_exempt_from_tax = -(
        calculations.medical_allowance_exempt +
        calculations.employment_termination_payment +
        calculations.retirement_amount
      );

      // Excel Formula B16: SUM(B6:B15) = Annual Salary and Wages Total
      calculations.annual_salary_wages_total =
        calculations.annual_basic_salary +
        (calculations.annual_allowances || data.annual_allowances || 0) +
        calculations.annual_house_rent_allowance +
        calculations.annual_conveyance_allowance +
        calculations.annual_medical_allowance +
        calculations.directorship_fee +
        calculations.bonus_commission +
        calculations.retirement_amount +
        calculations.employment_termination_payment +
        calculations.income_exempt_from_tax;

      // Non-cash benefits calculations
      calculations.noncash_benefits_gross = data.noncash_benefits_gross || 0;
      calculations.provident_fund_contribution = data.provident_fund_contribution || 0;
      calculations.gratuity = data.gratuity || 0;

      // Excel Formula B22: -(MIN(B19,150000)) = Provident Fund Exemption
      calculations.provident_exemption = -Math.min(calculations.provident_fund_contribution, 150000);

      // Excel Formula B23: SUM(B19:B22) = Total Non-Cash Benefits
      calculations.total_noncash_benefits =
        calculations.noncash_benefits_gross +
        calculations.provident_fund_contribution +
        calculations.gratuity +
        calculations.provident_exemption;

      // Other income calculations
      calculations.profit_debt_15_percent = data.profit_debt_15_percent || 0;
      calculations.profit_debt_12_5_percent = data.profit_debt_12_5_percent || 0;

      // Excel Formula B28: B26+B27 = Other Income Min Tax Total
      calculations.other_income_min_tax_total =
        calculations.profit_debt_15_percent +
        calculations.profit_debt_12_5_percent;

      calculations.rent_income = data.rent_income || 0;
      calculations.other_income = data.other_income || 0;

      // Excel Formula B33: B31+B32 = Other Income No Min Tax Total
      calculations.other_income_no_min_tax_total =
        calculations.rent_income +
        calculations.other_income;

      // Total Employment Income calculation
      calculations.total_employment_income =
        calculations.annual_salary_wages_total +
        calculations.total_noncash_benefits;

      logger.info('Income form calculations completed', {
        annual_basic_salary: calculations.annual_basic_salary,
        total_employment_income: calculations.total_employment_income,
        annual_salary_wages_total: calculations.annual_salary_wages_total
      });

      return calculations;
    } catch (error) {
      logger.error('Error in income form calculations:', error);
      throw error;
    }
  }

  /**
   * Calculate Adjustable Tax Form Excel formulas (Sheet 3)
   */
  static calculateAdjustableTaxFields(data, taxRates = {}) {
    try {
      const calculations = {};

      // Get gross receipt amounts
      const directorshipGross = data.directorship_fee_149_3_gross_receipt || 0;
      const profitDebt15Gross = data.profit_debt_15_percent_gross_receipt || 0;
      const sukookGross = data.sukook_12_5_percent_gross_receipt || 0;
      const rentGross = data.rent_section_155_gross_receipt || 0;
      const motorVehicleGross = data.motor_vehicle_transfer_gross_receipt || 0;
      const electricityGross = data.electricity_domestic_gross_receipt || 0;
      const cellphoneGross = data.cellphone_bill_gross_receipt || 0;

      // Excel Formula C6: B6*20% = Directorship Fee Tax
      calculations.directorship_fee_149_3_tax_collected =
        Math.round(directorshipGross * (taxRates.directorship_fee || 0.20));

      // Excel Formula C7: B7*15% = Profit on Debt Tax (15%)
      calculations.profit_debt_15_percent_tax_collected =
        Math.round(profitDebt15Gross * (taxRates.profit_debt_15 || 0.15));

      // Excel Formula C8: B8*12.5% = Sukook Tax
      calculations.sukook_12_5_percent_tax_collected =
        Math.round(sukookGross * (taxRates.sukook_12_5 || 0.125));

      // Excel Formula C9: B9*10% = Rent Tax
      calculations.rent_section_155_tax_collected =
        Math.round(rentGross * (taxRates.rent_section_155 || 0.10));

      // Excel Formula C12: B12*3% = Motor Vehicle Transfer Tax
      calculations.motor_vehicle_transfer_tax_collected =
        Math.round(motorVehicleGross * (taxRates.motor_vehicle_transfer || 0.03));

      // Excel Formula C15: B15*7.5% = Electricity Bill Tax
      calculations.electricity_domestic_tax_collected =
        Math.round(electricityGross * (taxRates.electricity_domestic || 0.075));

      // Excel Formula C17: B17*15% = Cellphone Bill Tax
      calculations.cellphone_bill_tax_collected =
        Math.round(cellphoneGross * (taxRates.cellphone_bill || 0.15));

      // Excel Formula B32: SUM of all gross receipts
      calculations.total_gross_receipt =
        directorshipGross +
        profitDebt15Gross +
        sukookGross +
        rentGross +
        motorVehicleGross +
        electricityGross +
        cellphoneGross;

      // Excel Formula C32: SUM of all tax amounts
      calculations.total_tax_collected =
        calculations.directorship_fee_149_3_tax_collected +
        calculations.profit_debt_15_percent_tax_collected +
        calculations.sukook_12_5_percent_tax_collected +
        calculations.rent_section_155_tax_collected +
        calculations.motor_vehicle_transfer_tax_collected +
        calculations.electricity_domestic_tax_collected +
        calculations.cellphone_bill_tax_collected;

      logger.info('Adjustable tax calculations completed', {
        total_gross_receipt: calculations.total_gross_receipt,
        total_tax_collected: calculations.total_tax_collected,
        directorship_tax: calculations.directorship_fee_149_3_tax_collected
      });

      return calculations;
    } catch (error) {
      logger.error('Error in adjustable tax calculations:', error);
      throw error;
    }
  }

  /**
   * Calculate Progressive Tax (cumulative method) from DB-sourced slabs.
   * Slab rows are expected to match `tax_slabs` columns: min_income, max_income, tax_rate.
   * max_income may be null/undefined for the open-ended top slab.
   * Boundary rule: a slab applies to income STRICTLY greater than min_income
   * (so income exactly equal to a slab boundary sits in the lower slab).
   */
  static calculateProgressiveTax(taxableIncome, progressiveTaxRates) {
    try {
      if (!progressiveTaxRates || progressiveTaxRates.length === 0 || !taxableIncome || taxableIncome <= 0) {
        return 0;
      }

      const toNum = (v) => (v === null || v === undefined ? null : Number(v));
      const sortedRates = progressiveTaxRates
        .slice()
        .sort((a, b) => toNum(a.min_income) - toNum(b.min_income));

      let totalTax = 0;
      for (const slab of sortedRates) {
        const minIncome = toNum(slab.min_income);
        const maxIncome = toNum(slab.max_income); // null → open-ended top slab
        const rate = toNum(slab.tax_rate);

        // DB seeds min_income as "starts-at" (e.g. 600,001), while the FBR semantic
        // treats the break-point (600,000) as the exclusive lower bound of the next
        // slab. Normalize: effectiveLower = min - 1 for non-zero mins.
        const effectiveLower = minIncome > 0 ? minIncome - 1 : 0;
        if (taxableIncome <= effectiveLower) continue;
        const ceiling = maxIncome === null ? taxableIncome : Math.min(taxableIncome, maxIncome);
        const taxableAtThisSlab = ceiling - effectiveLower;
        if (taxableAtThisSlab > 0 && rate > 0) {
          totalTax += taxableAtThisSlab * rate;
        }
      }
      return Math.round(totalTax);
    } catch (error) {
      logger.error('Error in progressive tax calculation:', error);
      throw error;
    }
  }

  /**
   * Fetch the salaried-individual slab set for a given tax_year_id from DB.
   * Callers should pass this to calculateProgressiveTax.
   */
  static async getSlabsForTaxYear(pool, taxYearId, slabType = 'individual') {
    const r = await pool.query(
      `SELECT min_income, max_income, tax_rate, fixed_amount
       FROM tax_slabs
       WHERE tax_year_id = $1 AND slab_type = $2
       ORDER BY slab_order ASC`,
      [taxYearId, slabType]
    );
    if (r.rows.length === 0) {
      throw new Error(`No ${slabType} tax slabs configured for tax_year_id ${taxYearId}`);
    }
    return r.rows;
  }

  /**
   * Super Tax u/s 4C, ITO 2001 (Finance Act 2025)
   * Charged on persons with income exceeding Rs 150M.
   * Flat rate applied on TOTAL income (not just the marginal excess).
   * Division IIA of Part I of the First Schedule.
   */
  static calculateSuperTax(income) {
    if (!income || income <= 150000000) return 0;
    const slabs = [
      { max: 200000000, rate: 0.01 },
      { max: 250000000, rate: 0.02 },
      { max: 300000000, rate: 0.03 },
      { max: 350000000, rate: 0.04 },
      { max: 400000000, rate: 0.06 },
      { max: 500000000, rate: 0.08 },
      { max: Infinity,  rate: 0.10 },
    ];
    for (const slab of slabs) {
      if (income <= slab.max) return Math.round(income * slab.rate);
    }
    return 0;
  }

  /**
   * Validate calculation results
   */
  static validateCalculations(calculations, expectedRanges = {}) {
    const validationErrors = [];

    try {
      // Check for negative values where they shouldn't be
      const nonNegativeFields = [
        'annual_basic_salary',
        'total_employment_income',
        'total_tax_collected',
        'normal_income_tax'
      ];

      nonNegativeFields.forEach(field => {
        if (calculations[field] && calculations[field] < 0) {
          validationErrors.push(`${field} cannot be negative: ${calculations[field]}`);
        }
      });

      // Check for extremely large values (likely calculation errors)
      Object.entries(calculations).forEach(([field, value]) => {
        if (typeof value === 'number' && value > 1000000000) { // 1 billion
          validationErrors.push(`${field} seems too large: ${value}`);
        }
      });

      if (validationErrors.length > 0) {
        logger.warn('Calculation validation warnings:', validationErrors);
      }

      return {
        isValid: validationErrors.length === 0,
        errors: validationErrors
      };
    } catch (error) {
      logger.error('Error in calculation validation:', error);
      return {
        isValid: false,
        errors: ['Validation process failed']
      };
    }
  }
}

module.exports = CalculationService;