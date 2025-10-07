/**
 * Debug Tax Calculator - Step by Step Analysis
 */

const { pool } = require('./src/config/database');

async function debugTaxCalculator() {
  console.log('🔍 DEBUGGING TAX CALCULATOR STEP BY STEP\n');
  console.log('=========================================\n');

  try {
    // Get test data
    const dataResult = await pool.query(`
      SELECT
        tr.user_id, tr.tax_year, tr.id as tax_return_id,
        ty.id as tax_year_id,
        if.*
      FROM tax_returns tr
      JOIN tax_years ty ON tr.tax_year = ty.tax_year
      JOIN income_forms if ON tr.id = if.tax_return_id
      WHERE if.monthly_salary > 0
      LIMIT 1
    `);

    if (dataResult.rows.length === 0) {
      console.log('❌ No test data found');
      return;
    }

    const data = dataResult.rows[0];
    const income = data;

    console.log('📊 RAW INCOME DATA FROM DATABASE:');
    console.log('─'.repeat(50));
    console.log(`monthly_salary: ${income.monthly_salary}`);
    console.log(`bonus: ${income.bonus}`);
    console.log(`car_allowance: ${income.car_allowance}`);
    console.log(`other_taxable: ${income.other_taxable}`);
    console.log(`medical_allowance: ${income.medical_allowance}`);
    console.log(`employer_contribution: ${income.employer_contribution}`);
    console.log(`other_exempt: ${income.other_exempt}`);
    console.log(`other_sources: ${income.other_sources}`);

    // Manual calculation step by step
    console.log('\n🧮 MANUAL STEP-BY-STEP CALCULATION:');
    console.log('─'.repeat(50));

    const monthly_salary = parseFloat(income.monthly_salary) || 0;
    const bonus = parseFloat(income.bonus) || 0;
    const car_allowance = parseFloat(income.car_allowance) || 0;
    const other_taxable = parseFloat(income.other_taxable) || 0;
    const other_sources = parseFloat(income.other_sources) || 0;

    const medical_allowance = parseFloat(income.medical_allowance) || 0;
    const employer_contribution = parseFloat(income.employer_contribution) || 0;
    const other_exempt = parseFloat(income.other_exempt) || 0;

    console.log('💰 TAXABLE INCOME COMPONENTS:');
    console.log(`  Monthly Salary: Rs ${monthly_salary.toLocaleString()}`);
    console.log(`  Bonus: Rs ${bonus.toLocaleString()}`);
    console.log(`  Car Allowance: Rs ${car_allowance.toLocaleString()}`);
    console.log(`  Other Taxable: Rs ${other_taxable.toLocaleString()}`);
    console.log(`  Other Sources: Rs ${other_sources.toLocaleString()}`);

    const grossTaxableIncome = monthly_salary + bonus + car_allowance + other_taxable + other_sources;
    console.log(`  GROSS TAXABLE: Rs ${grossTaxableIncome.toLocaleString()}`);

    console.log('\n💚 EXEMPT INCOME COMPONENTS:');
    console.log(`  Medical Allowance: Rs ${medical_allowance.toLocaleString()}`);
    console.log(`  Employer Contribution: Rs ${employer_contribution.toLocaleString()}`);
    console.log(`  Other Exempt: Rs ${other_exempt.toLocaleString()}`);

    const totalExemptIncome = medical_allowance + employer_contribution + other_exempt;
    console.log(`  TOTAL EXEMPT: Rs ${totalExemptIncome.toLocaleString()}`);

    const totalGrossIncome = grossTaxableIncome + totalExemptIncome;
    console.log(`\n📊 TOTAL GROSS INCOME: Rs ${totalGrossIncome.toLocaleString()}`);

    const netTaxableIncome = grossTaxableIncome; // Before deductions
    console.log(`📊 NET TAXABLE INCOME: Rs ${netTaxableIncome.toLocaleString()}`);

    if (netTaxableIncome === 0) {
      console.log('\n❌ PROBLEM IDENTIFIED: Net taxable income is 0');
      console.log('   This suggests an issue in the TaxCalculator logic');
    } else {
      console.log('\n✅ Manual calculation shows valid taxable income');
      console.log('   The issue is likely in the TaxCalculator implementation');
    }

    // Check what TaxCalculator is actually doing
    console.log('\n🔍 CHECKING TAX CALCULATOR LOGIC:');
    console.log('─'.repeat(50));

    // Simulate the taxCalculator logic
    const taxData = {
      income: {
        monthly_salary: income.monthly_salary,
        bonus: income.bonus,
        car_allowance: income.car_allowance,
        other_taxable: income.other_taxable,
        medical_allowance: income.medical_allowance,
        employer_contribution: income.employer_contribution,
        other_exempt: income.other_exempt,
        other_sources: income.other_sources
      },
      adjustableTax: {},
      reductions: {},
      credits: {},
      deductions: {},
      finalTax: {},
      capitalGain: {}
    };

    console.log('📋 TaxData object being passed to calculator:');
    console.log(JSON.stringify(taxData.income, null, 2));

    // Let's see what the TaxCalculator.calculateComprehensiveTax is doing
    console.log('\n🧪 Let\'s trace the TaxCalculator logic...');

    // Manual reproduction of the grossIncome calculation from taxCalculator.js:125-130
    const calcGrossIncome = (
      (taxData.income.monthly_salary || 0) +
      (taxData.income.bonus || 0) +
      (taxData.income.car_allowance || 0) +
      (taxData.income.other_taxable || 0) +
      (taxData.income.other_sources || 0)
    );

    const calcExemptIncome = (
      (taxData.income.medical_allowance || 0) +
      (taxData.income.employer_contribution || 0) +
      (taxData.income.other_exempt || 0)
    );

    const calcAllowableDeductions = (
      (taxData.deductions.professional_expenses_amount || 0) +
      (taxData.deductions.zakat_paid_amount || taxData.deductions.zakat || 0) +
      (taxData.deductions.total_deduction_from_income || 0)
    );

    const calcTaxableIncome = Math.max(0, calcGrossIncome - calcExemptIncome - calcAllowableDeductions);

    console.log(`TaxCalculator Gross Income: Rs ${calcGrossIncome.toLocaleString()}`);
    console.log(`TaxCalculator Exempt Income: Rs ${calcExemptIncome.toLocaleString()}`);
    console.log(`TaxCalculator Allowable Deductions: Rs ${calcAllowableDeductions.toLocaleString()}`);
    console.log(`TaxCalculator Taxable Income: Rs ${calcTaxableIncome.toLocaleString()}`);

    if (calcTaxableIncome === 0) {
      console.log('\n❌ FOUND THE ISSUE!');
      console.log('The TaxCalculator is returning 0 for taxable income');
      console.log('Possible causes:');
      console.log('1. Data type conversion issues');
      console.log('2. Field name mismatches');
      console.log('3. NULL/undefined values not handled properly');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugTaxCalculator()
  .then(() => {
    console.log('\n🏁 Debug completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  });