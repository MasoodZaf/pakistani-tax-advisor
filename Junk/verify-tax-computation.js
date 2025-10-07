const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function verifyTaxComputation() {
  try {
    console.log('🧮 Verifying Tax Computation for Muhammad Hassan...\n');

    // Step 1: Login
    console.log('1. Authenticating...');
    const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
      email: 'superadmin@paktaxadvisor.com',
      password: 'admin123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Authentication successful');

    // Step 2: Get tax computation summary
    const taxReturnId = 'e44155d5-231a-436f-b0e5-b56cbd622137';
    console.log('✅ Using Tax Return ID:', taxReturnId);

    console.log('\n2. Fetching tax calculation summary...');
    const summaryResponse = await axios.get(
      `${BASE_URL}/api/reports/tax-calculation-summary/2024-25`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const computation = summaryResponse.data;
    console.log('✅ Tax computation retrieved successfully');

    console.log('\n📊 SYSTEM CALCULATED TAX COMPUTATION:');
    console.log('═══════════════════════════════════════════════════════════════');

    // Income Summary
    console.log('💰 INCOME SUMMARY:');
    console.log(`   Income from Salary: Rs ${(computation.income?.totalGrossIncome || 0).toLocaleString()}`);
    console.log(`   Capital Gains: Rs ${(computation.capitalGains?.totalCapitalGain || 0).toLocaleString()}`);
    console.log(`   Total Taxable Income: Rs ${(computation.totalTaxableIncome || 0).toLocaleString()}`);

    // Tax Calculation
    console.log('\n🧮 TAX CALCULATION:');
    console.log(`   Normal Income Tax: Rs ${(computation.normalIncomeTax || 0).toLocaleString()}`);
    console.log(`   Surcharge (10%): Rs ${(computation.surcharge || 0).toLocaleString()}`);
    console.log(`   Capital Gain Tax: Rs ${(computation.capitalGains?.totalTaxDeducted || 0).toLocaleString()}`);
    console.log(`   Total Tax Before Reductions: Rs ${(computation.totalTaxBeforeReductions || 0).toLocaleString()}`);

    // Reductions and Credits
    console.log('\n📉 REDUCTIONS & CREDITS:');
    console.log(`   Tax Reductions: Rs ${(computation.reductions?.totalReductions || 0).toLocaleString()}`);
    console.log(`   Tax Credits: Rs ${(computation.credits?.totalCredits || 0).toLocaleString()}`);
    console.log(`   Final Tax: Rs ${(computation.finalTax?.totalFinalTax || 0).toLocaleString()}`);

    // Final Computation
    console.log('\n🎯 FINAL TAX COMPUTATION:');
    console.log(`   Total Tax Chargeable: Rs ${(computation.totalTaxChargeable || 0).toLocaleString()}`);
    console.log(`   Withholding Tax Paid: Rs ${(computation.withholdingTaxPaid || 0).toLocaleString()}`);
    console.log(`   Tax Demanded/(Refund): Rs ${(computation.taxDemanded || 0).toLocaleString()}`);

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
      { label: 'Income from Salary', excel: 21440000, system: computation.income?.totalGrossIncome || 0 },
      { label: 'Capital Gains', excel: 1500000, system: computation.capitalGains?.totalCapitalGain || 0 },
      { label: 'Normal Income Tax', excel: 6298250, system: computation.normalIncomeTax || 0 },
      { label: 'Capital Gain Tax', excel: 175000, system: computation.capitalGains?.totalTaxDeducted || 0 },
      { label: 'Tax Reductions', excel: 1772019, system: computation.reductions?.totalReductions || 0 },
      { label: 'Tax Credits', excel: 1295707, system: computation.credits?.totalCredits || 0 },
      { label: 'Total Tax Chargeable', excel: 7135349, system: computation.totalTaxChargeable || 0 },
      { label: 'Tax Demanded', excel: 163349, system: computation.taxDemanded || 0 }
    ];

    let allMatching = true;
    comparisons.forEach(comp => {
      const diff = Math.abs(comp.excel - comp.system);
      const match = diff < 100; // Allow for small rounding differences
      const status = match ? '✅' : '❌';

      if (!match) allMatching = false;

      console.log(`${status} ${comp.label.padEnd(25)}: Excel Rs ${comp.excel.toLocaleString().padStart(10)} | System Rs ${comp.system.toLocaleString().padStart(10)} ${!match ? `| Diff: Rs ${diff.toLocaleString()}` : ''}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════════');
    if (allMatching) {
      console.log('🎉 SUCCESS! All tax computations match the Excel file!');
      console.log('✅ The tax calculation system is working correctly.');
    } else {
      console.log('⚠️  Some values do not match. Further investigation needed.');
    }
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Error verifying tax computation:', error.message);
    if (error.response) {
      console.error('❌ Status:', error.response.status);
      console.error('❌ Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

verifyTaxComputation();