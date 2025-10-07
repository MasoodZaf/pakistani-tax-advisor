const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tax_advisor',
  password: 'password',
  port: 5432,
});

// Test data from the image - fields marked as "Input cell"
// Mapped to correct column names from the income_forms table
const incomeData = {
  // Payments By Employer
  annual_basic_salary: 7200000,
  allowances: 6000000, // allowances_excluding_bonus_medical -> allowances
  bonus: 1500000,
  medical_allowance: 720000, // medical_allowance_not_provided -> medical_allowance
  pension_from_ex_employer: 400000,
  employment_termination_payment: 2000000,
  retirement_from_approved_funds: 5000000, // retirement_approved_funds -> retirement_from_approved_funds
  directorship_fee: 40000,
  other_cash_benefits: 1200000,

  // Non cash benefits
  employer_contribution_provident: 720000, // employer_contribution_funds -> employer_contribution_provident
  taxable_car_value: 1500000,
  other_taxable_subsidies: 200000,

  // Other Income (Subject to minimum tax)
  profit_on_debt_15_percent: 700000,
  profit_on_debt_12_5_percent: 1500000,

  // Other Income (Not Subject to minimum tax)
  other_taxable_income_rent: 700000,
  other_taxable_income_others: 50000
};

async function insertIncomeData() {
  const client = await pool.connect();

  try {
    console.log('Starting Super Admin Income Form data insertion...');

    // First, get the Super Admin user details
    const userQuery = `
      SELECT id, email, name
      FROM users
      WHERE email = 'khurramj@taxadvisor.pk'
    `;

    const userResult = await client.query(userQuery);

    if (userResult.rows.length === 0) {
      throw new Error('Super Admin user not found');
    }

    const user = userResult.rows[0];
    console.log(`Found Super Admin: ${user.name} (${user.email})`);

    // Get current tax year (using 2025-26 which is current)
    const taxYearQuery = `
      SELECT id, tax_year FROM tax_years WHERE is_current = true LIMIT 1
    `;

    const taxYearResult = await client.query(taxYearQuery);
    let taxYearId;

    if (taxYearResult.rows.length === 0) {
      throw new Error('No current tax year found');
    } else {
      taxYearId = taxYearResult.rows[0].id;
      console.log(`Using tax year: ${taxYearResult.rows[0].tax_year}`);
    }

    // Check if income form already exists for this user and tax year
    const existingIncomeQuery = `
      SELECT id FROM income_forms
      WHERE user_id = $1 AND tax_year = $2
    `;

    const existingResult = await client.query(existingIncomeQuery, [user.id, taxYearResult.rows[0].tax_year]);

    if (existingResult.rows.length > 0) {
      // Update existing record
      const updateQuery = `
        UPDATE income_forms SET
          annual_basic_salary = $3,
          allowances = $4,
          bonus = $5,
          medical_allowance = $6,
          pension_from_ex_employer = $7,
          employment_termination_payment = $8,
          retirement_from_approved_funds = $9,
          directorship_fee = $10,
          other_cash_benefits = $11,
          employer_contribution_provident = $12,
          taxable_car_value = $13,
          other_taxable_subsidies = $14,
          profit_on_debt_15_percent = $15,
          profit_on_debt_12_5_percent = $16,
          other_taxable_income_rent = $17,
          other_taxable_income_others = $18,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND tax_year = $2
        RETURNING id
      `;

      const updateResult = await client.query(updateQuery, [
        user.id, taxYearResult.rows[0].tax_year,
        incomeData.annual_basic_salary,
        incomeData.allowances,
        incomeData.bonus,
        incomeData.medical_allowance,
        incomeData.pension_from_ex_employer,
        incomeData.employment_termination_payment,
        incomeData.retirement_from_approved_funds,
        incomeData.directorship_fee,
        incomeData.other_cash_benefits,
        incomeData.employer_contribution_provident,
        incomeData.taxable_car_value,
        incomeData.other_taxable_subsidies,
        incomeData.profit_on_debt_15_percent,
        incomeData.profit_on_debt_12_5_percent,
        incomeData.other_taxable_income_rent,
        incomeData.other_taxable_income_others
      ]);

      console.log(`Updated existing income form record (ID: ${updateResult.rows[0].id})`);
    } else {
      // Insert new record
      const insertQuery = `
        INSERT INTO income_forms (
          user_id, tax_year,
          annual_basic_salary,
          allowances,
          bonus,
          medical_allowance,
          pension_from_ex_employer,
          employment_termination_payment,
          retirement_from_approved_funds,
          directorship_fee,
          other_cash_benefits,
          employer_contribution_provident,
          taxable_car_value,
          other_taxable_subsidies,
          profit_on_debt_15_percent,
          profit_on_debt_12_5_percent,
          other_taxable_income_rent,
          other_taxable_income_others,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING id
      `;

      const insertResult = await client.query(insertQuery, [
        user.id, taxYearResult.rows[0].tax_year,
        incomeData.annual_basic_salary,
        incomeData.allowances,
        incomeData.bonus,
        incomeData.medical_allowance,
        incomeData.pension_from_ex_employer,
        incomeData.employment_termination_payment,
        incomeData.retirement_from_approved_funds,
        incomeData.directorship_fee,
        incomeData.other_cash_benefits,
        incomeData.employer_contribution_provident,
        incomeData.taxable_car_value,
        incomeData.other_taxable_subsidies,
        incomeData.profit_on_debt_15_percent,
        incomeData.profit_on_debt_12_5_percent,
        incomeData.other_taxable_income_rent,
        incomeData.other_taxable_income_others
      ]);

      console.log(`Inserted new income form record (ID: ${insertResult.rows[0].id})`);
    }

    // Verify the data was inserted correctly
    const verifyQuery = `
      SELECT
        annual_basic_salary,
        allowances,
        bonus,
        medical_allowance,
        pension_from_ex_employer,
        employment_termination_payment,
        retirement_from_approved_funds,
        directorship_fee,
        other_cash_benefits,
        employer_contribution_provident,
        taxable_car_value,
        other_taxable_subsidies,
        profit_on_debt_15_percent,
        profit_on_debt_12_5_percent,
        other_taxable_income_rent,
        other_taxable_income_others,
        employment_termination_total,
        total_non_cash_benefits,
        other_income_min_tax_total,
        other_income_no_min_tax_total
      FROM income_forms
      WHERE user_id = $1 AND tax_year = $2
    `;

    const verifyResult = await client.query(verifyQuery, [user.id, taxYearResult.rows[0].tax_year]);
    const savedData = verifyResult.rows[0];

    console.log('\n=== DATA VERIFICATION ===');
    console.log('PAYMENTS BY EMPLOYER:');
    console.log(`- Annual Basic Salary: ${parseInt(savedData.annual_basic_salary || 0).toLocaleString()}`);
    console.log(`- Allowances: ${parseInt(savedData.allowances || 0).toLocaleString()}`);
    console.log(`- Bonus: ${parseInt(savedData.bonus || 0).toLocaleString()}`);
    console.log(`- Medical allowance: ${parseInt(savedData.medical_allowance || 0).toLocaleString()}`);
    console.log(`- Pension from ex-employer: ${parseInt(savedData.pension_from_ex_employer || 0).toLocaleString()}`);
    console.log(`- Employment Termination: ${parseInt(savedData.employment_termination_payment || 0).toLocaleString()}`);
    console.log(`- Retirement funds: ${parseInt(savedData.retirement_from_approved_funds || 0).toLocaleString()}`);
    console.log(`- Directorship Fee: ${parseInt(savedData.directorship_fee || 0).toLocaleString()}`);
    console.log(`- Other cash benefits: ${parseInt(savedData.other_cash_benefits || 0).toLocaleString()}`);

    console.log('\nNON CASH BENEFITS:');
    console.log(`- Employer Contribution: ${parseInt(savedData.employer_contribution_provident || 0).toLocaleString()}`);
    console.log(`- Taxable Car Value: ${parseInt(savedData.taxable_car_value || 0).toLocaleString()}`);
    console.log(`- Other subsidies: ${parseInt(savedData.other_taxable_subsidies || 0).toLocaleString()}`);

    console.log('\nOTHER INCOME (MIN TAX):');
    console.log(`- Profit on Debt 15%: ${parseInt(savedData.profit_on_debt_15_percent || 0).toLocaleString()}`);
    console.log(`- Profit on Debt 12.5%: ${parseInt(savedData.profit_on_debt_12_5_percent || 0).toLocaleString()}`);

    console.log('\nOTHER INCOME (NO MIN TAX):');
    console.log(`- Rent income: ${parseInt(savedData.other_taxable_income_rent || 0).toLocaleString()}`);
    console.log(`- Others: ${parseInt(savedData.other_taxable_income_others || 0).toLocaleString()}`);

    console.log('\nCALCULATED TOTALS:');
    console.log(`- Employment Termination Total: ${parseInt(savedData.employment_termination_total || 0).toLocaleString()}`);
    console.log(`- Total Non Cash Benefits: ${parseInt(savedData.total_non_cash_benefits || 0).toLocaleString()}`);
    console.log(`- Other Income (Min Tax) Total: ${parseInt(savedData.other_income_min_tax_total || 0).toLocaleString()}`);
    console.log(`- Other Income (No Min Tax) Total: ${parseInt(savedData.other_income_no_min_tax_total || 0).toLocaleString()}`);

    console.log('\n✅ Income Form data successfully saved for Super Admin!');
    console.log('The data will now be available when the Super Admin logs in and accesses the Income Form.');

  } catch (error) {
    console.error('Error inserting income data:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the script
insertIncomeData()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });