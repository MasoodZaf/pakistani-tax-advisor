// Debug what the form is calculating vs what it should calculate

const data = {
    basic_salary: 7200000,
    allowances_excluding_bonus_medical: 6000000,
    bonus: 1500000,
    medical_allowance: 720000,
    pension_from_ex_employer: 400000,
    employment_termination_payment: 2000000,
    retirement_from_approved_funds: 5000000,
    directorship_fee: 40000,
    other_cash_benefits: 1200000
};

console.log('Debug Calculation Analysis:');
console.log('===========================');

// What the form SHOULD calculate (correct logic)
const incomeExemptFromTax = data.medical_allowance + data.employment_termination_payment + data.retirement_from_approved_funds;
const totalBeforeExemptions = Object.values(data).reduce((sum, val) => sum + val, 0);
const correctAnnualSalaryAndWages = totalBeforeExemptions - incomeExemptFromTax;

console.log('CORRECT CALCULATION:');
console.log('- Total Before Exemptions:', totalBeforeExemptions.toLocaleString());
console.log('- Income Exempt from Tax:', incomeExemptFromTax.toLocaleString());
console.log('- Annual Salary and Wages:', correctAnnualSalaryAndWages.toLocaleString());

// What the form MIGHT be calculating (wrong logic - just sum all)
const wrongCalculation = Object.values(data).reduce((sum, val) => sum + val, 0);

console.log('\nWRONG CALCULATION (if summing all):');
console.log('- Annual Salary and Wages:', wrongCalculation.toLocaleString());

// Check if 31,780,000 comes from old data structure
const possibleOldCalculation = data.basic_salary + data.allowances_excluding_bonus_medical + data.bonus +
    data.medical_allowance + data.pension_from_ex_employer + data.employment_termination_payment +
    data.other_cash_benefits + data.directorship_fee;

console.log('\nPOSSIBLE OLD CALCULATION (without retirement):');
console.log('- Annual Salary and Wages:', possibleOldCalculation.toLocaleString());

// Check what could give us 31,780,000
console.log('\nREVERSE CALCULATION from 31,780,000:');
const target = 31780000;
const difference = target - wrongCalculation;
console.log('- Target (31,780,000) vs Sum All (' + wrongCalculation.toLocaleString() + ')');
console.log('- Difference:', difference.toLocaleString());

if (target === wrongCalculation) {
    console.log('✅ 31,780,000 = Sum of all input fields');
} else if (target === possibleOldCalculation) {
    console.log('✅ 31,780,000 = Old calculation without retirement field');
} else {
    console.log('❓ 31,780,000 source unknown');
}