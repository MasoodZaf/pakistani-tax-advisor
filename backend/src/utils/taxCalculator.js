const { pool } = require('../config/database');
const logger = require('./logger');

class TaxCalculator {
  
  /**
   * Calculate tax based on FBR progressive tax slabs
   * @param {number} taxableIncome - The taxable income amount
   * @param {string} taxYearId - Tax year ID
   * @param {string} slabType - Type of slab ('individual', 'non_filer', etc.)
   * @returns {Object} Tax calculation result
   */
  static async calculateProgressiveTax(taxableIncome, taxYearId, slabType = 'individual') {
    try {
      // Get tax slabs for the specific year and type
      const slabQuery = await pool.query(`
        SELECT * FROM tax_slabs
        WHERE tax_year_id = $1 AND slab_type = $2
        ORDER BY slab_order
      `, [taxYearId, slabType]);
      
      const taxSlabs = slabQuery.rows;
      
      if (taxSlabs.length === 0) {
        throw new Error(`No tax slabs found for tax year ID ${taxYearId} and type ${slabType}`);
      }
      
      let totalTax = 0;
      let remainingIncome = taxableIncome;
      const slabBreakdown = [];
      
      for (const slab of taxSlabs) {
        if (remainingIncome <= 0) break;
        
        const slabMinIncome = parseFloat(slab.min_income);
        const slabMaxIncome = slab.max_income ? parseFloat(slab.max_income) : Infinity;
        const taxRate = parseFloat(slab.tax_rate);
        
        // Skip if income hasn't reached this slab
        if (taxableIncome <= slabMinIncome) continue;
        
        // Calculate income in this slab
        const incomeInSlab = Math.min(
          remainingIncome,
          Math.min(slabMaxIncome, taxableIncome) - slabMinIncome
        );
        
        if (incomeInSlab > 0) {
          const taxInSlab = incomeInSlab * taxRate;
          totalTax += taxInSlab;
          remainingIncome -= incomeInSlab;
          
          slabBreakdown.push({
            slabName: slab.slab_name,
            slabOrder: slab.slab_order,
            minIncome: slabMinIncome,
            maxIncome: slab.max_income ? slabMaxIncome : null,
            taxRate: taxRate,
            incomeInSlab: incomeInSlab,
            taxInSlab: taxInSlab
          });
        }
      }
      
      const effectiveTaxRate = taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : 0;
      const marginalTaxRate = this.getMarginalTaxRate(taxableIncome, taxSlabs);
      
      return {
        taxableIncome: taxableIncome,
        totalTax: Math.round(totalTax * 100) / 100, // Round to 2 decimal places
        effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100,
        marginalTaxRate: marginalTaxRate,
        slabBreakdown: slabBreakdown,
        slabType: slabType,
        calculatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Tax calculation error:', error);
      throw new Error(`Tax calculation failed: ${error.message}`);
    }
  }
  
  /**
   * Get marginal tax rate for given income
   * @param {number} income - Income amount
   * @param {Array} taxSlabs - Tax slabs array
   * @returns {number} Marginal tax rate as percentage
   */
  static getMarginalTaxRate(income, taxSlabs) {
    for (let i = taxSlabs.length - 1; i >= 0; i--) {
      const slab = taxSlabs[i];
      const minIncome = parseFloat(slab.min_income);
      const maxIncome = slab.max_income ? parseFloat(slab.max_income) : Infinity;
      
      if (income > minIncome && income <= maxIncome) {
        return parseFloat(slab.tax_rate) * 100;
      }
    }
    return 0;
  }
  
  /**
   * Calculate comprehensive tax summary including all forms
   * @param {Object} taxData - Complete tax data from all forms
   * @param {string} taxYearId - Tax year ID
   * @param {string} userType - User type ('filer', 'non_filer')
   * @returns {Object} Complete tax calculation
   */
  static async calculateComprehensiveTax(taxData, taxYearId, userType = 'filer') {
    try {
      const slabType = userType === 'non_filer' ? 'non_filer' : 'individual';
      
      // Extract income data
      const income = taxData.income || {};
      const adjustableTax = taxData.adjustableTax || {};
      const reductions = taxData.reductions || {};
      const credits = taxData.credits || {};
      const deductions = taxData.deductions || {};
      const finalTax = taxData.finalTax || {};
      const capitalGain = taxData.capitalGain || {};
      
      // Calculate total gross and taxable income
      const grossIncome = (
        (income.monthly_salary || 0) * 12 +
        (income.bonus || 0) +
        (income.car_allowance || 0) +
        (income.other_taxable || 0) +
        (income.other_sources || 0)
      );
      
      const exemptIncome = (
        (income.medical_allowance || 0) +
        (income.employer_contribution || 0) +
        (income.other_exempt || 0)
      );
      
      const taxableIncome = grossIncome - exemptIncome;
      
      // Calculate normal tax using progressive slabs
      const normalTaxCalc = await this.calculateProgressiveTax(taxableIncome, taxYearId, slabType);
      let normalTax = normalTaxCalc.totalTax;
      
      // Apply reductions
      const totalReductions = (
        (reductions.teacher_reduction || 0) +
        (reductions.behbood_reduction || 0) +
        (reductions.export_income_reduction || 0) +
        (reductions.industrial_undertaking_reduction || 0) +
        (reductions.other_reductions || 0)
      );
      
      normalTax = Math.max(0, normalTax - totalReductions);
      
      // Apply tax credits
      const totalCredits = (
        (credits.charitable_donation || 0) +
        (credits.pension_contribution || 0) +
        (credits.life_insurance_premium || 0) +
        (credits.investment_tax_credit || 0) +
        (credits.other_credits || 0)
      );
      
      const taxAfterCredits = Math.max(0, normalTax - totalCredits);
      
      // Calculate adjustable tax
      const totalAdjustableTax = (
        (adjustableTax.profit_on_debt_tax || 0) +
        (adjustableTax.electricity_tax || 0) +
        (adjustableTax.phone_tax || 0) +
        (adjustableTax.vehicle_tax || 0) +
        (adjustableTax.other_tax || 0)
      );
      
      // Calculate final tax
      const totalFinalTax = (
        (finalTax.sukuk_tax_amount || 0) +
        (finalTax.debt_tax_amount || 0) +
        (finalTax.prize_bonds_tax || 0) +
        (finalTax.other_final_tax || 0)
      );
      
      // Calculate capital gains tax
      const totalCapitalGainsTax = (
        (capitalGain.property_1_year_tax_due || 0) +
        (capitalGain.property_2_3_years_tax_due || 0) +
        (capitalGain.securities_tax_due || 0) +
        (capitalGain.other_capital_gains_tax || 0)
      );
      
      // Total tax liability
      const totalTaxLiability = taxAfterCredits + totalAdjustableTax + totalFinalTax + totalCapitalGainsTax;
      
      // Calculate total tax paid
      const totalTaxPaid = (
        (income.salary_tax_deducted || 0) +
        (income.additional_tax_deducted || 0) +
        (adjustableTax.profit_on_debt_tax || 0) +
        (adjustableTax.electricity_tax || 0) +
        (adjustableTax.phone_tax || 0) +
        (adjustableTax.vehicle_tax || 0) +
        (deductions.advance_tax || 0) +
        (capitalGain.property_1_year_tax_deducted || 0) +
        (capitalGain.property_2_3_years_tax_deducted || 0) +
        (capitalGain.securities_tax_deducted || 0)
      );
      
      // Calculate refund or additional tax due
      const refundDue = Math.max(0, totalTaxPaid - totalTaxLiability);
      const additionalTaxDue = Math.max(0, totalTaxLiability - totalTaxPaid);
      
      return {
        // Income summary
        grossIncome: Math.round(grossIncome * 100) / 100,
        exemptIncome: Math.round(exemptIncome * 100) / 100,
        taxableIncome: Math.round(taxableIncome * 100) / 100,
        
        // Tax calculations
        normalTax: Math.round(normalTax * 100) / 100,
        taxReductions: Math.round(totalReductions * 100) / 100,
        taxCredits: Math.round(totalCredits * 100) / 100,
        taxAfterCredits: Math.round(taxAfterCredits * 100) / 100,
        adjustableTax: Math.round(totalAdjustableTax * 100) / 100,
        finalTax: Math.round(totalFinalTax * 100) / 100,
        capitalGainsTax: Math.round(totalCapitalGainsTax * 100) / 100,
        totalTaxLiability: Math.round(totalTaxLiability * 100) / 100,
        
        // Tax payments
        totalTaxPaid: Math.round(totalTaxPaid * 100) / 100,
        refundDue: Math.round(refundDue * 100) / 100,
        additionalTaxDue: Math.round(additionalTaxDue * 100) / 100,
        
        // Rates and breakdown
        effectiveTaxRate: taxableIncome > 0 ? Math.round((totalTaxLiability / taxableIncome) * 10000) / 100 : 0,
        marginalTaxRate: normalTaxCalc.marginalTaxRate,
        slabBreakdown: normalTaxCalc.slabBreakdown,
        
        // Metadata
        calculationType: 'comprehensive',
        userType: userType,
        slabType: slabType,
        calculatedAt: new Date().toISOString(),
        version: '2.0'
      };
      
    } catch (error) {
      logger.error('Comprehensive tax calculation error:', error);
      throw new Error(`Comprehensive tax calculation failed: ${error.message}`);
    }
  }
  
  /**
   * Validate tax calculation inputs
   * @param {Object} taxData - Tax data to validate
   * @returns {Object} Validation result
   */
  static validateTaxData(taxData) {
    const errors = [];
    const warnings = [];
    
    // Validate income data
    if (!taxData.income) {
      errors.push('Income data is required');
    } else {
      const income = taxData.income;
      
      if ((income.monthly_salary || 0) < 0) {
        errors.push('Monthly salary cannot be negative');
      }
      
      if ((income.monthly_salary || 0) > 10000000) {
        warnings.push('Monthly salary seems unusually high');
      }
      
      if ((income.salary_tax_deducted || 0) < 0) {
        errors.push('Salary tax deducted cannot be negative');
      }
    }
    
    // Additional validations can be added here
    
    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  }
}

module.exports = TaxCalculator;