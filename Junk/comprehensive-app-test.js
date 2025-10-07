#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
let authToken = null;
let userId = null;

// Test results
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function log(message, status = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${status}] ${message}`);
}

function addTestResult(testName, passed, message = '') {
  testResults.tests.push({ testName, passed, message });
  if (passed) {
    testResults.passed++;
    log(`✅ ${testName}: ${message}`, 'PASS');
  } else {
    testResults.failed++;
    log(`❌ ${testName}: ${message}`, 'FAIL');
  }
}

async function testHealthCheck() {
  try {
    const response = await axios.get(`${BASE_URL}/api/health`);
    if (response.data.status === 'success' && response.data.database.connected) {
      addTestResult('Health Check', true, 'Server healthy, database connected');
      return true;
    } else {
      addTestResult('Health Check', false, 'Unexpected response format');
      return false;
    }
  } catch (error) {
    addTestResult('Health Check', false, `Error: ${error.message}`);
    return false;
  }
}

async function testUserAuthentication() {
  try {
    const response = await axios.post(`${BASE_URL}/api/login`, {
      email: 'khurramj@taxadvisor.pk',
      password: '123456'
    });

    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      userId = response.data.user.id;
      addTestResult('User Authentication', true, `Token received for user: ${response.data.user.name}`);
      return true;
    } else {
      addTestResult('User Authentication', false, 'No token received');
      return false;
    }
  } catch (error) {
    addTestResult('User Authentication', false, `Error: ${error.message}`);
    return false;
  }
}

async function testIncomeFormGet() {
  try {
    const response = await axios.get(`${BASE_URL}/api/income-form/2025-26`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.status === 200) {
      const data = response.data;
      addTestResult('Income Form GET', true, `Retrieved income data: salary=${data.annual_basic_salary}, allowances=${data.allowances}`);
      return data;
    } else {
      addTestResult('Income Form GET', false, 'Unexpected status code');
      return null;
    }
  } catch (error) {
    addTestResult('Income Form GET', false, `Error: ${error.message}`);
    return null;
  }
}

async function testIncomeFormPost() {
  try {
    const testData = {
      monthly_basic_salary: 600000,
      monthly_allowances: 50000,
      bonus: 500000,
      directorship_fee: 800000
    };

    const response = await axios.post(`${BASE_URL}/api/income-form/2025-26`, testData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success) {
      const saved = response.data.data;
      const expectedAnnualSalary = testData.monthly_basic_salary * 12; // 7,200,000
      const expectedAllowances = testData.monthly_allowances * 12; // 600,000

      // Verify calculations are correct
      const salaryCorrect = parseFloat(saved.annual_basic_salary) === expectedAnnualSalary;
      const allowancesCorrect = parseFloat(saved.allowances) === expectedAllowances;

      if (salaryCorrect && allowancesCorrect) {
        addTestResult('Income Form POST', true, `Data saved correctly with calculations: Annual salary=${saved.annual_basic_salary}, Annual allowances=${saved.allowances}`);
        return true;
      } else {
        addTestResult('Income Form POST', false, `Calculation error: Expected salary=${expectedAnnualSalary}, got=${saved.annual_basic_salary}; Expected allowances=${expectedAllowances}, got=${saved.allowances}`);
        return false;
      }
    } else {
      addTestResult('Income Form POST', false, 'Save operation failed');
      return false;
    }
  } catch (error) {
    addTestResult('Income Form POST', false, `Error: ${error.message}`);
    return false;
  }
}

async function testTaxFormsCurrentReturn() {
  try {
    const response = await axios.get(`${BASE_URL}/api/tax-forms/current-return`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.status === 200 && response.data.taxReturn) {
      addTestResult('Tax Forms Current Return', true, `Tax return loaded: ${response.data.taxReturn.id}`);
      return true;
    } else {
      addTestResult('Tax Forms Current Return', false, 'No tax return found');
      return false;
    }
  } catch (error) {
    addTestResult('Tax Forms Current Return', false, `Error: ${error.message}`);
    return false;
  }
}

async function testCalculationAccuracy() {
  try {
    // Test multiple calculation scenarios
    const testCases = [
      { monthly: 500000, expectedAnnual: 6000000 },
      { monthly: 750000, expectedAnnual: 9000000 },
      { monthly: 100000, expectedAnnual: 1200000 }
    ];

    let allCorrect = true;
    for (const testCase of testCases) {
      const response = await axios.post(`${BASE_URL}/api/income-form/2025-26`, {
        monthly_basic_salary: testCase.monthly,
        monthly_allowances: 0,
        bonus: 0
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (response.data.success) {
        const actualAnnual = parseFloat(response.data.data.annual_basic_salary);
        if (actualAnnual !== testCase.expectedAnnual) {
          allCorrect = false;
          break;
        }
      } else {
        allCorrect = false;
        break;
      }
    }

    if (allCorrect) {
      addTestResult('Calculation Accuracy', true, 'All monthly-to-annual calculations correct');
      return true;
    } else {
      addTestResult('Calculation Accuracy', false, 'Calculation errors detected');
      return false;
    }
  } catch (error) {
    addTestResult('Calculation Accuracy', false, `Error: ${error.message}`);
    return false;
  }
}

async function testDataPersistence() {
  try {
    // Save some data
    const uniqueValue = Math.floor(Math.random() * 1000000);
    await axios.post(`${BASE_URL}/api/income-form/2025-26`, {
      monthly_basic_salary: uniqueValue,
      bonus: 123456
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Retrieve the data
    const response = await axios.get(`${BASE_URL}/api/income-form/2025-26`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const expectedAnnual = uniqueValue * 12;
    const actualAnnual = parseFloat(response.data.annual_basic_salary);

    if (actualAnnual === expectedAnnual && parseFloat(response.data.bonus) === 123456) {
      addTestResult('Data Persistence', true, `Data persisted correctly: ${uniqueValue} -> ${actualAnnual}`);
      return true;
    } else {
      addTestResult('Data Persistence', false, `Data not persisted correctly: expected ${expectedAnnual}, got ${actualAnnual}`);
      return false;
    }
  } catch (error) {
    addTestResult('Data Persistence', false, `Error: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  log('Starting comprehensive application test...', 'START');

  // Test sequence
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    log('Health check failed, stopping tests', 'ERROR');
    return;
  }

  const authOk = await testUserAuthentication();
  if (!authOk) {
    log('Authentication failed, stopping tests', 'ERROR');
    return;
  }

  // Run all API tests
  await testIncomeFormGet();
  await testIncomeFormPost();
  await testTaxFormsCurrentReturn();
  await testCalculationAccuracy();
  await testDataPersistence();

  // Summary
  log('\n========================================', 'SUMMARY');
  log(`Total Tests: ${testResults.passed + testResults.failed}`, 'SUMMARY');
  log(`Passed: ${testResults.passed}`, 'SUMMARY');
  log(`Failed: ${testResults.failed}`, 'SUMMARY');
  log(`Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`, 'SUMMARY');
  log('========================================\n', 'SUMMARY');

  if (testResults.failed > 0) {
    log('FAILED TESTS:', 'SUMMARY');
    testResults.tests.filter(t => !t.passed).forEach(test => {
      log(`  - ${test.testName}: ${test.message}`, 'SUMMARY');
    });
  }

  const allPassed = testResults.failed === 0;
  log(`APPLICATION STATUS: ${allPassed ? 'HEALTHY ✅' : 'ISSUES DETECTED ❌'}`, allPassed ? 'SUCCESS' : 'FAIL');

  process.exit(allPassed ? 0 : 1);
}

// Run the tests
runAllTests().catch(error => {
  log(`Fatal error: ${error.message}`, 'FATAL');
  process.exit(1);
});