/**
 * Comprehensive API Endpoint Testing Script
 * Tests all database GET/POST operations
 * Run: node test-all-api-endpoints.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
const TAX_YEAR = '2025-26';

// Test user credentials (KhurramJ)
const TEST_USER = {
  email: 'khurramj@taxadvisor.pk',
  password: 'password123'  // Update with actual password
};

let authToken = '';
let sessionToken = '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

function logTest(name) {
  log(`\n🧪 Testing: ${name}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'yellow');
}

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function recordTest(name, passed, error = null) {
  results.tests.push({ name, passed, error });
  if (passed) {
    results.passed++;
    logSuccess(`PASSED: ${name}`);
  } else {
    results.failed++;
    logError(`FAILED: ${name}`);
    if (error) logError(`  Error: ${error.message}`);
  }
}

//=============================================================================
// AUTHENTICATION TESTS
//=============================================================================

async function testAuthentication() {
  logSection('AUTHENTICATION ENDPOINTS');

  // Test 1: Login
  logTest('POST /auth/login');
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);

    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      sessionToken = response.data.sessionToken;
      logSuccess(`Login successful - Token received`);
      logInfo(`User: ${response.data.user.name} (${response.data.user.role})`);
      recordTest('Login', true);
    } else {
      throw new Error('No token in response');
    }
  } catch (error) {
    recordTest('Login', false, error);
    throw error; // Stop if login fails
  }

  // Test 2: Verify Session
  logTest('POST /auth/verify-session');
  try {
    const response = await axios.post(`${BASE_URL}/auth/verify-session`, {
      sessionToken
    });

    if (response.data.success && response.data.user) {
      logSuccess(`Session verified - User: ${response.data.user.email}`);
      recordTest('Verify Session', true);
    } else {
      throw new Error('Invalid session response');
    }
  } catch (error) {
    recordTest('Verify Session', false, error);
  }
}

//=============================================================================
// INCOME FORM TESTS
//=============================================================================

async function testIncomeForm() {
  logSection('INCOME FORM ENDPOINTS');

  const headers = { Authorization: `Bearer ${authToken}` };

  // Test 1: GET Income Form
  logTest(`GET /income-form/${TAX_YEAR}`);
  try {
    const response = await axios.get(`${BASE_URL}/income-form/${TAX_YEAR}`, { headers });

    if (response.data) {
      logSuccess(`Income form retrieved`);
      logInfo(`Annual Salary: ${response.data.annual_basic_salary}`);
      logInfo(`Total Employment Income: ${response.data.total_employment_income}`);
      recordTest('GET Income Form', true);
    } else {
      throw new Error('No data in response');
    }
  } catch (error) {
    recordTest('GET Income Form', false, error);
  }

  // Test 2: POST Income Form (Update)
  logTest(`POST /income-form/${TAX_YEAR}`);
  try {
    const testData = {
      annual_basic_salary: 7200000,
      bonus: 1500000,
      taxable_car_value: 50000,
      medical_allowance: 400000,
      employer_contribution_provident: 100000
    };

    const response = await axios.post(
      `${BASE_URL}/income-form/${TAX_YEAR}`,
      testData,
      { headers }
    );

    if (response.data.success) {
      logSuccess(`Income form saved`);
      logInfo(`Saved Salary: ${response.data.data.annual_basic_salary}`);
      recordTest('POST Income Form', true);
    } else {
      throw new Error('Save failed');
    }
  } catch (error) {
    recordTest('POST Income Form', false, error);
  }

  // Test 3: GET Income Form Summary
  logTest(`GET /income-form/${TAX_YEAR}/summary`);
  try {
    const response = await axios.get(
      `${BASE_URL}/income-form/${TAX_YEAR}/summary`,
      { headers }
    );

    if (response.data.success && response.data.data) {
      logSuccess(`Income summary retrieved`);
      logInfo(`Total Income: ${response.data.data.total_income}`);
      recordTest('GET Income Form Summary', true);
    } else {
      throw new Error('No summary data');
    }
  } catch (error) {
    recordTest('GET Income Form Summary', false, error);
  }
}

//=============================================================================
// TAX COMPUTATION TESTS
//=============================================================================

async function testTaxComputation() {
  logSection('TAX COMPUTATION ENDPOINTS');

  const headers = { Authorization: `Bearer ${authToken}` };

  // Test 1: GET Tax Computation
  logTest(`GET /tax-computation/${TAX_YEAR}`);
  try {
    const response = await axios.get(
      `${BASE_URL}/tax-computation/${TAX_YEAR}`,
      { headers }
    );

    if (response.data.success && response.data.data) {
      logSuccess(`Tax computation calculated`);
      logInfo(`Income from Salary: ${response.data.data.income_from_salary}`);
      logInfo(`Normal Income Tax: ${response.data.data.normal_income_tax}`);
      logInfo(`Total Tax Liability: ${response.data.data.total_tax_liability}`);
      recordTest('GET Tax Computation', true);
    } else {
      throw new Error('No computation data');
    }
  } catch (error) {
    recordTest('GET Tax Computation', false, error);
  }

  // Test 2: GET Tax Summary
  logTest(`GET /tax-computation/${TAX_YEAR}/summary`);
  try {
    const response = await axios.get(
      `${BASE_URL}/tax-computation/${TAX_YEAR}/summary`,
      { headers }
    );

    if (response.data.success && response.data.data) {
      logSuccess(`Tax summary retrieved`);
      recordTest('GET Tax Summary', true);
    } else {
      throw new Error('No summary data');
    }
  } catch (error) {
    recordTest('GET Tax Summary', false, error);
  }

  // Test 3: GET Income Data
  logTest(`GET /tax-computation/${TAX_YEAR}/income-data`);
  try {
    const response = await axios.get(
      `${BASE_URL}/tax-computation/${TAX_YEAR}/income-data`,
      { headers }
    );

    if (response.data.success && response.data.data) {
      logSuccess(`Income data retrieved with Excel references`);
      logInfo(`Excel B16: ${response.data.excelReferences['B16']}`);
      recordTest('GET Income Data', true);
    } else {
      throw new Error('No income data');
    }
  } catch (error) {
    recordTest('GET Income Data', false, error);
  }

  // Test 4: GET Adjustable Data
  logTest(`GET /tax-computation/${TAX_YEAR}/adjustable-data`);
  try {
    const response = await axios.get(
      `${BASE_URL}/tax-computation/${TAX_YEAR}/adjustable-data`,
      { headers }
    );

    if (response.data.success && response.data.data) {
      logSuccess(`Adjustable tax data retrieved`);
      recordTest('GET Adjustable Data', true);
    } else {
      throw new Error('No adjustable data');
    }
  } catch (error) {
    recordTest('GET Adjustable Data', false, error);
  }
}

//=============================================================================
// PERSONAL INFO TESTS
//=============================================================================

async function testPersonalInfo() {
  logSection('PERSONAL INFO ENDPOINTS');

  const headers = { Authorization: `Bearer ${authToken}` };

  // Test 1: GET Personal Info
  logTest(`GET /personal-info/${TAX_YEAR}`);
  try {
    const response = await axios.get(
      `${BASE_URL}/personal-info/${TAX_YEAR}`,
      { headers }
    );

    if (response.data) {
      logSuccess(`Personal info retrieved`);
      if (response.data.full_name) {
        logInfo(`Name: ${response.data.full_name}`);
        logInfo(`CNIC: ${response.data.cnic}`);
      }
      recordTest('GET Personal Info', true);
    } else {
      throw new Error('No data in response');
    }
  } catch (error) {
    recordTest('GET Personal Info', false, error);
  }

  // Test 2: POST Personal Info (Update)
  logTest(`POST /personal-info/${TAX_YEAR}`);
  try {
    const testData = {
      full_name: 'Khurram Jamili',
      cnic: '12345-6789012-3',
      date_of_birth: '1980-01-01',
      mobile_number: '03001234567',
      ntn: 'NTN123456789',
      residential_status: 'resident'
    };

    const response = await axios.post(
      `${BASE_URL}/personal-info/${TAX_YEAR}`,
      testData,
      { headers }
    );

    if (response.data.success || response.data.id) {
      logSuccess(`Personal info saved`);
      recordTest('POST Personal Info', true);
    } else {
      throw new Error('Save failed');
    }
  } catch (error) {
    recordTest('POST Personal Info', false, error);
  }
}

//=============================================================================
// ADMIN ENDPOINTS TESTS (if user has admin access)
//=============================================================================

async function testAdminEndpoints() {
  logSection('ADMIN ENDPOINTS (if accessible)');

  const headers = { Authorization: `Bearer ${authToken}` };

  // Test 1: GET All Users
  logTest('GET /admin/users');
  try {
    const response = await axios.get(`${BASE_URL}/admin/users`, { headers });

    if (response.data.success && response.data.users) {
      logSuccess(`Users list retrieved - Count: ${response.data.users.length}`);
      recordTest('GET All Users', true);
    } else {
      throw new Error('No users data');
    }
  } catch (error) {
    if (error.response && error.response.status === 403) {
      logInfo('Skipped - Not an admin user');
      recordTest('GET All Users', true); // Not a failure, just not accessible
    } else {
      recordTest('GET All Users', false, error);
    }
  }

  // Test 2: GET System Settings
  logTest('GET /admin/system-settings');
  try {
    const response = await axios.get(`${BASE_URL}/admin/system-settings`, { headers });

    if (response.data) {
      logSuccess(`System settings retrieved`);
      recordTest('GET System Settings', true);
    } else {
      throw new Error('No settings data');
    }
  } catch (error) {
    if (error.response && error.response.status === 403) {
      logInfo('Skipped - Not an admin user');
      recordTest('GET System Settings', true);
    } else {
      recordTest('GET System Settings', false, error);
    }
  }
}

//=============================================================================
// DATABASE DIRECT VERIFICATION
//=============================================================================

async function verifyDatabaseSync() {
  logSection('DATABASE VERIFICATION');

  logTest('Verify data was actually saved to database');
  try {
    const { pool } = require('./src/config/database');

    // Get income form from database
    const result = await pool.query(
      `SELECT annual_basic_salary, bonus, total_employment_income
       FROM income_forms
       WHERE user_id = (SELECT id FROM users WHERE email = $1)
       AND tax_year = $2`,
      [TEST_USER.email, TAX_YEAR]
    );

    if (result.rows.length > 0) {
      const data = result.rows[0];
      logSuccess(`Database sync verified`);
      logInfo(`DB Annual Salary: ${data.annual_basic_salary}`);
      logInfo(`DB Bonus: ${data.bonus}`);
      logInfo(`DB Total Employment: ${data.total_employment_income}`);

      // Verify match with expected values
      if (data.annual_basic_salary === '7200000.00' && data.bonus === '1500000.00') {
        logSuccess(`Data matches expected values`);
        recordTest('Database Sync Verification', true);
      } else {
        throw new Error('Data mismatch');
      }
    } else {
      throw new Error('No data found in database');
    }

    await pool.end();
  } catch (error) {
    recordTest('Database Sync Verification', false, error);
  }
}

//=============================================================================
// MAIN TEST RUNNER
//=============================================================================

async function runAllTests() {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'bright');
  log('║     Pakistani Tax Advisor - API Endpoint Testing         ║', 'bright');
  log('╚═══════════════════════════════════════════════════════════╝', 'bright');

  log('\n📋 Test Configuration:', 'cyan');
  logInfo(`Base URL: ${BASE_URL}`);
  logInfo(`Tax Year: ${TAX_YEAR}`);
  logInfo(`Test User: ${TEST_USER.email}`);

  try {
    await testAuthentication();
    await testIncomeForm();
    await testTaxComputation();
    await testPersonalInfo();
    await testAdminEndpoints();
    await verifyDatabaseSync();

  } catch (error) {
    logError(`\nCritical error occurred: ${error.message}`);
  }

  // Print final results
  logSection('TEST RESULTS SUMMARY');

  log(`\nTotal Tests: ${results.tests.length}`, 'bright');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, 'red');

  const passRate = ((results.passed / results.tests.length) * 100).toFixed(1);
  log(`\n📊 Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'red');

  if (results.failed > 0) {
    log('\n\nFailed Tests:', 'red');
    results.tests
      .filter(t => !t.passed)
      .forEach(t => {
        log(`  • ${t.name}`, 'red');
        if (t.error) log(`    ${t.error.message}`, 'yellow');
      });
  }

  log('\n' + '='.repeat(60) + '\n');

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  logError(`\nUnhandled error: ${error.message}`);
  process.exit(1);
});
