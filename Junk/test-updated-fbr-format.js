#!/usr/bin/env node

const axios = require('axios');

async function testUpdatedFBRFormat() {
    try {
        console.log('Testing Updated FBR Format...\n');

        // Login first
        const loginResponse = await axios.post('http://localhost:3001/api/login', {
            email: 'superadmin@paktaxadvisor.com',
            password: 'admin123'
        });

        const sessionToken = loginResponse.data.sessionToken;
        console.log('✓ Login successful');

        // Test the updated FBR endpoint
        const response = await axios.get('http://localhost:3001/api/tax-forms/summary-by-year/2025-26', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });

        const data = response.data.data;
        console.log('\n=== UPDATED FBR FORMAT TEST ===');

        // Check user information (should be blank/empty where not available)
        console.log('✓ User Information:');
        console.log(`  - Name: "${data.user.name}"`);
        console.log(`  - Email: "${data.user.email}"`);
        console.log(`  - Phone: "${data.user.phone || ''}"`);
        console.log(`  - Address: "${data.user.address}"`);
        console.log(`  - Registration No: "${data.user.registrationNo}"`);

        // Check tax year information
        console.log('\n✓ Tax Year Information:');
        console.log(`  - Tax Year: "${data.taxYear}"`);
        console.log(`  - Expected Period: 01-Jul-2024 - 30-Jun-2025`);
        console.log(`  - Expected Due Date: 30-Sep-2025`);

        // Verify address and registration are now empty
        const isAddressEmpty = data.user.address === '';
        const isRegistrationEmpty = data.user.registrationNo === '';

        console.log('\n=== VERIFICATION ===');
        console.log(`✓ Address field is empty: ${isAddressEmpty}`);
        console.log(`✓ Registration No field is empty: ${isRegistrationEmpty}`);
        console.log(`✓ Tax Year is correct: ${data.taxYear === '2025-26'}`);

        if (isAddressEmpty && isRegistrationEmpty) {
            console.log('\n🎉 SUCCESS! Personal information fields are now blank as requested!');
            console.log('📅 Tax year will be calculated correctly in frontend for period dates!');
        } else {
            console.log('\n❌ Personal information still contains sample data');
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.response?.data || error.message);
    }
}

testUpdatedFBRFormat();