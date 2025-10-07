const { pool } = require('./src/config/database');
const TaxCalculator = require('./src/utils/taxCalculator');

async function directTaxVerification() {
  try {
    console.log('🧮 Direct Tax Computation Verification for Muhammad Hassan...\n');

    const taxReturnId = 'e44155d5-231a-436f-b0e5-b56cbd622137';
    const userId = 'e9277b31-7f12-4bc3-b12b-e5f0d3e0837a';
    const taxYearId = '1a23bdde-ce04-46f6-905b-25408c5cd888';

    // Get all form data for comprehensive calculation
    const [incomeResult, reductionsResult, creditsResult,
           deductionsResult, finalTaxResult, capitalGainsResult] = await Promise.all([
      pool.query('SELECT * FROM income_forms WHERE tax_return_id = $1', [taxReturnId]),
      pool.query('SELECT * FROM reductions_forms WHERE tax_return_id = $1', [taxReturnId]),
      pool.query('SELECT * FROM credits_forms WHERE tax_return_id = $1', [taxReturnId]),
      pool.query('SELECT * FROM deductions_forms WHERE tax_return_id = $1', [taxReturnId]),
      pool.query('SELECT * FROM final_tax_forms WHERE tax_return_id = $1', [taxReturnId]),
      pool.query('SELECT * FROM capital_gain_forms WHERE tax_return_id = $1', [taxReturnId])
    ]);

    // Prepare comprehensive tax data for calculation
    const taxData = {
      income: incomeResult.rows[0] || {},
      reductions: reductionsResult.rows[0] || {},
      credits: creditsResult.rows[0] || {},
      deductions: deductionsResult.rows[0] || {},
      finalTax: finalTaxResult.rows[0] || {},
      capitalGain: capitalGainsResult.rows[0] || {}
    };

    console.log('📊 RAW DATABASE VALUES:');
    console.log('═══════════════════════════════════════════════════════════════');

    console.log('💰 Income Form:');
    console.log(`   Monthly Salary: Rs ${(taxData.income.monthly_salary || 0).toLocaleString()}`);
    console.log(`   Annual Salary: Rs ${((taxData.income.monthly_salary || 0) * 12).toLocaleString()}`);
    console.log(`   Salary Tax Deducted (Monthly): Rs ${(taxData.income.salary_tax_deducted || 0).toLocaleString()}`);
    console.log(`   Salary Tax Deducted (Annual): Rs ${((taxData.income.salary_tax_deducted || 0) * 12).toLocaleString()}`);
    console.log(`   Medical Allowance: Rs ${(taxData.income.medical_allowance || 0).toLocaleString()}`);
    console.log(`   Employer Contribution: Rs ${(taxData.income.employer_contribution_approved_funds || 0).toLocaleString()}`);

    console.log('\n🏠 Capital Gains Form:');
    console.log(`   Immovable Property (1 year): Rs ${(taxData.capitalGain.immovable_property_1_year_taxable || 0).toLocaleString()}`);
    console.log(`   Tax Deducted: Rs ${(taxData.capitalGain.immovable_property_1_year_deducted || 0).toLocaleString()}`);
    console.log(`   Total Capital Gain: Rs ${(taxData.capitalGain.total_capital_gain || 0).toLocaleString()}`);
    console.log(`   Total Tax Deducted: Rs ${(taxData.capitalGain.total_tax_deducted || 0).toLocaleString()}`);

    console.log('\n📉 Reductions Form:');
    console.log(`   Teacher/Researcher Amount: Rs ${(taxData.reductions.teacher_researcher_amount || 0).toLocaleString()}`);
    console.log(`   Teacher/Researcher Reduction: Rs ${(taxData.reductions.teacher_researcher_tax_reduction || 0).toLocaleString()}`);
    console.log(`   Total Reductions: Rs ${(taxData.reductions.total_reductions || 0).toLocaleString()}`);

    console.log('\n💳 Credits Form:');
    console.log(`   Charitable Donations Amount: Rs ${(taxData.credits.charitable_donations_amount || 0).toLocaleString()}`);
    console.log(`   Charitable Donations Credit: Rs ${(taxData.credits.charitable_donations_tax_credit || 0).toLocaleString()}`);
    console.log(`   Total Credits: Rs ${(taxData.credits.total_credits || 0).toLocaleString()}`);

    console.log('\n🏦 Final Tax Form:');
    console.log(`   Sukuk Bonds Amount: Rs ${(taxData.finalTax.sukuk_bonds_gross_amount || 0).toLocaleString()}`);
    console.log(`   Debt Securities Amount: Rs ${(taxData.finalTax.debt_securities_gross_amount || 0).toLocaleString()}`);
    console.log(`   Total Final Tax: Rs ${(taxData.finalTax.total_final_tax || 0).toLocaleString()}`);

    // Calculate comprehensive tax using TaxCalculator
    console.log('\n🧮 CALCULATING TAX USING SYSTEM...');
    const comprehensiveTaxCalculation = await TaxCalculator.calculateComprehensiveTax(
      taxData,
      taxYearId,
      'filer'
    );

    console.log('\n📊 SYSTEM CALCULATED TAX COMPUTATION:');
    console.log('═══════════════════════════════════════════════════════════════');

    // Display system calculations
    console.log('💰 INCOME CALCULATION:');
    console.log(`   Gross Income: Rs ${(comprehensiveTaxCalculation.grossIncome || 0).toLocaleString()}`);
    console.log(`   Exempt Income: Rs ${(comprehensiveTaxCalculation.exemptIncome || 0).toLocaleString()}`);
    console.log(`   Taxable Income (excluding capital): Rs ${(comprehensiveTaxCalculation.taxableIncome || 0).toLocaleString()}`);
    console.log(`   Capital Gains: Rs ${(comprehensiveTaxCalculation.capitalGain || 0).toLocaleString()}`);
    console.log(`   Total Taxable Income (including capital): Rs ${((comprehensiveTaxCalculation.taxableIncome || 0) + (comprehensiveTaxCalculation.capitalGain || 0)).toLocaleString()}`);

    console.log('\n🧮 TAX CALCULATION:');
    console.log(`   Normal Income Tax: Rs ${(comprehensiveTaxCalculation.normalIncomeTax || 0).toLocaleString()}`);
    console.log(`   Surcharge: Rs ${(comprehensiveTaxCalculation.surcharge || 0).toLocaleString()}`);
    console.log(`   Capital Gain Tax: Rs ${(comprehensiveTaxCalculation.capitalGainTax || 0).toLocaleString()}`);
    console.log(`   Total Tax Before Reductions: Rs ${((comprehensiveTaxCalculation.normalIncomeTax || 0) + (comprehensiveTaxCalculation.surcharge || 0) + (comprehensiveTaxCalculation.capitalGainTax || 0)).toLocaleString()}`);

    console.log('\n📉 REDUCTIONS & CREDITS:');
    console.log(`   Tax Reductions: Rs ${(comprehensiveTaxCalculation.taxReductions || 0).toLocaleString()}`);
    console.log(`   Tax Credits: Rs ${(comprehensiveTaxCalculation.taxCredits || 0).toLocaleString()}`);
    console.log(`   Final Tax: Rs ${(comprehensiveTaxCalculation.finalTax || 0).toLocaleString()}`);

    console.log('\n🎯 FINAL TAX COMPUTATION:');
    console.log(`   Tax After Reductions: Rs ${(comprehensiveTaxCalculation.taxAfterReductions || 0).toLocaleString()}`);
    console.log(`   Tax After Credits: Rs ${(comprehensiveTaxCalculation.taxAfterCredits || 0).toLocaleString()}`);
    console.log(`   Total Tax Chargeable: Rs ${(comprehensiveTaxCalculation.taxChargeable || 0).toLocaleString()}`);
    console.log(`   Withholding Tax Paid: Rs ${(comprehensiveTaxCalculation.withholdingTax || 0).toLocaleString()}`);
    console.log(`   Tax Demanded/(Refund): Rs ${(comprehensiveTaxCalculation.taxDemanded || 0).toLocaleString()}`);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📋 EXPECTED RESULTS (FROM EXCEL):');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('💰 INCOME SUMMARY:');
    console.log(`   Income from Salary: Rs 21,440,000`);
    console.log(`   Capital Gains: Rs 1,500,000`);
    console.log(`   Total Taxable Income: Rs 21,595,000`);

    console.log('\n🧮 TAX CALCULATION:');
    console.log(`   Normal Income Tax: Rs 6,298,250`);
    console.log(`   Surcharge (10%): Rs 629,825`);
    console.log(`   Capital Gain Tax: Rs 175,000`);

    console.log('\n📉 REDUCTIONS & CREDITS:');
    console.log(`   Tax Reductions: Rs 1,772,019`);
    console.log(`   Tax Credits: Rs 1,295,707`);
    console.log(`   Final Tax: Rs 3,100,000`);

    console.log('\n🎯 FINAL TAX COMPUTATION:');
    console.log(`   Total Tax Chargeable: Rs 7,135,349`);
    console.log(`   Withholding Tax Paid: Rs 6,972,000`);
    console.log(`   Tax Demanded: Rs 163,349`);

    // Compare key values
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🔍 COMPARISON ANALYSIS:');
    console.log('═══════════════════════════════════════════════════════════════');

    const comparisons = [
      {
        label: 'Income from Salary',
        excel: 21440000,
        system: (taxData.income.monthly_salary || 0) * 12
      },
      {
        label: 'Capital Gains',
        excel: 1500000,
        system: taxData.capitalGain.total_capital_gain || 0
      },
      {
        label: 'Normal Income Tax',
        excel: 6298250,
        system: comprehensiveTaxCalculation.normalIncomeTax || 0
      },
      {
        label: 'Capital Gain Tax',
        excel: 175000,
        system: comprehensiveTaxCalculation.capitalGainTax || 0
      },
      {
        label: 'Tax Reductions',
        excel: 1772019,
        system: comprehensiveTaxCalculation.taxReductions || 0
      },
      {
        label: 'Tax Credits',
        excel: 1295707,
        system: comprehensiveTaxCalculation.taxCredits || 0
      },
      {
        label: 'Total Tax Chargeable',
        excel: 7135349,
        system: comprehensiveTaxCalculation.taxChargeable || 0
      },
      {
        label: 'Tax Demanded',
        excel: 163349,
        system: comprehensiveTaxCalculation.taxDemanded || 0
      }
    ];

    let allMatching = true;
    let matchingCount = 0;
    const tolerance = 1000; // Allow for small differences

    comparisons.forEach(comp => {
      const diff = Math.abs(comp.excel - comp.system);
      const match = diff < tolerance;
      const status = match ? '✅' : '❌';
      const percentDiff = comp.excel > 0 ? ((diff / comp.excel) * 100).toFixed(1) : 0;

      if (match) matchingCount++;
      if (!match) allMatching = false;

      console.log(`${status} ${comp.label.padEnd(25)}: Excel Rs ${comp.excel.toLocaleString().padStart(10)} | System Rs ${comp.system.toLocaleString().padStart(10)} ${!match ? `| Diff: Rs ${diff.toLocaleString()} (${percentDiff}%)` : ''}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`📊 MATCHING SUMMARY: ${matchingCount}/${comparisons.length} values match`);

    if (allMatching) {
      console.log('🎉 SUCCESS! All tax computations match the Excel file!');
      console.log('✅ The tax calculation system is working correctly.');
    } else {
      console.log('⚠️  Some values do not match. Analysis:');

      const failedComparisons = comparisons.filter(comp => Math.abs(comp.excel - comp.system) >= tolerance);
      failedComparisons.forEach(comp => {
        const diff = comp.excel - comp.system;
        console.log(`   • ${comp.label}: System is ${diff > 0 ? 'under' : 'over'} by Rs ${Math.abs(diff).toLocaleString()}`);
      });
    }
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Error in direct tax verification:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

directTaxVerification();