// Mobile tax calculation utilities.
//
// Slabs are the authoritative ones from the backend tax_slabs seed for the
// salaried-individual schedule. The server remains the source of truth — these
// are an offline fallback for the in-app calculator only. Keep in sync with
// database/schema.sql or fetch via /api/tax-year when online.
export class MobileTaxCalculator {

  // Slabs are stored as (min, max, rate) only. We compute marginal tax in a
  // single pass — no precomputed "fixed" base, which avoids the double-count
  // bug that earlier shipped here.
  //
  // Rates are the Finance Act 2025 salaried-individual schedule (tax year
  // 2025-26): 0 / 1 / 11 / 23 / 30 / 35 %. These MUST match the backend
  // tax_slabs seed (taxCalculationService) — the previous values (5/15/25 %)
  // were the stale FA-2024 rates and over-stated tax by tens of thousands of
  // rupees (audit TEST-01). The server stays the source of truth; this table
  // is an offline fallback only — fetch /api/tax-year when online.
  static TAX_SLABS_2025_26 = [
    { min: 0,       max: 600000,  rate: 0.00 },
    { min: 600000,  max: 1200000, rate: 0.01 },
    { min: 1200000, max: 2200000, rate: 0.11 },
    { min: 2200000, max: 3200000, rate: 0.23 },
    { min: 3200000, max: 4100000, rate: 0.30 },
    { min: 4100000, max: null,    rate: 0.35 }
  ];

  // Surcharge u/s 4AB (FA 2025): 10% of computed income tax when taxable
  // income exceeds Rs 10,000,000. Mirrors the backend surcharge so the mobile
  // estimate does not under-state for high earners (audit BLIND-03). Threshold
  // and rate ideally come from /api/tax-year when online.
  static SURCHARGE_2025_26 = { threshold: 10000000, rate: 0.10 };

  // Calculate progressive (marginal) tax. Offline-capable.
  static calculateProgressiveTax(taxableIncome /* , taxYear */) {
    if (taxableIncome <= 0) {
      return {
        totalTax: 0,
        effectiveRate: 0,
        breakdown: [],
        taxableIncome: 0,
        netIncome: 0
      };
    }

    const slabs = this.TAX_SLABS_2025_26;
    let totalTax = 0;
    const breakdown = [];

    for (const slab of slabs) {
      const slabMax = slab.max ?? Infinity;
      if (taxableIncome <= slab.min) break;

      const taxableAtThisSlab = Math.min(taxableIncome, slabMax) - slab.min;
      if (taxableAtThisSlab <= 0) continue;

      const taxAtThisSlab = taxableAtThisSlab * slab.rate;
      totalTax += taxAtThisSlab;

      breakdown.push({
        range: `${this.formatCurrency(slab.min)} - ${slab.max ? this.formatCurrency(slabMax) : 'Above'}`,
        rate: `${(slab.rate * 100).toFixed(1)}%`,
        taxableAmount: taxableAtThisSlab,
        taxAmount: taxAtThisSlab
      });
    }

    // Surcharge u/s 4AB — applied on the computed income tax above the
    // threshold (mirrors the backend so high earners are not under-stated).
    const sc = this.SURCHARGE_2025_26;
    const surcharge = taxableIncome > sc.threshold ? Math.round(totalTax * sc.rate) : 0;
    totalTax += surcharge;

    const effectiveRate = (totalTax / taxableIncome) * 100;

    return {
      totalTax: Math.round(totalTax),
      surcharge,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
      breakdown,
      taxableIncome,
      netIncome: taxableIncome - totalTax
    };
  }

  // Calculate comprehensive tax from form data
  static calculateFromFormData(formData) {
    // Convert monthly salary to annual
    const annualSalary = (parseFloat(formData.monthly_salary) || 0) * 12;
    
    // Calculate gross income
    const grossIncome = [
      annualSalary,
      parseFloat(formData.bonus) || 0,
      parseFloat(formData.car_allowance) || 0,
      parseFloat(formData.other_taxable) || 0,
      parseFloat(formData.other_sources) || 0
    ].reduce((sum, amount) => sum + amount, 0);

    // Calculate exempt income
    const exemptIncome = [
      parseFloat(formData.medical_allowance) || 0,
      parseFloat(formData.employer_contribution) || 0,
      parseFloat(formData.other_exempt) || 0
    ].reduce((sum, amount) => sum + amount, 0);

    // Calculate taxable income
    const taxableIncome = Math.max(0, grossIncome - exemptIncome);

    // Calculate tax
    const taxCalculation = this.calculateProgressiveTax(taxableIncome);

    // Calculate tax paid
    const taxPaid = [
      parseFloat(formData.salary_tax_deducted) || 0,
      parseFloat(formData.additional_tax_deducted) || 0
    ].reduce((sum, amount) => sum + amount, 0);

    // Calculate refund or additional tax due
    const refundDue = Math.max(0, taxPaid - taxCalculation.totalTax);
    const additionalTaxDue = Math.max(0, taxCalculation.totalTax - taxPaid);

    return {
      ...taxCalculation,
      grossIncome,
      exemptIncome,
      taxPaid,
      refundDue,
      additionalTaxDue,
      annualSalary
    };
  }

  // Format currency for display
  static formatCurrency(amount) {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  // Format percentage
  static formatPercentage(rate) {
    return `${rate.toFixed(2)}%`;
  }

  // Validate tax form data
  static validateTaxData(formData) {
    const errors = [];
    const warnings = [];

    // Validate income data
    const monthlySalary = parseFloat(formData.monthly_salary) || 0;
    if (monthlySalary < 0) {
      errors.push('Monthly salary cannot be negative');
    }
    if (monthlySalary > 10000000) {
      warnings.push('Monthly salary seems unusually high');
    }

    // Validate tax deducted
    const salaryTaxDeducted = parseFloat(formData.salary_tax_deducted) || 0;
    if (salaryTaxDeducted < 0) {
      errors.push('Salary tax deducted cannot be negative');
    }

    // Check if tax deducted is reasonable
    const annualSalary = monthlySalary * 12;
    if (salaryTaxDeducted > annualSalary * 0.5) {
      warnings.push('Tax deducted seems unusually high compared to salary');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Get tax saving suggestions
  static getTaxSavingSuggestions(formData) {
    const suggestions = [];
    const calculation = this.calculateFromFormData(formData);

    // Suggest increasing exempt income
    const medicalAllowance = parseFloat(formData.medical_allowance) || 0;
    if (medicalAllowance < 100000) {
      suggestions.push({
        category: 'Medical Allowance',
        suggestion: `You can claim up to PKR 100,000 in medical allowance. Current: ${this.formatCurrency(medicalAllowance)}`,
        potentialSaving: this.calculateSaving(100000 - medicalAllowance, calculation.effectiveRate)
      });
    }

    // Suggest deductions
    if (!formData.zakat_paid || parseFloat(formData.zakat_paid) === 0) {
      suggestions.push({
        category: 'Zakat',
        suggestion: 'Consider claiming Zakat payments as deduction',
        potentialSaving: 'Varies based on amount paid'
      });
    }

    return suggestions;
  }

  // Calculate potential tax saving
  static calculateSaving(additionalDeduction, currentEffectiveRate) {
    const saving = additionalDeduction * (currentEffectiveRate / 100);
    return this.formatCurrency(saving);
  }
}

export default MobileTaxCalculator;