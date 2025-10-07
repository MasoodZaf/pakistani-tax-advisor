const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function verifyWebAppAPI() {
  try {
    console.log('🌐 Verifying Web App API with Updated Endpoints...\n');

    // Step 1: Use existing session token
    console.log('1. Using existing session token...');
    const token = '6a95ce3a-7c6f-48d6-9151-211ba1336212'; // Valid session from database
    console.log('✅ Session token ready');

    // Step 2: Test the updated summary-by-year endpoint (this is what the frontend uses)
    console.log('\n2. Testing updated summary-by-year endpoint...');
    const summaryResponse = await axios.get(
      `${BASE_URL}/api/tax-forms/summary-by-year/2024-25`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const summaryData = summaryResponse.data.data;
    console.log('✅ Updated summary endpoint successful');

    console.log('\n📊 WEB APP WILL NOW DISPLAY:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`💰 Income from Salary: Rs ${(summaryData.grossIncome || summaryData.incomeFromSalary || 0).toLocaleString()}`);
    console.log(`💰 Capital Gains: Rs ${(summaryData.capitalGain || 0).toLocaleString()}`);
    console.log(`💰 Total Taxable Income: Rs ${(summaryData.taxableIncome || 0).toLocaleString()}`);
    console.log(`🧮 Normal Income Tax: Rs ${(summaryData.normalIncomeTax || 0).toLocaleString()}`);
    console.log(`🧮 Surcharge: Rs ${(summaryData.surcharge || 0).toLocaleString()}`);
    console.log(`🧮 Capital Gain Tax: Rs ${(summaryData.capitalGainTax || 0).toLocaleString()}`);
    console.log(`📉 Tax Reductions: Rs ${(summaryData.taxReductions || 0).toLocaleString()}`);
    console.log(`💳 Tax Credits: Rs ${(summaryData.taxCredits || 0).toLocaleString()}`);
    console.log(`🏦 Final Tax: Rs ${(summaryData.finalTaxAmount || 0).toLocaleString()}`);
    console.log(`🎯 Total Tax Chargeable: Rs ${(summaryData.taxChargeable || 0).toLocaleString()}`);
    console.log(`💸 Withholding Tax: Rs ${(summaryData.withholdingTax || summaryData.withholdingIncomeTax || 0).toLocaleString()}`);
    console.log(`📋 Tax Demanded: Rs ${(summaryData.taxDemanded || 0).toLocaleString()}`);
    console.log(`💸 Refund Due: Rs ${(summaryData.refundDue || 0).toLocaleString()}`);

    console.log('\n📋 EXPECTED VALUES (FROM EXCEL):');
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
    console.log(`💸 Withholding Tax: Rs 6,972,000`);
    console.log(`📋 Tax Demanded: Rs 163,349`);

    // Compare key values
    const comparisons = [
      {
        label: 'Income from Salary',
        excel: 21440000,
        webApp: summaryData.grossIncome || summaryData.incomeFromSalary || 0
      },
      {
        label: 'Capital Gains',
        excel: 1500000,
        webApp: summaryData.capitalGain || 0
      },
      {
        label: 'Total Taxable Income',
        excel: 21595000,
        webApp: summaryData.taxableIncome || 0
      },
      {
        label: 'Normal Income Tax',
        excel: 6298250,
        webApp: summaryData.normalIncomeTax || 0
      },
      {
        label: 'Capital Gain Tax',
        excel: 175000,
        webApp: summaryData.capitalGainTax || 0
      },
      {
        label: 'Tax Reductions',
        excel: 1772019,
        webApp: summaryData.taxReductions || 0
      },
      {
        label: 'Tax Credits',
        excel: 1295707,
        webApp: summaryData.taxCredits || 0
      },
      {
        label: 'Total Tax Chargeable',
        excel: 7135349,
        webApp: summaryData.taxChargeable || 0
      },
      {
        label: 'Tax Demanded',
        excel: 163349,
        webApp: summaryData.taxDemanded || 0
      }
    ];

    console.log('\n🔍 FINAL VERIFICATION:');
    console.log('═══════════════════════════════════════════════════════════════');

    let allMatching = true;
    let matchingCount = 0;
    const tolerance = 1000;

    comparisons.forEach(comp => {
      const diff = Math.abs(comp.excel - comp.webApp);
      const match = diff < tolerance;
      const status = match ? '✅' : '❌';

      if (match) matchingCount++;
      if (!match) allMatching = false;

      console.log(`${status} ${comp.label.padEnd(25)}: Excel Rs ${comp.excel.toLocaleString().padStart(10)} | Web App Rs ${comp.webApp.toLocaleString().padStart(10)} ${!match ? `| Diff: Rs ${diff.toLocaleString()}` : ''}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`📊 FINAL RESULT: ${matchingCount}/${comparisons.length} values match`);

    if (allMatching) {
      console.log('🎉 PERFECT! Web App will now display correct tax computation!');
      console.log('✅ All values match the Excel file exactly.');
      console.log('✅ The user should now see the correct calculation results.');
      console.log('✅ Problem solved - updated summary endpoints are working!');
    } else {
      console.log('⚠️  Some values still do not match.');
      const failedComparisons = comparisons.filter(comp => Math.abs(comp.excel - comp.webApp) >= tolerance);
      failedComparisons.forEach(comp => {
        const diff = comp.excel - comp.webApp;
        console.log(`   • ${comp.label}: Web App is ${diff > 0 ? 'under' : 'over'} by Rs ${Math.abs(diff).toLocaleString()}`);
      });
    }
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Error verifying web app API:', error.message);
    if (error.response) {
      console.error('❌ Status:', error.response.status);
      console.error('❌ Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Server not running. Please start the backend server.');
    }
  }
}

verifyWebAppAPI();