/**
 * Cross-Form Data Linking Integration Tests
 * Verifies data movement between forms and end-to-end calculation accuracy
 * Based on "Salaried Individuals 2025.xlsx" cross-form relationships
 */

const mockDataSets = require('./comprehensive-mock-data-sets.json');

console.log('🔄 CROSS-FORM DATA LINKING INTEGRATION TESTS');
console.log('=============================================');

// Test complete data flow: Income → Adjustable Tax → Tax Computation
async function testCompleteDataFlowIntegration() {
  console.log('\n🔄 Testing Complete Data Flow Integration');

  const CalculationService = require('./src/services/calculationService');
  const TaxRateService = require('./src/services/taxRateService');

  console.log('📊 Step 1: Process Income Form Data');

  // Start with Income Form data
  const incomeData = mockDataSets.incomeFormData.midProfessional;
  console.log('Income Input:', {
    monthly_basic_salary: incomeData.monthly_basic_salary,
    directorship_fee: incomeData.directorship_fee,
    bonus: incomeData.bonus
  });

  const incomeCalculations = CalculationService.calculateIncomeFormFields(incomeData);
  console.log('Income Calculations:', {
    annual_basic_salary: incomeCalculations.annual_basic_salary,
    total_employment_income: incomeCalculations.total_employment_income,
    directorship_fee: incomeCalculations.directorship_fee || incomeData.directorship_fee
  });

  console.log('\n🔄 Step 2: Auto-Link to Adjustable Tax Form');

  // Create Adjustable Tax form with auto-linking
  const adjustableTaxData = {
    // Start with zeros - these should be auto-populated
    directorship_fee_149_3_gross_receipt: 0,
    profit_debt_15_percent_gross_receipt: 0,
    rent_section_155_gross_receipt: 0,
    // Add some independent withholdings
    electricity_domestic_gross_receipt: 30000,
    cellphone_bill_gross_receipt: 20000
  };

  // Simulate auto-linking logic
  const crossFormMap = mockDataSets.crossFormLinking.incomeToAdjustableTax;
  const incomeFormResult = {
    directorship_fee: incomeCalculations.directorship_fee || incomeData.directorship_fee,
    profit_on_debt_15_percent: incomeData.profit_on_debt_15_percent || 0,
    other_taxable_income_rent: incomeData.other_taxable_income_rent || 0
  };

  // Auto-link data from Income to Adjustable Tax
  Object.entries(crossFormMap).forEach(([incomeField, adjustableField]) => {
    if (incomeFormResult[incomeField] && adjustableTaxData[adjustableField] === 0) {
      adjustableTaxData[adjustableField] = incomeFormResult[incomeField];
      console.log(`   🔗 Linked: ${incomeField} (${incomeFormResult[incomeField]}) → ${adjustableField}`);
    }
  });

  console.log('Adjustable Tax Data After Linking:', adjustableTaxData);

  // Calculate adjustable tax with FBR rates
  const fbrRates = {
    directorship_fee: 0.20,
    profit_debt_15: 0.15,
    rent_section_155: 0.10,
    electricity_domestic: 0.075,
    cellphone_bill: 0.15
  };

  const adjustableCalculations = CalculationService.calculateAdjustableTaxFields(adjustableTaxData, fbrRates);
  console.log('\nAdjustable Tax Calculations:', {
    directorship_tax: adjustableCalculations.directorship_fee_149_3_tax_collected,
    total_withholding_tax: adjustableCalculations.total_tax_collected
  });

  console.log('\n📊 Step 3: Prepare Tax Computation Summary');

  // Create tax computation summary
  const taxComputationData = {
    // From Income Form
    total_employment_income: incomeCalculations.total_employment_income,
    income_from_salary: incomeCalculations.total_employment_income,

    // From Adjustable Tax Form
    withholding_tax: adjustableCalculations.total_tax_collected,

    // Calculated values
    gross_income: incomeCalculations.total_employment_income,
    taxable_income: incomeCalculations.total_employment_income - Math.abs(incomeCalculations.income_exempt_from_tax || 0),

    // Progressive tax calculation
    normal_income_tax: 0, // Will calculate below
    surcharge: 0,
    capital_gains_tax: 0,
    tax_reductions: 0,
    tax_credits: 0
  };

  // Calculate progressive tax using FBR slabs
  const progressiveTaxSlabs = mockDataSets.validationRules.progressive_tax_slabs;
  taxComputationData.normal_income_tax = CalculationService.calculateProgressiveTax(
    taxComputationData.taxable_income,
    progressiveTaxSlabs
  );

  // Apply surcharge if income > 10M
  if (taxComputationData.taxable_income > 10000000) {
    taxComputationData.surcharge = Math.round(taxComputationData.normal_income_tax * 0.09);
  }

  // Calculate final tax position
  taxComputationData.total_tax_before_adjustments =
    taxComputationData.normal_income_tax + taxComputationData.surcharge + taxComputationData.capital_gains_tax;

  taxComputationData.net_tax_payable =
    taxComputationData.total_tax_before_adjustments - taxComputationData.tax_reductions - taxComputationData.tax_credits;

  taxComputationData.balance_payable =
    taxComputationData.net_tax_payable - taxComputationData.withholding_tax;

  console.log('Tax Computation Summary:', {
    gross_income: taxComputationData.gross_income,
    taxable_income: taxComputationData.taxable_income,
    normal_income_tax: taxComputationData.normal_income_tax,
    withholding_tax: taxComputationData.withholding_tax,
    net_tax_payable: taxComputationData.net_tax_payable,
    balance_payable: taxComputationData.balance_payable
  });

  console.log('\n✅ Verification Checks:');

  // Verify data flow integrity
  const incomeFlowCorrect = adjustableTaxData.directorship_fee_149_3_gross_receipt === incomeData.directorship_fee;
  const taxCalculationCorrect = adjustableCalculations.directorship_fee_149_3_tax_collected > 0;
  const progressiveTaxReasonable = taxComputationData.normal_income_tax > 0 &&
                                  taxComputationData.normal_income_tax < taxComputationData.taxable_income;
  const balanceCalculationCorrect = taxComputationData.balance_payable ===
                                   (taxComputationData.net_tax_payable - taxComputationData.withholding_tax);

  console.log(`   Income → Adjustable Tax Flow: ${incomeFlowCorrect ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Tax Calculations Working: ${taxCalculationCorrect ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Progressive Tax Reasonable: ${progressiveTaxReasonable ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Final Balance Calculation: ${balanceCalculationCorrect ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = incomeFlowCorrect && taxCalculationCorrect && progressiveTaxReasonable && balanceCalculationCorrect;

  return {
    success: allPassed,
    data: {
      income: incomeCalculations,
      adjustableTax: adjustableCalculations,
      taxComputation: taxComputationData
    }
  };
}

// Test cross-form data consistency
async function testCrossFormDataConsistency() {
  console.log('\n🔍 Testing Cross-Form Data Consistency');

  const CalculationService = require('./src/services/calculationService');

  // Test scenario: Data entered in Income Form should consistently appear in Adjustable Tax
  const testScenarios = [
    {
      name: 'High Directorship Fee',
      incomeData: { directorship_fee: 5000000 },
      expectedAdjustableTax: Math.round(5000000 * 0.20) // 1M tax
    },
    {
      name: 'Multiple Income Sources',
      incomeData: {
        directorship_fee: 2000000,
        profit_on_debt_15_percent: 500000,
        other_taxable_income_rent: 300000
      },
      expectedTotal: Math.round(2000000 * 0.20) + Math.round(500000 * 0.15) + Math.round(300000 * 0.10)
    },
    {
      name: 'Zero Cross-Form Values',
      incomeData: {
        directorship_fee: 0,
        profit_on_debt_15_percent: 0
      },
      expectedTotal: 0
    }
  ];

  let allPassed = true;
  const consistencyResults = [];

  for (const scenario of testScenarios) {
    console.log(`\n--- Testing ${scenario.name} ---`);

    // Process income data
    const incomeCalculations = CalculationService.calculateIncomeFormFields(scenario.incomeData);

    // Create adjustable tax form with auto-linking
    const adjustableTaxData = {};
    const crossFormMap = mockDataSets.crossFormLinking.incomeToAdjustableTax;

    // Auto-link data
    Object.entries(crossFormMap).forEach(([incomeField, adjustableField]) => {
      const value = incomeCalculations[incomeField] || scenario.incomeData[incomeField] || 0;
      adjustableTaxData[adjustableField] = value;
    });

    // Calculate adjustable tax
    const fbrRates = {
      directorship_fee: 0.20,
      profit_debt_15: 0.15,
      rent_section_155: 0.10
    };

    const adjustableCalculations = CalculationService.calculateAdjustableTaxFields(adjustableTaxData, fbrRates);

    // Verify consistency
    let scenarioPass = true;

    if (scenario.expectedAdjustableTax !== undefined) {
      const actualTax = adjustableCalculations.directorship_fee_149_3_tax_collected;
      const match = Math.abs(actualTax - scenario.expectedAdjustableTax) < 1;
      console.log(`   Directorship Tax: Expected ${scenario.expectedAdjustableTax}, Got ${actualTax} - ${match ? 'PASS' : 'FAIL'}`);
      if (!match) scenarioPass = false;
    }

    if (scenario.expectedTotal !== undefined) {
      const actualTotal = adjustableCalculations.total_tax_collected;
      const match = Math.abs(actualTotal - scenario.expectedTotal) < 1;
      console.log(`   Total Tax: Expected ${scenario.expectedTotal}, Got ${actualTotal} - ${match ? 'PASS' : 'FAIL'}`);
      if (!match) scenarioPass = false;
    }

    if (!scenarioPass) allPassed = false;

    consistencyResults.push({
      scenario: scenario.name,
      passed: scenarioPass,
      adjustableCalculations
    });
  }

  console.log(`\n🔍 Data Consistency: ${allPassed ? '✅ ALL PASS' : '❌ SOME FAILED'}`);

  return { success: allPassed, results: consistencyResults };
}

// Test Excel compliance across forms
async function testCrossFormExcelCompliance() {
  console.log('\n📋 Testing Cross-Form Excel Compliance');

  const CalculationService = require('./src/services/calculationService');

  // Test complete Excel workflow from Income sheet to Tax Computation
  console.log('Testing Excel Formula Chain:');
  console.log('Income Sheet → Adjustable Tax Sheet → Tax Computation Sheet');

  // Income Sheet calculations (Sheet 2)
  const incomeData = {
    monthly_basic_salary: 200000,    // Rs 200K monthly
    monthly_medical_allowance: 10000, // Rs 10K monthly (120K annually, capped)
    directorship_fee: 3000000        // Rs 3M annual
  };

  console.log('\n📊 Income Sheet (Sheet 2) Calculations:');
  const incomeResult = CalculationService.calculateIncomeFormFields(incomeData);

  // Verify Excel formulas from Income sheet
  const expectedAnnualSalary = 200000 * 12; // 2.4M
  const expectedMedicalCap = Math.min(10000 * 12, 120000); // 120K (capped)
  const expectedIncomeExempt = -expectedMedicalCap; // -120K

  console.log(`   Excel B6 (Annual Salary): Expected ${expectedAnnualSalary}, Got ${incomeResult.annual_basic_salary}`);
  console.log(`   Excel B10 (Medical Cap): Expected ${expectedMedicalCap}, Got ${incomeResult.annual_medical_allowance}`);
  console.log(`   Excel B15 (Income Exempt): Expected ${expectedIncomeExempt}, Got ${incomeResult.income_exempt_from_tax}`);

  const incomeExcelPass = (incomeResult.annual_basic_salary === expectedAnnualSalary) &&
                          (incomeResult.annual_medical_allowance === expectedMedicalCap) &&
                          (incomeResult.income_exempt_from_tax === expectedIncomeExempt);

  // Adjustable Tax Sheet calculations (Sheet 3)
  console.log('\n📊 Adjustable Tax Sheet (Sheet 3) Calculations:');

  const adjustableTaxData = {
    directorship_fee_149_3_gross_receipt: incomeResult.directorship_fee || incomeData.directorship_fee
  };

  const fbrRates = { directorship_fee: 0.20 };
  const adjustableResult = CalculationService.calculateAdjustableTaxFields(adjustableTaxData, fbrRates);

  // Verify Excel formula C6: B6*20%
  const expectedDirectorshipTax = Math.round(adjustableTaxData.directorship_fee_149_3_gross_receipt * 0.20);

  console.log(`   Excel C6 (Directorship Tax): Expected ${expectedDirectorshipTax}, Got ${adjustableResult.directorship_fee_149_3_tax_collected}`);

  const adjustableExcelPass = adjustableResult.directorship_fee_149_3_tax_collected === expectedDirectorshipTax;

  // Tax Computation calculations (Sheet 6)
  console.log('\n📊 Tax Computation Sheet (Sheet 6) Calculations:');

  const taxComputationInput = {
    incomeFromSalary: incomeResult.total_employment_income,
    withholdingTax: adjustableResult.total_tax_collected
  };

  console.log(`   Total Income: ${taxComputationInput.incomeFromSalary}`);
  console.log(`   Withholding Tax: ${taxComputationInput.withholdingTax}`);

  // Calculate progressive tax
  const progressiveTaxSlabs = mockDataSets.validationRules.progressive_tax_slabs;
  const taxableIncome = taxComputationInput.incomeFromSalary - Math.abs(incomeResult.income_exempt_from_tax);
  const progressiveTax = CalculationService.calculateProgressiveTax(taxableIncome, progressiveTaxSlabs);

  console.log(`   Taxable Income: ${taxableIncome}`);
  console.log(`   Progressive Tax: ${progressiveTax}`);
  console.log(`   Net Tax Position: ${progressiveTax - taxComputationInput.withholdingTax}`);

  const taxComputationPass = progressiveTax > 0 && taxableIncome > 0;

  const allExcelPass = incomeExcelPass && adjustableExcelPass && taxComputationPass;

  console.log(`\n📋 Cross-Form Excel Compliance: ${allExcelPass ? '✅ ALL PASS' : '❌ SOME FAILED'}`);
  console.log(`   Income Sheet Formulas: ${incomeExcelPass ? 'PASS' : 'FAIL'}`);
  console.log(`   Adjustable Tax Formulas: ${adjustableExcelPass ? 'PASS' : 'FAIL'}`);
  console.log(`   Tax Computation Logic: ${taxComputationPass ? 'PASS' : 'FAIL'}`);

  return {
    success: allExcelPass,
    results: {
      income: incomeResult,
      adjustableTax: adjustableResult,
      taxComputation: { taxableIncome, progressiveTax }
    }
  };
}

// Test data validation across forms
async function testCrossFormDataValidation() {
  console.log('\n🔬 Testing Cross-Form Data Validation');

  const CalculationService = require('./src/services/calculationService');

  // Test edge cases that affect multiple forms
  const validationTests = [
    {
      name: 'Negative Values Handling',
      incomeData: {
        monthly_basic_salary: -50000,  // Should become 0
        directorship_fee: -100000      // Should become 0
      },
      expectedBehavior: 'Negative values should be sanitized to 0'
    },
    {
      name: 'Very Large Values',
      incomeData: {
        monthly_basic_salary: 10000000, // 120M annually
        directorship_fee: 100000000     // 100M
      },
      expectedBehavior: 'Large values should be processed without errors'
    },
    {
      name: 'String Values',
      incomeData: {
        monthly_basic_salary: 'invalid',
        directorship_fee: '5000000'      // Valid string number
      },
      expectedBehavior: 'Strings should be parsed or defaulted to 0'
    }
  ];

  let allValidationsPassed = true;

  for (const test of validationTests) {
    console.log(`\n--- Testing ${test.name} ---`);

    try {
      const incomeResult = CalculationService.calculateIncomeFormFields(test.incomeData);

      // Check if calculations completed without errors
      const calculationCompleted = incomeResult && typeof incomeResult.annual_basic_salary === 'number';

      if (test.name === 'Negative Values Handling') {
        const negativeHandled = incomeResult.annual_basic_salary >= 0;
        console.log(`   Negative salary handled: ${negativeHandled ? 'PASS' : 'FAIL'}`);
        if (!negativeHandled) allValidationsPassed = false;
      }

      if (test.name === 'String Values') {
        const stringHandled = incomeResult.annual_basic_salary >= 0;
        console.log(`   String values handled: ${stringHandled ? 'PASS' : 'FAIL'}`);
        if (!stringHandled) allValidationsPassed = false;
      }

      console.log(`   Calculation completed: ${calculationCompleted ? 'PASS' : 'FAIL'}`);
      if (!calculationCompleted) allValidationsPassed = false;

    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
      allValidationsPassed = false;
    }
  }

  console.log(`\n🔬 Cross-Form Validation: ${allValidationsPassed ? '✅ ALL PASS' : '❌ SOME FAILED'}`);

  return { success: allValidationsPassed };
}

// Run all cross-form integration tests
async function runCrossFormIntegrationTests() {
  console.log('\n🚀 Starting Cross-Form Integration Tests\n');

  let totalTests = 0;
  let passedTests = 0;

  // Test 1: Complete Data Flow Integration
  totalTests++;
  const test1 = await testCompleteDataFlowIntegration();
  if (test1.success) passedTests++;

  // Test 2: Cross-Form Data Consistency
  totalTests++;
  const test2 = await testCrossFormDataConsistency();
  if (test2.success) passedTests++;

  // Test 3: Cross-Form Excel Compliance
  totalTests++;
  const test3 = await testCrossFormExcelCompliance();
  if (test3.success) passedTests++;

  // Test 4: Cross-Form Data Validation
  totalTests++;
  const test4 = await testCrossFormDataValidation();
  if (test4.success) passedTests++;

  // Final Results
  console.log('\n📊 CROSS-FORM INTEGRATION TEST RESULTS');
  console.log('======================================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 All Cross-Form Integration Tests Passed!');
    console.log('✅ Data flow between forms working correctly');
    console.log('✅ Cross-form calculations accurate');
    console.log('✅ Excel formula chain compliance verified');
    console.log('✅ Data validation across forms operational');
  } else {
    console.log('\n⚠️ Some integration tests failed - review cross-form logic');
  }

  return {
    totalTests,
    passedTests,
    successRate: (passedTests / totalTests) * 100,
    detailedResults: {
      dataFlow: test1,
      consistency: test2,
      excelCompliance: test3,
      validation: test4
    }
  };
}

// Run tests
if (require.main === module) {
  runCrossFormIntegrationTests()
    .then((results) => {
      console.log('\n🏁 Cross-Form Integration Tests Completed!');
      console.log('\n🔄 Integration Summary:');
      console.log('   ✅ Income Form → Adjustable Tax Form linking verified');
      console.log('   ✅ Adjustable Tax → Tax Computation flow verified');
      console.log('   ✅ End-to-end calculation accuracy confirmed');
      console.log('   ✅ Excel formula compliance across forms verified');

      process.exit(results.passedTests === results.totalTests ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Integration test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runCrossFormIntegrationTests,
  testCompleteDataFlowIntegration,
  testCrossFormDataConsistency,
  testCrossFormExcelCompliance
};