const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const TEST_USER = {
  email: 'khurramj@taxadvisor.pk',
  password: 'Admin@123'
};
const TAX_YEAR = '2025-26';

let authToken = '';
let userId = '';

// Color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'blue');
  console.log('='.repeat(70));
}

// Login to get auth token
async function login() {
  try {
    log('\n🔐 Logging in...', 'yellow');
    const response = await axios.post(`${BASE_URL}/api/login`, TEST_USER);

    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      userId = response.data.user.id;
      log(`✓ Login successful - User ID: ${userId}`, 'green');
      return true;
    }
    log('✗ Login failed', 'red');
    return false;
  } catch (error) {
    log(`✗ Login error: ${error.message}`, 'red');
    return false;
  }
}

// Test a GET endpoint
async function testGET(endpoint, formName) {
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      params: { taxYear: TAX_YEAR }
    });

    if (response.status === 200) {
      const hasData = response.data.data || response.data.formData || response.data;
      const dataExists = hasData && (
        (typeof hasData === 'object' && Object.keys(hasData).length > 0) ||
        (Array.isArray(hasData) && hasData.length > 0)
      );

      log(`  GET ${endpoint}`, 'yellow');
      log(`    Status: ${response.status} ✓`, 'green');
      log(`    Has Data: ${dataExists ? 'Yes' : 'No (Empty)'}`, dataExists ? 'green' : 'yellow');

      return { success: true, hasData: dataExists, endpoint };
    }
  } catch (error) {
    log(`  GET ${endpoint}`, 'yellow');
    log(`    Status: ${error.response?.status || 'ERROR'} ✗`, 'red');
    log(`    Error: ${error.response?.data?.message || error.message}`, 'red');
    return { success: false, endpoint, error: error.message };
  }
}

// Test a POST endpoint with sample data
async function testPOST(endpoint, formName, sampleData) {
  try {
    const response = await axios.post(`${BASE_URL}${endpoint}`,
      { ...sampleData, taxYear: TAX_YEAR },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    if (response.status === 200 || response.status === 201) {
      log(`  POST ${endpoint}`, 'yellow');
      log(`    Status: ${response.status} ✓`, 'green');
      log(`    Saved: ${response.data.success ? 'Yes' : 'No'}`, 'green');

      return { success: true, endpoint };
    }
  } catch (error) {
    log(`  POST ${endpoint}`, 'yellow');
    log(`    Status: ${error.response?.status || 'ERROR'} ✗`, 'red');
    log(`    Error: ${error.response?.data?.message || error.message}`, 'red');
    return { success: false, endpoint, error: error.message };
  }
}

// Main test function
async function runAllTests() {
  logSection('TAX ADVISOR API ENDPOINT COMPREHENSIVE TEST');

  // Login first
  const loginSuccess = await login();
  if (!loginSuccess) {
    log('\n❌ Cannot proceed without authentication', 'red');
    return;
  }

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    endpoints: {}
  };

  // Define all endpoints to test
  const endpoints = [
    // Income Tax Forms
    {
      name: 'Current Return',
      get: '/api/tax-forms/current-return',
      post: null
    },
    {
      name: 'Income Form',
      get: '/api/income-form/2025-26',
      post: '/api/income-form/2025-26',
      sampleData: { annual_basic_salary: 100000 }
    },
    {
      name: 'Adjustable Tax',
      get: '/api/tax-forms/adjustable-tax',
      post: '/api/tax-forms/adjustable-tax',
      sampleData: { salary_employees_149_gross_receipt: 50000 }
    },
    {
      name: 'Capital Gains',
      get: '/api/tax-forms/capital-gains',
      post: '/api/tax-forms/capital-gains',
      sampleData: { property_1_year: 0 }
    },
    {
      name: 'Final/Min Income',
      get: '/api/tax-forms/final-min-income',
      post: '/api/tax-forms/final-min-income',
      sampleData: { dividend_u_s_150_0pc_share_profit_reit_spv: 0 }
    },
    {
      name: 'Reductions',
      get: '/api/tax-forms/reductions',
      post: '/api/tax-forms/reductions',
      sampleData: { teacher_researcher_reduction_yn: 'N' }
    },
    {
      name: 'Credits',
      get: '/api/tax-forms/credits',
      post: '/api/tax-forms/credits',
      sampleData: { charitable_donations_u61_yn: 'N' }
    },
    {
      name: 'Deductions',
      get: '/api/tax-forms/deductions',
      post: '/api/tax-forms/deductions',
      sampleData: { zakat_paid_ordinance_yn: 'N' }
    },
    {
      name: 'Final Tax',
      get: '/api/tax-forms/final-tax',
      post: '/api/tax-forms/final-tax',
      sampleData: { sukuk_bonds_gross_amount: 0 }
    },
    {
      name: 'Expenses',
      get: '/api/tax-forms/expenses',
      post: '/api/tax-forms/expenses',
      sampleData: { rates_taxes_charges: 0 }
    },
    // Wealth Statement
    {
      name: 'Wealth Statement',
      get: '/api/wealth-statement/form/2025-26',
      post: '/api/wealth-statement/form/2025-26',
      sampleData: { commercial_property_curr: 0 }
    },
    // Tax Computation (no POST - calculation happens on GET)
    {
      name: 'Tax Computation',
      get: '/api/tax-computation/2025-26',
      post: null
    }
  ];

  // Test each endpoint
  for (const endpoint of endpoints) {
    logSection(`Testing: ${endpoint.name}`);

    // Test GET
    if (endpoint.get) {
      results.total++;
      const getResult = await testGET(endpoint.get, endpoint.name);
      if (getResult.success) {
        results.passed++;
        results.endpoints[endpoint.name] = { get: 'PASS', hasData: getResult.hasData };
      } else {
        results.failed++;
        results.endpoints[endpoint.name] = { get: 'FAIL', error: getResult.error };
      }
    }

    // Test POST (only if sample data provided)
    if (endpoint.post && endpoint.sampleData) {
      results.total++;
      const postResult = await testPOST(endpoint.post, endpoint.name, endpoint.sampleData);
      if (postResult.success) {
        results.passed++;
        results.endpoints[endpoint.name] = {
          ...results.endpoints[endpoint.name],
          post: 'PASS'
        };
      } else {
        results.failed++;
        results.endpoints[endpoint.name] = {
          ...results.endpoints[endpoint.name],
          post: 'FAIL',
          postError: postResult.error
        };
      }

      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Summary
  logSection('TEST SUMMARY');
  log(`\nTotal Tests: ${results.total}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`,
      results.failed === 0 ? 'green' : 'yellow');

  // Detailed results
  logSection('DETAILED RESULTS');
  for (const [name, result] of Object.entries(results.endpoints)) {
    log(`\n${name}:`, 'blue');
    log(`  GET: ${result.get || 'N/A'}${result.hasData !== undefined ? ` (Data: ${result.hasData ? 'Yes' : 'Empty'})` : ''}`,
        result.get === 'PASS' ? 'green' : 'red');
    if (result.post) {
      log(`  POST: ${result.post}`, result.post === 'PASS' ? 'green' : 'red');
    }
    if (result.error || result.postError) {
      log(`  Error: ${result.error || result.postError}`, 'red');
    }
  }

  // Database verification
  logSection('DATABASE VERIFICATION');
  log('\nChecking data in database for KhurramJ...', 'yellow');

  const { Pool } = require('pg');
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'tax_advisor',
    user: 'postgres',
    password: 'password'
  });

  const tables = [
    'income_forms',
    'adjustable_tax_forms',
    'capital_gain_forms',
    'final_min_income_forms',
    'reductions_forms',
    'credits_forms',
    'deductions_forms',
    'final_tax_forms',
    'expenses_forms',
    'wealth_statement_forms',
    'tax_computation_forms'
  ];

  for (const table of tables) {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM ${table} WHERE user_id = $1 AND tax_year = $2`,
        [userId, TAX_YEAR]
      );
      const count = parseInt(result.rows[0].count);
      log(`  ${table}: ${count} record(s)`, count > 0 ? 'green' : 'yellow');
    } catch (error) {
      log(`  ${table}: Error - ${error.message}`, 'red');
    }
  }

  await pool.end();

  // Final status
  logSection('FINAL STATUS');
  if (results.failed === 0) {
    log('\n✅ ALL TESTS PASSED - API ENDPOINTS WORKING FLAWLESSLY', 'green');
  } else {
    log(`\n⚠️  ${results.failed} TEST(S) FAILED - REVIEW ABOVE ERRORS`, 'yellow');
  }

  console.log('\n');
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Test suite error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
