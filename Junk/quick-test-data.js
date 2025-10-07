const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tax_advisor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function populateQuickTestData() {
  const client = await pool.connect();

  try {
    console.log('🚀 Quick test data population from Excel data...\n');

    await client.query('BEGIN');

    // Test user data
    const userId = uuidv4();
    const email = 'excel.test@example.com';
    const taxYear = '2024-25';
    const taxReturnId = uuidv4();

    // 1. Create test user
    await client.query(`
      INSERT INTO users (id, email, name, password_hash, user_type, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    `, [userId, email, 'Excel Test User', 'dummy_hash', 'individual', 'user']);
    console.log('✅ Test user created/updated');

    // 2. Ensure tax year exists
    const taxYearId = uuidv4();
    await client.query(`
      INSERT INTO tax_years (id, tax_year, description, is_active, start_date, end_date, filing_deadline, created_at)
      VALUES ($1, $2, $3, true, '2024-07-01', '2025-06-30', '2025-12-31', NOW())
      ON CONFLICT (tax_year) DO NOTHING
    `, [taxYearId, taxYear, 'Tax Year 2024-25']);

    // Get actual tax year ID
    const taxYearResult = await client.query('SELECT id FROM tax_years WHERE tax_year = $1', [taxYear]);
    const actualTaxYearId = taxYearResult.rows[0].id;

    // 3. Create tax return (delete existing first)
    await client.query('DELETE FROM tax_returns WHERE user_email = $1 AND tax_year = $2', [email, taxYear]);
    await client.query(`
      INSERT INTO tax_returns (id, user_id, user_email, tax_year_id, tax_year, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    `, [taxReturnId, userId, email, actualTaxYearId, taxYear]);
    console.log('✅ Tax return created');

    // 4. Populate Income Form (Excel Data: Monthly Salary 7,200,000, Bonus 1,500,000, Car 50,000)
    await client.query('DELETE FROM income_forms WHERE tax_return_id = $1', [taxReturnId]);
    await client.query(`
      INSERT INTO income_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, monthly_salary_tax_deducted,
        bonus, bonus_tax_deducted,
        perquisites_car, perquisites_car_tax_deducted,
        is_complete, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 7200000, 2200000, 1500000, 0, 50000, 0, true, NOW(), NOW()
      )
    `, [uuidv4(), taxReturnId, userId, email, actualTaxYearId, taxYear]);
    console.log('✅ Income form: PKR 8,750,000 total (7.2M salary + 1.5M bonus + 50K car)');

    // 5. Populate Adjustable Tax (Excel Data: Salary 8,750,000, Tax 2,200,000)
    await client.query(`
      INSERT INTO adjustable_tax_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        salary_employees, salary_employees_tax,
        is_complete, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 8750000, 2200000, true, NOW(), NOW()
      ) ON CONFLICT (tax_return_id) DO UPDATE SET
        salary_employees = 8750000,
        salary_employees_tax = 2200000,
        updated_at = NOW()
    `, [uuidv4(), taxReturnId, userId, email, actualTaxYearId, taxYear]);
    console.log('✅ Adjustable tax: PKR 2,200,000 tax on PKR 8,750,000');

    // 6. Populate Tax Reductions (Excel Data: Teacher 581,000, Behbood 5,000)
    await client.query(`
      INSERT INTO reductions_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        teacher_researcher_tax_reduction, teacher_researcher_reduction_yn,
        behbood_certificates_amount, behbood_certificates_tax_reduction, behbood_certificates_reduction_yn,
        is_complete, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 581000, 'Y', 50000, 5000, 'Y', true, NOW(), NOW()
      ) ON CONFLICT (tax_return_id) DO UPDATE SET
        teacher_researcher_tax_reduction = 581000,
        behbood_certificates_amount = 50000,
        behbood_certificates_tax_reduction = 5000,
        updated_at = NOW()
    `, [uuidv4(), taxReturnId, userId, email, actualTaxYearId, taxYear]);
    console.log('✅ Tax reductions: PKR 586,000 (581K teacher + 5K behbood)');

    // 7. Populate Deductions (Excel Data: Educational expenses 10,000)
    await client.query(`
      INSERT INTO deductions_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        educational_expenses_amount, educational_expenses_children_count, educational_expenses_yn,
        is_complete, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 10000, 1, 'Y', true, NOW(), NOW()
      ) ON CONFLICT (tax_return_id) DO UPDATE SET
        educational_expenses_amount = 10000,
        educational_expenses_children_count = 1,
        updated_at = NOW()
    `, [uuidv4(), taxReturnId, userId, email, actualTaxYearId, taxYear]);
    console.log('✅ Deductions: PKR 10,000 educational expenses');

    // 8. Populate Wealth Statement (Excel Data: Property 10M, Cash 4M)
    await client.query(`
      INSERT INTO wealth_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        commercial_property_current, commercial_property_previous,
        cash_bank_current, cash_bank_previous,
        is_complete, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 10000000, 10000000, 4040000, 4200000, true, NOW(), NOW()
      ) ON CONFLICT (tax_return_id) DO UPDATE SET
        commercial_property_current = 10000000,
        commercial_property_previous = 10000000,
        cash_bank_current = 4040000,
        cash_bank_previous = 4200000,
        updated_at = NOW()
    `, [uuidv4(), taxReturnId, userId, email, actualTaxYearId, taxYear]);
    console.log('✅ Wealth: PKR 14,040,000 current (10M property + 4.04M cash)');

    await client.query('COMMIT');

    console.log('\n🎉 Quick test data population complete!');
    console.log('\n📊 Summary of Populated Data:');
    console.log('  👤 User: excel.test@example.com');
    console.log('  💰 Total Income: PKR 8,750,000');
    console.log('  🏠 Monthly Salary: PKR 7,200,000');
    console.log('  🎁 Bonus: PKR 1,500,000');
    console.log('  🚗 Car Benefit: PKR 50,000');
    console.log('  📋 Tax Deducted: PKR 2,200,000');
    console.log('  📉 Tax Reductions: PKR 586,000');
    console.log('  📚 Deductions: PKR 10,000');
    console.log('  🏦 Net Assets: PKR 14,040,000');
    console.log('\n💡 Expected Taxable Income: PKR 8,740,000 (8,750,000 - 10,000)');
    console.log('\n🌐 Login with: excel.test@example.com / any password');
    console.log('🌐 Navigate to: http://localhost:3000');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

// Run the population
populateQuickTestData().catch(console.error);