#!/usr/bin/env node

/**
 * Comprehensive Income Form API Testing Script
 * Tests all Income Form endpoints with real data and calculations verification
 *
 * Test Cases:
 * 1. Create Income Form with complete data
 * 2. Retrieve Income Form data
 * 3. Update Income Form data
 * 4. Delete Income Form data
 * 5. Verify Excel formula calculations
 * 6. Test edge cases and boundary conditions
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const TEST_USER_EMAIL = 'khurramj@taxadvisor.pk';
const TEST_USER_PASSWORD = 'password123';
const TAX_YEAR = '2025-26';

let authToken = '';
let userId = '';

// Test data matching Excel calculations
const testIncomeData = {
  // Monthly amounts that will be converted to annual (*12)
  monthly_basic_salary: 150000,           // Annual: 1,800,000
  monthly_allowances: 50000,              // Annual: 600,000
  monthly_house_rent_allowance: 60000,    // Annual: 720,000
  monthly_conveyance_allowance: 20000,    // Annual: 240,000
  monthly_medical_allowance: 10000,       // Annual: 120,000 (capped at 120,000)

  // Direct annual amounts
  directorship_fee: 500000,               // Excel B13
  bonus_commission: 300000,               // Excel B14

  // Non-cash benefits
  noncash_benefits_gross: 200000,         // Excel B19
  provident_fund_contribution: 180000,    // Excel B20, exemption: min(180000, 150000) = 150000
  gratuity: 100000,                      // Excel B21

  // Other income components
  profit_debt_15_percent: 250000,        // Excel B26
  profit_debt_12_5_percent: 150000,      // Excel B27
  rent_income: 400000,                   // Excel B31
  other_income: 100000,                  // Excel B32

  // Exempt amounts
  retirement_amount: 50000,              // Excel B9
  employment_termination_payment: 75000,  // Excel B11
  medical_allowance_exempt: 120000,      // Excel B12

  // Expected Excel calculations
  expected_calculations: {
    // B15: -(B12+B11+B9) = -(120000+75000+50000) = -245000
    income_exempt_from_tax: -245000,

    // B16: SUM(B6:B15) - Annual salary total
    annual_salary_wages_total: 1800000 + 600000 + 720000 + 240000 + 120000 + 500000 + 300000 - 245000, // 4,035,000

    // B22: -(MIN(B19,150000)) = -(MIN(180000,150000)) = -150000
    provident_exemption: -150000,

    // B23: SUM(B19:B22) = 200000+180000+100000-150000 = 330000
    total_noncash_benefits: 330000,

    // B28: B26+B27 = 250000+150000 = 400000
    other_income_min_tax_total: 400000,

    // B33: B31+B32 = 400000+100000 = 500000
    other_income_no_min_tax_total: 500000,

    // Total employment income calculation
    total_employment_income: 4365000 // B16+B23 = 4035000+330000 = 4365000
  }
};

// Colored console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, status, details = '') {
  const statusColor = status === 'PASS' ? 'green' : 'red';
  const statusIcon = status === 'PASS' ? '✅' : '❌';
  log(`${statusIcon} [${status}] ${testName}`, statusColor);
  if (details) log(`   ${details}`, 'blue');
}

async function authenticate() {
  try {
    log('\n📋 AUTHENTICATION PHASE', 'bold');
    log('🔐 Logging in as test user...', 'blue');

    const response = await axios.post(`${BASE_URL}/api/login`, {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    if (response.data.token) {
      authToken = response.data.token;
      userId = response.data.user.id;
      logTest('Authentication', 'PASS', `User ID: ${userId}`);
      return true;
    } else {
      logTest('Authentication', 'FAIL', 'No token received');
      return false;
    }
  } catch (error) {
    logTest('Authentication', 'FAIL', error.response?.data?.message || error.message);
    return false;
  }
}

async function testCreateIncomeForm() {
  try {
    log('\n💰 INCOME FORM CREATION TEST', 'bold');
    log('📝 Creating Income Form with comprehensive test data...', 'blue');

    const response = await axios.post(
      `${BASE_URL}/api/income-form/${TAX_YEAR}`,
      testIncomeData,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.status === 200 || response.status === 201) {
      logTest('Income Form Creation', 'PASS', `Form ID: ${response.data.incomeForm?.id}`);

      // Verify some key calculations
      const form = response.data.incomeForm;
      const calcs = testIncomeData.expected_calculations;

      // Check annual salary total calculation
      const actualAnnualTotal = form.annual_salary_wages_total || 0;
      if (Math.abs(actualAnnualTotal - calcs.annual_salary_wages_total) <= 1) {
        logTest('Annual Salary Calculation', 'PASS', `Expected: ${calcs.annual_salary_wages_total}, Got: ${actualAnnualTotal}`);
      } else {
        logTest('Annual Salary Calculation', 'FAIL', `Expected: ${calcs.annual_salary_wages_total}, Got: ${actualAnnualTotal}`);
      }

      return response.data.incomeForm;
    } else {
      logTest('Income Form Creation', 'FAIL', `Unexpected status: ${response.status}`);
      return null;
    }
  } catch (error) {
    logTest('Income Form Creation', 'FAIL', error.response?.data?.message || error.message);
    return null;
  }
}

async function testRetrieveIncomeForm() {
  try {
    log('\n📖 INCOME FORM RETRIEVAL TEST', 'bold');
    log('🔍 Retrieving Income Form data...', 'blue');

    const response = await axios.get(
      `${BASE_URL}/api/income-form/${TAX_YEAR}`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.status === 200 && response.data.incomeForm) {
      logTest('Income Form Retrieval', 'PASS', `Retrieved form with ID: ${response.data.incomeForm.id}`);

      // Verify data integrity
      const form = response.data.incomeForm;
      const dataIntegrityTests = [
        { field: 'monthly_basic_salary', expected: testIncomeData.monthly_basic_salary },
        { field: 'monthly_allowances', expected: testIncomeData.monthly_allowances },
        { field: 'directorship_fee', expected: testIncomeData.directorship_fee },
        { field: 'bonus_commission', expected: testIncomeData.bonus_commission }
      ];

      let integrityPass = 0;
      dataIntegrityTests.forEach(test => {
        if (form[test.field] == test.expected) {
          integrityPass++;
        }
      });

      logTest('Data Integrity Check', integrityPass === dataIntegrityTests.length ? 'PASS' : 'FAIL',
              `${integrityPass}/${dataIntegrityTests.length} fields correct`);

      return form;
    } else {
      logTest('Income Form Retrieval', 'FAIL', 'No form data returned');
      return null;
    }
  } catch (error) {
    logTest('Income Form Retrieval', 'FAIL', error.response?.data?.message || error.message);
    return null;
  }
}

async function testUpdateIncomeForm() {
  try {
    log('\n📝 INCOME FORM UPDATE TEST', 'bold');
    log('✏️ Updating Income Form data...', 'blue');

    const updateData = {
      ...testIncomeData,
      monthly_basic_salary: 175000, // Increased from 150000
      bonus_commission: 350000,      // Increased from 300000
      notes: 'Updated during comprehensive testing'
    };

    const response = await axios.post(
      `${BASE_URL}/api/income-form/${TAX_YEAR}`,
      updateData,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.status === 200) {
      const updatedForm = response.data.incomeForm;
      const salaryUpdated = updatedForm.monthly_basic_salary == 175000;
      const bonusUpdated = updatedForm.bonus_commission == 350000;

      if (salaryUpdated && bonusUpdated) {
        logTest('Income Form Update', 'PASS', 'All fields updated correctly');
      } else {
        logTest('Income Form Update', 'FAIL', `Salary: ${salaryUpdated}, Bonus: ${bonusUpdated}`);
      }

      return updatedForm;
    } else {
      logTest('Income Form Update', 'FAIL', `Unexpected status: ${response.status}`);
      return null;
    }
  } catch (error) {
    logTest('Income Form Update', 'FAIL', error.response?.data?.message || error.message);
    return null;
  }
}

async function testIncomeFormSummary() {
  try {
    log('\n📊 INCOME FORM SUMMARY TEST', 'bold');
    log('📈 Testing Income Form summary endpoint...', 'blue');

    const response = await axios.get(
      `${BASE_URL}/api/income-form/${TAX_YEAR}/summary`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.status === 200 && response.data.summary) {
      const summary = response.data.summary;
      logTest('Income Form Summary', 'PASS', `Total Employment Income: ${summary.totalEmploymentIncome}`);

      // Verify summary calculations
      const summaryFields = ['totalSalary', 'totalAllowances', 'totalOtherIncome'];
      const hasAllFields = summaryFields.every(field => summary.hasOwnProperty(field));

      logTest('Summary Data Completeness', hasAllFields ? 'PASS' : 'FAIL',
              `Has ${summaryFields.length} required fields`);

      return summary;
    } else {
      logTest('Income Form Summary', 'FAIL', 'No summary data returned');
      return null;
    }
  } catch (error) {
    logTest('Income Form Summary', 'FAIL', error.response?.data?.message || error.message);
    return null;
  }
}

async function testExcelCalculationAccuracy() {
  try {
    log('\n🧮 EXCEL CALCULATION ACCURACY TEST', 'bold');
    log('📐 Verifying Excel formula calculations...', 'blue');

    // Get current form data
    const response = await axios.get(
      `${BASE_URL}/api/income-form/${TAX_YEAR}`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.status === 200 && response.data.incomeForm) {
      const form = response.data.incomeForm;
      let calculationTests = 0;
      let passedTests = 0;

      // Test 1: Monthly to Annual Conversion (Updated salary)
      calculationTests++;
      const expectedAnnualSalary = 175000 * 12; // 2,100,000 (updated value)
      if (Math.abs(form.annual_basic_salary - expectedAnnualSalary) <= 1) {
        passedTests++;
        logTest('Monthly to Annual Conversion', 'PASS', `${form.annual_basic_salary} = ${expectedAnnualSalary}`);
      } else {
        logTest('Monthly to Annual Conversion', 'FAIL', `Expected: ${expectedAnnualSalary}, Got: ${form.annual_basic_salary}`);
      }

      // Test 2: Total Employment Income Calculation
      calculationTests++;
      if (form.total_employment_income && form.total_employment_income > 0) {
        passedTests++;
        logTest('Total Employment Income', 'PASS', `Calculated: ${form.total_employment_income}`);
      } else {
        logTest('Total Employment Income', 'FAIL', `Value: ${form.total_employment_income}`);
      }

      // Overall calculation accuracy
      const accuracyRate = (passedTests / calculationTests * 100).toFixed(1);
      logTest('Overall Calculation Accuracy', passedTests === calculationTests ? 'PASS' : 'FAIL',
              `${accuracyRate}% (${passedTests}/${calculationTests})`);

      return { passedTests, calculationTests, accuracyRate };
    } else {
      logTest('Excel Calculation Accuracy', 'FAIL', 'Could not retrieve form data');
      return null;
    }
  } catch (error) {
    logTest('Excel Calculation Accuracy', 'FAIL', error.response?.data?.message || error.message);
    return null;
  }
}

async function testEdgeCases() {
  try {
    log('\n⚠️ EDGE CASE TESTING', 'bold');
    log('🔬 Testing boundary conditions and edge cases...', 'blue');

    let edgeTests = 0;
    let passedEdgeTests = 0;

    // Test 1: Zero values
    edgeTests++;
    try {
      const zeroDataResponse = await axios.post(
        `${BASE_URL}/api/income-form/${TAX_YEAR}`,
        {
          monthly_basic_salary: 0,
          monthly_allowances: 0,
          directorship_fee: 0
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (zeroDataResponse.status === 200) {
        passedEdgeTests++;
        logTest('Zero Values Test', 'PASS', 'System handles zero values correctly');
      }
    } catch (error) {
      logTest('Zero Values Test', 'FAIL', 'System rejected zero values');
    }

    // Test 2: Large numbers (within reasonable tax limits)
    edgeTests++;
    try {
      const largeNumberResponse = await axios.post(
        `${BASE_URL}/api/income-form/${TAX_YEAR}`,
        {
          monthly_basic_salary: 2000000, // 24M annually - high but realistic for executives
          directorship_fee: 5000000,
          bonus_commission: 3000000
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (largeNumberResponse.status === 200) {
        passedEdgeTests++;
        logTest('Large Numbers Test', 'PASS', 'System handles large numbers correctly');
      }
    } catch (error) {
      logTest('Large Numbers Test', 'FAIL', 'System rejected large numbers');
    }

    // Test 3: Negative values (should be rejected for income)
    edgeTests++;
    try {
      const negativeResponse = await axios.post(
        `${BASE_URL}/api/income-form/${TAX_YEAR}`,
        {
          monthly_basic_salary: -50000,
          directorship_fee: -100000
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      // Should ideally fail for negative income values
      logTest('Negative Values Test', 'FAIL', 'System accepted negative income values');
    } catch (error) {
      passedEdgeTests++;
      logTest('Negative Values Test', 'PASS', 'System correctly rejected negative values');
    }

    const edgeTestAccuracy = (passedEdgeTests / edgeTests * 100).toFixed(1);
    logTest('Edge Case Testing Summary', passedEdgeTests >= (edgeTests * 0.6) ? 'PASS' : 'FAIL',
            `${edgeTestAccuracy}% (${passedEdgeTests}/${edgeTests})`);

    return { passedEdgeTests, edgeTests, edgeTestAccuracy };
  } catch (error) {
    logTest('Edge Case Testing', 'FAIL', error.message);
    return null;
  }
}

async function testDeleteIncomeForm() {
  try {
    log('\n🗑️ INCOME FORM DELETION TEST', 'bold');
    log('❌ Testing Income Form deletion...', 'blue');

    const response = await axios.delete(
      `${BASE_URL}/api/income-form/${TAX_YEAR}`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (response.status === 200) {
      logTest('Income Form Deletion', 'PASS', 'Form deleted successfully');

      // Verify deletion by trying to retrieve
      try {
        const verifyResponse = await axios.get(
          `${BASE_URL}/api/income-form/${TAX_YEAR}`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );

        if (!verifyResponse.data.incomeForm) {
          logTest('Deletion Verification', 'PASS', 'Form no longer exists');
        } else {
          logTest('Deletion Verification', 'FAIL', 'Form still exists after deletion');
        }
      } catch (error) {
        logTest('Deletion Verification', 'PASS', 'Form not found (expected)');
      }

      return true;
    } else {
      logTest('Income Form Deletion', 'FAIL', `Unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Income Form Deletion', 'FAIL', error.response?.data?.message || error.message);
    return false;
  }
}

async function generateTestReport(results) {
  log('\n📋 COMPREHENSIVE TEST REPORT', 'bold');
  log('=' .repeat(60), 'blue');

  const totalTests = Object.values(results).reduce((sum, result) => {
    if (typeof result === 'object' && result.total) return sum + result.total;
    return sum + 1;
  }, 0);

  const passedTests = Object.values(results).reduce((sum, result) => {
    if (typeof result === 'object' && result.passed) return sum + result.passed;
    if (result === true) return sum + 1;
    return sum;
  }, 0);

  const successRate = ((passedTests / totalTests) * 100).toFixed(1);

  log(`\n🎯 Overall Success Rate: ${successRate}% (${passedTests}/${totalTests})`,
      successRate >= 80 ? 'green' : 'red');

  log('\n📊 Test Category Breakdown:', 'yellow');
  Object.entries(results).forEach(([category, result]) => {
    if (typeof result === 'object') {
      log(`   ${category}: ${result.passed}/${result.total} (${result.accuracy || 'N/A'}%)`, 'blue');
    } else {
      log(`   ${category}: ${result ? 'PASS' : 'FAIL'}`, result ? 'green' : 'red');
    }
  });

  log('\n🏆 TEST COMPLETION STATUS:', 'bold');
  if (successRate >= 90) {
    log('   EXCELLENT - All systems working perfectly! 🌟', 'green');
  } else if (successRate >= 80) {
    log('   GOOD - Minor issues detected, overall healthy 👍', 'yellow');
  } else if (successRate >= 60) {
    log('   WARNING - Multiple issues need attention ⚠️', 'yellow');
  } else {
    log('   CRITICAL - Major problems detected 🚨', 'red');
  }

  log('\n' + '=' .repeat(60), 'blue');
}

async function runIncomeFormTests() {
  try {
    log('🚀 STARTING COMPREHENSIVE INCOME FORM API TESTING', 'bold');
    log(`📍 Target: ${BASE_URL}`, 'blue');
    log(`👤 User: ${TEST_USER_EMAIL}`, 'blue');
    log(`📅 Tax Year: ${TAX_YEAR}`, 'blue');
    log('=' .repeat(60), 'blue');

    // Authentication
    const authenticated = await authenticate();
    if (!authenticated) {
      log('\n❌ Authentication failed. Cannot proceed with tests.', 'red');
      return;
    }

    // Run all tests
    const results = {};

    results.creation = await testCreateIncomeForm() !== null;
    results.retrieval = await testRetrieveIncomeForm() !== null;
    results.update = await testUpdateIncomeForm() !== null;
    results.summary = await testIncomeFormSummary() !== null;

    const calcResults = await testExcelCalculationAccuracy();
    if (calcResults) {
      results.calculations = {
        passed: calcResults.passedTests,
        total: calcResults.calculationTests,
        accuracy: calcResults.accuracyRate
      };
    }

    const edgeResults = await testEdgeCases();
    if (edgeResults) {
      results.edgeCases = {
        passed: edgeResults.passedEdgeTests,
        total: edgeResults.edgeTests,
        accuracy: edgeResults.edgeTestAccuracy
      };
    }

    results.deletion = await testDeleteIncomeForm();

    // Generate comprehensive report
    await generateTestReport(results);

  } catch (error) {
    log(`\n💥 CRITICAL ERROR: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Execute tests
if (require.main === module) {
  runIncomeFormTests()
    .then(() => {
      log('\n✅ Income Form testing completed successfully!', 'green');
      process.exit(0);
    })
    .catch((error) => {
      log(`\n❌ Income Form testing failed: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = {
  runIncomeFormTests,
  testIncomeData
};