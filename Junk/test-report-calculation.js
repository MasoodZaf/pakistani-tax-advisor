/**
 * Test Script: Report Calculation Verification
 * Tests the updated report API to verify comprehensive tax calculations
 */

const axios = require('axios');
const { pool } = require('./src/config/database');

async function testReportCalculation() {
  console.log('🧪 TESTING UPDATED REPORT CALCULATION\n');
  console.log('=====================================\n');

  try {
    // Get a test user with data
    const userResult = await pool.query(`
      SELECT u.id, u.email, tr.tax_year, tr.id as tax_return_id
      FROM users u
      JOIN tax_returns tr ON u.id = tr.user_id
      JOIN income_forms if ON tr.id = if.tax_return_id
      WHERE if.monthly_salary > 0
      LIMIT 1
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ No test data found');
      return;
    }

    const testUser = userResult.rows[0];
    console.log(`📋 Testing with user: ${testUser.email}`);
    console.log(`📅 Tax year: ${testUser.tax_year}`);
    console.log(`🆔 Tax return ID: ${testUser.tax_return_id}\n`);

    // Create a test session token (simulate login)
    const sessionResult = await pool.query(`
      INSERT INTO user_sessions (user_id, user_email, session_token, expires_at)
      VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')
      ON CONFLICT (user_id) DO UPDATE SET
        session_token = $3,
        expires_at = NOW() + INTERVAL '1 hour'
      RETURNING session_token
    `, [testUser.id, testUser.email, 'test_report_token_' + Date.now()]);

    const sessionToken = sessionResult.rows[0].session_token;
    console.log(`🔑 Created test session: ${sessionToken}\n`);

    // Test the updated report API
    const response = await axios.get(`http://localhost:3001/api/reports/tax-calculation-summary/${testUser.tax_year}`, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });

    console.log('📊 API Response:');
    console.log(`Status: ${response.status}`);
    console.log(`Success: ${response.data.success}`);
    console.log(`Message: ${response.data.message}\n`);

    if (response.data.success && response.data.data) {
      const data = response.data.data;

      console.log('💰 CALCULATION RESULTS:');
      console.log('─'.repeat(40));

      if (data.calculations) {
        const calc = data.calculations;
        console.log(`Gross Income: Rs ${(calc.grossIncome || 0).toLocaleString()}`);
        console.log(`Exempt Income: Rs ${(calc.exemptIncome || 0).toLocaleString()}`);
        console.log(`Taxable Income: Rs ${(calc.taxableIncome || 0).toLocaleString()}`);
        console.log(`Normal Tax: Rs ${(calc.normalTax || 0).toLocaleString()}`);
        console.log(`Tax Credits: Rs ${(calc.taxCredits || 0).toLocaleString()}`);
        console.log(`Total Tax Liability: Rs ${(calc.totalTaxLiability || 0).toLocaleString()}`);
        console.log(`Total Tax Paid: Rs ${(calc.totalTaxPaid || 0).toLocaleString()}`);
        console.log(`Refund Due: Rs ${(calc.refundDue || 0).toLocaleString()}`);
        console.log(`Additional Tax Due: Rs ${(calc.additionalTaxDue || 0).toLocaleString()}`);
        console.log(`Effective Tax Rate: ${calc.effectiveTaxRate || 0}%`);
      } else {
        console.log('❌ No calculations found in response');
      }

      console.log('\n📋 RAW INCOME DATA:');
      console.log('─'.repeat(40));
      if (data.income) {
        console.log(`Monthly Salary: Rs ${(data.income.monthly_salary || 0).toLocaleString()}`);
        console.log(`Bonus: Rs ${(data.income.bonus || 0).toLocaleString()}`);
        console.log(`Car Allowance: Rs ${(data.income.car_allowance || 0).toLocaleString()}`);
        console.log(`Total Taxable Income: Rs ${(data.income.total_taxable_income || 0).toLocaleString()}`);
      } else {
        console.log('❌ No income data found in response');
      }

    } else {
      console.log('❌ API returned unsuccessful response');
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    }

    // Clean up test session
    await pool.query('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
    console.log('\n🧹 Cleaned up test session');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testReportCalculation()
  .then(() => {
    console.log('\n✅ Report calculation test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });