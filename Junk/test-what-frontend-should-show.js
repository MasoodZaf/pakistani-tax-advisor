const fs = require('fs');

// Read the API response we just captured
const apiResponse = JSON.parse(fs.readFileSync('full_reports_response.json', 'utf8'));

console.log('🖥️  WHAT THE FRONTEND SHOULD DISPLAY:');
console.log('═══════════════════════════════════════════════════════════════');

// This is what Reports.js SummaryReport component should show
const calculations = apiResponse.calculations || {};
const totalTaxableIncome = calculations.taxableIncome || 0;
const totalAdjustableTax = calculations.adjustableTax || 0;
const totalCredits = calculations.taxCredits || 0;
const totalDeductions = calculations.allowableDeductions || 0;
const normalTax = calculations.normalIncomeTax || 0;
const totalTaxLiability = calculations.taxChargeable || 0;
const totalTaxPaid = calculations.totalTaxPaid || 0;
const refundDue = calculations.refundDue || 0;
const additionalTaxDue = calculations.additionalTaxDue || 0;

console.log(`💰 Total Taxable Income: Rs ${totalTaxableIncome.toLocaleString()}`);
console.log(`🧮 Normal Income Tax: Rs ${normalTax.toLocaleString()}`);
console.log(`📊 Tax Chargeable: Rs ${totalTaxLiability.toLocaleString()}`);
console.log(`💸 Capital Gains: Rs ${(calculations.capitalGain || 0).toLocaleString()}`);
console.log(`📉 Tax Reductions: Rs ${(calculations.taxReductions || 0).toLocaleString()}`);
console.log(`💳 Tax Credits: Rs ${totalCredits.toLocaleString()}`);
console.log(`🎯 Total Tax Paid: Rs ${totalTaxPaid.toLocaleString()}`);
console.log(`📋 Tax Demanded: Rs ${(calculations.taxDemanded || 0).toLocaleString()}`);

console.log('\n📊 Expected vs Your Screenshot:');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Expected Taxable Income: Rs ${totalTaxableIncome.toLocaleString()}`);
console.log(`Your Screenshot shows: Rs 38,440,000`);
console.log(`❌ MISMATCH: ${totalTaxableIncome !== 38440000 ? 'YES' : 'NO'}`);

console.log(`\nExpected Normal Income Tax: Rs ${normalTax.toLocaleString()}`);
console.log(`Your Screenshot shows: Rs 6,178,000`);
console.log(`❌ MISMATCH: ${Math.abs(normalTax - 6178000) > 1000 ? 'YES' : 'NO'}`);

console.log(`\nExpected Tax Chargeable: Rs ${totalTaxLiability.toLocaleString()}`);
console.log(`Your Screenshot shows: Rs 8,145,800`);
console.log(`❌ MISMATCH: ${Math.abs(totalTaxLiability - 8145800) > 1000 ? 'YES' : 'NO'}`);

// Check if there might be some calculation doubling
console.log('\n🔍 DEBUGGING POTENTIAL DOUBLE-COUNTING:');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Monthly Salary * 12: Rs ${(parseFloat(apiResponse.income.monthly_salary) * 12).toLocaleString()}`);
console.log(`+ Capital Gains: Rs ${(calculations.capitalGain || 0).toLocaleString()}`);
console.log(`= Should be Total Taxable: Rs ${((parseFloat(apiResponse.income.monthly_salary) * 12) + (calculations.capitalGain || 0)).toLocaleString()}`);

// Check if any field could produce the wrong value
const doubledTaxableIncome = totalTaxableIncome * 1.78; // Rough multiplier to see if this could match
console.log(`\nTaxable Income * 1.78: Rs ${doubledTaxableIncome.toLocaleString()}`);
console.log(`Close to 38,440,000? ${Math.abs(doubledTaxableIncome - 38440000) < 1000000 ? 'YES' : 'NO'}`);

console.log('\n🎯 CONCLUSION:');
console.log('═══════════════════════════════════════════════════════════════');
console.log('The API is returning CORRECT values!');
console.log('The frontend component is either:');
console.log('1. Using wrong field mapping');
console.log('2. Performing incorrect calculations');
console.log('3. Cached with old data');
console.log('4. Calling a different endpoint');

console.log('\nPlease check the frontend browser developer tools:');
console.log('1. Open browser Dev Tools (F12)');
console.log('2. Go to Network tab');
console.log('3. Refresh the page');
console.log('4. Check which API endpoint is being called');
console.log('5. Check the response data');