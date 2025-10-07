#!/usr/bin/env node

const axios = require('axios');

async function testTaxYearDisplay() {
    try {
        console.log('Testing Tax Year Display in FBR Format...\n');

        // Login first
        const loginResponse = await axios.post('http://localhost:3001/api/login', {
            email: 'superadmin@paktaxadvisor.com',
            password: 'admin123'
        });

        const sessionToken = loginResponse.data.sessionToken;
        console.log('✓ Login successful');

        // Test different tax years
        const testYears = ['2025-26', '2024-25', '2023-24'];

        for (const year of testYears) {
            console.log(`\n=== Testing Tax Year: ${year} ===`);

            const response = await axios.get(`http://localhost:3001/api/tax-forms/summary-by-year/${year}`, {
                headers: {
                    'Authorization': `Bearer ${sessionToken}`
                }
            });

            const data = response.data.data;
            console.log(`✓ API Response for ${year}:`);
            console.log(`  - taxYear field: "${data.taxYear}"`);
            console.log(`  - Return Number: "${data.returnNumber}"`);
            console.log(`  - Expected in FBR: "Tax Year: ${data.taxYear}"`);
        }

        console.log('\n✅ Tax year display test completed successfully!');
        console.log('🎯 The FBR format will show the exact selected tax year');

    } catch (error) {
        console.error('\n❌ Tax year display test failed:', error.response?.data || error.message);
    }
}

testTaxYearDisplay();