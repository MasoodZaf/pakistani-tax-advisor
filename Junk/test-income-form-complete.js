/**
 * Complete Income Form Test Script
 * Tests data posting, fetching, calculation verification, and Excel compliance
 * Based on "Salaried Individuals 2025.xlsx" reference data
 */

const axios = require('axios');
const mockDataSets = require('./comprehensive-mock-data-sets.json');

console.log('🧪 INCOME FORM COMPLETE TEST SUITE');
console.log('===================================');

const API_BASE = 'http://localhost:3001/api';
let authToken = null;
let testResults = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  details: []
};

// Test execution helper
async function runTest(testName, testFunction) {
  testResults.totalTests++;

  try {
    console.log(`\n🧪 Running: ${testName}`);
    const result = await testFunction();

    if (result.success) {
      testResults.passedTests++;
      testResults.details.push({
        name: testName,
        status: 'PASSED',
        details: result.details || 'Test completed successfully'
      });
      console.log(`✅ PASSED: ${testName}`);
      return true;
    } else {
      testResults.failedTests++;
      testResults.details.push({
        name: testName,
        status: 'FAILED',
        details: result.error || 'Test failed',
        data: result.data
      });
      console.log(`❌ FAILED: ${testName} - ${result.error}`);
      return false;
    }
  } catch (error) {
    testResults.failedTests++;
    testResults.details.push({
      name: testName,
      status: 'ERROR',
      details: error.message,
      stack: error.stack
    });
    console.log(`💥 ERROR: ${testName} - ${error.message}`);
    return false;
  }
}

// Authentication helper
async function authenticateUser(userType = 'basicSalaried') {
  const userData = mockDataSets.testUsers[userType];

  try {
    // First try to login
    const loginResponse = await axios.post(`${API_BASE}/login`, {
      email: userData.email,
      password: userData.password
    });

    authToken = loginResponse.data.token;
    return { success: true, token: authToken };
  } catch (loginError) {
    // If login fails, try to register first
    try {
      await axios.post(`${API_BASE}/register`, userData);
      console.log(`✅ Registered test user: ${userData.email}`);

      // Now try login again
      const loginResponse = await axios.post(`${API_BASE}/login`, {
        email: userData.email,
        password: userData.password
      });

      authToken = loginResponse.data.token;
      return { success: true, token: authToken };
    } catch (error) {
      return {
        success: false,
        error: `Authentication failed: ${error.response?.data?.message || error.message}`
      };
    }
  }
}

// Test 1: User Authentication
async function testAuthentication() {
  const result = await authenticateUser('basicSalaried');
  return result;
}

// Test 2: Income Form Data Posting - Basic Scenario
async function testBasicIncomeFormPosting() {
  const testData = mockDataSets.incomeFormData.basicSalaried;
  const taxYear = '2025-26';

  try {
    const response = await axios.post(
      `${API_BASE}/income-form/${taxYear}`,
      testData,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    if (response.data.success && response.data.data) {
      const savedData = response.data.data;
      const calculations = response.data.calculations;

      // Verify basic data was saved
      const dataMatch = savedData.annual_basic_salary === testData.expected.annual_basic_salary;

      // Verify calculations were performed
      const calculationsExist = calculations && Object.keys(calculations).length > 0;

      return {
        success: dataMatch && calculationsExist,
        details: `Saved annual salary: ${savedData.annual_basic_salary}, Expected: ${testData.expected.annual_basic_salary}`,
        data: { savedData, calculations, testData }
      };
    } else {
      return {
        success: false,
        error: 'API response format invalid',
        data: response.data
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `API call failed: ${error.response?.data?.message || error.message}`,
      data: error.response?.data
    };
  }
}

// Test 3: Income Form Data Fetching
async function testIncomeFormFetching() {
  const taxYear = '2025-26';

  try {
    const response = await axios.get(
      `${API_BASE}/income-form/${taxYear}`,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    const fetchedData = response.data;
    const expectedData = mockDataSets.incomeFormData.basicSalaried.expected;

    // Verify key fields were fetched correctly
    const annualSalaryMatch = Math.abs(fetchedData.annual_basic_salary - expectedData.annual_basic_salary) < 1;
    const totalIncomeMatch = Math.abs(fetchedData.total_employment_income - expectedData.total_employment_income) < 1;

    return {
      success: annualSalaryMatch && totalIncomeMatch,
      details: `Fetched annual salary: ${fetchedData.annual_basic_salary}, total income: ${fetchedData.total_employment_income}`,
      data: { fetchedData, expectedData }
    };
  } catch (error) {
    return {
      success: false,
      error: `Fetch failed: ${error.response?.data?.message || error.message}`,
      data: error.response?.data
    };
  }
}

// Test 4: Excel Formula Compliance - Monthly to Annual Conversion
async function testMonthlyToAnnualConversion() {
  const testData = {
    monthly_basic_salary: 75000,   // Should become 900,000 annually
    monthly_allowances: 10000,     // Should become 120,000 annually
    monthly_medical_allowance: 12000 // Should become 120,000 annually (capped)
  };

  const taxYear = '2025-26';

  try {
    const response = await axios.post(
      `${API_BASE}/income-form/${taxYear}`,
      testData,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    const calculations = response.data.calculations;
    const savedData = response.data.data;

    // Verify Excel formula compliance
    const annualSalaryCorrect = savedData.annual_basic_salary === 900000; // 75K * 12
    const medicalCapCorrect = savedData.medical_allowance <= 120000; // Capped at 120K
    const calculationsExist = calculations && calculations.annual_basic_salary === 900000;

    return {
      success: annualSalaryCorrect && medicalCapCorrect && calculationsExist,
      details: `Annual salary: ${savedData.annual_basic_salary} (expected 900000), Medical: ${savedData.medical_allowance}`,
      data: { calculations, savedData, testData }
    };
  } catch (error) {
    return {
      success: false,
      error: `Conversion test failed: ${error.message}`,
      data: error.response?.data
    };
  }
}

// Test 5: Excel Formula Compliance - Income Exempt from Tax Calculation
async function testIncomeExemptCalculation() {
  const testData = {
    monthly_medical_allowance: 8000,        // 96K annually
    employment_termination_payment: 50000, // Direct input
    retirement_amount: 25000                // Direct input
  };

  // Excel Formula B15: -(medical + termination + retirement) = -(96K + 50K + 25K) = -171K
  const expectedExempt = -(96000 + 50000 + 25000);
  const taxYear = '2025-26';

  try {
    const response = await axios.post(
      `${API_BASE}/income-form/${taxYear}`,
      testData,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    const calculations = response.data.calculations;
    const savedData = response.data.data;

    // Verify Excel B15 formula implementation
    const exemptCalculationCorrect = savedData.income_exempt_from_tax === expectedExempt;
    const calculationLogicCorrect = calculations && calculations.income_exempt_from_tax === expectedExempt;

    return {
      success: exemptCalculationCorrect && calculationLogicCorrect,
      details: `Income exempt: ${savedData.income_exempt_from_tax} (expected ${expectedExempt})`,
      data: { calculations, savedData, testData, expectedExempt }
    };
  } catch (error) {
    return {
      success: false,
      error: `Exempt calculation test failed: ${error.message}`,
      data: error.response?.data
    };
  }
}

// Test 6: High-Income Scenario with All Components
async function testHighIncomeScenario() {
  const testData = mockDataSets.incomeFormData.highExecutive;
  const taxYear = '2025-26';

  try {
    const response = await axios.post(
      `${API_BASE}/income-form/${taxYear}`,
      testData,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    const savedData = response.data.data;
    const expected = testData.expected;

    // Verify high-income calculations
    const totalIncomeCorrect = Math.abs(savedData.total_employment_income - expected.total_employment_income) < 1000;
    const annualSalaryCorrect = Math.abs(savedData.annual_basic_salary - expected.annual_basic_salary) < 1000;
    const exemptCalculationCorrect = Math.abs(savedData.income_exempt_from_tax - expected.income_exempt_from_tax) < 1000;

    return {
      success: totalIncomeCorrect && annualSalaryCorrect && exemptCalculationCorrect,
      details: `Total income: ${savedData.total_employment_income} (expected ~${expected.total_employment_income})`,
      data: { savedData, expected, testData }
    };
  } catch (error) {
    return {
      success: false,
      error: `High income test failed: ${error.message}`,
      data: error.response?.data
    };
  }
}

// Test 7: Data Validation and Edge Cases
async function testDataValidationAndEdgeCases() {
  const taxYear = '2025-26';

  // Test with invalid data
  const invalidData = {
    monthly_basic_salary: 'invalid_string',
    bonus: -5000,  // Negative value
    medical_allowance: null
  };

  try {
    const response = await axios.post(
      `${API_BASE}/income-form/${taxYear}`,
      invalidData,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    const savedData = response.data.data;

    // Verify data sanitization
    const stringHandled = savedData.annual_basic_salary === 0; // Invalid string should become 0
    const negativeHandled = savedData.bonus === 0;             // Negative should become 0
    const nullHandled = savedData.medical_allowance === 0;     // Null should become 0

    return {
      success: stringHandled && negativeHandled && nullHandled,
      details: `Data sanitization working: salary=${savedData.annual_basic_salary}, bonus=${savedData.bonus}, medical=${savedData.medical_allowance}`,
      data: { savedData, invalidData }
    };
  } catch (error) {
    return {
      success: false,
      error: `Validation test failed: ${error.message}`,
      data: error.response?.data
    };
  }
}

// Test 8: Income Form Summary Endpoint
async function testIncomeFormSummary() {
  const taxYear = '2025-26';

  try {
    const response = await axios.get(
      `${API_BASE}/income-form/${taxYear}/summary`,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    const summaryData = response.data.data;

    // Verify summary contains expected fields
    const hasRequiredFields = summaryData.employment_termination_total !== undefined &&
                              summaryData.total_non_cash_benefits !== undefined &&
                              summaryData.total_income !== undefined;

    return {
      success: hasRequiredFields,
      details: `Summary data complete with total income: ${summaryData.total_income}`,
      data: summaryData
    };
  } catch (error) {
    return {
      success: false,
      error: `Summary test failed: ${error.message}`,
      data: error.response?.data
    };
  }
}

// Test 9: Cross-Form Data Preparation (for Adjustable Tax Form)
async function testCrossFormDataPreparation() {
  const testData = mockDataSets.incomeFormData.midProfessional;
  const taxYear = '2025-26';

  try {
    const response = await axios.post(
      `${API_BASE}/income-form/${taxYear}`,
      testData,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    const savedData = response.data.data;

    // Verify data suitable for cross-form linking
    const directorshipFeeAvailable = savedData.directorship_fee > 0;
    const profitDebtAvailable = savedData.profit_on_debt_15_percent >= 0;

    return {
      success: directorshipFeeAvailable,
      details: `Cross-form data ready: directorship=${savedData.directorship_fee}, profit_debt=${savedData.profit_on_debt_15_percent}`,
      data: savedData
    };
  } catch (error) {
    return {
      success: false,
      error: `Cross-form preparation failed: ${error.message}`,
      data: error.response?.data
    };
  }
}

// Test 10: Performance and Response Time
async function testPerformanceAndResponseTime() {
  const testData = mockDataSets.incomeFormData.basicSalaried;
  const taxYear = '2025-26';

  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${API_BASE}/income-form/${taxYear}`,
      testData,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Response should be under 2 seconds for production readiness
    const performanceAcceptable = responseTime < 2000;
    const responseValid = response.data.success;

    return {
      success: performanceAcceptable && responseValid,
      details: `Response time: ${responseTime}ms (target: <2000ms)`,
      data: { responseTime, responseData: response.data }
    };
  } catch (error) {
    return {
      success: false,
      error: `Performance test failed: ${error.message}`,
      data: error.response?.data
    };
  }
}

// Execute all tests
async function runAllTests() {
  console.log('Starting Income Form Complete Test Suite...\n');

  await runTest('User Authentication', testAuthentication);
  await runTest('Basic Income Form Posting', testBasicIncomeFormPosting);
  await runTest('Income Form Data Fetching', testIncomeFormFetching);
  await runTest('Monthly to Annual Conversion (Excel Formula)', testMonthlyToAnnualConversion);
  await runTest('Income Exempt from Tax Calculation (Excel Formula B15)', testIncomeExemptCalculation);
  await runTest('High-Income Scenario Processing', testHighIncomeScenario);
  await runTest('Data Validation and Edge Cases', testDataValidationAndEdgeCases);
  await runTest('Income Form Summary Endpoint', testIncomeFormSummary);
  await runTest('Cross-Form Data Preparation', testCrossFormDataPreparation);
  await runTest('Performance and Response Time', testPerformanceAndResponseTime);

  // Print final results
  console.log('\n📊 INCOME FORM TEST RESULTS');
  console.log('============================');
  console.log(`Total Tests: ${testResults.totalTests}`);
  console.log(`Passed: ${testResults.passedTests}`);
  console.log(`Failed: ${testResults.failedTests}`);
  console.log(`Success Rate: ${((testResults.passedTests / testResults.totalTests) * 100).toFixed(1)}%`);

  if (testResults.failedTests > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.details.filter(t => t.status !== 'PASSED').forEach(test => {
      console.log(`   - ${test.name}: ${test.details}`);
    });
  }

  // Save detailed results
  const fs = require('fs');
  const resultsPath = '/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/backend/income-form-test-results.json';
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📝 Detailed results saved to: ${resultsPath}`);

  return testResults;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n🎉 Income Form Test Suite Completed!');
      process.exit(testResults.failedTests === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test suite execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testResults
};