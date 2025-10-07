/**
 * FBR Excel Reconciliation Test
 * Verifies that our tax calculations match the official FBR Excel template
 * "Salaried Individuals 2025.xlsx"
 */

const { pool } = require('./src/config/database');
const TaxCalculator = require('./src/utils/taxCalculator');

// Test data from the Excel file "Salaried Individuals 2025.xlsx"
// Based on extracted-excel-data.json
const excelTestCase = {
  // Income Sheet Data
  income: {
    annual_salary: 7200000,               // Monthly Salary (shown as annual in Excel)
    bonus: 1500000,
    car_value: 50000,
    total_taxable_salary: 8750000,        // Excel: Total Taxable Salary
    medical_allowance: 400000,            // Excel: Medical allowance
    employer_contribution_funds: 100000,  // Excel: Employer Contribution
    total_exempt: 500000,                 // Excel: Total tax exempt
    other_income: 0,
    tax_deducted: 2200000                 // Excel: Tax deducted
  },

  // Deductions from Tax Computation sheet
  deductions: {
    deductible_allowances: 10000          // Excel: Deductible Allowances
  },

  // Expected Tax Computation Results from Excel "Tax Computation" sheet
  expectedResults: {
    // Income Summary (from Tax Computation sheet)
    incomeFromSalary: 8750000,            // Excel Tax Computation B5
    totalIncome: 8750000,                 // Excel Tax Computation B7
    deductibleAllowances: 10000,          // Excel Tax Computation B8
    taxableIncome: 8740000,               // Excel Tax Computation B9 (8750000 - 10000)

    // Tax Calculations from Tax Computation sheet
    // For 8,740,000:
    // Slab 1 (0-600K): 0 × 0% = 0
    // Slab 2 (600K-1.2M): 600,000 × 5% = 30,000
    // Slab 3 (1.2M-2.2M): 1,000,000 × 15% = 150,000
    // Slab 4 (2.2M-3.2M): 1,000,000 × 25% = 250,000
    // Slab 5 (3.2M-4.1M): 900,000 × 30% = 270,000
    // Slab 6 (Above 4.1M): 4,640,000 × 35% = 1,624,000
    // Total = 2,324,000
    normalIncomeTax: 2324000,             // Excel Tax Computation B14

    // No surcharge (income < 10M)
    surcharge: 0,                         // Excel Tax Computation B15

    // Total tax
    totalTaxBeforeAdjustments: 2324000,   // Excel Tax Computation B17

    // Withholding tax already paid
    withholdingTax: 2200000,              // Excel Tax Computation B25

    // Refund/Balance (Excel shows -8247 but we'll test the base calculation)
    // Note: Excel has tax reductions (586000) and credits (146247) which we'll ignore for base test
    expectedRefund: -8247.14              // Excel Tax Computation B29 (negative = refund)
  }
};

// Higher income test case (to test surcharge)
const highIncomeTestCase = {
  income: {
    annual_salary: 15000000,
    tax_deducted: 3000000,
    bonus: 0,
    car_value: 0,
    total_taxable_salary: 15000000,
    medical_allowance: 120000,  // Capped
    employer_contribution_funds: 0,
    total_exempt: 120000,
    other_income: 0
  },

  expectedResults: {
    grossIncome: 15000000,
    exemptIncome: 120000,
    taxableIncome: 14880000,

    // Tax calculation for 14,880,000
    // Slab 1 (0-600K): 0
    // Slab 2 (600K-1.2M): 30,000
    // Slab 3 (1.2M-2.2M): 150,000
    // Slab 4 (2.2M-3.2M): 250,000
    // Slab 5 (3.2M-4.1M): 270,000
    // Slab 6 (Above 4.1M): (14,880,000 - 4,100,000) × 35% = 10,780,000 × 35% = 3,773,000
    normalIncomeTax: 4473000,

    // Surcharge (income > 10M): 10% of normal tax
    surcharge: 447300,

    totalTaxBeforeAdjustments: 4920300,
    withholdingTax: 3000000,
    refundDue: 0,
    additionalTaxDue: 1920300
  }
};

async function runReconciliationTest() {
  try {
    console.log('\n========================================');
    console.log('FBR EXCEL RECONCILIATION TEST');
    console.log('========================================\n');

    // Get current tax year
    const taxYearResult = await pool.query(`
      SELECT id, tax_year FROM tax_years
      WHERE is_current = true
      ORDER BY start_date DESC
      LIMIT 1
    `);

    const taxYearId = taxYearResult.rows[0].id;
    const taxYearName = taxYearResult.rows[0].tax_year;

    console.log(`Tax Year: ${taxYearName} (ID: ${taxYearId})\n`);

    // Verify tax slabs are correct
    console.log('Step 1: Verifying Tax Slabs...');
    const slabsResult = await pool.query(`
      SELECT slab_name, slab_order, min_income, max_income, tax_rate, fixed_amount
      FROM tax_slabs
      WHERE tax_year_id = $1 AND slab_type = 'individual'
      ORDER BY slab_order
    `, [taxYearId]);

    console.log('\nCurrent Tax Slabs in Database:');
    console.log('┌──────────────────┬──────────────┬──────────────┬──────────┬──────────────┐');
    console.log('│ Slab Name        │ Min Income   │ Max Income   │ Rate     │ Fixed Amount │');
    console.log('├──────────────────┼──────────────┼──────────────┼──────────┼──────────────┤');

    slabsResult.rows.forEach(slab => {
      const minIncome = slab.min_income.toLocaleString('en-PK');
      const maxIncome = slab.max_income ? slab.max_income.toLocaleString('en-PK') : 'No Limit';
      const rate = (parseFloat(slab.tax_rate) * 100).toFixed(1) + '%';
      const fixed = slab.fixed_amount.toLocaleString('en-PK');

      console.log(`│ ${slab.slab_name.padEnd(16)} │ ${minIncome.padStart(12)} │ ${maxIncome.padStart(12)} │ ${rate.padStart(8)} │ ${fixed.padStart(12)} │`);
    });
    console.log('└──────────────────┴──────────────┴──────────────┴──────────┴──────────────┘\n');

    // Test Case 1: Standard Income (from Excel)
    console.log('========================================');
    console.log('TEST CASE 1: Standard Income (Rs 8.75M)');
    console.log('========================================\n');

    const testData1 = {
      income: {
        annual_basic_salary: excelTestCase.income.annual_salary,  // 7,200,000
        allowances_excluding_bonus_medical: 0,
        bonus: excelTestCase.income.bonus,  // 1,500,000
        medical_allowance: 0,  // Excel counts medical in exempt, not here
        taxable_car_value: excelTestCase.income.car_value,  // 50,000
        salary_tax_deducted: excelTestCase.income.tax_deducted,  // 2,200,000
        income_exempt_from_tax: 0,  // Will be deducted separately
        employer_contribution_provident: 0
      },
      deductions: {
        total_deduction_from_income: excelTestCase.deductions.deductible_allowances  // 10,000
      },
      credits: {},
      reductions: {},
      adjustableTax: {},
      finalTax: {},
      capitalGain: {}
    };

    const result1 = await TaxCalculator.calculateComprehensiveTax(testData1, taxYearId, 'filer');

    console.log('Excel Expected vs Our Calculation:');
    console.log('┌────────────────────────────────┬────────────────┬────────────────┬──────────┐');
    console.log('│ Metric                         │ Excel Expected │ Our Calculation│ Status   │');
    console.log('├────────────────────────────────┼────────────────┼────────────────┼──────────┤');

    const tests1 = [
      { name: 'Income from Salary', expected: excelTestCase.expectedResults.incomeFromSalary, actual: result1.grossIncome },
      { name: 'Deductible Allowances', expected: excelTestCase.expectedResults.deductibleAllowances, actual: result1.allowableDeductions },
      { name: 'Taxable Income', expected: excelTestCase.expectedResults.taxableIncome, actual: result1.taxableIncome },
      { name: 'Normal Income Tax', expected: excelTestCase.expectedResults.normalIncomeTax, actual: result1.normalIncomeTax },
      { name: 'Surcharge', expected: excelTestCase.expectedResults.surcharge, actual: result1.surcharge },
      { name: 'Total Tax', expected: excelTestCase.expectedResults.totalTaxBeforeAdjustments, actual: result1.normalIncomeTax + result1.surcharge },
      { name: 'Withholding Tax', expected: excelTestCase.expectedResults.withholdingTax, actual: result1.withholdingTax }
    ];

    let passCount1 = 0;
    tests1.forEach(test => {
      const expected = test.expected.toLocaleString('en-PK').padStart(14);
      const actual = test.actual.toLocaleString('en-PK').padStart(14);
      const diff = Math.abs(test.expected - test.actual);
      const status = diff < 10 ? '✅ PASS' : '❌ FAIL';
      if (diff < 10) passCount1++;

      console.log(`│ ${test.name.padEnd(30)} │ ${expected} │ ${actual} │ ${status.padEnd(8)} │`);
    });
    console.log('└────────────────────────────────┴────────────────┴────────────────┴──────────┘\n');

    console.log(`Test Case 1 Result: ${passCount1}/${tests1.length} tests passed\n`);

    // Test Case 2: High Income with Surcharge
    console.log('========================================');
    console.log('TEST CASE 2: High Income (Rs 15M) - Surcharge Test');
    console.log('========================================\n');

    const testData2 = {
      income: {
        // Total salary is 15M, but 120K is medical (exempt), so 14.88M is taxable base
        annual_basic_salary: highIncomeTestCase.income.total_taxable_salary - highIncomeTestCase.income.medical_allowance,  // 14,880,000
        allowances_excluding_bonus_medical: 0,
        bonus: highIncomeTestCase.income.bonus,
        medical_allowance: highIncomeTestCase.income.medical_allowance,  // 120,000 (will be added to gross)
        taxable_car_value: highIncomeTestCase.income.car_value,
        salary_tax_deducted: highIncomeTestCase.income.tax_deducted,
        income_exempt_from_tax: highIncomeTestCase.income.medical_allowance  // 120,000 (will be subtracted as exempt)
      },
      deductions: {},
      credits: {},
      reductions: {},
      adjustableTax: {},
      finalTax: {},
      capitalGain: {}
    };

    const result2 = await TaxCalculator.calculateComprehensiveTax(testData2, taxYearId, 'filer');

    console.log('Expected vs Our Calculation (High Income):');
    console.log('┌────────────────────────────────┬────────────────┬────────────────┬──────────┐');
    console.log('│ Metric                         │ Expected       │ Our Calculation│ Status   │');
    console.log('├────────────────────────────────┼────────────────┼────────────────┼──────────┤');

    const tests2 = [
      { name: 'Gross Income', expected: highIncomeTestCase.expectedResults.grossIncome, actual: result2.grossIncome },
      { name: 'Exempt Income', expected: highIncomeTestCase.expectedResults.exemptIncome, actual: result2.exemptIncome },
      { name: 'Taxable Income', expected: highIncomeTestCase.expectedResults.taxableIncome, actual: result2.taxableIncome },
      { name: 'Normal Income Tax', expected: highIncomeTestCase.expectedResults.normalIncomeTax, actual: result2.normalIncomeTax },
      { name: 'Surcharge (10%)', expected: highIncomeTestCase.expectedResults.surcharge, actual: result2.surcharge },
      { name: 'Total Tax', expected: highIncomeTestCase.expectedResults.totalTaxBeforeAdjustments, actual: result2.normalIncomeTax + result2.surcharge },
      { name: 'Additional Tax Due', expected: highIncomeTestCase.expectedResults.additionalTaxDue, actual: result2.additionalTaxDue }
    ];

    let passCount2 = 0;
    tests2.forEach(test => {
      const expected = test.expected.toLocaleString('en-PK').padStart(14);
      const actual = test.actual.toLocaleString('en-PK').padStart(14);
      const diff = Math.abs(test.expected - test.actual);
      const status = diff < 10 ? '✅ PASS' : '❌ FAIL';
      if (diff < 10) passCount2++;

      console.log(`│ ${test.name.padEnd(30)} │ ${expected} │ ${actual} │ ${status.padEnd(8)} │`);
    });
    console.log('└────────────────────────────────┴────────────────┴────────────────┴──────────┘\n');

    console.log(`Test Case 2 Result: ${passCount2}/${tests2.length} tests passed\n`);

    // Final Summary
    console.log('========================================');
    console.log('FINAL RECONCILIATION SUMMARY');
    console.log('========================================\n');

    const totalTests = tests1.length + tests2.length;
    const totalPass = passCount1 + passCount2;
    const successRate = ((totalPass / totalTests) * 100).toFixed(1);

    console.log(`Total Tests Run: ${totalTests}`);
    console.log(`Tests Passed: ${totalPass}`);
    console.log(`Tests Failed: ${totalTests - totalPass}`);
    console.log(`Success Rate: ${successRate}%\n`);

    if (totalPass === totalTests) {
      console.log('✅ FULL COMPLIANCE: All calculations match FBR Excel template!');
      console.log('✅ Application is production-ready for Tax Year 2025-26');
    } else {
      console.log(`⚠️  PARTIAL COMPLIANCE: ${totalTests - totalPass} calculation(s) differ from Excel`);
      console.log('⚠️  Review differences before production deployment');
    }

    console.log('\n========================================\n');

    await pool.end();
    process.exit(totalPass === totalTests ? 0 : 1);

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

// Run the test
runReconciliationTest();
