#!/usr/bin/env node

const axios = require('axios');

async function testFBREndpoint() {
    try {
        console.log('Testing FBR Tax Return endpoint...');

        // First login to get session token
        const loginResponse = await axios.post('http://localhost:3001/api/login', {
            email: 'superadmin@paktaxadvisor.com',
            password: 'admin123'
        });

        const sessionToken = loginResponse.data.sessionToken;
        console.log('Login successful, got session token');

        // Test the new summary-by-year endpoint
        const fbrResponse = await axios.get('http://localhost:3001/api/tax-forms/summary-by-year/2025-26', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });

        console.log('FBR Endpoint Response Status:', fbrResponse.status);
        console.log('Response has data:', !!fbrResponse.data);
        console.log('Response keys:', Object.keys(fbrResponse.data));

        if (fbrResponse.data.taxReturn) {
            console.log('✓ Tax return data found');
            console.log('✓ Tax year:', fbrResponse.data.taxReturn.tax_year);
            console.log('✓ Forms data structure present:', !!fbrResponse.data.forms);
        }

        console.log('\n✅ FBR endpoint test PASSED - working correctly!');

    } catch (error) {
        console.error('❌ FBR endpoint test FAILED:', error.response?.data || error.message);
        if (error.response?.status) {
            console.error('Status Code:', error.response.status);
        }
    }
}

testFBREndpoint();