// Test script to verify the form data processing fixes
const testData = {
  "annual_basic_salary": "7200000.00",
  "allowances": "6000000.00",
  "bonus": "1500000.00",
  "medical_allowance": "720000.00",
  "pension_from_ex_employer": "400000.00",
  "employment_termination_payment": "2000000.00",
  "retirement_from_approved_funds": "5000000.00",
  "directorship_fee": "40000.00",
  "other_cash_benefits": "1200000.00",
  "income_exempt_from_tax": "-14700000.00", // This was negative
  "employment_termination_total": "24060000.00", // This should NOT be populated
  "employer_contribution_provident": "720000.00",
  "taxable_car_value": "1500000.00",
  "other_taxable_subsidies": "200000.00",
  "non_cash_benefit_exempt": "-242000.00", // This was negative
  "total_non_cash_benefits": "2420000.00", // This should NOT be populated
  "profit_on_debt_15_percent": "700000.00",
  "profit_on_debt_12_5_percent": "1500000.00",
  "other_income_min_tax_total": "2200000.00", // This should NOT be populated
  "other_taxable_income_rent": "700000.00",
  "other_taxable_income_others": "50000.00",
  "other_income_no_min_tax_total": "750000.00" // This should NOT be populated
};

// Simulate the processIncomeData function
function processIncomeData(rawData) {
  if (!rawData) return {};

  // Define user input fields only (exclude calculated fields)
  const userInputFields = [
    'annual_basic_salary',
    'allowances',
    'bonus',
    'medical_allowance',
    'pension_from_ex_employer',
    'employment_termination_payment',
    'retirement_from_approved_funds',
    'directorship_fee',
    'other_cash_benefits',
    'income_exempt_from_tax',
    'employer_contribution_provident',
    'taxable_car_value',
    'other_taxable_subsidies',
    'non_cash_benefit_exempt',
    'profit_on_debt_15_percent',
    'profit_on_debt_12_5_percent',
    'other_taxable_income_rent',
    'other_taxable_income_others'
  ];

  const processedData = {};

  userInputFields.forEach(field => {
    if (rawData[field] !== undefined && rawData[field] !== null) {
      // Convert to positive integer (remove decimals, handle negatives)
      const value = parseFloat(rawData[field]) || 0;
      processedData[field] = Math.abs(Math.round(value));
    }
  });

  return processedData;
}

console.log('🧪 Testing Form Data Processing...\n');

console.log('📥 Original Database Data:');
Object.keys(testData).forEach(key => {
  console.log(`  ${key}: ${testData[key]}`);
});

console.log('\n📤 Processed Data for Form (User Input Only):');
const processed = processIncomeData(testData);
Object.keys(processed).forEach(key => {
  console.log(`  ${key}: ${processed[key]} (integer, positive)`);
});

console.log('\n✅ Expected Results:');
console.log('  - All values should be positive integers');
console.log('  - No calculated fields (employment_termination_total, etc.)');
console.log('  - income_exempt_from_tax: 14700000 (was -14700000.00)');
console.log('  - non_cash_benefit_exempt: 242000 (was -242000.00)');
console.log('  - annual_basic_salary: 7200000 (was 7200000.00)');

console.log('\n🧮 Testing Calculations with Processed Data:');
// Simulate calculation logic
const annualBasicSalary = parseInt(processed.annual_basic_salary || 0);
const allowances = parseInt(processed.allowances || 0);
const bonus = parseInt(processed.bonus || 0);
const medicalAllowance = parseInt(processed.medical_allowance || 0);
const pensionFromExEmployer = parseInt(processed.pension_from_ex_employer || 0);
const employmentTerminationPayment = parseInt(processed.employment_termination_payment || 0);
const retirementAmount = parseInt(processed.retirement_from_approved_funds || 0);
const directorshipFee = parseInt(processed.directorship_fee || 0);
const otherCashBenefits = parseInt(processed.other_cash_benefits || 0);
const incomeExemptFromTax = parseInt(processed.income_exempt_from_tax || 0);

const totalEmploymentTermination = annualBasicSalary + allowances + bonus + medicalAllowance +
                                 pensionFromExEmployer + employmentTerminationPayment + retirementAmount +
                                 directorshipFee + otherCashBenefits - incomeExemptFromTax;

console.log(`  Calculated Employment Termination Total: ${totalEmploymentTermination.toLocaleString()}`);
console.log(`  (Should be computed, not from DB value of ${testData.employment_termination_total})`);

console.log('\n🎉 Form data processing test completed!');