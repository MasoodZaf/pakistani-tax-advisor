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

      // Calculate total gross income using new 2025 structure
      const grossIncome = (
        parseFloat(income.annual_basic_salary || 0) +
        parseFloat(income.allowances_excluding_bonus_medical || 0) +
        parseFloat(income.bonus || 0) +
        parseFloat(income.medical_allowance || 0) +
        parseFloat(income.pension_from_ex_employer || 0) +
        parseFloat(income.employment_termination_payment || 0) +
        parseFloat(income.retirement_from_approved_funds || 0) +
        parseFloat(income.directorship_fee || 0) +
        parseFloat(income.other_cash_benefits || 0) +
        // Non-cash benefits
        parseFloat(income.employer_contribution_provident || 0) +
        parseFloat(income.taxable_car_value || 0) +
        parseFloat(income.other_taxable_subsidies || 0) +
        // Other income
        parseFloat(income.profit_on_debt_15 || 0) +
        parseFloat(income.profit_on_debt_12_5 || 0) +
        parseFloat(income.rent_income || 0) +
        parseFloat(income.other_taxable_income_others || 0)
      );

      const exemptIncome = (
        parseFloat(income.income_exempt_from_tax || 0) +
        parseFloat(income.non_cash_benefit_exempt || 0)
      );
      
      // Apply allowable deductions from taxable income - ensure numeric conversion
      // Medical allowance is now part of gross income, not a separate deduction
      const allowableDeductions = (
        parseFloat(deductions.professional_expenses_amount || 0) +
        parseFloat(deductions.zakat_paid_amount || deductions.zakat || 0) + // Support both comprehensive and simple
        parseFloat(deductions.total_deduction_from_income || 0) // Use comprehensive total if available
      );

      // Calculate base taxable income (excluding capital gains)
      const baseTaxableIncome = Math.max(0, grossIncome - exemptIncome - allowableDeductions);

      // Add capital gains to get total taxable income
      const capitalGainsAmount = parseFloat(capitalGain.total_capital_gain || 0);
      const taxableIncome = baseTaxableIncome + capitalGainsAmount;
      
      // Calculate normal tax using progressive slabs (excluding capital gains)
      const normalTaxCalc = await this.calculateProgressiveTax(baseTaxableIncome, taxYearId, slabType);
      let normalTax = normalTaxCalc.totalTax;

      // Apply surcharge (10% on income above Rs 10 million for individuals - Finance Act 2025)
      const surchargeThreshold = 10000000;  // Rs 10 million
      const surchargeRate = 0.10;  // 10%
      let surcharge = 0;
      if (baseTaxableIncome > surchargeThreshold) {
        surcharge = normalTax * surchargeRate;
      }

      // Add surcharge to normal tax
      const normalTaxWithSurcharge = normalTax + surcharge;

      // Get reductions for later application - ensure numeric conversion
      const totalReductions = parseFloat(reductions.total_reductions || 0);

      // Apply tax credits - use the generated total_credits field
      const totalCredits = parseFloat(credits.total_credits || 0);

      // Apply reductions and credits to normal tax with surcharge
      const taxAfterReductions = Math.max(0, normalTaxWithSurcharge - totalReductions);
      const taxAfterCredits = Math.max(0, taxAfterReductions - totalCredits);

      // Calculate adjustable tax - ensure numeric conversion
      const totalAdjustableTax = (
        parseFloat(adjustableTax.profit_on_debt_tax || 0) +
        parseFloat(adjustableTax.electricity_tax || 0) +
        parseFloat(adjustableTax.phone_tax || 0) +
        parseFloat(adjustableTax.vehicle_tax || 0) +
        parseFloat(adjustableTax.other_tax || 0)
      );

      // Calculate final tax - use the generated total_final_tax field or calculate manually
      const totalFinalTax = parseFloat(finalTax.total_final_tax || 0) || (
        parseFloat(finalTax.sukuk_bonds_gross_amount || 0) * (parseFloat(finalTax.sukuk_bonds_tax_rate || 0) / 100) +
        parseFloat(finalTax.debt_securities_gross_amount || 0) * (parseFloat(finalTax.debt_securities_tax_rate || 0) / 100) +
        parseFloat(finalTax.prize_bonds_tax_amount || 0) +
        parseFloat(finalTax.other_final_tax_tax_amount || 0)
      );

      // Calculate capital gains tax - ensure numeric conversion
      const totalCapitalGainsTax = parseFloat(capitalGain.total_tax_deducted || 0);
      
      // Total tax liability
      const totalTaxLiability = taxAfterCredits + totalAdjustableTax + totalFinalTax + totalCapitalGainsTax;
      
      // Calculate total tax paid - ensure numeric conversion (excluding capital gains tax to avoid double counting)
      // Updated for new 2025 structure - no monthly multiplier needed as annual amounts are used
      const totalTaxPaid = (
        parseFloat(income.salary_tax_deducted || 0) +  // Annual tax deducted (not monthly anymore)
        parseFloat(income.additional_tax_deducted || 0) +
        parseFloat(adjustableTax.profit_on_debt_tax || 0) +
        parseFloat(adjustableTax.electricity_tax || 0) +
        parseFloat(adjustableTax.phone_tax || 0) +
        parseFloat(adjustableTax.vehicle_tax || 0) +
        parseFloat(deductions.advance_tax || 0)
        // Note: Capital gains tax is calculated separately and not part of withholding
      );
      
      // Calculate refund or additional tax due
      const refundDue = Math.max(0, totalTaxPaid - totalTaxLiability);
      const additionalTaxDue = Math.max(0, totalTaxLiability - totalTaxPaid);
      
      return {
        // Income summary
        grossIncome: Math.round(grossIncome * 100) / 100,
        exemptIncome: Math.round(exemptIncome * 100) / 100,
        allowableDeductions: Math.round(allowableDeductions * 100) / 100,
        taxableIncome: Math.round(taxableIncome * 100) / 100,
        capitalGain: Math.round(capitalGainsAmount * 100) / 100,
        
        // Tax calculations
        normalIncomeTax: Math.round(normalTax * 100) / 100,
        surcharge: Math.round(surcharge * 100) / 100,
        taxReductions: Math.round(totalReductions * 100) / 100,
        taxCredits: Math.round(totalCredits * 100) / 100,
        taxAfterReductions: Math.round(taxAfterReductions * 100) / 100,
        taxAfterCredits: Math.round(taxAfterCredits * 100) / 100,
        adjustableTax: Math.round(totalAdjustableTax * 100) / 100,
        finalTax: Math.round(totalFinalTax * 100) / 100,
        capitalGainTax: Math.round(totalCapitalGainsTax * 100) / 100,
        taxChargeable: Math.round(totalTaxLiability * 100) / 100,
        withholdingTax: Math.round(totalTaxPaid * 100) / 100,
        taxDemanded: Math.round(additionalTaxDue * 100) / 100,
        
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
        errors.push('Annual salary cannot be negative');
      }

      if ((income.monthly_salary || 0) > 120000000) {
        warnings.push('Annual salary seems unusually high');
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