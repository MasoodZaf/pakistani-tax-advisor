const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Simple script to populate test data from Excel without complex constraints
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tax_advisor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function populateSimpleExcelData() {
  const client = await pool.connect();

  try {
    console.log('🚀 Simple Excel data population...\n');

    await client.query('BEGIN');

    const userId = uuidv4();
    const email = 'excel.test@taxadvisor.com';
    const taxYear = '2024-25';
    const taxReturnId = uuidv4();

    // 1. Clean up existing test data first
    await client.query('DELETE FROM income_forms WHERE user_email = $1', [email]);
    await client.query('DELETE FROM adjustable_tax_forms WHERE user_email = $1', [email]);
    await client.query('DELETE FROM reductions_forms WHERE user_email = $1', [email]);
    await client.query('DELETE FROM deductions_forms WHERE user_email = $1', [email]);
    await client.query('DELETE FROM wealth_forms WHERE user_email = $1', [email]);
    await client.query('DELETE FROM tax_returns WHERE user_email = $1', [email]);
    await client.query('DELETE FROM users WHERE email = $1', [email]);
    console.log('✅ Cleaned up existing test data');

    // 2. Create test user
    await client.query(`
      INSERT INTO users (id, email, name, password_hash, user_type, role)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, email, 'Excel Test User', 'dummy_hash', 'individual', 'user']);
    console.log('✅ Test user created');

    // 3. Get or create tax year
    let taxYearResult = await client.query('SELECT id FROM tax_years WHERE tax_year = $1', [taxYear]);
    let actualTaxYearId;

    if (taxYearResult.rows.length === 0) {
      actualTaxYearId = uuidv4();
      await client.query(`
        INSERT INTO tax_years (id, tax_year, description, is_active, start_date, end_date, filing_deadline)
        VALUES ($1, $2, $3, true, '2024-07-01', '2025-06-30', '2025-12-31')
      `, [actualTaxYearId, taxYear, 'Tax Year 2024-25']);
      console.log('✅ Tax year created');
    } else {
      actualTaxYearId = taxYearResult.rows[0].id;
      console.log('✅ Tax year found');
    }

    // 4. Create tax return
    await client.query(`
      INSERT INTO tax_returns (id, user_id, user_email, tax_year_id, tax_year)
      VALUES ($1, $2, $3, $4, $5)
    `, [taxReturnId, userId, email, actualTaxYearId, taxYear]);
    console.log('✅ Tax return created');

    // 5. Populate Income Form with Excel data
    await client.query(`
      INSERT INTO income_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, monthly_salary_tax_deducted,
        bonus, bonus_tax_deducted,
        perquisites_car, perquisites_car_tax_deducted,
        is_complete
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true
      )
    `, [
      uuidv4(), taxReturnId, userId, email, actualTaxYearId, taxYear,
      7200000,  // Monthly salary from Excel
      2200000,  // Tax deducted from Excel
      1500000,  // Bonus from Excel
      0,        // Bonus tax deducted
      50000,    // Car benefit from Excel
      0         // Car tax deducted
    ]);
    console.log('✅ Income form: PKR 8,750,000 total (7.2M salary + 1.5M bonus + 50K car)');

    // 6. Populate Adjustable Tax with Excel data
    await client.query(`
      INSERT INTO adjustable_tax_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        salary_employees, salary_employees_tax,
        is_complete
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, true
      )
    `, [
      uuidv4(), taxReturnId, userId, email, actualTaxYearId, taxYear,
      8750000,  // Total salary from Excel
      2200000   // Tax withheld from Excel
    ]);
    console.log('✅ Adjustable tax: PKR 2,200,000 tax on PKR 8,750,000');

    // 7. Populate Tax Reductions with Excel data
    await client.query(`
      INSERT INTO reductions_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        teacher_researcher_tax_reduction, teacher_researcher_reduction_yn,
        behbood_certificates_amount, behbood_certificates_tax_reduction, behbood_certificates_reduction_yn,
        is_complete
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true
      )
    `, [
      uuidv4(), taxReturnId, userId, email, actualTaxYearId, taxYear,
      581000,   // Teacher reduction from Excel
      'Y',      // Yes to teacher reduction
      50000,    // Behbood amount from Excel
      5000,     // Behbood reduction from Excel
      'Y'       // Yes to Behbood reduction
    ]);
    console.log('✅ Tax reductions: PKR 586,000 (581K teacher + 5K behbood)');

    // 8. Populate Deductions with Excel data
    await client.query(`
      INSERT INTO deductions_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        educational_expenses_amount, educational_expenses_children_count, educational_expenses_yn,
        is_complete
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, true
      )
    `, [
      uuidv4(), taxReturnId, userId, email, actualTaxYearId, taxYear,
      10000,    // Educational expenses from Excel
      1,        // 1 child
      'Y'       // Yes to educational expenses
    ]);
    console.log('✅ Deductions: PKR 10,000 educational expenses');

    // 9. Populate Wealth Statement with Excel data
    await client.query(`
      INSERT INTO wealth_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        commercial_property_current, commercial_property_previous,
        cash_bank_current, cash_bank_previous,
        is_complete
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true
      )
    `, [
      uuidv4(), taxReturnId, userId, email, actualTaxYearId, taxYear,
      10000000, // Property current from Excel
      10000000, // Property previous from Excel
      4040000,  // Cash current from Excel (calculated)
      4200000   // Cash previous from Excel (calculated)
    ]);
    console.log('✅ Wealth: PKR 14,040,000 current (10M property + 4.04M cash)');

    await client.query('COMMIT');

    console.log('\n🎉 Excel test data population complete!');
    console.log('\n📊 Summary of Populated Data (from Excel):');
    console.log('════════════════════════════════════════');
    console.log('👤 User: excel.test@taxadvisor.com');
    console.log('📅 Tax Year: 2024-25');
    console.log('');
    console.log('💰 INCOME DATA:');
    console.log('  • Monthly Salary: PKR 7,200,000');
    console.log('  • Bonus: PKR 1,500,000');
    console.log('  • Car Benefit: PKR 50,000');
    console.log('  • Total Income: PKR 8,750,000');
    console.log('');
    console.log('📋 TAX DATA:');
    console.log('  • Tax Deducted: PKR 2,200,000');
    console.log('  • Tax Reductions: PKR 586,000');
    console.log('    - Teacher/Researcher: PKR 581,000');
    console.log('    - Behbood Certificates: PKR 5,000');
    console.log('  • Deductions: PKR 10,000 (educational)');
    console.log('');
    console.log('🏦 WEALTH DATA:');
    console.log('  • Property Value: PKR 10,000,000');
    console.log('  • Cash & Bank: PKR 4,040,000');
    console.log('  • Total Net Assets: PKR 14,040,000');
    console.log('');
    console.log('💡 EXPECTED CALCULATIONS:');
    console.log('  • Taxable Income: PKR 8,740,000 (8,750,000 - 10,000)');
    console.log('  • Tax Payable: Based on slab rates minus reductions');
    console.log('');
    console.log('🌐 TESTING INSTRUCTIONS:');
    console.log('1. Open: http://localhost:3000');
    console.log('2. Login with: excel.test@taxadvisor.com');
    console.log('3. Navigate through tax forms');
    console.log('4. Verify calculations match Excel results');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    process.exit(0);
  }
}

// Run the population
populateSimpleExcelData().catch(console.error);