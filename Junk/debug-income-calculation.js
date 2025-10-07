const { pool } = require('./src/config/database');

async function debugIncomeCalculation() {
  try {
    console.log('🔍 Debugging Income Calculation...\n');

    const taxReturnId = 'e44155d5-231a-436f-b0e5-b56cbd622137';

    // Get income data
    const incomeResult = await pool.query('SELECT * FROM income_forms WHERE tax_return_id = $1', [taxReturnId]);
    const income = incomeResult.rows[0] || {};

    console.log('📊 Raw income data from database:');
    console.log(JSON.stringify(income, null, 2));

    console.log('\n🧮 Calculations:');
    console.log('monthly_salary:', income.monthly_salary);
    console.log('annual_salary_and_wages:', income.annual_salary_and_wages);
    console.log('monthly_salary * 12:', parseFloat(income.monthly_salary || 0) * 12);

    const grossIncome = (
      parseFloat(income.annual_salary_and_wages || income.monthly_salary * 12 || 0) +
      parseFloat(income.bonus || 0) +
      parseFloat(income.car_allowance || 0) +
      parseFloat(income.other_taxable || 0) +
      parseFloat(income.other_sources || 0)
    );

    const exemptIncome = (
      parseFloat(income.medical_allowance || 0) +
      parseFloat(income.employer_contribution || 0) +
      parseFloat(income.other_exempt || 0)
    );

    console.log('\n📊 Calculated values:');
    console.log('grossIncome calculation:', grossIncome);
    console.log('exemptIncome calculation:', exemptIncome);
    console.log('medical_allowance:', parseFloat(income.medical_allowance || 0));
    console.log('employer_contribution:', parseFloat(income.employer_contribution || 0) || parseFloat(income.employer_contribution_approved_funds || 0));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugIncomeCalculation();