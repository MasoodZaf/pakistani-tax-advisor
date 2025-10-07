#!/usr/bin/env node

const axios = require('axios');

async function testCleanedFBRData() {
    try {
        console.log('🧹 TESTING CLEANED FBR DATA - No More Sample Values\n');

        // Login first
        const loginResponse = await axios.post('http://localhost:3001/api/login', {
            email: 'superadmin@paktaxadvisor.com',
            password: 'admin123'
        });

        const sessionToken = loginResponse.data.sessionToken;
        console.log('✓ Login successful\n');

        // Test the cleaned FBR endpoint
        const response = await axios.get('http://localhost:3001/api/tax-forms/summary-by-year/2025-26', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });

        const data = response.data.data;

        console.log('=== 🧹 CLEANED FBR DATA VERIFICATION ===\n');

        // Check main summary amounts - should show real data or 0 instead of sample values
        console.log('💰 MAIN SUMMARY VALUES:');
        console.log(`  - Net Assets: ${data.netAssets} (was 72354939)`);
        console.log(`  - Refundable Income Tax: ${data.refundableIncomeTax} (was 34660)`);
        console.log(`  - Tax Chargeable: ${data.taxChargeable} (was 9456851)`);
        console.log(`  - Taxable Income: ${data.taxableIncome} (was 29891003)`);
        console.log(`  - Total Income: ${data.totalIncome} (was 29891003)`);

        console.log('\n🏠 PERSONAL ASSETS:');
        data.personalAssets.forEach(asset => {
            console.log(`  - ${asset.description}: ${asset.amount} (was sample value)`);
        });

        console.log('\n💸 PERSONAL EXPENSES:');
        const expenses = data.personalExpenses;
        console.log(`  - Total: ${expenses.total} (was 16033439)`);
        console.log(`  - Vehicle: ${expenses.vehicle} (was 480000)`);
        console.log(`  - Travelling: ${expenses.travelling} (was 600000)`);
        console.log(`  - Electricity: ${expenses.electricity} (was 120000)`);
        console.log(`  - Medical: ${expenses.medical} (was 0)`);
        console.log(`  - Educational: ${expenses.educational} (was 3546000)`);

        console.log('\n🏦 TAX DETAILS:');
        console.log(`  - Adjustable Tax Receipts: ${data.adjustableTax.receipts} (was 298677594)`);
        console.log(`  - Adjustable Tax Collected: ${data.adjustableTax.taxCollected} (was 9491511)`);
        console.log(`  - Adjustable Tax Chargeable: ${data.adjustableTax.taxChargeable} (was 14847)`);

        // Check if all major sample values have been removed
        const sampleValues = [
            72354939, 34660, 9456851, 29891003, 298677594, 9491511, 14847,
            35000000, 26954939, 2400000, 6500000, 1000000, 500000,
            16033439, 480000, 600000, 120000, 3546000, 1369788, 58497375
        ];

        const responseStr = JSON.stringify(data);
        const foundSampleValues = sampleValues.filter(val => responseStr.includes(val.toString()));

        console.log('\n=== CLEANUP VERIFICATION ===');
        if (foundSampleValues.length === 0) {
            console.log('✅ SUCCESS! All hardcoded sample values have been removed!');
            console.log('📝 FBR report now shows:');
            console.log('   - Real form data where available');
            console.log('   - Zero (0) values where no data exists');
            console.log('   - No more fake sample values');
            console.log('\n🎯 Ready for you to map specific fields to actual tax form data!');
        } else {
            console.log('❌ Some sample values still found:', foundSampleValues);
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.response?.data || error.message);
    }
}

testCleanedFBRData();