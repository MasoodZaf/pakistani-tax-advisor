const { pool } = require('./src/config/database');
const TaxCalculator = require('./src/utils/taxCalculator');

async function testUpdatedSummaryEndpoint() {
  try {
    console.log('🧮 Testing Updated Summary Endpoint Logic...\n');

    const taxReturnId = 'e44155d5-231a-436f-b0e5-b56cbd622137';
    const userId = 'e9277b31-7f12-4bc3-b12b-e5f0d3e0837a';
    const taxYearId = '1a23bdde-ce04-46f6-905b-25408c5cd888';

    // Simulate the updated endpoint logic
    const [
      incomeData,
      adjustableTaxData,
      reductionsData,
      creditsData,
      deductionsData,
      finalTaxData,
      capitalGainData
    ] = await Promise.all([
      pool.query('SELECT * FROM income_forms WHERE tax_return_id = $1', [taxReturnId]),
      pool.query('SELECT * FROM adjustable_tax_forms WHERE tax_return_id = $1', [taxReturnId]),
      pool.query('SELECT * FROM reductions_forms WHERE tax_return_id = $1', [taxReturnId]),
      pool.query('SELECT * FROM credits_forms WHERE tax_return_id = $1', [taxReturnId]),
      pool.query('SELECT * FROM deductions_forms WHERE tax_return_id = $1', [taxReturnId]),
      pool.query('SELECT * FROM final_tax_forms WHERE tax_return_id = $1', [taxReturnId]),
      pool.query('SELECT * FROM capital_gain_forms WHERE tax_return_id = $1', [taxReturnId])
    ]);

    // Prepare tax data for TaxCalculator
    const taxData = {
      income: incomeData.rows[0] || {},
      adjustableTax: adjustableTaxData.rows[0] || {},
      reductions: reductionsData.rows[0] || {},
      credits: creditsData.rows[0] || {},
      deductions: deductionsData.rows[0] || {},
      finalTax: finalTaxData.rows[0] || {},
      capitalGain: capitalGainData.rows[0] || {}
    };

    console.log('🔍 Testing TaxCalculator integration...');

    // Calculate tax using TaxCalculator (same as updated endpoint)
    const comprehensiveTaxCalc = await TaxCalculator.calculateComprehensiveTax(
      taxData,
      taxYearId,
      'filer'
    );

    console.log('✅ TaxCalculator successful!');

    // Build summary data structure (same as updated endpoint)
    const summaryData = {
      // Use TaxCalculator results
      grossIncome: comprehensiveTaxCalc?.grossIncome || 0,
      exemptIncome: comprehensiveTaxCalc?.exemptIncome || 0,
      taxableIncome: comprehensiveTaxCalc?.taxableIncome || 0,
      capitalGain: comprehensiveTaxCalc?.capitalGain || 0,
      normalIncomeTax: comprehensiveTaxCalc?.normalIncomeTax || 0,
      surcharge: comprehensiveTaxCalc?.surcharge || 0,
      taxReductions: comprehensiveTaxCalc?.taxReductions || 0,
      taxCredits: comprehensiveTaxCalc?.taxCredits || 0,
      adjustableTaxAmount: comprehensiveTaxCalc?.adjustableTax || 0,
      finalTaxAmount: comprehensiveTaxCalc?.finalTax || 0,
      capitalGainTax: comprehensiveTaxCalc?.capitalGainTax || 0,
      taxChargeable: comprehensiveTaxCalc?.taxChargeable || 0,
      withholdingTax: comprehensiveTaxCalc?.withholdingTax || 0,
      taxDemanded: comprehensiveTaxCalc?.taxDemanded || 0,
      refundDue: comprehensiveTaxCalc?.refundDue || 0,
      additionalTaxDue: comprehensiveTaxCalc?.additionalTaxDue || 0,

      // Legacy fields for backward compatibility
      incomeFromSalary: comprehensiveTaxCalc?.grossIncome || 0,
      totalIncome: comprehensiveTaxCalc?.grossIncome || 0,
      withholdingIncomeTax: comprehensiveTaxCalc?.withholdingTax || 0
    };

    console.log('\n📊 UPDATED ENDPOINT WILL RETURN:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`💰 Income from Salary: Rs ${(summaryData.incomeFromSalary || 0).toLocaleString()}`);
    console.log(`💰 Capital Gains: Rs ${(summaryData.capitalGain || 0).toLocaleString()}`);
    console.log(`💰 Total Taxable Income: Rs ${(summaryData.taxableIncome || 0).toLocaleString()}`);
    console.log(`🧮 Normal Income Tax: Rs ${(summaryData.normalIncomeTax || 0).toLocaleString()}`);
    console.log(`🧮 Surcharge: Rs ${(summaryData.surcharge || 0).toLocaleString()}`);
    console.log(`🧮 Capital Gain Tax: Rs ${(summaryData.capitalGainTax || 0).toLocaleString()}`);
    console.log(`📉 Tax Reductions: Rs ${(summaryData.taxReductions || 0).toLocaleString()}`);
    console.log(`💳 Tax Credits: Rs ${(summaryData.taxCredits || 0).toLocaleString()}`);
    console.log(`🏦 Final Tax: Rs ${(summaryData.finalTaxAmount || 0).toLocaleString()}`);
    console.log(`🎯 Total Tax Chargeable: Rs ${(summaryData.taxChargeable || 0).toLocaleString()}`);
    console.log(`💸 Withholding Tax Paid: Rs ${(summaryData.withholdingTax || 0).toLocaleString()}`);
    console.log(`📋 Tax Demanded: Rs ${(summaryData.taxDemanded || 0).toLocaleString()}`);

    console.log('\n📋 EXPECTED (FROM EXCEL):');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`💰 Income from Salary: Rs 21,440,000`);
    console.log(`💰 Capital Gains: Rs 1,500,000`);
    console.log(`💰 Total Taxable Income: Rs 21,595,000`);
    console.log(`🧮 Normal Income Tax: Rs 6,298,250`);
    console.log(`🧮 Surcharge: Rs 629,825`);
    console.log(`🧮 Capital Gain Tax: Rs 175,000`);
    console.log(`📉 Tax Reductions: Rs 1,772,019`);
    console.log(`💳 Tax Credits: Rs 1,295,707`);
    console.log(`🏦 Final Tax: Rs 3,100,000`);
    console.log(`🎯 Total Tax Chargeable: Rs 7,135,349`);
    console.log(`💸 Withholding Tax Paid: Rs 6,972,000`);
    console.log(`📋 Tax Demanded: Rs 163,349`);

    // Compare key values
    const comparisons = [
      { label: 'Income from Salary', excel: 21440000, system: summaryData.incomeFromSalary },
      { label: 'Capital Gains', excel: 1500000, system: summaryData.capitalGain },
      { label: 'Normal Income Tax', excel: 6298250, system: summaryData.normalIncomeTax },
      { label: 'Capital Gain Tax', excel: 175000, system: summaryData.capitalGainTax },
      { label: 'Tax Reductions', excel: 1772019, system: summaryData.taxReductions },
      { label: 'Tax Credits', excel: 1295707, system: summaryData.taxCredits },
      { label: 'Total Tax Chargeable', excel: 7135349, system: summaryData.taxChargeable },
      { label: 'Tax Demanded', excel: 163349, system: summaryData.taxDemanded }
    ];

    console.log('\n🔍 COMPARISON:');
    console.log('═══════════════════════════════════════════════════════════════');

    let allMatching = true;
    let matchingCount = 0;
    const tolerance = 1000;

    comparisons.forEach(comp => {
      const diff = Math.abs(comp.excel - comp.system);
      const match = diff < tolerance;
      const status = match ? '✅' : '❌';

      if (match) matchingCount++;
      if (!match) allMatching = false;

      console.log(`${status} ${comp.label.padEnd(25)}: Excel Rs ${comp.excel.toLocaleString().padStart(10)} | API Rs ${comp.system.toLocaleString().padStart(10)} ${!match ? `| Diff: Rs ${diff.toLocaleString()}` : ''}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`📊 MATCHING SUMMARY: ${matchingCount}/${comparisons.length} values match`);

    if (allMatching) {
      console.log('🎉 SUCCESS! Updated API endpoint will return correct values!');
      console.log('✅ The web app should now show the correct tax computation.');
    } else {
      console.log('⚠️  Some values do not match.');
    }
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Error testing updated summary endpoint:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testUpdatedSummaryEndpoint();