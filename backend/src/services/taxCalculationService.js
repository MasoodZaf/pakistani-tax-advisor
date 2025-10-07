/**
 * Tax Calculation Service - Inter-Form Data Linking
 * Replicates Excel sheet references like =Income!B16, =Capital Gain!E19
 * This service handles automatic data flow between forms exactly like Excel
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');

class TaxCalculationService {
  
  /**
   * Get Income Form Data (Excel "Income" sheet)
   * This replicates all the calculated fields from Excel Income sheet
   */
  static async getIncomeFormData(userId, taxYear) {
    try {
      const result = await pool.query(`
        SELECT 
          -- Input fields
          annual_basic_salary,
          allowances,
          bonus,
          medical_allowance,
          pension_from_ex_employer,
          employment_termination_payment,
          retirement_from_approved_funds,
          directorship_fee,
          other_cash_benefits,
          employer_contribution_provident,
          taxable_car_value,
          other_taxable_subsidies,
          profit_on_debt_15_percent,
          profit_on_debt_12_5_percent,
          other_taxable_income_rent,
          other_taxable_income_others,
          
          -- Excel calculated fields (auto-calculated by database)
          income_exempt_from_tax as b15_income_exempt_from_tax,
          annual_salary_wages_total as b16_annual_salary_wages_total,
          non_cash_benefit_exempt as b22_non_cash_benefit_exempt,
          total_non_cash_benefits as b23_total_non_cash_benefits,
          other_income_min_tax_total as b28_other_income_min_tax_total,
          other_income_no_min_tax_total as b33_other_income_no_min_tax_total,
          total_employment_income,
          
          updated_at
        FROM income_forms 
        WHERE user_id = $1 AND tax_year = $2
      `, [userId, taxYear]);

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting income form data:', error);
      throw error;
    }
  }

  /**
   * Get Adjustable Tax Form Data (Excel "Adjustable Tax" sheet)
   * Links to Income sheet data automatically
   */
  static async getAdjustableFormData(userId, taxYear) {
    try {
      // First get income data for linking
      const incomeData = await this.getIncomeFormData(userId, taxYear);
      
      const result = await pool.query(`
        SELECT *
        FROM adjustable_tax_forms 
        WHERE user_id = $1 AND tax_year = $2
      `, [userId, taxYear]);

      const adjustableData = result.rows[0] || {};

      // Excel sheet linking: Adjustable Tax references Income sheet
      if (incomeData) {
        // Excel: Adjustable Tax B5 = Income!B16
        adjustableData.salary_employees_149_gross_receipt = incomeData.b16_annual_salary_wages_total;
        
        // Excel: Adjustable Tax B6 = Income!B13
        adjustableData.directorship_fee_149_3_gross_receipt = incomeData.directorship_fee;
        
        // Excel: Adjustable Tax B7 = Income!B26
        adjustableData.profit_debt_15_percent_gross_receipt = incomeData.profit_on_debt_15_percent;
        
        // Excel: Adjustable Tax B8 = Income!B27
        adjustableData.sukook_12_5_percent_gross_receipt = incomeData.profit_on_debt_12_5_percent;
        
        // Excel: Adjustable Tax B9 = Income!B31
        adjustableData.rent_section_155_gross_receipt = incomeData.other_taxable_income_rent;
      }

      return adjustableData;
    } catch (error) {
      logger.error('Error getting adjustable tax form data:', error);
      throw error;
    }
  }

  /**
   * Get Capital Gains Form Data (Excel "Capital Gain" sheet)
   */
  static async getCapitalGainsData(userId, taxYear) {
    try {
      const result = await pool.query(`
        SELECT *
        FROM capital_gain_forms 
        WHERE user_id = $1 AND tax_year = $2
      `, [userId, taxYear]);

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting capital gains data:', error);
      throw error;
    }
  }

  /**
   * Calculate Tax Computation (Excel "Tax Computation" sheet)
   * This replicates the main tax calculation sheet that references all other sheets
   */
  static async calculateTaxComputation(userId, taxYear) {
    try {
      logger.info(`Calculating tax computation for user ${userId}, tax year ${taxYear}`);

      // Get data from all forms (like Excel sheet references)
      const incomeData = await this.getIncomeFormData(userId, taxYear);
      const adjustableData = await this.getAdjustableFormData(userId, taxYear);
      const capitalGainsData = await this.getCapitalGainsData(userId, taxYear);

      if (!incomeData) {
        throw new Error('Income form data not found - required for tax computation');
      }

      // Excel Tax Computation calculations
      const computation = {
        // Excel B6: Income from Salary = Income!B16 + Income!B23
        incomeFromSalary: (incomeData.b16_annual_salary_wages_total || 0) + 
                         (incomeData.b23_total_non_cash_benefits || 0),
        
        // Excel B7: Income from Other Sources = Income!B28 + Income!B33
        incomeFromOtherSources: (incomeData.b28_other_income_min_tax_total || 0) + 
                               (incomeData.b33_other_income_no_min_tax_total || 0),
        
        // Excel B8: Income from Capital Gains = Capital Gain!E19
        incomeFromCapitalGains: capitalGainsData?.total_capital_gains || 0,
        
        // Excel B9: Total Income = B6 + B7 + B8
        totalIncome: 0, // Will be calculated below
        
        // Excel B11: Taxable Income excluding CG = B9 - Capital Gains
        taxableIncomeExcludingCG: 0,
        
        // Excel B16: Normal Income Tax (Progressive calculation)
        normalIncomeTax: 0,
        
        // Excel B17: Surcharge (if income > 10M, then 9% of normal tax)
        surcharge: 0,
        
        // Excel B18: Capital Gains Tax
        capitalGainsTax: capitalGainsData?.total_capital_gains_tax || 0,
        
        // Excel B19: Total Tax before adjustments
        totalTaxBeforeAdjustments: 0,
        
        // Excel B25: Withholding Tax = Adjustable Tax!C32
        withholdingTax: adjustableData?.total_tax_collected || 0,
        
        // Excel B28: Net Tax Payable
        netTaxPayable: 0,
        
        // Excel B30: Balance Payable/Refundable
        balancePayableRefundable: 0
      };

      // Calculate totals
      computation.totalIncome = computation.incomeFromSalary + 
                               computation.incomeFromOtherSources + 
                               computation.incomeFromCapitalGains;

      computation.taxableIncomeExcludingCG = computation.totalIncome - 
                                            computation.incomeFromCapitalGains;

      // Progressive tax calculation (Pakistani tax slabs 2025-26)
      computation.normalIncomeTax = await this.calculateProgressiveTax(
        computation.taxableIncomeExcludingCG, 
        taxYear
      );

      // Surcharge calculation (10% if income > 10M as per Finance Act 2025)
      if (computation.taxableIncomeExcludingCG > 10000000) {
        computation.surcharge = Math.round(computation.normalIncomeTax * 0.10);
      }

      computation.totalTaxBeforeAdjustments = computation.normalIncomeTax + 
                                             computation.surcharge + 
                                             computation.capitalGainsTax;

      computation.netTaxPayable = computation.totalTaxBeforeAdjustments;

      computation.balancePayableRefundable = computation.netTaxPayable - 
                                            computation.withholdingTax;

      logger.info('Tax computation completed successfully', {
        totalIncome: computation.totalIncome,
        normalIncomeTax: computation.normalIncomeTax,
        netTaxPayable: computation.netTaxPayable,
        balancePayableRefundable: computation.balancePayableRefundable
      });

      return computation;

    } catch (error) {
      logger.error('Error calculating tax computation:', error);
      throw error;
    }
  }

  /**
   * Calculate Progressive Tax based on Pakistani tax slabs
   * Replicates Excel progressive tax calculation
   */
  static async calculateProgressiveTax(taxableIncome, taxYear) {
    try {
      // Pakistani tax slabs for 2025-26 (these should come from database)
      const taxSlabs = [
        { min: 0, max: 600000, rate: 0.00 },
        { min: 600000, max: 1200000, rate: 0.05 },
        { min: 1200000, max: 2200000, rate: 0.15 },
        { min: 2200000, max: 3200000, rate: 0.25 },
        { min: 3200000, max: 4100000, rate: 0.30 },
        { min: 4100000, max: Infinity, rate: 0.35 }
      ];

      let totalTax = 0;

      for (const slab of taxSlabs) {
        if (taxableIncome > slab.min) {
          const taxableAtThisSlab = Math.min(taxableIncome, slab.max) - slab.min;
          if (taxableAtThisSlab > 0) {
            totalTax += taxableAtThisSlab * slab.rate;
          }
        }
      }

      return Math.round(totalTax);

    } catch (error) {
      logger.error('Error calculating progressive tax:', error);
      throw error;
    }
  }

  /**
   * Update Adjustable Tax Form with linked data
   * This automatically updates adjustable tax when income data changes
   */
  static async updateAdjustableFormWithLinks(userId, taxYear) {
    try {
      const incomeData = await this.getIncomeFormData(userId, taxYear);
      
      if (!incomeData) {
        logger.warn('No income data found for adjustable tax linking');
        return;
      }

      // Update adjustable tax form with linked values
      await pool.query(`
        INSERT INTO adjustable_tax_forms (
          user_id, tax_year,
          salary_employees_149_gross_receipt,
          directorship_fee_149_3_gross_receipt,
          profit_debt_15_percent_gross_receipt,
          sukook_12_5_percent_gross_receipt,
          rent_section_155_gross_receipt
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, tax_year) DO UPDATE SET
          salary_employees_149_gross_receipt = EXCLUDED.salary_employees_149_gross_receipt,
          directorship_fee_149_3_gross_receipt = EXCLUDED.directorship_fee_149_3_gross_receipt,
          profit_debt_15_percent_gross_receipt = EXCLUDED.profit_debt_15_percent_gross_receipt,
          sukook_12_5_percent_gross_receipt = EXCLUDED.sukook_12_5_percent_gross_receipt,
          rent_section_155_gross_receipt = EXCLUDED.rent_section_155_gross_receipt,
          updated_at = CURRENT_TIMESTAMP
      `, [
        userId, taxYear,
        incomeData.b16_annual_salary_wages_total || 0,
        incomeData.directorship_fee || 0,
        incomeData.profit_on_debt_15_percent || 0,
        incomeData.profit_on_debt_12_5_percent || 0,
        incomeData.other_taxable_income_rent || 0
      ]);

      logger.info('Adjustable tax form updated with linked data');

    } catch (error) {
      logger.error('Error updating adjustable tax form with links:', error);
      throw error;
    }
  }

  /**
   * Get Complete Tax Summary (like Excel summary)
   * This provides a complete overview linking all forms
   */
  static async getCompleteTaxSummary(userId, taxYear) {
    try {
      const [incomeData, adjustableData, capitalGainsData, taxComputation] = await Promise.all([
        this.getIncomeFormData(userId, taxYear),
        this.getAdjustableFormData(userId, taxYear),
        this.getCapitalGainsData(userId, taxYear),
        this.calculateTaxComputation(userId, taxYear)
      ]);

      return {
        userId,
        taxYear,
        incomeData,
        adjustableData,
        capitalGainsData,
        taxComputation,
        summary: {
          totalIncome: taxComputation.totalIncome,
          totalTax: taxComputation.netTaxPayable,
          withholdingTax: taxComputation.withholdingTax,
          balanceDue: taxComputation.balancePayableRefundable,
          lastUpdated: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Error getting complete tax summary:', error);
      throw error;
    }
  }
}

module.exports = TaxCalculationService;