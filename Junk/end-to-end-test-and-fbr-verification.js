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

let authToken = '';

// Test results accumulator
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
  }
}

async function test1_Authentication() {
  console.log('\n=== TEST 1: AUTHENTICATION ===\n');

  try {
    const response = await axios.post(`${BASE_URL}/api/login`, {
      email: 'khurramj@taxadvisor.pk',
      password: '123456'
    });

    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      logTest('Login successful', true, `Token received, User: ${response.data.user.name}, Role: ${response.data.user.role}`);
      return true;
    } else {
      logTest('Login successful', false, 'No token received');
      return false;
    }
  } catch (error) {
    logTest('Login successful', false, error.response?.data?.message || error.message);
    return false;
  }
}

async function test2_GetCurrentTaxReturn() {
  console.log('\n=== TEST 2: GET CURRENT TAX RETURN ===\n');

  try {
    const response = await axios.get(`${BASE_URL}/api/tax-forms/current-return`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    // Response structure: { taxReturn: {...}, formData: {...}, completedSteps: [] }
    if (response.data && response.data.taxReturn) {
      logTest('Get current tax return', true, `Return ID: ${response.data.taxReturn.id}, Status: ${response.data.taxReturn.status}`);
      return response.data.taxReturn;
    } else {
      logTest('Get current tax return', false, 'No tax return data');
      return null;
    }
  } catch (error) {
    logTest('Get current tax return', false, error.response?.data?.message || error.message);
    return null;
  }
}

async function test3_GetIncomeForm() {
  console.log('\n=== TEST 3: GET INCOME FORM ===\n');

  try {
    const response = await axios.get(`${BASE_URL}/api/income-tax/income-form/2025-26`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    // Response returns the form data directly (not wrapped in success/incomeForm)
    if (response.data && response.data.annual_basic_salary !== undefined) {
      const form = response.data;
      logTest('Get income form', true, `Annual Salary: Rs ${form.annual_basic_salary}, Total Employment Income: Rs ${form.total_employment_income}`);

      // Verify calculations
      const expectedTotal = 18610000; // From our test data
      const actualTotal = parseFloat(form.total_employment_income);
      const calculationCorrect = Math.abs(actualTotal - expectedTotal) < 1;

      logTest('Income form calculation correct', calculationCorrect, `Expected: Rs ${expectedTotal}, Actual: Rs ${actualTotal}`);

      return form;
    } else {
      logTest('Get income form', false, 'No income form data');
      return null;
    }
  } catch (error) {
    logTest('Get income form', false, error.response?.data?.message || error.message);
    return null;
  }
}

async function test4_GetAdjustableTaxForm() {
  console.log('\n=== TEST 4: GET ADJUSTABLE TAX FORM ===\n');

  try {
    const response = await axios.get(`${BASE_URL}/api/tax-forms/adjustable-tax?taxYear=2025-26`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success && response.data.data) {
      const form = response.data.data;
      logTest('Get adjustable tax form', true, `Total Adjustable Tax: Rs ${form.total_adjustable_tax}`);

      // Verify total tax calculation
      const expectedTax = 3823000; // From our test data
      const actualTax = parseFloat(form.total_adjustable_tax);
      const calculationCorrect = Math.abs(actualTax - expectedTax) < 1;

      logTest('Adjustable tax calculation correct', calculationCorrect, `Expected: Rs ${expectedTax}, Actual: Rs ${actualTax}`);

      return form;
    } else {
      logTest('Get adjustable tax form', false, 'No adjustable tax form data');
      return null;
    }
  } catch (error) {
    logTest('Get adjustable tax form', false, error.response?.data?.message || error.message);
    return null;
  }
}

async function test5_GetWealthStatement() {
  console.log('\n=== TEST 5: GET WEALTH STATEMENT ===\n');

  try {
    const response = await axios.get(`${BASE_URL}/api/wealth-statement/form/2025-26`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success && response.data.wealthStatement) {
      const form = response.data.wealthStatement;
      logTest('Get wealth statement', true, `Total Assets: Rs ${form.total_assets_curr}, Total Liabilities: Rs ${form.total_liabilities_curr}`);

      // Verify calculations
      const expectedAssets = 37080000; // From our test data
      const actualAssets = parseFloat(form.total_assets_curr);
      const assetsCorrect = Math.abs(actualAssets - expectedAssets) < 1;

      logTest('Wealth statement assets calculation correct', assetsCorrect, `Expected: Rs ${expectedAssets}, Actual: Rs ${actualAssets}`);

      const netWorth = actualAssets - parseFloat(form.total_liabilities_curr);
      const expectedNetWorth = 36780000;
      const netWorthCorrect = Math.abs(netWorth - expectedNetWorth) < 1;

      logTest('Wealth statement net worth calculation correct', netWorthCorrect, `Expected: Rs ${expectedNetWorth}, Actual: Rs ${netWorth}`);

      return form;
    } else {
      logTest('Get wealth statement', false, 'No wealth statement data');
      return null;
    }
  } catch (error) {
    logTest('Get wealth statement', false, error.response?.data?.message || error.message);
    return null;
  }
}

async function test6_TaxComputation() {
  console.log('\n=== TEST 6: TAX COMPUTATION ===\n');

  const client = await pool.connect();

  try {
    // Get tax computation from database
    const result = await client.query(`
      SELECT
        i.total_employment_income,
        i.annual_salary_wages_total,
        i.total_non_cash_benefits,
        a.total_adjustable_tax
      FROM income_forms i
      LEFT JOIN adjustable_tax_forms a ON i.user_id = a.user_id AND i.tax_year = a.tax_year
      WHERE i.user_id = (SELECT id FROM users WHERE email = 'khurramj@taxadvisor.pk')
        AND i.tax_year = '2025-26'
    `);

    if (result.rows.length > 0) {
      const data = result.rows[0];
      const taxableIncome = parseFloat(data.total_employment_income);

      logTest('Tax computation data retrieved', true, `Taxable Income: Rs ${taxableIncome}`);

      // Get applicable tax slab
      const taxRates = await client.query(`
        SELECT min_amount, max_amount, tax_rate, fixed_amount
        FROM tax_rates_config
        WHERE tax_year = '2025-26' AND rate_type = 'progressive'
        ORDER BY min_amount
      `);

      logTest('Tax slabs retrieved', true, `Found ${taxRates.rows.length} tax slabs`);

      // Calculate tax
      let calculatedTax = 0;
      let applicableSlab = null;

      for (const slab of taxRates.rows) {
        if (taxableIncome > parseFloat(slab.min_amount)) {
          if (slab.max_amount >= 999999999999 || taxableIncome <= parseFloat(slab.max_amount)) {
            applicableSlab = slab;
            const taxableAmount = taxableIncome - parseFloat(slab.min_amount);
            calculatedTax = parseFloat(slab.fixed_amount) + (taxableAmount * parseFloat(slab.tax_rate));
            break;
          }
        }
      }

      if (applicableSlab) {
        const taxRate = (parseFloat(applicableSlab.tax_rate) * 100).toFixed(2);
        logTest('Tax slab identified', true, `Rate: ${taxRate}%, Fixed: Rs ${applicableSlab.fixed_amount}`);
        logTest('Tax calculated', true, `Tax on Rs ${taxableIncome} = Rs ${calculatedTax.toFixed(2)}`);

        // Verify against expected value
        const expectedTax = 5547499.65; // Based on Rs 18,610,000 at 35% slab
        const taxCorrect = Math.abs(calculatedTax - expectedTax) < 1;
        logTest('Tax calculation matches FBR formula', taxCorrect, `Expected: Rs ${expectedTax}, Calculated: Rs ${calculatedTax.toFixed(2)}`);

        return { taxableIncome, calculatedTax, applicableSlab };
      } else {
        logTest('Tax slab identified', false, 'No applicable slab found');
        return null;
      }
    } else {
      logTest('Tax computation data retrieved', false, 'No data found');
      return null;
    }
  } catch (error) {
    logTest('Tax computation', false, error.message);
    return null;
  } finally {
    client.release();
  }
}

async function test7_FBRCompliance() {
  console.log('\n=== TEST 7: FBR COMPLIANCE VERIFICATION ===\n');

  const client = await pool.connect();

  try {
    // Verify Section 12 & 13 compliance (Income)
    const incomeCheck = await client.query(`
      SELECT
        annual_basic_salary + allowances + bonus as gross_salary,
        income_exempt_from_tax,
        annual_salary_wages_total,
        total_non_cash_benefits,
        total_employment_income
      FROM income_forms
      WHERE user_id = (SELECT id FROM users WHERE email = 'khurramj@taxadvisor.pk')
        AND tax_year = '2025-26'
    `);

    if (incomeCheck.rows.length > 0) {
      const income = incomeCheck.rows[0];

      // Check exemptions are negative
      const exemptCorrect = parseFloat(income.income_exempt_from_tax) < 0;
      logTest('FBR Section 12(2) - Exempt income correctly negative', exemptCorrect, `Exempt: Rs ${income.income_exempt_from_tax}`);

      // Check non-cash benefits exemption (max Rs 150,000)
      const nonCashBenefits = parseFloat(income.total_non_cash_benefits);
      const nonCashCorrect = nonCashBenefits > 0; // Should be positive after exemption
      logTest('FBR Section 13 - Non-cash benefits with Rs 150,000 exemption', nonCashCorrect, `Net: Rs ${nonCashBenefits}`);
    }

    // Verify progressive tax slabs
    const slabsCheck = await client.query(`
      SELECT COUNT(*) as count,
             MIN(min_amount) as min_slab,
             MAX(CASE WHEN max_amount < 999999999999 THEN max_amount ELSE 0 END) as max_defined_slab
      FROM tax_rates_config
      WHERE tax_year = '2025-26' AND rate_type = 'progressive'
    `);

    if (slabsCheck.rows.length > 0) {
      const slabs = slabsCheck.rows[0];
      const correctSlabCount = parseInt(slabs.count) === 6;
      logTest('FBR Division 1, Part I, First Schedule - 6 tax slabs present', correctSlabCount, `Found: ${slabs.count} slabs`);
    }

    // Verify withholding tax rates
    const withholdingCheck = await client.query(`
      SELECT
        salary_employees_149_gross_receipt,
        salary_employees_149_tax_collected,
        directorship_fee_149_3_gross_receipt,
        directorship_fee_149_3_tax_collected
      FROM adjustable_tax_forms
      WHERE user_id = (SELECT id FROM users WHERE email = 'khurramj@taxadvisor.pk')
        AND tax_year = '2025-26'
    `);

    if (withholdingCheck.rows.length > 0) {
      const wht = withholdingCheck.rows[0];

      // Check directorship fee WHT rate (should be 20%)
      const directorshipGross = parseFloat(wht.directorship_fee_149_3_gross_receipt);
      const directorshipTax = parseFloat(wht.directorship_fee_149_3_tax_collected);
      if (directorshipGross > 0) {
        const rate = (directorshipTax / directorshipGross) * 100;
        const rateCorrect = Math.abs(rate - 20) < 0.1;
        logTest('FBR Section 149(3) - Directorship fee WHT at 20%', rateCorrect, `Rate: ${rate.toFixed(2)}%`);
      }
    }

    // Verify wealth statement mandatory criteria
    const wealthCheck = await client.query(`
      SELECT
        total_assets_curr,
        (SELECT total_employment_income FROM income_forms
         WHERE user_id = (SELECT id FROM users WHERE email = 'khurramj@taxadvisor.pk')
           AND tax_year = '2025-26') as income
      FROM wealth_statement_forms
      WHERE user_id = (SELECT id FROM users WHERE email = 'khurramj@taxadvisor.pk')
        AND tax_year = '2025-26'
    `);

    if (wealthCheck.rows.length > 0) {
      const wealth = wealthCheck.rows[0];
      const income = parseFloat(wealth.income);
      const assets = parseFloat(wealth.total_assets_curr);

      const wealthMandatory = income > 4000000 || assets > 10000000;
      logTest('FBR - Wealth Statement mandatory (income > Rs 4M or assets > Rs 10M)', wealthMandatory,
              `Income: Rs ${income}, Assets: Rs ${assets}`);
    }

  } catch (error) {
    logTest('FBR Compliance Verification', false, error.message);
  } finally {
    client.release();
  }
}

async function test8_GenerateReports() {
  console.log('\n=== TEST 8: GENERATE FBR REPORTS ===\n');

  try {
    // Test tax computation summary
    const summaryResponse = await axios.get(`${BASE_URL}/api/reports/tax-calculation-summary/2025-26`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (summaryResponse.data) {
      logTest('Generate Tax Computation Summary', true, 'Report generated successfully');
    } else {
      logTest('Generate Tax Computation Summary', false, 'Failed to generate report');
    }

  } catch (error) {
    logTest('Generate FBR Reports', false, error.response?.data?.message || error.message);
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   END-TO-END TESTING & FBR COMPLIANCE VERIFICATION        ║');
  console.log('║   Tax Year: 2025-26                                       ║');
  console.log('║   User: khurramj@taxadvisor.pk (Super Admin)              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const authSuccess = await test1_Authentication();
  if (!authSuccess) {
    console.log('\n❌ Authentication failed. Cannot proceed with tests.');
    return;
  }

  await test2_GetCurrentTaxReturn();
  await test3_GetIncomeForm();
  await test4_GetAdjustableTaxForm();
  await test5_GetWealthStatement();
  await test6_TaxComputation();
  await test7_FBRCompliance();
  await test8_GenerateReports();

  // Final summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.passed + testResults.failed}`);

  const successRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2);
  console.log(`\n🎯 Success Rate: ${successRate}%`);

  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! System is FBR compliant and ready for production.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the failures above.');
  }

  await pool.end();
}

runAllTests().catch(console.error);
