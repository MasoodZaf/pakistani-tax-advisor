const axios = require('axios');
const { pool } = require('./src/config/database');

const BASE_URL = 'http://localhost:3001';
const TEST_TAX_YEAR = '2023';

// Test session token (you'll need to get this from a real login)
let authToken = null;

console.log('=== Testing Reports API Endpoints ===\n');

async function getAuthToken() {
  try {
    // First get a valid user session
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@taxadvisor.com',
      password: 'admin123'
    });

    authToken = loginResponse.data.data.sessionToken;
    console.log('Successfully authenticated for testing');
    return true;
  } catch (error) {
    console.error('Failed to authenticate:', error.response?.data || error.message);
    return false;
  }
}

async function testTaxSummaryEndpoint() {
  console.log('\n=== Test 1: Tax Summary Endpoint ===');

  try {
    const response = await axios.get(`${BASE_URL}/api/reports/tax-calculation-summary/${TEST_TAX_YEAR}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = response.data.data;
    console.log('Tax Summary Response Structure:');
    console.log('- Raw Data Present:', !!data.rawData);
    console.log('- Calculations Present:', !!data.calculations);
    console.log('- Formatted Income Present:', !!data.income);

    if (data.calculations) {
      console.log('\nCalculated Values:');
      console.log('- Gross Income:', data.calculations.grossIncome);
      console.log('- Taxable Income:', data.calculations.taxableIncome);
      console.log('- Normal Tax:', data.calculations.normalTax);
      console.log('- Total Tax Liability:', data.calculations.totalTaxLiability);

      // Check if these are proper numbers, not concatenated strings
      console.log('\nData Type Validation:');
      console.log('- Gross Income is number:', typeof data.calculations.grossIncome === 'number');
      console.log('- Taxable Income is number:', typeof data.calculations.taxableIncome === 'number');
      console.log('- Normal Tax is number:', typeof data.calculations.normalTax === 'number');
      console.log('- Values are not NaN:', !isNaN(data.calculations.grossIncome));
    }

    if (data.income) {
      console.log('\nFormatted Income Data:');
      console.log('- Total Taxable Income:', data.income.total_taxable_income);
      console.log('- Total Gross Income:', data.income.total_gross_income);
      console.log('- Is using calculated values:', data.income.total_taxable_income === data.calculations?.taxableIncome);
    }

  } catch (error) {
    console.error('Tax Summary test failed:', error.response?.data || error.message);
  }
}

async function testIncomeAnalysisEndpoint() {
  console.log('\n=== Test 2: Income Analysis Endpoint ===');

  try {
    const response = await axios.get(`${BASE_URL}/api/reports/income-analysis/${TEST_TAX_YEAR}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = response.data.data;
    console.log('Income Analysis Response Structure:');
    console.log('- Regular Income Present:', !!data.regularIncome);
    console.log('- Capital Gains Present:', !!data.capitalGains);
    console.log('- Final Tax Income Present:', !!data.finalTaxIncome);

    if (data.regularIncome) {
      console.log('\nRegular Income Data:');
      console.log('- Total Taxable Income:', data.regularIncome.total_taxable_income);
      console.log('- Total Gross Income:', data.regularIncome.total_gross_income);
      console.log('- Monthly Salary:', data.regularIncome.monthly_salary);
      console.log('- Bonus:', data.regularIncome.bonus);

      // Check if SQL calculation is working (should be numeric)
      console.log('- Total Taxable is number:', typeof parseFloat(data.regularIncome.total_taxable_income) === 'number');
      console.log('- Total Taxable not NaN:', !isNaN(parseFloat(data.regularIncome.total_taxable_income)));
    }

  } catch (error) {
    console.error('Income Analysis test failed:', error.response?.data || error.message);
  }
}

async function testAdjustableTaxEndpoint() {
  console.log('\n=== Test 3: Adjustable Tax Report Endpoint ===');

  try {
    const response = await axios.get(`${BASE_URL}/api/reports/adjustable-tax-report/${TEST_TAX_YEAR}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = response.data.data;
    console.log('Adjustable Tax Response Structure:');
    console.log('- Total Adjustable Tax:', data.totalAdjustableTax);
    console.log('- Categories Present:', !!data.categories);

    if (data.categories) {
      console.log('\nAdjustable Tax Categories:');
      console.log('- Employment:', data.categories.employment);
      console.log('- Utilities:', data.categories.utilities);
      console.log('- Motor Vehicle:', data.categories.motorVehicle);

      // Check if values are properly formatted
      console.log('- Total is number:', typeof data.totalAdjustableTax === 'number');
      console.log('- Salary tax is number:', typeof data.categories.employment?.salaryTax === 'number');
    }

  } catch (error) {
    console.error('Adjustable Tax test failed:', error.response?.data || error.message);
  }
}

async function testWealthReportEndpoint() {
  console.log('\n=== Test 4: Wealth Reconciliation Endpoint ===');

  try {
    const response = await axios.get(`${BASE_URL}/api/reports/wealth-reconciliation/${TEST_TAX_YEAR}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = response.data.data;
    console.log('Wealth Report Response Structure:');
    console.log('- Wealth Statement Present:', !!data.wealthStatement);
    console.log('- Wealth Reconciliation Present:', !!data.wealthReconciliation);
    console.log('- Total Taxable Income:', data.totalTaxableIncome);
    console.log('- Total Expenses:', data.totalExpenses);

    // Check if the income calculation is using our fixed SQL
    console.log('\nWealth Report Validation:');
    console.log('- Income is number:', typeof data.totalTaxableIncome === 'number');
    console.log('- Income not NaN:', !isNaN(data.totalTaxableIncome));
    console.log('- Expenses is number:', typeof data.totalExpenses === 'number');

  } catch (error) {
    console.error('Wealth Report test failed:', error.response?.data || error.message);
  }
}

async function testDirectDatabaseQueries() {
  console.log('\n=== Test 5: Direct Database Validation ===');

  try {
    // Test the actual SQL queries being used in reports
    console.log('Testing SQL queries used in reports endpoints:');

    // Test the fixed income calculation query
    const incomeQuery = await pool.query(`
      SELECT
        monthly_salary,
        bonus,
        car_allowance,
        (COALESCE(monthly_salary::numeric, 0) + COALESCE(bonus::numeric, 0) + COALESCE(car_allowance::numeric, 0)) as total_calculated,
        pg_typeof((COALESCE(monthly_salary::numeric, 0) + COALESCE(bonus::numeric, 0) + COALESCE(car_allowance::numeric, 0))) as calc_type
      FROM income_forms
      WHERE monthly_salary IS NOT NULL OR bonus IS NOT NULL
      LIMIT 1
    `);

    if (incomeQuery.rows.length > 0) {
      const row = incomeQuery.rows[0];
      console.log('- SQL Query Result Type:', row.calc_type);
      console.log('- Individual values:', row.monthly_salary, row.bonus, row.car_allowance);
      console.log('- SQL Calculated Total:', row.total_calculated);
      console.log('- Manual JS Total:', (parseFloat(row.monthly_salary) || 0) + (parseFloat(row.bonus) || 0) + (parseFloat(row.car_allowance) || 0));
      console.log('- Results Match:', Math.abs(parseFloat(row.total_calculated) - ((parseFloat(row.monthly_salary) || 0) + (parseFloat(row.bonus) || 0) + (parseFloat(row.car_allowance) || 0))) < 0.01);
    }

  } catch (error) {
    console.error('Database validation failed:', error.message);
  }
}

async function runAllTests() {
  console.log('Starting comprehensive reports API tests...\n');

  const authenticated = await getAuthToken();
  if (!authenticated) {
    console.log('Cannot proceed without authentication');
    return;
  }

  await testTaxSummaryEndpoint();
  await testIncomeAnalysisEndpoint();
  await testAdjustableTaxEndpoint();
  await testWealthReportEndpoint();
  await testDirectDatabaseQueries();

  console.log('\n=== All Reports API Tests Completed ===');

  // Close database connection
  await pool.end();
}

runAllTests().catch(console.error);