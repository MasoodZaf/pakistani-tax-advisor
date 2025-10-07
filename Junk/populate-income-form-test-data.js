// Test script to populate Income Form with data from user's image
// This script will help populate the form fields with the exact values shown in the image

const testData = {
  // Payments By Employer - Fields marked as "Input cell" in the image
  annual_basic_salary: 7200000,
  allowances_excluding_bonus_medical: 6000000,
  bonus: 1500000,
  medical_allowance_not_provided: 720000,
  pension_from_ex_employer: 400000,
  employment_termination_payment: 2000000,
  retirement_approved_funds: 5000000,
  directorship_fee: 40000,
  other_cash_benefits: 1200000,

  // Non cash benefits - Fields marked as "Input cell"
  employer_contribution_funds: 720000,
  taxable_car_value: 1500000,
  other_taxable_subsidies: 200000,

  // Other Income (Subject to minimum tax) - Fields marked as "Input cell"
  profit_on_debt_15_percent: 700000,
  profit_on_debt_12_5_percent: 1500000,

  // Other Income (Not Subject to minimum tax) - Fields marked as "Input cell"
  other_taxable_income_rent: 700000,
  other_taxable_income_others: 50000
};

console.log('Test Data for Income Form:');
console.log('==========================');
console.log('');

console.log('PAYMENTS BY EMPLOYER:');
console.log('- Annual Basic Salary:', testData.annual_basic_salary.toLocaleString());
console.log('- Allowances (excluding bonus and medical):', testData.allowances_excluding_bonus_medical.toLocaleString());
console.log('- Bonus:', testData.bonus.toLocaleString());
console.log('- Medical allowance (not provided by employer):', testData.medical_allowance_not_provided.toLocaleString());
console.log('- Pension from ex-employer:', testData.pension_from_ex_employer.toLocaleString());
console.log('- Employment Termination payment:', testData.employment_termination_payment.toLocaleString());
console.log('- Retirement from approved funds:', testData.retirement_approved_funds.toLocaleString());
console.log('- Directorship Fee:', testData.directorship_fee.toLocaleString());
console.log('- Other cash benefits:', testData.other_cash_benefits.toLocaleString());
console.log('');

console.log('NON CASH BENEFITS:');
console.log('- Employer Contribution to Funds:', testData.employer_contribution_funds.toLocaleString());
console.log('- Taxable Car Value:', testData.taxable_car_value.toLocaleString());
console.log('- Other taxable subsidies:', testData.other_taxable_subsidies.toLocaleString());
console.log('');

console.log('OTHER INCOME (SUBJECT TO MINIMUM TAX):');
console.log('- Profit on Debt 15%:', testData.profit_on_debt_15_percent.toLocaleString());
console.log('- Profit on Debt 12.5%:', testData.profit_on_debt_12_5_percent.toLocaleString());
console.log('');

console.log('OTHER INCOME (NOT SUBJECT TO MINIMUM TAX):');
console.log('- Rent income:', testData.other_taxable_income_rent.toLocaleString());
console.log('- Others:', testData.other_taxable_income_others.toLocaleString());
console.log('');

// Calculate expected totals for verification
const paymentsTotal = testData.annual_basic_salary + testData.allowances_excluding_bonus_medical +
                     testData.bonus + testData.medical_allowance_not_provided + testData.pension_from_ex_employer +
                     testData.employment_termination_payment + testData.retirement_approved_funds +
                     testData.directorship_fee + testData.other_cash_benefits;

const nonCashTotal = testData.employer_contribution_funds + testData.taxable_car_value + testData.other_taxable_subsidies;
const otherIncomeMinTaxTotal = testData.profit_on_debt_15_percent + testData.profit_on_debt_12_5_percent;
const otherIncomeNoMinTaxTotal = testData.other_taxable_income_rent + testData.other_taxable_income_others;

console.log('EXPECTED TOTALS:');
console.log('- Employment Termination payment Total:', paymentsTotal.toLocaleString());
console.log('- Non Cash Benefits Total:', nonCashTotal.toLocaleString());
console.log('- Other Income (Min Tax) Total:', otherIncomeMinTaxTotal.toLocaleString());
console.log('- Other Income (No Min Tax) Total:', otherIncomeNoMinTaxTotal.toLocaleString());
console.log('');

console.log('Use these values to fill the Income Form manually or programmatically.');
console.log('All values should match the image data exactly.');

// Export for potential programmatic use
module.exports = testData;