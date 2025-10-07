const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'tax_advisor',
  user: 'postgres',
  password: 'password'
});

async function insertTestData() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. First get user details
    const userResult = await client.query(`
      SELECT id, email FROM users WHERE id = $1
    `, ['6bf47a47-5341-4884-9960-bb660dfdd9df']);

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Get current tax year ID
    const taxYearResult = await client.query(`
      SELECT id, tax_year FROM tax_years WHERE is_current = true
    `);

    if (taxYearResult.rows.length === 0) {
      throw new Error('No current tax year found');
    }

    const taxYear = taxYearResult.rows[0];

    // Create tax return with all required fields
    const returnNumber = `TR-${user.email}-${taxYear.tax_year}-${Date.now()}`;
    const taxReturnResult = await client.query(`
      INSERT INTO tax_returns (
        user_id,
        user_email,
        tax_year_id,
        tax_year,
        return_number,
        filing_status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [user.id, user.email, taxYear.id, taxYear.tax_year, returnNumber, 'draft']);

    const taxReturnId = taxReturnResult.rows[0].id;
    console.log('Tax return created with ID:', taxReturnId);

    // 2. Insert income form data directly
    await client.query(`
      INSERT INTO income_forms (
        tax_return_id,
        user_id,
        user_email,
        tax_year_id,
        tax_year,
        basic_salary,
        allowances_excluding_bonus_medical,
        bonus,
        medical_allowance,
        pension_from_ex_employer,
        employment_termination_payment,
        retirement_from_approved_funds,
        directorship_fee,
        other_cash_benefits
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      taxReturnId,
      user.id,
      user.email,
      taxYear.id,
      taxYear.tax_year,
      7200000,  // basic_salary
      6000000,  // allowances_excluding_bonus_medical
      1500000,  // bonus
      720000,   // medical_allowance
      400000,   // pension_from_ex_employer
      2000000,  // employment_termination_payment
      5000000,  // retirement_from_approved_funds
      40000,    // directorship_fee
      1200000   // other_cash_benefits
    ]);

    console.log('✅ Income form data inserted');

    // 3. Check the calculated values
    const result = await client.query(`
      SELECT
        basic_salary,
        allowances_excluding_bonus_medical,
        bonus,
        medical_allowance,
        pension_from_ex_employer,
        employment_termination_payment,
        retirement_from_approved_funds,
        directorship_fee,
        other_cash_benefits,
        annual_salary_and_wages,
        income_exempt_from_tax
      FROM income_forms
      WHERE tax_return_id = $1
    `, [taxReturnId]);

    console.log('📊 Database values after triggers:');
    console.log(JSON.stringify(result.rows[0], null, 2));

    await client.query('COMMIT');

    // Calculate what the values should be
    const data = result.rows[0];
    const totalBeforeExemptions =
      parseFloat(data.basic_salary) +
      parseFloat(data.allowances_excluding_bonus_medical) +
      parseFloat(data.bonus) +
      parseFloat(data.medical_allowance) +
      parseFloat(data.pension_from_ex_employer) +
      parseFloat(data.employment_termination_payment) +
      parseFloat(data.retirement_from_approved_funds) +
      parseFloat(data.directorship_fee) +
      parseFloat(data.other_cash_benefits);

    const incomeExemptFromTax =
      parseFloat(data.medical_allowance) +
      parseFloat(data.employment_termination_payment) +
      parseFloat(data.retirement_from_approved_funds);

    const correctAnnualSalary = totalBeforeExemptions - incomeExemptFromTax;

    console.log('\n🧮 Expected calculations:');
    console.log('Total before exemptions:', totalBeforeExemptions.toLocaleString());
    console.log('Income exempt from tax:', incomeExemptFromTax.toLocaleString());
    console.log('Correct annual salary:', correctAnnualSalary.toLocaleString());

    console.log('\n🔍 Database vs Expected:');
    console.log('DB Annual Salary:', parseFloat(data.annual_salary_and_wages || 0).toLocaleString());
    console.log('DB Income Exempt:', parseFloat(data.income_exempt_from_tax || 0).toLocaleString());

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
  } finally {
    client.release();
  }
}

insertTestData().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});