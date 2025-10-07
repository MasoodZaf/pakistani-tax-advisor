const axios = require('axios');
const { Pool } = require('pg');

const BASE_URL = 'http://localhost:3001';
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'tax_advisor',
  user: 'postgres',
  password: 'password'
});

async function quickTest() {
  console.log('\n🔍 QUICK API ENDPOINT TEST\n');
  console.log('=' .repeat(70));

  let token = '';
  let userId = '';

  // Step 1: Login
  try {
    console.log('\n1. Testing Login...');
    const loginResp = await axios.post(`${BASE_URL}/api/login`, {
      email: 'khurramj@taxadvisor.pk',
      password: 'Admin@123'
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (loginResp.data.token) {
      token = loginResp.data.token;
      userId = loginResp.data.user.id;
      console.log('   ✓ Login successful');
      console.log(`   User ID: ${userId}`);
    }
  } catch (error) {
    console.log(`   ✗ Login failed: ${error.response?.data?.message || error.message}`);
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${token}` };

  // Step 2: Test all GET endpoints
  console.log('\n2. Testing GET Endpoints...\n');

  const endpoints = [
    { name: 'Current Return', url: '/api/tax-forms/current-return' },
    { name: 'Income Form', url: '/api/income-form/2025-26' },
    { name: 'Adjustable Tax', url: '/api/tax-forms/adjustable-tax?taxYear=2025-26' },
    { name: 'Capital Gains', url: '/api/tax-forms/capital-gains?taxYear=2025-26' },
    { name: 'Final/Min Income', url: '/api/tax-forms/final-min-income?taxYear=2025-26' },
    { name: 'Reductions', url: '/api/tax-forms/reductions?taxYear=2025-26' },
    { name: 'Credits', url: '/api/tax-forms/credits?taxYear=2025-26' },
    { name: 'Deductions', url: '/api/tax-forms/deductions?taxYear=2025-26' },
    { name: 'Final Tax', url: '/api/tax-forms/final-tax?taxYear=2025-26' },
    { name: 'Expenses', url: '/api/tax-forms/expenses?taxYear=2025-26' },
    { name: 'Wealth Statement', url: '/api/wealth-statement/form/2025-26' },
    { name: 'Tax Computation', url: '/api/tax-computation/2025-26' }
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const resp = await axios.get(`${BASE_URL}${endpoint.url}`, { headers });
      const hasData = resp.data && (resp.data.data || resp.data.formData || resp.data.wealthStatement);
      results.push({
        name: endpoint.name,
        status: '✓ PASS',
        hasData: hasData ? 'Yes' : 'Empty'
      });
      console.log(`   ${endpoint.name.padEnd(20)} ✓ PASS (Data: ${hasData ? 'Yes' : 'Empty'})`);
    } catch (error) {
      results.push({
        name: endpoint.name,
        status: '✗ FAIL',
        error: error.response?.status || error.message
      });
      console.log(`   ${endpoint.name.padEnd(20)} ✗ FAIL (${error.response?.status || 'ERROR'})`);
    }
  }

  // Step 3: Check database
  console.log('\n3. Checking Database Records...\n');

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

  console.log('   Records for user', userId, 'tax year 2025-26:\n');

  for (const table of tables) {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM ${table} WHERE user_id = $1 AND tax_year = $2`,
        [userId, '2025-26']
      );
      const count = parseInt(result.rows[0].count);
      const status = count > 0 ? '✓' : '○';
      console.log(`   ${status} ${table.padEnd(30)} ${count} record(s)`);
    } catch (error) {
      console.log(`   ✗ ${table.padEnd(30)} Error`);
    }
  }

  await pool.end();

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 SUMMARY\n');

  const passed = results.filter(r => r.status === '✓ PASS').length;
  const failed = results.filter(r => r.status === '✗ FAIL').length;

  console.log(`   Total Endpoints Tested: ${results.length}`);
  console.log(`   Passed: ${passed} ✓`);
  console.log(`   Failed: ${failed} ${failed > 0 ? '✗' : '✓'}`);
  console.log(`   Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n   ✅ ALL ENDPOINTS WORKING FLAWLESSLY\n');
  } else {
    console.log(`\n   ⚠️  ${failed} endpoint(s) need attention\n`);
  }
}

quickTest().catch(err => {
  console.error('\n❌ Test error:', err.message);
  process.exit(1);
});
