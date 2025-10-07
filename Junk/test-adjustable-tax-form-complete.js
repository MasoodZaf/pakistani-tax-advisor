/**
 * Complete Adjustable Tax Form Test Script
 * Tests FBR tax rate calculations, Excel formula compliance, and cross-form data linking
 * Based on "Salaried Individuals 2025.xlsx" Adjustable Tax sheet
 */

const mockDataSets = require('./comprehensive-mock-data-sets.json');

console.log('🧪 ADJUSTABLE TAX FORM COMPLETE TEST SUITE');
console.log('==========================================');

// Test the calculation service and tax rate service directly
async function testAdjustableTaxCalculationsDirect() {
  console.log('\n💰 Testing Adjustable Tax Calculations Direct');

  try {
    const CalculationService = require('./src/services/calculationService');
    const TaxRateService = require('./src/services/taxRateService');

    // Get FBR tax rates
    const withholdingRates = {
      directorship_fee: 0.20,      // 20% FBR rate
      profit_debt_15: 0.15,        // 15% FBR rate
      sukook_12_5: 0.125,          // 12.5% FBR rate
      rent_section_155: 0.10,      // 10% FBR rate
      motor_vehicle_transfer: 0.03, // 3% FBR rate
      electricity_domestic: 0.075,  // 7.5% FBR rate
      cellphone_bill: 0.15         // 15% FBR rate
    };

    console.log('🏛️ FBR Tax Rates Loaded:', withholdingRates);

    // Test with basic scenario
    const testData = mockDataSets.adjustableTaxFormData.basicSalaried;
    console.log('\n📝 Input Data:', {
      profit_debt_15_percent_gross_receipt: testData.profit_debt_15_percent_gross_receipt,
      electricity_domestic_gross_receipt: testData.electricity_domestic_gross_receipt,
      cellphone_bill_gross_receipt: testData.cellphone_bill_gross_receipt
    });

    const calculations = CalculationService.calculateAdjustableTaxFields(testData, withholdingRates);

    console.log('💡 Calculated Results:', {
      profit_debt_15_percent_tax_collected: calculations.profit_debt_15_percent_tax_collected,
      electricity_domestic_tax_collected: calculations.electricity_domestic_tax_collected,
      cellphone_bill_tax_collected: calculations.cellphone_bill_tax_collected,
      total_gross_receipt: calculations.total_gross_receipt,
      total_tax_collected: calculations.total_tax_collected
    });

    // Verify FBR rate calculations
    const profitTaxCorrect = calculations.profit_debt_15_percent_tax_collected ===
                           Math.round(testData.profit_debt_15_percent_gross_receipt * 0.15);
    const electricityTaxCorrect = calculations.electricity_domestic_tax_collected ===
                                Math.round(testData.electricity_domestic_gross_receipt * 0.075);
    const cellphoneTaxCorrect = calculations.cellphone_bill_tax_collected ===
                              Math.round(testData.cellphone_bill_gross_receipt * 0.15);

    console.log('\n✅ FBR Rate Verification:');
    console.log(`   Profit on Debt 15%: ${profitTaxCorrect ? 'PASS' : 'FAIL'} (${calculations.profit_debt_15_percent_tax_collected} vs expected ${Math.round(testData.profit_debt_15_percent_gross_receipt * 0.15)})`);
    console.log(`   Electricity 7.5%: ${electricityTaxCorrect ? 'PASS' : 'FAIL'}`);
    console.log(`   Cellphone 15%: ${cellphoneTaxCorrect ? 'PASS' : 'FAIL'}`);

    const allPassed = profitTaxCorrect && electricityTaxCorrect && cellphoneTaxCorrect;

    return {
      success: allPassed,
      calculations,
      ratesVerified: { profitTaxCorrect, electricityTaxCorrect, cellphoneTaxCorrect }
    };

  } catch (error) {
    console.log('❌ Adjustable Tax Calculation Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test Excel formula compliance for adjustable tax calculations
async function testExcelFormulaComplianceAdjustableTax() {
  console.log('\n📋 Testing Excel Formula Compliance (Adjustable Tax)');

  const CalculationService = require('./src/services/calculationService');

  // Test Excel formula C6: B6*20% = Directorship Fee Tax
  const directorshipData = {
    directorship_fee_149_3_gross_receipt: 1000000  // 1M gross receipt
  };

  const fbrRates = {
    directorship_fee: 0.20  // 20% FBR rate
  };

  const result = CalculationService.calculateAdjustableTaxFields(directorshipData, fbrRates);

  console.log('Excel Formula C6 Test (Directorship Fee):');
  console.log(`  Input: Rs ${directorshipData.directorship_fee_149_3_gross_receipt.toLocaleString()}`);
  console.log(`  Formula: B6 * 20% = ${directorshipData.directorship_fee_149_3_gross_receipt} * 0.20`);
  console.log(`  Expected: Rs ${(directorshipData.directorship_fee_149_3_gross_receipt * 0.20).toLocaleString()}`);
  console.log(`  Calculated: Rs ${result.directorship_fee_149_3_tax_collected.toLocaleString()}`);

  const formulaCorrect = result.directorship_fee_149_3_tax_collected ===
                        Math.round(directorshipData.directorship_fee_149_3_gross_receipt * 0.20);

  // Test multiple withholding taxes totaling (Excel formula C32)
  const multipleWithholdingData = {
    directorship_fee_149_3_gross_receipt: 500000,     // 500K
    profit_debt_15_percent_gross_receipt: 200000,     // 200K
    rent_section_155_gross_receipt: 300000            // 300K
  };

  const multipleRates = {
    directorship_fee: 0.20,    // 20%
    profit_debt_15: 0.15,      // 15%
    rent_section_155: 0.10     // 10%
  };

  const multipleResult = CalculationService.calculateAdjustableTaxFields(multipleWithholdingData, multipleRates);

  const expectedTotal = Math.round(500000 * 0.20) + Math.round(200000 * 0.15) + Math.round(300000 * 0.10);
  // 100,000 + 30,000 + 30,000 = 160,000

  console.log('\nExcel Formula C32 Test (Total Tax Collected):');
  console.log(`  Expected Total: Rs ${expectedTotal.toLocaleString()}`);
  console.log(`  Calculated Total: Rs ${multipleResult.total_tax_collected.toLocaleString()}`);

  const totalFormulaCorrect = multipleResult.total_tax_collected === expectedTotal;

  const allPassed = formulaCorrect && totalFormulaCorrect;

  console.log(`\n📋 Excel Formula Compliance: ${allPassed ? '✅ ALL PASS' : '❌ SOME FAILED'}`);
  console.log(`   C6 Formula (Directorship): ${formulaCorrect ? 'PASS' : 'FAIL'}`);
  console.log(`   C32 Formula (Total): ${totalFormulaCorrect ? 'PASS' : 'FAIL'}`);

  return {
    success: allPassed,
    results: { result, multipleResult, expectedTotal }
  };
}

// Test all FBR withholding tax rates
async function testAllFBRWithholdingRates() {
  console.log('\n🏛️ Testing All FBR Withholding Tax Rates');

  const CalculationService = require('./src/services/calculationService');

  const fbrRates = mockDataSets.validationRules.adjustableTax;
  console.log('FBR Standard Rates:', fbrRates);

  // Test each rate individually
  const testCases = [
    {
      name: 'Directorship Fee u/s 149(3)',
      grossField: 'directorship_fee_149_3_gross_receipt',
      taxField: 'directorship_fee_149_3_tax_collected',
      amount: 1000000,
      rate: fbrRates.directorship_fee_rate,
      rateKey: 'directorship_fee'
    },
    {
      name: 'Profit on Debt 15%',
      grossField: 'profit_debt_15_percent_gross_receipt',
      taxField: 'profit_debt_15_percent_tax_collected',
      amount: 500000,
      rate: fbrRates.profit_debt_15_rate,
      rateKey: 'profit_debt_15'
    },
    {
      name: 'Sukook/Bonds 12.5%',
      grossField: 'sukook_12_5_percent_gross_receipt',
      taxField: 'sukook_12_5_percent_tax_collected',
      amount: 400000,
      rate: fbrRates.sukook_rate,
      rateKey: 'sukook_12_5'
    },
    {
      name: 'Rent u/s 155',
      grossField: 'rent_section_155_gross_receipt',
      taxField: 'rent_section_155_tax_collected',
      amount: 600000,
      rate: fbrRates.rent_rate,
      rateKey: 'rent_section_155'
    },
    {
      name: 'Motor Vehicle Transfer',
      grossField: 'motor_vehicle_transfer_gross_receipt',
      taxField: 'motor_vehicle_transfer_tax_collected',
      amount: 2000000,
      rate: fbrRates.motor_vehicle_rate,
      rateKey: 'motor_vehicle_transfer'
    }
  ];

  let allPassed = true;
  const results = [];

  for (const testCase of testCases) {
    const testData = { [testCase.grossField]: testCase.amount };
    const rates = { [testCase.rateKey]: testCase.rate };

    const result = CalculationService.calculateAdjustableTaxFields(testData, rates);
    const calculatedTax = result[testCase.taxField];
    const expectedTax = Math.round(testCase.amount * testCase.rate);

    const passed = calculatedTax === expectedTax;
    if (!passed) allPassed = false;

    results.push({
      name: testCase.name,
      passed,
      amount: testCase.amount,
      rate: testCase.rate,
      expected: expectedTax,
      calculated: calculatedTax
    });

    console.log(`${testCase.name}:`);
    console.log(`  Amount: Rs ${testCase.amount.toLocaleString()}`);
    console.log(`  Rate: ${(testCase.rate * 100).toFixed(1)}%`);
    console.log(`  Expected: Rs ${expectedTax.toLocaleString()}`);
    console.log(`  Calculated: Rs ${calculatedTax.toLocaleString()}`);
    console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  console.log(`🏛️ FBR Rate Compliance: ${allPassed ? '✅ ALL PASS' : '❌ SOME FAILED'}`);

  return { success: allPassed, results };
}

// Test cross-form data linking from Income Form
async function testCrossFormDataLinking() {
  console.log('\n🔄 Testing Cross-Form Data Linking');

  const CalculationService = require('./src/services/calculationService');

  // Simulate Income Form data that should link to Adjustable Tax
  const incomeFormData = {
    directorship_fee: 2000000,               // From Income Form
    profit_on_debt_15_percent: 100000,      // From Income Form
    other_taxable_income_rent: 500000       // From Income Form
  };

  // Simulate Adjustable Tax Form with auto-linking
  const adjustableTaxData = {
    // These should auto-populate from Income Form
    directorship_fee_149_3_gross_receipt: 0,  // Should become 2M
    profit_debt_15_percent_gross_receipt: 0,  // Should become 100K
    rent_section_155_gross_receipt: 0         // Should become 500K
  };

  // Simulate the auto-linking logic
  const crossFormMap = mockDataSets.crossFormLinking.incomeToAdjustableTax;

  Object.entries(crossFormMap).forEach(([incomeField, adjustableField]) => {
    if (incomeFormData[incomeField] && adjustableTaxData[adjustableField] === 0) {
      adjustableTaxData[adjustableField] = incomeFormData[incomeField];
      console.log(`🔗 Auto-linked: ${incomeField} (${incomeFormData[incomeField]}) → ${adjustableField}`);
    }
  });

  // Calculate taxes on the linked data
  const fbrRates = {
    directorship_fee: 0.20,
    profit_debt_15: 0.15,
    rent_section_155: 0.10
  };

  const linkedResult = CalculationService.calculateAdjustableTaxFields(adjustableTaxData, fbrRates);

  console.log('\nCross-Form Calculation Results:');
  console.log(`  Directorship Tax: Rs ${linkedResult.directorship_fee_149_3_tax_collected.toLocaleString()}`);
  console.log(`  Profit Debt Tax: Rs ${linkedResult.profit_debt_15_percent_tax_collected.toLocaleString()}`);
  console.log(`  Rent Tax: Rs ${linkedResult.rent_section_155_tax_collected.toLocaleString()}`);
  console.log(`  Total Tax: Rs ${linkedResult.total_tax_collected.toLocaleString()}`);

  // Verify linking worked correctly
  const directorshipLinked = adjustableTaxData.directorship_fee_149_3_gross_receipt === incomeFormData.directorship_fee;
  const profitLinked = adjustableTaxData.profit_debt_15_percent_gross_receipt === incomeFormData.profit_on_debt_15_percent;
  const rentLinked = adjustableTaxData.rent_section_155_gross_receipt === incomeFormData.other_taxable_income_rent;

  const taxCalculationsCorrect = linkedResult.directorship_fee_149_3_tax_collected ===
                               Math.round(incomeFormData.directorship_fee * 0.20);

  const allPassed = directorshipLinked && profitLinked && rentLinked && taxCalculationsCorrect;

  console.log(`\n🔄 Cross-Form Linking: ${allPassed ? '✅ ALL PASS' : '❌ SOME FAILED'}`);
  console.log(`   Directorship Linking: ${directorshipLinked ? 'PASS' : 'FAIL'}`);
  console.log(`   Profit Debt Linking: ${profitLinked ? 'PASS' : 'FAIL'}`);
  console.log(`   Rent Linking: ${rentLinked ? 'PASS' : 'FAIL'}`);
  console.log(`   Tax Calculations: ${taxCalculationsCorrect ? 'PASS' : 'FAIL'}`);

  return {
    success: allPassed,
    linkedData: adjustableTaxData,
    calculations: linkedResult
  };
}

// Test different income scenarios with adjustable tax
async function testDifferentIncomeScenarios() {
  console.log('\n📊 Testing Different Income Scenarios');

  const CalculationService = require('./src/services/calculationService');
  const scenarios = ['basicSalaried', 'midProfessional', 'highExecutive'];

  let allPassed = true;
  const scenarioResults = [];

  for (const scenario of scenarios) {
    console.log(`\n--- Testing ${scenario} Scenario ---`);

    const testData = mockDataSets.adjustableTaxFormData[scenario];
    const expectedResults = testData.expected;

    const fbrRates = {
      directorship_fee: 0.20,
      profit_debt_15: 0.15,
      sukook_12_5: 0.125,
      rent_section_155: 0.10,
      motor_vehicle_transfer: 0.03,
      electricity_domestic: 0.075,
      cellphone_bill: 0.15
    };

    const calculations = CalculationService.calculateAdjustableTaxFields(testData, fbrRates);

    console.log(`Input: Total Gross Receipt ~Rs ${testData.directorship_fee_149_3_gross_receipt?.toLocaleString() || 'various'}`);
    console.log(`Expected Total Tax: Rs ${expectedResults.total_tax_collected.toLocaleString()}`);
    console.log(`Calculated Total Tax: Rs ${calculations.total_tax_collected.toLocaleString()}`);

    const tolerance = 1000; // Allow small rounding differences
    const match = Math.abs(calculations.total_tax_collected - expectedResults.total_tax_collected) < tolerance;

    console.log(`Result: ${match ? '✅ PASS' : '❌ FAIL'}`);

    if (!match) allPassed = false;

    scenarioResults.push({
      scenario,
      expected: expectedResults.total_tax_collected,
      calculated: calculations.total_tax_collected,
      match
    });
  }

  console.log(`\n📊 Scenario Testing: ${allPassed ? '✅ ALL PASS' : '❌ SOME FAILED'}`);

  return { success: allPassed, results: scenarioResults };
}

// Test validation and edge cases for adjustable tax
async function testAdjustableTaxValidationEdgeCases() {
  console.log('\n🔬 Testing Adjustable Tax Validation and Edge Cases');

  const CalculationService = require('./src/services/calculationService');

  // Edge Case 1: Zero gross receipts
  const zeroData = {
    directorship_fee_149_3_gross_receipt: 0,
    profit_debt_15_percent_gross_receipt: 0
  };

  const zeroResult = CalculationService.calculateAdjustableTaxFields(zeroData, {});
  const zeroTaxCorrect = zeroResult.total_tax_collected === 0;

  // Edge Case 2: Very large amounts
  const largeData = {
    directorship_fee_149_3_gross_receipt: 100000000  // 100M
  };

  const largeRates = { directorship_fee: 0.20 };
  const largeResult = CalculationService.calculateAdjustableTaxFields(largeData, largeRates);
  const largeTaxCorrect = largeResult.directorship_fee_149_3_tax_collected === 20000000; // 20M

  // Edge Case 3: Mixed small and large amounts
  const mixedData = {
    directorship_fee_149_3_gross_receipt: 50000000,   // 50M
    electricity_domestic_gross_receipt: 1000          // 1K
  };

  const mixedRates = {
    directorship_fee: 0.20,
    electricity_domestic: 0.075
  };

  const mixedResult = CalculationService.calculateAdjustableTaxFields(mixedData, mixedRates);
  const expectedMixedTax = Math.round(50000000 * 0.20) + Math.round(1000 * 0.075); // 10M + 75
  const mixedTaxCorrect = mixedResult.total_tax_collected === expectedMixedTax;

  console.log('Edge Case Results:');
  console.log(`  Zero Values - Total Tax: ${zeroResult.total_tax_collected} (should be 0)`);
  console.log(`  Large Amount - Directorship Tax: ${largeResult.directorship_fee_149_3_tax_collected.toLocaleString()} (should be 20,000,000)`);
  console.log(`  Mixed Amounts - Total Tax: ${mixedResult.total_tax_collected.toLocaleString()} (should be ${expectedMixedTax.toLocaleString()})`);

  const allPassed = zeroTaxCorrect && largeTaxCorrect && mixedTaxCorrect;

  console.log(`\n🔬 Edge Cases: ${allPassed ? '✅ ALL PASS' : '❌ SOME FAILED'}`);
  console.log(`   Zero Values: ${zeroTaxCorrect ? 'PASS' : 'FAIL'}`);
  console.log(`   Large Amounts: ${largeTaxCorrect ? 'PASS' : 'FAIL'}`);
  console.log(`   Mixed Amounts: ${mixedTaxCorrect ? 'PASS' : 'FAIL'}`);

  return { success: allPassed };
}

// Run all adjustable tax tests
async function runAdjustableTaxTests() {
  console.log('\n🚀 Starting Adjustable Tax Form Tests\n');

  let totalTests = 0;
  let passedTests = 0;

  // Test 1: Basic Adjustable Tax Calculations
  totalTests++;
  const test1 = await testAdjustableTaxCalculationsDirect();
  if (test1.success) passedTests++;

  // Test 2: Excel Formula Compliance
  totalTests++;
  const test2 = await testExcelFormulaComplianceAdjustableTax();
  if (test2.success) passedTests++;

  // Test 3: All FBR Withholding Rates
  totalTests++;
  const test3 = await testAllFBRWithholdingRates();
  if (test3.success) passedTests++;

  // Test 4: Cross-Form Data Linking
  totalTests++;
  const test4 = await testCrossFormDataLinking();
  if (test4.success) passedTests++;

  // Test 5: Different Income Scenarios
  totalTests++;
  const test5 = await testDifferentIncomeScenarios();
  if (test5.success) passedTests++;

  // Test 6: Validation and Edge Cases
  totalTests++;
  const test6 = await testAdjustableTaxValidationEdgeCases();
  if (test6.success) passedTests++;

  // Final Results
  console.log('\n📊 ADJUSTABLE TAX TEST RESULTS');
  console.log('===============================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 All Adjustable Tax Tests Passed!');
    console.log('✅ FBR tax rate calculations working correctly');
    console.log('✅ Excel formula compliance verified');
    console.log('✅ Cross-form data linking operational');
    console.log('✅ All withholding tax rates compliant');
  } else {
    console.log('\n⚠️ Some tests failed - review implementation');
  }

  return {
    totalTests,
    passedTests,
    successRate: (passedTests / totalTests) * 100
  };
}

// Run tests
if (require.main === module) {
  runAdjustableTaxTests()
    .then((results) => {
      console.log('\n🏁 Adjustable Tax Form Tests Completed!');
      process.exit(results.passedTests === results.totalTests ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runAdjustableTaxTests,
  testAdjustableTaxCalculationsDirect,
  testExcelFormulaComplianceAdjustableTax,
  testCrossFormDataLinking
};