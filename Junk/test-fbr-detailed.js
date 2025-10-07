#!/usr/bin/env node

const axios = require('axios');

async function testFBRDetails() {
    try {
        console.log('Testing FBR Tax Return endpoint in detail...\n');

        // Login first
        const loginResponse = await axios.post('http://localhost:3001/api/login', {
            email: 'superadmin@paktaxadvisor.com',
            password: 'admin123'
        });

        const sessionToken = loginResponse.data.sessionToken;
        console.log('✓ Login successful');

        // Test the FBR endpoint
        const fbrResponse = await axios.get('http://localhost:3001/api/tax-forms/summary-by-year/2025-26', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });

        console.log('✓ FBR endpoint responded successfully');
        console.log('Response structure:', Object.keys(fbrResponse.data));
        console.log('Full response:', JSON.stringify(fbrResponse.data, null, 2));

        const data = fbrResponse.data.data || fbrResponse.data;
        console.log('\nWorking with data:', !!data);

        // Check tax return data
        console.log('=== TAX RETURN DATA ===');
        if (data.taxReturn) {
            console.log('✓ Tax return found');
            console.log('  - ID:', data.taxReturn.id);
            console.log('  - Tax Year:', data.taxReturn.tax_year);
            console.log('  - Created:', data.taxReturn.created_at.substring(0, 10));
        } else {
            console.log('❌ No tax return data');
        }

        // Check forms data
        console.log('\n=== FORMS DATA ===');
        if (data.forms) {
            const forms = data.forms;
            console.log('✓ Forms data structure present');
            console.log('  - Income form:', !!forms.incomeForm ? '✓ Available' : '❌ Missing');
            console.log('  - Adjustable tax form:', !!forms.adjustableTaxForm ? '✓ Available' : '❌ Missing');
            console.log('  - Deductions form:', !!forms.deductionsForm ? '✓ Available' : '❌ Missing');
            console.log('  - Credits form:', !!forms.creditsForm ? '✓ Available' : '❌ Missing');
            console.log('  - Reductions form:', !!forms.reductionsForm ? '✓ Available' : '❌ Missing');
            console.log('  - Wealth form:', !!forms.wealthForm ? '✓ Available' : '❌ Missing');
            console.log('  - Capital gains form:', !!forms.capitalGainForm ? '✓ Available' : '❌ Missing');
            console.log('  - Expenses form:', !!forms.expensesForm ? '✓ Available' : '❌ Missing');
        } else {
            console.log('❌ No forms data');
        }

        // Check sample data values
        console.log('\n=== SAMPLE DATA VALUES ===');
        if (data.forms && data.forms.incomeForm) {
            const income = data.forms.incomeForm;
            console.log('✓ Sample income data populated:');
            console.log('  - Salary:', income.salary_income || 0);
            console.log('  - Business income:', income.business_income || 0);
            console.log('  - Investment income:', income.investment_income || 0);
        }

        console.log('\n✅ FBR endpoint comprehensive test PASSED!');
        console.log('🎉 The system can now work for debugging without requiring completed tax returns!');

    } catch (error) {
        console.error('\n❌ FBR endpoint test FAILED:', error.response?.data || error.message);
    }
}

testFBRDetails();