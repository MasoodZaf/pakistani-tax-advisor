/**
 * Direct Income Form API Test
 * Tests core calculation functionality without authentication dependencies
 */

const axios = require('axios');
const mockDataSets = require('./comprehensive-mock-data-sets.json');

console.log('🧪 DIRECT INCOME FORM API TEST');
console.log('==============================');

const API_BASE = 'http://localhost:3001/api';

// Test the calculation service directly first
async function testCalculationServiceDirect() {
  console.log('\n🧮 Testing Calculation Service Direct');

  try {
    const CalculationService = require('./src/services/calculationService');
    const testData = mockDataSets.incomeFormData.basicSalaried;

    console.log('Input Data:', {
      monthly_basic_salary: testData.monthly_basic_salary,
      monthly_allowances: testData.monthly_allowances,
      monthly_medical_allowance: testData.monthly_medical_allowance
    });

    const calculations = CalculationService.calculateIncomeFormFields(testData);

    console.log('Calculated Results:', {
      annual_basic_salary: calculations.annual_basic_salary,
      annual_medical_allowance: calculations.annual_medical_allowance,
      income_exempt_from_tax: calculations.income_exempt_from_tax,
      total_employment_income: calculations.total_employment_income
    });

    // Verify calculations match expected values
    const annualSalaryCorrect = calculations.annual_basic_salary === testData.expected.annual_basic_salary;
    const medicalCorrect = calculations.annual_medical_allowance <= 120000;

    console.log('✅ Calculation Service Test Results:');
    console.log(`   Annual Salary Conversion: ${annualSalaryCorrect ? 'PASS' : 'FAIL'}`);
    console.log(`   Medical Allowance Cap: ${medicalCorrect ? 'PASS' : 'FAIL'}`);

    return { success: annualSalaryCorrect && medicalCorrect, calculations };

  } catch (error) {
    console.log('❌ Calculation Service Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test different calculation scenarios
async function testCalculationScenarios() {
  console.log('\n📊 Testing Multiple Calculation Scenarios');

  const CalculationService = require('./src/services/calculationService');
  const scenarios = ['basicSalaried', 'midProfessional', 'highExecutive'];
  let allPassed = true;

  for (const scenario of scenarios) {
    console.log(`\n--- Testing ${scenario} ---`);

    const testData = mockDataSets.incomeFormData[scenario];
    const expected = testData.expected;

    try {
      const calculations = CalculationService.calculateIncomeFormFields(testData);

      console.log(`Input: Monthly Salary ${testData.monthly_basic_salary}`);
      console.log(`Expected Annual: ${expected.annual_basic_salary}`);
      console.log(`Calculated Annual: ${calculations.annual_basic_salary}`);

      const match = Math.abs(calculations.annual_basic_salary - expected.annual_basic_salary) < 1000;
      console.log(`Result: ${match ? '✅ PASS' : '❌ FAIL'}`);

      if (!match) allPassed = false;

    } catch (error) {
      console.log(`❌ Error in ${scenario}:`, error.message);
      allPassed = false;
    }
  }

  return { success: allPassed };
}

// Test Excel formula compliance
async function testExcelFormulaCompliance() {
  console.log('\n📋 Testing Excel Formula Compliance');

  const CalculationService = require('./src/services/calculationService');

  // Test 1: Monthly to Annual conversion (Excel formula)
  const monthlyData = {
    monthly_basic_salary: 100000,  // Should be 1,200,000 annually
    monthly_medical_allowance: 15000  // Should be 120,000 annually (capped)
  };

  const result1 = CalculationService.calculateIncomeFormFields(monthlyData);

  console.log('Monthly to Annual Test:');
  console.log(`  Input: ${monthlyData.monthly_basic_salary} monthly`);
  console.log(`  Output: ${result1.annual_basic_salary} annually`);
  console.log(`  Expected: 1,200,000`);
  console.log(`  Medical Cap Test: ${result1.annual_medical_allowance} (should be ≤ 120,000)`);

  const test1Pass = result1.annual_basic_salary === 1200000;
  const test1CapPass = result1.annual_medical_allowance <= 120000;

  // Test 2: Income Exempt from Tax (Excel Formula B15)
  const exemptData = {
    monthly_medical_allowance: 10000,     // 120K annually (capped)
    employment_termination_payment: 50000,
    retirement_amount: 30000
  };

  const result2 = CalculationService.calculateIncomeFormFields(exemptData);
  const expectedExempt = -(120000 + 50000 + 30000); // -200,000

  console.log('\nIncome Exempt Test (Excel B15):');
  console.log(`  Medical: 120,000 (capped), Termination: 50,000, Retirement: 30,000`);
  console.log(`  Formula: -(120000 + 50000 + 30000) = -200,000`);
  console.log(`  Calculated: ${result2.income_exempt_from_tax}`);
  console.log(`  Expected: ${expectedExempt}`);

  const test2Pass = result2.income_exempt_from_tax === expectedExempt;

  const allPassed = test1Pass && test1CapPass && test2Pass;

  console.log(`\n📋 Excel Formula Compliance: ${allPassed ? '✅ ALL PASS' : '❌ SOME FAILED'}`);
  console.log(`   Monthly to Annual: ${test1Pass ? 'PASS' : 'FAIL'}`);
  console.log(`   Medical Cap: ${test1CapPass ? 'PASS' : 'FAIL'}`);
  console.log(`   Income Exempt Formula: ${test2Pass ? 'PASS' : 'FAIL'}`);

  return { success: allPassed, results: { result1, result2, expectedExempt } };
}

// Test validation and edge cases
async function testValidationEdgeCases() {
  console.log('\n🔬 Testing Validation and Edge Cases');

  const CalculationService = require('./src/services/calculationService');

  // Edge Case 1: Zero values
  const zeroData = {
    monthly_basic_salary: 0,
    monthly_allowances: 0,
    bonus: 0
  };

  const zeroResult = CalculationService.calculateIncomeFormFields(zeroData);

  // Edge Case 2: Very high medical allowance (should be capped)
  const highMedicalData = {
    monthly_basic_salary: 50000,
    monthly_medical_allowance: 20000  // 240K annually, should cap at 120K
  };

  const highMedicalResult = CalculationService.calculateIncomeFormFields(highMedicalData);

  // Edge Case 3: Large numbers
  const largeData = {
    monthly_basic_salary: 1000000,  // 12M annually
    directorship_fee: 50000000      // 50M
  };

  const largeResult = CalculationService.calculateIncomeFormFields(largeData);

  console.log('Edge Case Results:');
  console.log(`  Zero Values - Annual Salary: ${zeroResult.annual_basic_salary}`);
  console.log(`  High Medical - Capped at: ${highMedicalResult.annual_medical_allowance} (should be 120,000)`);
  console.log(`  Large Numbers - Annual Salary: ${largeResult.annual_basic_salary} (should be 12,000,000)`);

  const zeroPass = zeroResult.annual_basic_salary === 0;
  const capPass = highMedicalResult.annual_medical_allowance === 120000;
  const largePass = largeResult.annual_basic_salary === 12000000;

  const allPassed = zeroPass && capPass && largePass;

  console.log(`\n🔬 Edge Cases: ${allPassed ? '✅ ALL PASS' : '❌ SOME FAILED'}`);

  return { success: allPassed };
}

// Test cross-form data preparation
async function testCrossFormDataPreparation() {
  console.log('\n🔄 Testing Cross-Form Data Preparation');

  const CalculationService = require('./src/services/calculationService');
  const testData = mockDataSets.incomeFormData.midProfessional;

  const calculations = CalculationService.calculateIncomeFormFields(testData);

  console.log('Cross-Form Data Check:');
  console.log(`  Directorship Fee: ${calculations.directorship_fee || testData.directorship_fee}`);
  console.log(`  Profit on Debt 15%: ${calculations.profit_debt_15_percent || 0}`);
  console.log(`  Total Employment Income: ${calculations.total_employment_income}`);

  // Check if data is suitable for cross-form linking
  const directorshipAvailable = (calculations.directorship_fee || testData.directorship_fee) > 0;
  const totalIncomeCalculated = calculations.total_employment_income > 0;

  console.log(`\n🔄 Cross-Form Ready: ${directorshipAvailable && totalIncomeCalculated ? '✅ READY' : '❌ NOT READY'}`);

  return {
    success: directorshipAvailable && totalIncomeCalculated,
    data: calculations
  };
}

// Run all direct tests
async function runDirectTests() {
  console.log('\n🚀 Starting Direct API Tests (No Authentication Required)\n');

  let totalTests = 0;
  let passedTests = 0;

  // Test 1: Calculation Service Direct
  totalTests++;
  const test1 = await testCalculationServiceDirect();
  if (test1.success) passedTests++;

  // Test 2: Multiple Scenarios
  totalTests++;
  const test2 = await testCalculationScenarios();
  if (test2.success) passedTests++;

  // Test 3: Excel Formula Compliance
  totalTests++;
  const test3 = await testExcelFormulaCompliance();
  if (test3.success) passedTests++;

  // Test 4: Validation and Edge Cases
  totalTests++;
  const test4 = await testValidationEdgeCases();
  if (test4.success) passedTests++;

  // Test 5: Cross-Form Data Preparation
  totalTests++;
  const test5 = await testCrossFormDataPreparation();
  if (test5.success) passedTests++;

  // Final Results
  console.log('\n📊 DIRECT TEST RESULTS');
  console.log('======================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 All Direct Tests Passed!');
    console.log('✅ Calculation engine is working correctly');
    console.log('✅ Excel formula compliance verified');
    console.log('✅ Cross-form data linking ready');
  } else {
    console.log('\n⚠️ Some tests failed - review implementation');
  }

  return {
    totalTests,
    passedTests,
    successRate: (passedTests / totalTests) * 100
  };
}

// Run tests
if (require.main === module) {
  runDirectTests()
    .then((results) => {
      console.log('\n🏁 Direct Income Form Tests Completed!');
      process.exit(results.passedTests === results.totalTests ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runDirectTests,
  testCalculationServiceDirect,
  testExcelFormulaCompliance
};