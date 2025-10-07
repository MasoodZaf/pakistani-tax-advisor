const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'tax_advisor',
  user: 'postgres',
  password: 'password'
});

async function testCurrentReturnAPI() {
  try {
    // Get khurramj user ID and email
    const userResult = await pool.query(`
      SELECT id, email FROM users WHERE email = 'khurramj@taxadvisor.pk'
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const user = userResult.rows[0];
    console.log('👤 User found:', user.email, user.id);

    // Get current tax year
    const taxYearResult = await pool.query(`
      SELECT id, tax_year FROM tax_years WHERE is_current = true
    `);

    if (taxYearResult.rows.length === 0) {
      console.log('❌ No current tax year found');
      return;
    }

    const taxYear = taxYearResult.rows[0];
    console.log('📅 Current tax year:', taxYear.tax_year, taxYear.id);

    // Get income form data (simulating the API call)
    const incomeResult = await pool.query(`
      SELECT * FROM income_forms
      WHERE user_id = $1 AND user_email = $2 AND tax_year_id = $3
    `, [user.id, user.email, taxYear.id]);

    console.log('📊 Income form data found:', incomeResult.rows.length > 0 ? 'YES' : 'NO');

    if (incomeResult.rows.length > 0) {
      const incomeData = incomeResult.rows[0];
      console.log('💰 Income Data:');
      console.log('- Basic Salary:', incomeData.basic_salary);
      console.log('- Annual Salary and Wages:', incomeData.annual_salary_and_wages);
      console.log('- Income Exempt from Tax:', incomeData.income_exempt_from_tax);
      console.log('- Medical Allowance:', incomeData.medical_allowance);
      console.log('- Employment Termination:', incomeData.employment_termination_payment);
      console.log('- Retirement from Approved Funds:', incomeData.retirement_from_approved_funds);

      // What the frontend would get
      const frontendData = {
        income: incomeData
      };

      console.log('\n🔄 What getStepData("income") would return:');
      console.log('Keys:', Object.keys(frontendData.income));
      console.log('Annual Salary and Wages:', frontendData.income.annual_salary_and_wages);
      console.log('Income Exempt from Tax:', frontendData.income.income_exempt_from_tax);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testCurrentReturnAPI();