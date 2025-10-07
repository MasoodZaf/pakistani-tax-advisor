/**
 * Simple Report Test - Direct API Call
 */

const { pool } = require('./src/config/database');
const TaxCalculator = require('./src/utils/taxCalculator');

async function testReportDirectly() {
  console.log('🧪 DIRECT REPORT CALCULATION TEST\n');
  console.log('==================================\n');

  try {
    // Get test data from database
    const userResult = await pool.query(`
      SELECT
        tr.user_id, tr.tax_year, tr.id as tax_return_id,
        ty.id as tax_year_id
      FROM tax_returns tr
      JOIN tax_years ty ON tr.tax_year = ty.tax_year
      JOIN income_forms if ON tr.id = if.tax_return_id
      WHERE if.monthly_salary > 0
      LIMIT 1
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ No test data found');
      return;
    }

    const testData = userResult.rows[0];
    console.log(`📅 Testing tax year: ${testData.tax_year}`);
    console.log(`🆔 Tax return ID: ${testData.tax_return_id}`);
    console.log(`🆔 Tax year ID: ${testData.tax_year_id}\n`);

    // Get all form data
    const [incomeResult, adjustableTaxResult, reductionsResult, creditsResult,
           deductionsResult, finalTaxResult, capitalGainsResult] = await Promise.all([
      pool.query('SELECT * FROM income_forms WHERE tax_return_id = $1', [testData.tax_return_id]),
      pool.query('SELECT * FROM adjustable_tax_forms WHERE tax_return_id = $1', [testData.tax_return_id]),
      pool.query('SELECT * FROM reductions_forms WHERE tax_return_id = $1', [testData.tax_return_id]),
      pool.query('SELECT * FROM credits_forms WHERE tax_return_id = $1', [testData.tax_return_id]),
      pool.query('SELECT * FROM deductions_forms WHERE tax_return_id = $1', [testData.tax_return_id]),
      pool.query('SELECT * FROM final_tax_forms WHERE tax_return_id = $1', [testData.tax_return_id]),
      pool.query('SELECT * FROM capital_gain_forms WHERE tax_return_id = $1', [testData.tax_return_id])
    ]);

    console.log('📊 FORM DATA FOUND:');
    console.log(`Income forms: ${incomeResult.rows.length}`);
    console.log(`Adjustable tax forms: ${adjustableTaxResult.rows.length}`);
    console.log(`Credits forms: ${creditsResult.rows.length}`);
    console.log(`Deductions forms: ${deductionsResult.rows.length}`);
    console.log(`Final tax forms: ${finalTaxResult.rows.length}`);
    console.log(`Capital gains forms: ${capitalGainsResult.rows.length}\n`);

    if (incomeResult.rows.length === 0) {
      console.log('❌ No income data found');
      return;
    }

    const income = incomeResult.rows[0];
    console.log('💰 RAW INCOME DATA:');
    console.log(`Monthly Salary: Rs ${(income.monthly_salary || 0).toLocaleString()}`);
    console.log(`Bonus: Rs ${(income.bonus || 0).toLocaleString()}`);
    console.log(`Car Allowance: Rs ${(income.car_allowance || 0).toLocaleString()}`);
    console.log(`Medical Allowance: Rs ${(income.medical_allowance || 0).toLocaleString()}\n`);

    // Prepare tax data for calculation
    const taxData = {
      income: incomeResult.rows[0] || {},
      adjustableTax: adjustableTaxResult.rows[0] || {},
      reductions: reductionsResult.rows[0] || {},
      credits: creditsResult.rows[0] || {},
      deductions: deductionsResult.rows[0] || {},
      finalTax: finalTaxResult.rows[0] || {},
      capitalGain: capitalGainsResult.rows[0] || {}
    };

    console.log('🧮 RUNNING TAX CALCULATION...\n');

    // Calculate comprehensive tax
    const calculation = await TaxCalculator.calculateComprehensiveTax(
      taxData,
      testData.tax_year_id,
      'filer'
    );

    console.log('📊 CALCULATION RESULTS:');
    console.log('═'.repeat(50));
    console.log(`Gross Income:           Rs ${(calculation.grossIncome || 0).toLocaleString()}`);
    console.log(`Exempt Income:          Rs ${(calculation.exemptIncome || 0).toLocaleString()}`);
    console.log(`Allowable Deductions:   Rs ${(calculation.allowableDeductions || 0).toLocaleString()}`);
    console.log(`Taxable Income:         Rs ${(calculation.taxableIncome || 0).toLocaleString()}`);
    console.log(`Normal Tax:             Rs ${(calculation.normalTax || 0).toLocaleString()}`);
    console.log(`Tax Credits:            Rs ${(calculation.taxCredits || 0).toLocaleString()}`);
    console.log(`Tax After Credits:      Rs ${(calculation.taxAfterCredits || 0).toLocaleString()}`);
    console.log(`Adjustable Tax:         Rs ${(calculation.adjustableTax || 0).toLocaleString()}`);
    console.log(`Final Tax:              Rs ${(calculation.finalTax || 0).toLocaleString()}`);
    console.log(`Total Tax Liability:    Rs ${(calculation.totalTaxLiability || 0).toLocaleString()}`);
    console.log(`Total Tax Paid:         Rs ${(calculation.totalTaxPaid || 0).toLocaleString()}`);
    console.log(`Refund Due:             Rs ${(calculation.refundDue || 0).toLocaleString()}`);
    console.log(`Additional Tax Due:     Rs ${(calculation.additionalTaxDue || 0).toLocaleString()}`);
    console.log(`Effective Tax Rate:     ${calculation.effectiveTaxRate || 0}%`);
    console.log(`Marginal Tax Rate:      ${calculation.marginalTaxRate || 0}%`);

    console.log('\n✅ CALCULATION SUCCESSFUL');

    if (calculation.taxableIncome > 0) {
      console.log('✅ Tax calculation is working - taxable income is greater than 0');
    } else {
      console.log('⚠️  Taxable income is 0 - check if income data is being processed correctly');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testReportDirectly()
  .then(() => {
    console.log('\n🏁 Direct test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });