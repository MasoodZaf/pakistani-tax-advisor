// Test form data persistence after save
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tax_advisor',
  password: 'password',
  port: 5432,
});

async function testFormDataPersistence() {
  try {
    console.log('🔍 Testing form data persistence...\n');

    // Query the latest income form data
    const result = await pool.query(
      `SELECT
        user_id,
        tax_year,
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
        updated_at
       FROM income_forms
       WHERE user_id = '6bf47a47-5341-4884-9960-bb660dfdd9df'
       AND tax_year = '2025-26'
       ORDER BY updated_at DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      console.log('❌ No income form data found');
      return;
    }

    const data = result.rows[0];
    console.log('📊 Current Income Form Data:');
    console.log('================================');
    console.log(`Annual Basic Salary: ${formatNumber(data.annual_basic_salary)}`);
    console.log(`Allowances: ${formatNumber(data.allowances)}`);
    console.log(`Bonus: ${formatNumber(data.bonus)}`);
    console.log(`Medical Allowance: ${formatNumber(data.medical_allowance)}`);
    console.log(`Pension: ${formatNumber(data.pension_from_ex_employer)}`);
    console.log(`Employment Termination: ${formatNumber(data.employment_termination_payment)}`);
    console.log(`Retirement Funds: ${formatNumber(data.retirement_from_approved_funds)}`);
    console.log(`Directorship Fee: ${formatNumber(data.directorship_fee)}`);
    console.log(`Other Cash Benefits: ${formatNumber(data.other_cash_benefits)}`);
    console.log(`Employer Contribution: ${formatNumber(data.employer_contribution_provident)}`);
    console.log(`Taxable Car Value: ${formatNumber(data.taxable_car_value)}`);
    console.log(`Other Taxable Subsidies: ${formatNumber(data.other_taxable_subsidies)}`);
    console.log(`Profit on Debt 15%: ${formatNumber(data.profit_on_debt_15_percent)}`);
    console.log(`Profit on Debt 12.5%: ${formatNumber(data.profit_on_debt_12_5_percent)}`);
    console.log(`Rent Income: ${formatNumber(data.other_taxable_income_rent)}`);
    console.log(`Other Income: ${formatNumber(data.other_taxable_income_others)}`);
    console.log(`Last Updated: ${data.updated_at}`);

    // Check for non-zero values
    const nonZeroFields = [];
    if (data.annual_basic_salary > 0) nonZeroFields.push('annual_basic_salary');
    if (data.allowances > 0) nonZeroFields.push('allowances');
    if (data.bonus > 0) nonZeroFields.push('bonus');
    if (data.medical_allowance > 0) nonZeroFields.push('medical_allowance');
    if (data.pension_from_ex_employer > 0) nonZeroFields.push('pension_from_ex_employer');
    if (data.employment_termination_payment > 0) nonZeroFields.push('employment_termination_payment');
    if (data.retirement_from_approved_funds > 0) nonZeroFields.push('retirement_from_approved_funds');
    if (data.directorship_fee > 0) nonZeroFields.push('directorship_fee');
    if (data.other_cash_benefits > 0) nonZeroFields.push('other_cash_benefits');
    if (data.employer_contribution_provident > 0) nonZeroFields.push('employer_contribution_provident');
    if (data.taxable_car_value > 0) nonZeroFields.push('taxable_car_value');
    if (data.other_taxable_subsidies > 0) nonZeroFields.push('other_taxable_subsidies');
    if (data.profit_on_debt_15_percent > 0) nonZeroFields.push('profit_on_debt_15_percent');
    if (data.profit_on_debt_12_5_percent > 0) nonZeroFields.push('profit_on_debt_12_5_percent');
    if (data.other_taxable_income_rent > 0) nonZeroFields.push('other_taxable_income_rent');
    if (data.other_taxable_income_others > 0) nonZeroFields.push('other_taxable_income_others');

    console.log('\n📈 Analysis:');
    console.log('============');
    if (nonZeroFields.length > 0) {
      console.log(`✅ Found ${nonZeroFields.length} fields with data:`);
      nonZeroFields.forEach(field => console.log(`   - ${field}`));
    } else {
      console.log('❌ All fields are zero - data may not be persisting correctly');
    }

  } catch (error) {
    console.error('❌ Error testing form data persistence:', error);
  } finally {
    await pool.end();
  }
}

function formatNumber(value) {
  if (!value || value === 0) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

testFormDataPersistence();