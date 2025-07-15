export const sumFields = (obj, fields) => fields.reduce((sum, k) => sum + (+obj?.[k] || 0), 0);
export const currency = v => `PKR ${(v || 0).toLocaleString()}`;

export const TaxEngine = {
  slabs: [
    { min: 0, max: 600000, rate: 0 },
    { min: 600001, max: 1200000, rate: 0.05 },
    { min: 1200001, max: 2200000, rate: 0.15 },
    { min: 2200001, max: 3200000, rate: 0.25 },
    { min: 3200001, max: 4100000, rate: 0.30 },
    { min: 4100001, max: Infinity, rate: 0.35 }
  ],
  calcNormalTax: income => {
    let tax = 0, prev = 0;
    for (const { min, max, rate } of TaxEngine.slabs) {
      if (income > min) {
        const upper = Math.min(income, max);
        tax += (upper - prev) * rate;
        prev = max;
      }
    }
    return Math.round(tax);
  },
  calcTaxCredit: (amt, income, percent) => (income ? amt * (TaxEngine.calcNormalTax(income) / income) * percent : 0),
  calcFinalTax: (amt, rate) => amt * rate,
};

export const getDefaultTaxData = () => ({
  income: { monthlySalary: 0, bonus: 0, carAllowance: 0, otherTaxable: 0, salaryTaxDeducted: 0, multipleEmployer: "", additionalTaxDeducted: 0, medicalAllowance: 0, employerContribution: 0, otherExempt: 0, otherSources: 0 },
  adjustableTax: { profitOnDebt: 0, profitOnDebtTax: 0, electricityBill: 0, electricityTax: 0, phoneBill: 0, phoneTax: 0, vehicleAmount: 0, vehicleTax: 0, otherTax: 0 },
  reductions: { teacherAmount: 0, teacherReduction: 0, behboodReduction: 0 },
  credits: { charitableDonation: 0, pensionContribution: 0 },
  deductions: { zakat: 0 },
  finalTax: { sukukAmount: 0, debtAmount: 0 },
  capitalGain: { property1Year: 0, property1YearTaxDeducted: 0, property2_3Years: 0, property2_3YearsTaxDeducted: 0, securities: 0, securitiesTaxDeducted: 0 },
  expenses: { rent: 0, rates: 0, incomeTax: 0, vehicle: 0, travelling: 0, electricity: 0, water: 0, gas: 0, telephone: 0, medical: 0, educational: 0, donations: 0, otherExpenses: 0 },
  wealth: { propertyPreviousYear: 0, propertyCurrentYear: 0, investmentPreviousYear: 0, investmentCurrentYear: 0, vehiclePreviousYear: 0, vehicleCurrentYear: 0, jewelryPreviousYear: 0, jewelryCurrentYear: 0, cashPreviousYear: 0, cashCurrentYear: 0, pfPreviousYear: 0, pfCurrentYear: 0, loanPreviousYear: 0, loanCurrentYear: 0 }
}); 