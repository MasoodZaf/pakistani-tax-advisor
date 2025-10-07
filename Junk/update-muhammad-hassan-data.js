const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tax_advisor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function updateMuhammadHassanData() {
  const client = await pool.connect();
  try {
    console.log('📊 Updating Muhammad Hassan data to match Excel...\n');

    // Excel values extracted from the analysis
    const excelData = {
      salaryIncome: 21440000,      // Annual salary
      monthlySalary: 1786667,      // Monthly (21,440,000 / 12)
      taxDeducted: 6972000,        // Total withholding tax
      monthlytaxDeducted: 581000,  // Monthly (6,972,000 / 12)

      // Capital gains
      capitalGains: 1500000,
      capitalGainTax: 175000,

      // Reductions (simplified breakdown)
      taxReductions: 1772019,

      // Credits
      taxCredits: 1295707,

      // Final tax
      finalTax: 3100000,

      // Expected calculation results
      expectedNormalTax: 6298250,
      expectedSurcharge: 629825,
      expectedTotalTax: 7135349,
      expectedTaxDemanded: 163349
    };

    const userId = 'e9277b31-7f12-4bc3-b12b-e5f0d3e0837a'; // Muhammad Hassan
    const taxReturnId = 'e44155d5-231a-436f-b0e5-b56cbd622137';
    const taxYearId = '1a23bdde-ce04-46f6-905b-25408c5cd888';
    const taxYear = '2024-25';
    const userEmail = 'superadmin@paktaxadvisor.com';

    console.log('1. Updating Income Form...');
    await client.query(`
      UPDATE income_forms SET
        monthly_salary = $1,
        salary_tax_deducted = $2,
        bonus = 0,
        car_allowance = 0,
        medical_allowance = 75000,
        employer_contribution_approved_funds = 1270000,
        other_exempt = 0,
        income_from_other_sources = 0,
        is_complete = true,
        updated_at = NOW()
      WHERE tax_return_id = $3
    `, [excelData.monthlySalary, excelData.monthlytaxDeducted, taxReturnId]);

    // If no income form exists, insert it
    const incomeExists = await client.query('SELECT id FROM income_forms WHERE tax_return_id = $1', [taxReturnId]);
    if (incomeExists.rows.length === 0) {
      await client.query(`
        INSERT INTO income_forms (
          id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
          monthly_salary, salary_tax_deducted, medical_allowance, employer_contribution_approved_funds,
          is_complete, last_updated_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $6, $7, 75000, 1270000,
          true, $2, NOW(), NOW()
        )
      `, [taxReturnId, userId, userEmail, taxYearId, taxYear, excelData.monthlySalary, excelData.monthlytaxDeducted]);
    }

    console.log('2. Updating Capital Gains Form...');
    await client.query(`
      UPDATE capital_gain_forms SET
        immovable_property_1_year_type = 'House',
        immovable_property_1_year_taxable = $1,
        immovable_property_1_year_deducted = $2,
        immovable_property_1_year_carryable = 0,
        is_complete = true,
        updated_at = NOW()
      WHERE tax_return_id = $3
    `, [excelData.capitalGains, excelData.capitalGainTax, taxReturnId]);

    // If no capital gains form exists, insert it
    const capitalExists = await client.query('SELECT id FROM capital_gain_forms WHERE tax_return_id = $1', [taxReturnId]);
    if (capitalExists.rows.length === 0) {
      await client.query(`
        INSERT INTO capital_gain_forms (
          id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
          immovable_property_1_year_type, immovable_property_1_year_taxable,
          immovable_property_1_year_deducted, immovable_property_1_year_carryable,
          is_complete, last_updated_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          'House', $6, $7, 0,
          true, $2, NOW(), NOW()
        )
      `, [taxReturnId, userId, userEmail, taxYearId, taxYear, excelData.capitalGains, excelData.capitalGainTax]);
    }

    console.log('3. Updating Tax Reductions Form...');
    await client.query(`
      UPDATE reductions_forms SET
        teacher_researcher_amount = 8000000,
        teacher_researcher_tax_reduction = $1,
        teacher_researcher_reduction_yn = 'Y',
        is_complete = true,
        updated_at = NOW()
      WHERE tax_return_id = $2
    `, [excelData.taxReductions, taxReturnId]);

    // If no reductions form exists, insert it
    const reductionsExists = await client.query('SELECT id FROM reductions_forms WHERE tax_return_id = $1', [taxReturnId]);
    if (reductionsExists.rows.length === 0) {
      await client.query(`
        INSERT INTO reductions_forms (
          id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
          teacher_researcher_amount, teacher_researcher_tax_reduction, teacher_researcher_reduction_yn,
          is_complete, last_updated_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          8000000, $6, 'Y',
          true, $2, NOW(), NOW()
        )
      `, [taxReturnId, userId, userEmail, taxYearId, taxYear, excelData.taxReductions]);
    }

    console.log('4. Updating Tax Credits Form...');
    await client.query(`
      UPDATE credits_forms SET
        disabled_person_amount = 5000000,
        disabled_person_credit_amount = $1,
        disabled_person_credit_yn = 'Y',
        is_complete = true,
        updated_at = NOW()
      WHERE tax_return_id = $2
    `, [excelData.taxCredits, taxReturnId]);

    // If no credits form exists, insert it
    const creditsExists = await client.query('SELECT id FROM credits_forms WHERE tax_return_id = $1', [taxReturnId]);
    if (creditsExists.rows.length === 0) {
      await client.query(`
        INSERT INTO credits_forms (
          id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
          disabled_person_amount, disabled_person_credit_amount, disabled_person_credit_yn,
          is_complete, last_updated_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          5000000, $6, 'Y',
          true, $2, NOW(), NOW()
        )
      `, [taxReturnId, userId, userEmail, taxYearId, taxYear, excelData.taxCredits]);
    }

    console.log('5. Updating Final Tax Form...');
    await client.query(`
      UPDATE final_tax_forms SET
        sukuk_bonds_amount = 12400000,
        sukuk_bonds_tax_rate = 10,
        debt_instruments_amount = 12400000,
        debt_instruments_tax_rate = 15,
        is_complete = true,
        updated_at = NOW()
      WHERE tax_return_id = $1
    `, [taxReturnId]);

    // If no final tax form exists, insert it
    const finalTaxExists = await client.query('SELECT id FROM final_tax_forms WHERE tax_return_id = $1', [taxReturnId]);
    if (finalTaxExists.rows.length === 0) {
      await client.query(`
        INSERT INTO final_tax_forms (
          id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
          sukuk_bonds_amount, sukuk_bonds_tax_rate,
          debt_instruments_amount, debt_instruments_tax_rate,
          is_complete, last_updated_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          12400000, 10, 12400000, 15,
          true, $2, NOW(), NOW()
        )
      `, [taxReturnId, userId, userEmail, taxYearId, taxYear]);
    }

    console.log('✅ All forms updated successfully!\n');

    // Now read back the data to verify
    console.log('6. Verifying updated data...');
    const [income, capital, reductions, credits, finalTax] = await Promise.all([
      client.query('SELECT * FROM income_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM capital_gain_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM reductions_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM credits_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM final_tax_forms WHERE tax_return_id = $1', [taxReturnId])
    ]);

    console.log('📊 Updated Data Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (income.rows.length > 0) {
      const inc = income.rows[0];
      console.log('💰 Income Form:');
      console.log(`   Monthly Salary: Rs ${(inc.monthly_salary || 0).toLocaleString()}`);
      console.log(`   Annual Salary: Rs ${((inc.monthly_salary || 0) * 12).toLocaleString()}`);
      console.log(`   Tax Deducted: Rs ${((inc.salary_tax_deducted || 0) * 12).toLocaleString()}`);
      console.log(`   Medical Allowance: Rs ${(inc.medical_allowance || 0).toLocaleString()}`);
      console.log(`   Employer Contribution: Rs ${(inc.employer_contribution_approved_funds || 0).toLocaleString()}`);
      console.log(`   Total Gross Income: Rs ${(inc.total_gross_income || 0).toLocaleString()}`);
      console.log(`   Net Taxable Income: Rs ${(inc.net_taxable_income || 0).toLocaleString()}`);
    }

    if (capital.rows.length > 0) {
      const cap = capital.rows[0];
      console.log('\n🏠 Capital Gains Form:');
      console.log(`   Property Type: ${cap.immovable_property_1_year_type || 'N/A'}`);
      console.log(`   Capital Gains: Rs ${(cap.total_capital_gain || 0).toLocaleString()}`);
      console.log(`   Tax Deducted: Rs ${(cap.total_tax_deducted || 0).toLocaleString()}`);
    }

    if (reductions.rows.length > 0) {
      const red = reductions.rows[0];
      console.log('\n📉 Tax Reductions:');
      console.log(`   Total Reductions: Rs ${(red.total_reductions || 0).toLocaleString()}`);
    }

    if (credits.rows.length > 0) {
      const cred = credits.rows[0];
      console.log('\n💳 Tax Credits:');
      console.log(`   Total Credits: Rs ${(cred.total_credits || 0).toLocaleString()}`);
    }

    if (finalTax.rows.length > 0) {
      const final = finalTax.rows[0];
      console.log('\n🏦 Final Tax:');
      console.log(`   Total Final Tax: Rs ${(final.total_final_tax || 0).toLocaleString()}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Data update complete! Now check the tax computation in the app.');
    console.log('📋 Expected Results (from Excel):');
    console.log(`   Normal Income Tax: Rs ${excelData.expectedNormalTax.toLocaleString()}`);
    console.log(`   Surcharge (10%): Rs ${excelData.expectedSurcharge.toLocaleString()}`);
    console.log(`   Total Tax Chargeable: Rs ${excelData.expectedTotalTax.toLocaleString()}`);
    console.log(`   Tax Demanded: Rs ${excelData.expectedTaxDemanded.toLocaleString()}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

updateMuhammadHassanData();