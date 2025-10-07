const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tax_advisor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function correctHassanData() {
  const client = await pool.connect();
  try {
    console.log('📊 Correcting Muhammad Hassan data to match Excel (TY2025)...\n');

    // Excel values extracted from the analysis
    const excelData = {
      salaryIncome: 21440000,      // Annual salary
      monthlySalary: 1786667,      // Monthly (21,440,000 / 12)
      taxDeducted: 6972000,        // Total withholding tax
      monthlyTaxDeducted: 581000,  // Monthly (6,972,000 / 12)
      medicalAllowance: 75000,     // Deductible allowances
      exemptIncome: 1270000,       // Employer contribution

      // Capital gains
      capitalGains: 1500000,
      capitalGainTax: 175000,

      // Reductions and credits (from Excel)
      taxReductions: 1772019,
      taxCredits: 1295707,

      // Final tax
      finalTax: 3100000,
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
        medical_allowance = $3,
        employer_contribution_approved_funds = $4,
        bonus = 0,
        car_allowance = 0,
        other_exempt = 0,
        income_from_other_sources = 0,
        is_complete = true,
        updated_at = NOW()
      WHERE tax_return_id = $5
    `, [excelData.monthlySalary, excelData.monthlyTaxDeducted, excelData.medicalAllowance, excelData.exemptIncome, taxReturnId]);
    console.log('✅ Income form updated');

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
    console.log('✅ Capital gains form updated');

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
    console.log('✅ Reductions form updated');

    console.log('4. Updating Tax Credits Form...');
    await client.query(`
      UPDATE credits_forms SET
        charitable_donations_amount = 5000000,
        charitable_donations_tax_credit = $1,
        charitable_donations_u61_yn = 'Y',
        is_complete = true,
        updated_at = NOW()
      WHERE tax_return_id = $2
    `, [excelData.taxCredits, taxReturnId]);
    console.log('✅ Credits form updated');

    console.log('5. Updating Final Tax Form...');
    await client.query(`
      UPDATE final_tax_forms SET
        sukuk_bonds_gross_amount = 12400000,
        sukuk_bonds_tax_rate = 10,
        debt_securities_gross_amount = 12400000,
        debt_securities_tax_rate = 15,
        sukuk_bonds_yn = 'Y',
        debt_securities_yn = 'Y',
        is_complete = true,
        updated_at = NOW()
      WHERE tax_return_id = $1
    `, [taxReturnId]);
    console.log('✅ Final tax form updated');

    // Now let's read back and verify
    console.log('\n6. Reading back current data...');
    const [income, capital, reductions, credits] = await Promise.all([
      client.query('SELECT * FROM income_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM capital_gain_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM reductions_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM credits_forms WHERE tax_return_id = $1', [taxReturnId])
    ]);

    console.log('\n📊 Updated Database Values:');
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

    if (reductions.rows.length > 0) {
      const red = reductions.rows[0];
      console.log('\n📉 Tax Reductions:');
      console.log(`   Teacher/Researcher Amount: Rs ${(red.teacher_researcher_amount || 0).toLocaleString()}`);
      console.log(`   Teacher/Researcher Reduction: Rs ${(red.teacher_researcher_tax_reduction || 0).toLocaleString()}`);
      console.log(`   Total Reductions: Rs ${(red.total_reductions || 0).toLocaleString()}`);
    }

    if (credits.rows.length > 0) {
      const cred = credits.rows[0];
      console.log('\n💳 Tax Credits:');
      console.log(`   Charitable Donations Amount: Rs ${(cred.charitable_donations_amount || 0).toLocaleString()}`);
      console.log(`   Charitable Donations Credit: Rs ${(cred.charitable_donations_tax_credit || 0).toLocaleString()}`);
      console.log(`   Total Credits: Rs ${(cred.total_credits || 0).toLocaleString()}`);
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

correctHassanData();