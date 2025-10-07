const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tax_advisor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function simpleUpdateHassan() {
  const client = await pool.connect();
  try {
    console.log('📊 Simple update of Muhammad Hassan data to match Excel...\n');

    // Based on Excel analysis
    const taxReturnId = 'e44155d5-231a-436f-b0e5-b56cbd622137';
    const userId = 'e9277b31-7f12-4bc3-b12b-e5f0d3e0837a';
    const userEmail = 'superadmin@paktaxadvisor.com';
    const taxYearId = '1a23bdde-ce04-46f6-905b-25408c5cd888';
    const taxYear = '2024-25';

    console.log('1. Updating Income Form to match Excel...');
    // Monthly salary: 21,440,000 / 12 = 1,786,667
    // Monthly tax: 6,972,000 / 12 = 581,000
    // Medical allowance (deductible): 75,000
    // Exempt income (employer contribution): 1,270,000

    const incomeExists = await client.query('SELECT id FROM income_forms WHERE tax_return_id = $1', [taxReturnId]);

    if (incomeExists.rows.length > 0) {
      await client.query(`
        UPDATE income_forms SET
          monthly_salary = 1786667,
          salary_tax_deducted = 581000,
          medical_allowance = 75000,
          employer_contribution_approved_funds = 1270000,
          bonus = 0,
          car_allowance = 0,
          other_exempt = 0,
          income_from_other_sources = 0,
          is_complete = true,
          updated_at = NOW()
        WHERE tax_return_id = $1
      `, [taxReturnId]);
      console.log('✅ Income form updated');
    } else {
      await client.query(`
        INSERT INTO income_forms (
          id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
          monthly_salary, salary_tax_deducted, medical_allowance,
          employer_contribution_approved_funds, bonus, car_allowance,
          other_exempt, income_from_other_sources,
          is_complete, last_updated_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          1786667, 581000, 75000, 1270000, 0, 0, 0, 0,
          true, $2, NOW(), NOW()
        )
      `, [taxReturnId, userId, userEmail, taxYearId, taxYear]);
      console.log('✅ Income form created');
    }

    console.log('2. Updating Capital Gains Form...');
    // Capital gains: 1,500,000 (from first image)
    // Capital gain tax: 175,000

    const capitalExists = await client.query('SELECT id FROM capital_gain_forms WHERE tax_return_id = $1', [taxReturnId]);

    if (capitalExists.rows.length > 0) {
      await client.query(`
        UPDATE capital_gain_forms SET
          immovable_property_1_year_type = 'House',
          immovable_property_1_year_taxable = 1500000,
          immovable_property_1_year_deducted = 175000,
          immovable_property_1_year_carryable = 0,
          is_complete = true,
          updated_at = NOW()
        WHERE tax_return_id = $1
      `, [taxReturnId]);
      console.log('✅ Capital gains form updated');
    } else {
      await client.query(`
        INSERT INTO capital_gain_forms (
          id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
          immovable_property_1_year_type, immovable_property_1_year_taxable,
          immovable_property_1_year_deducted, immovable_property_1_year_carryable,
          is_complete, last_updated_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          'House', 1500000, 175000, 0,
          true, $2, NOW(), NOW()
        )
      `, [taxReturnId, userId, userEmail, taxYearId, taxYear]);
      console.log('✅ Capital gains form created');
    }

    // Create basic forms if they don't exist
    console.log('3. Ensuring other forms exist...');

    // Reductions form
    const reductionsExists = await client.query('SELECT id FROM reductions_forms WHERE tax_return_id = $1', [taxReturnId]);
    if (reductionsExists.rows.length === 0) {
      await client.query(`
        INSERT INTO reductions_forms (
          id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
          is_complete, last_updated_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          true, $2, NOW(), NOW()
        )
      `, [taxReturnId, userId, userEmail, taxYearId, taxYear]);
      console.log('✅ Reductions form created');
    }

    // Credits form
    const creditsExists = await client.query('SELECT id FROM credits_forms WHERE tax_return_id = $1', [taxReturnId]);
    if (creditsExists.rows.length === 0) {
      await client.query(`
        INSERT INTO credits_forms (
          id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
          is_complete, last_updated_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          true, $2, NOW(), NOW()
        )
      `, [taxReturnId, userId, userEmail, taxYearId, taxYear]);
      console.log('✅ Credits form created');
    }

    // Deductions form
    const deductionsExists = await client.query('SELECT id FROM deductions_forms WHERE tax_return_id = $1', [taxReturnId]);
    if (deductionsExists.rows.length === 0) {
      await client.query(`
        INSERT INTO deductions_forms (
          id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
          is_complete, last_updated_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          true, $2, NOW(), NOW()
        )
      `, [taxReturnId, userId, userEmail, taxYearId, taxYear]);
      console.log('✅ Deductions form created');
    }

    // Final tax form
    const finalTaxExists = await client.query('SELECT id FROM final_tax_forms WHERE tax_return_id = $1', [taxReturnId]);
    if (finalTaxExists.rows.length === 0) {
      await client.query(`
        INSERT INTO final_tax_forms (
          id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
          is_complete, last_updated_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          true, $2, NOW(), NOW()
        )
      `, [taxReturnId, userId, userEmail, taxYearId, taxYear]);
      console.log('✅ Final tax form created');
    }

    // Now let's read back and verify
    console.log('\n4. Reading back current data...');
    const [income, capital] = await Promise.all([
      client.query('SELECT * FROM income_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM capital_gain_forms WHERE tax_return_id = $1', [taxReturnId])
    ]);

    console.log('\n📊 Current Database Values:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (income.rows.length > 0) {
      const inc = income.rows[0];
      console.log('💰 Income Data:');
      console.log(`   Monthly Salary: Rs ${(inc.monthly_salary || 0).toLocaleString()}`);
      console.log(`   Annual Salary: Rs ${((inc.monthly_salary || 0) * 12).toLocaleString()}`);
      console.log(`   Annual Tax Deducted: Rs ${((inc.salary_tax_deducted || 0) * 12).toLocaleString()}`);
      console.log(`   Medical Allowance: Rs ${(inc.medical_allowance || 0).toLocaleString()}`);
      console.log(`   Employer Contribution: Rs ${(inc.employer_contribution_approved_funds || 0).toLocaleString()}`);
      console.log(`   Total Gross Income: Rs ${(inc.total_gross_income || 0).toLocaleString()}`);
      console.log(`   Net Taxable Income: Rs ${(inc.net_taxable_income || 0).toLocaleString()}`);
    }

    if (capital.rows.length > 0) {
      const cap = capital.rows[0];
      console.log('\n🏠 Capital Gains Data:');
      console.log(`   Property Type: ${cap.immovable_property_1_year_type || 'N/A'}`);
      console.log(`   Capital Gains: Rs ${(cap.total_capital_gain || 0).toLocaleString()}`);
      console.log(`   Tax Deducted: Rs ${(cap.total_tax_deducted || 0).toLocaleString()}`);
    }

    console.log('\n📋 Expected Results (from Excel):');
    console.log(`   Income from Salary: Rs 21,440,000`);
    console.log(`   Capital Gains: Rs 1,500,000`);
    console.log(`   Taxable Income: Rs 21,595,000`);
    console.log(`   Normal Income Tax: Rs 6,298,250`);
    console.log(`   Capital Gain Tax: Rs 175,000`);
    console.log(`   Total Tax Chargeable: Rs 7,135,349`);
    console.log(`   Tax Demanded: Rs 163,349`);

    console.log('\n🎉 Data updated! Now check the Tax Computation in the web app.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

simpleUpdateHassan();